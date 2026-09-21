import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.alert import Alert
from app.models.server import Server
from app.models.user import User
from app.core.config import settings
from app.services.notification_service import dispatch_alert_notifications


def get_all_alerts(
    db: Session,
    user: Optional[User] = None,
    severity: Optional[str] = None,
    query_str: Optional[str] = None,
    server_id: Optional[int] = None,
):
    query = db.query(Alert)

    if user and user.role != "admin":
        user_server_ids = [s.id for s in user.servers]
        query = query.filter((Alert.server_id.in_(user_server_ids)) | (Alert.server_id.is_(None)))

    if server_id is not None:
        query = query.filter(Alert.server_id == server_id)

    if severity and severity.upper() != "ALL":
        query = query.filter(Alert.severity == severity.upper())
    if query_str:
        pattern = f"%{query_str}%"
        query = query.filter((Alert.message.like(pattern)) | (Alert.alert_type.like(pattern)))
    return query.order_by(Alert.timestamp.desc()).all()


def check_and_raise_server_alerts(db: Session, server: Server, snap: dict) -> None:
    cpu_t = float(server.settings.cpu_threshold) if server.settings else 80.0
    ram_t = float(server.settings.ram_threshold) if server.settings else 85.0
    disk_t = float(server.settings.disk_threshold) if server.settings else 90.0

    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)

    checks = [
        ("CPU Usage Spiked", "CRITICAL", snap.get("cpu_usage", 0.0), cpu_t, "CPU"),
        ("RAM Memory High", "CRITICAL", snap.get("ram_usage", 0.0), ram_t, "RAM"),
        ("Disk Space Low", "WARNING", snap.get("disk_usage", 0.0), disk_t, "Disk"),
    ]

    for alert_type, severity, value, threshold, label in checks:
        if value <= threshold:
            open_alerts = (
                db.query(Alert)
                .filter(
                    Alert.server_id == server.id,
                    Alert.alert_type == alert_type,
                    Alert.acknowledged.is_(False),
                )
                .all()
            )
            if open_alerts:
                for alert in open_alerts:
                    alert.acknowledged = True
                db.commit()
            continue

        recent = (
            db.query(Alert)
            .filter(
                Alert.server_id == server.id,
                Alert.alert_type == alert_type,
                Alert.timestamp >= cooldown_cutoff,
            )
            .first()
        )
        if recent:
            continue

        message = f"Server '{server.name}': {label} usage reached {value}%, exceeding threshold {threshold}%."
        alert = Alert(server_id=server.id, alert_type=alert_type, severity=severity, message=message)
        db.add(alert)
        db.commit()
        dispatch_alert_notifications(db, alert_type, severity, message)

    # Auto-resolve "Server Offline" alert if present
    offline_alerts = (
        db.query(Alert)
        .filter(
            Alert.server_id == server.id,
            Alert.alert_type == "Server Offline",
            Alert.acknowledged.is_(False),
        )
        .all()
    )
    if offline_alerts:
        for alert in offline_alerts:
            alert.acknowledged = True
        db.commit()


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
