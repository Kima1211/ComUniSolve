from sqlalchemy import (
    String, 
    Integer,
    DateTime, 
    Boolean,
    CheckConstraint,
    Text,
    func,)
from sqlalchemy.orm import Mapped, mapped_column
from Models.database import Base
from Services.reputation import get_tier
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
    password_reset_token_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    password_reset_expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    session_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    suspended_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_until: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspension_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default= func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default= func.now(), onupdate=func.now())
    
    __table_args__ = (CheckConstraint(role.in_(['admin', 'client']), name="user_role"),)

    @property
    def tier(self) -> str:
        return get_tier(self.points)

