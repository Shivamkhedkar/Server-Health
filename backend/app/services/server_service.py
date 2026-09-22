from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import List, Optional

from app.models.server import Server, ServerSettings
from app.models.user import User
from app.schemas.server import ServerCreate, ServerUpdate, ServerSettingsUpdate
from app.core.security import generate_api_key, hash_api_key


def create_server(db: Session, user: User, payload: ServerCreate) -> tuple[Server, str]:
    raw_key, key_hash = generate_api_key()
    server = Server(
        user_id=user.id,
        name=payload.name,
        hostname=payload.hostname,
        ip_address=payload.ip_address,
        environment=payload.environment or "Production",
        api_key_hash=key_hash,
        status="offline",
    )
    db.add(server)
    db.commit()
    db.refresh(server)

    server_settings = ServerSettings(server_id=server.id)
    db.add(server_settings)
    db.commit()
    db.refresh(server)
    return server, raw_key


def list_user_servers(db: Session, user: User) -> List[Server]:
    if user.role == "admin":
        return db.query(Server).all()
    return db.query(Server).filter(Server.user_id == user.id).all()


def get_server_by_id(db: Session, server_id: int, user: User) -> Server:
    query = db.query(Server).filter(Server.id == server_id)
    if user.role != "admin":
        query = query.filter(Server.user_id == user.id)
    server = query.first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server with ID {server_id} not found."
        )
    return server


def update_server(db: Session, server_id: int, user: User, payload: ServerUpdate) -> Server:
    server = get_server_by_id(db, server_id, user)
    if payload.name is not None:
        server.name = payload.name
    if payload.hostname is not None:
        server.hostname = payload.hostname
    if payload.ip_address is not None:
        server.ip_address = payload.ip_address
    db.commit()
    db.refresh(server)
    return server


def delete_server(db: Session, server_id: int, user: User) -> None:
    server = get_server_by_id(db, server_id, user)
    db.delete(server)
    db.commit()


def regenerate_server_api_key(db: Session, server_id: int, user: User) -> tuple[Server, str]:
    server = get_server_by_id(db, server_id, user)
    raw_key, key_hash = generate_api_key()
    server.api_key_hash = key_hash
    db.commit()
    db.refresh(server)
    return server, raw_key


def get_server_settings(db: Session, server_id: int, user: User) -> ServerSettings:
    server = get_server_by_id(db, server_id, user)
    if not server.settings:
        settings_obj = ServerSettings(server_id=server.id)
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
        return settings_obj
    return server.settings


def update_server_settings(
    db: Session, server_id: int, user: User, payload: ServerSettingsUpdate
) -> ServerSettings:
    settings_obj = get_server_settings(db, server_id, user)
    settings_obj.cpu_threshold = payload.cpu_threshold
    settings_obj.ram_threshold = payload.ram_threshold
    settings_obj.disk_threshold = payload.disk_threshold
    settings_obj.check_interval = payload.check_interval
    db.commit()
    db.refresh(settings_obj)
    return settings_obj


def get_server_by_api_key(db: Session, raw_api_key: str) -> Optional[Server]:
    if not raw_api_key:
        return None
    key_hash = hash_api_key(raw_api_key)
    return db.query(Server).filter(Server.api_key_hash == key_hash).first()
