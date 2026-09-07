from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class Rate(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    solution_id: int
    user_id: int
    score: int
    feedback: Optional[str] = None
    created_at: datetime

class RateIn(BaseModel):
    score: int
    feedback: Optional[str] = None