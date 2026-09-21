from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional

from app.core.database import get_db
from app.schemas.agent import AgentMetricsIngest
from app.models.metric import Metric
from app.services.server_service import get_server_by_api_key
from app.services.metric_service import evaluate_status

router = APIRouter(prefix="/agent", tags=["Agent Ingest"])


@router.post("/ingest")
@router.post("/metrics")
def ingest_agent_metrics(
    payload: AgentMetricsIngest,
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
):
    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-API-Key header",
        )

    server = get_server_by_api_key(db, x_api_key)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )

    now = datetime.now(timezone.utc)
    server.last_seen = now

    if payload.hostname:
        server.hostname = payload.hostname
    if payload.ip_address:
        server.ip_address = payload.ip_address
    if payload.os_info:
        server.os_info = payload.os_info

    # Threshold evaluation
    thresholds = {}
    if server.settings:
        thresholds = {
            "cpu": server.settings.cpu_threshold,
            "ram": server.settings.ram_threshold,
            "disk": server.settings.disk_threshold,
        }

    status_str = evaluate_status(
        payload.cpu_usage, payload.ram_usage, payload.disk_usage, thresholds
    )
    server.status = status_str

    metric_ts = payload.timestamp or now
    metric = Metric(
        server_id=server.id,
        timestamp=metric_ts,
        cpu_usage=payload.cpu_usage,
        ram_usage=payload.ram_usage,
        disk_usage=payload.disk_usage,
        network_sent_mb=payload.network_sent_mb,
        network_recv_mb=payload.network_recv_mb,
        process_count=payload.process_count,
        status=status_str,
    )
    db.add(metric)
    db.commit()
    db.refresh(server)
    from app.services.alert_service import check_and_raise_server_alerts
    check_and_raise_server_alerts(db, server, payload.model_dump())

    return {
        "status": "accepted",
        "server_id": server.id,
        "server_name": server.name,
        "server_status": server.status,
    }
