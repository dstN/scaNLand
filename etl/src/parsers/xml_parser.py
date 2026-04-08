"""
BVL XML Parser — parses the official BVL XML export file.

The XML uses the namespace 'http://www.balvi.de/schemas' with prefix 'bvl'.
Structure: <bvl:import> → <bvl:betrieb> (one per establishment) containing:
  - <bvl:zulassungsnummer> → <bvl:bundesland> + <bvl:nummer>
  - <bvl:name>, <bvl:strasse>, <bvl:hausnummer>, <bvl:postleitzahl>, <bvl:ort>
  - <bvl:taetigkeit> → activity/category sections
"""

from lxml import etree
from pathlib import Path
from typing import Any


BVL_NS = {'bvl': 'http://www.balvi.de/schemas'}


def parse_xml(filepath: str | Path) -> list[dict[str, Any]]:
    """Parse BVL XML export and return a list of manufacturer dicts."""
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"XML file not found: {filepath}")

    tree = etree.parse(str(filepath))
    root = tree.getroot()

    records: list[dict[str, Any]] = []
    for betrieb in root.findall('.//bvl:betrieb', BVL_NS):
        record = _parse_betrieb(betrieb)
        if record:
            records.append(record)

    return records


def _parse_betrieb(element: etree._Element) -> dict[str, Any] | None:
    """Parse a single <bvl:betrieb> element into a dict."""
    zulassung = element.find('bvl:zulassungsnummer', BVL_NS)
    if zulassung is None:
        return None

    bundesland = _text(zulassung, 'bvl:bundesland')
    nummer = _text(zulassung, 'bvl:nummer')

    if not bundesland or not nummer:
        return None

    # Extract categories from taetigkeit sections
    categories = _parse_categories(element)

    # Extract restrictions and remarks from taetigkeit
    restrictions = _text_from_taetigkeit(element, 'bvl:bemerkung')

    # Extract third-country approvals
    third_country = _parse_third_country(element)

    return {
        'state_code': bundesland.strip().upper(),
        'approval_number': nummer.strip(),
        'company_name': _text(element, 'bvl:name') or '',
        'street': _text(element, 'bvl:strasse') or '',
        'house_number': _text(element, 'bvl:hausnummer') or '',
        'postal_code': _text(element, 'bvl:postleitzahl') or '',
        'city': _text(element, 'bvl:ort') or '',
        'categories': categories,
        'restrictions': restrictions,
        'remarks': '',
        'third_country_approvals': third_country,
        'approval_valid_until': '',
        'approval_suspended_since': '',
    }


def _text(parent: etree._Element, tag: str) -> str:
    """Get text content of a child element."""
    el = parent.find(tag, BVL_NS)
    if el is not None and el.text:
        return el.text.strip()
    return ''


def _parse_categories(betrieb: etree._Element) -> list[str]:
    """Extract all activity categories from taetigkeit sections."""
    categories: set[str] = set()
    for taetigkeit in betrieb.findall('bvl:taetigkeit', BVL_NS):
        for sektion in taetigkeit.findall('.//bvl:sektion', BVL_NS):
            section_name = sektion.get('name', '')
            for unter in sektion.findall('bvl:untersektion', BVL_NS):
                unter_name = unter.get('name', '')
                kat = _text(unter, 'bvl:kategorie')
                entry = f"{section_name}/{unter_name}"
                if kat:
                    entry += f":{kat}"
                categories.add(entry)
    return sorted(categories) if categories else []


def _text_from_taetigkeit(betrieb: etree._Element, tag: str) -> str:
    """Get text from the first taetigkeit element's child matching tag."""
    for taetigkeit in betrieb.findall('bvl:taetigkeit', BVL_NS):
        val = _text(taetigkeit, tag)
        if val:
            return val
    return ''


def _parse_third_country(betrieb: etree._Element) -> str:
    """Extract third-country approval info."""
    for taetigkeit in betrieb.findall('bvl:taetigkeit', BVL_NS):
        val = _text(taetigkeit, 'bvl:drittland')
        if val:
            return val
    return ''
