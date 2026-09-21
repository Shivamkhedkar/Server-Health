import pytest
from app.models.user import User
from app.models.server import Server, ServerSettings
from app.core.security import get_password_hash, create_access_token
from app.services.server_service import (
    create_server,
    list_user_servers,
    get_server_by_id,
    update_server,
    delete_server,
    regenerate_server_api_key,
    get_server_settings,
    update_server_settings,
)
from app.schemas.server import ServerCreate, ServerUpdate, ServerSettingsUpdate
from fastapi import HTTPException


def test_server_crud_and_key_generation(test_db):
    user = User(username="srv_owner", email="owner@example.com", password_hash=get_password_hash("Pass1234!"), role="viewer")
    test_db.add(user)
    test_db.commit()

    # Create server
    server, raw_key = create_server(test_db, user, ServerCreate(name="Web-Server-01", hostname="web01.local", ip_address="192.168.1.10"))
    assert server.id is not None
    assert server.name == "Web-Server-01"
    assert raw_key.startswith("shp_")
    assert server.api_key_hash != raw_key

    # Check settings auto-created
    settings_obj = get_server_settings(test_db, server.id, user)
    assert settings_obj.cpu_threshold == 80.0

    # List servers
    servers = list_user_servers(test_db, user)
    assert len(servers) == 1
    assert servers[0].name == "Web-Server-01"

    # Update server
    updated = update_server(test_db, server.id, user, ServerUpdate(name="Web-Server-Primary"))
    assert updated.name == "Web-Server-Primary"

    # Regenerate key
    srv_regen, new_raw_key = regenerate_server_api_key(test_db, server.id, user)
    assert new_raw_key != raw_key
    assert new_raw_key.startswith("shp_")

    # Update server settings
    updated_settings = update_server_settings(test_db, server.id, user, ServerSettingsUpdate(cpu_threshold=75.0, ram_threshold=80.0, disk_threshold=85.0, check_interval=15))
    assert updated_settings.cpu_threshold == 75.0
    assert updated_settings.check_interval == 15

    # Delete server
    delete_server(test_db, server.id, user)
    with pytest.raises(HTTPException) as exc:
        get_server_by_id(test_db, server.id, user)
    assert exc.value.status_code == 404


def test_agent_metrics_ingest_api(client, test_db):
    user = User(username="agent_user", email="agent@example.com", password_hash=get_password_hash("Pass1234!"), role="viewer")
    test_db.add(user)
    test_db.commit()

    server, raw_key = create_server(test_db, user, ServerCreate(name="Db-Server-01"))

    # Ingest without X-API-Key -> 401
    resp_no_key = client.post("/api/agent/metrics", json={"cpu_usage": 45.0, "ram_usage": 50.0, "disk_usage": 60.0})
    assert resp_no_key.status_code == 401

    # Ingest with invalid key -> 401
    resp_bad_key = client.post("/api/agent/metrics", headers={"X-API-Key": "shp_invalid_key_123"}, json={"cpu_usage": 45.0, "ram_usage": 50.0, "disk_usage": 60.0})
    assert resp_bad_key.status_code == 401

    # Ingest with valid key -> 200
    payload = {
        "cpu_usage": 45.0,
        "ram_usage": 55.0,
        "disk_usage": 65.0,
        "network_sent_mb": 12.5,
        "network_recv_mb": 45.2,
        "process_count": 120,
        "hostname": "db01.infra",
        "os_info": "Linux 5.15 Ubuntu",
    }
    resp_ok = client.post("/api/agent/metrics", headers={"X-API-Key": raw_key}, json=payload)
    assert resp_ok.status_code == 200
    data = resp_ok.json()
    assert data["status"] == "accepted"
    assert data["server_id"] == server.id
    assert data["server_status"] == "HEALTHY"

    # Verify server status updated in DB
    test_db.refresh(server)
    assert server.hostname == "db01.infra"
    assert server.status == "HEALTHY"
    assert server.last_seen is not None
