#!/usr/bin/env python3
"""Run extraction over the gold set (or any CSV) and write fingerprints.

    PYTHONPATH=src python3 scripts/run_extraction.py --limit 5
    PYTHONPATH=src python3 scripts/run_extraction.py --provider groq
"""
import argparse, sys, time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from annotation import read_annotations, write_annotations   # noqa: E402
from extraction import Extractor, get_backend                # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reports", default="data/reports.csv")
    ap.add_argument("--gold", default="data/gold/gold.jsonl",
                    help="restrict to the report_ids in this file")
    ap.add_argument("--out", default="data/predictions.jsonl")
    ap.add_argument("--provider", default=None, help="gemini | groq")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sleep", type=float, default=1.0,
                    help="seconds between calls; free tiers rate-limit hard")
    ap.add_argument("--fresh", action="store_true",
                    help="ignore existing output and redo everything")
    args = ap.parse_args()

    df = pd.read_csv(args.reports)
    if args.gold and Path(args.gold).exists():
        wanted = {a.report_id for a in read_annotations(args.gold)}
        df = df[df.REPORT_ID.isin(wanted)]
    if args.limit:
        df = df.head(args.limit)

    # Resume by default. A run that dies at report 8 should not spend the
    # quota re-doing the first seven.
    done = {}
    if not args.fresh and Path(args.out).exists():
        done = {a.report_id: a for a in read_annotations(args.out)
                if a.extraction_status.value != "failed"}
        if done:
            print(f"resuming — {len(done)} already extracted\n")

    backend = get_backend(args.provider)
    extractor = Extractor(backend=backend)
    print(f"{backend.name} / {backend.model_name} — {len(df)} reports\n")

    out = []
    for i, row in enumerate(df.itertuples(), 1):
        if row.REPORT_ID in done:
            out.append(done[row.REPORT_ID])
            continue
        fp = extractor.extract(row.REPORT_ID, row.NARRATIVE)
        out.append(fp)
        bars = ", ".join(f"{b.barrier}/{b.failure_mode}" for b in fp.barrier_failures) or "—"
        print(f"[{i}/{len(df)}] {fp.report_id}  {fp.extraction_status.value:8}  {bars}")
        if fp.notes:
            print(f"          {fp.notes[:110]}")
        if fp.notes and "rate limited" in fp.notes:
            out.pop()   # do not persist a rate-limit failure as a result
            print("\n  quota exhausted — stopping here. What completed is saved;"
                  "\n  re-run to resume, or try --provider gemini.\n")
            break
        if i < len(df):
            time.sleep(args.sleep)

    n = write_annotations(args.out, out)
    print(f"\nwrote {n} to {args.out}")


if __name__ == "__main__":
    main()
