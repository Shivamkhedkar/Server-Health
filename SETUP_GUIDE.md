# Complete Setup Guide: Server Health Monitoring Platform

This guide provides step-by-step instructions for deploying and running the **Server Health Monitoring System** in both Development and Production environments.

---

## 📋 Prerequisites

- **Python**: 3.10+ (Python 3.14 supported)
- **Node.js**: 18+ (Node 20 recommended) & `npm`
- **Database**: SQLite (Development) or PostgreSQL 14+ (Production)
- **Docker & Docker Compose**: Optional for containerized deployment

---

## ⚡ Quick Start (Local Development)

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .\.venv\Scripts\Activate.ps1
   # Linux/macOS:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables (copy `.env.example` to `.env` in root):
   ```env
   SECRET_KEY=your_super_secret_jwt_key_here
   DATABASE_URL=sqlite:///./devops_monitor.db
   ENVIRONMENT=development
   ```
5. Run database migrations:
   ```bash
   alembic upgrade head
   ```
6. Start the FastAPI backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *The API interactive documentation will be available at `http://localhost:8000/docs`.*

---

### 2. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The dashboard web portal will be accessible at `http://localhost:3000`.*

---

## 🐳 Docker Deployment (Production)

To deploy the entire stack using Docker Compose with PostgreSQL, Redis, Prometheus, and Grafana:

1. Copy `.env.example` to `.env` and configure production secrets:
   ```env
   ENVIRONMENT=production
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=securepassword
   POSTGRES_DB=devops_monitor
   DATABASE_URL=postgresql://postgres:securepassword@db:5432/devops_monitor
   ```
2. Launch production containers:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d --build
   ```
3. Verify running services:
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   ```

---

## 🧪 Running Tests

### Backend Unit & Integration Tests:
```bash
cd backend
pytest
```

### Frontend Code Quality Checks:
```bash
cd frontend
npm run lint
npm run build
```
