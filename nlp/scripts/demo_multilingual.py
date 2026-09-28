#!/usr/bin/env python3
"""Show the multilingual path end to end.

    PYTHONPATH=src python3 scripts/demo_multilingual.py --provider groq

Prints, for each report: the detected language, what was extracted, and the
evidence in the reporter's own words with an English rendering beside it.
This is the demo. It is meant to be read aloud from.
"""
import argparse, sys, time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from extraction import Extractor, get_backend          # noqa: E402
from extraction.language import detect_language        # noqa: E402
from loader import get_taxonomy                        # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reports", default="data/multilingual_demo.csv")
    ap.add_argument("--provider", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--sleep", type=float, default=2.0)
    args = ap.parse_args()

    df = pd.read_csv(args.reports)
    if args.limit:
        df = df.head(args.limit)

    tax = get_taxonomy()
    ex = Extractor(backend=get_backend(args.provider))

    for row in df.itertuples():
        lang, conf = detect_language(row.NARRATIVE)
        print("=" * 74)
        print(row.NARRATIVE)
        print(f"  language: {lang.value} ({conf:.0%})")

        fp = ex.extract(row.REPORT_ID, row.NARRATIVE)

        rules = ", ".join(tax.get(r).label for r in fp.life_saving_rules) or "—"
        print(f"  life-saving rules: {rules}")
        if fp.potential_consequence:
            print(f"  could have caused: {tax.get(fp.potential_consequence).label}")

        for bf in fp.barrier_failures:
            mark = "*" if bf.primary else " "
            print(f"  {mark} {tax.get(bf.barrier).label} "
                  f"[{tax.get(bf.failure_mode).label}]")
            if bf.evidence_span:
                print(f"      evidence: \"{bf.evidence_span}\"")
            if bf.evidence_span_en:
                print(f"      i.e.      \"{bf.evidence_span_en}\"")
        if not fp.barrier_failures:
            print("    no control failure identified")
        if fp.notes:
            print(f"  note: {fp.notes[:100]}")
        print()
        time.sleep(args.sleep)


if __name__ == "__main__":
    main()
