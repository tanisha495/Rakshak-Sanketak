#!/usr/bin/env python3
"""Score extractions against the hand-labelled gold set.

    PYTHONPATH=src python3 scripts/evaluate.py

Reports per-field accuracy, plus precision/recall/F1 for the multi-label
fields. Per-field matters more than a single headline number: the module can be
excellent at hazard and poor at barrier, and one blended figure would hide that.

Barriers are scored two ways. Exact pairing (barrier AND failure mode both
right) is the strict measure. Barrier-only is reported alongside, because
getting the control right and its failure mode wrong is a materially better
outcome than missing the control entirely.
"""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path
from typing import List, Optional, Set

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from annotation import Fingerprint, read_annotations   # noqa: E402


def _single(gold: List[Fingerprint], pred: dict, field: str) -> dict:
    """Accuracy on a single-value field, with nulls counted honestly.

    Predicting null where gold is null is correct — the module is supposed to
    decline when the report says nothing. But we also track how often the model
    guessed where gold declined, since that is the failure mode that matters in
    a safety system.
    """
    n = hit = gold_null = both_null = over = under = 0
    for g in gold:
        p = pred.get(g.report_id)
        if p is None:
            continue
        n += 1
        gv, pv = getattr(g, field), getattr(p, field)
        if gv is None:
            gold_null += 1
        if gv == pv:
            hit += 1
            if gv is None:
                both_null += 1
        elif gv is None and pv is not None:
            over += 1          # invented a value
        elif gv is not None and pv is None:
            under += 1         # missed a value that was there
    return {"n": n, "acc": hit / n if n else 0.0, "gold_null": gold_null,
            "both_null": both_null, "over": over, "under": under}


def _multi(gold: List[Fingerprint], pred: dict, extract) -> dict:
    """Micro precision/recall/F1 over set-valued fields."""
    tp = fp_ = fn = 0
    exact = n = 0
    for g in gold:
        p = pred.get(g.report_id)
        if p is None:
            continue
        n += 1
        gs, ps = set(extract(g)), set(extract(p))
        tp += len(gs & ps)
        fp_ += len(ps - gs)
        fn += len(gs - ps)
        if gs == ps:
            exact += 1
    prec = tp / (tp + fp_) if tp + fp_ else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return {"n": n, "precision": prec, "recall": rec, "f1": f1,
            "exact_set": exact / n if n else 0.0, "tp": tp, "fp": fp_, "fn": fn}


def _evidence(gold: List[Fingerprint], pred: dict, narratives: dict) -> dict:
    """How often a predicted evidence span is genuinely in the narrative.

    The coercion step already drops fabricated spans, so this should be 100%.
    It is checked anyway — if it ever drops, the guarantee has broken and every
    downstream explanation is suspect.
    """
    total = verbatim = with_span = 0
    for g in gold:
        p = pred.get(g.report_id)
        if p is None:
            continue
        for bf in p.barrier_failures:
            total += 1
            if bf.evidence_span:
                with_span += 1
                if bf.evidence_span in narratives.get(g.report_id, ""):
                    verbatim += 1
    return {"failures": total, "with_span": with_span, "verbatim": verbatim,
            "rate": verbatim / with_span if with_span else 0.0}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--gold", default="data/gold/gold.jsonl")
    ap.add_argument("--pred", default="data/predictions.jsonl")
    ap.add_argument("--reports", default="data/reports.csv")
    ap.add_argument("--errors", action="store_true",
                    help="print every disagreement")
    args = ap.parse_args()

    gold = read_annotations(args.gold)
    pred = {p.report_id: p for p in read_annotations(args.pred)}
    gold = [g for g in gold if g.report_id in pred]

    # stdlib csv, not pandas: the evaluator is the one thing that has to run
    # on a bare clone to produce the numbers we report, and it should not be
    # blocked by a heavyweight dependency it needs for two columns.
    narratives = {}
    if Path(args.reports).exists():
        with open(args.reports, newline="") as f:
            for row in csv.DictReader(f):
                narratives[row["REPORT_ID"]] = " ".join(
                    str(row["NARRATIVE"]).split())

    print(f"scored on {len(gold)} reports\n")

    print("SINGLE-VALUE FIELDS")
    print(f"{'field':<24}{'acc':>7}{'null ok':>9}{'invented':>10}{'missed':>8}")
    for field in ("activity", "hazard", "exposure", "potential_consequence"):
        r = _single(gold, pred, field)
        print(f"{field:<24}{r['acc']:>7.0%}{r['both_null']:>9}"
              f"{r['over']:>10}{r['under']:>8}")

    print("\nMULTI-VALUE FIELDS")
    print(f"{'field':<24}{'prec':>7}{'rec':>7}{'F1':>7}{'exact':>8}")
    r = _multi(gold, pred, lambda f: f.life_saving_rules)
    print(f"{'life_saving_rules':<24}{r['precision']:>7.0%}{r['recall']:>7.0%}"
          f"{r['f1']:>7.0%}{r['exact_set']:>8.0%}")

    r = _multi(gold, pred, lambda f: [b.barrier for b in f.barrier_failures])
    print(f"{'barrier (id only)':<24}{r['precision']:>7.0%}{r['recall']:>7.0%}"
          f"{r['f1']:>7.0%}{r['exact_set']:>8.0%}")

    r = _multi(gold, pred,
               lambda f: [(b.barrier, b.failure_mode) for b in f.barrier_failures])
    print(f"{'barrier + mode':<24}{r['precision']:>7.0%}{r['recall']:>7.0%}"
          f"{r['f1']:>7.0%}{r['exact_set']:>8.0%}")

    if narratives:
        e = _evidence(gold, pred, narratives)
        print(f"\nEVIDENCE SPANS")
        print(f"  {e['with_span']}/{e['failures']} failures carry a span; "
              f"{e['rate']:.0%} verbatim in the narrative")

    if args.errors:
        print("\nDISAGREEMENTS")
        for g in gold:
            p = pred[g.report_id]
            diffs = []
            for field in ("activity", "hazard", "exposure", "potential_consequence"):
                if getattr(g, field) != getattr(p, field):
                    diffs.append(f"{field}: {getattr(g, field)} -> {getattr(p, field)}")
            gb = {(b.barrier, b.failure_mode) for b in g.barrier_failures}
            pb = {(b.barrier, b.failure_mode) for b in p.barrier_failures}
            if gb != pb:
                diffs.append(f"barriers: {sorted(gb)} -> {sorted(pb)}")
            if set(g.life_saving_rules) != set(p.life_saving_rules):
                diffs.append(f"lsr: {g.life_saving_rules} -> {p.life_saving_rules}")
            if diffs:
                print(f"\n{g.report_id}")
                for d in diffs:
                    print(f"  {d}")


if __name__ == "__main__":
    main()
