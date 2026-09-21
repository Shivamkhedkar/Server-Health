# Implementation Summary: Multi-User Server Health Monitoring Platform

This document summarizes the core architectural components, security controls, and operational workflows implemented in the **Server Health Monitoring & Alert Platform**.

---

## 1. Multi-User Architecture & Tenant Isolation

The system enforces complete tenant isolation across all endpoints:

```
[ User (Admin / Teammate) ] 
         │
         ├──> [ Servers (Owned by User) ]
         │         ├──> [ Metrics (Collected by Agent) ]
         │         └──> [ Alert Rules & Triggered Alerts ]
         │
         └──> [ User Notification Preferences (Email / Telegram) ]
```

### Database Schema Relationships:
- **`User`**: Core account representation with `role` (`admin` / `viewer`).
- **`Server`**: Server registered by a user. Contains `owner_id`, `api_key`, `hostname`, `environment`, `agent_status`, and `last_seen`.
- **`Metric`**: Real-time telemetry linked via `server_id`.
- **`AlertRule`**: Per-server threshold rules (`cpu`, `memory`, `disk`, `offline`).
- **`Alert`**: Triggered alert records with severity levels (`info`, `warning`, `critical`).
- **`NotificationPref`**: Per-user email & Telegram bot credentials and toggle flags.

---

## 2. Monitoring Agent (`agent/shp_agent.py`)

The standalone cross-platform Python agent runs on target Linux and Windows servers:
- **Enrollment**: Enrolls with backend via `/api/agent/enroll` using a Server API Key generated from the web portal.
- **Telemetry Ingestion**: Sends CPU, RAM, Disk, Network I/O, and System Uptime every 5 seconds to `/api/agent/ingest`.
- **Heartbeat & Resiliency**: Automatically handles connection drops with exponential backoff retries.

---

## 3. Real-Time Alert Engine & Notification Services

- **Threshold Evaluation**: Evaluates CPU, RAM, and Disk metrics against active `AlertRule` entries upon each ingestion batch.
- **Offline Server Detection**: Background task checks for servers whose `last_seen` timestamp exceeds 60 seconds and triggers `critical` offline alerts.
- **Cooldown & Deduplication**: Prevents notification fatigue by tracking alert state and cooldown windows.
- **Multi-Channel Dispatch**:
  - **Email**: Delivered via SMTP (`aiosmtplib`).
  - **Telegram**: Delivered directly to the user's configured Telegram `chat_id` via Telegram Bot API.

---

## 4. Security Hardening

- **JWT Type Verification**: Rejects refresh tokens sent to standard API endpoints.
- **Strict Role-Based Access Control**:
  - Admins can provision users, reset passwords, and view all system servers.
  - Viewers can only view and manage servers they own.
- **Password Hashing**: Passwords are hashed using bcrypt with salt rounds.
- **Reverse-Proxy Rate Limiting**: Extracted client IP from `X-Forwarded-For` header to protect login and registration endpoints against brute-force attacks.

---

## 5. Verification & Test Suite

- **Backend Tests**: 48 unit and integration tests passing (`pytest`).
- **Frontend Build**: ESLint clean (0 errors/warnings) and Vite production bundle built successfully (`npm run build`).
