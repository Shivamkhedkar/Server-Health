from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.server import (
    ServerCreate,
    ServerUpdate,
    ServerResponse,
    ServerCreateResponse,
    ServerKeyRegenerateResponse,
    ServerSettingsResponse,
    ServerSettingsUpdate,
)
from app.services import server_service

router = APIRouter(prefix="/servers", tags=["Servers"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=ServerCreateResponse, status_code=status.HTTP_201_CREATED)
def create_server(
    payload: ServerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    server, raw_key = server_service.create_server(db, current_user, payload)
    resp = ServerCreateResponse.model_validate(server)
    resp.api_key = raw_key
    return resp


@router.get("", response_model=List[ServerResponse])
def list_servers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return server_service.list_user_servers(db, current_user)


@router.get("/{server_id}", response_model=ServerResponse)
def get_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return server_service.get_server_by_id(db, server_id, current_user)


@router.patch("/{server_id}", response_model=ServerResponse)
def update_server(
    server_id: int,
    payload: ServerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return server_service.update_server(db, server_id, current_user, payload)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    server_service.delete_server(db, server_id, current_user)
    return None


@router.post("/{server_id}/regenerate-key", response_model=ServerKeyRegenerateResponse)
def regenerate_key(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    server, raw_key = server_service.regenerate_server_api_key(db, server_id, current_user)
    return ServerKeyRegenerateResponse(id=server.id, name=server.name, api_key=raw_key)


@router.get("/{server_id}/settings", response_model=ServerSettingsResponse)
def get_server_settings(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return server_service.get_server_settings(db, server_id, current_user)


@router.put("/{server_id}/settings", response_model=ServerSettingsResponse)
def update_server_settings(
    server_id: int,
    payload: ServerSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return server_service.update_server_settings(db, server_id, current_user, payload)
