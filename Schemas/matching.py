from pydantic import BaseModel, Field
from typing import Optional, List


class MatchRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)


class MatchedProblem(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: str
    status: str
    score: float
    accepted_solution: Optional[str] = None

    relevance: Optional[str] = None
    reason: Optional[str] = None


class MatchResponse(BaseModel):
    matches: List[MatchedProblem] = []
    ai_used: bool = False

