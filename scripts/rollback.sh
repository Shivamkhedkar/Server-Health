#!/bin/bash
set -e

# NOTE: this intentionally falls back to the dev docker-compose.yml stack
# (different container names, different exposed ports, no
# production-only env var enforcement) rather than a previous *version* of
# the production stack - true rolling rollback would require an image
# tagging/versioning strategy (e.g. re-deploying the previous Jenkins
# BUILD_TAG image) which this project does not implement yet. Treat this
# script as an emergency "get something running" fallback, not a like-for-
# like production rollback. See docs/DEPLOYMENT.md "Known limitations".
echo "⚠️ Initiating fallback to the local/dev stack (docker-compose.yml)..."
read -p "This replaces the production stack with the DEV compose stack - not a true version rollback. Continue? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 1
fi

docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.yml up -d
echo "✅ Fallback to dev compose stack complete!"
