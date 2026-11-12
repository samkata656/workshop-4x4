#!/usr/bin/env bash
# Proves a backup can be restored: loads it into a throw-away Postgres container
# (never the live one), prints row counts, then removes the container.
#
#   scripts/restore-check.sh                 # newest file in ~/backups
#   scripts/restore-check.sh path/to/file.sql.gz
#
# To restore for real after a disaster, the same file is loaded into the fresh,
# empty Postgres of the stack BEFORE the app and n8n start:
#
#   zcat file.sql.gz | docker exec -i workshop-4x4-postgres-1 sh -c 'psql -U "$POSTGRES_USER" -d postgres'
set -euo pipefail

file="${1:-$(ls -1t "${BACKUP_DIR:-$HOME/backups}"/workshop-*.sql.gz | head -1)}"
[ -f "$file" ] || { echo "No backup file found." >&2; exit 1; }
name="workshop-restore-check-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT

echo "Restoring $file into a throw-away database..."
# Same superuser name as the live database, because the dump recreates the other roles next to it.
docker run -d --name "$name" --network none -e POSTGRES_USER=workshop -e POSTGRES_PASSWORD=restore-check-only -e POSTGRES_DB=workshop postgres:16-alpine >/dev/null
until docker exec "$name" pg_isready -U workshop -d workshop >/dev/null 2>&1; do sleep 1; done
sleep 2 # the image restarts Postgres once after its first-run setup

zcat "$file" | docker exec -i "$name" psql -q -U workshop -d postgres -v ON_ERROR_STOP=0 >/dev/null 2>"/tmp/$name.err" || true
grep -vE 'already exists|^$' "/tmp/$name.err" | head -5 || true
rm -f "/tmp/$name.err"

count() { docker exec "$name" psql -U workshop -d "$1" -Atc "$2"; }
echo "app database:  bookings=$(count workshop 'select count(*) from bookings') customers=$(count workshop 'select count(*) from customers') requests=$(count workshop 'select count(*) from requests') vehicles=$(count workshop 'select count(*) from vehicles')"
echo "n8n database:  workflows=$(count n8n 'select count(*) from workflow_entity') credentials=$(count n8n 'select count(*) from credentials_entity')"
echo "Restore check finished."
