from pydantic import BaseModel, ConfigDict, Field
from typing import Literal, Optional
from datetime import datetime

Verdict = Literal["ok", "unclear", "inappropriate", "unchecked"]
ModerationAction = Literal["approved", "removed", "restored", "dismissed"]


class ContentCheckResponse(BaseModel):
    verdict: Verdict
    blocked: bool
    acknowledgeable: bool = False
    message: Optional[str] = None
    matched_terms: list[str] = []
    suggestion: Optional[str] = None


class ContentCheckRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    text: str = Field(..., min_length=1, max_length=5000)


class ModerationActionIn(BaseModel):
    action: ModerationAction
    reason: Optional[str] = Field(None, max_length=1000)


class SuspendUserIn(BaseModel):
    suspend: bool
    reason: Optional[str] = Field(None, max_length=1000)


class ModerationLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    admin_id: Optional[int] = None
    target_type: str
    problem_id: Optional[int] = None
    solution_id: Optional[int] = None
    target_user_id: Optional[int] = None
    action: str
    reason: Optional[str] = None
    content_snapshot: Optional[str] = None
    created_at: datetime


class QueueItem(BaseModel):
    target_type: Literal["problem", "solution"]
    id: int
    title: Optional[str] = None
    excerpt: str
    author_id: int
    author_name: str
    ai_status: str
    moderation_status: str
    report_count: int
    report_reasons: list[str] = []
    created_at: datetime

