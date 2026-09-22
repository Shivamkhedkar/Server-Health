from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional


class ServerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    hostname: Optional[str] = Field(None, max_length=100)
    ip_address: Optional[str] = Field(None, max_length=45)
    environment: Optional[str] = Field("Production", max_length=50)


class ServerCreate(ServerBase):
    pass


class ServerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    hostname: Optional[str] = Field(None, max_length=100)
    ip_address: Optional[str] = Field(None, max_length=45)
    environment: Optional[str] = Field(None, max_length=50)


class ServerResponse(ServerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    os_info: Optional[str] = None
    status: str
    last_seen: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ServerCreateResponse(ServerResponse):
    api_key: str  # Raw API key returned ONLY upon creation/regeneration


class ServerKeyRegenerateResponse(BaseModel):
    id: int
    name: str
    api_key: str


class ServerSettingsBase(BaseModel):
    cpu_threshold: float = Field(80.0, ge=1.0, le=100.0)
    ram_threshold: float = Field(85.0, ge=1.0, le=100.0)
    disk_threshold: float = Field(90.0, ge=1.0, le=100.0)
    check_interval: int = Field(10, ge=1, le=3600)


class ServerSettingsUpdate(ServerSettingsBase):
    pass


class ServerSettingsResponse(ServerSettingsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    server_id: int
    created_at: datetime
    updated_at: datetime
