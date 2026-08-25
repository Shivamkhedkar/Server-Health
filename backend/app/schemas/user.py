from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Literal

Role = Literal["admin", "viewer"]


class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8)
    # Defaults to the least-privileged role. Only an authenticated admin can
    # call the endpoint that uses this schema, and they must explicitly opt
    # a new account into "admin" - it's never inferred from the caller's own
    # role or left for the new account itself to choose.
    role: Role = "viewer"


class UserResponse(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class AccessToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PasswordChangeRequest(BaseModel):
    """Self-service password change - requires proving you know the
    current password (unlike the admin reset below)."""

    current_password: str
    new_password: str = Field(min_length=8)


class PasswordResetRequest(BaseModel):
    """Admin-initiated reset of someone else's password. No current
    password required since the admin isn't the account owner - that's
    exactly the scenario this exists for (a teammate forgot their
    password)."""

    new_password: str = Field(min_length=8)
