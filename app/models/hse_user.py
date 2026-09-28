from sqlalchemy import Column, String, DateTime, func
from app.core.db import Base
import uuid

class HSEUser(Base):
    __tablename__ = "hse_users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="viewer")  # viewer, editor, admin
    created_at = Column(DateTime, server_default=func.now())