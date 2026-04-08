#!/usr/bin/env bash
set -euo pipefail

# Build the SQLite database from BVL export files.
# Usage: ./scripts/build-db.sh [--xml path] [--csv path] [--output path]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

XML_PATH="${PROJECT_ROOT}/sampledata/export.xml"
CSV_PATH="${PROJECT_ROOT}/sampledata/export.csv"
OUTPUT="${PROJECT_ROOT}/apps/mobile/src/assets/db/scanland.db"

while [[ $# -gt 0 ]]; do
  case $1 in
    --xml) XML_PATH="$2"; shift 2 ;;
    --csv) CSV_PATH="$2"; shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "=== scaNLand Database Builder ==="
echo "XML: $XML_PATH"
echo "CSV: $CSV_PATH"
echo "Output: $OUTPUT"
echo ""

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT")"

# Run the ETL pipeline
cd "$PROJECT_ROOT/etl"

if [ ! -d ".venv" ]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate

pip install -q -r requirements.txt

python -m src.pipeline \
  --xml "$XML_PATH" \
  --csv "$CSV_PATH" \
  --output "$OUTPUT"

echo ""
echo "Database built successfully: $OUTPUT"
echo "Size: $(du -sh "$OUTPUT" | cut -f1)"
