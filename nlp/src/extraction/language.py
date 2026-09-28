"""
Which language is this report written in?

Deliberately dependency-free and script-based rather than a statistical
detector. Field reports are short — often a single line — and general-purpose
language detectors are unreliable on short strings and on code-mixed text,
which is exactly the case that matters here. Unicode ranges are boring and
they do not misfire.

Assamese and Bengali share a script, so a script check cannot separate them.
That is fine for our purpose: OIL's Assam operations are the relevant case, and
either way the text routes down the same path.
"""

from __future__ import annotations

import re
from typing import Tuple

from annotation import Language

_DEVANAGARI = re.compile(r"[\u0900-\u097F]")     # Hindi
_BENGALI_ASSAMESE = re.compile(r"[\u0980-\u09FF]")
_LATIN = re.compile(r"[A-Za-z]")

# Romanised Hindi that a field worker would actually type. Function words and
# safety vocabulary, not nouns — nouns get borrowed into English anyway.
#
# Every marker here must be a word that is NOT also ordinary English. An
# earlier version included "the" (Hindi "were"), "par", "band", "check", "ke",
# "ka" and "ki"; "the" alone pushed 28% of plain English OSHA narratives into
# MIXED. A marker that collides with English is worse than a missing marker,
# because it misroutes reports that were never code-mixed at all.
_HINGLISH_MARKERS = {
    "nahi", "nahin", "tha", "thi", "hai", "hain", "kiya", "kiye", "kar",
    "karke", "karta", "karte", "hua", "hui", "gaya", "gayi", "raha", "rahi",
    "bina", "wala", "wale", "liye", "diya", "dena", "lekin", "phir", "abhi",
    "mein", "se", "ko", "aur", "koi", "kuch", "sab",
    "chalu", "kaam", "mistri", "aadmi", "haath", "upar", "niche",
    "andar", "bahar", "girna", "gir", "laga", "lagi", "theek",
}


def detect_language(text: str) -> Tuple[Language, float]:
    """Return the language and a rough confidence in [0, 1].

    Confidence is a proportion of evidence, not a calibrated probability. It
    exists so a caller can route uncertain cases to review rather than trust
    them silently.
    """
    if not text or not text.strip():
        return Language.UNKNOWN, 0.0

    deva = len(_DEVANAGARI.findall(text))
    beng = len(_BENGALI_ASSAMESE.findall(text))
    latin = len(_LATIN.findall(text))
    total = deva + beng + latin
    if total == 0:
        return Language.UNKNOWN, 0.0

    # Two scripts in one report is code-mixing, whatever the proportions.
    scripts_present = sum(1 for n in (deva, beng, latin) if n > 0)
    if scripts_present > 1 and min(deva + beng, latin) / total > 0.15:
        return Language.MIXED, 0.9

    if deva / total > 0.5:
        return Language.HI, deva / total
    if beng / total > 0.5:
        return Language.AS, beng / total

    # Latin script — English, or Hindi typed in Roman letters.
    words = re.findall(r"[a-z]+", text.lower())
    if words:
        hits = sum(1 for w in words if w in _HINGLISH_MARKERS)
        ratio = hits / len(words)
        # Genuinely code-mixed text is dense in these markers, because they are
        # the function words holding the sentence together — a Hinglish report
        # runs well above a fifth. A long English narrative that happens to
        # contain a couple of borrowed nouns does not, so require both a real
        # count and a real proportion.
        if hits >= 3 and ratio >= 0.20:
            return Language.MIXED, min(0.5 + ratio, 0.95)

    return Language.EN, latin / total


def is_english(text: str) -> bool:
    lang, _ = detect_language(text)
    return lang == Language.EN
