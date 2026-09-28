"""Emerging risk must score on rate, not on count.

    PYTHONPATH=. python3 intelligence/tests/test_emerging_rate_ratio.py

The bug being pinned down: `detect_emerging_risks` accepted a baseline and
never read it, so it ranked barrier failures by how often they appeared in the
recent window. The most common failure in the corpus therefore topped the
EMERGING list in almost every window while sitting at its own base rate — an
HSE officer would be pointed at the thing they already know about, while a real
spike ranked below it.

The load-bearing assertion is `test_pair_at_its_base_rate_is_not_emerging`.
A pair running at exactly its historical rate must not be flagged no matter how
large its count is. If that ever passes, the function has gone back to counting.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from intelligence.barrier_drift.emerging_risk import (   # noqa: E402
    detect_emerging_risks,
    detect_emerging_risks_with_new,
)

COMMON = ("BAR_POSITIONING", "FM_NOT_COMPLIED")
RARE = ("BAR_ISOLATION_VERIFIED", "FM_NOT_COMPLIED")


def reports(prefix, pairs_per_report):
    """Build reports from a list of per-report barrier-failure pairs."""
    return [
        {
            "report_id": f"{prefix}{i}",
            "barrier_failures": [
                {"barrier": b, "failure_mode": f} for b, f in pairs
            ],
        }
        for i, pairs in enumerate(pairs_per_report)
    ]


def flagged(risks):
    return {(r["barrier"], r["failure_mode"]) for r in risks}


def ratio_of(risks, pair):
    for r in risks:
        if (r["barrier"], r["failure_mode"]) == pair:
            return r["rate_ratio"]
    return None


# --------------------------------------------------------------------------
# THE regression: base rate is not emergence
# --------------------------------------------------------------------------

def test_pair_at_its_base_rate_is_not_emerging():
    """50% of the baseline, 50% of the window -> ratio 1.0 -> not emerging.

    COMMON is by far the highest count in the recent window (5 occurrences,
    more than everything else combined). The old implementation ranked it
    first. It is running at exactly its historical rate, so it is not a
    finding.
    """
    baseline = reports("H", [[COMMON], [COMMON], [RARE], [("BAR_X", "FM_ABSENT")]] * 25)
    recent = reports("R", [[COMMON], [COMMON], [RARE], [("BAR_X", "FM_ABSENT")]] * 2
                     + [[COMMON]])

    risks = detect_emerging_risks(baseline + recent, recent)

    assert COMMON not in flagged(risks), (
        f"a pair at its base rate was flagged as EMERGING: {risks}. "
        f"This is the original bug — scoring has reverted to raw counts."
    )


def test_the_highest_count_is_not_automatically_first():
    """Ranking is by rate ratio; a lower-count spike outranks a common pair."""
    baseline = reports("H", [[COMMON]] * 60 + [[RARE]] * 2)
    # COMMON slightly up, RARE sharply up.
    recent = reports("R", [[COMMON]] * 6 + [[RARE]] * 3)

    risks = detect_emerging_risks(baseline + recent, recent)

    assert risks, "a genuine spike should be flagged"
    assert (risks[0]["barrier"], risks[0]["failure_mode"]) == RARE
    assert risks[0]["recent_occurrences"] < 6   # ranked above a larger count


def test_a_genuine_spike_is_flagged():
    baseline = reports("H", [[COMMON]] * 50 + [[RARE]] * 2)
    recent = reports("R", [[RARE]] * 4 + [[COMMON]] * 2)

    risks = detect_emerging_risks(baseline + recent, recent)

    assert RARE in flagged(risks)
    assert ratio_of(risks, RARE) > 1.5


# --------------------------------------------------------------------------
# the two gates
# --------------------------------------------------------------------------

def test_a_single_occurrence_cannot_spike():
    """One occurrence of a never-seen pair has a huge ratio and no evidence."""
    baseline = reports("H", [[COMMON]] * 50)
    recent = reports("R", [[("BAR_NEW", "FM_ABSENT")]] + [[COMMON]] * 5)

    risks = detect_emerging_risks(baseline + recent, recent)

    assert ("BAR_NEW", "FM_ABSENT") not in flagged(risks)


def test_a_repeated_new_pair_is_newly_observed_not_emerging():
    """Two occurrences of a pair with no history is reported, but not scored.

    This assertion used to read `in flagged(risks)`. A pair with a baseline of
    zero has no rate to be elevated above, so putting it on the EMERGING list
    ranked an invented denominator against measured ones -- see
    `test_zero_baseline_pair_does_not_outrank_a_real_spike`.
    """
    baseline = reports("H", [[COMMON]] * 50)
    recent = reports("R", [[("BAR_NEW", "FM_ABSENT")]] * 2 + [[COMMON]] * 5)

    emerging, newly = detect_emerging_risks_with_new(baseline + recent, recent)

    assert ("BAR_NEW", "FM_ABSENT") not in flagged(emerging)
    assert ("BAR_NEW", "FM_ABSENT") in flagged(newly)


def test_ratio_gate_is_enforced():
    """A pair only slightly above its base rate does not clear 1.5."""
    baseline = reports("H", [[COMMON]] * 40 + [[RARE]] * 10)
    recent = reports("R", [[COMMON]] * 8 + [[RARE]] * 3)   # RARE 20% vs 20%

    risks = detect_emerging_risks(baseline + recent, recent)
    assert RARE not in flagged(risks)


# --------------------------------------------------------------------------
# the baseline parameter is actually read
# --------------------------------------------------------------------------

def test_baseline_is_used_at_all():
    """Same recent window, different history -> different answer.

    If the baseline is ignored again, these two calls return the same thing.
    """
    recent = reports("R", [[RARE]] * 3)

    # Both histories contain RARE, so both are scored on a measured baseline
    # and the only difference is the rate. Using a zero-baseline history here
    # would prove nothing now that such pairs are excluded from scoring.
    seen_constantly = reports("H", [[RARE]] * 50)
    seen_rarely = reports("H", [[COMMON]] * 48 + [[RARE]] * 2)

    a = detect_emerging_risks(seen_constantly + recent, recent)
    b = detect_emerging_risks(seen_rarely + recent, recent)

    assert flagged(a) != flagged(b), (
        "the historical baseline is not being read — this was the bug"
    )
    assert RARE not in flagged(a)   # always been the only failure: normal
    assert RARE in flagged(b)       # 4% of history, 100% of the window


def test_recent_reports_are_excluded_from_their_own_baseline():
    """The window must not dilute the baseline it is measured against.

    Asserted on the ratio rather than on membership: RARE clears the gate
    either way here, so only the value shows whether the window was excluded.

    excluded  -> baseline 2/20  = 0.10, recent 3/3 = 1.0 -> 10.0
    included  -> baseline 5/23  = 0.217              -> 4.6
    """
    recent = reports("R", [[RARE]] * 3)
    baseline = reports("H", [[COMMON]] * 18 + [[RARE]] * 2)

    with_overlap = detect_emerging_risks(baseline + recent, recent)

    assert RARE in flagged(with_overlap)
    assert ratio_of(with_overlap, RARE) == 10.0


# --------------------------------------------------------------------------
# THE second regression: a ratio needs a measured denominator
# --------------------------------------------------------------------------

def test_zero_baseline_pair_does_not_outrank_a_real_spike():
    """A pair with no history must not top the EMERGING list.

    The load-bearing assertion, and the sibling of
    `test_pair_at_its_base_rate_is_not_emerging`. Both pin the same mistake at
    opposite ends: there, a large numerator with no elevation; here, a large
    ratio with no denominator.

    On the 492-report corpus this shipped as BAR_STANDBY_ATTENDANT/FM_ABSENT --
    two occurrences, baseline of zero, rate_ratio 52.55, first on the list,
    above every pair with a measured increase. The ratio was a property of the
    0.5 stand-in denominator, not of the data.
    """
    # SPIKE has a real, measured history and genuinely quadruples its rate.
    spike = ("BAR_EDGE_PROTECTION", "FM_INEFFECTIVE")
    unseen = ("BAR_NEVER_BEFORE", "FM_ABSENT")

    baseline = reports("H", [[COMMON]] * 40 + [[spike]] * 10)
    recent = reports("R", [[spike]] * 4 + [[unseen]] * 2 + [[COMMON]] * 4)

    emerging, newly = detect_emerging_risks_with_new(baseline + recent, recent)

    # The unseen pair is not scored at all ...
    assert unseen not in flagged(emerging)
    assert ratio_of(emerging, unseen) is None
    # ... and the pair with a real base rate is what an officer sees first.
    assert emerging, "the genuine spike must still be flagged"
    assert (emerging[0]["barrier"], emerging[0]["failure_mode"]) == spike

    # The unseen pair is still surfaced, just without a fabricated ratio.
    assert unseen in flagged(newly)
    entry = next(r for r in newly if (r["barrier"], r["failure_mode"]) == unseen)
    assert entry["risk_status"] == "NEWLY_OBSERVED"
    assert entry["baseline_occurrences"] == 0
    assert entry["rate_ratio"] is None
    assert entry["baseline_share"] is None


def test_single_baseline_occurrence_is_also_too_thin_to_score():
    """A baseline of one is a coin-flip denominator, not a rate."""
    thin = ("BAR_THIN_HISTORY", "FM_ABSENT")
    baseline = reports("H", [[COMMON]] * 49 + [[thin]])
    recent = reports("R", [[thin]] * 2 + [[COMMON]] * 5)

    emerging, newly = detect_emerging_risks_with_new(baseline + recent, recent)

    assert thin not in flagged(emerging)
    assert thin in flagged(newly)


def test_a_pair_with_a_real_baseline_is_still_scored_normally():
    """The gate must not swallow pairs that do have a measurable history."""
    solid = ("BAR_GAS_TEST", "FM_ABSENT")
    baseline = reports("H", [[COMMON]] * 46 + [[solid]] * 4)
    recent = reports("R", [[solid]] * 5 + [[COMMON]] * 5)

    emerging, newly = detect_emerging_risks_with_new(baseline + recent, recent)

    assert solid in flagged(emerging)
    assert solid not in flagged(newly)
    assert ratio_of(emerging, solid) > 1.0


def test_newly_observed_still_respects_the_recent_occurrence_gate():
    """One sighting of something new is not yet an observation worth naming."""
    once = ("BAR_SEEN_ONCE", "FM_ABSENT")
    baseline = reports("H", [[COMMON]] * 50)
    recent = reports("R", [[once]] + [[COMMON]] * 5)

    emerging, newly = detect_emerging_risks_with_new(baseline + recent, recent)

    assert once not in flagged(emerging)
    assert once not in flagged(newly)


def test_no_baseline_flags_nothing():
    """Nothing to compare against is not a licence to flag everything."""
    recent = reports("R", [[RARE]] * 5)
    assert detect_emerging_risks([], recent) == []
    assert detect_emerging_risks(recent, recent) == []


def test_empty_window_is_empty():
    assert detect_emerging_risks(reports("H", [[COMMON]] * 10), []) == []


# --------------------------------------------------------------------------
# against the real corpus
# --------------------------------------------------------------------------

def test_real_corpus_does_not_flag_the_most_common_pair():
    """BAR_POSITIONING/FM_NOT_COMPLIED topped every window under the old code.

    It is the most frequent failure in the corpus (64/305) and sits at its own
    base rate in the recent window. It must not be called emerging.
    """
    from intelligence.data.report_repository import load_historical_reports

    corpus = load_historical_reports()
    for window in (50, 100):
        risks = detect_emerging_risks(corpus, corpus[-window:])
        assert COMMON not in flagged(risks), (
            f"window={window}: the corpus's most common failure was flagged "
            f"as EMERGING at its own base rate"
        )


if __name__ == "__main__":
    import logging
    logging.disable(logging.WARNING)
    passed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
            passed += 1
    print(f"\n{passed} passed — base rate is not emergence")
