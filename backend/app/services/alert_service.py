import csv
import io
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.alert import Alert
from app.core.config import settings


def get_all_alerts(db: Session, severity: str = None, query_str: str = None):
    query = db.query(Alert)
    if severity and severity.upper() != "ALL":
        query = query.filter(Alert.severity == severity.upper())
    if query_str:
        pattern = f"%{query_str}%"
        query = query.filter((Alert.message.like(pattern)) | (Alert.alert_type.like(pattern)))
    return query.order_by(Alert.timestamp.desc()).all()


def acknowledge_alert(db: Session, alert_id: int):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert record not found")
    alert.acknowledged = True
    db.commit()
    db.refresh(alert)
    return alert


def bulk_acknowledge_alerts(db: Session):
    unack = db.query(Alert).filter(Alert.acknowledged.is_(False)).all()
    count = len(unack)
    for a in unack:
        a.acknowledged = True
    db.commit()
    return {"acknowledged_count": count, "message": f"Successfully resolved {count} alert(s)"}


def create_manual_alert(db: Session, alert_type: str, severity: str, message: str):
    new_alert = Alert(alert_type=alert_type, severity=severity.upper(), message=message, acknowledged=False)
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return new_alert


def get_notification_channels():
    telegram_active = bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)
    smtp_active = bool(settings.SMTP_USER and settings.SMTP_PASSWORD)
    return [
        {
            "name": "Telegram Bot Dispatch",
            "type": "telegram",
            "status": "Active" if telegram_active else "Standby (Dev Mode)",
            "details": f"Chat ID: {settings.TELEGRAM_CHAT_ID or 'Not Set'}",
            "is_configured": telegram_active,
        },
        {
            "name": "SMTP Email Gateway",
            "type": "email",
            "status": "Active" if smtp_active else "Standby (Dev Mode)",
            "details": f"Host: {settings.SMTP_HOST}:{settings.SMTP_PORT}",
            "is_configured": smtp_active,
        },
        {
            "name": "Prometheus Scrape Target",
            "type": "prometheus",
            "status": "Active",
            "details": "Endpoint: /metrics/overview",
            "is_configured": True,
        },
    ]


def export_alerts_csv(db: Session) -> str:
    alerts = db.query(Alert).order_by(Alert.timestamp.desc()).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp (UTC)", "Severity", "Alert Event", "Incident Message", "Acknowledged"])
    for a in alerts:
        writer.writerow([a.id, a.timestamp.isoformat(), a.severity, a.alert_type, a.message, a.acknowledged])
    return output.getvalue()
