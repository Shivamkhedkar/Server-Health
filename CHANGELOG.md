# Changelog

All notable changes to the Server Health Platform will be documented in this file.

## [2.0.0] - 2.0 Multi-Server Release

### Added
- **Multi-Server & Multi-Tenant Platform**:
  - Multi-server fleet dashboard (`/servers`) to register and monitor unlimited remote servers.
  - Per-server custom alert threshold settings (CPU, RAM, Disk, Check Interval).
  - Standalone Python agent `shp_agent.py` with offline sample buffering and exponential backoff retry.
  - API Key authentication system (`shp_...` prefixed, SHA-256 hashed).
  - Automatic background offline server detector task (triggers `Server Offline` alerts when server `last_seen > 60s`).
  - Strict tenant isolation: users can only view, manage, and receive alerts for servers they own; unowned resource requests return `404 Not Found`.
  - Per-user notification preferences (Email + Telegram link code deep-binding).

### Security & Hardening
- PBKDF2 password hashing upgraded to 600,000 iterations with format `pbkdf2_sha256$600000$<salt>$<hash>` and automatic re-hash upgrade on login.
- Production DB fail-hard protection preventing silent SQLite fallback.
- `ALLOW_SELF_REGISTRATION` env gate for user registration.
- Non-admin settings privacy redaction.
- Rate limiter proxy headers support (`--proxy-headers` / `X-Forwarded-For`).
