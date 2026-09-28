"""
Typed models for the SIF taxonomy and location registry.

These mirror taxonomy/taxonomy.yaml and taxonomy/locations.yaml exactly. If the
YAML gains a field, add it here; if a model rejects a file, the file is wrong
until proven otherwise.

`extra="forbid"` everywhere is deliberate. A typo like `catagory:` should be a
loud failure at load time, not a silently missing attribute three modules
downstream.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# --------------------------------------------------------------------------
# Shared base
# --------------------------------------------------------------------------

class _Strict(BaseModel):
    """Reject unknown fields; forbid mutation after load."""
    model_config = ConfigDict(extra="forbid", frozen=True)


class _Term(_Strict):
    """Anything with a stable id and a human label."""
    id: str
    label: str
    deprecated: bool = False

    @field_validator("id")
    @classmethod
    def _id_is_upper_snake(cls, v: str) -> str:
        if not v or not all(c.isupper() or c.isdigit() or c == "_" for c in v):
            raise ValueError(
                f"id {v!r} must be UPPER_SNAKE_CASE — ids are permanent "
                f"identifiers, not labels"
            )
        return v


# --------------------------------------------------------------------------
# Sentinel for barrier scope
# --------------------------------------------------------------------------

CROSS_CUTTING = "CROSS_CUTTING"


# --------------------------------------------------------------------------
# Taxonomy terms
# --------------------------------------------------------------------------

class LifeSavingRule(_Term):
    rule_text: str


class FailureMode(_Term):
    definition: str


class BarrierCategory(_Term):
    note: Optional[str] = None


class Barrier(_Term):
    category: str                 # -> BarrierCategory.id
    applies_to: str               # -> LifeSavingRule.id | CROSS_CUTTING

    @property
    def is_cross_cutting(self) -> bool:
        return self.applies_to == CROSS_CUTTING


class Hazard(_Term):
    note: Optional[str] = None


class Activity(_Term):
    pass


class Exposure(_Term):
    pass


class Consequence(_Term):
    pass


class SeverityBand(_Term):
    pass


class ContextFlag(_Term):
    note: Optional[str] = None


class LocationLevel(_Term):
    level: int = Field(ge=1, le=4)
    example: Optional[str] = None


# --------------------------------------------------------------------------
# Location registry (open vocabulary — separate file, separate lifecycle)
# --------------------------------------------------------------------------

class Location(_Strict):
    id: str
    level: int = Field(ge=1, le=4)
    parent: Optional[str] = None      # -> Location.id, or None
    label: str
    aliases: list[str] = Field(default_factory=list)
    verified: bool = False

    @property
    def match_terms(self) -> list[str]:
        """Everything this location can be recognised by, lowercased."""
        return [t.lower() for t in ([self.label] + self.aliases)]


class LocationRegistry(_Strict):
    version: str
    status: str
    source: str
    locations: list[Location]


# --------------------------------------------------------------------------
# Root taxonomy document
# --------------------------------------------------------------------------

class TaxonomyDoc(_Strict):
    """Raw shape of taxonomy.yaml, before cross-reference validation."""
    version: str
    life_saving_rules: list[LifeSavingRule]
    failure_modes: list[FailureMode]
    barrier_categories: list[BarrierCategory]
    barriers: list[Barrier]
    hazards: list[Hazard]
    activities: list[Activity]
    exposures: list[Exposure]
    consequences: list[Consequence]
    severity_bands: list[SeverityBand]
    context_flags: list[ContextFlag]
    location_levels: list[LocationLevel]


class TaxonomyError(Exception):
    """Raised when the taxonomy is structurally invalid.

    This is always fatal. A half-valid taxonomy would produce records that
    other modules cannot group, which is worse than not starting.
    """
