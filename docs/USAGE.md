# Usage Guide

## Logging in

Visit the frontend (`http://localhost` in dev). On first boot the backend seeds one `admin` account using `ADMIN_DEFAULT_PASSWORD` from your `.env`. **Change it immediately** via Settings > Change Password - the backend logs a warning on every startup for as long as that account is still using its seed password.

## Dashboard

Live CPU/RAM/disk/network/process metrics, streamed over a WebSocket. If the connection drops (network blip, backend restart), the frontend reconnects automatically with backoff - you don't need to refresh the page. All numbers come from one shared backend snapshot, so what you see here always matches Prometheus/Grafana and the REST endpoints - there's no separate sampling path to drift out of sync.

## Alerts

Alerts appear here when a metric crosses its configured threshold (Settings page) and clears the per-alert-type cooldown. Admins can acknowledge an alert manually; alerts also auto-resolve on their own once the underlying metric drops back below threshold. Viewers can see alerts but not acknowledge them (enforced by the backend, not just hidden in the UI).

Separately, Prometheus/AlertManager evaluate the same metrics against their own static thresholds (`prometheus/alert_rules.yml`) purely for visualization in Grafana/AlertManager's own UI (`:9093`) - they don't send you a second notification for the same incident. See `docs/ARCHITECTURE.md` for why there are two systems.

## History

Historical metric rows, retained for `metrics_retention_days` (default 90, configurable) before a background job prunes older rows.

## Settings (admin only to write, everyone can read)

- **CPU / RAM / Disk thresholds** - percentage at which an alert fires.
- **Alert cooldown** - minimum minutes between repeat alerts of the same type, so a metric hovering right at the threshold doesn't spam notifications.
- **Email alerts** - toggle on/off, set the recipient address. Requires `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` to be set in the backend's environment; the toggle has no effect if those aren't configured.
- **Telegram alerts** - toggle on/off, optional per-deployment chat-ID override. Requires `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` in the backend's environment.
- **Test Notification** button - sends a real email/Telegram message right now using the current config, so you can confirm delivery works before relying on it during an actual incident.

Changing a threshold here takes effect immediately for the application's own alert engine. It does **not** change Prometheus's static rules (`prometheus/alert_rules.yml`) - those need a file edit + Prometheus reload to match, by design (see Known Limitations in the README).

## Team (admin only)

Create/list/remove accounts. New accounts default to the `viewer` role - an admin has to deliberately grant `admin`, it's never silently assigned. There's no public self-registration route; this page is the only way to create an account. The last remaining admin account can't be deleted, so you can't accidentally lock yourself out entirely.

## Grafana

Visit `http://localhost:3000` (dev) and log in with `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD` from your `.env`. The "System Overview" dashboard is pre-provisioned and points at the Prometheus datasource automatically - no manual dashboard import needed.

## Prometheus / AlertManager

`http://localhost:9090` (Prometheus) and `http://localhost:9093` (AlertManager) in dev. Useful for inspecting raw scraped metrics, running PromQL queries directly, or checking which infra-level alert rules are currently firing - independent of whatever the application's own Alerts page shows.
