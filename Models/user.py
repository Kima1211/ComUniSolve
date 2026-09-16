from sqlalchemy import (
    String, 
    Integer,
    DateTime, 
    Boolean, 
    CheckConstraint,
    func,)
from sqlalchemy.orm import Mapped, mapped_column
from Models.database import Base
from typing import Optional

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] =  mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] =  mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="client", nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_token_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    verification_token_expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default= func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default= func.now(), onupdate=func.now())
    
    __table_args__ = (CheckConstraint(role.in_(['admin', 'client']), name="user_role"),)
    
    