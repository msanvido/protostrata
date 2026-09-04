import pytest
from strata.parser.extractor import DocumentExtractor
from strata.parser.segmenter import DocumentSegmenter
from strata.parser.metadata import MetadataExtractor
from strata.models.entities import ProceedingStatus

def test_html_extraction():
    html_content = """
    <html>
        <body>
            <header><p>Banner Navigation</p></header>
            <h1>Notice of Proposed Rulemaking</h1>
            <p>The Commission proposes to reform generator interconnection procedures.</p>
            <footer><p>Footer info</p></footer>
        </body>
    </html>
    """
    extracted = DocumentExtractor.extract_text(html_content, is_raw_content=True, file_type="html")
    assert "Banner Navigation" not in extracted
    assert "Footer info" not in extracted
    assert "Notice of Proposed Rulemaking" in extracted
    assert "generator interconnection" in extracted

def test_document_segmenter():
    raw_text = """### Section 1. Overview
The Commission adopts a cluster study methodology.
All newly interconnecting facilities must maintain frequency ride-through.

### Section 2. Study Timelines
Transmission providers must complete studies within 150 days.
"""
    sections = DocumentSegmenter.segment(raw_text)
    assert len(sections) == 2
    assert sections[0].heading == "### Section 1. Overview"
    assert len(sections[0].paragraphs) == 1

    # Check exact char spans on paragraph unit of change
    p1 = sections[0].paragraphs[0]
    assert p1.text in raw_text
    assert raw_text[p1.char_span.start:p1.char_span.end] == p1.text

def test_metadata_extractor():
    final_text = "UNITED STATES EPA\nFINAL RULE\nThis rule is effective November 6, 2023.\n### Section 1..."
    meta_final = MetadataExtractor.extract_metadata(final_text)
    assert meta_final["status"] == ProceedingStatus.FINAL
    assert meta_final["effective_date"] == "November 6, 2023"

    draft_text = "UNITED STATES FERC\nNOTICE OF PROPOSED RULEMAKING\nComments due by August 15, 2024.\n### Section 1..."
    meta_draft = MetadataExtractor.extract_metadata(draft_text)
    assert meta_draft["status"] == ProceedingStatus.PROPOSED
    assert meta_draft["comment_due_date"] == "August 15, 2024"
