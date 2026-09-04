import re
from typing import List, Tuple
from strata.models.entities import Section, Paragraph, CharSpan

class DocumentSegmenter:
    # Heading patterns: Markdown headings (#), legal sections (§, Section X, Part X, Article X)
    HEADING_PATTERN = re.compile(
        r"^(?:#{1,6}\s+|§+\s*\d+|Section\s+\d+|Part\s+\d+|Article\s+[IVXLCDM\d]+|ORDER\s+NO\.\s*\d+)(.*)$",
        re.MULTILINE | re.IGNORECASE
    )

    @classmethod
    def segment(cls, raw_text: str) -> List[Section]:
        """Segments raw text into hierarchical Section -> Paragraph with character spans."""
        sections: List[Section] = []
        
        # Identify heading boundaries
        matches = list(cls.HEADING_PATTERN.finditer(raw_text))
        
        if not matches:
            # Entire document is a single section
            section = cls._parse_section("sec_1", "General Provisions", raw_text, 0)
            return [section]
        
        # Preamble before first heading
        if matches[0].start() > 0:
            preamble_text = raw_text[:matches[0].start()].strip()
            if preamble_text:
                sections.append(cls._parse_section("sec_preamble", "Preamble & Background", preamble_text, 0))
        
        for i, match in enumerate(matches):
            sec_start = match.start()
            sec_end = matches[i + 1].start() if i + 1 < len(matches) else len(raw_text)
            heading_text = match.group(0).strip()
            
            # Start section body after the heading line
            body_offset = sec_start + len(match.group(0))
            raw_body = raw_text[body_offset:sec_end]
            body_clean = raw_body.strip()
            
            sec_id = f"sec_{i+1}"
            if body_clean:
                abs_body_start = raw_text.find(body_clean, body_offset)
                sections.append(cls._parse_section(sec_id, heading_text, body_clean, abs_body_start))
            else:
                sections.append(Section(section_id=sec_id, heading=heading_text, paragraphs=[]))
            
        return sections

    @classmethod
    def _parse_section(cls, sec_id: str, heading: str, text: str, offset_start: int) -> Section:
        paragraphs: List[Paragraph] = []
        
        # Split on double newlines for paragraphs
        raw_paras = re.split(r'\n\s*\n', text)
        cur_pos = offset_start
        
        p_idx = 1
        for p_text in raw_paras:
            p_clean = p_text.strip()
            if not p_clean:
                continue
            
            # Locate exact position in original text
            match_start = text.find(p_clean, cur_pos - offset_start)
            if match_start != -1:
                abs_p_start = offset_start + match_start
            else:
                abs_p_start = cur_pos
            
            para_id = f"{sec_id}_p{p_idx}"
            abs_p_end = abs_p_start + len(p_clean)
            paragraphs.append(Paragraph(
                para_id=para_id,
                text=p_clean,
                char_span=CharSpan(start=abs_p_start, end=abs_p_end)
            ))
            p_idx += 1
            cur_pos = abs_p_start + len(p_clean)
            
        return Section(
            section_id=sec_id,
            heading=heading,
            paragraphs=paragraphs
        )
