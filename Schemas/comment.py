from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CommentResponse(BaseModel):
    id: int
    user_id: int
    solution_id: int
    parent_id: Optional[int] = None
    content: str
    created_at: datetime
    updated_at: datetime

class CommentIn(BaseModel):
    content: str
    parent_id: Optional[int] = None

class CommentEdit(BaseModel):
    content: str
    