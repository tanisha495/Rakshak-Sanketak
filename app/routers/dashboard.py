from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.report import Report
from app.models.action import CorrectiveAction
from app.core.security import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get(
    "/summary",
    summary="Get dashboard summary stats (HSE staff only)",
    description="Returns combined summary statistics for the HSE dashboard's overview cards: "
                "total reports, high-risk report count, and open corrective actions. "
                "Requires a valid HSE staff login token.",
)
def dashboard_summary(
    include_seed: bool = False,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # The overview cards count live submissions only by default. Counting the
    # 500-report historical corpus here would put a number on screen that no
    # officer can act on and that never changes.
    reports = db.query(Report)
    actions = db.query(CorrectiveAction)
    if not include_seed:
        reports = reports.filter(Report.source == "live")
        live_ids = db.query(Report.id).filter(Report.source == "live")
        actions = actions.filter(CorrectiveAction.report_id.in_(live_ids))

    total_reports = reports.count()
    high_risk_count = reports.filter(Report.risk_score >= 0.6).count()
    open_actions = actions.filter(CorrectiveAction.status == "open").count()
    total_actions = actions.count()

    return {
        "total_reports": total_reports,
        "high_risk_count": high_risk_count,
        "open_actions": open_actions,
        "total_actions": total_actions,
    }