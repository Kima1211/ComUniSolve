from sqlalchemy import (
    String, 
    Integer,
    DateTime, 
    ForeignKey,
    CheckConstraint,
    Text,
    func,
    UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional
from Models.database import Base
from Models.user import User  # noqa: F401  - see the note in Models/problem.py
from Models.moderation_log import AI_STATUSES, MODERATION_STATUSES

class Solution(Base):
    __tablename__ = "solutions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"),nullable=False,index=True)
    problem_id:Mapped[int] = mapped_column(Integer,ForeignKey("problems.id", ondelete="CASCADE"),nullable=False,index=True)
    solution_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20),default="pending", nullable=False)
    upvote_count: Mapped[int] = mapped_column(Integer, default=0,nullable=False)
    ai_status: Mapped[str] = mapped_column(String(20), default="unchecked", nullable=False)
    moderation_status: Mapped[str] = mapped_column(String(20), default="visible", nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime,server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime,server_default=func.now(), onupdate=func.now())

    # A relationship adds no column and needs no migration - it just tells
    # SQLAlchemy how to follow the user_id foreign key to the User row, so
    # response schemas can include the author.
    author = relationship("User", lazy="joined")

    __table_args__ = (
        CheckConstraint(status.in_(["pending", "accepted"]), name="valid_solution_status"),
        CheckConstraint(ai_status.in_(AI_STATUSES), name="valid_solution_ai_status"),
        CheckConstraint(moderation_status.in_(MODERATION_STATUSES), name="valid_solution_moderation_status"),
    )
    
class Upvote(Base):
    __tablename__= "upvotes"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer,ForeignKey("users.id", ondelete="CASCADE"),nullable=False,index=True)
    solution_id: Mapped[int] = mapped_column(Integer,ForeignKey("solutions.id", ondelete="CASCADE"),nullable=False,index=True)
    
    __table_args__ = (UniqueConstraint("user_id", "solution_id", name="one_upvote_per_user"),)
    