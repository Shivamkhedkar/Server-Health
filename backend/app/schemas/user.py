from pydantic import BaseModel, ConfigDict, EmailStr, Field
from datetime import datetime
from typing import Literal

Role = Literal["admin", "viewer"]


class UserBase(BaseModel):
    username: str
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8)
    role: Role = "viewer"


class UserRegister(UserBase):
    password: str = Field(min_length=6)


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    is_active: bool
    created_at: datetime


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
