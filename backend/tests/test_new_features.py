import socket
import pytest
from datetime import datetime, timedelta

from app.core.security import create_access_token
from app.core.database import Base, get_db
from app.models.alert import Alert
from app.models.metric import Metric
from app.services.metric_service import _check_and_raise_alerts, delete_old_metrics
from app.main import app


def get_auth_headers():
    token = create_access_token(subject="admin")
    return {"Authorization": f"Bearer {token}"}


def test_system_info_requires_auth(client):
    response = client.get("/api/system/info")
    assert response.status_code == 401


def test_system_info_returns_real_hostname(client):
    headers = get_auth_headers()
    response = client.get("/api/system/info", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["hostname"] == socket.gethostname()
    assert "platform" in data


@pytest.mark.unit
def test_alert_auto_resolves_when_metric_drops_below_threshold(test_db):
    db = test_db

    # Simulate a CPU spike above the default 85% threshold - this should
    # create a new open (unacknowledged) alert.
    _check_and_raise_alerts(db, {
        "cpu_usage": 95.0, "ram_usage": 10.0, "disk_usage": 10.0,
    })
    open_alert = (
        db.query(Alert)
        .filter(Alert.alert_type == "CPU Usage Spiked", Alert.acknowledged.is_(False))
        .first()
    )
    assert open_alert is not None

    # Now simulate CPU dropping back under threshold - the previously open
    # alert should be auto-resolved without any manual acknowledge call.
    _check_and_raise_alerts(db, {
        "cpu_usage": 20.0, "ram_usage": 10.0, "disk_usage": 10.0,
    })
    db.refresh(open_alert)
    assert open_alert.acknowledged is True


@pytest.mark.unit
def test_alert_raised_when_ram_exceeds_threshold(test_db):
    db = test_db
    _check_and_raise_alerts(db, {
        "cpu_usage": 10.0, "ram_usage": 96.0, "disk_usage": 10.0,
    })
    open_alert = (
        db.query(Alert)
        .filter(Alert.alert_type == "RAM Memory High", Alert.acknowledged.is_(False))
        .first()
    )
    assert open_alert is not None
    assert open_alert.severity == "CRITICAL"


@pytest.mark.unit
def test_alert_raised_when_disk_exceeds_threshold(test_db):
    db = test_db
    _check_and_raise_alerts(db, {
        "cpu_usage": 10.0, "ram_usage": 10.0, "disk_usage": 97.0,
    })
    open_alert = (
        db.query(Alert)
        .filter(Alert.alert_type == "Disk Space Low", Alert.acknowledged.is_(False))
        .first()
    )
    assert open_alert is not None
    assert open_alert.severity == "WARNING"


@pytest.mark.unit
def test_delete_old_metrics_prunes_rows_beyond_retention(test_db):
    db = test_db

    old_metric = Metric(
        timestamp=datetime.utcnow() - timedelta(days=100),
        cpu_usage=10.0, ram_usage=10.0, disk_usage=10.0,
    )
    recent_metric = Metric(
        timestamp=datetime.utcnow() - timedelta(days=1),
        cpu_usage=10.0, ram_usage=10.0, disk_usage=10.0,
    )
    db.add_all([old_metric, recent_metric])
    db.commit()
    old_id, recent_id = old_metric.id, recent_metric.id

    deleted_count = delete_old_metrics(db, retention_days=90)
    assert deleted_count >= 1

    remaining_ids = {m.id for m in db.query(Metric).all()}
    assert old_id not in remaining_ids
    assert recent_id in remaining_ids
