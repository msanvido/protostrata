import re
from typing import Tuple, Optional, Dict, Any
from strata.models.analysis import Citation
from strata.models.entities import ProceedingVersion, InternalDocument

class CitationValidator:
    @staticmethod
    def normalize_whitespace(text: str) -> str:
        return " ".join(text.strip().split())

    @classmethod
    def validate_citation(cls, citation: Citation, document_or_version: Any) -> Tuple[bool, Optional[str]]:
        """
        Validates that citation.quoted_text is an exact or whitespace-normalized substring
        of the referenced paragraph in the immutable document snapshot.
        Returns: (is_valid, failure_reason)
        """
        if not citation.quoted_text or not citation.quoted_text.strip():
            return False, "Citation contains empty quoted text"

        # Locate paragraph in document/version
        para_text = None
        for sec in document_or_version.sections:
            if sec.section_id == citation.section_id or not citation.section_id:
                for p in sec.paragraphs:
                    if p.para_id == citation.para_id:
                        para_text = p.text
                        break
            if para_text is not None:
                break

        # If not found by section/para id, search all paragraphs
        if para_text is None:
            for sec in document_or_version.sections:
                for p in sec.paragraphs:
                    if p.para_id == citation.para_id:
                        para_text = p.text
                        break
                if para_text is not None:
                    break

        if para_text is None:
            return False, f"Referenced paragraph '{citation.para_id}' not found in document '{citation.document_id}'"

        # Check exact match
        if citation.quoted_text in para_text:
            return True, None

        # Check normalized match
        norm_quote = cls.normalize_whitespace(citation.quoted_text)
        norm_para = cls.normalize_whitespace(para_text)

        if norm_quote in norm_para:
            return True, None

        return False, f"Quoted span '{citation.quoted_text[:40]}...' does not match text in paragraph '{citation.para_id}'"
