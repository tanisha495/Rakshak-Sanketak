from sqlalchemy import Column, String, Text
from pgvector.sqlalchemy import Vector
from app.core.db import Base
import uuid

class HistoricalPrecedent(Base):
    __tablename__ = "historical_precedents"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String)
    description = Column(Text)
    source = Column(String)
    embedding = Column(Vector(8))