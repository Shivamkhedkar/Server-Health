from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base


class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    hostname = Column(String(100), nullable=True)
    ip_address = Column(String(45), nullable=True)
    environment = Column(String(50), default="Production", nullable=True)
    os_info = Column(String(200), nullable=True)
    api_key_hash = Column(String(64), unique=True, index=True, nullable=False)
    status = Column(String(20), default="offline", index=True)
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    user = relationship("User", back_populates="servers")
    settings = relationship("ServerSettings", back_populates="server", uselist=False, cascade="all, delete-orphan")
    metrics = relationship("Metric", back_populates="server", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="server", cascade="all, delete-orphan")


class ServerSettings(Base):
    __tablename__ = "server_settings"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    cpu_threshold = Column(Float, default=80.0)
    ram_threshold = Column(Float, default=85.0)
    disk_threshold = Column(Float, default=90.0)
    check_interval = Column(Integer, default=10)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    server = relationship("Server", back_populates="settings")
