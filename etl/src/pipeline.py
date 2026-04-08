#!/usr/bin/env python3
"""
scaNLand ETL Pipeline — Main orchestrator.

Parses BVL XML and CSV exports, normalizes approval codes,
validates data, and builds the SQLite database for the mobile app.

Usage:
  python etl/src/pipeline.py --source sampledata/ --output apps/mobile/src/assets/db/scanland.db
"""

import argparse
import sys
from pathlib import Path
from typing import Any

# Add parent to path for imports when running as script
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.parsers.xml_parser import parse_xml
from src.parsers.csv_parser import parse_csv
from src.normalizers.code_normalizer import normalize_record
from src.validators.data_validator import validate_records, print_stats
from src.builders.sqlite_builder import build_database


def run_pipeline(source_dir: str, output_path: str) -> None:
    """Run the full ETL pipeline."""
    source = Path(source_dir)
    xml_path = source / 'export.xml'
    csv_path = source / 'export.csv'

    print("scaNLand ETL Pipeline")
    print("=" * 50)

    # 1. PARSE
    print("\n[1/5] Parsing sources...")

    xml_records = []
    if xml_path.exists():
        xml_records = parse_xml(xml_path)
        print(f"  XML: {len(xml_records)} records parsed")
    else:
        print(f"  XML: file not found ({xml_path}), skipping")

    csv_records = []
    if csv_path.exists():
        csv_records = parse_csv(csv_path)
        print(f"  CSV: {len(csv_records)} records parsed")
    else:
        print(f"  CSV: file not found ({csv_path}), skipping")

    if not xml_records and not csv_records:
        print("ERROR: No data parsed from either source")
        sys.exit(1)

    # 2. MERGE + DEDUPLICATE
    print("\n[2/5] Merging and deduplicating...")
    merged = _merge_records(xml_records, csv_records)
    print(f"  Merged: {len(merged)} unique records")

    # 3. NORMALIZE
    print("\n[3/5] Normalizing codes...")
    normalized = [normalize_record(r) for r in merged]
    print(f"  Normalized: {len(normalized)} records")

    # 4. VALIDATE
    print("\n[4/5] Validating records...")
    valid, errors = validate_records(normalized)
    print_stats(valid, errors)

    # 5. BUILD
    print("\n[5/5] Building SQLite database...")
    build_database(valid, output_path)

    print(f"\nPipeline complete!")


def _merge_records(
    xml_records: list[dict[str, Any]], csv_records: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Merge XML and CSV records, preferring XML data (more structured).
    Deduplicates on (state_code, approval_number).
    For CSV records with old-format codes, uses raw_code to prevent
    collisions between different approval types (e.g., SN 016 vs SN-EV 016).
    """
    # Index XML records by key
    merged: dict[str, dict[str, Any]] = {}
    for record in xml_records:
        key = f"{record['state_code']}_{record['approval_number']}"
        merged[key] = record

    # Add CSV records, filling gaps
    for record in csv_records:
        # Use raw_code if available for a more specific key (prevents old-format collisions)
        raw = record.get('raw_code', '')
        key = f"{record['state_code']}_{record['approval_number']}"
        raw_key = f"{record['state_code']}_{raw}" if raw else key

        if key not in merged and raw_key not in merged:
            # New record — store by primary key
            merged[key] = record
        elif key in merged and raw_key != key and raw_key not in merged:
            # Same number but different raw code — store as separate entry
            merged[raw_key] = record
        elif key in merged:
            # Fill empty fields from CSV into existing XML record
            existing = merged[key]
            for field in ['street', 'house_number', 'postal_code', 'city',
                          'restrictions', 'remarks', 'third_country_approvals',
                          'approval_valid_until', 'approval_suspended_since']:
                if not existing.get(field) and record.get(field):
                    existing[field] = record[field]

    return list(merged.values())


def main():
    parser = argparse.ArgumentParser(description='scaNLand ETL Pipeline')
    parser.add_argument(
        '--source', '-s',
        required=True,
        help='Directory containing export.xml and/or export.csv'
    )
    parser.add_argument(
        '--output', '-o',
        required=True,
        help='Output path for the SQLite database file'
    )
    args = parser.parse_args()
    run_pipeline(args.source, args.output)


if __name__ == '__main__':
    main()
