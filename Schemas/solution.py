from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional
from Schemas.author import AuthorOut

class SolutionCreate(BaseModel):
    problem_id:  int
    solution_text: str = Field(..., min_length=1, max_length=5000)
    # See ProblemCreate.acknowledged - clears an "unclear" verdict only.
    acknowledged: bool = False

class SolutionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    solution_text: str
    status: str
    upvote_count: int
    created_at: datetime
    updated_at: datetime
    user_id: int
    problem_id: int
    author: Optional[AuthorOut] = None

class  SolutionAccept(BaseModel):
    status:  str
    problem_status: str