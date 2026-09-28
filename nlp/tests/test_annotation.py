"""
Tests for annotation models, storage and taxonomy validation.

As with the taxonomy tests, the point is mostly to prove bad annotations are
*rejected*. A labelling pass that silently accepts nonsense produces a gold set
that is worse than useless, because every number measured against it is wrong.

Run:  PYTHONPATH=src python3 -m pytest tests/ -v
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from annotation import (
    AnnotationError,
    BarrierFailure,
    ExtractionStatus,
    Fingerprint,
    append_annotation,
    partition_usable,
    read_annotations,
    validate_against_taxonomy,
    write_annotations,
)

NARRATIVE = "Technician repaired pump without confirming isolation."


def good_fingerprint(**overrides) -> Fingerprint:
    base = dict(
        report_id="R00001",
        language="en",
        extraction_status=ExtractionStatus.COMPLETE,
        activity="ACT_MECH_MAINTENANCE",
        hazard="HAZ_MECHANICAL",
        exposure="EXP_DIRECT_CONTACT",
        potential_consequence="CON_CAUGHT_BETWEEN",
        life_saving_rules=["LSR_ENERGY"],
        barrier_failures=[
            BarrierFailure(
                barrier="BAR_ISOLATION_VERIFIED",
                failure_mode="FM_NOT_COMPLIED",
                primary=True,
                evidence_span="without confirming isolation",
            )
        ],
        annotator="SJ",
    )
    base.update(overrides)
    return Fingerprint(**base)


# --------------------------------------------------------------------------
# the happy path
# --------------------------------------------------------------------------

def test_valid_annotation_has_no_problems():
    assert validate_against_taxonomy(good_fingerprint(), narrative=NARRATIVE) == []


def test_nulls_are_legitimate():
    """A report that says nothing about location is not a broken annotation."""
    fp = Fingerprint(report_id="R00002", extraction_status=ExtractionStatus.FAILED)
    assert validate_against_taxonomy(fp) == []


# --------------------------------------------------------------------------
# shape rules
# --------------------------------------------------------------------------

def test_rejects_two_primary_failures():
    with pytest.raises(ValidationError, match="marked"):
        good_fingerprint(barrier_failures=[
            BarrierFailure(barrier="BAR_PERMIT_VALID",
                           failure_mode="FM_NOT_COMPLIED", primary=True),
            BarrierFailure(barrier="BAR_GAS_TEST",
                           failure_mode="FM_ABSENT", primary=True),
        ])


def test_rejects_failures_with_no_primary():
    """Module 4 ranks on the primary failure, so one must be nominated."""
    with pytest.raises(ValidationError, match="none marked primary"):
        good_fingerprint(barrier_failures=[
            BarrierFailure(barrier="BAR_PERMIT_VALID",
                           failure_mode="FM_NOT_COMPLIED"),
        ])


def test_rejects_duplicate_lsrs():
    with pytest.raises(ValidationError, match="duplicate ids"):
        good_fingerprint(life_saving_rules=["LSR_ENERGY", "LSR_ENERGY"])


def test_rejects_location_level_gap():
    """Knowing the installation but not the field is incoherent, not precise."""
    with pytest.raises(ValidationError, match="higher level is null"):
        good_fingerprint(location_l1=None, location_l3="LOC_OCS_GENERIC")


def test_rejects_unknown_field():
    with pytest.raises(ValidationError):
        good_fingerprint(hazzard="HAZ_MECHANICAL")


def test_rejects_out_of_range_confidence():
    with pytest.raises(ValidationError):
        good_fingerprint(barrier_failures=[
            BarrierFailure(barrier="BAR_GAS_TEST", failure_mode="FM_ABSENT",
                           primary=True, confidence=1.4),
        ])


# --------------------------------------------------------------------------
# taxonomy validation
# --------------------------------------------------------------------------

def test_catches_unknown_activity():
    problems = validate_against_taxonomy(good_fingerprint(activity="ACT_FLYING"))
    assert any("ACT_FLYING" in p for p in problems)


def test_catches_unknown_barrier():
    fp = good_fingerprint(barrier_failures=[
        BarrierFailure(barrier="BAR_MADE_UP", failure_mode="FM_ABSENT",
                       primary=True),
    ])
    problems = validate_against_taxonomy(fp)
    assert any("BAR_MADE_UP" in p for p in problems)


def test_catches_paraphrased_evidence():
    """Evidence must be quoted verbatim. This is the rule made mechanical."""
    fp = good_fingerprint(barrier_failures=[
        BarrierFailure(barrier="BAR_ISOLATION_VERIFIED",
                       failure_mode="FM_NOT_COMPLIED", primary=True,
                       evidence_span="isolation was not checked"),
    ])
    problems = validate_against_taxonomy(fp, narrative=NARRATIVE)
    assert any("does not appear in the narrative" in p for p in problems)


def test_evidence_check_is_skipped_without_narrative():
    fp = good_fingerprint(barrier_failures=[
        BarrierFailure(barrier="BAR_ISOLATION_VERIFIED",
                       failure_mode="FM_NOT_COMPLIED", primary=True,
                       evidence_span="anything at all"),
    ])
    assert validate_against_taxonomy(fp) == []


def test_catches_location_at_wrong_level():
    fp = good_fingerprint(location_l1="LOC_BAGHEWALA")   # a level-2 location
    problems = validate_against_taxonomy(fp)
    assert any("level-2" in p for p in problems)


def test_catches_status_contradicting_content():
    fp = good_fingerprint(extraction_status=ExtractionStatus.FAILED)
    problems = validate_against_taxonomy(fp)
    assert any("'failed' but barrier failures are present" in p for p in problems)


def test_complete_status_requires_a_barrier_failure():
    fp = Fingerprint(report_id="R9", extraction_status=ExtractionStatus.COMPLETE)
    problems = validate_against_taxonomy(fp)
    assert any("no barrier failure" in p for p in problems)


# --------------------------------------------------------------------------
# storage
# --------------------------------------------------------------------------

def test_roundtrip(tmp_path):
    path = tmp_path / "gold.jsonl"
    written = write_annotations(path, [good_fingerprint(),
                                       good_fingerprint(report_id="R00002")])
    assert written == 2
    back = read_annotations(path)
    assert [f.report_id for f in back] == ["R00001", "R00002"]
    assert back[0].barrier_failures[0].barrier == "BAR_ISOLATION_VERIFIED"


def test_append_adds_one_record(tmp_path):
    path = tmp_path / "gold.jsonl"
    write_annotations(path, [good_fingerprint()])
    append_annotation(path, good_fingerprint(report_id="R00002"))
    assert len(read_annotations(path)) == 2


def test_rejects_duplicate_report_ids(tmp_path):
    path = tmp_path / "gold.jsonl"
    write_annotations(path, [good_fingerprint(), good_fingerprint()])
    with pytest.raises(AnnotationError, match="duplicate report_ids"):
        read_annotations(path)


def test_reports_line_number_on_bad_json(tmp_path):
    path = tmp_path / "gold.jsonl"
    path.write_text('{"report_id": "R1"}\nnot json at all\n')
    with pytest.raises(AnnotationError, match=":2"):
        read_annotations(path)


def test_blank_lines_and_comments_are_skipped(tmp_path):
    path = tmp_path / "gold.jsonl"
    path.write_text('// gold set, hand-labelled\n\n{"report_id": "R1"}\n')
    assert len(read_annotations(path)) == 1


def test_missing_file_is_a_clear_error(tmp_path):
    with pytest.raises(AnnotationError, match="No annotation file"):
        read_annotations(tmp_path / "nope.jsonl")


# --------------------------------------------------------------------------
# multilingual
# --------------------------------------------------------------------------

def test_language_detection():
    from extraction.language import detect_language
    from annotation import Language
    cases = [
        ("Technician repaired pump without confirming isolation.", Language.EN),
        ("मिस्त्री ने पंप की मरम्मत बिना आइसोलेशन जांचे शुरू कर दी।", Language.HI),
        ("কৰ্মীয়ে হেলমেট নিপিন্ধাকৈ ওপৰলৈ উঠিছিল", Language.AS),
        ("Mistri ne pump ka kaam bina isolation check kiye shuru kar diya", Language.MIXED),
        ("", Language.UNKNOWN),
    ]
    for text, expected in cases:
        assert detect_language(text)[0] == expected, text[:40]


def test_gloss_survives_roundtrip(tmp_path):
    """The English rendering must persist through storage — it is what the HSE
    officer reads."""
    from annotation import write_annotations
    hindi = "बिना आइसोलेशन जांचे"
    fp = good_fingerprint(barrier_failures=[
        BarrierFailure(barrier="BAR_ISOLATION_VERIFIED",
                       failure_mode="FM_NOT_COMPLIED", primary=True,
                       evidence_span=hindi,
                       evidence_span_en="without verifying isolation"),
    ])
    path = tmp_path / "hi.jsonl"
    write_annotations(path, [fp])
    back = read_annotations(path)[0]
    assert back.barrier_failures[0].evidence_span == hindi
    assert back.barrier_failures[0].evidence_span_en == "without verifying isolation"


def test_gloss_is_not_validated_against_the_narrative():
    """Only the original-language span must be verbatim. The gloss is a
    translation and by definition will not appear in the source."""
    fp = good_fingerprint(barrier_failures=[
        BarrierFailure(barrier="BAR_ISOLATION_VERIFIED",
                       failure_mode="FM_NOT_COMPLIED", primary=True,
                       evidence_span="without confirming isolation",
                       evidence_span_en="ohne Isolationsprüfung"),
    ])
    assert validate_against_taxonomy(fp, narrative=NARRATIVE) == []


# --------------------------------------------------------------------------
# partition_usable
# --------------------------------------------------------------------------

def test_partition_usable_sets_aside_failed_records():
    """FAILED records are separated, not silently counted as ordinary reports."""
    ok = good_fingerprint(report_id="R00001")
    partial = good_fingerprint(
        report_id="R00002", extraction_status=ExtractionStatus.PARTIAL,
        activity=None,
    )
    failed = Fingerprint(
        report_id="R00003",
        extraction_status=ExtractionStatus.FAILED,
        barrier_failures=[],
    )

    usable, unusable = partition_usable([ok, partial, failed])

    assert [f.report_id for f in usable] == ["R00001", "R00002"]
    assert [f.report_id for f in unusable] == ["R00003"]


def test_partition_usable_keeps_partial_on_the_usable_side():
    """A partial fingerprint carries real content; its nulls are answers."""
    partial = good_fingerprint(
        report_id="R00004", extraction_status=ExtractionStatus.PARTIAL,
        activity=None, exposure=None,
    )
    usable, unusable = partition_usable([partial])
    assert len(usable) == 1 and unusable == []


def test_partition_usable_handles_an_empty_corpus():
    assert partition_usable([]) == ([], [])
