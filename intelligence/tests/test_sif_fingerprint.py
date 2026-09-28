from intelligence.intelligence_engine import analyze_report


new_report = {
    "report_id": "NEW001",

    "activity": "ACT_MECH_MAINTENANCE",

    "hazard": "HAZ_MECHANICAL",

    "exposure": "EXP_DIRECT_CONTACT",

    "barrier_failures": [
        {
            "barrier": "BAR_ISOLATION_VERIFIED",
            "failure_mode": "FM_NOT_COMPLIED",
            "primary": True,
            "evidence_span": "without confirming isolation"
        }
    ],

    "potential_consequence": "CON_CAUGHT_BETWEEN",

    "life_saving_rules": [
        "LSR_ENERGY"
    ]
}




recent_reports = [
    {
        "report_id": "REC001",

        "activity": "ACT_MECH_MAINTENANCE",

        "hazard": "HAZ_MECHANICAL",

        "barrier_failures": [
            {
                "barrier": "BAR_ISOLATION_VERIFIED",
                "failure_mode": "FM_NOT_COMPLIED"
            }
        ]
    },
    {
        "report_id": "REC002",

        "activity": "ACT_MECH_MAINTENANCE",

        "hazard": "HAZ_MECHANICAL",

        "barrier_failures": [
            {
                "barrier": "BAR_ISOLATION_VERIFIED",
                "failure_mode": "FM_NOT_COMPLIED"
            }
        ]
    }
]


result = analyze_report(
    new_report,
    recent_reports
)


print("REAL SIF FINGERPRINT TEST")
print("-------------------------")

print("\nPrecedents:")
for item in result["precedents"]:
    print(item)

print("\nBarrier Drift:")
for item in result["barrier_drift"]:
    print(item)

print("\nEmerging Risks:")
for item in result["emerging_risks"]:
    print(item)
