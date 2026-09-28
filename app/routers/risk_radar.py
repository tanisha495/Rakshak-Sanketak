from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.report import Report
from app.core.security import get_current_user

router = APIRouter(prefix="/risk-radar", tags=["risk-radar"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get(
    "/",
    summary="Get aggregate high-risk report overview (HSE staff only)",
    description="Returns a summary of high-risk reports above a given risk threshold, "
                "along with a basic trend indicator. Requires a valid HSE staff login token.",
)
def risk_radar(threshold: float = 0.6, limit: int = 10, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    high_risk = (
        db.query(Report)
        .filter(Report.risk_score >= threshold)
        .order_by(Report.risk_score.desc())
        .limit(limit)
        .all()
    )
    total = db.query(Report).count()
    high_risk_count = db.query(Report).filter(Report.risk_score >= threshold).count()

    return {
        "total_reports": total,
        "high_risk_count": high_risk_count,
        "threshold": threshold,
        "trend": "up" if total and high_risk_count / total > 0.3 else "stable",
        "reports": [
            {
                "id": r.id,
                "risk_score": r.risk_score,
                "barrier_category": r.barrier_category,
                "site_tag": r.site_tag,
                "submitted_at": r.submitted_at,
            }
            for r in high_risk
        ],
    }