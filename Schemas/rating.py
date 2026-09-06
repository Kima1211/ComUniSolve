from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Rate(BaseModel):
    solution_id: int
    rated_by: int
    score: int
    feedback: Optional[str] = None
    created_at: datetime

class RateIn(BaseModel):
    score: int
    feedback: Optional[str] = None