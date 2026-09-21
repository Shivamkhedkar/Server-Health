from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.notification import (
    NotificationPrefResponse,
    NotificationPrefUpdate,
    TelegramLinkCodeResponse,
)
from app.services import notification_pref_service

router = APIRouter(prefix="/notifications", tags=["Notifications"], dependencies=[Depends(get_current_user)])


@router.get("/prefs", response_model=NotificationPrefResponse)
def get_prefs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return notification_pref_service.get_user_notification_prefs(db, current_user)


@router.put("/prefs", response_model=NotificationPrefResponse)
def update_prefs(
    payload: NotificationPrefUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notification_pref_service.update_user_notification_prefs(db, current_user, payload)


@router.post("/telegram/link-code", response_model=TelegramLinkCodeResponse)
def get_link_code(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    code = notification_pref_service.generate_telegram_link_code(db, current_user)
    return TelegramLinkCodeResponse(
        link_code=code,
        instructions=f"Send '{code}' to the Telegram Bot to link your chat ID for alert notifications.",
    )
