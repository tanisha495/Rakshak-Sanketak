"""Emerging risk: barrier failures occurring at an elevated rate *right now*.

The distinction this module exists to draw is between COMMON and EMERGING.

The previous implementation counted barrier failures in the recent window and
labelled anything appearing twice as EMERGING. It accepted `historical_reports`
and never read it, so there was no baseline and therefore no way for anything
to be elevated relative to anything. What it actually produced was a frequency
ranking: on the 492-report corpus its top result in every window was
BAR_POSITIONING/FM_NOT_COMPLIED, which is simply the most common failure on
record — recent share 21.6% against a corpus share of 21.0%, a rate ratio of
1.03. The same pair topped four of five randomly chosen windows.

Ranking by popularity and calling it emergence points an HSE officer at the
thing they already know about, while a genuine spike sits further down the
list. So scoring here is on the rate ratio:

    rate ratio = (share of recent failures) / (share of baseline failures)

A pair at its historical rate scores 1.0 and is not emerging, however common
it is. A pair running at three times its usual rate is, however rare.
"""

from collections import Counter

# A pair must clear BOTH gates to be flagged.
#
# MIN_OCCURRENCES exists because the ratio is unstable at small counts: one
# occurrence of a pair with almost no history produces an enormous ratio that
# says nothing. Requiring two means a spike has to actually repeat.
#
# MIN_RATE_RATIO is the margin over the historical rate. 2.0 = running at
# least twice as often as usual.
#
# Raised from 1.5 deliberately. At 1.5 the window-100 list included
# BAR_POSITIONING/FM_INEFFECTIVE at 1.51 — a true reading, but sitting on the
# gate, and a marginal call reads on a dashboard exactly like a firm one.
# Requiring a doubled rate keeps what is flagged unambiguous; the cost is that
# a genuine but gradual drift has to grow before it is named.
MIN_OCCURRENCES = 2
MIN_RATE_RATIO = 2.0

# MIN_BASELINE_OCCURRENCES is the other half of MIN_OCCURRENCES: the ratio is
# just as unstable when the *denominator* is tiny.
#
# A pair with no history at all has no rate to be elevated above, so any
# stand-in denominator is invented rather than measured, and the ratio it
# produces is an artefact of the stand-in. On the 492-report corpus
# BAR_STANDBY_ATTENDANT/FM_ABSENT appeared twice in a window with a baseline
# of ZERO and scored 52.55 -- top of the list, above every pair with a real
# measured increase. That is the same failure as ranking by raw count: a
# number that looks like evidence and is not.
#
# Pairs below this gate are not scored on rate ratio at all. They are real and
# worth seeing, so they are returned separately as NEWLY_OBSERVED, where two
# occurrences of something never seen before is the whole claim being made --
# no ratio attached, nothing to mistake for a measured trend.
MIN_BASELINE_OCCURRENCES = 2


def detect_emerging_risks(
    historical_reports,
    recent_reports,
    min_occurrences=MIN_OCCURRENCES,
    min_rate_ratio=MIN_RATE_RATIO,
    min_baseline_occurrences=MIN_BASELINE_OCCURRENCES,
):
    """Barrier failures running above their historical rate in `recent_reports`.

    Returns the EMERGING list only, so existing callers are unaffected. Use
    `detect_emerging_risks_with_new` to also get the pairs that were excluded
    for having no measurable baseline."""
    emerging, _ = detect_emerging_risks_with_new(
        historical_reports,
        recent_reports,
        min_occurrences=min_occurrences,
        min_rate_ratio=min_rate_ratio,
        min_baseline_occurrences=min_baseline_occurrences,
    )
    return emerging


def detect_emerging_risks_with_new(
    historical_reports,
    recent_reports,
    min_occurrences=MIN_OCCURRENCES,
    min_rate_ratio=MIN_RATE_RATIO,
    min_baseline_occurrences=MIN_BASELINE_OCCURRENCES,
):
    """As `detect_emerging_risks`, plus the newly-observed pairs.

    Returns `(emerging, newly_observed)`. The split exists so a pair with no
    history cannot compete on rate ratio against pairs that have one.

    `historical_reports` is the baseline — the parameter the previous version
    ignored. Reports that appear in `recent_reports` are removed from it by
    report_id, so the recent window is not compared against a baseline that
    already contains it (which would drag every ratio toward 1.0 and hide
    exactly the spikes this is looking for).

    Returns the same keys as before plus the scoring inputs, so a reviewer can
    see why something was flagged. Sorted by rate ratio, not by count.
    """
    recent_ids = {
        report.get("report_id") for report in recent_reports
        if report.get("report_id") is not None
    }

    baseline_counts = Counter(
        _failure_keys(report for report in historical_reports
                      if report.get("report_id") not in recent_ids)
    )
    recent_counts = Counter(_failure_keys(recent_reports))

    baseline_total = sum(baseline_counts.values())
    recent_total = sum(recent_counts.values())

    if not recent_total or not baseline_total:
        # No baseline means no rate to be elevated above. Returning nothing is
        # the honest answer; the alternative is to flag whatever happens to be
        # in the window, which is the behaviour this function was rewritten to
        # remove.
        return [], []

    emerging_risks = []
    newly_observed = []

    for (barrier, failure_mode), count in recent_counts.items():
        if count < min_occurrences:
            continue

        baseline_count = baseline_counts[(barrier, failure_mode)]
        recent_share = count / recent_total

        if baseline_count < min_baseline_occurrences:
            # No measurable base rate. Reported, but never scored: there is
            # no denominator here that was observed rather than chosen, so
            # any ratio would be a property of the choice. `rate_ratio` is
            # explicitly None rather than absent, so a consumer that sorts on
            # it fails loudly instead of silently ordering these first.
            newly_observed.append({
                "barrier": barrier,
                "failure_mode": failure_mode,
                "recent_occurrences": count,
                "baseline_occurrences": baseline_count,
                "rate_ratio": None,
                "recent_share": round(recent_share, 4),
                "baseline_share": None,
                "risk_status": "NEWLY_OBSERVED",
            })
            continue

        # Past the gate the baseline is at least `min_baseline_occurrences`
        # real observations, so the share is measured and needs no stand-in.
        baseline_share = baseline_count / baseline_total
        rate_ratio = recent_share / baseline_share

        if rate_ratio < min_rate_ratio:
            continue

        emerging_risks.append({
            "barrier": barrier,
            "failure_mode": failure_mode,
            "recent_occurrences": count,
            "baseline_occurrences": baseline_count,
            "rate_ratio": round(rate_ratio, 2),
            "recent_share": round(recent_share, 4),
            "baseline_share": round(baseline_share, 4),
            "risk_status": "EMERGING",
        })

    emerging_risks.sort(
        key=lambda x: (x["rate_ratio"], x["recent_occurrences"]),
        reverse=True
    )
    # Nothing to rank these by but volume -- they all share the same claim.
    newly_observed.sort(
        key=lambda x: x["recent_occurrences"],
        reverse=True
    )

    return emerging_risks, newly_observed


def _failure_keys(reports):
    for report in reports:
        for failure in report.get("barrier_failures", []):
            yield (failure["barrier"], failure["failure_mode"])
