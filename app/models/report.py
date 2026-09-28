from sqlalchemy import Column, String, Text, DateTime, Float, func
from sqlalchemy.dialects.postgresql import JSON
from pgvector.sqlalchemy import Vector
from app.core.db import Base
import uuid

class Report(Base):
    __tablename__ = "reports"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    anon_token = Column(String, unique=True, index=True)
    raw_text = Column(Text)
    language = Column(String)
    status = Column(String, default="pending")
    submitted_at = Column(DateTime, server_default=func.now())

    # "live"  — a real submission from a worker, via the app or the API.
    # "seed"  — a row from the historical analysis corpus, loaded for volume.
    #
    # HSE-facing listings show live rows only: an officer triaging today's
    # reports must not have a 2014 OSHA accident in the same queue. The
    # intelligence paths (precedents, barrier drift, emerging risk) read
    # every row regardless, because they need the history to detect anything.
    source = Column(String, nullable=False, server_default="live", index=True)

    # Placeholder/demo analysis fields (used by risk-radar, patterns for demo purposes)
    risk_score = Column(Float, nullable=True)
    barrier_category = Column(String, nullable=True)
    equipment_tag = Column(String, nullable=True)
    site_tag = Column(String, nullable=True)

    # Real AI/ML teammate's model output contract (Member 2)
    sif_probability = Column(Float, nullable=True)
    risk_level = Column(String, nullable=True)  # "HIGH" / "MEDIUM" / "LOW"
    reason = Column(JSON, nullable=True)  # list of explainability strings from the model

    # Real NLP/SIF Fingerprint output (Member 3) — stored as one JSON blob
    fingerprint = Column(JSON, nullable=True)

    # Real embedding for precedent matching (Member 4) — 384-dim, all-MiniLM-L6-v2
    embedding = Column(Vector(384), nullable=True)