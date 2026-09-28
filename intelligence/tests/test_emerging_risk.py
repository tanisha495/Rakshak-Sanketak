"""Emerging risk, by hand.

    PYTHONPATH=. python3 intelligence/tests/test_emerging_risk.py

Updated when scoring moved from raw counts to the rate ratio. The original
fixture was one historical report with no barrier failures at all, which now
(correctly) produces nothing: with no baseline there is no rate for anything
to be elevated above. It needs a real history to be a demonstration of
anything, so it has one.

BAR_FIRE_WATCH is the spike — rare historically, three times in the recent
window. BAR_PPE_GENERAL is the control: it is the most common failure in both
the history and the window, and must NOT be flagged. Asserted in
test_emerging_rate_ratio.py.
"""

from intelligence.barrier_drift.emerging_risk import detect_emerging_risks


def report(report_id, *pairs):
    return {
        "report_id": report_id,
        "barrier_failures": [
            {"barrier": b, "failure_mode": f} for b, f in pairs
        ],
    }


# History: PPE failures are routine, a fire watch has lapsed twice in 20.
historical_reports = (
    [report(f"OLD{i:03}", ("BAR_PPE_GENERAL", "FM_INEFFECTIVE"))
     for i in range(1, 19)]
    + [report("OLD019", ("BAR_FIRE_WATCH", "FM_ABSENT")),
       report("OLD020", ("BAR_FIRE_WATCH", "FM_ABSENT"))]
)

# Recent: PPE continues at its usual rate; the fire watch has lapsed three
# times in six reports.
recent_reports = [
    report("R001", ("BAR_FIRE_WATCH", "FM_ABSENT")),
    report("R002", ("BAR_FIRE_WATCH", "FM_ABSENT")),
    report("R003", ("BAR_FIRE_WATCH", "FM_ABSENT")),
    report("R004", ("BAR_PPE_GENERAL", "FM_INEFFECTIVE")),
    report("R005", ("BAR_PPE_GENERAL", "FM_INEFFECTIVE")),
    report("R006", ("BAR_PPE_GENERAL", "FM_INEFFECTIVE")),
]

risks = detect_emerging_risks(
    historical_reports + recent_reports,
    recent_reports
)

print("Emerging Risks:")
for risk in risks:
    print(f"  {risk['rate_ratio']:5.2f}x  {risk['barrier']:20} "
          f"{risk['failure_mode']:16} recent={risk['recent_occurrences']} "
          f"baseline={risk['baseline_occurrences']}")

flagged = {r["barrier"] for r in risks}
print(f"\nBAR_FIRE_WATCH flagged (rare, now frequent): "
      f"{'BAR_FIRE_WATCH' in flagged}")
print(f"BAR_PPE_GENERAL flagged (common, at base rate): "
      f"{'BAR_PPE_GENERAL' in flagged}")
