from sqlalchemy import (
    String, 
    Integer,
    DateTime, 
    ForeignKey,
    CheckConstraint,
    Text,
    func,
    UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from Models.database import Base

class Solution(Base):
    __tablename__ = "solutions"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"),nullable=False,index=True)
    problem_id:Mapped[int] = mapped_column(Integer,ForeignKey("problems.id", ondelete="CASCADE"),nullable=False,index=True)
    solution_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20),default="pending", nullable=False)
    upvote_count: Mapped[int] = mapped_column(Integer, default=0,nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime,server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime,server_default=func.now(), onupdate=func.now())

    __table_args__ = (CheckConstraint(status.in_(["pending", "accepted"]), name="valid_solution_status"),)
    
class Upvote(Base):
    __tablename__= "upvotes"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer,ForeignKey("users.id", ondelete="CASCADE"),nullable=False,index=True)
    solution_id: Mapped[int] = mapped_column(Integer,ForeignKey("solutions.id", ondelete="CASCADE"),nullable=False,index=True)
    
    __table_args__ = (UniqueConstraint("user_id", "solution_id", name="one_upvote_per_user"),)
    