from sqlalchemy import (
    String, 
    Integer,
    DateTime, 
    Boolean,
    CheckConstraint,
    Date,
    Index,
    Text,
    func,)
from sqlalchemy.orm import Mapped, mapped_column
from Models.database import Base
from Services.reputation import get_tier
from typing import Optional
from datetime import date

DELETED_EMAIL_DOMAIN = "deleted.invalid"
DELETED_NAME = "Deleted user"


class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] =  mapped_column(Integer, primary_key=True, index=True)
    # Display name, rebuilt from the atomized fields below (see build_display_name). Middle name stays private.
    name: Mapped[str] =  mapped_column(String(255), nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    middle_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    suffix: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sex: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    # Address as PSGC codes (Philippine Standard Geographic Code); names come from Services/psgc.json.
    region_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    province_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    city_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    barangay_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    street: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="client", nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verification_token_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Holds the hash of the 6-digit email code (the column name dates from the old verification link).
    verification_token_expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_sent_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    password_reset_token_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    password_reset_expires_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    session_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    suspended_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_until: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    suspension_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deactivated_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default= func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default= func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint(role.in_(['admin', 'client']), name="user_role"),
        CheckConstraint("sex IS NULL OR sex IN ('male', 'female')", name="valid_sex"),
    )

    @property
    def tier(self) -> str:
        return get_tier(self.points)

    # A deleted account keeps its row (its posts still point to it), but its email is replaced with
    # deleted-<id>@deleted.invalid. ".invalid" is reserved and can never be a real address, so this
    # placeholder is how the system recognises a deleted account, with no extra column.
    @property
    def is_deleted(self) -> bool:
        return self.email.endswith("@" + DELETED_EMAIL_DOMAIN)



# No duplicate accounts that differ only in letter case (Maria@x.com vs maria@x.com).
Index("ux_users_email_lower", func.lower(User.email), unique=True)

SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "V"]


def build_display_name(first_name: str, last_name: str, suffix: Optional[str] = None) -> str:
    return " ".join(part for part in (first_name, last_name, suffix) if part)
