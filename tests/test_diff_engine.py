import pytest
from strata.parser.segmenter import DocumentSegmenter
from strata.models.entities import ProceedingVersion, ProceedingStatus
from strata.pipeline.diff_engine import DiffEngine
from strata.pipeline.classifier import ChangeClassifier
from strata.models.analysis import ChangeType, Materiality

def test_diff_engine_detects_structural_changes():
    text_v1 = """### Section 1. Timelines
Providers shall make reasonable efforts to complete studies within 180 days.
"""
    text_v2 = """### Section 1. Timelines
Providers must complete studies within 150 days or face penalties.
"""
    s1 = DocumentSegmenter.segment(text_v1)
    s2 = DocumentSegmenter.segment(text_v2)

    v1 = ProceedingVersion(
        id="v1", proceeding_id="p1", version_label="Draft",
        status=ProceedingStatus.PROPOSED, filed_date="2026-01-01",
        raw_text=text_v1, sections=s1
    )
    v2 = ProceedingVersion(
        id="v2", proceeding_id="p1", version_label="Final",
        status=ProceedingStatus.FINAL, filed_date="2026-06-01",
        raw_text=text_v2, sections=s2
    )

    diffs = DiffEngine.align_and_diff(v1, v2)
    assert len(diffs) == 1
    assert diffs[0]["diff_type"] == "MODIFIED"

    cr = ChangeClassifier.classify_diff_pair(diffs[0], "p1", v1, v2)
    assert cr.materiality == Materiality.MATERIAL
    assert cr.change_type == ChangeType.DEADLINE_SHIFT
    assert cr.after_citation is not None
    assert "150 days" in cr.after_citation.quoted_text

def test_status_transition_record():
    v1 = ProceedingVersion(id="v1", proceeding_id="p1", version_label="NOPR", status=ProceedingStatus.PROPOSED, filed_date="2026-01-01", raw_text="", sections=[])
    v2 = ProceedingVersion(id="v2", proceeding_id="p1", version_label="Final Rule", status=ProceedingStatus.FINAL, filed_date="2026-06-01", raw_text="", sections=[])

    st = ChangeClassifier.create_status_transition_record("p1", v1, v2)
    assert st.change_type == ChangeType.STATUS_TRANSITION
    assert st.materiality == Materiality.MATERIAL
    assert "PROPOSED to FINAL" in st.description

def test_diff_engine_identical_documents_produce_zero_diffs():
    text = """### Section 1. Unchanged Mandate
All facility operators shall maintain standard logbooks on site.
"""
    s1 = DocumentSegmenter.segment(text)
    s2 = DocumentSegmenter.segment(text)

    v1 = ProceedingVersion(id="v1", proceeding_id="p1", version_label="V1", status=ProceedingStatus.FINAL, filed_date="2026-01-01", raw_text=text, sections=s1)
    v2 = ProceedingVersion(id="v2", proceeding_id="p1", version_label="V2", status=ProceedingStatus.FINAL, filed_date="2026-02-01", raw_text=text, sections=s2)

    diffs = DiffEngine.align_and_diff(v1, v2)
    assert len(diffs) == 0, "Identical documents must produce zero diffs"

def test_diff_engine_pure_addition():
    text_v1 = """### Section 1. Core Rule
Operators must calibrate equipment annually.
"""
    text_v2 = """### Section 1. Core Rule
Operators must calibrate equipment annually.

### Section 2. New Reporting Obligation
Operators shall submit digital calibration reports within 30 days.
"""
    s1 = DocumentSegmenter.segment(text_v1)
    s2 = DocumentSegmenter.segment(text_v2)

    v1 = ProceedingVersion(id="v1", proceeding_id="p1", version_label="V1", status=ProceedingStatus.PROPOSED, filed_date="2026-01-01", raw_text=text_v1, sections=s1)
    v2 = ProceedingVersion(id="v2", proceeding_id="p1", version_label="V2", status=ProceedingStatus.FINAL, filed_date="2026-06-01", raw_text=text_v2, sections=s2)

    diffs = DiffEngine.align_and_diff(v1, v2)
    assert len(diffs) == 1
    assert diffs[0]["diff_type"] == "ADDED"
    assert diffs[0]["prev_para"] is None
    assert diffs[0]["curr_para"] is not None
    assert "submit digital calibration reports" in diffs[0]["curr_para"]["text"]

def test_diff_engine_pure_deletion():
    text_v1 = """### Section 1. Existing Standard
Operators must maintain physical paper manifests.

Operators may request written exemptions.
"""
    text_v2 = """### Section 1. Existing Standard
Operators must maintain physical paper manifests.
"""
    s1 = DocumentSegmenter.segment(text_v1)
    s2 = DocumentSegmenter.segment(text_v2)

    v1 = ProceedingVersion(id="v1", proceeding_id="p1", version_label="V1", status=ProceedingStatus.PROPOSED, filed_date="2026-01-01", raw_text=text_v1, sections=s1)
    v2 = ProceedingVersion(id="v2", proceeding_id="p1", version_label="V2", status=ProceedingStatus.FINAL, filed_date="2026-06-01", raw_text=text_v2, sections=s2)

    diffs = DiffEngine.align_and_diff(v1, v2)
    assert len(diffs) == 1
    assert diffs[0]["diff_type"] == "REMOVED"
    assert diffs[0]["curr_para"] is None
    assert diffs[0]["prev_para"] is not None
    assert "written exemptions" in diffs[0]["prev_para"]["text"]

def test_diff_engine_asymmetric_replace_expansion():
    """Tests 1 paragraph replaced by 2 paragraphs (MODIFIED + ADDED)."""
    text_v1 = """### Section 1. Emissions Monitoring
Facility shall monitor exhaust gas hourly.
"""
    text_v2 = """### Section 1. Emissions Monitoring
Facility shall monitor exhaust gas continuously via certified CEMS.

Facility shall submit real-time telemetry to the regional air board.
"""
    s1 = DocumentSegmenter.segment(text_v1)
    s2 = DocumentSegmenter.segment(text_v2)

    v1 = ProceedingVersion(id="v1", proceeding_id="p1", version_label="V1", status=ProceedingStatus.PROPOSED, filed_date="2026-01-01", raw_text=text_v1, sections=s1)
    v2 = ProceedingVersion(id="v2", proceeding_id="p1", version_label="V2", status=ProceedingStatus.FINAL, filed_date="2026-06-01", raw_text=text_v2, sections=s2)

    diffs = DiffEngine.align_and_diff(v1, v2)
    assert len(diffs) == 2
    types = [d["diff_type"] for d in diffs]
    assert "MODIFIED" in types
    assert "ADDED" in types

    mod = next(d for d in diffs if d["diff_type"] == "MODIFIED")
    assert "hourly" in mod["prev_para"]["text"]
    assert "continuously via certified CEMS" in mod["curr_para"]["text"]

    add = next(d for d in diffs if d["diff_type"] == "ADDED")
    assert add["prev_para"] is None
    assert "real-time telemetry" in add["curr_para"]["text"]

def test_diff_engine_asymmetric_replace_contraction():
    """Tests 2 paragraphs replaced by 1 paragraph (MODIFIED + REMOVED)."""
    text_v1 = """### Section 1. Water Discharge
Facility shall monitor discharge temperatures twice daily.

Facility shall record ambient river water temperature at intake.
"""
    text_v2 = """### Section 1. Water Discharge
Facility shall install automated continuous thermal sensors at all outfalls.
"""
    s1 = DocumentSegmenter.segment(text_v1)
    s2 = DocumentSegmenter.segment(text_v2)

    v1 = ProceedingVersion(id="v1", proceeding_id="p1", version_label="V1", status=ProceedingStatus.PROPOSED, filed_date="2026-01-01", raw_text=text_v1, sections=s1)
    v2 = ProceedingVersion(id="v2", proceeding_id="p1", version_label="V2", status=ProceedingStatus.FINAL, filed_date="2026-06-01", raw_text=text_v2, sections=s2)

    diffs = DiffEngine.align_and_diff(v1, v2)
    assert len(diffs) == 2
    types = [d["diff_type"] for d in diffs]
    assert "MODIFIED" in types
    assert "REMOVED" in types

    mod = next(d for d in diffs if d["diff_type"] == "MODIFIED")
    assert "twice daily" in mod["prev_para"]["text"]
    assert "automated continuous thermal sensors" in mod["curr_para"]["text"]

    rem = next(d for d in diffs if d["diff_type"] == "REMOVED")
    assert rem["curr_para"] is None
    assert "ambient river water temperature" in rem["prev_para"]["text"]

def test_diff_engine_flatten_paragraphs_preserves_metadata():
    text = """### Section 1. Alpha
First paragraph text.

### Section 2. Beta
Second paragraph text.
"""
    s = DocumentSegmenter.segment(text)
    v = ProceedingVersion(id="v_meta", proceeding_id="p_meta", version_label="V1", status=ProceedingStatus.FINAL, filed_date="2026-01-01", raw_text=text, sections=s)

    flat = DiffEngine._flatten_paragraphs(v)
    assert len(flat) == 2
    assert flat[0]["version_id"] == "v_meta"
    assert flat[0]["section_id"] == "sec_1"
    assert flat[0]["para_id"] == "sec_1_p1"
    assert flat[0]["text"] == "First paragraph text."
    assert flat[1]["section_id"] == "sec_2"
    assert flat[1]["para_id"] == "sec_2_p1"
    assert flat[1]["text"] == "Second paragraph text."

