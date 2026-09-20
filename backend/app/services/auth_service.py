from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.config import settings
from app.models.user import User
from app.schemas.user import LoginRequest, Token, UserResponse, UserRegister
from app.core.security import (
    verify_password,
    get_password_hash,
    needs_rehash,
    create_access_token,
    create_refresh_token,
)


def authenticate_user(db: Session, login_data: LoginRequest) -> Token:
    user = db.query(User).filter(User.username == login_data.username).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account has been deactivated. Contact an administrator.",
        )
    if needs_rehash(user.password_hash):
        user.password_hash = get_password_hash(login_data.password)
        db.commit()

    access_token = create_access_token(subject=user.username)
    refresh_token = create_refresh_token(subject=user.username)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


def register_user(db: Session, register_data: UserRegister) -> Token:
    if not settings.ALLOW_SELF_REGISTRATION:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-registration is currently disabled."
        )
    if len(register_data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long."
        )

    existing_username = db.query(User).filter(User.username == register_data.username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username is already taken")

    existing_email = db.query(User).filter(User.email == register_data.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered")

    new_user = User(
        username=register_data.username,
        email=register_data.email,
        password_hash=get_password_hash(register_data.password),
        role="viewer",
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(subject=new_user.username)
    refresh_token = create_refresh_token(subject=new_user.username)
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user),
    )
