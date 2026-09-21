import pytest
from app.models.user import User
from app.models.server import Server
from app.models.alert import Alert
from app.core.security import get_password_hash, create_access_token
from app.services.server_service import create_server
from app.schemas.server import ServerCreate


def test_strict_tenant_isolation_404_no_leakage(client, test_db):
    # Create User A and User B
    user_a = User(username="tenant_a", email="user_a@example.com", password_hash=get_password_hash("Pass1234!"), role="viewer")
    user_b = User(username="tenant_b", email="user_b@example.com", password_hash=get_password_hash("Pass1234!"), role="viewer")
    admin = User(username="admin_tenant", email="admin_t@example.com", password_hash=get_password_hash("Pass1234!"), role="admin")
    test_db.add_all([user_a, user_b, admin])
    test_db.commit()

    # Create Server A owned by User A, Server B owned by User B
    server_a, key_a = create_server(test_db, user_a, ServerCreate(name="Server-A"))
    server_b, key_b = create_server(test_db, user_b, ServerCreate(name="Server-B"))

    # Ingest metric for Server A to generate an alert for Server A
    client.post("/api/agent/metrics", headers={"X-API-Key": key_a}, json={"cpu_usage": 95.0, "ram_usage": 90.0, "disk_usage": 90.0})

    token_b = create_access_token(user_b.username)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B accessing Server A -> 404 Not Found
    res_get = client.get(f"/api/servers/{server_a.id}", headers=headers_b)
    assert res_get.status_code == 404

    res_patch = client.patch(f"/api/servers/{server_a.id}", json={"name": "Hacked"}, headers=headers_b)
    assert res_patch.status_code == 404

    res_del = client.delete(f"/api/servers/{server_a.id}", headers=headers_b)
    assert res_del.status_code == 404

    res_metrics = client.get(f"/api/servers/{server_a.id}/metrics/current", headers=headers_b)
    assert res_metrics.status_code == 404

    res_alerts = client.get(f"/api/servers/{server_a.id}/alerts", headers=headers_b)
    assert res_alerts.status_code == 404

    # User B list servers -> only Server B
    res_list = client.get("/api/servers", headers=headers_b)
    assert res_list.status_code == 200
    servers_b = res_list.json()
    assert len(servers_b) == 1
    assert servers_b[0]["id"] == server_b.id

    # User B list alerts -> zero alerts for Server A
    res_all_alerts = client.get("/api/alerts", headers=headers_b)
    assert res_all_alerts.status_code == 200
    alerts_b = res_all_alerts.json()
    for alt in alerts_b:
        if alt.get("server_id"):
            assert alt["server_id"] != server_a.id

    # Admin access -> can see both servers
    token_admin = create_access_token(admin.username)
    headers_admin = {"Authorization": f"Bearer {token_admin}"}

    res_admin_list = client.get("/api/servers", headers=headers_admin)
    assert res_admin_list.status_code == 200
    all_servers = res_admin_list.json()
    server_ids = [s["id"] for s in all_servers]
    assert server_a.id in server_ids
    assert server_b.id in server_ids
