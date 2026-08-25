from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.schemas.user import UserResponse, UserCreate, PasswordChangeRequest, PasswordResetRequest
from app.models.user import User
from app.services import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me/password", status_code=204)
def change_my_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Any signed-in user (admin or viewer) can change their own password,
    proving they know the current one first."""
    user_service.change_own_password(db, current_user, payload.current_password, payload.new_password)


# Everything below is admin-only account/team management. There is no
# public self-registration route - new accounts are created here, by an
# already-authenticated admin, who explicitly chooses the new account's
# role. This closes the old /auth/register hole where any unauthenticated
# caller could create an account and set their own role to "admin".


@router.get("", response_model=List[UserResponse], dependencies=[Depends(require_admin)])
def list_team(db: Session = Depends(get_db)):
    return user_service.list_users(db)


@router.post("", response_model=UserResponse, dependencies=[Depends(require_admin)])
def create_team_member(user_data: UserCreate, db: Session = Depends(get_db)):
    return user_service.create_user(db, user_data)


@router.delete("/{user_id}", status_code=204)
def remove_team_member(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user_service.delete_user(db, user_id, current_user)


@router.put("/{user_id}/password", response_model=UserResponse, dependencies=[Depends(require_admin)])
def reset_team_member_password(user_id: int, payload: PasswordResetRequest, db: Session = Depends(get_db)):
    """An admin resetting a teammate's forgotten password - the alternative
    to the clunky "delete and recreate the account" workaround."""
    return user_service.admin_reset_password(db, user_id, payload.new_password)
