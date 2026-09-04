import pytest
from strata.models.analysis import Citation
from strata.models.entities import ProceedingVersion, ProceedingStatus, Section, Paragraph, CharSpan
from strata.pipeline.validator import CitationValidator

def test_citation_validation_exact_and_failure():
    p = Paragraph(
        para_id="p1",
        text="All newly interconnecting facilities must maintain frequency ride-through under IEEE 2800."
    )
    sec = Section(section_id="sec_1", heading="Inverter Standards", paragraphs=[p])
    ver = ProceedingVersion(
        id="v2", proceeding_id="p1", version_label="Final", status=ProceedingStatus.FINAL,
        filed_date="2026-01-01", raw_text=p.text, sections=[sec]
    )

    # Valid exact citation
    valid_cite = Citation(
        document_id="p1", version_id="v2", section_id="sec_1", para_id="p1",
        quoted_text="frequency ride-through under IEEE 2800"
    )
    valid, reason = CitationValidator.validate_citation(valid_cite, ver)
    assert valid is True
    assert reason is None

    # Valid normalized whitespace citation
    norm_cite = Citation(
        document_id="p1", version_id="v2", section_id="sec_1", para_id="p1",
        quoted_text="frequency   ride-through \n under IEEE 2800"
    )
    valid, reason = CitationValidator.validate_citation(norm_cite, ver)
    assert valid is True

    # Hallucinated / invalid citation
    bad_cite = Citation(
        document_id="p1", version_id="v2", section_id="sec_1", para_id="p1",
        quoted_text="facilities must pay an upfront fine of 1 million dollars"
    )
    valid, reason = CitationValidator.validate_citation(bad_cite, ver)
    assert valid is False
    assert "does not match" in reason
