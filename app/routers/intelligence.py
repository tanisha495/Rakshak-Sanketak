import sys
import os

# Make her intelligence module importable
INTELLIGENCE_PATH = os.path.join(os.path.dirname(__file__), "..", "..")
if INTELLIGENCE_PATH not in sys.path:
    sys.path.insert(0, INTELLIGENCE_PATH)

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.core.security import get_current_user
from app.models.report import Report
from intelligence.api import intelligence_analysis

router = APIRouter(prefix="/intelligence", tags=["intelligence"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get(
    "/{report_id}",
    summary="Get precedent matches, barrier drift, and emerging risks (HSE staff only)",
    description="Runs the Intelligence Engine (Member 4) on a report's fingerprint: finds "
                "similar historical cases, detects repeated barrier failures for the same "
                "activity/hazard, and surfaces emerging risk trends. Requires a valid HSE "
                "staff login token.",
)
def get_intelligence(report_id: str, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report or not report.fingerprint:
        return {"error": "Report not found or has no fingerprint data"}

    # "Recent reports" = last 20 reports with fingerprints, for emerging-risk detection
    recent = (
        db.query(Report)
        .filter(Report.fingerprint.isnot(None))
        .order_by(Report.submitted_at.desc())
        .limit(20)
        .all()
    )
    recent_fingerprints = [r.fingerprint for r in recent if r.fingerprint]

    result = intelligence_analysis(report.fingerprint, recent_fingerprints, db=db)
    return result