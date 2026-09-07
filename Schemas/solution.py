from pydantic import BaseModel, ConfigDict
from datetime import datetime

class SolutionCreate(BaseModel):
    problem_id:  int
    solution_text: str

class SolutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    solution_text: str
    status: str
    upvote_count: int
    created_at: datetime
    updated_at: datetime

class  SolutionAccept(BaseModel):
    status:  str
    problem_status: str