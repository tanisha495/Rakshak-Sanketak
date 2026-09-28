from intelligence.barrier_drift.barrier_drift import (
    detect_barrier_drift_with_slice,
)
from intelligence.barrier_drift.emerging_risk import (
    detect_emerging_risks_with_new,
)
from intelligence.data.report_repository import (
    load_historical_reports_with_stats,
)

# The precedent path and the Postgres repository are imported lazily, inside
# the `db is not None` branch. Both pull in sqlalchemy / sentence-transformers
# at import time, and those are the API container's dependencies — importing
# them at module level would make barrier drift and emerging risk, which need
# no database at all, unrunnable outside Docker.


def analyze_report(new_report, recent_reports, db=None, source=None):
    """Analyse one report against the historical corpus.

    With `db`, the corpus comes from Postgres as before. Without one, it is
    read from file — the NLP module's fingerprints by default, the synthetic
    JSON as a fallback — so barrier drift and emerging risk can run with no
    database. Precedent matching still needs the vector index, so it is
    skipped, explicitly, when there is no db.
    """
    corpus_stats = {}

    if db is not None:
        from intelligence.data.postgres_repository import (
            load_historical_reports as load_historical_reports_from_db,
        )
        historical_reports = load_historical_reports_from_db(db=db)
    else:
        historical_reports, corpus_stats = load_historical_reports_with_stats(
            source
        )

    if db is not None:
        from intelligence.precedent.precedent_engine import find_precedents

        precedents = find_precedents(
            new_report,
            historical_reports,
            db=db,
            exclude_report_id=new_report.get("report_id")
        )
        precedents_dropped = precedents.dropped_report_ids
    else:
        # Vector search needs the database. Say so rather than returning an
        # empty list that reads as "no similar report has ever happened".
        precedents = None
        precedents_dropped = []

    # Both are passed explicitly, so a null on the incoming report means
    # "cannot slice on this" rather than "slice on nothing" — see
    # barrier_drift.UNSPECIFIED.
    barrier_drift, drift_slice = detect_barrier_drift_with_slice(
        historical_reports,
        activity=new_report.get("activity"),
        hazard=new_report.get("hazard")
    )

    # Split deliberately: a pair with no measurable baseline is reported as
    # NEWLY_OBSERVED rather than being given a rate ratio against a
    # denominator that was chosen instead of observed.
    emerging_risks, newly_observed = detect_emerging_risks_with_new(
        historical_reports,
        recent_reports
    )

    return {
        "engine": "intelligence",
        "precedents": list(precedents) if precedents is not None else [],
        # F5: how many vector matches were discarded because the corpus did
        # not contain them. Non-zero with an empty `precedents` list means
        # "dropped everything", not "found nothing".
        "precedents_dropped": len(precedents_dropped),
        "precedents_dropped_report_ids": precedents_dropped,
        "precedents_available": precedents is not None,
        "barrier_drift": barrier_drift,
        # An empty barrier_drift with sliceable=False means the report did
        # not state the activity or hazard to slice on — not that the slice
        # was clean.
        "barrier_drift_slice": drift_slice,
        "emerging_risks": emerging_risks,
        # Additive: pairs seen in the window with little or no history.
        "newly_observed": newly_observed,
        "corpus": corpus_stats
    }
