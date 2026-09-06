from sqlalchemy import (
    Integer,
    ForeignKey,
    Text, 
    func,
    DateTime)
from sqlalchemy.orm import mapped_column,Mapped
from database import Base

class Comment(Base):
    __tablename__ = "comments"
    
    id: Mapped[int] = mapped_column(Integer,primary_key=True,index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id",ondelete="CASCADE"),nullable=False,index=True)
    solution_id: Mapped[int] = mapped_column(Integer,ForeignKey("solutions.id",ondelete="CASCADE"),nullable=False,index=True)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("comments.id",ondelete="CASCADE"),nullable=True,index=True)
    content: Mapped[str] = mapped_column(Text,nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())