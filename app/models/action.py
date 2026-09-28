from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.sql import false as sa_false
from app.core.db import Base
import uuid

class CorrectiveAction(Base):
    __tablename__ = "corrective_actions"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String, index=True)
    description = Column(String)
    status = Column(String, default="open")
    owner = Column(String, nullable=True)
    due_date = Column(DateTime, nullable=True)
    # Collected by the dashboard's assignment form since before the backend
    # had anywhere to put them; both were silently dropped on every POST.
    priority = Column(String, nullable=True)
    verification_required = Column(
        Boolean, nullable=False, server_default=sa_false()
    )
