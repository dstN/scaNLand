"""Tests for the code normalizer."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.normalizers.code_normalizer import normalize_code


def test_basic_normalization():
    result = normalize_code('NW', '50264')
    assert result['normalized_code'] == 'NW50264'
    assert result['full_code'] == 'NW 50264'
    assert result['state_code'] == 'NW'
    assert result['approval_number'] == '50264'


def test_zero_padding():
    result = normalize_code('RP', '1006')
    assert result['approval_number'] == '01006'
    assert result['normalized_code'] == 'RP01006'


def test_dots_removed():
    result = normalize_code('FR', '12.345')
    assert result['approval_number'] == '12345'
    assert result['normalized_code'] == 'FR12345'


def test_lowercase_state():
    result = normalize_code('nw', '50264')
    assert result['state_code'] == 'NW'
    assert result['normalized_code'] == 'NW50264'


def test_spaces_in_number():
    result = normalize_code('NW', '50 264')
    assert result['approval_number'] == '50264'


def test_dash_in_number():
    result = normalize_code('NW', '50-264')
    assert result['approval_number'] == '50264'


if __name__ == '__main__':
    test_basic_normalization()
    test_zero_padding()
    test_dots_removed()
    test_lowercase_state()
    test_spaces_in_number()
    test_dash_in_number()
    print("All normalizer tests passed!")
