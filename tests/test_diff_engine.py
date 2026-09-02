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
