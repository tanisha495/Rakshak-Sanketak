"""Language detection, and specifically the English/Hinglish boundary.

The failure this file exists to prevent: a romanised-Hindi marker that is also
an ordinary English word. "the" is Hindi for "were", and including it once put
28% of plain English OSHA narratives into MIXED — which routes reports down the
code-mixed path and asks the model for a gloss of text that needs none.

So the English cases below are load-bearing, not filler. They are real
narratives, quoted verbatim, chosen because they contain words a careless
marker list would trip on: "the", "check", "band", "par(t)", "ka".
"""

from __future__ import annotations

import csv
from pathlib import Path

import pytest

from extraction.language import detect_language, is_english
from annotation import Language


# Real OSHA narratives. Every one of these is monolingual English.
ENGLISH_NARRATIVES = [
    "An employee was heating a paint spray can with a heat gun when the can "
    "blew up, burning his hands, wrists, neck, and face.",
    "An employee was operating a saw on 2-24-2017 to cut melamine board and "
    "amputated the left middle finger. The saw was guarded at the time.",
    "An employee's clothing was caught by an uncovered rotating shaft. The "
    "shaft mangled the employee's left leg, which was amputated.",
    "ROCK WAS PUSHED OFF HIGHWALL & HIT THE EDGE OF HIS MACHINE & JARRED HIM, "
    "INJURING HIS SHOULDER.",
    "An employee was adjusting the top of a dough molding machine. The "
    "employee's left hand slipped into the machine's sheet rollers.",
    "Employee 1 was underneath a tractor and training employee 2. Employee 1 "
    "was using a cutting torch to remove a bearing when a spark ignited.",
    # Short ones — the dangerous case, since one marker is a large proportion
    # of a short report.
    "Worker did not check the gauge.",
    "The band saw guard was removed.",
    "Operator failed to check the valve on the part line.",
    "The isolation was not verified before the work started.",
]

# Genuinely code-mixed. These must keep working — the fix for the English
# false positives must not be a detector that never fires.
HINGLISH_NARRATIVES = [
    "Mistri ne pump ka kaam bina isolation verify kiye shuru kar diya.",
    "Worker upar chadh gaya lekin harness anchor nahi kiya tha.",
    "Operator ne isolation nahi kiya tha aur pump chalu kar diya.",
]


@pytest.mark.parametrize("text", ENGLISH_NARRATIVES)
def test_english_narratives_are_not_mixed(text):
    """An English report must never be flagged as code-mixed."""
    lang, _ = detect_language(text)
    assert lang is Language.EN, f"{lang.value} for English text: {text!r}"
    assert is_english(text)


@pytest.mark.parametrize("text", HINGLISH_NARRATIVES)
def test_hinglish_is_still_detected(text):
    lang, conf = detect_language(text)
    assert lang is Language.MIXED, f"{lang.value} for Hinglish text: {text!r}"
    assert conf >= 0.5


def test_no_marker_is_an_english_word():
    """Guard the marker list itself, not just its current behaviour.

    A new marker that collides with common English would pass the cases above
    by luck; this catches it at the source.
    """
    from extraction.language import _HINGLISH_MARKERS

    common_english = {
        "the", "a", "an", "and", "or", "but", "is", "was", "were", "are",
        "be", "been", "to", "of", "in", "on", "at", "by", "for", "with",
        "from", "as", "it", "its", "he", "she", "they", "his", "her",
        "check", "band", "par", "part", "line", "set", "cut", "hit", "man",
        "work", "side", "top", "not", "no", "did", "had", "has", "up", "so",
    }
    collisions = _HINGLISH_MARKERS & common_english
    assert not collisions, f"markers collide with English: {sorted(collisions)}"


def test_devanagari_and_bengali_scripts():
    assert detect_language("मिस्त्री ने पंप की मरम्मत बिना जांचे शुरू कर दी।")[0] is Language.HI
    assert detect_language("টেংকৰ ভিতৰত সোমোৱাৰ আগতে গেছ পৰীক্ষা কৰা হোৱা নাছিল।")[0] is Language.AS


def test_empty_and_unknown():
    assert detect_language("")[0] is Language.UNKNOWN
    assert detect_language("   ")[0] is Language.UNKNOWN
    assert detect_language("12345 -- ///")[0] is Language.UNKNOWN


def test_corpus_is_overwhelmingly_english():
    """Sweep the real corpus when it is present.

    data/ is gitignored, so this skips on a fresh clone rather than failing.
    The threshold is deliberately loose — it is a canary for a marker list that
    has started over-firing at scale, not an accuracy claim.
    """
    path = Path(__file__).resolve().parents[1] / "data" / "reports.csv"
    if not path.exists():
        pytest.skip("data/reports.csv not present (gitignored)")

    counts = {}
    with path.open() as f:
        for i, row in enumerate(csv.DictReader(f)):
            if i >= 3000:
                break
            lang, _ = detect_language(row.get("NARRATIVE", ""))
            counts[lang] = counts.get(lang, 0) + 1

    total = sum(counts.values())
    mixed = counts.get(Language.MIXED, 0)
    assert mixed / total < 0.02, (
        f"{mixed}/{total} English narratives flagged MIXED — "
        "a Hinglish marker is probably colliding with English"
    )
