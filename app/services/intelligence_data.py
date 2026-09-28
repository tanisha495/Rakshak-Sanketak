from sqlalchemy.orm import Session
from app.models.report import Report


def load_historical_reports_from_db(db: Session) -> list:
    """
    Corrected version of Member 4's load_historical_reports() -
    pulls from our actual `reports` table's `fingerprint` JSON column
    instead of her assumed flat-column schema.
    """
    reports = db.query(Report).filter(Report.fingerprint.isnot(None)).all()

    result = []
    for r in reports:
        fp = r.fingerprint or {}
        result.append({
            "report_id": r.id,
            "activity": fp.get("activity"),
            "hazard": fp.get("hazard"),
            "exposure": fp.get("exposure"),
            "potential_consequence": fp.get("potential_consequence"),
            "life_saving_rules": fp.get("life_saving_rules") or [],
            "barrier_failures": fp.get("barrier_failures") or [],
        })
    return result


def vector_search_db(db: Session, embedding: list, exclude_report_id: str = None, top_k: int = 10) -> list:
    """
    Corrected version of Member 4's vector_search() - uses SQLAlchemy +
    pgvector properly against our actual database connection, instead of
    a hardcoded psycopg connection with wrong credentials.
    """
    if embedding is None:
        return []

    query = db.query(
        Report.id,
        Report.embedding.cosine_distance(embedding).label("distance"),
    ).filter(Report.embedding.isnot(None))

    if exclude_report_id:
        query = query.filter(Report.id != exclude_report_id)

    results = query.order_by("distance").limit(top_k).all()

    return [
        {"report_id": r.id, "similarity": round(1 - r.distance, 3)}
        for r in results
    ]
