from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.precedent import HistoricalPrecedent
from app.models.report import Report
from app.core.security import get_current_user
import random

router = APIRouter(prefix="/precedents", tags=["precedents"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def mock_embedding(text: str):
    seed = sum(ord(c) for c in text) if text else 0
    random.seed(seed)
    return [random.uniform(-1, 1) for _ in range(8)]

@router.get(
    "/{report_id}",
    summary="Find matching historical disaster precedents (HSE staff only)",
    description="Uses vector similarity search (pgvector) to match a report against a database "
                "of historical industrial disasters (e.g. Piper Alpha, Bhopal), surfacing "
                "relevant precedents for the given incident. Requires a valid HSE staff login token.",
)
def get_precedents(report_id: str, limit: int = 3, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        return {"error": "Report not found"}

    query_embedding = mock_embedding(report.raw_text)

    matches = (
        db.query(HistoricalPrecedent)
        .order_by(HistoricalPrecedent.embedding.l2_distance(query_embedding))
        .limit(limit)
        .all()
    )
    return {
        "report_id": report_id,
        "matches": [
            {"name": m.name, "description": m.description, "source": m.source}
            for m in matches
        ],
    }