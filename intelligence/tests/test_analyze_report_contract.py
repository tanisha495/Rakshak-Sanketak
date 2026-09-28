"""Contract tests for `analyze_report` as the backend actually calls it.

Every other test in this directory either calls `analyze_report` with bare
positional arguments or prints its output without asserting on it. Neither
catches the failure this file exists for: the signature is

    analyze_report(new_report, recent_reports, db=None, source=None)

so a third positional argument silently binds to `db`, the function takes the
Postgres branch, and a plain list is handed to a loader expecting a Session.
That shipped once already. These tests call it the way `intelligence/api.py`
does -- keyword arguments past the second -- and assert on the drift content,
not merely that nothing raised.

Run:  python3 -m pytest intelligence/tests/test_analyze_report_contract.py
"""

from __future__ import annotations

import inspect
import json

import pytest

from intelligence.intelligence_engine import analyze_report


NEW_REPORT = {
    "report_id": "NEW001",
    "activity": "ACT_MECH_MAINTENANCE",
    "hazard": "HAZ_MECHANICAL",
    "life_saving_rules": ["LSR_ENERGY"],
    "barrier_failures": [
        {"barrier": "BAR_ISOLATION_VERIFIED", "failure_mode": "FM_NOT_COMPLIED"}
    ],
}


def _corpus_report(report_id, barrier, failure_mode, activity, hazard):
    return {
        "report_id": report_id,
        "activity": activity,
        "hazard": hazard,
        "barrier_failures": [{"barrier": barrier, "failure_mode": failure_mode}],
    }


# Three isolation failures inside the maintenance/mechanical slice, so drift
# must report it at threshold 2. The two hot-work rows share a barrier pair
# with each other but sit outside the slice, so a correct slice excludes them
# -- if they show up, the filtering is not being applied.
HISTORICAL = [
    _corpus_report("H1", "BAR_ISOLATION_VERIFIED", "FM_NOT_COMPLIED",
                   "ACT_MECH_MAINTENANCE", "HAZ_MECHANICAL"),
    _corpus_report("H2", "BAR_ISOLATION_VERIFIED", "FM_NOT_COMPLIED",
                   "ACT_MECH_MAINTENANCE", "HAZ_MECHANICAL"),
    _corpus_report("H3", "BAR_ISOLATION_VERIFIED", "FM_NOT_COMPLIED",
                   "ACT_MECH_MAINTENANCE", "HAZ_MECHANICAL"),
    _corpus_report("H4", "BAR_LOCKOUT_TAGOUT", "FM_ABSENT",
                   "ACT_MECH_MAINTENANCE", "HAZ_MECHANICAL"),
    _corpus_report("H5", "BAR_FIRE_WATCH", "FM_ABSENT",
                   "ACT_HOT_WORK", "HAZ_THERMAL"),
    _corpus_report("H6", "BAR_FIRE_WATCH", "FM_ABSENT",
                   "ACT_HOT_WORK", "HAZ_THERMAL"),
]

RECENT = [
    _corpus_report("R1", "BAR_ISOLATION_VERIFIED", "FM_NOT_COMPLIED",
                   "ACT_MECH_MAINTENANCE", "HAZ_MECHANICAL"),
]


@pytest.fixture
def corpus_path(tmp_path):
    """The corpus as a file, because that is the only injection point.

    `analyze_report` takes its history from Postgres or from `source`; there
    is no parameter for passing a list directly. Writing the fixture to disk
    keeps the test honest about which corpus is being measured instead of
    silently falling back to the default 500-report file.
    """
    path = tmp_path / "historical_reports.json"
    path.write_text(json.dumps(HISTORICAL), encoding="utf-8")
    return path


def _analyze(corpus_path):
    """Call it exactly as `intelligence/api.py` does: keywords past the second."""
    return analyze_report(
        NEW_REPORT,
        RECENT,
        db=None,
        source=str(corpus_path),
    )


def test_third_positional_parameter_is_db():
    """Pin the hazard this file exists for.

    If someone reorders the signature so the third slot stops being `db`, the
    positional call in an old test becomes a different bug and this says so.
    """
    params = list(inspect.signature(analyze_report).parameters)
    assert params[:4] == ["new_report", "recent_reports", "db", "source"]


def test_drift_reports_the_repeated_pair_in_the_slice(corpus_path):
    result = _analyze(corpus_path)
    drift = result["barrier_drift"]

    pairs = {(d["barrier"], d["failure_mode"]): d for d in drift}
    assert ("BAR_ISOLATION_VERIFIED", "FM_NOT_COMPLIED") in pairs

    repeated = pairs[("BAR_ISOLATION_VERIFIED", "FM_NOT_COMPLIED")]
    assert repeated["occurrences"] == 3
    assert repeated["risk_status"] == "REPEATED"


def test_drift_excludes_pairs_outside_the_slice(corpus_path):
    """BAR_FIRE_WATCH repeats twice, but only in the hot-work slice."""
    drift = _analyze(corpus_path)["barrier_drift"]
    barriers = {d["barrier"] for d in drift}

    assert "BAR_FIRE_WATCH" not in barriers
    # Single occurrence inside the slice, so below the threshold of 2.
    assert "BAR_LOCKOUT_TAGOUT" not in barriers


def test_drift_slice_describes_what_was_sliced_on(corpus_path):
    slice_info = _analyze(corpus_path)["barrier_drift_slice"]

    assert slice_info["sliceable"] is True
    assert slice_info["unsliceable_on"] == []
    assert slice_info["activity"] == "ACT_MECH_MAINTENANCE"
    assert slice_info["hazard"] == "HAZ_MECHANICAL"
    # The four maintenance/mechanical rows, not all six.
    assert slice_info["reports_in_slice"] == 4


def test_precedents_absent_without_a_db_are_marked_unavailable(corpus_path):
    """An empty list must not read as 'this has never happened before'."""
    result = _analyze(corpus_path)

    assert result["precedents"] == []
    assert result["precedents_available"] is False


def test_null_activity_returns_no_drift_and_says_why(corpus_path):
    """A report that never stated its activity cannot be sliced."""
    result = analyze_report(
        {**NEW_REPORT, "activity": None},
        RECENT,
        db=None,
        source=str(corpus_path),
    )

    assert result["barrier_drift"] == []
    assert result["barrier_drift_slice"]["sliceable"] is False
    assert "activity" in result["barrier_drift_slice"]["unsliceable_on"]
