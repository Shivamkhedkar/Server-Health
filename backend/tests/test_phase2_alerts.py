import pytest
from datetime import datetime, timedelta, timezone
from app.models.user import User
from app.models.server import Server, ServerSettings
from app.models.alert import Alert
from app.core.security import get_password_hash
from app.services.server_service import create_server
from app.schemas.server import ServerCreate
from app.services.alert_service import check_and_raise_server_alerts, get_all_alerts
from app.services.offline_service import offline_detector


def test_per_server_alert_trigger_and_autoresolve(test_db):
    user = User(username="alert_owner", email="alertowner@example.com", password_hash=get_password_hash("Pass1234!"), role="viewer")
    test_db.add(user)
    test_db.commit()

    server, raw_key = create_server(test_db, user, ServerCreate(name="Alert-Test-Server"))

    # High CPU trigger
    high_cpu_snap = {"cpu_usage": 92.0, "ram_usage": 40.0, "disk_usage": 50.0}
    check_and_raise_server_alerts(test_db, server, high_cpu_snap)

    alerts = get_all_alerts(test_db, user=user, server_id=server.id)
    assert len(alerts) == 1
    assert alerts[0].alert_type == "CPU Usage Spiked"
    assert alerts[0].acknowledged is False

    # Normal CPU -> auto-resolve
    normal_cpu_snap = {"cpu_usage": 30.0, "ram_usage": 40.0, "disk_usage": 50.0}
    check_and_raise_server_alerts(test_db, server, normal_cpu_snap)

    alerts_after = get_all_alerts(test_db, user=user, server_id=server.id)
    assert len(alerts_after) == 1
    assert alerts_after[0].acknowledged is True


def test_offline_detection_and_reconnect(test_db):
    user = User(username="offline_owner", email="offline@example.com", password_hash=get_password_hash("Pass1234!"), role="viewer")
    test_db.add(user)
    test_db.commit()

    server, raw_key = create_server(test_db, user, ServerCreate(name="Stale-Server"))
    server.status = "online"
    server.last_seen = datetime.now(timezone.utc) - timedelta(seconds=120)
    test_db.commit()

    # Run offline detector check
    offline_detector.check_offline_servers(test_db)

    test_db.refresh(server)
    assert server.status == "offline"

    alerts = get_all_alerts(test_db, user=user, server_id=server.id)
    assert len(alerts) == 1
    assert alerts[0].alert_type == "Server Offline"
    assert alerts[0].acknowledged is False

    # Server sends metrics again -> auto resolves offline alert
    check_and_raise_server_alerts(test_db, server, {"cpu_usage": 20.0, "ram_usage": 30.0, "disk_usage": 40.0})

    alerts_after = get_all_alerts(test_db, user=user, server_id=server.id)
    assert alerts_after[0].acknowledged is True
