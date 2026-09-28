from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.db import SessionLocal
from app.models.report import Report
from app.core.security import get_current_user

router = APIRouter(prefix="/patterns", tags=["patterns"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get(
    "/",
    summary="Get repeating equipment/site patterns (HSE staff only)",
    description="Surfaces equipment and site tags that appear across multiple reports, "
                "highlighting repeating safety issues at specific locations or with specific "
                "equipment. Requires a valid HSE staff login token.",
)
def get_patterns(min_count: int = 2, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    equipment_clusters = (
        db.query(Report.equipment_tag, func.count(Report.id).label("count"))
        .filter(Report.equipment_tag.isnot(None))
        .group_by(Report.equipment_tag)
        .having(func.count(Report.id) >= min_count)
        .all()
    )
    site_clusters = (
        db.query(Report.site_tag, func.count(Report.id).label("count"))
        .filter(Report.site_tag.isnot(None))
        .group_by(Report.site_tag)
        .having(func.count(Report.id) >= min_count)
        .all()
    )
    return {
        "equipment_patterns": [{"equipment_tag": e, "count": c} for e, c in equipment_clusters],
        "site_patterns": [{"site_tag": s, "count": c} for s, c in site_clusters],
    }