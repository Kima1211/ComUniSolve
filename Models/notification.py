from sqlalchemy import Integer, String, DateTime, ForeignKey, CheckConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from datetime import datetime
from Models.database import Base

NOTIFICATION_TYPES = ["new_solution", "new_comment", "solution_accepted",
                      "tier_contributor", "tier_trusted", "tier_expert"]


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    actor_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    problem_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("problems.id", ondelete="CASCADE"), nullable=True)
    solution_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("solutions.id", ondelete="CASCADE"), nullable=True)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    actor = relationship("User", foreign_keys=[actor_id], lazy="joined")
    problem = relationship("Problem", lazy="joined")

    __table_args__ = (
        CheckConstraint(type.in_(NOTIFICATION_TYPES), name="valid_notification_type"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )
