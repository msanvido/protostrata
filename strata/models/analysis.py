from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field

class ChangeType(str, Enum):
    NEW_REQUIREMENT = "NEW_REQUIREMENT"
    DEADLINE_SHIFT = "DEADLINE_SHIFT"
    SCOPE_CHANGE = "SCOPE_CHANGE"
    REQUIREMENT_REMOVED = "REQUIREMENT_REMOVED"
    DEFINITION_CHANGE = "DEFINITION_CHANGE"
    STATUS_TRANSITION = "STATUS_TRANSITION"
    OTHER = "OTHER"

class Materiality(str, Enum):
    MATERIAL = "MATERIAL"
    IMMATERIAL = "IMMATERIAL"

class ConfidenceTier(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class ActionUrgency(str, Enum):
    MONITOR = "MONITOR"
    ACT_SOON = "ACT_SOON"
    ACT_NOW = "ACT_NOW"

class ActionState(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    MODIFIED = "MODIFIED"
    REJECTED = "REJECTED"
    DONE = "DONE"

class Citation(BaseModel):
    document_id: str
    version_id: str
    section_id: str
    para_id: str
    sentence_ids: List[str] = Field(default_factory=list)
    quoted_text: str

class ChangeRecord(BaseModel):
    id: str
    proceeding_id: str
    from_version_id: Optional[str] = None
    to_version_id: str
    change_type: ChangeType
    materiality: Materiality
    description: str
    before_citation: Optional[Citation] = None
    after_citation: Optional[Citation] = None
    confidence: ConfidenceTier = ConfidenceTier.HIGH
    confidence_signals: List[str] = Field(default_factory=list)
    confidence_rationale: Optional[str] = None
    detected_at: Optional[str] = None

class ImpactMapping(BaseModel):
    id: str
    change_id: str
    affected_type: str  # "OBLIGATION", "PROJECT", "DOCUMENT"
    affected_id: str
    rationale: str
    change_citation: Citation
    affected_citation: Citation
    confidence: ConfidenceTier = ConfidenceTier.HIGH
    confidence_signals: List[str] = Field(default_factory=list)
    created_at: Optional[str] = None

class ActionRecommendation(BaseModel):
    id: str
    mapping_id: str
    recommended_action: str
    suggested_owner_id: str
    urgency: ActionUrgency
    state: ActionState = ActionState.PENDING
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
