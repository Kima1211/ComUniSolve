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
from Models.database import Base

class Problem(Base):
    __tablename__ = "problems"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable= False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default ="open")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (CheckConstraint(status.in_(["open", "resolved"]), name="valid_status"),)