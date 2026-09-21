from sqlalchemy import (
    String,
    Integer,
    DateTime,
    ForeignKey,
    CheckConstraint,
    UniqueConstraint,
    Text,
    func,)
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from datetime import datetime
from Models.database import Base

REPORT_REASONS = ["spam", "inappropriate", "harassment", "misleading", "other"]
REPORT_STATUSES = ["pending", "actioned", "dismissed"]


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    problem_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("problems.id", ondelete="CASCADE"), nullable=True, index=True)
    solution_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("solutions.id", ondelete="CASCADE"), nullable=True, index=True)
    reason: Mapped[str] = mapped_column(String(20), nullable=False)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        # Exactly one target. Without this a report could point at both a problem
        # and a solution, or at neither, and the admin queue would have no idea
        # what it is looking at.
        CheckConstraint(
            "(problem_id IS NULL) <> (solution_id IS NULL)",
            name="report_targets_exactly_one",
        ),
        CheckConstraint(reason.in_(REPORT_REASONS), name="valid_report_reason"),
        CheckConstraint(status.in_(REPORT_STATUSES), name="valid_report_status"),
        # Postgres treats NULLs as distinct in a unique constraint, so these two
        # only bite on the column that is actually set: a user gets one report per
        # problem and one per solution, and the NULL side never collides.
        UniqueConstraint("user_id", "problem_id", name="one_report_per_user_per_problem"),
        UniqueConstraint("user_id", "solution_id", name="one_report_per_user_per_solution"),
    )
