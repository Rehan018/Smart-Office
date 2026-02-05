from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, Any
from .database import Base

# SQLAlchemy Models
class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, index=True)
    content = Column(Text)  # Stored as JSON string
    version = Column(Integer, default=1)
    is_template = Column(Boolean, default=False)
    last_modified_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    locked_by = Column(String, nullable=True)
    lock_expiry = Column(DateTime, nullable=True)


class DocumentBase(BaseModel):
    title: str
    content: Any 
    is_template: bool = False

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    content: Any
    base_version: int
    title: Optional[str] = None

class DocumentResponse(DocumentBase):
    id: str
    version: int
    created_at: datetime
    updated_at: datetime
    locked_by: Optional[str] = None
    lock_expiry: Optional[datetime] = None

    class Config:
        from_attributes = True
