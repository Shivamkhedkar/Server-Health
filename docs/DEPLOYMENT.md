# Deployment

## Local development

```bash
cp .env.example .env    # fill in every value
docker compose up --build -d
docker compose ps        # wait for everything to report "healthy"
```

Every service's port is also published to the host in this file for convenience while developing (Postgres 5432, Redis 6379, Prometheus 9090, AlertManager 9093, Grafana 3000, backend 8000, frontend 80).

## Production

```bash
cp .env.example .env
# fill in REAL production values - SECRET_KEY, POSTGRES_PASSWORD,
# ADMIN_DEFAULT_PASSWORD, GRAFANA_ADMIN_PASSWORD, and CORS_ALLOWED_ORIGINS
# are all required; docker compose will refuse to start with a clear
# error naming the missing variable if any are left blank.
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml ps
```

Only Nginx (port 80) and Grafana (port 3000) are published to the host. Postgres, Redis, Prometheus, AlertManager, and the backend itself are reachable only on the internal Docker network - Nginx is the sole entrypoint to the backend (REST, health checks, and the metrics WebSocket all proxy through it). Put your own TLS termination (e.g. a load balancer, or Nginx + certbot) in front of ports 80/3000 for a real deployment; this repo intentionally doesn't assume a specific TLS setup.

### Verifying a deployment

```bash
curl -f http://localhost/health          # backend health, through Nginx
curl -f http://localhost/health/redis    # real Redis ping
curl -f http://localhost/                # frontend
docker compose -f docker-compose.prod.yml logs -f backend
```

## Jenkins CI/CD

The `Jenkinsfile` runs: Checkout → Install Dependencies → Lint → Unit Tests → Integration/API Tests → Security Scan (Trivy, `--exit-code 1` so it actually fails the build on HIGH/CRITICAL findings) → Docker Build → Deploy (`docker compose -f docker-compose.prod.yml up -d`) → Health Check (through Nginx, since the backend's own port isn't published). Every quality gate can fail the build - there is no `|| true` anywhere masking a real failure.

The Jenkins agent needs its own `.env` file already provisioned on the deploy host with real production secrets; the pipeline does not create or manage that file for you.

## GitHub Actions

`.github/workflows/ci-cd.yml` runs backend lint+tests and frontend lint+build+test on every push/PR, then does a Docker Compose build/smoke-test using throwaway CI-only env values (never real secrets) written to a temporary `.env` for that job only. It does not deploy anywhere - that's Jenkins' job.

## Backup & restore

```bash
./scripts/backup.sh                              # backs up the prod DB by default
POSTGRES_CONTAINER=devops_postgres ./scripts/backup.sh   # back up the dev DB instead
./scripts/restore.sh backups/db_backup_YYYYMMDD_HHMMSS.sql
```

## Rollback

`./scripts/rollback.sh` tears down the production stack and brings up the dev compose stack as an emergency fallback. It is **not** a true versioned rollback (there is no image-tag/version registry in this project yet) - see the script's own comments and the README's "Known limitations".
