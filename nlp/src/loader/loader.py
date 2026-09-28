"""
Load and validate the SIF taxonomy.

Usage
-----
    from loader import load_taxonomy

    tax = load_taxonomy()
    tax.barrier("BAR_GAS_TEST").label
    tax.barriers_for_lsr("LSR_ENERGY")
    tax.resolve_location("OCS")

Everything is validated at load time. If this module imports cleanly, the
taxonomy is internally consistent — downstream code does not need to
defensively check whether an id exists.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional, Sequence

import yaml
from pydantic import ValidationError

from .models import (
    CROSS_CUTTING,
    Barrier,
    Location,
    LocationRegistry,
    TaxonomyDoc,
    TaxonomyError,
)

# Resolved relative to this file, never to the working directory. This is what
# lets the module work unchanged inside a container or when imported from
# another module's directory.
_DEFAULT_TAXONOMY_DIR = Path(__file__).resolve().parents[2] / "taxonomy"


class Taxonomy:
    """A validated taxonomy with lookup helpers.

    Construct via `load_taxonomy()` rather than directly.
    """

    def __init__(self, doc: TaxonomyDoc, registry: LocationRegistry) -> None:
        self._doc = doc
        self._registry = registry

        # Index every vocabulary by id for O(1) lookup.
        self._index: dict[str, object] = {}
        for field in (
            "life_saving_rules", "failure_modes", "barrier_categories",
            "barriers", "hazards", "activities", "exposures",
            "consequences", "severity_bands", "context_flags",
            "location_levels",
        ):
            for term in getattr(doc, field):
                self._index[term.id] = term

        self._locations: dict[str, Location] = {
            loc.id: loc for loc in registry.locations
        }

        # Alias -> location id, built once. Later duplicates lose; the
        # validator has already rejected genuine collisions.
        self._alias_map: dict[str, str] = {}
        for loc in registry.locations:
            for term in loc.match_terms:
                self._alias_map.setdefault(term, loc.id)

    # -- version -----------------------------------------------------------

    @property
    def version(self) -> str:
        return self._doc.version

    @property
    def location_registry_version(self) -> str:
        return self._registry.version

    # -- generic lookup ----------------------------------------------------

    def get(self, term_id: str):
        """Look up any taxonomy term by id. Raises if unknown."""
        try:
            return self._index[term_id]
        except KeyError:
            raise TaxonomyError(
                f"Unknown taxonomy id: {term_id!r}. Ids are permanent — if this "
                f"was renamed, restore the original and deprecate it instead."
            ) from None

    def exists(self, term_id: str) -> bool:
        return term_id in self._index

    # -- typed accessors ---------------------------------------------------

    @property
    def life_saving_rules(self):
        return self._doc.life_saving_rules

    @property
    def barriers(self) -> Sequence[Barrier]:
        return self._doc.barriers

    @property
    def failure_modes(self):
        return self._doc.failure_modes

    @property
    def hazards(self):
        return self._doc.hazards

    @property
    def activities(self):
        return self._doc.activities

    @property
    def exposures(self):
        return self._doc.exposures

    @property
    def consequences(self):
        return self._doc.consequences

    @property
    def context_flags(self):
        return self._doc.context_flags

    def barrier(self, barrier_id: str) -> Barrier:
        term = self.get(barrier_id)
        if not isinstance(term, Barrier):
            raise TaxonomyError(f"{barrier_id!r} is not a barrier")
        return term

    def barriers_for_lsr(self, lsr_id: str, include_cross_cutting: bool = False
                         ) -> list[Barrier]:
        """Barriers specific to one Life-Saving Rule.

        Cross-cutting barriers are EXCLUDED by default. When this list is used
        to build an extraction prompt, padding four relevant barriers with seven
        generic ones makes the model likelier to reach for "competence" when it
        should pick "isolation verified". Ask for breadth explicitly.
        """
        self.get(lsr_id)  # fail loudly on a bad rule id
        out = [b for b in self.barriers if b.applies_to == lsr_id]
        if include_cross_cutting:
            out += self.cross_cutting_barriers()
        return out

    def barriers_for_lsrs(self, lsr_ids: Sequence[str],
                          include_cross_cutting: bool = False) -> list[Barrier]:
        """Union of barriers across several rules, de-duplicated, order kept.

        A report can breach more than one rule (hot work inside a vessel
        without a permit touches three), so the extractor needs the union.
        """
        seen: set[str] = set()
        out: list[Barrier] = []
        for lsr_id in lsr_ids:
            for b in self.barriers_for_lsr(lsr_id):
                if b.id not in seen:
                    seen.add(b.id)
                    out.append(b)
        if include_cross_cutting:
            for b in self.cross_cutting_barriers():
                if b.id not in seen:
                    seen.add(b.id)
                    out.append(b)
        return out

    def cross_cutting_barriers(self) -> list[Barrier]:
        """Barriers that apply regardless of Life-Saving Rule."""
        return [b for b in self.barriers if b.is_cross_cutting]

    # -- prompt construction ----------------------------------------------

    # Vocabularies an extractor may be asked to choose from.
    _VOCABULARIES = {
        "life_saving_rules", "failure_modes", "barriers", "hazards",
        "activities", "exposures", "consequences", "severity_bands",
        "context_flags",
    }

    def vocabulary(self, name: str) -> list:
        """All live terms in a named vocabulary. Deprecated terms are omitted —
        they exist so old records still resolve, not so new ones can use them.
        """
        if name not in self._VOCABULARIES:
            raise TaxonomyError(
                f"{name!r} is not a selectable vocabulary. "
                f"Expected one of: {sorted(self._VOCABULARIES)}"
            )
        return [t for t in getattr(self._doc, name) if not t.deprecated]

    def choices_block(self, name: str, terms: Optional[Sequence] = None) -> str:
        """Render a vocabulary as `ID — label` lines for an LLM prompt.

        Pass `terms` to render a narrowed subset (e.g. barriers for the rules
        already tagged) rather than the whole vocabulary.
        """
        items = terms if terms is not None else self.vocabulary(name)
        return "\n".join(f"{t.id} — {t.label}" for t in items)

    # -- output validation -------------------------------------------------

    def validate_id(self, term_id: Optional[str], name: str) -> bool:
        """Is `term_id` a real member of vocabulary `name`?

        Returns a bool rather than raising, because the caller is checking
        model output, not a programming error. An LLM returning
        `BAR_ISOLATION` instead of `BAR_ISOLATION_VERIFIED` is expected
        behaviour to be caught here and turned into a null — never written
        through to storage.

        `None` is valid: it is the honest answer when the report says nothing.
        """
        if term_id is None:
            return True
        return any(t.id == term_id for t in self.vocabulary(name))

    # -- locations ---------------------------------------------------------

    def location(self, loc_id: str) -> Location:
        try:
            return self._locations[loc_id]
        except KeyError:
            raise TaxonomyError(f"Unknown location id: {loc_id!r}") from None

    def resolve_location(self, text: str) -> Optional[Location]:
        """Exact (case-insensitive) match of a location mention.

        Deliberately strict: returns None rather than guessing. Fuzzy matching
        belongs in the extractor, where a confidence score can travel with the
        result. A wrong location silently corrupts Module 4's site ranking.
        """
        if not text:
            return None
        loc_id = self._alias_map.get(text.strip().lower())
        return self._locations[loc_id] if loc_id else None

    def location_path(self, loc_id: str) -> list[Location]:
        """Walk from a location up to its root: [region, field, ...]."""
        chain: list[Location] = []
        seen: set[str] = set()
        current: Optional[str] = loc_id
        while current:
            if current in seen:      # cycle — validator should have caught it
                raise TaxonomyError(f"Cycle in location parents at {current!r}")
            seen.add(current)
            loc = self.location(current)
            chain.append(loc)
            current = loc.parent
        return list(reversed(chain))

    def __repr__(self) -> str:
        return (
            f"<Taxonomy v{self.version} "
            f"{len(self._index)} terms, {len(self._locations)} locations>"
        )


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------

def _validate(doc: TaxonomyDoc, registry: LocationRegistry) -> None:
    """Cross-reference checks Pydantic cannot express on its own.

    Collects every problem before raising, so a broken file is fixed in one
    pass rather than one error at a time.
    """
    errors: list[str] = []

    # 1. No duplicate ids anywhere in the taxonomy.
    seen: dict[str, str] = {}
    for field in (
        "life_saving_rules", "failure_modes", "barrier_categories", "barriers",
        "hazards", "activities", "exposures", "consequences",
        "severity_bands", "context_flags", "location_levels",
    ):
        for term in getattr(doc, field):
            if term.id in seen:
                errors.append(
                    f"Duplicate id {term.id!r} in '{field}' "
                    f"(already defined in '{seen[term.id]}')"
                )
            seen[term.id] = field

    lsr_ids = {r.id for r in doc.life_saving_rules}
    cat_ids = {c.id for c in doc.barrier_categories}

    # 2. Every barrier points at a real category and a real scope.
    for b in doc.barriers:
        if b.category not in cat_ids:
            errors.append(
                f"Barrier {b.id!r} has unknown category {b.category!r}"
            )
        if b.applies_to != CROSS_CUTTING and b.applies_to not in lsr_ids:
            errors.append(
                f"Barrier {b.id!r} has applies_to {b.applies_to!r}, which is "
                f"neither a Life-Saving Rule id nor {CROSS_CUTTING!r}"
            )

    # 3. Location levels are 1..4 with no gaps or repeats.
    levels = sorted(l.level for l in doc.location_levels)
    if levels != list(range(1, len(levels) + 1)):
        errors.append(f"location_levels must be 1..N with no gaps, got {levels}")

    # --- location registry ---

    loc_ids = {l.id for l in registry.locations}
    if len(loc_ids) != len(registry.locations):
        errors.append("Duplicate ids in the location registry")

    for loc in registry.locations:
        if loc.parent is None:
            continue
        if loc.parent not in loc_ids:
            errors.append(
                f"Location {loc.id!r} has unknown parent {loc.parent!r}"
            )
            continue
        parent = next(l for l in registry.locations if l.id == loc.parent)
        if loc.level != parent.level + 1:
            errors.append(
                f"Location {loc.id!r} is level {loc.level} but its parent "
                f"{parent.id!r} is level {parent.level} — a child must sit "
                f"exactly one level below its parent"
            )

    # 4. An alias must not point at two different locations.
    alias_owner: dict[str, str] = {}
    for loc in registry.locations:
        for term in loc.match_terms:
            if term in alias_owner and alias_owner[term] != loc.id:
                errors.append(
                    f"Alias {term!r} is claimed by both {alias_owner[term]!r} "
                    f"and {loc.id!r} — resolution would be arbitrary"
                )
            alias_owner[term] = loc.id

    if errors:
        raise TaxonomyError(
            "Taxonomy failed validation:\n  - " + "\n  - ".join(errors)
        )


# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

@lru_cache(maxsize=None)
def _load_cached(base: Path) -> Taxonomy:
    return _load_uncached(base)


def get_taxonomy(taxonomy_dir: Optional[Path] = None) -> Taxonomy:
    """The shared taxonomy instance. Use this in application code.

    Parsing and validating two YAML files per report would be wasteful, and the
    taxonomy is immutable, so one instance is safe to share. Tests that need a
    deliberately broken taxonomy should call `load_taxonomy()` instead, which
    bypasses the cache.
    """
    base = Path(taxonomy_dir) if taxonomy_dir else _DEFAULT_TAXONOMY_DIR
    return _load_cached(base.resolve())


def load_taxonomy(taxonomy_dir: Optional[Path] = None) -> Taxonomy:
    """Load, parse and validate the taxonomy, bypassing the cache.

    Prefer `get_taxonomy()` in application code. Use this when you need a fresh
    parse — chiefly tests that write a modified taxonomy to a temp directory.

    Args:
        taxonomy_dir: directory holding taxonomy.yaml and locations.yaml.
            Defaults to the repo's `taxonomy/`, resolved relative to this file.
    """
    base = Path(taxonomy_dir) if taxonomy_dir else _DEFAULT_TAXONOMY_DIR
    tax_path = base / "taxonomy.yaml"
    loc_path = base / "locations.yaml"

    for p in (tax_path, loc_path):
        if not p.exists():
            raise TaxonomyError(f"Missing taxonomy file: {p}")

    try:
        raw_tax = yaml.safe_load(tax_path.read_text(encoding="utf-8"))
        raw_loc = yaml.safe_load(loc_path.read_text(encoding="utf-8"))
    except yaml.YAMLError as e:
        raise TaxonomyError(f"Malformed YAML: {e}") from e

    try:
        doc = TaxonomyDoc(**raw_tax)
        registry = LocationRegistry(**raw_loc)
    except ValidationError as e:
        raise TaxonomyError(f"Taxonomy does not match the expected shape:\n{e}") from e

    _validate(doc, registry)
    return Taxonomy(doc, registry)


def _load_uncached(base: Path) -> Taxonomy:
    return load_taxonomy(base)
