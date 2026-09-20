import logging
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logger = logging.getLogger("devops_monitor.database")

try:
    _tmp_engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    with _tmp_engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    engine = _tmp_engine
    logger.info("Successfully connected to PostgreSQL database.")
except Exception as exc:
    if settings.ENVIRONMENT.lower() in ("production", "prod"):
        logger.critical("CRITICAL: Failed to connect to PostgreSQL in PRODUCTION mode (%s). Halting application.", exc)
        raise RuntimeError(f"CRITICAL: Failed to connect to PostgreSQL in production mode: {exc}")
    logger.warning("PostgreSQL connection unavailable (%s). Falling back to SQLite (devops_monitor.db).", exc)
    engine = create_engine("sqlite:///./devops_monitor.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
