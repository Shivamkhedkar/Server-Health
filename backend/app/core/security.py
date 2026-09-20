from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Union
import hashlib
import hmac
import os
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

_in_memory_revoked_tokens = set()


def get_redis_client():
    try:
        import redis as redis_lib

        client = redis_lib.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            socket_connect_timeout=1,
            socket_timeout=1,
        )
        client.ping()
        return client
    except Exception:
        return None


def revoke_token(token: str) -> None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp = payload.get("exp")
        default_ttl = 86400 * settings.REFRESH_TOKEN_EXPIRE_DAYS
        ttl = max(1, int(exp - datetime.now(timezone.utc).timestamp())) if exp else default_ttl
    except Exception:
        ttl = 86400 * settings.REFRESH_TOKEN_EXPIRE_DAYS

    r = get_redis_client()
    if r:
        try:
            r.setex(f"revoked_token:{token}", ttl, "true")
            return
        except Exception:
            pass
    _in_memory_revoked_tokens.add(token)


def is_token_revoked(token: str) -> bool:
    if token in _in_memory_revoked_tokens:
        return True
    r = get_redis_client()
    if r:
        try:
            return bool(r.exists(f"revoked_token:{token}"))
        except Exception:
            pass
    return False


PBKDF2_ITERATIONS = 600000


def get_password_hash(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${key.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        if not hashed_password:
            return False
        if hashed_password.startswith("pbkdf2_sha256$"):
            parts = hashed_password.split("$")
            if len(parts) != 4:
                return False
            _, iters_str, salt_hex, key_hex = parts
            iters = int(iters_str)
            salt = bytes.fromhex(salt_hex)
            key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iters)
            return hmac.compare_digest(key.hex(), key_hex)
        elif "$" in hashed_password:
            # Legacy 100k iterations format (<salt_hex>$<key_hex>)
            salt_hex, key_hex = hashed_password.split("$", 1)
            salt = bytes.fromhex(salt_hex)
            key = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100000)
            return hmac.compare_digest(key.hex(), key_hex)
        return False
    except Exception:
        return False


def needs_rehash(hashed_password: str) -> bool:
    if not hashed_password or not hashed_password.startswith(f"pbkdf2_sha256${PBKDF2_ITERATIONS}$"):
        return True
    return False


def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "type": "access"}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(subject: Union[str, Any]) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def refresh_access_token(db: Session, refresh_token: str) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )
    if is_token_revoked(refresh_token):
        raise credentials_exception
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise credentials_exception
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return create_access_token(subject=user.username)


def get_current_user(db: Session = Depends(get_db), token: Optional[str] = Depends(reusable_oauth2)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token or is_token_revoked(token):
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            raise credentials_exception
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Guards admin-only actions (user management, settings changes, alert
    acknowledgement, manual alert creation, notification tests). The `role`
    column existed on the User model but nothing actually checked it - any
    authenticated user could do anything an admin could. This closes that
    gap: viewers can read data, only admins can change configuration or
    manage accounts."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires an administrator account.",
        )
    return current_user


def get_user_from_token(db: Session, token: Optional[str]) -> Optional[User]:
    """Same validation as get_current_user, but returns None instead of
    raising - used by the metrics websocket, which can't rely on FastAPI's
    HTTP dependency-injection/exception machinery for a ws handshake."""
    if not token or is_token_revoked(token):
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "access":
            return None
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        return None
    return user
