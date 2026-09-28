from fastapi import FastAPI
from intelligence.api import intelligence_analysis


app = FastAPI(
    title="Sanketak Intelligence Engine"
)


@app.post("/intelligence/analyze")
def analyze(request: dict):

    sif_fingerprint = request.get("sif_fingerprint", {})
    recent_reports = request.get("recent_reports", [])

    result = intelligence_analysis(
        sif_fingerprint,
        recent_reports
    )

    return result