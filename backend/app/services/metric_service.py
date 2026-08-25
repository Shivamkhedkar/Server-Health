import psutil
import time
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.models.metric import Metric
from app.models.alert import Alert
from app.schemas.metric import MetricResponse, SystemOverview, LiveSnapshot
from app.services.metrics_collector import collector
from app.services import settings_service
from app.services.notification_service import dispatch_alert_notifications

_start_time = time.time()
# Prime CPU calculation on module load (fallback path only; the collector
# background task does its own priming on startup)
psutil.cpu_percent(interval=None)


def _fallback_snapshot() -> dict:
    """Used only if the background collector hasn't produced a sample yet
    (e.g. immediately at process startup, or in tests that bypass lifespan)."""
    cpu = psutil.cpu_percent(interval=None)
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    status_str = "HEALTHY"
    if cpu > 85.0 or vm.percent > 90.0 or disk.percent > 90.0:
        status_str = "CRITICAL"
    elif cpu > 70.0 or vm.percent > 75.0 or disk.percent > 80.0:
        status_str = "WARNING"
    return {
        "timestamp": time.time(),
        "cpu_usage": cpu,
        "cpu_per_core": psutil.cpu_percent(percpu=True) or [cpu],
        "ram_usage": round(vm.percent, 1),
        "ram_used_gb": round(vm.used / (1024**3), 2),
        "ram_total_gb": round(vm.total / (1024**3), 2),
        "disk_usage": round(disk.percent, 1),
        "disk_used_gb": round(disk.used / (1024**3), 2),
        "disk_total_gb": round(disk.total / (1024**3), 2),
        "disk_read_mbps": 0.0,
        "disk_write_mbps": 0.0,
        "network_sent_mbps": 0.0,
        "network_recv_mbps": 0.0,
        "network_sent_total_mb": round(net.bytes_sent / (1024 * 1024), 1),
        "network_recv_total_mb": round(net.bytes_recv / (1024 * 1024), 1),
        "process_count": len(psutil.pids()),
        "load_avg": [0.0, 0.0, 0.0],
        "top_processes": [],
        "status": status_str,
    }


def _check_and_raise_alerts(db: Session, snap: dict) -> None:
    """Compares the snapshot against the operator-configured thresholds
    (Settings page) and records + dispatches (email/telegram) an alert the
    first time a metric crosses its threshold. A per-alert-type cooldown
    prevents spamming a new alert/notification every couple of seconds
    while a metric stays above the line.

    It also auto-resolves the other direction: if a metric that previously
    triggered an alert has dropped back below its threshold, any still-open
    (unacknowledged) alert of that type is automatically marked resolved,
    instead of sitting open forever until a human clicks Acknowledge. Manual
    acknowledge remains available for alerts that are still genuinely active."""
    cfg = settings_service.get_all_settings(db)
    cpu_thresh = float(cfg.get("cpu_threshold", 85))
    ram_thresh = float(cfg.get("ram_threshold", 90))
    disk_thresh = float(cfg.get("disk_threshold", 90))
    cooldown_minutes = float(cfg.get("alert_cooldown_minutes", 15))
    cooldown_cutoff = datetime.utcnow() - timedelta(minutes=cooldown_minutes)

    checks = [
        ("CPU Usage Spiked", "CRITICAL", snap["cpu_usage"], cpu_thresh, "CPU"),
        ("RAM Memory High", "CRITICAL", snap["ram_usage"], ram_thresh, "RAM"),
        ("Disk Space Low", "WARNING", snap["disk_usage"], disk_thresh, "Disk"),
    ]

    for alert_type, severity, value, threshold, label in checks:
        if value <= threshold:
            # Metric is back under threshold - auto-resolve any open alert
            # of this type so it doesn't sit "active" forever.
            open_alerts = db.query(Alert).filter(Alert.alert_type == alert_type, Alert.acknowledged.is_(False)).all()
            if open_alerts:
                for alert in open_alerts:
                    alert.acknowledged = True
                db.commit()
            continue

        recent = db.query(Alert).filter(Alert.alert_type == alert_type, Alert.timestamp >= cooldown_cutoff).first()
        if recent:
            continue  # still within cooldown window for this alert type

        message = f"{label} usage reached {value}%, exceeding the {threshold}% threshold."
        alert = Alert(alert_type=alert_type, severity=severity, message=message)
        db.add(alert)
        db.commit()
        dispatch_alert_notifications(db, alert_type, severity, message)


def get_live_snapshot() -> dict:
    """Single source of truth for real-time data: read from the shared
    background collector instead of sampling psutil per-request. This is
    what makes every consumer (REST + websocket, any number of clients)
    see identical, consistent numbers."""
    return collector.snapshot or _fallback_snapshot()


def collect_current_metrics(db: Session, persist: bool = True) -> MetricResponse:
    snap = get_live_snapshot()

    if persist:
        metric = Metric(
            cpu_usage=snap["cpu_usage"],
            ram_usage=snap["ram_usage"],
            disk_usage=snap["disk_usage"],
            network_sent_mb=snap["network_sent_total_mb"],
            network_recv_mb=snap["network_recv_total_mb"],
            process_count=snap["process_count"],
            status=snap["status"],
        )
        db.add(metric)
        db.commit()
        db.refresh(metric)

        # Automated alert threshold trigger, using the operator-configured
        # thresholds and cooldown from the Settings page.
        _check_and_raise_alerts(db, snap)

        return MetricResponse.model_validate(metric)

    # Non-persisting fast path (used by /overview and the websocket so we
    # don't hammer the DB with one row per second per client)
    return MetricResponse(
        id=0,
        timestamp=datetime.utcfromtimestamp(snap["timestamp"]),
        cpu_usage=snap["cpu_usage"],
        ram_usage=snap["ram_usage"],
        disk_usage=snap["disk_usage"],
        network_sent_mb=snap["network_sent_total_mb"],
        network_recv_mb=snap["network_recv_total_mb"],
        process_count=snap["process_count"],
        status=snap["status"],
    )


def persist_snapshot(db: Session, snap: dict):
    """Called periodically by the background collector (every few seconds)
    to write history for the charts/alerts, decoupled from request volume."""
    metric = Metric(
        cpu_usage=snap["cpu_usage"],
        ram_usage=snap["ram_usage"],
        disk_usage=snap["disk_usage"],
        network_sent_mb=snap["network_sent_total_mb"],
        network_recv_mb=snap["network_recv_total_mb"],
        process_count=snap["process_count"],
        status=snap["status"],
    )
    db.add(metric)
    db.commit()
    _check_and_raise_alerts(db, snap)


def delete_old_metrics(db: Session, retention_days: int) -> int:
    """Prunes Metric rows older than `retention_days`. Called periodically by
    the background retention task (see app.services.retention_service) so the
    metrics table doesn't grow forever from the ~5s persistence cadence.
    Returns the number of rows deleted."""
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    deleted = db.query(Metric).filter(Metric.timestamp < cutoff).delete(synchronize_session=False)
    db.commit()
    return deleted


def get_metrics_history(db: Session, hours: int = 24, limit: int = 2000):
    """Returns real persisted metric samples only - no fabricated rows are
    ever written to the database. If the collector hasn't been running
    long enough to have data for the requested window, this simply returns
    whatever real samples exist (possibly an empty list); the frontend
    shows an explicit "gathering data" state rather than fake numbers."""
    since = datetime.utcnow() - timedelta(hours=hours)
    query = db.query(Metric).filter(Metric.timestamp >= since).order_by(Metric.timestamp.asc())
    total = query.count()
    if total > limit:
        # Downsample evenly across the window instead of truncating to the
        # most recent `limit` rows, so long ranges (7d) still show the full
        # shape of the trend rather than just the tail end.
        stride = max(1, total // limit)
        metrics = [m for i, m in enumerate(query.all()) if i % stride == 0]
    else:
        metrics = query.all()
    return metrics


def get_system_overview(db: Session) -> SystemOverview:
    snap = get_live_snapshot()
    current = collect_current_metrics(db, persist=False)
    penalty = (snap["cpu_usage"] * 0.4) + (snap["ram_usage"] * 0.4) + (snap["disk_usage"] * 0.2)
    health_score = max(0.0, round(100.0 - (penalty * 0.45), 1))
    uptime = round(time.time() - _start_time, 1)

    return SystemOverview(
        current=current,
        live=LiveSnapshot(
            timestamp=datetime.utcfromtimestamp(snap["timestamp"]),
            **{k: v for k, v in snap.items() if k != "timestamp"},
        ),
        health_score=health_score,
        status=snap["status"],
        uptime_seconds=uptime,
    )
