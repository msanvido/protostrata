from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
import uuid
from datetime import datetime

class ActorType(str, Enum):
    SYSTEM = "SYSTEM"
    USER = "USER"

class AuditEventType(str, Enum):
    PROCEEDING_VERSION_INGESTED = "PROCEEDING_VERSION_INGESTED"
    DOCUMENT_INGESTED = "DOCUMENT_INGESTED"
    CHANGE_DETECTED = "CHANGE_DETECTED"
    STATUS_TRANSITION_DETECTED = "STATUS_TRANSITION_DETECTED"
    IMPACT_MAPPED = "IMPACT_MAPPED"
    ACTION_RECOMMENDED = "ACTION_RECOMMENDED"
    ACTION_ESCALATED_TO_EXPERT = "ACTION_ESCALATED_TO_EXPERT"
    EXPERT_REVIEW_RESOLVED = "EXPERT_REVIEW_RESOLVED"
    ACTION_STATE_CHANGED = "ACTION_STATE_CHANGED"
    HUMAN_OVERRIDE_RECORDED = "HUMAN_OVERRIDE_RECORDED"

class AuditEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stream_id: str  # e.g., "obligation:OBL-NOX-01" or "proceeding:FERC-2023"
    event_type: AuditEventType
    actor_type: ActorType
    actor_id: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    linked_citations: List[Dict[str, Any]] = Field(default_factory=list)
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
