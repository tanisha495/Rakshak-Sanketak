import logging

from intelligence.precedent.vector_search import vector_search

logger = logging.getLogger(__name__)


class PrecedentMatches(list):
    """The precedent list, plus what was dropped on the way to it.

    A list subclass rather than a tuple so existing callers that iterate
    or len() the return value keep working. Callers that need to tell
    "no precedents matched" from "every match was discarded" read
    `.dropped_count` — and `analyze_report` surfaces it in its result.
    """

    def __init__(self, matches=(), dropped_report_ids=()):
        super().__init__(matches)
        self.dropped_report_ids = list(dropped_report_ids)

    @property
    def dropped_count(self):
        return len(self.dropped_report_ids)



def calculate_structured_score(new_report, old_report):
    score = 0

    # Activity match — 30 points
    if new_report.get("activity") == old_report.get("activity"):
        score += 30

    # Hazard match — 25 points
    if new_report.get("hazard") == old_report.get("hazard"):
        score += 25

    # Life-Saving Rule match — 15 points
    new_rules = set(new_report.get("life_saving_rules", []))
    old_rules = set(old_report.get("life_saving_rules", []))

    if new_rules and old_rules:
        common_rules = new_rules & old_rules
        score += int(15 * len(common_rules) / len(new_rules))

    # Barrier + Failure Mode match — 30 points
    new_failures = {
        (x["barrier"], x["failure_mode"])
        for x in new_report.get("barrier_failures", [])
    }

    old_failures = {
        (x["barrier"], x["failure_mode"])
        for x in old_report.get("barrier_failures", [])
    }

    if new_failures and old_failures:
        common_failures = new_failures & old_failures
        score += int(30 * len(common_failures) / len(new_failures))

    return score


def find_precedents(new_report, historical_reports=None, db=None, exclude_report_id=None, threshold=50):

    vector_results = vector_search(new_report, db=db, exclude_report_id=exclude_report_id, top_k=10)

    historical_lookup = {
        report["report_id"]: report
        for report in (historical_reports or [])
    }

    matches = []
    dropped_report_ids = []

    for result in vector_results:
        report_id = result["report_id"]
        old_report = historical_lookup.get(report_id)

        if old_report is None:
            # F5: the vector index and the historical corpus disagree. This
            # used to `continue` in silence, so a 0.99 match to a report the
            # corpus had not loaded produced the same empty list as "nothing
            # is similar to this" — the worst confusion a safety tool can
            # make. Record it instead, and let the caller see the count.
            dropped_report_ids.append(report_id)
            logger.warning(
                "precedent %s matched at similarity %.3f but is absent from "
                "the historical corpus (%d reports) — dropped",
                report_id, result.get("similarity", 0.0), len(historical_lookup),
            )
            continue

        structured_score = calculate_structured_score(new_report, old_report)
        vector_score = int(result["similarity"] * 100)

        final_score = int((structured_score * 0.7) + (vector_score * 0.3))

        if final_score >= threshold:
            matches.append({
                "report_id": report_id,
                "match_score": final_score,
                "structured_score": structured_score,
                "vector_similarity": round(result["similarity"], 3)
            })

    matches.sort(key=lambda x: x["match_score"], reverse=True)

    if dropped_report_ids:
        logger.warning(
            "find_precedents(%s): %d of %d vector matches dropped as unknown "
            "to the corpus; %d precedent(s) returned",
            new_report.get("report_id"), len(dropped_report_ids),
            len(vector_results), len(matches),
        )

    return PrecedentMatches(matches, dropped_report_ids)