from sqlalchemy import (
    String,
    Integer,
    DateTime,
    ForeignKey,
    CheckConstraint,
    Text,
    func,)
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from datetime import datetime
from Models.database import Base

MODERATION_ACTIONS = ["approved", "removed", "restored", "dismissed", "suspended", "unsuspended"]
TARGET_TYPES = ["problem", "solution", "user"]

# The moderation vocabulary lives here so problems and solutions cannot drift
# apart from each other, or from migrations/2026_09_21_moderation.sql.
AI_STATUSES = ["unchecked", "ok", "unclear", "inappropriate"]
MODERATION_STATUSES = ["visible", "flagged", "removed"]


class ModerationLog(Base):
    __tablename__ = "moderation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    # SET NULL, not CASCADE: an audit trail that disappears when the admin's
    # account is deleted is not an audit trail.
    admin_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    problem_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("problems.id", ondelete="SET NULL"), nullable=True, index=True)
    solution_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("solutions.id", ondelete="SET NULL"), nullable=True, index=True)
    target_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # What the content actually said at the moment it was acted on. The FKs above
    # go NULL if the row is ever hard-deleted; this is what keeps the log readable
    # afterwards, and it is the answer to "prove what you removed".
    content_snapshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(action.in_(MODERATION_ACTIONS), name="valid_moderation_action"),
        CheckConstraint(target_type.in_(TARGET_TYPES), name="valid_moderation_target_type"),
    )
