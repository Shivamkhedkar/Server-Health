import asyncio
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.server import Server
from app.models.alert import Alert
from app.services.notification_service import dispatch_alert_notifications

logger = logging.getLogger("devops_monitor.offline_detector")


class OfflineDetectorTask:
    def __init__(self, check_interval_seconds: int = 30, offline_threshold_seconds: int = 60):
        self.check_interval_seconds = check_interval_seconds
        self.offline_threshold_seconds = offline_threshold_seconds
        self._task: asyncio.Task = None
        self._running = False

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info(
            "Offline detector task started (check interval=%ds, threshold=%ds).",
            self.check_interval_seconds,
            self.offline_threshold_seconds,
        )

    async def stop(self):
        if not self._running:
            return
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Offline detector task stopped.")

    async def _loop(self):
        while self._running:
            try:
                self.check_offline_servers()
            except Exception as exc:
                logger.error("Error in offline detector loop: %s", exc)
            await asyncio.sleep(self.check_interval_seconds)

    def check_offline_servers(self, db: Session = None):
        own_session = False
        if db is None:
            db = SessionLocal()
            own_session = True
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(seconds=self.offline_threshold_seconds)
            servers = (
                db.query(Server)
                .filter(Server.status != "offline", (Server.last_seen < cutoff) | (Server.last_seen.is_(None)))
                .all()
            )

            for server in servers:
                server.status = "offline"
                message = f"Server '{server.name}' (ID: {server.id}) has gone offline."
                open_alert = (
                    db.query(Alert)
                    .filter(
                        Alert.server_id == server.id,
                        Alert.alert_type == "Server Offline",
                        Alert.acknowledged.is_(False),
                    )
                    .first()
                )
                if not open_alert:
                    alert = Alert(
                        server_id=server.id,
                        alert_type="Server Offline",
                        severity="CRITICAL",
                        message=message,
                        acknowledged=False,
                    )
                    db.add(alert)
                    db.commit()
                    dispatch_alert_notifications(db, "Server Offline", "CRITICAL", message)
                else:
                    db.commit()
        finally:
            if own_session:
                db.close()


offline_detector = OfflineDetectorTask()
