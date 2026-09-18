# Installation

## Option A: Docker Compose (recommended)

Prerequisites: Docker Engine 24+, Docker Compose v2+.

```bash
git clone <this-repo>
cd server-health-monitor
cp .env.example .env
# edit .env - see the comments in that file for what each variable does
docker compose up --build -d
```

Visit `http://localhost` for the dashboard. See `docs/DEPLOYMENT.md` for production setup and `README.md` for the full list of exposed service URLs.

## Option B: Running services individually (local development)

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

# You still need Postgres and (optionally) Redis reachable - either run
# them via `docker compose up postgres redis -d` from the repo root, or
# point POSTGRES_SERVER/REDIS_HOST at your own instances.
export SECRET_KEY=dev-only-secret
export ADMIN_DEFAULT_PASSWORD=admin123
export POSTGRES_SERVER=localhost
export POSTGRES_PASSWORD=<your-local-postgres-password>

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000` (see `frontend/vite.config.js`) so the frontend and backend can run independently without Nginx in the loop during development.

## Running tests

```bash
# Backend
cd backend
pip install -r requirements.txt
pytest tests/ --cov=app -v

# Frontend
cd frontend
npm install
npm run lint
npm test
```

## Prometheus / Grafana / AlertManager (already provisioned)

These come up automatically with `docker compose up`. Configuration lives in:
- `prometheus/prometheus.yml`, `prometheus/alert_rules.yml`
- `alertmanager/alertmanager.yml`
- `grafana/provisioning/datasources/datasource.yml` (points Grafana at Prometheus)
- `grafana/provisioning/dashboards/dashboards.yml` + `system-overview.json` (auto-loads the System Overview dashboard)

No manual setup is required beyond the `.env` file - Grafana's admin credentials come from `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD`.
