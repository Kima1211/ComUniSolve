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
from Services.reputation import get_tier, effective_frame
from typing import Optional
from datetime import date

DELETED_EMAIL_DOMAIN = "deleted.invalid"
DELETED_NAME = "Deleted user"

# Pixel avatars a user can pick; keep in sync with frontend/src/pixel-avatars.js.
AVATAR_ICONS = ["enrollment", "scholarship", "learning", "facilities", "supplies", "welfare",
                "devices", "internet", "accounts", "apps", "office", "safety"]
AVATAR_COLORS = ["amber", "terracotta", "ube", "teal", "dagat", "dahon", "rosas", "kape"]
AVATAR_FRAMES = ["none", "usbong", "alon", "capiz", "araw"]

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] =  mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] =  mapped_column(String(255), nullable=False)
    first_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    middle_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    suffix: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    birth_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    sex: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
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
    avatar_icon: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    avatar_color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    avatar_frame: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        CheckConstraint(role.in_(['admin', 'client']), name="user_role"),
        CheckConstraint("sex IS NULL OR sex IN ('male', 'female')", name="valid_sex"),
        CheckConstraint(avatar_icon.is_(None) | avatar_icon.in_(AVATAR_ICONS), name="valid_avatar_icon"),
        CheckConstraint(avatar_color.is_(None) | avatar_color.in_(AVATAR_COLORS), name="valid_avatar_color"),
        CheckConstraint(avatar_frame.is_(None) | avatar_frame.in_(AVATAR_FRAMES), name="valid_avatar_frame"),
        # An avatar is a picture on a colour: both set, or both empty (initials).
        CheckConstraint("(avatar_icon IS NULL) = (avatar_color IS NULL)", name="avatar_icon_and_color"),
    )

    @property
    def tier(self) -> str:
        return get_tier(self.points)

    # Deleted accounts keep their row; the reserved .invalid email domain marks them.
    @property
    def shown_frame(self) -> Optional[str]:
        return None if self.is_deleted else effective_frame(self.avatar_frame, self.points)

    @property
    def is_deleted(self) -> bool:
        return self.email.endswith("@" + DELETED_EMAIL_DOMAIN)

Index("ux_users_email_lower", func.lower(User.email), unique=True)

SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV", "V"]

def build_display_name(first_name: str, last_name: str, suffix: Optional[str] = None) -> str:
    return " ".join(part for part in (first_name, last_name, suffix) if part)
