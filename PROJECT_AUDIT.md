# Project Audit Report: Multi-User Server Health Monitoring & Alert Platform

**Date:** September 21, 2026  
**Repository:** `Server-Health-platform-main`  
**Auditor:** Senior Full-Stack & DevOps Engineer (Antigravity AI)

---

## 1. Existing Features That Work

- **JWT Authentication & Authorization**:
  - Secure login with bcrypt password hashing (`Passlib` + `bcrypt`).
  - Access tokens (30 min) and Refresh tokens (7 days) with strict type validation (`payload["type"] == "access"`).
  - Account state enforcement (`is_active` validation).
  - Admin vs. Viewer role-based access control (RBAC).
- **Multi-Server Data Architecture & Registration**:
  - `User`, `Server`, `Metric`, `AlertRule`, `Alert`, `NotificationPref` SQLAlchemy ORM models.
  - Per-server telemetry ingest via `/api/agent/ingest` and `/api/agent/enroll`.
  - Backend tenant isolation: users only see and manage servers they own (or all servers if admin).
- **Monitoring Agent (`shp_agent.py`)**:
  - Cross-platform Python monitoring agent using `psutil` supporting Windows & Linux.
  - Device/Server identification with unique hardware UUID / MAC address.
  - Secret token enrollment mechanism.
  - Configurable collection interval (default: 5s) and automatic network failure retry loop.
- **Alert Engine & Threshold Evaluation**:
  - Real-time rule evaluation per server (CPU, RAM, Disk threshold breach).
  - Offline server detection via background loop checking `last_seen > offline_threshold`.
  - Deduplication & recovery alerts (prevents spamming alerts every few seconds).
- **Notification Services**:
  - Per-user notification preferences (`NotificationPref` model).
  - Email notification delivery via SMTP (`aiosmtplib`).
  - Telegram alert delivery via Telegram Bot API (`httpx`).
- **Frontend Web Dashboard**:
  - React 18 + Vite frontend with Tailwind CSS and Lucide icons.
  - Dedicated **Servers Management Page** (`/servers`) supporting server registration, key copying, and per-server details.
  - Live metric visualization with Recharts (`TrendChart.jsx`).
  - Interactive 3D WebGL Server Visualizer (`Server3DCube.jsx` via Three.js).
  - Settings page for database health, system inspector, and user account management.

---

## 2. Features That Are Partially Implemented

- **Google Sign-In / OAuth 2.0**:
  - OAuth schema placeholders present, but full Google OIDC verification flow requires production client credentials.
- **Prometheus & Grafana Ingestion**:
  - `docker-compose.yml` includes Prometheus and Grafana containers, but metrics ingestion currently uses direct FastAPI REST & WebSocket endpoints.
- **Redis Caching**:
  - Redis service defined in Docker Compose; active rate limiting currently uses SlowAPI in-memory store.

---

## 3. Missing Features

- **OAuth Google Client Integration UI**:
  - Dedicated "Sign in with Google" button on `Login.jsx` for direct SSO login.
- **Process-Level Telemetry Monitoring**:
  - Top CPU & RAM process breakdown per server in the agent metrics schema.

---

## 4. Bugs and Security Vulnerabilities Identified & Addressed

1. **JWT Refresh Token Reuse as Access Token**:
   - *Fixed*: Added explicit `payload.get("type") == "access"` validation in `security.py`.
2. **Public Self-Registration Exposure**:
   - *Fixed*: Restricted `/api/auth/register` with `require_admin` dependency so anonymous self-registration cannot bypass admin provisioning.
3. **Database Unreachable Fallback**:
   - *Fixed*: Configured fail-hard PostgreSQL database connection in production mode and implemented live `SELECT 1` ping for `/health/database`.
4. **Reverse-Proxy Rate Limiter Bypass**:
   - *Fixed*: Updated `limiter.py` to extract true client IP from `X-Forwarded-For` header.

---

## 5. Duplicate or Unnecessary Code

- Removed redundant legacy metric collector functions that bypassed server ownership.
- Consolidated notification dispatch into unified `notification_service.py`.

---

## 6. Architecture Limitations

- SQLite is used for development/testing (`devops_monitor.db`); PostgreSQL is mandated for multi-container production deployments (`docker-compose.prod.yml`).
- SQLite locks under high concurrent write loads from multiple agents; PostgreSQL handles concurrent agent ingestion seamlessly.

---

## 7. Recommended Improvements

- Enforce HTTPS/TLS for agent-to-backend telemetry ingest in production deployments.
- Add systemd / Windows Service setup scripts for background agent daemon execution.
- Implement Grafana dashboard auto-provisioning for long-term metric retention visualization.

---

## 8. Files Modified / Audited

- `backend/app/api/auth.py`
- `backend/app/api/servers.py`
- `backend/app/api/agent.py`
- `backend/app/api/notifications.py`
- `backend/app/core/security.py`
- `backend/app/services/alert_service.py`
- `backend/app/services/server_service.py`
- `backend/app/services/notification_service.py`
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Servers.jsx`
- `frontend/src/api/serverApi.js`

---

## 9. New Files Created & Maintained

- `agent/shp_agent.py`: Cross-platform Python monitoring agent.
- `backend/alembic/versions/001_multi_server_schema.py`: Migration script for multi-user server schema.
- `backend/alembic/versions/002_notification_prefs.py`: Migration script for user notification preferences.
- `PROJECT_AUDIT.md`: Complete audit documentation.
- `IMPLEMENTATION_SUMMARY.md`: High-level summary of architecture & features.
- `SETUP_GUIDE.md`: Step-by-step installation and environment deployment guide.
- `AGENT_INSTALLATION.md`: Cross-platform agent installation & configuration guide.
