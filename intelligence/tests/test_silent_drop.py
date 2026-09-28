"""Audit finding F5: a vector match missing from the corpus must not vanish.

    PYTHONPATH=. python3 intelligence/tests/test_silent_drop.py

The scenario: vector search returns a 0.99 match, but that report_id is not
in the historical corpus that was loaded. Before the fix, `find_precedents`
skipped it with a bare `continue` and returned []. An empty list is how the
engine also says "nothing resembles this report" — so the most similar
precedent on record and a genuinely novel event produced identical output.

The DB-backed dependencies are stubbed here; this exercises the drop
accounting, not pgvector.
"""

import json
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

# sqlalchemy / sentence-transformers are the API container's dependencies.
# vector_search is replaced below, so stand in for its imports.
for _name, _attrs in [
    ("app.services.embedding", {"generate_embedding": lambda report: [0.0]}),
    ("app.services.intelligence_data", {
        "vector_search_db": lambda *a, **k: [],
        "load_historical_reports_from_db": lambda db: [],
    }),
]:
    _mod = types.ModuleType(_name)
    _mod.__dict__.update(_attrs)
    sys.modules.setdefault(_name, _mod)

import intelligence.precedent.precedent_engine as precedent_engine  # noqa: E402
from intelligence.data.report_repository import (                   # noqa: E402
    load_historical_reports_with_stats,
)

new_report = {
    "report_id": "NEW001",
    "hazard": "HAZ_MOTION",
    "exposure": "EXP_LINE_OF_FIRE",
    "life_saving_rules": ["LSR_LINEOFFIRE"],
    "barrier_failures": [
        {"barrier": "BAR_POSITIONING", "failure_mode": "FM_NOT_COMPLIED"}
    ],
}

corpus, stats = load_historical_reports_with_stats()
known_id = corpus[0]["report_id"]


def stub_vector_search(results):
    precedent_engine.vector_search = (
        lambda new_report, db=None, exclude_report_id=None, top_k=10: results
    )


print(f"corpus: {stats['loaded']} reports from {stats['source']}")
print(f"        {stats['unusable']} skipped (extraction_status=failed)\n")

# 1. A ghost match is counted and reported, not dropped in silence.
stub_vector_search([
    {"report_id": "GHOST_1", "similarity": 0.99},
    {"report_id": known_id, "similarity": 0.80},
])
mixed = precedent_engine.find_precedents(new_report, corpus, db=object())
print("mixed      ->", len(mixed), "match(es), dropped:", mixed.dropped_report_ids)
assert mixed.dropped_count == 1
assert mixed.dropped_report_ids == ["GHOST_1"]

# 2. "Dropped everything" is distinguishable from "found nothing" — the
#    whole point of the finding. Both return an empty list; only the count
#    tells them apart.
stub_vector_search([{"report_id": "GHOST_2", "similarity": 0.97}])
dropped_all = precedent_engine.find_precedents(new_report, corpus, db=object())

stub_vector_search([])
found_none = precedent_engine.find_precedents(new_report, corpus, db=object())

print("dropped all->", len(dropped_all), "match(es), dropped:", dropped_all.dropped_count)
print("found none ->", len(found_none), "match(es), dropped:", found_none.dropped_count)
assert len(dropped_all) == 0 and dropped_all.dropped_count == 1
assert len(found_none) == 0 and found_none.dropped_count == 0
assert list(dropped_all) == list(found_none)   # identical before the fix

# 3. The count survives into the engine's output, where callers read it.
stub_vector_search([{"report_id": "GHOST_3", "similarity": 0.95}])
from intelligence.intelligence_engine import analyze_report   # noqa: E402
result = analyze_report(new_report, [], db=object())
print("\nanalyze_report ->", json.dumps(
    {k: result[k] for k in
     ("precedents", "precedents_dropped", "precedents_dropped_report_ids")}))
assert result["precedents"] == []
assert result["precedents_dropped"] == 1

print("\nF5 OK — dropped matches are counted, logged and returned")
