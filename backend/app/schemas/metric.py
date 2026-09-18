from pydantic import BaseModel, ConfigDict, field_serializer
from datetime import datetime
from typing import Optional, List


class MetricCreate(BaseModel):
    cpu_usage: float
    ram_usage: float
    disk_usage: float
    network_sent_mb: Optional[float] = 0.0
    network_recv_mb: Optional[float] = 0.0
    process_count: Optional[int] = 0


class MetricResponse(MetricCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    status: str

    @field_serializer('timestamp')
    def serialize_dt(self, dt: datetime, _info):
        if dt is None:
            return None
        return dt.isoformat() + ("Z" if dt.tzinfo is None else "")


class TopProcess(BaseModel):
    pid: int
    name: str
    cpu_percent: float
    memory_percent: float


class LiveSnapshot(BaseModel):
    """Rich, single-sampled-per-second real-time snapshot (not persisted to DB)."""

    timestamp: datetime

    @field_serializer('timestamp')
    def serialize_dt(self, dt: datetime, _info):
        if dt is None:
            return None
        return dt.isoformat() + ("Z" if dt.tzinfo is None else "")
    cpu_usage: float
    cpu_per_core: Optional[List[float]] = []
    ram_usage: float
    ram_used_gb: Optional[float] = 0.0
    ram_total_gb: Optional[float] = 0.0
    disk_usage: float
    disk_used_gb: Optional[float] = 0.0
    disk_total_gb: Optional[float] = 0.0
    disk_read_mbps: Optional[float] = 0.0
    disk_write_mbps: Optional[float] = 0.0
    network_sent_mbps: Optional[float] = 0.0
    network_recv_mbps: Optional[float] = 0.0
    network_sent_total_mb: Optional[float] = 0.0
    network_recv_total_mb: Optional[float] = 0.0
    process_count: Optional[int] = 0
    load_avg: Optional[List[float]] = []
    top_processes: Optional[List[TopProcess]] = []
    status: str


class SystemOverview(BaseModel):
    current: MetricResponse
    live: LiveSnapshot
    health_score: float
    status: str
    uptime_seconds: float
