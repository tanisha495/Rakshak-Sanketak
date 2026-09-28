import joblib
import re

MODEL_PATH = "output/sif_classifier.joblib"

model = joblib.load(MODEL_PATH)


def predict_sif(text):
    probability = model.predict_proba([text])[0][1]
    lower = text.lower()

    # Explicit low-exposure indicators
    no_exposure = bool(re.search(
        r"\b(no employees?|no workers?|no personnel|"
        r"no one was|no one injured|unoccupied|"
        r"no person|no people|not working in (the )?area)\b",
        lower
    ))

    # Clear minor-event indicators
    minor_event = bool(re.search(
        r"\b(minor cut|minor scratch|minor bruise|"
        r"first aid only|no injury|no injuries)\b",
        lower
    ))

    # Strong SIF indicators
    severe_event = bool(re.search(
        r"\b(trapped|entrapped|pinned|crushed|"
        r"buried|engulfed|electrocuted|"
        r"fatal|killed|died|amputation|"
        r"roof collapse|roof fall|rollover|"
        r"overturned|explosion|inundation|drowning)\b",
        lower
    ))

    # Apply context corrections
    if no_exposure and not severe_event:
        probability = min(probability, 0.25)

    elif minor_event and not severe_event:
        probability = min(probability, 0.25)

    elif severe_event:
        probability = max(probability, 0.75)

    # Risk level
    if probability >= 0.75:
        risk = "HIGH"
    elif probability >= 0.40:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    # Explanation
    reasons = []

    if severe_event:
        reasons.append("Severe/high-consequence mechanism detected")

    if no_exposure:
        reasons.append("No worker exposure indicated")

    if minor_event:
        reasons.append("Minor event indicators detected")

    if not reasons:
        reasons.append("Risk estimated from incident patterns")

    return probability, risk, reasons


while True:
    text = input("\nEnter incident description (or 'exit'): ")

    if text.lower() == "exit":
        break

    probability, risk, reasons = predict_sif(text)

    print(f"\nSIF Probability: {probability:.2f}")
    print(f"Risk Level: {risk}")
    print("Reason:", " + ".join(reasons))