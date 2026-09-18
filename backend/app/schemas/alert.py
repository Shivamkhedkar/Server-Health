from pydantic import BaseModel, ConfigDict, field_serializer
from datetime import datetime


class AlertBase(BaseModel):
    alert_type: str
    severity: str
    message: str


class AlertCreate(AlertBase):
    pass


class AlertResponse(AlertBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    acknowledged: bool

    @field_serializer('timestamp')
    def serialize_dt(self, dt: datetime, _info):
        if dt is None:
            return None
        return dt.isoformat() + ("Z" if dt.tzinfo is None else "")
