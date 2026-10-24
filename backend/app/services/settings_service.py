from sqlalchemy.orm import Session
from app.models.setting import AppSetting

# Defaults used the first time the app boots (before any row exists).
DEFAULTS = {
    "cpu_threshold": "85",
    "ram_threshold": "90",
    "disk_threshold": "90",
    "email_alerts_enabled": "true",
    "telegram_alerts_enabled": "true",
    "alert_recipient_email": "khedkarshivam11@gmail.com",
    "telegram_chat_id_override": "6636890067",
    "telegram_bot_token": "8987060860:AAGzF88D0-qoqEe4oM8exUMDa5E06alq8lg",
    "resend_api_key": "",
    "alert_cooldown_minutes": "15",
    "metrics_retention_days": "90",  # rows older than this are pruned by the background cleanup task
}


def get_all_settings(db: Session) -> dict:
    rows = db.query(AppSetting).all()
    merged = dict(DEFAULTS)
    for row in rows:
        merged[row.key] = row.value
    return merged


def get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row is not None:
        return row.value
    return DEFAULTS.get(key, default)


def update_settings(db: Session, updates: dict) -> dict:
    for key, value in updates.items():
        if key not in DEFAULTS:
            continue  # ignore unknown keys instead of erroring, keeps the API forgiving
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        str_value = str(value)
        if row:
            row.value = str_value
        else:
            db.add(AppSetting(key=key, value=str_value))
    db.commit()
    return get_all_settings(db)
