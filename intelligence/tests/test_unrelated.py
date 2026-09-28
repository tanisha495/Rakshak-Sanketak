from intelligence.intelligence_engine import analyze_report


new_report = {
    "report_id": "NEW_UNRELATED_001",
    "activity": "ACT_LIFTING",
    "hazard": "HAZ_GRAVITY",
    "exposure": None,
    "barrier_failures": [
        {
            "barrier": "BAR_RIGGING_INSPECTED",
            "failure_mode": "FM_ABSENT",
            "primary": True,
            "evidence_span": "rigging was not inspected"
        }
    ],
    "potential_consequence": None,
    "life_saving_rules": [
        "LSR_LIFTING"
    ]
}


recent_reports = [
    {
        "report_id": "REC_LIFT_001",
        "activity": "ACT_LIFTING",
        "hazard": "HAZ_GRAVITY",
        "barrier_failures": [
            {
                "barrier": "BAR_RIGGING_INSPECTED",
                "failure_mode": "FM_ABSENT"
            }
        ]
    },
    {
        "report_id": "REC_LIFT_002",
        "activity": "ACT_LIFTING",
        "hazard": "HAZ_GRAVITY",
        "barrier_failures": [
            {
                "barrier": "BAR_RIGGING_INSPECTED",
                "failure_mode": "FM_ABSENT"
            }
        ]
    }
]


result = analyze_report(
    new_report,
    recent_reports
)


print("UNRELATED SCENARIO TEST")
print("-----------------------")

print("\nPrecedents:")
for item in result["precedents"]:
    print(item)

print("\nBarrier Drift:")
for item in result["barrier_drift"]:
    print(item)

print("\nEmerging Risks:")
for item in result["emerging_risks"]:
    print(item)