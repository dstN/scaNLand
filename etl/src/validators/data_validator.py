"""
Data Validator — validates parsed and normalized BVL records before SQLite insert.
"""

import re
from typing import Any

GERMAN_STATES = {
    'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
    'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
}


def validate_records(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """
    Validate a list of records. Returns (valid_records, errors).
    Each error is { 'code': ..., 'reason': ... }.
    """
    valid: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    seen_codes: set[str] = set()

    for record in records:
        normalized = record.get('normalized_code', '')
        state = record.get('state_code', '')
        number = record.get('approval_number', '')

        # Check state code
        if state not in GERMAN_STATES:
            errors.append({'code': normalized, 'reason': f'Unknown state code: {state}'})
            continue

        # Check approval number format (digits only after cleaning)
        if not re.match(r'^\d+$', number):
            errors.append({'code': normalized, 'reason': f'Invalid number format: {number}'})
            continue

        # Check company name is present
        if not record.get('company_name', '').strip():
            errors.append({'code': normalized, 'reason': 'Missing company name'})
            continue

        # Handle duplicates: if normalized_code already seen, try to qualify it
        if normalized in seen_codes:
            raw_code = record.get('raw_code', '')
            new_qualifier = re.search(r'-([A-Z]{2,4})\b', raw_code)

            if new_qualifier:
                # New record has a qualifier (e.g., -EV) — store it under qualified key
                qualifier = new_qualifier.group(1)
                qualified = f"{normalized}-{qualifier}"
                if qualified not in seen_codes:
                    record['normalized_code'] = qualified
                    record['full_code'] = f"{record.get('full_code', '')} ({qualifier})"
                    normalized = qualified
                else:
                    errors.append({'code': normalized, 'reason': 'Duplicate entry'})
                    continue
            else:
                # New record has NO qualifier — it should be the primary.
                # Check if the existing record has a qualifier and can be moved.
                existing = next((r for r in valid if r.get('normalized_code') == normalized), None)
                if existing:
                    existing_raw: str = existing.get('raw_code', '')
                    existing_qualifier = re.search(r'-([A-Z]{2,4})\b', existing_raw)
                    if existing_qualifier:
                        # Swap: move existing to qualified key, put new record as primary
                        eq = existing_qualifier.group(1)
                        qualified_existing = f"{normalized}-{eq}"
                        if qualified_existing not in seen_codes:
                            existing['normalized_code'] = qualified_existing
                            existing['full_code'] = f"{existing.get('full_code', '')} ({eq})"
                            seen_codes.add(qualified_existing)
                            # Don't add normalized again — it stays in seen_codes for the new record
                        else:
                            errors.append({'code': normalized, 'reason': 'Duplicate entry'})
                            continue
                    else:
                        errors.append({'code': normalized, 'reason': 'Duplicate entry'})
                        continue
                else:
                    errors.append({'code': normalized, 'reason': 'Duplicate entry'})
                    continue

        seen_codes.add(normalized)
        valid.append(record)

    return valid, errors


def print_stats(valid: list[dict[str, Any]], errors: list[dict[str, str]]) -> None:
    """Print validation statistics."""
    print(f"\n{'='*50}")
    print(f"Validation Results")
    print(f"{'='*50}")
    print(f"Total valid records: {len(valid)}")
    print(f"Total errors:        {len(errors)}")

    if valid:
        # Count per state
        state_counts: dict[str, int] = {}
        for r in valid:
            st = r['state_code']
            state_counts[st] = state_counts.get(st, 0) + 1

        print(f"\nRecords per state:")
        for state in sorted(state_counts.keys()):
            print(f"  {state}: {state_counts[state]}")

    if errors:
        print(f"\nFirst 10 errors:")
        for err in errors[:10]:
            print(f"  {err['code']}: {err['reason']}")
