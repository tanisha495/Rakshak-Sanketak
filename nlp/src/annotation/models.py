"""
The annotation record: one SIF fingerprint per report.

This is the unit that gets hand-labelled now and model-produced later. Both
must satisfy the same model, so the evaluation harness can compare them
directly without translation.

Field names here are the output contract shared with Modules 4, 5 and 6.
Changing a name breaks them; adding one does not.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ExtractionStatus(str, Enum):
    """How much of the fingerprint could be filled in.

    Reports we cannot extract from are still emitted, with nulls and
    status=FAILED. Dropping them would make a site with vague reporting look
    safer than a site with detailed reporting — survivorship bias pointed
    straight at the wrong intervention.
    """
    COMPLETE = "complete"   # every core field populated
    PARTIAL = "partial"     # some core fields null
    FAILED = "failed"       # nothing extractable beyond the raw text


class Language(str, Enum):
    EN = "en"
    HI = "hi"
    AS = "as"
    MIXED = "mixed"         # code-mixed, e.g. Hinglish
    UNKNOWN = "unknown"


class BarrierFailure(BaseModel):
    """One control that was absent, ineffective, or not complied with."""
    model_config = ConfigDict(extra="forbid")

    barrier: str                      # -> Barrier.id
    failure_mode: str                 # -> FailureMode.id
    primary: bool = False
    evidence_span: Optional[str] = None
    # For non-English reports: an English rendering of `evidence_span`.
    # `evidence_span` always stays in the reporter's own words — that is what
    # makes it verifiable against the source. The gloss is for the HSE officer
    # reading the dashboard, and is never used for validation.
    evidence_span_en: Optional[str] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class Fingerprint(BaseModel):
    """The structured form of one safety report.

    Every field except `report_id` may be null. Null means "the report does not
    say", which is a legitimate and useful answer — never a placeholder for a
    guess.
    """
    model_config = ConfigDict(extra="forbid")

    report_id: str
    language: Language = Language.UNKNOWN
    extraction_status: ExtractionStatus = ExtractionStatus.PARTIAL

    activity: Optional[str] = None                # ACT_*
    hazard: Optional[str] = None                  # HAZ_*
    exposure: Optional[str] = None                # EXP_*
    potential_consequence: Optional[str] = None   # CON_*
    severity_band: Optional[str] = None           # SEV_*

    life_saving_rules: List[str] = Field(default_factory=list)   # LSR_*
    context_flags: List[str] = Field(default_factory=list)       # CTX_*
    barrier_failures: List[BarrierFailure] = Field(default_factory=list)

    location_raw: Optional[str] = None
    location_l1: Optional[str] = None
    location_l2: Optional[str] = None
    location_l3: Optional[str] = None
    location_l4: Optional[str] = None

    # provenance
    annotator: Optional[str] = None      # human initials, or a model name
    annotated_at: Optional[datetime] = None
    notes: Optional[str] = None          # why a hard call was made

    @model_validator(mode="after")
    def _at_most_one_primary(self) -> "Fingerprint":
        primaries = [f for f in self.barrier_failures if f.primary]
        if len(primaries) > 1:
            raise ValueError(
                f"{self.report_id}: {len(primaries)} barrier failures marked "
                f"primary. Exactly one failure should be the main driver."
            )
        if self.barrier_failures and not primaries:
            raise ValueError(
                f"{self.report_id}: barrier failures present but none marked "
                f"primary. Module 4 ranks on the primary failure."
            )
        return self

    @model_validator(mode="after")
    def _no_duplicate_ids(self) -> "Fingerprint":
        for field in ("life_saving_rules", "context_flags"):
            values = getattr(self, field)
            if len(values) != len(set(values)):
                raise ValueError(f"{self.report_id}: duplicate ids in {field}")
        return self

    @model_validator(mode="after")
    def _location_levels_are_contiguous(self) -> "Fingerprint":
        """A level cannot be filled in if its parent level is null.

        Knowing the installation but not the field is not "more precise", it is
        incoherent — and it would break Module 4's roll-up queries.
        """
        levels = [self.location_l1, self.location_l2,
                  self.location_l3, self.location_l4]
        seen_gap = False
        for i, value in enumerate(levels, start=1):
            if value is None:
                seen_gap = True
            elif seen_gap:
                raise ValueError(
                    f"{self.report_id}: location_l{i} is set but a higher "
                    f"level is null. Fill levels top-down, stop when the "
                    f"report stops telling you."
                )
        return self

    @staticmethod
    def now() -> datetime:
        return datetime.now(timezone.utc)
