from typing import List, Optional, Tuple, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field
from datetime import date, datetime

class ProceedingStatus(str, Enum):
    DRAFT = "DRAFT"
    PROPOSED = "PROPOSED"
    FINAL = "FINAL"
    WITHDRAWN = "WITHDRAWN"

class ObligationStatus(str, Enum):
    ACTIVE = "ACTIVE"
    SUPERSEDED = "SUPERSEDED"
    CLOSED = "CLOSED"

class DocumentType(str, Enum):
    POLICY = "POLICY"
    PROCEDURE = "PROCEDURE"
    CONTRACT = "CONTRACT"
    FILING = "FILING"

class UserRole(str, Enum):
    REVIEWER = "REVIEWER"
    ASSIGNEE = "ASSIGNEE"
    LEAD = "LEAD"
    ADMIN = "ADMIN"

class CharSpan(BaseModel):
    start: int
    end: int

class Sentence(BaseModel):
    sentence_id: str
    text: str
    char_span: CharSpan

class Paragraph(BaseModel):
    para_id: str
    text: str
    sentences: List[Sentence] = Field(default_factory=list)

class Section(BaseModel):
    section_id: str
    heading: str
    paragraphs: List[Paragraph] = Field(default_factory=list)

class User(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    created_at: Optional[str] = None

class Proceeding(BaseModel):
    id: str
    docket_id: str
    title: str
    jurisdiction: str
    created_at: Optional[str] = None

class ProceedingVersion(BaseModel):
    id: str
    proceeding_id: str
    version_label: str
    status: ProceedingStatus
    filed_date: str
    effective_date: Optional[str] = None
    comment_due_date: Optional[str] = None
    raw_text: str
    sections: List[Section] = Field(default_factory=list)
    created_at: Optional[str] = None

class InternalDocument(BaseModel):
    id: str
    title: str
    doc_type: DocumentType
    owner_id: str
    current_version: int = 1
    raw_text: str
    sections: List[Section] = Field(default_factory=list)
    created_at: Optional[str] = None

class Obligation(BaseModel):
    id: str
    description: str
    owner_id: str
    status: ObligationStatus = ObligationStatus.ACTIVE
    linked_doc_id: Optional[str] = None
    source_citation: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None

class ProjectMilestone(BaseModel):
    milestone_id: str
    name: str
    due_date: str
    status: str = "PLANNED"

class Project(BaseModel):
    id: str
    name: str
    description: str
    owner_id: str
    status: str = "ACTIVE"
    linked_obligations: List[str] = Field(default_factory=list)
    milestones: List[ProjectMilestone] = Field(default_factory=list)
    created_at: Optional[str] = None
