# Multi-Server & Multi-Tenant Architecture Implementation Plan

## Executive Summary
This document outlines the architecture, database schema, API design, security model, frontend refactoring, and step-by-step implementation phases to evolve the single-host "Server Health Platform" into a full multi-server, multi-tenant monitoring platform.

---

## 1. Core Architecture & Assumptions

### Key Assumptions
1. **Agent-Based Ingestion**: Server metrics will be collected by a lightweight Python agent (`shp_agent.py`) deployed on monitored host servers.
2. **Multi-Tenancy Model**: Every monitored `Server` is registered to a specific `User` (tenant). A user can only view, manage, and receive alerts for servers they own. Admins can view all servers across the system.
3. **API Key Authentication**: Agent ingestion requests interact via `X-API-Key` headers (`shp_...`). API keys are hashed (SHA-256) in the database for security.
4. **Offline Detection**: An automated background worker checks server `last_seen` timestamps every 30 seconds. If `last_seen` exceeds 60 seconds (configurable), an offline alert (`SERVER_OFFLINE`) is generated.

---

## 2. Database Schema & Alembic Migrations

### Data Models

```
+----------------+       +-------------------+       +-----------------------+
|     Users      | 1---* |      Servers      | 1---1 |    ServerSettings     |
+----------------+       +-------------------+       +-----------------------+
| id             |       | id (UUID/Int)     |       | id                    |
| email          |       | user_id (FK)      |       | server_id (FK)        |
| hashed_pass    |       | name              |       | cpu_threshold         |
| is_admin       |       | hostname          |       | ram_threshold         |
| is_active      |       | ip_address        |       | disk_threshold        |
+----------------+       | api_key_hash      |       +-----------------------+
                         | status            |
                         | last_seen         |
                         +-------------------+
                                   | 1
                        +----------+----------+
                        | 1                   | 1
                        v *                   v *
               +-----------------+   +-----------------+
               |     Metrics     |   |     Alerts      |
               +-----------------+   +-----------------+
               | id              |   | id              |
               | server_id (FK)  |   | server_id (FK)  |
               | cpu_usage       |   | type            |
               | ram_usage       |   | severity        |
               | disk_usage      |   | message         |
               +-----------------+   +-----------------+
```

### New/Updated Tables:
1. `servers` table:
   - `id`: Integer (Primary Key)
   - `user_id`: Integer (FK to `users.id`, nullable=False, index=True)
   - `name`: String(100), nullable=False
   - `hostname`: String(100), nullable=True
   - `ip_address`: String(45), nullable=True
   - `os_info`: String(200), nullable=True
   - `api_key_hash`: String(64), unique=True, nullable=False, index=True
   - `status`: String(20), default='offline' ('online', 'offline', 'warning', 'critical')
   - `last_seen`: DateTime(timezone=True), nullable=True
   - `created_at`, `updated_at`: DateTime(timezone=True)

2. `server_settings` table:
   - `id`: Integer (Primary Key)
   - `server_id`: Integer (FK to `servers.id`, unique=True, nullable=False)
   - `cpu_threshold`: Float, default=80.0
   - `ram_threshold`: Float, default=85.0
   - `disk_threshold`: Float, default=90.0
   - `check_interval`: Integer, default=10
   - `created_at`, `updated_at`: DateTime(timezone=True)

3. `notification_prefs` table (or fields in User):
   - `id`: Integer (Primary Key)
   - `user_id`: Integer (FK to `users.id`, unique=True, nullable=False)
   - `email_enabled`: Boolean, default=True
   - `telegram_enabled`: Boolean, default=False
   - `telegram_chat_id`: String(50), nullable=True
   - `telegram_link_code`: String(32), nullable=True
   - `created_at`, `updated_at`: DateTime(timezone=True)

4. Update `metrics` table:
   - Add column `server_id`: Integer (FK to `servers.id`, nullable=True -> migration defaults to primary server or required for new records).

5. Update `alerts` table:
   - Add column `server_id`: Integer (FK to `servers.id`, nullable=True).

---

## 3. API Endpoints Specification

### Server Management (`/api/servers`)
- `POST /api/servers`: Register a new server for the authenticated user. Returns server metadata and raw API key (`shp_...`) ONCE.
- `GET /api/servers`: List all servers owned by the authenticated user (or all servers for admin).
- `GET /api/servers/{server_id}`: Get details for a specific server (enforces ownership check).
- `PATCH /api/servers/{server_id}`: Update server name/metadata.
- `DELETE /api/servers/{server_id}`: Delete a server and cascade clean metrics/alerts.
- `POST /api/servers/{server_id}/regenerate-key`: Regenerate API key for the server.

### Agent Ingest (`/api/agent`)
- `POST /api/agent/metrics`: Headers: `X-API-Key`. Ingests CPU, RAM, Disk, Uptime, process stats. Validates API key hash, updates server `last_seen` and `status`, records metric, evaluates alerts.

### Server-Scoped Metrics & Alerts
- `GET /api/servers/{server_id}/metrics/current`: Current metric for specific server.
- `GET /api/servers/{server_id}/metrics/history`: Historical metrics for specific server with time range filter.
- `GET /api/servers/{server_id}/alerts`: Alerts for specific server.
- `GET /api/servers/{server_id}/settings`: Get alert threshold settings for specific server.
- `PUT /api/servers/{server_id}/settings`: Update alert threshold settings for specific server.

### Notifications & Telegram (`/api/notifications`)
- `GET /api/notifications/prefs`: Get user's notification preferences.
- `PUT /api/notifications/prefs`: Update user's notification preferences.
- `POST /api/notifications/telegram/link-code`: Generate a 6-digit link code for Telegram bot binding.

---

## 4. Phase Breakdown & Execution Strategy

### Phase 0: Security Prerequisites & Production Hardening
- Enforce `payload.get("type") == "access"` and `user.is_active` in token authentication functions.
- Configure Uvicorn `--proxy-headers` and slowapi proxy header parsing.
- Enforce DB fail-hard (no silent SQLite fallback in production).
- Add DB ping to `/health/database` endpoint (`SELECT 1`).
- Upgrade password hashing to PBKDF2 with 600k iterations and auto-upgrade legacy hashes.
- Add `ALLOW_SELF_REGISTRATION` env setting.
- Redact recipient email from non-admin settings response.
- Make `/metrics/current` read-only (`collect_current_metrics(db, persist=False)`).
- Implement unified `evaluate_status()` evaluator.

### Phase 1: Data Model & Agent Ingestion
- Alembic migration for `servers`, `server_settings`, `notification_prefs`, `metrics.server_id`, `alerts.server_id`.
- Implement Server models & CRUD schemas.
- Implement API key hash validation (`shp_` prefixed keys).
- Build `POST /api/agent/metrics` endpoint.
- Create single-file lightweight Python agent `agent/shp_agent.py` with offline buffer & backoff, plus `agent/tests/`.

### Phase 2: Per-Server Alert Engine & Offline Detection
- Refactor alert evaluation to per-server context on agent ingest.
- 30s background offline detector for servers where `last_seen > 60s`.
- Make alerts server-scoped and user-owned.

### Phase 3: Per-User Notifications & Tenant Isolation
- Implement `notification_prefs` and Telegram link flow.
- Add strict `get_owned_server` dependency returning 404 for unowned server resources (preventing ID enumeration).
- Build comprehensive tenant isolation test suite (`tests/test_tenant_isolation.py`).

### Phase 4: Multi-Server Frontend
- Build `/servers` listing page with server cards, online/offline status, quick metrics.
- Build "Add Server" modal displaying generated API key and curl installation command.
- Implement server switcher and server-scoped pages (`/servers/:id/dashboard`, `/servers/:id/metrics`, `/servers/:id/alerts`, `/servers/:id/settings`).
- Admin-only Users management page `/users`.

### Phase 5: Hardening, Docs, CI & Definition of Done
- Update documentation (`README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/AGENT.md`, `CHANGELOG`).
- Update `.github/workflows/ci-cd.yml` for agent tests, backend tests, frontend lint/build/tests.
- Verify end-to-end multi-server workflow.

---

## 5. Potential Risks & Mitigation Strategies
- **Risk: Migration on existing single-server DB with legacy metrics**:
  - *Mitigation*: Migration creates a default "Default Server" for existing user and assigns existing metrics/alerts to it.
- **Risk: High ingest load or agent disconnects**:
  - *Mitigation*: Agent buffers metrics in-memory when network fails and uses exponential backoff to re-send.
