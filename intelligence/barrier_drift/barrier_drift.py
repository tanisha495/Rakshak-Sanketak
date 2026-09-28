from collections import Counter

# Sentinel: the caller is not slicing on this dimension at all.
#
# It exists to separate two cases that were previously both spelled `None`:
#
#   detect_barrier_drift(reports)                  -> not slicing; corpus-wide
#   detect_barrier_drift(reports, activity=None)   -> slicing on activity, but
#                                                     this report does not say
#
# The second used to fall through `if activity and ...` and silently become
# the first. A report whose activity could not be extracted was therefore
# compared against every report in the corpus, so it came back with MORE
# drift than a fully-extracted one — the missing field made it look better
# informed. Null means "cannot slice", and cannot-slice returns nothing.
UNSPECIFIED = object()


def detect_barrier_drift(
    historical_reports,
    activity=UNSPECIFIED,
    hazard=UNSPECIFIED,
    threshold=2
):
    """Repeated barrier+failure_mode pairs within a slice of the corpus.

    `activity` / `hazard`:
        omitted     -> that dimension is not sliced on
        a value     -> slice to reports matching it
        None        -> the querying report does not state it; the slice is
                       undefined, so no drift is returned

    Returns a list of drift dicts. Use `detect_barrier_drift_with_slice` when
    the caller needs to tell "no repeats in this slice" from "no slice could
    be built".
    """
    drift, _ = detect_barrier_drift_with_slice(
        historical_reports, activity, hazard, threshold
    )
    return drift


def detect_barrier_drift_with_slice(
    historical_reports,
    activity=UNSPECIFIED,
    hazard=UNSPECIFIED,
    threshold=2
):
    """As `detect_barrier_drift`, plus a description of the slice used.

    The second return value carries `sliceable` and `unsliceable_on`, so an
    empty drift list is never ambiguous: either the slice held no repeated
    failure, or there was no slice to look in.
    """
    unsliceable_on = [
        name for name, value in (("activity", activity), ("hazard", hazard))
        if value is None
    ]

    slice_info = {
        "activity": None if activity is UNSPECIFIED else activity,
        "hazard": None if hazard is UNSPECIFIED else hazard,
        "unsliceable_on": unsliceable_on,
        "sliceable": not unsliceable_on,
        "reports_in_slice": 0,
    }

    if unsliceable_on:
        # The report does not state a dimension the caller asked to slice on.
        # Widening to the whole corpus here is what produced the bug: it
        # answers a question nobody asked and attributes the answer to this
        # report.
        return [], slice_info

    failures = []
    reports_in_slice = 0

    for report in historical_reports:

        # Filter by activity
        if activity is not UNSPECIFIED and report.get("activity") != activity:
            continue

        # Filter by hazard
        if hazard is not UNSPECIFIED and report.get("hazard") != hazard:
            continue

        reports_in_slice += 1

        for failure in report.get("barrier_failures", []):

            key = (
                failure["barrier"],
                failure["failure_mode"]
            )

            failures.append(key)

    slice_info["reports_in_slice"] = reports_in_slice

    counts = Counter(failures)

    drift = []

    for (barrier, failure_mode), count in counts.items():

        if count >= threshold:

            drift.append({
                "barrier": barrier,
                "failure_mode": failure_mode,
                "occurrences": count,
                "risk_status": "REPEATED"
            })

    drift.sort(
        key=lambda x: x["occurrences"],
        reverse=True
    )

    return drift, slice_info
