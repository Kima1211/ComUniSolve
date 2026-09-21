from pydantic import BaseModel, ConfigDict, Field
from typing import Literal, Optional
from datetime import datetime

Verdict = Literal["ok", "unclear", "inappropriate", "unchecked"]
ModerationAction = Literal["approved", "removed", "restored", "dismissed"]


class ContentCheckResponse(BaseModel):
    """The result of the pre-post gate (Layers 1 and 2), as the user sees it.

    This is the shape that satisfies Panel Chair Tan's Required Revision #3:
    inappropriate input is flagged (`verdict`), assisted or corrected
    (`message` and `suggestion`), and appropriate input is allowed to be
    posted (`blocked = false`).
    """

    verdict: Verdict
    blocked: bool
    # Whether the user may clear this by confirming. TRUE only for "unclear",
    # never for a keyword hit or an "inappropriate" verdict — otherwise the
    # escape hatch would be a bypass for everything, which is the one way this
    # design could fail badly.
    acknowledgeable: bool = False
    message: Optional[str] = None
    matched_terms: list[str] = []
    # The corrected rewrite offered back to the user. This is the "assisted or
    # corrected" half of the requirement; a bare rejection does not meet it.
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
    """One row in the admin moderation queue.

    Deliberately flat rather than a nested problem/solution object: the queue is
    a single list mixing both kinds, sorted by urgency, and the admin should not
    have to read two different shapes to work through it.
    """

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
