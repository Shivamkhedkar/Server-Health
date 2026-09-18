from pydantic import BaseModel, ConfigDict, Field
from typing import Optional


class SettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    cpu_threshold: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    ram_threshold: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    disk_threshold: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    email_alerts_enabled: Optional[bool] = None
    telegram_alerts_enabled: Optional[bool] = None
    alert_recipient_email: Optional[str] = None
    telegram_chat_id_override: Optional[str] = None
    alert_cooldown_minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    metrics_retention_days: Optional[int] = Field(default=None, ge=1, le=365)


class TestNotificationRequest(BaseModel):
    channel: str  # "email" | "telegram"
