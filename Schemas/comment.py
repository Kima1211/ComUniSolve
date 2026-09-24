from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional
from Schemas.author import AuthorOut

class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    user_id: int
    solution_id: int
    parent_id: Optional[int] = None
    content: str
    created_at: datetime
    updated_at: datetime
    author: Optional[AuthorOut] = None

class CommentIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    parent_id: Optional[int] = None

class CommentEdit(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

