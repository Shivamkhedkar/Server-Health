from app.core.security import create_access_token

def get_auth_headers():
    token = create_access_token(subject="admin")
    return {"Authorization": f"Bearer {token}"}

def test_unauthenticated_access_denied(client):
    response = client.get("/api/metrics/current")
    assert response.status_code == 401

def test_get_current_metrics(client):
    headers = get_auth_headers()
    response = client.get("/api/metrics/current", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "cpu_usage" in data
    assert "ram_usage" in data
    assert "disk_usage" in data

def test_get_metrics_overview(client):
    headers = get_auth_headers()
    response = client.get("/api/metrics/overview", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "health_score" in data
    assert "current" in data

def test_get_alerts_list(client):
    headers = get_auth_headers()
    response = client.get("/api/alerts", headers=headers)
    assert response.status_code == 200
    assert isinstance(response.json(), list)
