from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.db import SessionLocal
from app.models.action import CorrectiveAction
from app.models.report import Report
from app.core.security import get_current_user
import uuid

router = APIRouter(prefix="/actions", tags=["actions"])


class ActionUpdate(BaseModel):
    """Body for PATCH /actions/{id}."""
    status: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get(
    "/",
    summary="List all corrective actions (HSE staff only)",
    description="Returns all corrective actions across all reports, including their status, "
                "owner, and due date. Requires a valid HSE staff login token.",
)
def list_actions(
    include_seed: bool = False,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    query = db.query(CorrectiveAction)
    if not include_seed:
        # An action belongs to a report, so "live actions" means actions on
        # live reports. Done as a subquery rather than a join so the returned
        # rows stay plain CorrectiveAction objects and the response shape the
        # dashboard parses is unchanged.
        live_ids = db.query(Report.id).filter(Report.source == "live")
        query = query.filter(CorrectiveAction.report_id.in_(live_ids))
    return query.all()

@router.post(
    "/",
    summary="Create a corrective action (HSE staff only)",
    description="Creates a corrective action item linked to a report, with an optional owner "
                "assigned. Requires a valid HSE staff login token.",
)
def create_action(
    report_id: str,
    description: str,
    owner: str = None,
    due_date: Optional[datetime] = None,
    priority: Optional[str] = None,
    verification_required: bool = False,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # due_date, priority and verification_required are collected by the
    # dashboard's assignment form. Until now the endpoint had no parameters
    # for them, so they were accepted by the form and dropped on the wire.
    action = CorrectiveAction(
        id=str(uuid.uuid4()),
        report_id=report_id,
        description=description,
        owner=owner,
        due_date=due_date,
        priority=priority,
        verification_required=verification_required,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action

@router.patch(
    "/{action_id}",
    summary="Update a corrective action's status (HSE staff only)",
    description="Updates the status of an existing corrective action (e.g. open, in_progress, "
                "closed). Requires a valid HSE staff login token.",
)
def update_action(
    action_id: str,
    body: Optional[ActionUpdate] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # Body or query parameter, same reasoning as PATCH /reports/{id}/status:
    # the dashboard still sends a query parameter and can migrate separately.
    new_status = body.status if body is not None else status
    if not new_status:
        return {"error": "status is required, in the body or as a query parameter"}

    action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
    if not action:
        return {"error": "Action not found"}
    action.status = new_status
    db.commit()
    db.refresh(action)
    return action