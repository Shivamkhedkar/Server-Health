from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional


class NotificationPrefBase(BaseModel):
    email_enabled: bool = True
    telegram_enabled: bool = False
    telegram_chat_id: Optional[str] = Field(None, max_length=50)


class NotificationPrefUpdate(NotificationPrefBase):
    pass


class NotificationPrefResponse(NotificationPrefBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    telegram_link_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TelegramLinkCodeResponse(BaseModel):
    link_code: str
    instructions: str
