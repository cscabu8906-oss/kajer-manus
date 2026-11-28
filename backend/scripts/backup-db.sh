#!/usr/bin/env bash
set -euo pipefail

# Non-destructive PostgreSQL backup script for Kajer Manus (Hostinger VPS)
# Usage: ./scripts/backup-db.sh [/var/backups/kajermanus]

BACKUP_DIR="${1:-/var/backups/kajermanus}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  exit 1
fi

OUT_FILE="${BACKUP_DIR}/kajermanus_${TIMESTAMP}.dump"
pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL" --file="$OUT_FILE"
ls -lh "$OUT_FILE"
echo "Backup saved safely to $OUT_FILE"
