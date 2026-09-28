from intelligence.api import intelligence_analysis


sif_fingerprint = {
    "report_id": "API_TEST_001",
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
        "report_id": "API_REC_001",
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
        "report_id": "API_REC_002",
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


result = intelligence_analysis(
    sif_fingerprint,
    recent_reports
)


print("INTELLIGENCE API TEST")
print("---------------------")

print(result)