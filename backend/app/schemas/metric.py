from pydantic import BaseModel
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
    id: int
    timestamp: datetime
    status: str

    class Config:
        from_attributes = True


class TopProcess(BaseModel):
    pid: int
    name: str
    cpu_percent: float
    memory_percent: float


class LiveSnapshot(BaseModel):
    """Rich, single-sampled-per-second real-time snapshot (not persisted to DB)."""

    timestamp: datetime
    cpu_usage: float
    cpu_per_core: List[float]
    ram_usage: float
    ram_used_gb: float
    ram_total_gb: float
    disk_usage: float
    disk_used_gb: float
    disk_total_gb: float
    disk_read_mbps: float
    disk_write_mbps: float
    network_sent_mbps: float
    network_recv_mbps: float
    network_sent_total_mb: float
    network_recv_total_mb: float
    process_count: int
    load_avg: List[float]
    top_processes: List[TopProcess]
    status: str


class SystemOverview(BaseModel):
    current: MetricResponse
    live: LiveSnapshot
    health_score: float
    status: str
    uptime_seconds: float
