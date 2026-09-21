from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class AgentMetricsIngest(BaseModel):
    cpu_usage: float = Field(..., ge=0.0, le=100.0)
    ram_usage: float = Field(..., ge=0.0, le=100.0)
    disk_usage: float = Field(..., ge=0.0, le=100.0)
    network_sent_mb: float = Field(0.0, ge=0.0)
    network_recv_mb: float = Field(0.0, ge=0.0)
    process_count: int = Field(0, ge=0)
    hostname: Optional[str] = None
    ip_address: Optional[str] = None
    os_info: Optional[str] = None
    timestamp: Optional[datetime] = None
