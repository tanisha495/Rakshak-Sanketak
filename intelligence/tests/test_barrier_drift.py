from intelligence.barrier_drift.barrier_drift import detect_barrier_drift


historical_reports = [
    {
        "report_id": "R001",
        "barrier_failures": [
            {
                "barrier": "BAR_PPE_GENERAL",
                "failure_mode": "FM_ABSENT"
            }
        ]
    },
    {
        "report_id": "R002",
        "barrier_failures": [
            {
                "barrier": "BAR_PPE_GENERAL",
                "failure_mode": "FM_ABSENT"
            }
        ]
    },
    {
        "report_id": "R003",
        "barrier_failures": [
            {
                "barrier": "BAR_PPE_GENERAL",
                "failure_mode": "FM_ABSENT"
            }
        ]
    },
    {
        "report_id": "R004",
        "barrier_failures": [
            {
                "barrier": "BAR_FIRE_WATCH",
                "failure_mode": "FM_ABSENT"
            }
        ]
    }
]


drift = detect_barrier_drift(historical_reports)

print("Barrier Drift:")
for item in drift:
    print(item)