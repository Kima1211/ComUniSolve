from pydantic import AliasChoices, BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from Schemas.author import AuthorOut
from Schemas.categories import Category

class ProblemCreate(BaseModel) :
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    category: Category
    acknowledged: bool = False

class ProblemEdit(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    category: Category
    acknowledged: bool = False
    
class ProblemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    category: str
    # Reads shown_status when the API computed one (see shown_status() in Services/moderation.py),
    # otherwise the stored status.
    status: str = Field(validation_alias=AliasChoices("shown_status", "status"))
    created_at: datetime
    user_id: int
    author: Optional[AuthorOut] = None
    solution_count: int = 0
    accepted_rating: Optional[int] = None
    image_url: Optional[str] = None
    edited_at: Optional[datetime] = None

class ProblemOverview(BaseModel):
    total_users: int
    total_problems: int
    total_solutions: int
    pending_reports: int = 0
    flagged_content: int = 0

