from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password


def list_users(db: Session):
    return db.query(User).order_by(User.created_at.asc()).all()


def create_user(db: Session, user_data: UserCreate) -> User:
    existing = db.query(User).filter((User.username == user_data.username) | (User.email == user_data.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username or email is already registered")
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def delete_user(db: Session, user_id: int, requesting_user: User) -> None:
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.id == requesting_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot remove your own account while signed in as it."
        )

    if target.role == "admin":
        remaining_admins = db.query(User).filter(User.role == "admin", User.id != target.id).count()
        if remaining_admins == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last remaining administrator account.",
            )

    db.delete(target)
    db.commit()


def change_own_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    user.password_hash = get_password_hash(new_password)
    db.add(user)
    db.commit()


def admin_reset_password(db: Session, user_id: int, new_password: str) -> User:
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    target.password_hash = get_password_hash(new_password)
    db.add(target)
    db.commit()
    db.refresh(target)
    return target
