from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Literal, Optional
from datetime import datetime

ReportReason = Literal["spam", "inappropriate", "harassment", "misleading", "other"]
ReportStatus = Literal["pending", "actioned", "dismissed"]


class ReportCreate(BaseModel):
    problem_id: Optional[int] = None
    solution_id: Optional[int] = None
    reason: ReportReason
    details: Optional[str] = Field(None, max_length=1000)

    @model_validator(mode="after")
    def exactly_one_target(self):
        # The database enforces this too. This copy exists so the user gets a
        # clear 422 naming the problem, instead of a 500 from a raw constraint
        # violation — validate in the application for the message, constrain in
        # the database for the guarantee.
        if (self.problem_id is None) == (self.solution_id is None):
            raise ValueError("Provide exactly one of problem_id or solution_id.")
        return self


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    problem_id: Optional[int] = None
    solution_id: Optional[int] = None
    reason: str
    details: Optional[str] = None
    status: str
    created_at: datetime
