#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <path_to_backup_file.sql>"
    echo "Optional env vars: POSTGRES_CONTAINER (default devops_postgres_prod), POSTGRES_USER, POSTGRES_DB"
    exit 1
fi

# See backup.sh for why this is configurable rather than hard-coded to the
# dev container name.
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-devops_postgres_prod}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-devops_monitor}"

echo "🔄 Restoring PostgreSQL database into container '$POSTGRES_CONTAINER' from $1..."
cat "$1" | docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
echo "✅ Restoration completed!"
