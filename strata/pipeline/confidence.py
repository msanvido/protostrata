from typing import List, Tuple, Dict, Any
from strata.models.analysis import ConfidenceTier, ImpactMapping, ChangeRecord

class ConfidenceRubric:
    @classmethod
    def evaluate(cls, signals: List[str]) -> Tuple[ConfidenceTier, str]:
        """
        Evaluates signals against the transparent confidence rubric:
        - SIG_CITE_FAIL -> forces LOW
        - SIG_AMBIG_TERM -> forces LOW
        - SIG_RANK_TIE -> caps at MEDIUM
        - SIG_HIGH_STAKES -> caps at MEDIUM
        - Otherwise HIGH
        """
        reasons = []
        for s in signals:
            if s.startswith("SIG_CITE_FAIL"):
                return ConfidenceTier.LOW, "Programmatic citation verification failed against immutable source snapshot"
            if s.startswith("SIG_AMBIG_TERM"):
                return ConfidenceTier.LOW, "Statutory language contains ambiguous or undefined key legal terms requiring expert review"
            if s.startswith("SIG_RANK_TIE"):
                reasons.append("Multiple enterprise assets matched with close proximity")
            if s.startswith("SIG_HIGH_STAKES"):
                reasons.append("Change touches statutory deadlines, civil penalties, or applicability scope")

        if any(s.startswith("SIG_RANK_TIE") or s.startswith("SIG_HIGH_STAKES") for s in signals):
            return ConfidenceTier.MEDIUM, "; ".join(reasons)

        return ConfidenceTier.HIGH, "All citations verified; unambiguous legal grounding and distinct asset mapping"

    @classmethod
    def should_escalate_to_expert_review(cls, confidence: ConfidenceTier) -> bool:
        """Structural gate: items with LOW confidence MUST be routed to Expert Review."""
        return confidence == ConfidenceTier.LOW
