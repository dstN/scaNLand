"""
Code Normalizer — normalizes BVL approval codes to a canonical format.

Input variants:
  - "NW 50264"       → "NW50264"
  - "NW50264"        → "NW50264"
  - "NW 50.264"      → "NW50264"
  - "nw 50264"       → "NW50264"
  - "1006"           → "01006" (zero-padded to 5 digits)

Output: { state_code, approval_number (zero-padded), normalized_code, full_code }
"""

import re
from typing import Any

# Known German state codes
GERMAN_STATES = {
    'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV',
    'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH',
}



def normalize_code(state_code: str, approval_number: str) -> dict[str, str]:
    """Normalize a state code + approval number pair."""
    state = state_code.strip().upper()
    number = _clean_number(approval_number)

    normalized = f"{state}{number}"
    full = f"{state} {number}"

    return {
        'state_code': state,
        'approval_number': number,
        'normalized_code': normalized,
        'full_code': full,
    }


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    """Add normalized code fields to a manufacturer record."""
    codes = normalize_code(record['state_code'], record['approval_number'])
    record.update(codes)
    return record


def _clean_number(raw: str) -> str:
    """Remove dots, spaces, dashes from a number string."""
    return re.sub(r'[.\s\-]', '', raw.strip())
