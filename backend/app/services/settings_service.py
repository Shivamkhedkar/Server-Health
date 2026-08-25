from sqlalchemy.orm import Session
from app.models.setting import AppSetting

# Defaults used the first time the app boots (before any row exists).
DEFAULTS = {
    "cpu_threshold": "85",
    "ram_threshold": "90",
    "disk_threshold": "90",
    "email_alerts_enabled": "false",
    "telegram_alerts_enabled": "false",
    "alert_recipient_email": "",
    "telegram_chat_id_override": "",  # optional per-deployment override of env chat id
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
