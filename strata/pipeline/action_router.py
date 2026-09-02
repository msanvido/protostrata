import uuid
from typing import Optional, Dict, Any, List
from strata.models.analysis import ImpactMapping, ActionRecommendation, ActionUrgency, ActionState, ConfidenceTier
from strata.models.entities import ProceedingStatus, Obligation, Project, InternalDocument

class ActionRouter:
    @classmethod
    def generate_and_route(
        cls,
        mapping: ImpactMapping,
        proceeding_status: ProceedingStatus,
        change_type: str,
        owner_lookup: Dict[str, str] # entity_id -> user_id
    ) -> Optional[ActionRecommendation]:
        """
        Generates an actionable recommendation record and routes to the deterministic owner.
        Structurally blocked if mapping confidence is LOW.
        """
        if mapping.confidence == ConfidenceTier.LOW:
            # Low-confidence items are structurally blocked from generating actionable records
            return None

        # Resolve owner deterministically from affected item metadata
        owner_id = owner_lookup.get(mapping.affected_id, "admin")

        # Determine urgency based on hard business rules
        urgency = cls._determine_urgency(proceeding_status, change_type)

        # Generate action recommendation description
        action_text = cls._generate_action_text(mapping, change_type)

        return ActionRecommendation(
            id=f"act_{uuid.uuid4().hex[:8]}",
            mapping_id=mapping.id,
            recommended_action=action_text,
            suggested_owner_id=owner_id,
            urgency=urgency,
            state=ActionState.PENDING
        )

    @classmethod
    def _determine_urgency(cls, status: ProceedingStatus, change_type: str) -> ActionUrgency:
        if change_type == "STATUS_TRANSITION" and status == ProceedingStatus.FINAL:
            return ActionUrgency.ACT_NOW
        
        if status in [ProceedingStatus.DRAFT, ProceedingStatus.PROPOSED]:
            return ActionUrgency.MONITOR
        
        if status == ProceedingStatus.FINAL:
            return ActionUrgency.ACT_NOW
            
        return ActionUrgency.MONITOR

    @classmethod
    def _generate_action_text(cls, mapping: ImpactMapping, change_type: str) -> str:
        if mapping.affected_type == "OBLIGATION":
            return f"Review and adjust operating parameters for obligation {mapping.affected_id} to satisfy {mapping.rationale[:90]}."
        elif mapping.affected_type == "PROJECT":
            return f"Initiate workstream review for project {mapping.affected_id}; update project milestone timelines and engineering design."
        elif mapping.affected_type == "DOC_PARA":
            return f"Review and revise Section {mapping.affected_citation.section_id} of internal document {mapping.affected_citation.document_id} to align with new regulatory requirement."
        return f"Evaluate compliance impact for {mapping.affected_id}: {mapping.rationale}"
