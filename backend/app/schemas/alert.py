from pydantic import BaseModel
from datetime import datetime


class AlertBase(BaseModel):
    alert_type: str
    severity: str
    message: str


class AlertCreate(AlertBase):
    pass


class AlertResponse(AlertBase):
    id: int
    timestamp: datetime
    acknowledged: bool

    class Config:
        from_attributes = True
