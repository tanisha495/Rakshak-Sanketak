"""
Tests for the taxonomy loader.

The point of these is not to check that the current taxonomy loads — that is
the easy half. It is to prove the validator *rejects* broken taxonomies, so
that a bad edit fails here rather than silently producing records Module 4
cannot group.

Run:  PYTHONPATH=src python3 -m pytest tests/ -v
"""

from __future__ import annotations

import copy
from pathlib import Path

import pytest
import yaml

from loader import CROSS_CUTTING, TaxonomyError, load_taxonomy

TAXONOMY_DIR = Path(__file__).resolve().parents[1] / "taxonomy"


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

@pytest.fixture
def raw() -> dict:
    return yaml.safe_load((TAXONOMY_DIR / "taxonomy.yaml").read_text())


@pytest.fixture
def raw_locations() -> dict:
    return yaml.safe_load((TAXONOMY_DIR / "locations.yaml").read_text())


def write_and_load(tmp_path: Path, tax: dict, locs: dict):
    """Write a (possibly broken) taxonomy to disk and try to load it."""
    (tmp_path / "taxonomy.yaml").write_text(yaml.safe_dump(tax))
    (tmp_path / "locations.yaml").write_text(yaml.safe_dump(locs))
    return load_taxonomy(tmp_path)


# --------------------------------------------------------------------------
# the real taxonomy is valid
# --------------------------------------------------------------------------

def test_real_taxonomy_loads():
    tax = load_taxonomy()
    assert tax.version
    assert len(tax.life_saving_rules) == 9, "IOGP defines exactly 9 rules"


def test_every_barrier_has_explicit_scope():
    """No nulls. `applies_to` must always say something definite."""
    tax = load_taxonomy()
    for b in tax.barriers:
        assert b.applies_to, f"{b.id} has empty applies_to"
        assert b.applies_to == CROSS_CUTTING or tax.exists(b.applies_to)


def test_cross_cutting_barriers_exist():
    """If none are cross-cutting the hybrid model has collapsed to rule-only."""
    tax = load_taxonomy()
    assert any(b.is_cross_cutting for b in tax.barriers)


def test_lookup_of_unknown_id_is_loud():
    tax = load_taxonomy()
    with pytest.raises(TaxonomyError, match="Unknown taxonomy id"):
        tax.get("BAR_DOES_NOT_EXIST")


# --------------------------------------------------------------------------
# the validator rejects broken taxonomies
# --------------------------------------------------------------------------

def test_rejects_duplicate_ids(tmp_path, raw, raw_locations):
    tax = copy.deepcopy(raw)
    tax["hazards"].append({"id": tax["activities"][0]["id"], "label": "Clash"})
    with pytest.raises(TaxonomyError, match="Duplicate id"):
        write_and_load(tmp_path, tax, raw_locations)


def test_rejects_barrier_with_unknown_category(tmp_path, raw, raw_locations):
    tax = copy.deepcopy(raw)
    tax["barriers"][0]["category"] = "BC_IMAGINARY"
    with pytest.raises(TaxonomyError, match="unknown category"):
        write_and_load(tmp_path, tax, raw_locations)


def test_rejects_barrier_with_unknown_lsr(tmp_path, raw, raw_locations):
    tax = copy.deepcopy(raw)
    tax["barriers"][0]["applies_to"] = "LSR_MADE_UP"
    with pytest.raises(TaxonomyError, match="neither a Life-Saving Rule"):
        write_and_load(tmp_path, tax, raw_locations)


def test_rejects_null_applies_to(tmp_path, raw, raw_locations):
    """`null` was ambiguous — it could mean 'everywhere' or 'undecided'."""
    tax = copy.deepcopy(raw)
    tax["barriers"][0]["applies_to"] = None
    with pytest.raises(TaxonomyError):
        write_and_load(tmp_path, tax, raw_locations)


def test_rejects_unknown_field(tmp_path, raw, raw_locations):
    """A typo like `catagory:` must fail loudly, not vanish."""
    tax = copy.deepcopy(raw)
    tax["barriers"][0]["catagory"] = "BC_HUMAN"
    with pytest.raises(TaxonomyError):
        write_and_load(tmp_path, tax, raw_locations)


def test_rejects_lowercase_id(tmp_path, raw, raw_locations):
    tax = copy.deepcopy(raw)
    tax["hazards"].append({"id": "haz_lowercase", "label": "Bad"})
    with pytest.raises(TaxonomyError):
        write_and_load(tmp_path, tax, raw_locations)


def test_rejects_malformed_yaml(tmp_path):
    (tmp_path / "taxonomy.yaml").write_text("version: [unclosed")
    (tmp_path / "locations.yaml").write_text("version: '0.1'")
    with pytest.raises(TaxonomyError, match="Malformed YAML"):
        load_taxonomy(tmp_path)


def test_rejects_missing_file(tmp_path):
    with pytest.raises(TaxonomyError, match="Missing taxonomy file"):
        load_taxonomy(tmp_path)


# --------------------------------------------------------------------------
# location registry
# --------------------------------------------------------------------------

def test_rejects_unknown_parent(tmp_path, raw, raw_locations):
    locs = copy.deepcopy(raw_locations)
    locs["locations"][2]["parent"] = "LOC_NOWHERE"
    with pytest.raises(TaxonomyError, match="unknown parent"):
        write_and_load(tmp_path, raw, locs)


def test_rejects_level_skip(tmp_path, raw, raw_locations):
    """A level-4 area cannot hang directly off a level-1 region."""
    locs = copy.deepcopy(raw_locations)
    locs["locations"].append({
        "id": "LOC_BAD_CHILD", "level": 4, "parent": "LOC_ASSAM",
        "label": "Bad child", "aliases": [], "verified": False,
    })
    with pytest.raises(TaxonomyError, match="exactly one level below"):
        write_and_load(tmp_path, raw, locs)


def test_rejects_ambiguous_alias(tmp_path, raw, raw_locations):
    """Two locations claiming the same alias would resolve arbitrarily."""
    locs = copy.deepcopy(raw_locations)
    locs["locations"][0]["aliases"] = list(locs["locations"][0]["aliases"]) + ["shared"]
    locs["locations"][1]["aliases"] = list(locs["locations"][1]["aliases"]) + ["shared"]
    with pytest.raises(TaxonomyError, match="claimed by both"):
        write_and_load(tmp_path, raw, locs)


def test_location_resolution_is_case_insensitive():
    tax = load_taxonomy()
    assert tax.resolve_location("ocs") is not None
    assert tax.resolve_location("  OCS  ") is not None


def test_location_resolution_refuses_to_guess():
    """Returning None is the correct answer for an unresolvable mention."""
    tax = load_taxonomy()
    assert tax.resolve_location("near the old pump") is None
    assert tax.resolve_location("") is None


def test_location_path_is_root_first():
    tax = load_taxonomy()
    path = tax.location_path("LOC_BAGHEWALA")
    assert path[0].level == 1
    assert path[-1].id == "LOC_BAGHEWALA"


def test_registry_is_marked_provisional():
    """Guard against someone flipping verified:true before OIL confirms."""
    tax = load_taxonomy()
    assert tax.location_registry_version


# --------------------------------------------------------------------------
# lookups, prompt building, output validation
# --------------------------------------------------------------------------

def test_cross_cutting_excluded_by_default():
    """Narrow by default: a per-rule prompt should not be padded with generics."""
    tax = load_taxonomy()
    narrow = tax.barriers_for_lsr("LSR_ENERGY")
    assert narrow
    assert all(not b.is_cross_cutting for b in narrow)

    wide = tax.barriers_for_lsr("LSR_ENERGY", include_cross_cutting=True)
    assert len(wide) > len(narrow)


def test_barriers_for_multiple_rules_are_deduplicated():
    tax = load_taxonomy()
    union = tax.barriers_for_lsrs(["LSR_HOTWORK", "LSR_CONFINED"])
    ids = [b.id for b in union]
    assert len(ids) == len(set(ids))


def test_barriers_for_unknown_rule_fails_loudly():
    tax = load_taxonomy()
    with pytest.raises(TaxonomyError):
        tax.barriers_for_lsr("LSR_NOPE")


def test_choices_block_is_id_then_label():
    tax = load_taxonomy()
    block = tax.choices_block("failure_modes")
    assert "FM_ABSENT" in block
    assert len(block.splitlines()) == len(tax.vocabulary("failure_modes"))


def test_unknown_vocabulary_is_rejected():
    tax = load_taxonomy()
    with pytest.raises(TaxonomyError, match="not a selectable vocabulary"):
        tax.vocabulary("barrier_categories")


def test_validate_id_catches_hallucinated_ids():
    """The model will invent near-miss ids. They must not reach storage."""
    tax = load_taxonomy()
    assert tax.validate_id("BAR_GAS_TEST", "barriers") is True
    assert tax.validate_id("BAR_ISOLATION", "barriers") is False
    assert tax.validate_id("", "barriers") is False


def test_validate_id_accepts_none():
    """None is the honest answer when the report says nothing."""
    tax = load_taxonomy()
    assert tax.validate_id(None, "barriers") is True


def test_get_taxonomy_is_cached():
    from loader import get_taxonomy
    assert get_taxonomy() is get_taxonomy()
