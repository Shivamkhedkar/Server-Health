from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import refresh_access_token
from app.schemas.user import LoginRequest, Token, RefreshRequest, AccessToken
from app.services.auth_service import authenticate_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


# Login is rate-limited per client IP to slow down credential-stuffing /
# brute-force attempts against the single most exposed unauthenticated
# endpoint in the app. Account creation now happens exclusively via the
# admin-only /users endpoints (see app/api/users.py) - there is no public
# self-registration route anymore, since the old one let any caller create
# an account and hand themselves the "admin" role.
@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    return authenticate_user(db, login_data)


# Lets the frontend silently obtain a new (short-lived) access token once
# the current one nears/hits expiry, without forcing the user to log in
# again every ACCESS_TOKEN_EXPIRE_MINUTES. Rate-limited for the same reason
# /login is: an unauthenticated caller can hit this endpoint with a guessed
# or stolen refresh token.
@router.post("/refresh", response_model=AccessToken)
@limiter.limit("20/minute")
def refresh(request: Request, payload: RefreshRequest, db: Session = Depends(get_db)):
    access_token = refresh_access_token(db, payload.refresh_token)
    return AccessToken(access_token=access_token)
