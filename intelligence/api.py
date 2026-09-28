from intelligence.intelligence_engine import analyze_report


def intelligence_analysis(sif_fingerprint, recent_reports, db=None):
    """
    Main interface for the backend.

    Input:
        sif_fingerprint = structured SIF fingerprint
        recent_reports = recent SIF fingerprints
        db = SQLAlchemy database session

    Output:
        Intelligence Engine results
    """

    result = analyze_report(
        sif_fingerprint,
        recent_reports,
        db=db
    )

    return result