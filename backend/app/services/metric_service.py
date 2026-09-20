import psutil
import time
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
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


def evaluate_status(cpu: float, ram: float, disk: float, thresholds: dict = None) -> str:
    """Unified status evaluator based on CPU, RAM, and Disk metrics against thresholds."""
    if thresholds is None:
        thresholds = {"cpu": 85.0, "ram": 90.0, "disk": 90.0}
    cpu_t = float(thresholds.get("cpu", 85.0))
    ram_t = float(thresholds.get("ram", 90.0))
    disk_t = float(thresholds.get("disk", 90.0))

    if cpu >= cpu_t or ram >= ram_t or disk >= disk_t:
        return "CRITICAL"
    if cpu >= (cpu_t * 0.8) or ram >= (ram_t * 0.8) or disk >= (disk_t * 0.8):
        return "WARNING"
    return "HEALTHY"


def _fallback_snapshot() -> dict:
    """Used only if the background collector hasn't produced a sample yet
    (e.g. immediately at process startup, or in tests that bypass lifespan)."""
    cpu = psutil.cpu_percent(interval=None)
    vm = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    status_str = evaluate_status(cpu, vm.percent, disk.percent)
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
    cooldown_cutoff = datetime.now(timezone.utc) - timedelta(minutes=cooldown_minutes)

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
    background collector instead of sampling psutil per-request."""
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

        # Automated alert threshold trigger
        _check_and_raise_alerts(db, snap)

        return MetricResponse.model_validate(metric)

    return MetricResponse(
        id=0,
        timestamp=datetime.fromtimestamp(snap["timestamp"], tz=timezone.utc),
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
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    deleted = db.query(Metric).filter(Metric.timestamp < cutoff).delete(synchronize_session=False)
    db.commit()
    return deleted


def get_metrics_history(db: Session, hours: int = 24, limit: int = 2000):
    """Returns real persisted metric samples."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    query = db.query(Metric).filter(Metric.timestamp >= since).order_by(Metric.timestamp.asc())
    total = query.count()
    if total > limit:
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
            timestamp=datetime.fromtimestamp(snap["timestamp"], tz=timezone.utc),
            **{k: v for k, v in snap.items() if k not in ("timestamp", "node_id", "hostname")},
        ),
        health_score=health_score,
        status=snap["status"],
        uptime_seconds=uptime,
    )
