#!/usr/bin/env bash
# Dumps BOTH databases (the app's and n8n's) into one compressed file and keeps
# the newest KEEP files. Run it on the server, by hand or from cron:
#
#   30 3 * * *  /home/deploy/bin/workshop-backup.sh >> /home/deploy/backups/backup.log 2>&1
#
# The dump contains customer data: the folder and files are readable by the
# owner only. Copy the files off the server regularly; a backup that lives only
# on the same droplet does not survive losing the droplet.
set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-workshop-4x4-postgres-1}"
DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP="${BACKUP_KEEP:-14}"

umask 077
mkdir -p "$DIR"
file="$DIR/workshop-$(date +%Y%m%d-%H%M%S).sql.gz"

# Written under a temporary name first, so a failed dump never looks like a backup.
docker exec "$CONTAINER" sh -c 'pg_dumpall -U "$POSTGRES_USER"' | gzip > "$file.part"
gzip -t "$file.part"
[ "$(zcat "$file.part" | grep -c '^CREATE TABLE')" -gt 0 ] || { echo "$(date -Is) backup has no tables, keeping nothing" >&2; rm -f "$file.part"; exit 1; }
mv "$file.part" "$file"

# Keep the newest $KEEP scheduled backups; older ones are deleted.
ls -1t "$DIR"/workshop-????????-??????.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

echo "$(date -Is) backup ok: $file ($(du -h "$file" | cut -f1))"
