from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.core.database import Base


class AppSetting(Base):
    """Simple key/value store for runtime-configurable settings (thresholds,
    notification toggles, recipients). Kept separate from the .env-driven
    Settings class so operators can tune these live from the UI without a
    redeploy, while secrets (SMTP password, bot token) still live in env."""

    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(String(500), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
