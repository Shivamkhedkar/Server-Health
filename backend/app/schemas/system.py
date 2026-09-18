from pydantic import BaseModel


class SystemInfoResponse(BaseModel):
    hostname: str
    platform: str
