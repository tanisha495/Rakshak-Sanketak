"""
Seed the reports table from the 500 real extracted fingerprints in
nlp/data/predictions.jsonl.

Each prediction is a SIF fingerprint keyed by REPORT_ID. The report text
itself lives in the master dataset CSV, so the two are joined on that id.
Everything else — risk score, risk level, reasons, equipment/barrier/site
tags, and the 384-dim embedding — is produced by the app's own services,
exactly as it would be for a live submission. Nothing is hand-written.

Reports whose extraction failed are seeded too, with their fingerprint as-is.
Dropping them would make vaguely-reported sites look safer than
well-reported ones (see the note in nlp/taxonomy/taxonomy.yaml).

Run inside the api container, where the model files and the database are:

    docker compose exec api python seed_reports_from_predictions.py

Re-running is safe: ids are derived from the source REPORT_ID, so a second
run updates the same rows instead of creating duplicates.

Rows are written with source="seed" so they stay out of the HSE-facing
listings (GET /reports/, /actions/, /dashboard/summary) while remaining
visible to the intelligence paths, which need the historical volume. Without
that, this script silently fills an officer's triage queue with 500 historical
OSHA/MSHA accidents. Override with --source live only if that is truly wanted.
"""

import argparse
import csv
import json
import sys
import uuid
from datetime import datetime

from app.core.db import SessionLocal
from app.models.report import Report
from app.services.analysis import analyse_report
from app.services.embedding import generate_embedding

# Stable namespace so a given source report always maps to the same row.
NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "sanketak/seed/predictions")

DEFAULT_PREDICTIONS = "nlp/data/predictions.jsonl"
DEFAULT_NARRATIVES = "output/sanketak_master_labeled.csv"


def load_predictions(path):
    records = []
    with open(path, encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as error:
                print(f"  skipped {path}:{line_number} — {error}", file=sys.stderr)
    return records


def load_narratives(path, wanted_ids):
    """Pull only the narratives we need; the master CSV has ~39k rows."""
    narratives = {}
    with open(path, encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            report_id = (row.get("REPORT_ID") or "").strip()
            if report_id in wanted_ids:
                narratives[report_id] = {
                    "text": (row.get("NARRATIVE") or "").strip(),
                    "date": (row.get("DATE") or "").strip(),
                }
    return narratives


def parse_date(value):
    """The master CSV dates are M/D/YYYY. An unparseable date is left to the
    column default rather than guessed at."""
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt)
        except (ValueError, TypeError):
            continue
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--predictions", default=DEFAULT_PREDICTIONS)
    parser.add_argument("--narratives", default=DEFAULT_NARRATIVES)
    parser.add_argument(
        "--source", default="seed", choices=("seed", "live"),
        help="Value for Report.source. Defaults to 'seed': this script loads "
             "the historical analysis corpus, which must stay out of the HSE "
             "triage queue. Only pass 'live' if you really mean to present "
             "these as worker submissions.",
    )
    parser.add_argument("--limit", type=int, default=None,
                        help="Seed only the first N predictions (for a smoke test).")
    args = parser.parse_args()

    predictions = load_predictions(args.predictions)
    if args.limit:
        predictions = predictions[:args.limit]
    print(f"Loaded {len(predictions)} fingerprints from {args.predictions}")

    wanted = {p.get("report_id") for p in predictions if p.get("report_id")}
    narratives = load_narratives(args.narratives, wanted)
    print(f"Matched {len(narratives)} narratives from {args.narratives}")

    missing_text = sorted(wanted - set(narratives))
    if missing_text:
        print(f"WARNING: {len(missing_text)} fingerprints have no narrative and will be skipped "
              f"(a report with no text cannot be analysed). First few: {missing_text[:5]}",
              file=sys.stderr)

    db = SessionLocal()
    inserted = 0
    updated = 0
    no_embedding = 0

    try:
        for index, fingerprint in enumerate(predictions, 1):
            source_id = fingerprint.get("report_id")
            source = narratives.get(source_id)

            if not source or not source["text"]:
                continue

            raw_text = source["text"]
            report_id = str(uuid.uuid5(NAMESPACE, f"report:{source_id}"))

            # The fingerprint's report_id must identify the report in THIS
            # system, not in the source dataset. The intelligence engine
            # excludes self-matches on this field, so leaving the source id
            # here makes every report its own top precedent at 100%.
            # The source id is still recoverable: report_id is uuid5(NAMESPACE,
            # "report:" + source_id).
            fingerprint = dict(fingerprint)
            fingerprint["report_id"] = report_id

            # The app's own analysis pipeline — same code path as a live
            # submission, so nothing here is invented for the demo.
            analysis = analyse_report(raw_text)
            embedding = generate_embedding(fingerprint)

            if embedding is None:
                no_embedding += 1

            report = db.query(Report).filter(Report.id == report_id).first()

            if report is None:
                report = Report(
                    id=report_id,
                    anon_token=str(uuid.uuid5(NAMESPACE, f"token:{source_id}")),
                    status="pending",
                    source=args.source,
                )
                db.add(report)
                inserted += 1
            else:
                updated += 1

            # Set on update too: re-running is documented as safe, and a row
            # left tagged "live" from an earlier run would otherwise stay in
            # the HSE queue forever.
            report.source = args.source
            # The historical corpus carries no site: these are public OSHA and
            # MSHA records, not OIL submissions. Cleared explicitly rather than
            # just left unset, so a re-run also removes the fabricated
            # "site-1".."site-5" values an earlier version of analyse_report
            # wrote here. Null means "not stated", which is the truth.
            report.site_tag = None
            report.raw_text = raw_text
            report.language = fingerprint.get("language") or "en"
            report.fingerprint = fingerprint
            report.embedding = embedding

            submitted_at = parse_date(source["date"])
            if submitted_at:
                report.submitted_at = submitted_at

            for field, value in analysis.items():
                setattr(report, field, value)

            if index % 50 == 0:
                db.commit()
                print(f"  ...{index}/{len(predictions)}")

        db.commit()
    finally:
        db.close()

    print(f"\nSeeded {inserted} new reports, updated {updated}.")
    if no_embedding:
        print(f"{no_embedding} had an empty fingerprint, so no embedding was generated. "
              f"They are still seeded — they just cannot be precedent-matched.")


if __name__ == "__main__":
    main()
