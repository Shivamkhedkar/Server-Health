"""
Background metrics-retention cleanup.

The collector persists a Metric row roughly every 5 seconds (see
metrics_collector.py), which - left unchecked - grows the `metrics` table
forever. This module runs a lightweight periodic task (no extra dependency
like APScheduler needed - a plain asyncio loop mirrors the pattern already
used by MetricsCollector) that deletes rows older than the operator's
configured retention window (Settings page -> Data Retention, default 90
days).

The retention value is re-read from Settings on every cleanup cycle, so a
change made in the UI takes effect on the next run without a restart.
"""

import asyncio
import logging
from typing import Optional

from app.core.database import SessionLocal
from app.services import settings_service
from app.services.metric_service import delete_old_metrics

logger = logging.getLogger("devops_monitor.retention")

# How often to run the cleanup sweep. Retention is measured in days, so an
# hourly cadence is more than frequent enough and keeps the DB load trivial.
CLEANUP_INTERVAL_SECONDS = 60 * 60


class RetentionCleanupTask:
    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._running = False

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("RetentionCleanupTask started (interval=%ss)", CLEANUP_INTERVAL_SECONDS)

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass

    async def _loop(self):
        # Run once shortly after startup too, so long-running dev instances
        # don't wait a full hour for the first sweep.
        await asyncio.sleep(30)
        while self._running:
            try:
                self._run_once()
            except Exception:
                logger.exception("metrics retention cleanup failed")
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)

    def _run_once(self):
        db = SessionLocal()
        try:
            cfg = settings_service.get_all_settings(db)
            retention_days = int(float(cfg.get("metrics_retention_days", 90)))
            if retention_days <= 0:
                return  # 0 or negative disables pruning
            deleted = delete_old_metrics(db, retention_days)
            if deleted:
                logger.info("Retention cleanup: pruned %s metric rows older than %s days", deleted, retention_days)
        finally:
            db.close()


# Single shared instance used across the whole app
retention_task = RetentionCleanupTask()
