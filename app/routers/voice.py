import os
import uuid
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.fingerprint import extract_fingerprint

try:
    from loader import get_taxonomy
except Exception:  # pragma: no cover - import path is established by fingerprint.py
    get_taxonomy = None


load_dotenv()

router = APIRouter(tags=["voice"])

NO_DATA = "No data"
NO_BARRIER_FAILURE = "No barrier failure identified"

LANGUAGE_CODES = {
    "en": "en",
    "english": "en",
    "hi": "hi",
    "hindi": "hi",
    "as": "as",
    "assamese": "as",
}


@router.post(
    "/voice-report",
    summary="Transcribe and analyse a voice safety report",
    description="Accepts a recorded voice report, transcribes it with Whisper, "
                "runs the NLP fingerprint extractor, and returns the shape the "
                "mobile voice-report flow expects.",
)
async def create_voice_report(
    audio: UploadFile = File(...),
    language: str = Form(...),
):
    transcript, detected_language = await transcribe_audio(audio, language)
    fingerprint = extract_fingerprint(str(uuid.uuid4()), transcript)

    return {
        "transcript": transcript,
        "detected_language": detected_language or normalize_detected_language(language),
        "analysis": fingerprint_to_mobile_analysis(fingerprint),
    }


async def transcribe_audio(audio: UploadFile, language: str) -> tuple[str, str]:
    key = os.getenv("OPENAI_API_KEY")

    if not key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured for voice transcription.",
        )

    try:
        from openai import OpenAI
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"OpenAI client is not available: {exc}",
        ) from exc

    audio_bytes = await audio.read()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

    client = OpenAI(api_key=key)
    filename = audio.filename or "voice-report.m4a"
    content_type = audio.content_type or "application/octet-stream"
    request: dict[str, Any] = {
        "model": "whisper-1",
        "file": (filename, audio_bytes, content_type),
        "response_format": "verbose_json",
    }
    language_code = to_whisper_language(language)

    if language_code:
        request["language"] = language_code

    try:
        response = client.audio.transcriptions.create(**request)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Voice transcription failed: {exc}",
        ) from exc

    transcript = coerce_non_empty_text(get_response_value(response, "text"), "")

    if not transcript:
        raise HTTPException(
            status_code=502,
            detail="Voice transcription returned an empty transcript.",
        )

    detected_language = coerce_non_empty_text(
        get_response_value(response, "language"),
        normalize_detected_language(language),
    )

    return transcript, detected_language


def fingerprint_to_mobile_analysis(fingerprint: dict[str, Any]) -> dict[str, Any]:
    return {
        "activity": coerce_non_empty_text(fingerprint.get("activity"), NO_DATA),
        "hazard": coerce_non_empty_text(fingerprint.get("hazard"), NO_DATA),
        "exposure": coerce_non_empty_text(fingerprint.get("exposure"), NO_DATA),
        "barrier_failure": summarize_barrier_failure(
            fingerprint.get("barrier_failures")
        ),
        "potential_consequence": coerce_non_empty_text(
            fingerprint.get("potential_consequence"),
            NO_DATA,
        ),
        "life_saving_rules": coerce_string_list(
            fingerprint.get("life_saving_rules")
        ),
    }


def summarize_barrier_failure(value: Any) -> str:
    if not isinstance(value, list) or not value:
        return NO_BARRIER_FAILURE

    failures = [item for item in value if isinstance(item, dict)]

    if not failures:
        return NO_BARRIER_FAILURE

    selected = next(
        (item for item in failures if item.get("primary") is True),
        failures[0],
    )
    barrier = taxonomy_label(selected.get("barrier"))
    failure_mode = taxonomy_label(selected.get("failure_mode"))

    if barrier == NO_DATA and failure_mode == NO_DATA:
        return NO_BARRIER_FAILURE

    return f"{barrier}: {failure_mode}"


def taxonomy_label(value: Any) -> str:
    term_id = coerce_non_empty_text(value, "")

    if not term_id:
        return NO_DATA

    if get_taxonomy is None:
        return term_id

    try:
        term = get_taxonomy().get(term_id)
        label = getattr(term, "label", None)
        return coerce_non_empty_text(label, term_id)
    except Exception:
        return term_id


def coerce_non_empty_text(value: Any, fallback: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()

    return fallback


def coerce_string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        items = [
            item.strip()
            for item in value
            if isinstance(item, str) and item.strip()
        ]

        if items:
            return items

    return [NO_DATA]


def get_response_value(response: Any, key: str) -> Optional[Any]:
    if isinstance(response, dict):
        return response.get(key)

    return getattr(response, key, None)


def to_whisper_language(language: str) -> Optional[str]:
    normalized = language.strip().lower()

    if normalized in {"mixed", "unknown"}:
        return None

    return LANGUAGE_CODES.get(normalized)


def normalize_detected_language(language: str) -> str:
    normalized = language.strip().lower()

    return LANGUAGE_CODES.get(normalized, normalized or "unknown")
