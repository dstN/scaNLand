#!/usr/bin/env bash
set -euo pipefail

# Validate the generated SQLite database.
# Usage: ./scripts/validate-db.sh [path-to-db]

DB="${1:-apps/mobile/src/assets/db/scanland.db}"

if [ ! -f "$DB" ]; then
  echo "ERROR: Database not found at $DB"
  exit 1
fi

echo "=== scaNLand Database Validator ==="
echo "Database: $DB"
echo "Size: $(du -sh "$DB" | cut -f1)"
echo ""

# Check record count
COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM manufacturers;")
echo "Records: $COUNT"

if [ "$COUNT" -lt 1000 ]; then
  echo "WARNING: Record count seems low (<1000)"
fi

# Check for required tables
echo ""
echo "Tables:"
sqlite3 "$DB" ".tables"

# Check metadata
echo ""
echo "Metadata:"
sqlite3 "$DB" "SELECT key, value FROM metadata;" 2>/dev/null || echo "(no metadata table)"

# Check state distribution
echo ""
echo "Records per state:"
sqlite3 "$DB" "SELECT state_code, COUNT(*) as cnt FROM manufacturers GROUP BY state_code ORDER BY cnt DESC;"

# Sample lookup
echo ""
echo "Sample lookup (first 3 records):"
sqlite3 "$DB" "SELECT normalized_code, company_name, city FROM manufacturers LIMIT 3;"

# FTS check
echo ""
echo "FTS index check:"
FTS_COUNT=$(sqlite3 "$DB" "SELECT COUNT(*) FROM manufacturers_fts;" 2>/dev/null || echo "0")
echo "FTS records: $FTS_COUNT"

echo ""
echo "Validation complete."
