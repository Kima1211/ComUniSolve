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
    # Cosine similarity of the TF-IDF vectors, 0.0 to 1.0. Always present, and
    # reproducible by hand - this is the number you can defend line by line.
    score: float
    accepted_solution: Optional[str] = None

    # Filled only when the Gemini layer ran. relevance is high/medium/low;
    # reason is a short sentence for the person reading the page.
    relevance: Optional[str] = None
    reason: Optional[str] = None


class MatchResponse(BaseModel):
    matches: List[MatchedProblem] = []
    # Tells the frontend which layers produced this result, so the interface
    # can be honest about it instead of implying AI ran when it did not.
    ai_used: bool = False
