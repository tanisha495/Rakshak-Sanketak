from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.core.db import SessionLocal
from app.models.report import Report
from app.core.security import get_current_user
from app.services.analysis import analyse_report
from app.services.fingerprint import extract_fingerprint
from app.services.embedding import generate_embedding
import uuid

router = APIRouter(prefix="/reports", tags=["reports"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ReportStatusUpdate(BaseModel):
    """Body for PATCH /reports/{id}/status."""
    new_status: str


def serialize_report(report: Report) -> dict:
    """Converts a Report to the HSE-facing shape.

    Two fields on the ORM row are deliberately absent:

    `anon_token` is the worker's private handle for their own report. It is
    what makes anonymous follow-up possible, and handing it to every officer
    who can list reports defeats that. It stays in the database and stays on
    GET /reports/worker/{token}, which is the worker's own lookup.

    `embedding` is a 384-float vector nothing human-facing reads; it added
    about 3 KB to every row of a 500-row list response.
    """
    return {
        "id": report.id,
        "source": report.source,
        "raw_text": report.raw_text,
        "language": report.language,
        "status": report.status,
        "submitted_at": report.submitted_at,
        "risk_score": report.risk_score,
        "barrier_category": report.barrier_category,
        "equipment_tag": report.equipment_tag,
        "site_tag": report.site_tag,
        "sif_probability": report.sif_probability,
        "risk_level": report.risk_level,
        "reason": report.reason,
        "fingerprint": report.fingerprint,
        # embedding intentionally excluded — large array, not human-relevant
    }

@router.post(
    "/",
    summary="Submit an anonymous safety report",
    description="Workers submit a safety incident report in any language, with no login required. "
                "Returns an anonymous token used to check status later. No personal identifying "
                "information is stored.",
)
def create_report(
    raw_text: str,
    language: str,
    site: Optional[str] = None,
    db: Session = Depends(get_db),
):
    analysis = analyse_report(raw_text)
    report = Report(
        anon_token=str(uuid.uuid4()),
        raw_text=raw_text,
        language=language,
        **analysis,
    )

    # The site the worker selected, when they selected one. Stored in the
    # existing site_tag column, which until now held a value derived from the
    # report text rather than from anything the worker said. A report with no
    # site keeps site_tag null, which the dashboard already renders as
    # "Not recorded" -- a null here means "not stated", never "everywhere".
    if site and site.strip():
        report.site_tag = site.strip()
    db.add(report)
    db.commit()
    db.refresh(report)

    # Run NLP fingerprint extraction (Member 3) and save it
    fingerprint = extract_fingerprint(report.id, raw_text)
    report.fingerprint = fingerprint
    db.commit()
    db.refresh(report)

    # Generate embedding for precedent matching (Member 4) and save it
    embedding = generate_embedding(fingerprint)
    report.embedding = embedding
    db.commit()
    db.refresh(report)

    return {"anon_token": report.anon_token, "status": report.status}

@router.get(
    "/worker/{token}",
    summary="Check report status (anonymous, no login)",
    description="Lets a worker check the status of their submitted report using only their "
                "anonymous token, in their own language. No login or personal data required.",
)
def check_status(token: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.anon_token == token).first()
    if not report:
        return {"error": "Invalid token or report not found"}

    fp = report.fingerprint or {}
    barrier_failures = fp.get("barrier_failures") or []
    barrier_failure_text = barrier_failures[0].get("barrier") if barrier_failures else None

    return {
        "status": report.status,
        "language": report.language,
        "submitted_at": report.submitted_at,
        "risk_level": report.risk_level,
        "analysis": {
            "activity": fp.get("activity"),
            "hazard": fp.get("hazard"),
            "exposure": fp.get("exposure"),
            "barrier_failure": barrier_failure_text,
            "potential_consequence": fp.get("potential_consequence"),
            "life_saving_rules": fp.get("life_saving_rules") or [],
        } if fp else None,
    }

@router.get(
    "/",
    summary="List all reports (HSE staff only)",
    description="Returns all submitted reports with full analysis details. Requires a valid "
                "HSE staff login token.",
)
def list_reports(
    include_seed: bool = False,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    query = db.query(Report)
    if not include_seed:
        # Live submissions only. An officer triaging today's reports should
        # not have the historical analysis corpus in the same queue.
        query = query.filter(Report.source == "live")
    return [serialize_report(r) for r in query.all()]

@router.get(
    "/{report_id}",
    summary="Get a single report's full details (HSE staff only)",
    description="Returns full details of one report, including risk analysis fields. "
                "Requires a valid HSE staff login token.",
)
def get_report(report_id: str, db: Session = Depends(get_db), user: dict = Depends(get_current_user)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        return {"error": "Report not found"}
    return serialize_report(report)

@router.patch(
    "/{report_id}/status",
    summary="Update a report's status (HSE staff only)",
    description="Moves a report through the HSE workflow (e.g. pending -> in_review -> "
                "verified -> closed). Requires a valid HSE staff login token.",
)
def update_report_status(
    report_id: str,
    body: Optional[ReportStatusUpdate] = None,
    new_status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # Accepts the status either in a JSON body or as the `new_status` query
    # parameter. The dashboard still sends a query parameter; taking both
    # means this endpoint and its caller can be migrated separately instead
    # of having to land in the same commit.
    status = body.new_status if body is not None else new_status
    if not status:
        return {"error": "new_status is required, in the body or as a query parameter"}

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        return {"error": "Report not found"}
    report.status = status
    db.commit()
    db.refresh(report)
    return {"id": report.id, "status": report.status}