import asyncio
import json
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, get_user_from_token
from app.schemas.metric import MetricResponse, SystemOverview
from app.services.metric_service import collect_current_metrics, get_metrics_history, get_system_overview

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("/current", response_model=MetricResponse)
def get_current(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return collect_current_metrics(db)


@router.get("/overview", response_model=SystemOverview)
def get_overview(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return get_system_overview(db)


@router.get("/history", response_model=List[MetricResponse])
def get_history(
    hours: int = Query(24, ge=1, le=168), db: Session = Depends(get_db), current_user=Depends(get_current_user)
):
    return get_metrics_history(db, hours)


@router.websocket("/ws")
async def websocket_metrics(websocket: WebSocket, token: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Streams the shared, once-per-second collector snapshot to every
    connected client. No per-connection psutil sampling and no per-tick DB
    writes here - all clients (and REST callers) see the exact same numbers,
    which fixes the "dashboard vs Task Manager vs itself" mismatch.

    Requires the same JWT as every other /api/metrics/* route. Browsers
    can't attach an Authorization header to a native WebSocket handshake,
    so the token travels as a query parameter instead (?token=...) - the
    frontend appends it when opening the socket. A missing/invalid/expired
    token gets the connection closed with policy-violation (1008) rather
    than silently streaming live system metrics to anyone who can reach
    the backend.

    Uses the standard `Depends(get_db)` (rather than opening its own raw
    session) so it goes through the same DB session machinery - and the
    same test overrides - as every other route."""
    user = get_user_from_token(db, token)
    if not user:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    last_sent_ts = None

    # The send loop below never calls websocket.receive(), so on its own it
    # would never notice the client going away (browser tab closed, network
    # drop, client-side close()) - it would just keep looping and sending
    # forever into a dead connection. A concurrent watcher task actively
    # listens for the disconnect (receive() raises WebSocketDisconnect once
    # the close frame arrives) so the handler - and the send loop - actually
    # exit as soon as the client is gone, instead of leaking the connection
    # and its background task for the lifetime of the server process.
    async def watch_for_disconnect():
        while True:
            await websocket.receive()

    watcher = asyncio.ensure_future(watch_for_disconnect())
    try:
        while not watcher.done():
            overview = get_system_overview(db)
            ts = overview.live.timestamp
            if ts != last_sent_ts:
                data = overview.model_dump(mode="json")
                await websocket.send_text(json.dumps(data))
                last_sent_ts = ts
            done, _ = await asyncio.wait({watcher}, timeout=0.25)
            if watcher in done:
                watcher.result()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        watcher.cancel()
        try:
            await watcher
        except (asyncio.CancelledError, WebSocketDisconnect, Exception):
            pass
