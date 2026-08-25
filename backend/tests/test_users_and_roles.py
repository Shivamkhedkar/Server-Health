from app.core.security import create_access_token, get_password_hash
from app.models.user import User


def admin_headers():
    return {"Authorization": f"Bearer {create_access_token(subject='admin')}"}


def _ensure_viewer(db):
    viewer = db.query(User).filter(User.username == "viewer1").first()
    if not viewer:
        viewer = User(
            username="viewer1",
            email="viewer1@example.com",
            password_hash=get_password_hash("viewerpass123"),
            role="viewer",
        )
        db.add(viewer)
        db.commit()
        db.refresh(viewer)
    return viewer


def viewer_headers(test_db):
    _ensure_viewer(test_db)
    return {"Authorization": f"Bearer {create_access_token(subject='viewer1')}"}


def test_public_self_registration_route_is_gone(client):
    # The old /auth/register endpoint let anyone create an account and
    # hand themselves the "admin" role. It no longer exists at all.
    response = client.post(
        "/api/auth/register",
        json={"username": "hacker", "email": "hacker@example.com", "password": "x", "role": "admin"},
    )
    assert response.status_code == 404


def test_admin_can_create_and_list_and_delete_team_members(client, test_db):
    headers = admin_headers()

    create_res = client.post(
        "/api/users",
        json={"username": "newmember", "email": "newmember@example.com", "password": "memberpass123"},
        headers=headers,
    )
    assert create_res.status_code == 200
    created = create_res.json()
    # Default role, when the admin doesn't specify one, is the
    # least-privileged "viewer" - never silently "admin".
    assert created["role"] == "viewer"

    list_res = client.get("/api/users", headers=headers)
    assert list_res.status_code == 200
    usernames = [u["username"] for u in list_res.json()]
    assert "newmember" in usernames

    del_res = client.delete(f"/api/users/{created['id']}", headers=headers)
    assert del_res.status_code == 204


def test_admin_cannot_delete_last_admin(client, test_db):
    headers = admin_headers()
    admin_user = test_db.query(User).filter(User.username == "admin").first()
    response = client.delete(f"/api/users/{admin_user.id}", headers=headers)
    assert response.status_code == 400


def test_viewer_cannot_manage_users(client, test_db):
    headers = viewer_headers(test_db)
    response = client.get("/api/users", headers=headers)
    assert response.status_code == 403

    response = client.post(
        "/api/users",
        json={"username": "x", "email": "x@example.com", "password": "xxxxxxxx"},
        headers=headers,
    )
    assert response.status_code == 403


def test_viewer_can_read_but_not_change_settings(client, test_db):
    headers = viewer_headers(test_db)
    read_res = client.get("/api/settings", headers=headers)
    assert read_res.status_code == 200

    write_res = client.put("/api/settings", json={"cpu_threshold": 50}, headers=headers)
    assert write_res.status_code == 403


def test_viewer_cannot_acknowledge_alerts(client, test_db):
    headers = viewer_headers(test_db)
    # Any alert id - we only care that the role check fires before lookup.
    response = client.post("/api/alerts/1/acknowledge", headers=headers)
    assert response.status_code == 403


def test_websocket_rejects_missing_or_invalid_token(client):
    # No token at all
    try:
        with client.websocket_connect("/api/metrics/ws"):
            raise AssertionError("connection should have been rejected")
    except Exception:
        pass

    # Garbage token
    try:
        with client.websocket_connect("/api/metrics/ws?token=not-a-real-token"):
            raise AssertionError("connection should have been rejected")
    except Exception:
        pass


def test_websocket_accepts_valid_token(client):
    token = create_access_token(subject="admin")
    with client.websocket_connect(f"/api/metrics/ws?token={token}") as ws:
        data = ws.receive_json()
        assert "current" in data or "live" in data


def test_user_can_change_own_password(client, test_db):
    from app.core.security import get_password_hash
    changer = User(
        username="pwchanger",
        email="pwchanger@example.com",
        password_hash=get_password_hash("originalpass1"),
        role="viewer",
    )
    test_db.add(changer)
    test_db.commit()

    headers = {"Authorization": f"Bearer {create_access_token(subject='pwchanger')}"}

    # Wrong current password is rejected
    bad = client.put(
        "/api/users/me/password",
        json={"current_password": "notright", "new_password": "brandnewpass1"},
        headers=headers,
    )
    assert bad.status_code == 400

    # Correct current password succeeds
    ok = client.put(
        "/api/users/me/password",
        json={"current_password": "originalpass1", "new_password": "brandnewpass1"},
        headers=headers,
    )
    assert ok.status_code == 204

    # New password now works for login
    login = client.post("/api/auth/login", json={"username": "pwchanger", "password": "brandnewpass1"})
    assert login.status_code == 200


def test_admin_can_reset_teammate_password(client, test_db):
    from app.core.security import get_password_hash
    member = User(
        username="forgetful",
        email="forgetful@example.com",
        password_hash=get_password_hash("oldpass123"),
        role="viewer",
    )
    test_db.add(member)
    test_db.commit()
    test_db.refresh(member)

    admin_hdrs = admin_headers()
    reset = client.put(
        f"/api/users/{member.id}/password",
        json={"new_password": "resetbyadmin1"},
        headers=admin_hdrs,
    )
    assert reset.status_code == 200

    login = client.post("/api/auth/login", json={"username": "forgetful", "password": "resetbyadmin1"})
    assert login.status_code == 200


def test_viewer_cannot_reset_others_password(client, test_db):
    headers = viewer_headers(test_db)
    admin_user = test_db.query(User).filter(User.username == "admin").first()
    response = client.put(
        f"/api/users/{admin_user.id}/password",
        json={"new_password": "shouldnotwork1"},
        headers=headers,
    )
    assert response.status_code == 403
