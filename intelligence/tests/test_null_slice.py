"""A null activity/hazard means "cannot slice", not "match everything".

    PYTHONPATH=. python3 intelligence/tests/test_null_slice.py

Before the fix, `if activity and ...` let an explicit None fall through as
"apply no filter". A report whose activity the NLP module could not extract
was therefore compared against the entire corpus and came back with more
drift than a fully-extracted report — the missing field made it look better
informed, which is exactly backwards.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from intelligence.barrier_drift.barrier_drift import (   # noqa: E402
    detect_barrier_drift,
    detect_barrier_drift_with_slice,
)

corpus = [
    {"report_id": "R1", "activity": "ACT_HOT_WORK", "hazard": "HAZ_THERMAL",
     "barrier_failures": [{"barrier": "BAR_FIRE_WATCH", "failure_mode": "FM_ABSENT"}]},
    {"report_id": "R2", "activity": "ACT_HOT_WORK", "hazard": "HAZ_THERMAL",
     "barrier_failures": [{"barrier": "BAR_FIRE_WATCH", "failure_mode": "FM_ABSENT"}]},
    {"report_id": "R3", "activity": "ACT_DRILLING", "hazard": "HAZ_MECHANICAL",
     "barrier_failures": [{"barrier": "BAR_PPE_GENERAL", "failure_mode": "FM_ABSENT"}]},
    {"report_id": "R4", "activity": "ACT_DRILLING", "hazard": "HAZ_MECHANICAL",
     "barrier_failures": [{"barrier": "BAR_PPE_GENERAL", "failure_mode": "FM_ABSENT"}]},
]

# Omitting a dimension still means "do not slice on it" — the whole corpus.
corpus_wide = detect_barrier_drift(corpus)
print("no slice requested   ->", len(corpus_wide), "pattern(s)")
assert len(corpus_wide) == 2

# Slicing on a stated value narrows correctly.
sliced, info = detect_barrier_drift_with_slice(
    corpus, activity="ACT_HOT_WORK", hazard="HAZ_THERMAL")
print("activity+hazard given->", len(sliced), "pattern(s), slice of",
      info["reports_in_slice"])
assert len(sliced) == 1
assert sliced[0]["barrier"] == "BAR_FIRE_WATCH"
assert info["sliceable"] and info["reports_in_slice"] == 2

# The bug: a null must NOT widen to the whole corpus.
null_activity, info = detect_barrier_drift_with_slice(
    corpus, activity=None, hazard="HAZ_THERMAL")
print("activity=None        ->", len(null_activity), "pattern(s),",
      "unsliceable_on:", info["unsliceable_on"])
assert null_activity == []
assert info["sliceable"] is False
assert info["unsliceable_on"] == ["activity"]

both_null, info = detect_barrier_drift_with_slice(
    corpus, activity=None, hazard=None)
print("both None            ->", len(both_null), "pattern(s),",
      "unsliceable_on:", info["unsliceable_on"])
assert both_null == []
assert info["unsliceable_on"] == ["activity", "hazard"]

# An unextracted report must never out-inform a fully-extracted one.
assert len(both_null) < len(corpus_wide)

# End to end through the engine, where the caller reads the reason.
from intelligence.intelligence_engine import analyze_report   # noqa: E402

result = analyze_report(
    {"report_id": "NEW", "activity": None, "hazard": "HAZ_THERMAL",
     "barrier_failures": []},
    [],
    db=None,
    source="intelligence/data/historical_reports.json",
)
print("analyze_report       ->", result["barrier_drift"],
      result["barrier_drift_slice"]["unsliceable_on"])
assert result["barrier_drift"] == []
assert result["barrier_drift_slice"]["sliceable"] is False

print("\nnull-slice OK — a null narrows to nothing and says why")
