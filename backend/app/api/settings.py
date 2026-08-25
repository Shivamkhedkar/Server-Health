from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.core.config import settings as env_settings
from app.schemas.settings import SettingsResponse, SettingsUpdate, TestNotificationRequest
from app.services import settings_service
from app.services.notification_service import send_email_alert, send_telegram_alert

router = APIRouter(prefix="/settings", tags=["Settings"], dependencies=[Depends(get_current_user)])


def _to_response(cfg: dict) -> SettingsResponse:
    return SettingsResponse(
        **cfg,
        smtp_configured=bool(env_settings.SMTP_HOST and env_settings.SMTP_USER and env_settings.SMTP_PASSWORD),
        telegram_configured=bool(
            env_settings.TELEGRAM_BOT_TOKEN and (env_settings.TELEGRAM_CHAT_ID or cfg.get("telegram_chat_id_override"))
        ),
    )


@router.get("", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    return _to_response(settings_service.get_all_settings(db))


@router.put("", response_model=SettingsResponse, dependencies=[Depends(require_admin)])
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    updates = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        if isinstance(value, bool):
            updates[field] = "true" if value else "false"
        else:
            updates[field] = str(value)
    cfg = settings_service.update_settings(db, updates)
    return _to_response(cfg)


@router.post("/test-notification", dependencies=[Depends(require_admin)])
def test_notification(payload: TestNotificationRequest, db: Session = Depends(get_db)):
    if payload.channel == "email":
        ok, msg = send_email_alert(
            db,
            "Test Alert",
            "This is a test alert from Server Health Monitor. Notification channel is working correctly.",
        )
    elif payload.channel == "telegram":
        ok, msg = send_telegram_alert(
            db, "This is a test alert from Server Health Monitor. Notification channel is working correctly."
        )
    else:
        raise HTTPException(status_code=400, detail="channel must be 'email' or 'telegram'")

    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True, "detail": msg}
