from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from Schemas.author import AuthorOut

class ProblemCreate(BaseModel) :
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    category: str = Field(..., min_length=1, max_length=100)
    # Set by the frontend when the user has already been shown an "unclear"
    # warning and chose to post anyway. It can ONLY clear an "unclear" verdict -
    # a banned keyword or an "inappropriate" verdict ignores it completely.
    acknowledged: bool = False
    
class ProblemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    category: str
    status: str
    created_at: datetime
    user_id: int
    author: Optional[AuthorOut] = None
    solution_count: int = 0
    image_url: Optional[str] = None

class ProblemOverview(BaseModel):

    total_users: int
    total_problems: int
    total_solutions: int
    pending_reports: int = 0
    flagged_content: int = 0

