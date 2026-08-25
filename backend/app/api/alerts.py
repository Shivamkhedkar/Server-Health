from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.schemas.alert import AlertResponse, AlertCreate
from app.services.alert_service import get_all_alerts, acknowledge_alert, create_manual_alert

router = APIRouter(prefix="/alerts", tags=["Alerts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[AlertResponse])
def list_alerts(severity: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return get_all_alerts(db, severity)


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse, dependencies=[Depends(require_admin)])
def ack_alert(alert_id: int, db: Session = Depends(get_db)):
    return acknowledge_alert(db, alert_id)


@router.post("", response_model=AlertResponse, dependencies=[Depends(require_admin)])
def trigger_alert(alert: AlertCreate, db: Session = Depends(get_db)):
    return create_manual_alert(db, alert.alert_type, alert.severity, alert.message)
