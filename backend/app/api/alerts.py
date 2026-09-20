from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.schemas.alert import AlertResponse, AlertCreate
from app.services.alert_service import (
    get_all_alerts,
    acknowledge_alert,
    bulk_acknowledge_alerts,
    create_manual_alert,
    get_notification_channels,
    export_alerts_csv,
)

router = APIRouter(prefix="/alerts", tags=["Alerts"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=List[AlertResponse])
def list_alerts(
    severity: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    server_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return get_all_alerts(db, user=current_user, severity=severity, query_str=q, server_id=server_id)


@router.get("/channels")
def list_channels():
    return get_notification_channels()


@router.get("/export")
def export_csv(db: Session = Depends(get_db)):
    csv_content = export_alerts_csv(db)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=incident_alerts_report.csv"},
    )


@router.post("/acknowledge-all", dependencies=[Depends(require_admin)])
def ack_all_alerts(db: Session = Depends(get_db)):
    return bulk_acknowledge_alerts(db)


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse, dependencies=[Depends(require_admin)])
def ack_alert(alert_id: int, db: Session = Depends(get_db)):
    return acknowledge_alert(db, alert_id)


@router.post("", response_model=AlertResponse, dependencies=[Depends(require_admin)])
def trigger_alert(alert: AlertCreate, db: Session = Depends(get_db)):
    return create_manual_alert(db, alert.alert_type, alert.severity, alert.message)
