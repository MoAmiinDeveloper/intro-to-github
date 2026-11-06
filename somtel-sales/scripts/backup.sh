#!/bin/sh
# Backs up the database and uploaded files into ./backups/<date>/
# Run from the somtel-sales folder on the server:  sh scripts/backup.sh
set -e
STAMP=$(date +%Y-%m-%d_%H%M)
DIR="backups/$STAMP"
mkdir -p "$DIR"
docker compose exec -T db pg_dump -U somtel -d somtel -Fc > "$DIR/somtel.dump"
docker compose run --rm --no-deps -T --user root --entrypoint "" -v "$(pwd)/$DIR:/backup" app tar -czf /backup/uploads.tar.gz -C /data uploads
echo "Backup saved in $DIR"
ls -lh "$DIR"
