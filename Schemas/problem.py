from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class Problems(BaseModel) :
    title: str
    description: Optional[str] = None
    category: str
    
class ProblemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    title: str
    description: Optional[str] = None
    category: str
    status: str
    created_at: datetime
