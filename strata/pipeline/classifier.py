import re
import uuid
from typing import List, Dict, Any, Optional
from strata.models.analysis import ChangeRecord, ChangeType, Materiality, Citation, ConfidenceTier
from strata.models.entities import ProceedingVersion

class ChangeClassifier:
    DEADLINE_KEYWORDS = [r"\bdue\s+date\b", r"\bdeadline\b", r"\bwithin\s+\d+\s+days\b", r"\bmonths\b", r"\btimeline\b", r"\beffective\s+date\b"]
    REQUIREMENT_KEYWORDS = [r"\bmust\b", r"\bshall\b", r"\brequired\s+to\b", r"\bmandatory\b", r"\bprohibited\b", r"\bpenalty\b"]
    SCOPE_KEYWORDS = [r"\bapplies\s+to\b", r"\bcovered\s+entities\b", r"\bthreshold\b", r"\bexempt\b", r"\bexemption\b", r"\bcapacity\b"]
    DEFINITION_KEYWORDS = [r"\bdefined\s+as\b", r"\bmeans\b", r"\bterm\b", r"\bdefinition\b"]

    @classmethod
    def classify_diff_pair(cls, diff_pair: Dict[str, Any], proceeding_id: str, from_version: ProceedingVersion, to_version: ProceedingVersion, llm_client: Optional[Any] = None) -> ChangeRecord:
        diff_type = diff_pair["diff_type"]
        prev_p = diff_pair["prev_para"]
        curr_p = diff_pair["curr_para"]
        
        change_id = f"cr_{uuid.uuid4().hex[:8]}"
        
        before_citation = None
        after_citation = None
        
        if prev_p:
            before_citation = Citation(
                document_id=proceeding_id,
                version_id=from_version.id,
                section_id=prev_p["section_id"],
                para_id=prev_p["para_id"],
                quoted_text=prev_p["text"]
            )
            
        if curr_p:
            after_citation = Citation(
                document_id=proceeding_id,
                version_id=to_version.id,
                section_id=curr_p["section_id"],
                para_id=curr_p["para_id"],
                quoted_text=curr_p["text"]
            )
            
        target_text = (curr_p["text"] if curr_p else "") + " " + (prev_p["text"] if prev_p else "")
        
        # Check materiality
        is_material = cls._is_material(diff_type, prev_p, curr_p)
        change_type = cls._determine_change_type(diff_type, prev_p, curr_p)
        description = cls._generate_description(change_type, is_material, prev_p, curr_p)
        
        # Evaluate confidence
        confidence = ConfidenceTier.HIGH
        signals = []

        # Optional Live LLM Enrichment
        if llm_client and getattr(llm_client, "provider", "mock") != "mock" and curr_p:
            try:
                llm_out = llm_client.classify_materiality(
                    prev_p["text"] if prev_p else "",
                    curr_p["text"] if curr_p else ""
                )
                if "materiality" in llm_out:
                    is_material = (str(llm_out["materiality"]).upper() == "MATERIAL")
                if "change_type" in llm_out:
                    c_type_str = str(llm_out["change_type"]).upper()
                    matched_type = next((t for t in ChangeType if t.value == c_type_str or t.name == c_type_str), None)
                    if matched_type:
                        change_type = matched_type
                if "description" in llm_out:
                    description = f"[{llm_client.model}] {llm_out['description']}"
                
                # Verify LLM citation span deterministically
                if llm_out.get("verbatim_quote"):
                    v_quote = llm_out["verbatim_quote"]
                    if curr_p and v_quote in curr_p["text"]:
                        after_citation = Citation(
                            document_id=proceeding_id,
                            version_id=to_version.id,
                            section_id=curr_p["section_id"],
                            para_id=curr_p["para_id"],
                            quoted_text=v_quote
                        )
                    else:
                        signals.append("SIG_CITE_FAIL: LLM quoted span failed exact substring check")
                        confidence = ConfidenceTier.LOW
            except Exception as e:
                signals.append(f"SIG_LLM_FALLBACK: {str(e)[:60]}")
        
        # Check for undefined ambiguous terms
        if re.search(r"\b(ancillary emergency generation asset|reasonable efforts|as appropriate)\b", target_text, re.IGNORECASE):
            confidence = ConfidenceTier.LOW
            signals.append("SIG_AMBIG_TERM: Undefined statutory phrasing detected")

        if any(re.search(kw, target_text, re.IGNORECASE) for kw in cls.DEADLINE_KEYWORDS + cls.SCOPE_KEYWORDS):
            if confidence != ConfidenceTier.LOW:
                confidence = ConfidenceTier.MEDIUM
                signals.append("SIG_HIGH_STAKES: Change touches operational deadlines or coverage scope")

        return ChangeRecord(
            id=change_id,
            proceeding_id=proceeding_id,
            from_version_id=from_version.id,
            to_version_id=to_version.id,
            change_type=change_type,
            materiality=Materiality.MATERIAL if is_material else Materiality.IMMATERIAL,
            description=description,
            before_citation=before_citation,
            after_citation=after_citation,
            confidence=confidence,
            confidence_signals=signals,
            confidence_rationale="Evaluated via deterministic materiality & confidence rubric"
        )

    @classmethod
    def create_status_transition_record(cls, proceeding_id: str, prev_version: ProceedingVersion, curr_version: ProceedingVersion) -> ChangeRecord:
        """Emits a high-salience status transition record (e.g. PROPOSED -> FINAL)."""
        change_id = f"cr_status_{uuid.uuid4().hex[:8]}"
        desc = f"Proceeding status transitioned from {prev_version.status.value} to {curr_version.status.value} ({curr_version.version_label})."
        
        first_curr_p = curr_version.sections[0].paragraphs[0] if curr_version.sections and curr_version.sections[0].paragraphs else None
        first_prev_p = prev_version.sections[0].paragraphs[0] if prev_version.sections and prev_version.sections[0].paragraphs else None

        return ChangeRecord(
            id=change_id,
            proceeding_id=proceeding_id,
            from_version_id=prev_version.id,
            to_version_id=curr_version.id,
            change_type=ChangeType.STATUS_TRANSITION,
            materiality=Materiality.MATERIAL,
            description=desc,
            before_citation=Citation(
                document_id=proceeding_id,
                version_id=prev_version.id,
                section_id=first_prev_p["section_id"] if isinstance(first_prev_p, dict) else first_prev_p.para_id,
                para_id=first_prev_p["para_id"] if isinstance(first_prev_p, dict) else first_prev_p.para_id,
                quoted_text=first_prev_p["text"] if isinstance(first_prev_p, dict) else first_prev_p.text
            ) if first_prev_p else None,
            after_citation=Citation(
                document_id=proceeding_id,
                version_id=curr_version.id,
                section_id=first_curr_p["section_id"] if isinstance(first_curr_p, dict) else first_curr_p.para_id,
                para_id=first_curr_p["para_id"] if isinstance(first_curr_p, dict) else first_curr_p.para_id,
                quoted_text=first_curr_p["text"] if isinstance(first_curr_p, dict) else first_curr_p.text
            ) if first_curr_p else None,
            confidence=ConfidenceTier.HIGH,
            confidence_signals=["SIG_CLEAN_GROUND"],
            confidence_rationale="Explicit status transition detected in filing preamble"
        )

    @classmethod
    def _is_material(cls, diff_type: str, prev_p: Optional[Dict], curr_p: Optional[Dict]) -> bool:
        if diff_type in ["ADDED", "REMOVED"]:
            text = (curr_p or prev_p)["text"]
            # Formatting or header only is immaterial
            if len(text.split()) < 5 and not any(re.search(kw, text, re.IGNORECASE) for kw in cls.REQUIREMENT_KEYWORDS):
                return False
            return True
        
        # Modified
        p_text = prev_p["text"].lower()
        c_text = curr_p["text"].lower()
        
        # Check if only whitespace/punctuation changed
        if "".join(p_text.split()) == "".join(c_text.split()):
            return False
            
        # Check for substantive trigger keywords
        all_keywords = cls.DEADLINE_KEYWORDS + cls.REQUIREMENT_KEYWORDS + cls.SCOPE_KEYWORDS + cls.DEFINITION_KEYWORDS
        has_substantive = any(re.search(kw, c_text) or re.search(kw, p_text) for kw in all_keywords)
        return has_substantive or len(c_text) > 30

    @classmethod
    def _determine_change_type(cls, diff_type: str, prev_p: Optional[Dict], curr_p: Optional[Dict]) -> ChangeType:
        if diff_type == "ADDED":
            return ChangeType.NEW_REQUIREMENT
        elif diff_type == "REMOVED":
            return ChangeType.REQUIREMENT_REMOVED
        
        c_text = curr_p["text"]
        p_text = prev_p["text"]
        
        if any(re.search(kw, c_text, re.IGNORECASE) for kw in cls.DEADLINE_KEYWORDS):
            return ChangeType.DEADLINE_SHIFT
        elif any(re.search(kw, c_text, re.IGNORECASE) for kw in cls.SCOPE_KEYWORDS):
            return ChangeType.SCOPE_CHANGE
        elif any(re.search(kw, c_text, re.IGNORECASE) for kw in cls.DEFINITION_KEYWORDS):
            return ChangeType.DEFINITION_CHANGE
        return ChangeType.NEW_REQUIREMENT

    @classmethod
    def _generate_description(cls, change_type: ChangeType, is_material: bool, prev_p: Optional[Dict], curr_p: Optional[Dict]) -> str:
        if not is_material:
            return "Non-substantive structural or formatting modification."
        
        if change_type == ChangeType.DEADLINE_SHIFT:
            return f"Shift in regulatory timeline or reporting deadline: '{curr_p['text'][:90]}...'"
        elif change_type == ChangeType.SCOPE_CHANGE:
            return f"Modification of applicability threshold or covered facility scope: '{curr_p['text'][:90]}...'"
        elif change_type == ChangeType.NEW_REQUIREMENT:
            return f"Introduction of new operational requirement: '{curr_p['text'][:90]}...'"
        elif change_type == ChangeType.REQUIREMENT_REMOVED:
            return f"Removal of prior regulatory provision: '{prev_p['text'][:90]}...'"
        return f"Material regulatory revision: '{curr_p['text'][:90]}...'"
