from sqlalchemy import Column, Integer, Float, DateTime, String
from datetime import datetime
from app.core.database import Base


class Metric(Base):
    __tablename__ = "metrics"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    cpu_usage = Column(Float, nullable=False)
    ram_usage = Column(Float, nullable=False)
    disk_usage = Column(Float, nullable=False)
    network_sent_mb = Column(Float, default=0.0)
    network_recv_mb = Column(Float, default=0.0)
    process_count = Column(Integer, default=0)
    status = Column(String(20), default="HEALTHY")
