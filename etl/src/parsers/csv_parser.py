"""
BVL CSV Parser — parses the official BVL CSV export file.

The CSV is semicolon-delimited with cp1252 (Windows Latin-1) encoding.
Header line starts with '#'.
Key columns:
  - Bundesland (col 0)
  - Name des Betriebs (col 1)
  - Straße / Haus-Nr. (col 2) — street + house number combined
  - Ort (col 3) — postal code + city combined (e.g., "47495 Rheinberg")
  - Alte Zulassungs-nummern (col 4) — old approval numbers
  - Neue Zulassungsnummer (col 5) — new approval number (e.g., "NW 50264")
  - Remaining columns: category flags
  - Einschränkungen (col -6): restrictions
  - Bemerkungen (col -5): remarks
  - Zulassung befristet bis (col -4): approval valid until
  - Zulassung ruht seit (col -3): approval suspended since
  - Drittlandzulassungen (col -2): third-country approvals
"""

import re
from pathlib import Path
from typing import Any

import pandas as pd


def parse_csv(filepath: str | Path) -> list[dict[str, Any]]:
    """Parse BVL CSV export and return a list of manufacturer dicts."""
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"CSV file not found: {filepath}")

    # Read with explicit encoding — BVL exports use Windows Latin-1
    df = pd.read_csv(
        filepath,
        sep=';',
        encoding='cp1252',
        dtype=str,
        keep_default_na=False,
        on_bad_lines='skip',
    )

    # Strip the '#' from header and clean column names
    df.columns = [c.lstrip('# ').strip() for c in df.columns]

    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        record = _parse_row(row)
        if record:
            records.append(record)

    return records


def _parse_row(row: pd.Series) -> dict[str, Any] | None:
    """Parse a single CSV row into a manufacturer dict."""
    state_code = str(row.get('Bundesland', '')).strip().upper()
    company_name = str(row.get('Name des Betriebs', '')).strip()
    new_code = str(row.get('Neue Zulassungsnummer', '')).strip()
    old_code = str(row.get('Alte Zulassungs-nummern', '')).strip()

    # Use new code, fall back to old code if new is empty
    approval_code = new_code if new_code else old_code

    if not state_code or not approval_code:
        return None

    # Parse approval number from "NW 50264" or "SN 016" format
    approval_number = _extract_number(approval_code)
    if not approval_number:
        return None

    # Parse street + house number
    street_raw = str(row.get('Straße / Haus-Nr.', '')).strip()
    street, house_number = _split_street(street_raw)

    # Parse postal code + city from "47495 Rheinberg"
    ort_raw = str(row.get('Ort', '')).strip()
    postal_code, city = _split_ort(ort_raw)

    # Tail columns (use iloc for reliability)
    cols = row.index.tolist()
    restrictions = ''
    remarks = ''
    approval_valid_until = ''
    approval_suspended_since = ''
    third_country = ''

    # Find tail columns by name
    for col in cols:
        col_lower = col.lower() if isinstance(col, str) else ''
        if 'einschr' in col_lower:
            restrictions = str(row[col]).strip()
        elif 'bemerkung' in col_lower:
            remarks = str(row[col]).strip()
        elif 'befristet' in col_lower:
            approval_valid_until = str(row[col]).strip()
        elif 'ruht' in col_lower:
            approval_suspended_since = str(row[col]).strip()
        elif 'drittland' in col_lower:
            third_country = str(row[col]).strip()

    return {
        'state_code': state_code,
        'approval_number': approval_number,
        'raw_code': approval_code,  # Keep full raw code for merge dedup
        'company_name': company_name,
        'street': street,
        'house_number': house_number,
        'postal_code': postal_code,
        'city': city,
        'categories': [],
        'restrictions': restrictions,
        'remarks': remarks,
        'third_country_approvals': third_country,
        'approval_valid_until': approval_valid_until,
        'approval_suspended_since': approval_suspended_since,
    }


def _extract_number(code: str) -> str | None:
    """Extract numeric approval number from 'NW 50264' format."""
    match = re.search(r'\d+', code)
    return match.group(0) if match else None


def _split_street(raw: str) -> tuple[str, str]:
    """Split 'Rheinfeld 8' into ('Rheinfeld', '8')."""
    match = re.match(r'^(.*?)\s+(\d+\S*)$', raw)
    if match:
        return match.group(1).strip(), match.group(2).strip()
    return raw, ''


def _split_ort(raw: str) -> tuple[str, str]:
    """Split '47495 Rheinberg' into ('47495', 'Rheinberg')."""
    match = re.match(r'^(\d{4,5})\s+(.+)$', raw)
    if match:
        return match.group(1), match.group(2).strip()
    return '', raw
