from fastapi import APIRouter
from app.services.analysis import analyse_report

router = APIRouter(prefix="/analyse", tags=["analyse"])

@router.post(
    "/",
    summary="Analyse report text and return risk assessment",
    description="Standalone endpoint that runs the SIF risk analysis on any given report text, "
                "without creating a report. Returns risk probability, risk level, and other "
                "demo/UI fields. Uses the same logic as report creation, so results are consistent. "
                "Currently uses mock analysis; will use the AI/ML team's real model in production.",
)
def analyse(raw_text: str, language: str = "english"):
    result = analyse_report(raw_text)
    return {
        "raw_text": raw_text,
        "language": language,
        **result,
    }