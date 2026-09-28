from app.core.db import SessionLocal
from app.models.report import Report
from app.services.analysis import analyse_report
import uuid

db = SessionLocal()

# Only raw_text and language are hardcoded — everything else is generated
# by the real model, so demo data is 100% authentic.
demo_reports = [
    # Scenario 1: Precedent-match demo (gas/pressure incident, high risk)
    {
        "raw_text": "Worker reported strong gas smell near the main pipeline valve, pressure gauge reading abnormally high, evacuation was not immediately triggered.",
        "language": "english",
    },
    # Scenario 2: Repeating-pattern demo (3 reports, same equipment tag)
    {
        "raw_text": "Scaffold missing guardrails on level 3, reported during morning inspection.",
        "language": "english",
    },
    {
        "raw_text": "Another scaffold near block B found without proper guardrails, same issue as last week.",
        "language": "english",
    },
    {
        "raw_text": "Scaffold at the east wing again missing safety rails, third time this month.",
        "language": "english",
    },
    # Scenario 3: Multilingual demo (Hindi report)
    {
        "raw_text": "काम की जगह पर बिजली के तार खुले पड़े हैं, यह खतरनाक हो सकता है।",
        "language": "hindi",
    },
]

for r in demo_reports:
    analysis = analyse_report(r["raw_text"])
    report = Report(
        id=str(uuid.uuid4()),
        anon_token=str(uuid.uuid4()),
        raw_text=r["raw_text"],
        language=r["language"],
        status="pending",
        # No site: analyse_report no longer invents one, and these demo
        # scenarios state no location. The dashboard renders null as
        # "Not recorded".
        site_tag=None,
        # Explicitly "live": unlike the 500-report historical corpus in
        # seed_reports_from_predictions.py, these three are demo submissions
        # that are meant to appear in the HSE queue and be triaged on screen.
        # Stated rather than left to the column default, so the intent is
        # visible and a change to that default cannot silently move them.
        source="live",
        **analysis,
    )
    db.add(report)
    print(f"Seeded: {r['raw_text'][:50]}... | sif_probability: {analysis['sif_probability']} | risk_level: {analysis['risk_level']} | token: {report.anon_token}")

db.commit()
print("\nAll demo reports seeded successfully using the real model.")