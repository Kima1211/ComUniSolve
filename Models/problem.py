from sqlalchemy import (
    String, 
    Integer,
    DateTime, 
    ForeignKey,
    CheckConstraint,
    Text,
    func,)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from Models.database import Base
from Models.moderation_log import AI_STATUSES, MODERATION_STATUSES

class Problem(Base):
    __tablename__ = "problems"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable= False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default ="open")
    ai_status: Mapped[str] = mapped_column(String(20), default="unchecked", nullable=False)
    moderation_status: Mapped[str] = mapped_column(String(20), default="visible", nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ai_suggestion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_suggestion_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    author = relationship("User", lazy="joined")

    __table_args__ = (
        CheckConstraint(status.in_(["open", "resolved"]), name="valid_status"),
        CheckConstraint(ai_status.in_(AI_STATUSES), name="valid_problem_ai_status"),
        CheckConstraint(moderation_status.in_(MODERATION_STATUSES), name="valid_problem_moderation_status"),
    )
