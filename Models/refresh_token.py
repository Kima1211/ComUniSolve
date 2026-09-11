from sqlalchemy import (
    String, 
    Integer,
    DateTime, 
    ForeignKey,
    func,)
from sqlalchemy.orm import Mapped, mapped_column
from Models.database import Base
from datetime import datetime, timedelta, timezone

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    
    
    id: Mapped[int] =  mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"),nullable=False,index=True)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True),server_default=func.now())
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc) + timedelta(days=30))