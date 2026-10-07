#!/usr/bin/env bash
# Re-creates the database from scratch: schema -> security -> seed.
# Usage:  DB_NAME=swiggy_db PGUSER=postgres ./db/reset_db.sh
set -euo pipefail
DB_NAME="${DB_NAME:-swiggy_db}"
DIR="$(cd "$(dirname "$0")" && pwd)"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);" -c "CREATE DATABASE ${DB_NAME};"
for f in 01_schema.sql 02_payment_security.sql 03_seed.sql; do
  echo "running $f"
  psql -v ON_ERROR_STOP=1 -q -d "$DB_NAME" -f "$DIR/$f"
done
echo "done: $DB_NAME is ready"
