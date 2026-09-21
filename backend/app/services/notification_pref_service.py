import secrets
from sqlalchemy.orm import Session
from app.models.notification_pref import NotificationPref
from app.models.user import User
from app.schemas.notification import NotificationPrefUpdate


def get_user_notification_prefs(db: Session, user: User) -> NotificationPref:
    pref = db.query(NotificationPref).filter(NotificationPref.user_id == user.id).first()
    if not pref:
        pref = NotificationPref(user_id=user.id, email_enabled=True, telegram_enabled=False)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


def update_user_notification_prefs(db: Session, user: User, payload: NotificationPrefUpdate) -> NotificationPref:
    pref = get_user_notification_prefs(db, user)
    pref.email_enabled = payload.email_enabled
    pref.telegram_enabled = payload.telegram_enabled
    if payload.telegram_chat_id is not None:
        pref.telegram_chat_id = payload.telegram_chat_id
    db.commit()
    db.refresh(pref)
    return pref


def generate_telegram_link_code(db: Session, user: User) -> str:
    pref = get_user_notification_prefs(db, user)
    code = f"LINK-{secrets.randbelow(1000000):06d}"
    pref.telegram_link_code = code
    db.commit()
    return code
