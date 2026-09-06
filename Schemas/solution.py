from pydantic import BaseModel
from datetime import datetime

class Solutions(BaseModel):
    problem_id:  int
    solution_text: str
    is_meetup_available: bool

class SolutionResponse(BaseModel):
    id: int
    solution_text: str
    status: str
    is_meetup_available: bool
    upvote_count: int
    created_at: datetime
    updated_at: datetime

class  SolutionAccept(BaseModel):
    status:  str
    problem_status: str