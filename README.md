# 🚀 DevOps Monitor Pro — Server Health Monitoring Platform

[![Build Status](https://img.shields.io/badge/CI%2FCD-Jenkins-blue.svg)](https://jenkins.io)
[![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.10-009688.svg)](https://fastapi.tiangolo.com)
[![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20Tailwind-61DAFB.svg)](https://reactjs.org)
[![Monitoring](https://img.shields.io/badge/Monitoring-Prometheus%20%7C%20Grafana-E6522C.svg)](https://prometheus.io)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A server health monitoring platform: live CPU/RAM/disk/network telemetry over a WebSocket, a role-based dashboard, configurable threshold-based incident alerting (email + Telegram), Prometheus/Grafana/AlertManager for infrastructure-level metrics and visualization, and a Jenkins CI/CD pipeline.

This README describes the project **as it actually exists in this repository** - not an idealized version of it. The "Known limitations" section at the bottom is deliberately honest about what isn't done.

---

## 📐 System Architecture

```
User
  |
  v
Nginx (:80) --------------------------+
  |         \                         |
  | /        \ /api, /api/metrics/ws  |
  v           v                       |
React SPA    FastAPI Backend (:8000, not published to the host)
(static)       |        |        |
               |        |        +--> Redis (rate-limiter storage, optional)
               |        +--> PostgreSQL (persistence)
               +--> /metrics  ---> Prometheus (:9090) ---> Grafana (:3000)
                                        |
                                        v
                                  Alert Rules ---> AlertManager (:9093)
                                                    (no-op receiver by default -
                                                     see alertmanager/alertmanager.yml)

FastAPI's own alert engine (independent of the above) evaluates the same
metrics against operator-configurable thresholds (Settings page) and is
the one path that actually sends Email/Telegram notifications, with
per-alert-type cooldown, acknowledgement, and persisted history. See
"Alerting: two independent paths" below for why there are two systems
and why they don't double-page for the same incident.
```

In production (`docker-compose.prod.yml`), only Nginx (port 80) and Grafana (port 3000) are published to the host. Postgres, Redis, Prometheus, AlertManager, and the backend itself are reachable only on the internal Docker network - Nginx is the sole path to the backend, including for the metrics WebSocket. The dev compose file (`docker-compose.yml`) additionally publishes those internal services' ports for local convenience.

---

## ✨ Features

- **Live telemetry**: CPU/RAM/disk/network/process metrics streamed to the dashboard over a WebSocket (`/api/metrics/ws`), all reading from one shared in-process snapshot so every consumer (REST, WebSocket, Prometheus `/metrics`) agrees on the same numbers.
- **Role-based access**: `admin` vs `viewer` roles, enforced in the backend (not just hidden UI buttons) - see `backend/app/api/dependencies.py`.
- **JWT auth with refresh tokens**: short-lived access tokens (30 min default) plus a longer-lived refresh token (`POST /api/auth/refresh`), so a leaked access token has a short useful life without forcing constant re-login. See "Known limitations" for what this does *not* include (rotation/revocation).
- **Configurable incident alerting**: CPU/RAM/disk thresholds, alert cooldown, and email/Telegram delivery are all configurable at runtime from the Settings page, backed by an `app_settings` table - no redeploy needed to change a threshold.
- **Prometheus + Grafana**: the backend's `/metrics` endpoint is scraped by Prometheus (via the standard `prometheus-client` library - this is a FastAPI endpoint, not a separate exporter process); Grafana is pre-provisioned with a datasource and dashboard pointing at it.
- **Jenkins CI/CD**: Checkout → Install Dependencies → Lint → Unit Tests → Integration/API Tests → Security Scan (Trivy) → Docker Build → Deploy → Health Check, with every quality gate able to actually fail the build (no `|| true` swallowing failures).

### Alerting: two independent paths, by design

There are two systems watching the same CPU/RAM/disk numbers:

1. **Prometheus + AlertManager** - static thresholds in `prometheus/alert_rules.yml`, evaluated independently of the FastAPI app (keeps working even if the app itself is down). Feeds Grafana's alerting UI and AlertManager's own UI (`:9093`). Its receiver is intentionally a no-op (see the comment in `alertmanager/alertmanager.yml`) so it does not also page a human.
2. **The FastAPI app** (`app/services/metric_service.py` + `notification_service.py`) - operator-configurable thresholds, per-alert-type cooldown, acknowledgement, and persisted alert history. This is the only path that sends real Email/Telegram notifications.

An earlier version of this project had *both* paths pushing to Telegram through a separate `telegram-bot` microservice - which, on inspection, never actually called the Telegram API at all (it only logged the payload it received). That service has been removed; see git history if you want to see what it looked like.

---

## 🛠 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Chart.js, react-chartjs-2, React Router v6, Axios, Lucide Icons.
- **Backend**: FastAPI (Python 3.10), SQLAlchemy ORM, JWT (`python-jose`), PBKDF2-HMAC password hashing (stdlib `hashlib`, no separate hashing library), `psutil`, `prometheus-client`, `slowapi` for rate limiting.
- **Database**: PostgreSQL 15. Redis 7 backs the login rate-limiter's shared storage (see `backend/app/core/limiter.py`) - it is not used as a general-purpose cache and falls back to in-memory rate limiting automatically if unreachable.
- **Monitoring**: Prometheus, AlertManager, Grafana.
- **Infrastructure & CI/CD**: Docker, Docker Compose, Nginx, Jenkins, GitHub Actions (PR-level lint/test/build check).

---

## 🚀 Quick Start

> [!IMPORTANT]
> **No credentials ship in this repository.** Copy `.env.example` to `.env` and fill in real values before starting the stack - `SECRET_KEY`, `POSTGRES_PASSWORD`, `ADMIN_DEFAULT_PASSWORD`, and `GRAFANA_ADMIN_PASSWORD` are all required (Compose will refuse to start with a clear error if any are missing, rather than silently using a default). `ADMIN_DEFAULT_PASSWORD` is the seed password for the auto-created `admin` account on first boot only - change it immediately after first login via Settings > Change Password.

### Prerequisites
- Docker Engine 24+ & Docker Compose v2+
- Python 3.10+ (for local backend development outside Docker)
- Node.js 18+ (for local frontend development outside Docker)

### 1. Configure environment
```bash
cp .env.example .env
# edit .env and fill in every value - see the comments in that file
```

### 2. Launch the stack
```bash
# Local development (all internal ports also published for convenience)
docker compose up --build -d

# Production (only Nginx :80 and Grafana :3000 published - see Architecture above)
docker compose -f docker-compose.prod.yml up --build -d
```

### Access services (dev stack)
- **Frontend**: `http://localhost:80`
- **FastAPI OpenAPI docs**: `http://localhost:8000/docs`
- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3000` (login: `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` from your `.env`)
- **AlertManager**: `http://localhost:9093`

In production, everything except the frontend and Grafana goes through Nginx on port 80; see `docker-compose.prod.yml`.

### Verifying the stack is actually up
```bash
docker compose config          # validates the compose file + env var interpolation
docker compose ps              # all services should show "healthy" once their healthchecks pass
docker compose logs -f backend # tail backend logs
curl -f http://localhost/health         # through Nginx
curl -f http://localhost/health/redis   # real Redis ping, not a hard-coded response
```

---

## 🧪 Running Tests

### Backend (pytest)
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
pytest tests/ --cov=app -v

# Or split the way Jenkins does it:
pytest tests/ -m unit -v          # pure service-logic tests, no HTTP client
pytest tests/ -m "not unit" -v    # everything else (TestClient-based API/auth/websocket/rate-limit tests)
```

### Frontend (Vitest + ESLint)
```bash
cd frontend
npm install
npm run lint
npm test
```

---

## 📜 Deployment & Operations Scripts

- **Deploy**: `./scripts/deploy.sh` - builds, deploys `docker-compose.prod.yml`, verifies health through Nginx.
- **Fallback/rollback**: `./scripts/rollback.sh` - tears down the prod stack and brings up the dev stack as an emergency fallback. This is **not** a true versioned rollback (see the script's own comments and "Known limitations" below).
- **Database backup**: `./scripts/backup.sh` (defaults to the `devops_postgres_prod` container; override with `POSTGRES_CONTAINER=devops_postgres` for the dev stack).
- **Database restore**: `./scripts/restore.sh <backup_file.sql>`.

---

## 🔒 Security Notes

- Passwords are hashed with PBKDF2-HMAC-SHA256 (200,000 iterations), never stored or logged in plaintext.
- JWT access tokens are short-lived (30 min default); refresh tokens (7 days default) are only ever sent to `POST /api/auth/refresh`.
- `/auth/login` and `/auth/refresh` are rate-limited (10/min and 20/min respectively per client IP), backed by Redis when available so the limit is correctly shared across multiple backend replicas rather than tracked per-replica.
- Role checks (`admin` vs `viewer`) are enforced in backend dependencies, not just hidden in the UI.
- No secrets are committed to this repository; `.env` is git-ignored and `.env.example` contains placeholders only.

---

## ⚠️ Known Limitations

Being honest about what this project does **not** do, rather than overclaiming:

- **No refresh-token rotation/revocation.** A refresh token is valid for its full lifetime with no server-side revocation list; logging out only clears it client-side. A real production system would want a persisted, revocable refresh-token store.
- **No report generation.** PDF/CSV/Excel export is not implemented anywhere in this codebase (a template this project was based on mentions it - it isn't real here).
- **AlertManager's static rule thresholds can drift from the app's live-configurable ones.** Changing a threshold in Settings only affects the app's own alert engine; `prometheus/alert_rules.yml` requires an edit + Prometheus reload to match.
- **`scripts/rollback.sh` is a fallback, not a versioned rollback** - it switches to the dev compose stack rather than redeploying a previous production image tag, since this project has no image-tag/version registry yet.
- **Grafana is exposed directly** in the production compose file rather than behind its own TLS termination - put a reverse proxy or VPN in front of it for a real deployment.
- **No automated dependency/CVE patching** - the Jenkins Trivy stage will fail the build on new HIGH/CRITICAL findings, but nothing auto-bumps pinned versions; that's a manual/Dependabot-style process not set up here.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
