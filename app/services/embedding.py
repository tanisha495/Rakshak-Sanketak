from sentence_transformers import SentenceTransformer

# Load once at startup — this is a real ML model, loading it per-request would be very slow
_model = SentenceTransformer("all-MiniLM-L6-v2")


def report_to_text(report: dict) -> str:
    """
    Converts a fingerprint dict into a text string for embedding.
    Matches Member 4's exact logic so vectors are comparable.
    """
    text = []
    text.append(report.get("activity") or "")
    text.append(report.get("hazard") or "")
    text.extend(report.get("life_saving_rules") or [])
    for failure in report.get("barrier_failures") or []:
        text.append(failure.get("barrier", ""))
        text.append(failure.get("failure_mode", ""))
    return " ".join(text)


def generate_embedding(fingerprint: dict) -> list:
    """
    Generates a 384-dim embedding vector from a fingerprint dict,
    using the same model and text-construction logic as Member 4's
    vector_search.py, so vectors are comparable.
    """
    text = report_to_text(fingerprint)
    if not text.strip():
        return None
    return _model.encode(text).tolist()