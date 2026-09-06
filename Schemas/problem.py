from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Problems(BaseModel) :
    title: str
    description: Optional[str] = None
    category: str
    
class ProblemResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: str
    status: str
    created_at: datetime
