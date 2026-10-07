from typing import Optional

from pydantic import BaseModel, ConfigDict


class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    points: int
    tier: str
    is_deleted: bool = False
    avatar_icon: Optional[str] = None
    avatar_color: Optional[str] = None
    shown_frame: Optional[str] = None

