from sqlalchemy import (
    Integer,
    String,
    CheckConstraint,
    ForeignKey,
    Text, 
    func,
    DateTime)
from sqlalchemy.orm import mapped_column, Mapped, relationship
from typing import Optional
from Models.database import Base
from Models.user import User  # noqa: F401
from Models.moderation_log import MODERATION_STATUSES

class Comment(Base):
    __tablename__ = "comments"
    
    id: Mapped[int] = mapped_column(Integer,primary_key=True,index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id",ondelete="CASCADE"),nullable=False,index=True)
    solution_id: Mapped[int] = mapped_column(Integer,ForeignKey("solutions.id",ondelete="CASCADE"),nullable=False,index=True)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("comments.id",ondelete="CASCADE"),nullable=True,index=True)
    content: Mapped[str] = mapped_column(Text,nullable=False)
    moderation_status: Mapped[str] = mapped_column(String(20), default="visible", nullable=False)
    edited_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    author = relationship("User", lazy="joined")

    __table_args__ = (
        CheckConstraint(moderation_status.in_(MODERATION_STATUSES), name="valid_comment_moderation_status"),
    )
