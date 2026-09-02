import re
from typing import Dict, Any, Optional, Tuple
from strata.models.entities import ProceedingStatus

class MetadataExtractor:
    FINAL_MARKERS = [
        r"\bFinal\s+Rule\b", r"\bFinal\s+Order\b", r"\bOrder\s+No\.\s*\d+\b",
        r"\bAdopted\s+Rule\b", r"\bAdopting\s+Release\b", r"\bThis\s+rule\s+is\s+effective\b"
    ]
    PROPOSED_MARKERS = [
        r"\bNotice\s+of\s+Proposed\s+Rulemaking\b", r"\bNOPR\b", r"\bNPRM\b",
        r"\bProposed\s+Rule\b", r"\bProposed\s+Regulations\b", r"\bComments\s+due\b"
    ]
    DRAFT_MARKERS = [
        r"\bDraft\b", r"\bWorking\s+Draft\b", r"\bDiscussion\s+Draft\b",
        r"\bStaff\s+Paper\b", r"\bPreliminary\s+Draft\b"
    ]

    DATE_PATTERN = re.compile(
        r"(?:effective|filed|dated|issued|adopted|comments due)\s*(?:on|by|:)?\s*([A-Za-z]+\s+\d{1,2},\s*\d{4}|\d{4}-\d{2}-\d{2})",
        re.IGNORECASE
    )

    @classmethod
    def extract_metadata(cls, text: str) -> Dict[str, Any]:
        """Extracts status, filed_date, effective_date, and comment_due_date from document text."""
        preamble = text[:4000] # Focus on initial sections/preamble
        
        status = ProceedingStatus.DRAFT
        # Check Final
        if any(re.search(p, preamble, re.IGNORECASE) for p in cls.FINAL_MARKERS):
            status = ProceedingStatus.FINAL
        elif any(re.search(p, preamble, re.IGNORECASE) for p in cls.PROPOSED_MARKERS):
            status = ProceedingStatus.PROPOSED
        elif any(re.search(p, preamble, re.IGNORECASE) for p in cls.DRAFT_MARKERS):
            status = ProceedingStatus.DRAFT

        effective_date = None
        comment_date = None
        
        eff_match = re.search(r"effective\s*(?:date|on|:)?\s*([A-Za-z]+\s+\d{1,2},\s*\d{4}|\d{4}-\d{2}-\d{2})", preamble, re.IGNORECASE)
        if eff_match:
            effective_date = eff_match.group(1)

        comment_match = re.search(r"comments?\s*(?:due\s*by|due|must\s*be\s*received\s*by|must\s*be\s*received|on\s*or\s*before|by)?\s*:?\s*([A-Za-z]+\s+\d{1,2},\s*\d{4}|\d{4}-\d{2}-\d{2})", preamble, re.IGNORECASE)
        if comment_match:
            comment_date = comment_match.group(1)

        return {
            "status": status,
            "effective_date": effective_date,
            "comment_due_date": comment_date
        }
