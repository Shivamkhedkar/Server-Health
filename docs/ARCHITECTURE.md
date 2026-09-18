# Architecture

This describes the system as it is actually implemented in this repository.

## Components

| Component | Role |
|---|---|
| **Nginx** | Single public entrypoint. Serves the built React SPA as static files and reverse-proxies `/api/*` (including the `/api/metrics/ws` WebSocket, with upgrade headers) and `/health*` to the backend. |
| **React SPA** (Vite + Tailwind) | Dashboard, Alerts, History, Settings, Team pages. Talks to the backend only via relative `/api/...` paths through Nginx - never a hardcoded host:port. |
| **FastAPI backend** | REST API, JWT auth (access + refresh tokens), role enforcement, the metrics WebSocket, the `/metrics` Prometheus endpoint, and the application-level alert engine. |
| **PostgreSQL** | Persistence: users, metrics history, alerts, app settings. |
| **Redis** | Backs the login rate-limiter's shared storage (`slowapi`) so the limit is correctly shared across multiple backend replicas. Optional - the backend falls back to in-memory rate limiting if Redis is unreachable. Not used as a general cache. |
| **Prometheus** | Scrapes the backend's `/metrics` endpoint on an interval and evaluates `prometheus/alert_rules.yml` against it. |
| **Grafana** | Visualizes the same Prometheus data via a pre-provisioned dashboard (`grafana/provisioning/`). |
| **AlertManager** | Receives firing/resolved alerts from Prometheus. Its receiver is intentionally a no-op by default (see below). |
| **Jenkins** / **GitHub Actions** | CI/CD. Jenkins runs the full pipeline including deploy; GitHub Actions runs lint/test/build-verification on push/PR only. |

## Metrics flow

```
psutil (CPU/RAM/disk/net) -> MetricsCollector (background task, one shared sample)
                                    |
                +-------------------+-------------------+
                |                   |                    |
                v                   v                    v
        REST /api/metrics/*   WebSocket /api/metrics/ws   /metrics (Prometheus format)
                                                                  |
                                                                  v
                                                             Prometheus scrape
                                                                  |
                                                                  v
                                                              Grafana
```

Every consumer reads from the same `MetricsCollector` snapshot. This matters: `psutil.cpu_percent(interval=None)` measures the delta since *its own last call*, so if two different code paths called it independently, each call would reset the other's window and the numbers shown in different places would silently disagree. The `/metrics` Prometheus endpoint used to call `psutil` directly instead of reading the shared snapshot - that bug is what made this docstring necessary; see `app/main.py` and `app/services/metrics_collector.py`.

## Alerting: two independent paths

**Prometheus + AlertManager** (`prometheus/alert_rules.yml` -> AlertManager): static thresholds, evaluated independently of the FastAPI app - it keeps working even if the app itself is down. Its receiver is a no-op (`alertmanager/alertmanager.yml`) by default so it visualizes alerts (in its own UI and in Grafana) without also paging anyone.

**The FastAPI app** (`app/services/metric_service.py::_check_and_raise_alerts` -> `notification_service.py`): operator-configurable thresholds (Settings page, persisted in `app_settings`), a per-alert-type cooldown, auto-resolve when a metric drops back under threshold, and the only path that actually calls the Telegram Bot API / sends email.

These used to both push to Telegram - through a separate `telegram-bot` microservice that received AlertManager's webhook but, on inspection, only logged the payload locally without ever calling the real Telegram API. It was decorative. It has been removed rather than wired up properly, since the application's own notification path already covers the real requirement (configurable thresholds + history + acknowledgement) that a static Prometheus rule can't.

## Network exposure

Dev (`docker-compose.yml`): every service also publishes its port to the host for local convenience (Postgres 5432, Redis 6379, Prometheus 9090, AlertManager 9093, Grafana 3000, backend 8000, frontend 80).

Production (`docker-compose.prod.yml`): only Nginx (80) and Grafana (3000) are published. Postgres, Redis, Prometheus, AlertManager, and the backend are reachable only on the internal `monitor-prod-net` Docker network. The frontend's Nginx config proxies `/api`, `/api/metrics/ws`, and `/health*` to the backend internally - nothing needs the backend's own port exposed.

## Authentication

JWT access tokens (30 min default) + refresh tokens (7 days default, `POST /api/auth/refresh`). Both are signed with the same `SECRET_KEY` but carry a `"type"` claim (`access` vs `refresh`) so one can't be used in place of the other. There is no server-side revocation list for refresh tokens in this version - see the README's "Known limitations".

Passwords are hashed with PBKDF2-HMAC-SHA256 (200,000 iterations) via the stdlib `hashlib`, not a third-party hashing library.

Role enforcement (`admin` / `viewer`) happens in FastAPI dependencies (`app/core/security.py::require_admin`), not just in the frontend - a viewer hitting an admin-only endpoint directly gets a real 403, not just a hidden button.
