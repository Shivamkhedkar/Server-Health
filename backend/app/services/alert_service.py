from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.alert import Alert


def get_all_alerts(db: Session, severity: str = None):
    query = db.query(Alert)
    if severity and severity.upper() != "ALL":
        query = query.filter(Alert.severity == severity.upper())
    return query.order_by(Alert.timestamp.desc()).all()


def acknowledge_alert(db: Session, alert_id: int):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert record not found")
    alert.acknowledged = True
    db.commit()
    db.refresh(alert)
    return alert


def create_manual_alert(db: Session, alert_type: str, severity: str, message: str):
    new_alert = Alert(alert_type=alert_type, severity=severity.upper(), message=message, acknowledged=False)
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return new_alert
