from sqlalchemy import (
    Integer,
    DateTime,  
    ForeignKey,
    CheckConstraint,
    Text,
    func,
    UniqueConstraint)
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional
from database import Base


class Rating(Base):
    __tablename__ = "ratings"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id",ondelete="CASCADE"),nullable=False,index=True)
    solution_id: Mapped[int] = mapped_column(Integer,ForeignKey("solutions.id", ondelete="CASCADE"),nullable=False,index=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime,server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime,server_default=func.now(), onupdate=func.now())
    
    __table_args__ =(
        UniqueConstraint("user_id", "solution_id", name="one_rating_per_user"),
        CheckConstraint("score >=1 AND score  <=5", name="score_range"),)