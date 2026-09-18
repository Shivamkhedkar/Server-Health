from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import refresh_access_token, revoke_token
from app.schemas.user import LoginRequest, Token, RefreshRequest, AccessToken, UserRegister
from app.services.auth_service import authenticate_user, register_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    return authenticate_user(db, login_data)


@router.post("/register", response_model=Token)
@limiter.limit("20/minute")
def register(request: Request, register_data: UserRegister, db: Session = Depends(get_db)):
    return register_user(db, register_data)


@router.post("/refresh", response_model=AccessToken)
@limiter.limit("20/minute")
def refresh(request: Request, payload: RefreshRequest, db: Session = Depends(get_db)):
    access_token = refresh_access_token(db, payload.refresh_token)
    return AccessToken(access_token=access_token)


@router.post("/logout")
@limiter.limit("20/minute")
def logout(request: Request, payload: RefreshRequest):
    revoke_token(payload.refresh_token)
    return {"message": "Successfully logged out and revoked refresh token"}
