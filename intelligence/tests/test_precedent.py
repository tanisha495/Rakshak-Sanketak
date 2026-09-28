from intelligence.precedent.precedent_engine import find_precedents

new_report = {
    "report_id": "NEW001",
    "activity": "ACT_HOT_WORK",
    "hazard": "HAZ_THERMAL",
    "life_saving_rules": ["LSR_HOTWORK"],
    "barrier_failures": [
        {
            "barrier": "BAR_FIRE_WATCH",
            "failure_mode": "FM_ABSENT"
        }
    ]
}


historical_reports = [
    {
        "report_id": "OLD001",
        "activity": "ACT_HOT_WORK",
        "hazard": "HAZ_THERMAL",
        "life_saving_rules": ["LSR_HOTWORK"],
        "barrier_failures": [
            {
                "barrier": "BAR_FIRE_WATCH",
                "failure_mode": "FM_ABSENT"
            }
        ]
    },
    {
        "report_id": "OLD002",
        "activity": "ACT_HOT_WORK",
        "hazard": "HAZ_CHEMICAL",
        "life_saving_rules": ["LSR_HOTWORK"],
        "barrier_failures": []
    },
    {
        "report_id": "OLD003",
        "activity": "ACT_DRILLING",
        "hazard": "HAZ_MECHANICAL",
        "life_saving_rules": [],
        "barrier_failures": []
    }
]


matches = find_precedents(new_report, historical_reports)

print("Precedent Matches:")
for match in matches:
    print(match)