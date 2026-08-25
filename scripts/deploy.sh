#!/bin/bash
set -e

echo "🚀 Deploying DevOps Monitor Pro Platform..."
docker compose -f docker-compose.prod.yml down --remove-orphans || true
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

echo "✅ Verification Health Check..."
sleep 5
# Goes through the one publicly exposed port (frontend/Nginx, which now
# proxies /health to the backend - see frontend/nginx.conf) rather than
# the backend's own port, which is deliberately not published to the host
# in docker-compose.prod.yml.
curl -f http://localhost:80/health || (echo "❌ Backend Health Check Failed!" && exit 1)
curl -f http://localhost:80/ || (echo "❌ Frontend Health Check Failed!" && exit 1)

echo "🎉 Deployment Completed Successfully!"
