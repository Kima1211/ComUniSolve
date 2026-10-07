from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    type: str
    actor_name: Optional[str] = None
    actor_deleted: bool = False
    problem_id: Optional[int] = None
    problem_title: Optional[str] = None
    solution_id: Optional[int] = None
    read: bool
    created_at: datetime


class NotificationList(BaseModel):
    unread: int
    items: list[NotificationOut]


class UnreadCount(BaseModel):
    unread: int
