import sys
import os

# Make her nlp/src modules importable
NLP_SRC_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "nlp", "src")
if NLP_SRC_PATH not in sys.path:
    sys.path.insert(0, NLP_SRC_PATH)

from extraction import Extractor

# Reuse one instance across the app, per her own docstring guidance
_extractor = None


def get_extractor():
    global _extractor
    if _extractor is None:
        _extractor = Extractor()
    return _extractor


def extract_fingerprint(report_id: str, raw_text: str) -> dict:
    """
    Runs Member 3's NLP extraction on report text, returns a plain dict
    ready to store in the database. Never raises — a failed extraction
    still returns a valid (all-null, status=failed) fingerprint dict,
    per her own design.
    """
    try:
        extractor = get_extractor()
        fp = extractor.extract(report_id, raw_text)
        return fp.model_dump(mode="json")
    except Exception as e:
        # Defensive fallback — should rarely trigger, since her Extractor
        # already catches LLM errors internally and returns status=failed.
        return {
            "report_id": report_id,
            "extraction_status": "failed",
            "notes": f"integration error: {e}",
        }