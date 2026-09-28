from intelligence.intelligence_engine import analyze_report


new_report = {
    "report_id": "HOTNEW001",
    "activity": "ACT_HOT_WORK",
    "hazard": "HAZ_THERMAL",
    "exposure": "EXP_DIRECT_CONTACT",
    "barrier_failures": [
        {
            "barrier": "BAR_FIRE_WATCH",
            "failure_mode": "FM_ABSENT",
            "primary": True,
            "evidence_span": "no fire watch was present"
        }
    ],
    "potential_consequence": None,
    "life_saving_rules": [
        "LSR_HOTWORK"
    ]
}


recent_reports = [
    {
        "report_id": "HOTREC001",
        "activity": "ACT_HOT_WORK",
        "hazard": "HAZ_THERMAL",
        "barrier_failures": [
            {
                "barrier": "BAR_FIRE_WATCH",
                "failure_mode": "FM_ABSENT"
            }
        ]
    },
    {
        "report_id": "HOTREC002",
        "activity": "ACT_HOT_WORK",
        "hazard": "HAZ_THERMAL",
        "barrier_failures": [
            {
                "barrier": "BAR_FIRE_WATCH",
                "failure_mode": "FM_ABSENT"
            }
        ]
    }
]


result = analyze_report(
    new_report,
    recent_reports
)


print("HOT WORK INTELLIGENCE TEST")
print("--------------------------")

print("\nPrecedents:")
for item in result["precedents"]:
    print(item)

print("\nBarrier Drift:")
for item in result["barrier_drift"]:
    print(item)

print("\nEmerging Risks:")
for item in result["emerging_risks"]:
    print(item)