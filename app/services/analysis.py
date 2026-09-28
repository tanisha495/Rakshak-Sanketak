import random
import re
import joblib
import os

# --- Load the real SIF classifier model once, at startup ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ml_models", "sif_classifier.joblib")
model = joblib.load(MODEL_PATH)

# --- Fields still used for demo/UI purposes (risk-radar, patterns) ---
EQUIPMENT_TAGS = ["pump", "scaffold", "crane", "pipeline", "electrical"]
BARRIER_CATEGORIES = ["PPE non-compliance", "procedure violation", "equipment failure", "near miss"]

EQUIPMENT_KEYWORDS = {
    "scaffold": "scaffold",
    "guardrail": "scaffold",
    "pump": "pump",
    "crane": "crane",
    "pipeline": "pipeline",
    "pipe": "pipeline",
    "valve": "pipeline",
    "electrical": "electrical",
    "wire": "electrical",
    "wiring": "electrical",
}

BARRIER_KEYWORDS = {
    "ppe": "PPE non-compliance",
    "helmet": "PPE non-compliance",
    "guardrail": "PPE non-compliance",
    "permit": "procedure violation",
    "procedure": "procedure violation",
    "inspection": "procedure violation",
    "failure": "equipment failure",
    "malfunction": "equipment failure",
    "leak": "equipment failure",
}


def detect_tag(text: str, keyword_map: dict, fallback_options: list, seed: int) -> str:
    """
    Checks text for known keywords first; falls back to deterministic
    random choice if no keyword matches.
    """
    lower = text.lower()
    for keyword, tag in keyword_map.items():
        if keyword in lower:
            return tag
    random.seed(seed)
    return random.choice(fallback_options)


def predict_sif(text: str) -> dict:
    """
    Real SIF prediction using Member 2's trained model + rule-based adjustments.
    """
    probability = model.predict_proba([text])[0][1]

    lower = text.lower()

    no_exposure = bool(re.search(
        r"\b(no employees?|no workers?|no personnel|"
        r"no one was|no one injured|unoccupied|"
        r"no person|no people|not working in (the )?area)\b",
        lower
    ))

    minor_event = bool(re.search(
        r"\b(minor cut|minor scratch|minor bruise|"
        r"first aid only|no injury|no injuries)\b",
        lower
    ))

    severe_event = bool(re.search(
        r"\b(trapped|entrapped|pinned|crushed|"
        r"buried|engulfed|electrocuted|"
        r"fatal|killed|died|amputation|"
        r"roof collapse|roof fall|rollover|"
        r"overturned|explosion|inundation|drowning)\b",
        lower
    ))

    if no_exposure and not severe_event:
        probability = min(probability, 0.25)
    elif minor_event and not severe_event:
        probability = min(probability, 0.25)
    elif severe_event:
        probability = max(probability, 0.75)

    if probability >= 0.75:
        risk_level = "HIGH"
    elif probability >= 0.40:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    reasons = []
    if severe_event:
        reasons.append("Severe/high-consequence mechanism detected")
    if no_exposure:
        reasons.append("No worker exposure indicated")
    if minor_event:
        reasons.append("Minor event indicators detected")
    if not reasons:
        reasons.append("Risk estimated from incident patterns")

    return {
        "sif_probability": round(float(probability), 4),
        "risk_level": risk_level,
        "reason": reasons,
    }


def analyse_report(raw_text: str) -> dict:
    """
    Runs full analysis on report text: real SIF prediction (Member 2's model)
    plus demo/UI fields (equipment_tag, barrier_category) used by the
    risk-radar and patterns endpoints. Equipment/barrier tags check for
    actual keywords in the text before falling back to random assignment.

    site_tag is NOT set here. It now comes from the worker, via the `site`
    parameter on POST /reports/, and is null when they did not give one.
    """
    sif_result = predict_sif(raw_text)

    seed = sum(ord(c) for c in raw_text) if raw_text else 0

    equipment_tag = detect_tag(raw_text, EQUIPMENT_KEYWORDS, EQUIPMENT_TAGS, seed)
    barrier_category = detect_tag(raw_text, BARRIER_KEYWORDS, BARRIER_CATEGORIES, seed + 1)

    # site_tag is deliberately NOT produced here any more.
    #
    # It used to be f"site-{sum(ord(c) for c in raw_text) % 5 + 1}" -- a hash
    # of the report text bucketed into five fake sites, which the dashboard
    # then rendered as though it were a real location. The same incident
    # described in three different ways landed at three different "sites",
    # and Risk Radar grouped by it. A worker-supplied site is written by the
    # /reports/ endpoint instead; absent one, site_tag stays null.

    return {
        "sif_probability": sif_result["sif_probability"],
        "risk_level": sif_result["risk_level"],
        "reason": sif_result["reason"],
        "risk_score": sif_result["sif_probability"],
        "barrier_category": barrier_category,
        "equipment_tag": equipment_tag,
    }