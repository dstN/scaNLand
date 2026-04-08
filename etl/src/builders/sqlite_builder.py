"""
SQLite Builder — creates the scanland.db database from normalized records.
"""

import json
import sqlite3
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_SQL = """
-- Core lookup table
CREATE TABLE IF NOT EXISTS manufacturers (
  id                        INTEGER PRIMARY KEY,
  state_code                TEXT NOT NULL,
  approval_number           TEXT NOT NULL,
  normalized_code           TEXT NOT NULL,
  full_code                 TEXT NOT NULL,
  company_name              TEXT NOT NULL,
  street                    TEXT,
  house_number              TEXT,
  postal_code               TEXT,
  city                      TEXT,
  categories                TEXT,
  restrictions              TEXT,
  remarks                   TEXT,
  third_country_approvals   TEXT,
  approval_valid_until      TEXT,
  approval_suspended_since  TEXT,
  created_at                TEXT DEFAULT (datetime('now')),
  updated_at                TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_normalized_code ON manufacturers(normalized_code);
CREATE INDEX IF NOT EXISTS idx_approval_number ON manufacturers(approval_number);
CREATE INDEX IF NOT EXISTS idx_state_code ON manufacturers(state_code);

-- FTS5 full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS manufacturers_fts USING fts5(
  company_name, city, normalized_code,
  content='manufacturers', content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS manufacturers_ai AFTER INSERT ON manufacturers BEGIN
  INSERT INTO manufacturers_fts(rowid, company_name, city, normalized_code)
  VALUES (new.id, new.company_name, new.city, new.normalized_code);
END;

CREATE TRIGGER IF NOT EXISTS manufacturers_ad AFTER DELETE ON manufacturers BEGIN
  INSERT INTO manufacturers_fts(manufacturers_fts, rowid, company_name, city, normalized_code)
  VALUES ('delete', old.id, old.company_name, old.city, old.normalized_code);
END;

CREATE TRIGGER IF NOT EXISTS manufacturers_au AFTER UPDATE ON manufacturers BEGIN
  INSERT INTO manufacturers_fts(manufacturers_fts, rowid, company_name, city, normalized_code)
  VALUES ('delete', old.id, old.company_name, old.city, old.normalized_code);
  INSERT INTO manufacturers_fts(rowid, company_name, city, normalized_code)
  VALUES (new.id, new.company_name, new.city, new.normalized_code);
END;

-- Submission queue (used by mobile app, not pre-populated)
CREATE TABLE IF NOT EXISTS submission_queue (
  id                 INTEGER PRIMARY KEY,
  approval_code      TEXT NOT NULL,
  product_image_path TEXT,
  brand_name         TEXT,
  product_name       TEXT,
  company_name       TEXT,
  address            TEXT,
  country            TEXT,
  region             TEXT,
  category           TEXT,
  ocr_confidence     REAL,
  status             TEXT DEFAULT 'pending',
  created_at         TEXT DEFAULT (datetime('now')),
  retry_count        INTEGER DEFAULT 0,
  last_error         TEXT
);

-- Scan history
CREATE TABLE IF NOT EXISTS scan_history (
  id              INTEGER PRIMARY KEY,
  scanned_text    TEXT NOT NULL,
  normalized_code TEXT,
  matched         INTEGER DEFAULT 0,
  manufacturer_id INTEGER,
  confidence      REAL,
  scanned_at      TEXT DEFAULT (datetime('now'))
);

-- Database metadata
CREATE TABLE IF NOT EXISTS db_metadata (
  key   TEXT PRIMARY KEY,
  value TEXT
);
"""

INSERT_SQL = """
INSERT OR IGNORE INTO manufacturers (
  state_code, approval_number, normalized_code, full_code,
  company_name, street, house_number, postal_code, city,
  categories, restrictions, remarks,
  third_country_approvals, approval_valid_until, approval_suspended_since
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def build_database(records: list[dict[str, Any]], output_path: str | Path) -> None:
    """Build the SQLite database from normalized records."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Remove existing DB to start fresh
    if output_path.exists():
        output_path.unlink()

    conn = sqlite3.connect(str(output_path))
    try:
        # Create schema
        conn.executescript(SCHEMA_SQL)

        # Bulk insert
        rows: list[tuple[str | Any, ...]] = [_record_to_row(r) for r in records]
        conn.executemany(INSERT_SQL, rows)

        # Write metadata
        now = datetime.now(timezone.utc).isoformat()
        source_hash = _compute_hash(records)
        metadata = {
            'version': '1.0.0',
            'build_date': now,
            'source_hash': source_hash,
            'record_count': str(len(records)),
        }
        for key, value in metadata.items():
            conn.execute(
                'INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)',
                (key, value)
            )

        conn.execute('PRAGMA journal_mode=DELETE')
        conn.commit()

        # Optimize
        conn.execute('VACUUM')
        conn.execute('ANALYZE')

        print(f"\nDatabase built successfully: {output_path}")
        print(f"  Records: {len(records)}")
        print(f"  Size: {output_path.stat().st_size / 1024:.1f} KB")
        print(f"  Hash: {source_hash[:16]}...")

    finally:
        conn.close()


def _record_to_row(record: dict[str, Any]) -> tuple[str | Any, ...]:
    """Convert a record dict to a tuple for INSERT."""
    categories = record.get('categories', [])
    categories_json: str = json.dumps(categories) if categories else '[]'

    return (
        record.get('state_code', ''),
        record.get('approval_number', ''),
        record.get('normalized_code', ''),
        record.get('full_code', ''),
        record.get('company_name', ''),
        record.get('street', ''),
        record.get('house_number', ''),
        record.get('postal_code', ''),
        record.get('city', ''),
        categories_json,
        record.get('restrictions', ''),
        record.get('remarks', ''),
        record.get('third_country_approvals', ''),
        record.get('approval_valid_until', ''),
        record.get('approval_suspended_since', ''),
    )


def _compute_hash(records: list[dict[str, Any]]) -> str:
    """Compute a SHA-256 hash of all normalized codes for versioning."""
    codes = sorted(r.get('normalized_code', '') for r in records)
    return hashlib.sha256('|'.join(codes).encode()).hexdigest()
