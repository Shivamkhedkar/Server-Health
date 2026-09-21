import pytest
from app.core.config import settings
from app.core.security import get_password_hash, verify_password, needs_rehash, create_access_token, get_current_user
from app.models.user import User
from app.services.auth_service import authenticate_user, register_user
from app.schemas.user import LoginRequest, UserRegister
from fastapi import HTTPException


def test_password_pbkdf2_600k_and_rehash(test_db):
    raw_pass = "SecurePass123!"
    # Old hash format: salt$key with 100k iterations
    import os, hashlib
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", raw_pass.encode("utf-8"), salt, 100000)
    legacy_hash = salt.hex() + "$" + key.hex()

    assert verify_password(raw_pass, legacy_hash) is True
    assert needs_rehash(legacy_hash) is True

    # New hash format
    new_hash = get_password_hash(raw_pass)
    assert new_hash.startswith("pbkdf2_sha256$600000$")
    assert verify_password(raw_pass, new_hash) is True
    assert needs_rehash(new_hash) is False

    # Create user with legacy hash and verify login triggers rehash upgrade
    user = User(username="legacy_user", email="legacy@example.com", password_hash=legacy_hash, role="viewer", is_active=True)
    test_db.add(user)
    test_db.commit()

    token = authenticate_user(test_db, LoginRequest(username="legacy_user", password=raw_pass))
    assert token.access_token is not None
    test_db.refresh(user)
    assert user.password_hash.startswith("pbkdf2_sha256$600000$")


def test_self_registration_flag(test_db, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_SELF_REGISTRATION", False)
    with pytest.raises(HTTPException) as exc_info:
        register_user(test_db, UserRegister(username="new_user_dis", email="dis@example.com", password="Password123!"))
    assert exc_info.value.status_code == 403

    monkeypatch.setattr(settings, "ALLOW_SELF_REGISTRATION", True)
    reg = register_user(test_db, UserRegister(username="new_user_en", email="en@example.com", password="Password123!"))
    assert reg.user.username == "new_user_en"
