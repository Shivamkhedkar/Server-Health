import asyncio
import json
import logging
import time
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List, Optional

from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user, get_user_from_token
from app.schemas.metric import MetricResponse, SystemOverview, LiveSnapshot
from app.services.metric_service import (
    collect_current_metrics,
    get_metrics_history,
    get_system_overview,
    _start_time,
    _fallback_snapshot,
)
from app.services.metrics_collector import collector

logger = logging.getLogger("devops_monitor.metrics")
router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("/current", response_model=MetricResponse)
def get_current(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return collect_current_metrics(db)


@router.get("/overview", response_model=SystemOverview)
def get_overview(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_system_overview(db)


@router.get("/history", response_model=List[MetricResponse])
def get_history(
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return get_metrics_history(db, hours=hours)


@router.websocket("/ws")
async def websocket_metrics(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Streams the shared, once-per-second collector snapshot to every
    connected client cleanly without holding database pool connections open."""
    user = get_user_from_token(db, token)
    if not user:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    last_sent_ts = None

    async def watch_for_disconnect():
        try:
            while True:
                msg = await websocket.receive()
                if msg.get("type") == "websocket.disconnect":
                    break
        except (WebSocketDisconnect, RuntimeError, Exception):
            pass

    watcher = asyncio.ensure_future(watch_for_disconnect())
    try:
        while not watcher.done():
            snap = collector.snapshot or _fallback_snapshot()
            if snap:
                ts = snap["timestamp"]
                if ts != last_sent_ts:
                    dt_ts = datetime.fromtimestamp(ts, tz=timezone.utc)
                    current = MetricResponse(
                        id=0,
                        timestamp=dt_ts,
                        cpu_usage=snap["cpu_usage"],
                        ram_usage=snap["ram_usage"],
                        disk_usage=snap["disk_usage"],
                        network_sent_mb=snap.get("network_sent_total_mb", 0.0),
                        network_recv_mb=snap.get("network_recv_total_mb", 0.0),
                        process_count=snap.get("process_count", 0),
                        status=snap.get("status", "HEALTHY"),
                    )
                    penalty = (snap["cpu_usage"] * 0.4) + (snap["ram_usage"] * 0.4) + (snap["disk_usage"] * 0.2)
                    health_score = max(0.0, round(100.0 - (penalty * 0.45), 1))
                    uptime = round(time.time() - _start_time, 1)

                    overview = SystemOverview(
                        current=current,
                        live=LiveSnapshot(
                            timestamp=dt_ts,
                            **{k: v for k, v in snap.items() if k not in ("timestamp", "node_id", "hostname")},
                        ),
                        health_score=health_score,
                        status=snap.get("status", "HEALTHY"),
                        uptime_seconds=uptime,
                    )
                    data = overview.model_dump(mode="json")
                    await websocket.send_text(json.dumps(data))
                    last_sent_ts = ts
            done, _ = await asyncio.wait({watcher}, timeout=0.25)
            if watcher in done:
                break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.exception("Unexpected error in websocket_metrics loop: %s", exc)
    finally:
        watcher.cancel()
        try:
            await watcher
        except (asyncio.CancelledError, WebSocketDisconnect, RuntimeError, Exception):
            pass
