import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, Counter, Gauge
from fastapi.responses import Response
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.limiter import limiter
from app.api import auth, metrics, alerts, users, system, settings as settings_api
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.models.alert import Alert
from app.services.metrics_collector import collector
from app.services.metric_service import persist_snapshot
from app.services.retention_service import retention_task

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("devops_monitor")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Only create/seed DB if not running in test mode
    if settings.ENVIRONMENT.lower() not in ("test", "testing"):
        Base.metadata.create_all(bind=engine)

        def _persist(snap):
            pdb = SessionLocal()
            try:
                persist_snapshot(pdb, snap)
            finally:
                pdb.close()

        collector.set_persist_callback(_persist)
        await collector.start()
        await retention_task.start()

        db = SessionLocal()
        try:
            admin = db.query(User).filter(User.username == "admin").first()
            if not admin:
                admin_user = User(
                    username="admin",
                    email="admin@devopsmonitor.com",
                    password_hash=get_password_hash(settings.ADMIN_DEFAULT_PASSWORD),
                    role="admin",
                )
                db.add(admin_user)
                db.add(
                    Alert(
                        alert_type="CPU Spiked",
                        severity="CRITICAL",
                        message="CPU peaked above 85% load",
                        acknowledged=False,
                    )
                )
                db.add(
                    Alert(
                        alert_type="Storage Partition",
                        severity="WARNING",
                        message="Root partition usage at 78%",
                        acknowledged=True,
                    )
                )
                db.commit()
                admin = admin_user

            if admin and verify_password(settings.ADMIN_DEFAULT_PASSWORD, admin.password_hash):
                logger.warning(
                    "SECURITY WARNING: Default admin account is still using its seed password! "
                    "Please change it immediately via Settings > Change Password."
                )
        finally:
            db.close()
    yield
    if settings.ENVIRONMENT.lower() not in ("test", "testing"):
        await collector.stop()
        await retention_task.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="Enterprise DevOps Server Health Monitoring Platform REST API",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Enable CORS for frontend reactivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus Metrics Collectors
PROM_CPU = Gauge("system_cpu_percent", "Current CPU usage percent")
PROM_RAM = Gauge("system_ram_percent", "Current RAM usage percent")
PROM_DISK = Gauge("system_disk_percent", "Current Disk usage percent")
PROM_REQUESTS = Counter("http_requests_total", "Total HTTP Requests")


@app.middleware("http")
async def prom_middleware(request, call_next):
    PROM_REQUESTS.inc()
    response = await call_next(request)
    return response


# API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(metrics.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(system.router, prefix=settings.API_V1_STR)
app.include_router(settings_api.router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health Check"])
def health_check():
    return {"status": "HEALTHY", "service": settings.PROJECT_NAME, "version": "1.0.0"}


@app.get("/health/database", tags=["Health Check"])
def health_db():
    return {"database": "CONNECTED", "engine": "PostgreSQL/SQLAlchemy"}


@app.get("/health/redis", tags=["Health Check"])
def health_redis():
    """Actually pings Redis rather than unconditionally reporting healthy -
    the previous version of this endpoint returned a hard-coded "ONLINE"
    regardless of whether Redis was reachable at all, which is worse than
    no health check (a monitoring system that always says "healthy" hides
    real outages)."""
    try:
        import redis as redis_lib

        client = redis_lib.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        client.ping()
        return {"redis": "ONLINE", "status": "READY"}
    except Exception as exc:
        return Response(
            content=f'{{"redis": "OFFLINE", "status": "UNREACHABLE", "detail": "{exc}"}}',
            media_type="application/json",
            status_code=503,
        )


@app.get("/metrics", tags=["Prometheus"])
def metrics_prometheus():
    """Reads from the shared MetricsCollector snapshot instead of calling
    psutil directly. psutil.cpu_percent(interval=None) measures the delta
    since its *own last call*, so an independent call here would reset the
    same internal counter the background collector relies on for the
    dashboard/websocket numbers - reintroducing the exact "different
    consumers disagree with each other" bug that MetricsCollector was built
    to eliminate (see services/metrics_collector.py). Every consumer -
    REST, websocket, and now Prometheus - reads the one shared sample."""
    snap = collector.snapshot
    if snap:
        PROM_CPU.set(snap["cpu_usage"])
        PROM_RAM.set(snap["ram_usage"])
        PROM_DISK.set(snap["disk_usage"])
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
