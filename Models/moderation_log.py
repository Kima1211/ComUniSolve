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

MODERATION_ACTIONS = ["approved", "removed", "removed_no_penalty", "restored", "dismissed", "suspended", "unsuspended"]
# "removed_no_penalty" hides a post like "removed" does, but with no penalty and no step toward suspension
# (off-topic posts, honest mistakes, or reports with the wrong reason).
REMOVAL_ACTIONS = ("removed", "removed_no_penalty")
TARGET_TYPES = ["problem", "solution", "comment", "user"]

AI_STATUSES = ["unchecked", "ok", "unclear", "inappropriate"]
MODERATION_STATUSES = ["visible", "flagged", "removed"]


class ModerationLog(Base):
    __tablename__ = "moderation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    admin_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    problem_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("problems.id", ondelete="SET NULL"), nullable=True, index=True)
    solution_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("solutions.id", ondelete="SET NULL"), nullable=True, index=True)
    comment_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("comments.id", ondelete="SET NULL"), nullable=True, index=True)
    target_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_snapshot: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(action.in_(MODERATION_ACTIONS), name="valid_moderation_action"),
        CheckConstraint(target_type.in_(TARGET_TYPES), name="valid_moderation_target_type"),
    )

