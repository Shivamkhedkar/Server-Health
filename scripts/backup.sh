#!/bin/bash
set -e

# Container name differs between dev (docker-compose.yml) and production
# (docker-compose.prod.yml): "devops_postgres" vs "devops_postgres_prod".
# This used to be hard-coded to the dev name, so running it against a real
# production deployment would fail with "no such container". Defaults to
# the production name since that's where backups actually matter, but can
# be overridden for local use.
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-devops_postgres_prod}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-devops_monitor}"

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

echo "📦 Backing up PostgreSQL database from container '$POSTGRES_CONTAINER'..."
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql"
echo "✅ Database backup saved to $BACKUP_DIR/db_backup_$TIMESTAMP.sql"
