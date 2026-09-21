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
    # Layer 4. Kept separate from is_active: that means "account switched on",
    # this means "an admin acted against this person".
    #
    # suspended_until is what the code reads. A future timestamp lifts on its
    # own; NULL while suspended means permanent. Nothing runs on a timer -
    # suspensions expire when the user next tries to act, the same way refresh
    # tokens and verification tokens already do.
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    suspended_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_until: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspension_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default= func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default= func.now(), onupdate=func.now())
    
    __table_args__ = (CheckConstraint(role.in_(['admin', 'client']), name="user_role"),)

    @property
    def tier(self) -> str:
        """Title derived from points. Computed, never stored, so it cannot
        drift out of sync with the points column it describes."""
        return get_tier(self.points)
    
    