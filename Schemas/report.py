from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Literal, Optional
from datetime import datetime

ReportReason = Literal["spam", "inappropriate", "harassment", "misleading", "off_topic", "other"]
ReportStatus = Literal["pending", "actioned", "dismissed"]

class ReportCreate(BaseModel):
    problem_id: Optional[int] = None
    solution_id: Optional[int] = None
    comment_id: Optional[int] = None
    reason: ReportReason
    details: Optional[str] = Field(None, max_length=1000)

    @model_validator(mode="after")
    def exactly_one_target(self):
        targets = [self.problem_id, self.solution_id, self.comment_id]
        if sum(t is not None for t in targets) != 1:
            raise ValueError("Provide exactly one of problem_id, solution_id or comment_id.")
        return self

    @model_validator(mode="after")
    def other_needs_details(self):
        if self.reason == "other" and not (self.details or "").strip():
            raise ValueError("Please describe the problem when choosing 'Something else'.")
        return self

class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    problem_id: Optional[int] = None
    solution_id: Optional[int] = None
    comment_id: Optional[int] = None
    reason: str
    details: Optional[str] = None
    status: str
    created_at: datetime

