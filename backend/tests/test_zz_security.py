"""Security-focused tests: refresh tokens, login rate limiting, and the
Redis health endpoint.

Named to sort alphabetically LAST among the test modules (test_auth.py,
test_metrics.py, test_new_features.py, test_users_and_roles.py all sort
before it) because the login-rate-limit test below deliberately exhausts
the shared /auth/login rate limit budget. Since TestClient requests all
share the same synthetic client address, doing that from an earlier-
running module would start returning 429 on other tests' legitimate
`/auth/login` calls (test_auth.py, test_users_and_roles.py) for the rest
of the run. Running last avoids that entirely; explicitly resetting the
limiter at the start of the test (rather than relying purely on file
order) makes it robust even if someone reorders/renames modules later.
"""
import pytest

from app.core.limiter import limiter


def test_refresh_token_returned_on_login(client):
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    data = response.json()
    assert "refresh_token" in data
    assert data["refresh_token"] != data["access_token"]


def test_refresh_token_issues_new_access_token(client):
    login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    refresh_token = login.json()["refresh_token"]

    refreshed = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 200
    new_access_token = refreshed.json()["access_token"]
    assert new_access_token

    # The freshly-issued access token actually works against a protected route.
    me = client.get("/api/metrics/current", headers={"Authorization": f"Bearer {new_access_token}"})
    assert me.status_code == 200


def test_refresh_rejects_garbage_token(client):
    response = client.post("/api/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert response.status_code == 401


def test_refresh_rejects_an_access_token_used_as_a_refresh_token(client):
    # An access token carries "type": "access", not "refresh" - it must not
    # work here even though it's signed with the same SECRET_KEY. This is
    # exactly the mix-up create_refresh_token/refresh_access_token's type
    # check exists to prevent.
    login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    access_token = login.json()["access_token"]
    response = client.post("/api/auth/refresh", json={"refresh_token": access_token})
    assert response.status_code == 401


def test_health_redis_endpoint_has_valid_shape(client):
    # No real assertion on ONLINE vs OFFLINE - whether Redis is reachable
    # depends on the environment this test runs in (no Redis container in
    # plain `pytest` runs, one present under `docker compose`). What
    # matters is that the endpoint always returns a well-formed answer
    # instead of the old hard-coded "ONLINE" regardless of reality.
    response = client.get("/health/redis")
    assert response.status_code in (200, 503)
    assert response.json()["redis"] in ("ONLINE", "OFFLINE")


def test_login_rate_limit_blocks_after_repeated_failures(client):
    limiter.reset()
    last_response = None
    for _ in range(15):
        last_response = client.post(
            "/api/auth/login",
            json={"username": "admin", "password": "definitely-wrong-password"},
        )
        if last_response.status_code == 429:
            break
    assert last_response.status_code == 429
    limiter.reset()  # leave a clean slate regardless of what runs after this
