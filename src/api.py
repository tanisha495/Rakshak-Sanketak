import os
from dotenv import load_dotenv
from openai import OpenAI

from pathlib import Path
import re

import joblib
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title='Sanketak SIF API')

MODEL_PATH = Path('output/sif_classifier.joblib')
bundle = joblib.load(MODEL_PATH)

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# Backward compatibility: support both the new bundle and an old raw sklearn Pipeline.
if isinstance(bundle, dict) and 'model' in bundle:
    model = bundle['model']
    positive_threshold = float(bundle.get('risk_thresholds', {}).get('medium', 0.55))
else:
    model = bundle
    positive_threshold = 0.55

HIGH_THRESHOLD = float(bundle.get('risk_thresholds', {}).get('high', 0.75)) if isinstance(bundle, dict) else 0.75

class IncidentRequest(BaseModel):
    incident_text: str = Field(min_length=1)
    language: str | None = None


def detect_language(text: str) -> str:
    # Lightweight character-based detection. It is deliberately conservative.
    if re.search(r'[\u0900-\u097F]', text):
        return 'hi'  # Hindi/Devanagari; exact language within Devanagari is not inferred.
    if re.search(r'[\u0980-\u09FF]', text):
        return 'as'  # Assamese/Bengali script; exact language may require a proper detector.
    return 'en'


def translate_to_english(text: str, language: str) -> tuple[str, str | None]:
    """Translate non-English incident text to English using OpenAI."""

    if language == "en":
        return text, None

    if client is None:
        return text, "OpenAI API key is not configured."

    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            input=(
                "Translate the following workplace safety incident report "
                "into clear English. Preserve the original meaning and all "
                "safety-related details. Do not summarize or add information.\n\n"
                f"Incident report:\n{text}"
            )
        )

        translated = response.output_text.strip()

        if not translated:
            return text, "Translation returned empty text."

        return translated, None

    except Exception as exc:
        return text, f"Translation failed: {exc.__class__.__name__}"

def predict_sif(text: str, language: str | None = None):
    detected_language = language or detect_language(text)
    english_text, translation_warning = translate_to_english(text, detected_language)

    # Do not produce a misleading numeric prediction when the English-only model
    # has received untranslated non-English text.
    if detected_language != 'en' and translation_warning:
        return {
            'sif_probability': None,
            'risk_level': 'NEEDS_REVIEW',
            'reason': [translation_warning],
            'detected_language': detected_language,
            'model_input': text,
        }

    probability = float(model.predict_proba([english_text])[0][1])
    lower = english_text.lower()

    no_exposure = bool(re.search(
        r'\b(no employees?|no workers?|no personnel|no one was|no one injured|'
        r'unoccupied|no person|no people|not working in (the )?area)\b', lower
    ))

    minor_event = bool(re.search(
        r'\b(minor cut|minor scratch|minor bruise|first aid only|no injury|no injuries)\b',
        lower
    ))

    severe_event = bool(re.search(
        r'\b(trapped|entrapped|pinned|crushed|buried|engulfed|electrocuted|'
        r'fatal|killed|died|amputation|roof collapse|roof fall|rollover|'
        r'overturned|explosion|inundation|drowning)\b', lower
    ))

    # Deterministic safety post-processing. These rules are not part of training.
    if no_exposure and not severe_event:
        probability = min(probability, 0.25)
    elif minor_event and not severe_event:
        probability = min(probability, 0.25)
    elif severe_event:
        probability = max(probability, HIGH_THRESHOLD)

    # Short/low-information reports should not be presented with false certainty.
    word_count = len(re.findall(r'\b\w+\b', english_text))
    low_information = word_count < 5

    if low_information:
        risk_level = 'NEEDS_REVIEW'
    elif probability >= HIGH_THRESHOLD:
        risk_level = 'HIGH'
    elif probability >= positive_threshold:
        risk_level = 'MEDIUM'
    else:
        risk_level = 'LOW'

    reasons = []
    if severe_event:
        reasons.append('Severe/high-consequence mechanism detected')
    if no_exposure:
        reasons.append('No worker exposure indicated')
    if minor_event:
        reasons.append('Minor event indicators detected')
    if low_information:
        reasons.append('Insufficient incident detail for confident automated assessment')
    if not reasons:
        reasons.append('Risk estimated from incident patterns')

    return {
        'sif_probability': round(probability, 4),
        'risk_level': risk_level,
        'reason': reasons,
        'detected_language': detected_language,
        'translated_text': english_text if detected_language != 'en' else None,
    }


@app.get('/')
def root():
    return {
        'message': 'Sanketak SIF API Running',
        'model_type': 'TF-IDF + Logistic Regression',
        'positive_threshold': positive_threshold,
        'multilingual_translation': 'optional',
    }


@app.post('/predict')
def predict(request: IncidentRequest):
    return predict_sif(request.incident_text, request.language)
