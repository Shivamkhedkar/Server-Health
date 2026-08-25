from pydantic import BaseModel
from typing import Optional


class SettingsResponse(BaseModel):
    cpu_threshold: str
    ram_threshold: str
    disk_threshold: str
    email_alerts_enabled: str
    telegram_alerts_enabled: str
    alert_recipient_email: str
    telegram_chat_id_override: str
    alert_cooldown_minutes: str
    metrics_retention_days: str
    smtp_configured: bool
    telegram_configured: bool


class SettingsUpdate(BaseModel):
    cpu_threshold: Optional[float] = None
    ram_threshold: Optional[float] = None
    disk_threshold: Optional[float] = None
    email_alerts_enabled: Optional[bool] = None
    telegram_alerts_enabled: Optional[bool] = None
    alert_recipient_email: Optional[str] = None
    telegram_chat_id_override: Optional[str] = None
    alert_cooldown_minutes: Optional[int] = None
    metrics_retention_days: Optional[int] = None


class TestNotificationRequest(BaseModel):
    channel: str  # "email" | "telegram"
