"""
Turn a free-text safety report into a validated SIF Fingerprint.

The model is not trusted. Everything it returns passes through
`_coerce`, which drops any id that is not in the taxonomy and any evidence
span that is not genuinely present in the narrative. A model that invents
`BAR_ISOLATION` instead of `BAR_ISOLATION_VERIFIED` produces a null, not a
corrupt record — because a wrong barrier silently poisons Module 4's pattern
mining in a way nobody would notice until it mattered.
"""

from __future__ import annotations

import difflib
from typing import Any, Dict, List, Optional

from annotation import BarrierFailure, ExtractionStatus, Fingerprint, Language
from loader import Taxonomy, get_taxonomy

from .language import detect_language
from .llm import LLMBackend, LLMError, get_backend

SYSTEM = """You are a process-safety analyst working with IOGP Life-Saving Rules.

You read a single incident or near-miss narrative and return structured safety
information as JSON. You never invent detail. If the narrative does not state
something, the value is null.

Two rules matter above all others:

1. EVIDENCE MUST BE VERBATIM. Every evidence_span you return must be copied
   character-for-character from the narrative. Never paraphrase, never
   summarise, never fix spelling or grammar — some narratives are in capitals
   or contain typos and you must reproduce them exactly.

   Keep the span tight — the few words that show the control failed, not the
   whole sentence. "without confirming isolation" is evidence; the entire
   narrative is not. If the span is more than about a dozen words, you have
   quoted too much.

   This holds in every language. If the report is in Hindi, Assamese, or a
   mixture of a language and English, evidence_span stays in the reporter's own
   words and script. Do not translate it. Put your English rendering in
   evidence_span_en instead, so the officer reading the dashboard understands
   it while the original remains checkable against the source.

2. POTENTIAL, NOT ACTUAL. potential_consequence is the worst credible outcome
   had the situation continued or gone slightly differently. It is NOT the
   injury that occurred. A worker who escaped with a bruise from being caught
   between two vehicles still has a fatal potential consequence. This
   distinction is the entire purpose of the analysis.

CHOOSING THE FAILURE MODE. This is the part most often got wrong, so read it
carefully. Ask what state the control was in:

  FM_ABSENT        The control was never there for this task. Nobody had put a
                   guard on, no permit existed, no ventilation was provided.
  FM_INEFFECTIVE   The control existed but could not do its job. Housekeeping
                   was being done but the floor was still wet. A ladder was
                   footed but still slipped. A barricade was up but a vehicle
                   drove through it. PPE was worn but was the wrong kind.
  FM_NOT_COMPLIED  The control existed and would have worked, but a person
                   skipped, bypassed or ignored it. Isolation was available and
                   not verified. A seatbelt was fitted and not worn.

Decide this per report. There is no usual answer — all three occur often, and
answering the same way every time is a sign of not reading the narrative.
A quick test: was the control there? If no, ABSENT. If yes but it did not
hold, INEFFECTIVE. If yes and someone went around it, NOT_COMPLIED.

Worked examples, all real:
  "slipped on water on the tile floor"      housekeeping existed, floor still
                                            wet -> BAR_HOUSEKEEPING/INEFFECTIVE
  "the ladder kicked out from underneath"   ladder in use, not holding
                                            -> BAR_LADDER_SECURED/INEFFECTIVE
  "a truck entered the closed work area"    zone existed, breached
                                            -> BAR_EXCLUSION_ZONE/INEFFECTIVE
  "was not wearing a seat belt"             fitted, unused
                                            -> BAR_SEATBELT/NOT_COMPLIED
  "The system was not locked out"           never applied
                                            -> BAR_LOCKOUT_TAGOUT/ABSENT

CHOOSING THE BARRIER. Name the control most specific to what went wrong. If the
narrative points at a particular control — an isolation, a permit, a guard, a
gas test, ventilation, housekeeping, communication between two people, a load
left unsecured — use that one.

BAR_POSITIONING is a last resort, not a default. Use it only when where the
person was standing is itself the failure and no more specific control is
named. Never use it alongside a more specific barrier.

Nearly every industrial incident has a control that should have stopped it, so
work at finding it before giving up. Ask: what would a safety officer say
should have been in place here? A guard, an isolation, a permit, a gas test,
ventilation, housekeeping, a lift plan, a barricade, a handover between two
people, a load restrained, fall protection, competence for the task.

Return an empty list only when the event is genuinely outside industrial
control — an insect sting, an assault by another person, an over-exertion
strain, or a trip with no stated cause. Those are rare. An empty list on an
ordinary equipment or maintenance incident means you have not looked hard
enough.

FALLS. CON_FATAL_FALL is for a fall from height that could kill. A slip, a
trip, or a step down from a tailgate or low platform is CON_FALL_SAME_LEVEL,
and it does not breach the Working at Height rule."""


def build_prompt(narrative: str, tax: Taxonomy) -> str:
    """Compose the extraction prompt from the taxonomy.

    Choices are rendered from the taxonomy rather than hardcoded, so adding a
    barrier to the YAML immediately makes it available to the model. No prompt
    edit, no drift between file and prompt.
    """
    return f"""Analyse this safety report.

NARRATIVE:
\"\"\"{narrative}\"\"\"

Return JSON with exactly these keys:

{{
  "activity": "<id or null>",
  "hazard": "<id or null>",
  "exposure": "<id or null>",
  "potential_consequence": "<id or null>",
  "life_saving_rules": ["<id>", ...],
  "context_flags": ["<id>", ...],
  "barrier_failures": [
    {{"barrier": "<id>", "failure_mode": "<id>", "primary": true,
      "evidence_span": "<verbatim quote, in the narrative's own language>",
      "evidence_span_en": "<English rendering; null if already English>"}}
  ]
}}

Choose ONLY from the ids below. If nothing fits, use null (or an empty list).
Only fill a field the narrative actually supports. If it never says what the
worker was doing, activity is null. If it never shows how they were in contact
with the hazard, exposure is null. Guessing is worse than leaving it null.
Exactly one barrier failure must have "primary": true. If the narrative names
no failed control, return an empty barrier_failures list — do not invent one.

ACTIVITY:
{tax.choices_block("activities")}

HAZARD (the energy source that could cause harm):
{tax.choices_block("hazards")}

EXPOSURE (how the person was in contact with it):
{tax.choices_block("exposures")}

POTENTIAL CONSEQUENCE (worst credible outcome, not the actual injury):
{tax.choices_block("consequences")}

LIFE-SAVING RULES (zero, one, or several):
{tax.choices_block("life_saving_rules")}

CONTEXT FLAGS (only if clearly stated):
{tax.choices_block("context_flags")}

BARRIERS (the control that should have prevented this):
{tax.choices_block("barriers")}

FAILURE MODES:
{tax.choices_block("failure_modes")}
"""


def _recover_span(span: str, narrative: str) -> Optional[str]:
    """Try to rescue a near-miss evidence span.

    Models often return a span that is almost verbatim — a changed case, a
    trimmed word, a normalised space. Rather than discard useful evidence, we
    look for the closest genuine substring. If nothing close exists, the span
    was invented and we return None.
    """
    if not span:
        return None
    if span in narrative:
        return span

    lower_n, lower_s = narrative.lower(), span.lower()
    idx = lower_n.find(lower_s)
    if idx != -1:
        return narrative[idx:idx + len(span)]

    # Slide a window the length of the claimed span and take the best match.
    words = narrative.split()
    target_len = max(1, len(span.split()))
    best, best_score = None, 0.0
    for i in range(len(words) - target_len + 1):
        candidate = " ".join(words[i:i + target_len])
        score = difflib.SequenceMatcher(None, candidate.lower(), lower_s).ratio()
        if score > best_score:
            best, best_score = candidate, score
    return best if best_score >= 0.85 else None


def _coerce(raw: Dict[str, Any], report_id: str, narrative: str,
            tax: Taxonomy, language: Language = Language.EN
            ) -> tuple[Fingerprint, List[str]]:
    """Turn raw model output into a valid Fingerprint, discarding what is wrong.

    Returns the fingerprint plus a list of what had to be dropped, so a run can
    be audited rather than silently cleaned.
    """
    dropped: List[str] = []

    def single(field: str, vocab: str) -> Optional[str]:
        value = raw.get(field)
        if value in (None, "", "null"):
            return None
        if tax.validate_id(value, vocab):
            return value
        dropped.append(f"{field}={value}")
        return None

    def multi(field: str, vocab: str) -> List[str]:
        out, seen = [], set()
        for value in raw.get(field) or []:
            if tax.validate_id(value, vocab) and value not in seen:
                seen.add(value)
                out.append(value)
            elif value not in seen:
                dropped.append(f"{field}={value}")
        return out

    failures: List[BarrierFailure] = []
    for bf in raw.get("barrier_failures") or []:
        if not isinstance(bf, dict):
            continue
        barrier, mode = bf.get("barrier"), bf.get("failure_mode")
        if not tax.validate_id(barrier, "barriers") or barrier is None:
            dropped.append(f"barrier={barrier}")
            continue
        if not tax.validate_id(mode, "failure_modes") or mode is None:
            dropped.append(f"failure_mode={mode}")
            continue
        span = _recover_span(bf.get("evidence_span") or "", narrative)
        if bf.get("evidence_span") and span is None:
            dropped.append(f"evidence_span={bf['evidence_span'][:40]!r}")
        # A gloss with no verified span behind it explains nothing, so it is
        # discarded with the span it belonged to.
        gloss = bf.get("evidence_span_en") if span else None
        if gloss and gloss.strip() == (span or "").strip():
            gloss = None      # English report; the gloss is just a duplicate
        failures.append(BarrierFailure(
            barrier=barrier, failure_mode=mode,
            primary=bool(bf.get("primary")), evidence_span=span,
            evidence_span_en=gloss,
        ))

    # Exactly one primary. The model is inconsistent about this; we fix it
    # rather than reject an otherwise good extraction.
    if failures:
        primaries = [f for f in failures if f.primary]
        if len(primaries) != 1:
            failures = [f.model_copy(update={"primary": i == 0})
                        for i, f in enumerate(failures)]

    core = {
        "activity": single("activity", "activities"),
        "hazard": single("hazard", "hazards"),
        "exposure": single("exposure", "exposures"),
        "potential_consequence": single("potential_consequence", "consequences"),
    }

    if not failures and not any(core.values()):
        status = ExtractionStatus.FAILED
    elif failures and all(core.values()):
        status = ExtractionStatus.COMPLETE
    else:
        status = ExtractionStatus.PARTIAL

    fp = Fingerprint(
        report_id=report_id,
        language=language,
        extraction_status=status,
        life_saving_rules=multi("life_saving_rules", "life_saving_rules"),
        context_flags=multi("context_flags", "context_flags"),
        barrier_failures=failures,
        annotator="model",
        annotated_at=Fingerprint.now(),
        notes=("dropped: " + "; ".join(dropped)) if dropped else None,
        **core,
    )
    return fp, dropped


class Extractor:
    """Extracts SIF fingerprints. Reuse one instance across a run."""

    def __init__(self, backend: Optional[LLMBackend] = None,
                 taxonomy: Optional[Taxonomy] = None):
        self.backend = backend or get_backend()
        self.tax = taxonomy or get_taxonomy()

    def extract(self, report_id: str, narrative: str) -> Fingerprint:
        narrative = " ".join(str(narrative).split())
        language, _ = detect_language(narrative)
        try:
            raw = self.backend.complete_json_retrying(
                build_prompt(narrative, self.tax), system=SYSTEM
            )
        except LLMError as e:
            # A provider failure is not an empty fingerprint — record it as
            # failed so the row is visible rather than quietly absent.
            return Fingerprint(
                report_id=report_id,
                extraction_status=ExtractionStatus.FAILED,
                annotator="model", annotated_at=Fingerprint.now(),
                notes=f"extraction error: {e}",
            )
        fp, _ = _coerce(raw, report_id, narrative, self.tax, language)
        return fp
