export type Materiality = 'MATERIAL' | 'IMMATERIAL';
export type ChangeType = 
  | 'NEW_REQUIREMENT'
  | 'DEADLINE_SHIFT'
  | 'SCOPE_CHANGE'
  | 'DEFINITION_CHANGE'
  | 'REQUIREMENT_REMOVED'
  | 'STATUS_TRANSITION'
  | 'EDITORIAL';

export type ConfidenceTier = 'HIGH' | 'MEDIUM' | 'LOW';
export type Urgency = 'MONITOR' | 'ACT_SOON' | 'ACT_NOW';
export type ActionState = 'PENDING' | 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | 'DONE';

export interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  status: string;
  linked_obligations?: string[];
  created_at?: string;
}

export interface Obligation {
  id: string;
  description: string;
  owner_id: string;
  status: string;
  linked_doc_id?: string;
  created_at: string;
}

export interface ProceedingVersionSummary {
  id: string;
  version_label: string;
  status: string;
  filed_date?: string;
  effective_date?: string;
  sections_count?: number;
  raw_text?: string;
  sections?: any[];
}

export interface InternalDocument {
  id: string;
  title: string;
  doc_type: string;
  owner_id: string;
  current_version: number;
  raw_text: string;
  sections?: any[];
  created_at?: string;
}

export interface Proceeding {
  id: string;
  docket_id: string;
  title: string;
  jurisdiction: string;
  versions?: ProceedingVersionSummary[];
}

export interface Citation {
  document_id: string;
  version_id: string;
  section_id: string;
  para_id: string;
  start_offset?: number;
  end_offset?: number;
  quoted_text: string;
}

export interface ChangeRecord {
  id: string;
  proceeding_id: string;
  from_version_id?: string;
  to_version_id: string;
  change_type: ChangeType;
  materiality: Materiality;
  description: string;
  before_citation?: Citation;
  after_citation?: Citation;
  confidence: ConfidenceTier;
  confidence_signals: string[];
  confidence_rationale?: string;
  detected_at?: string;
}

export interface ActionRecommendation {
  id: string;
  mapping_id: string;
  recommended_action: string;
  suggested_owner_id: string;
  urgency: Urgency;
  state: ActionState;
  created_at?: string;
  updated_at?: string;
}

export interface EscalatedItem {
  change: ChangeRecord;
  mapping?: any;
  signals: string[];
}

export interface AnalysisResult {
  proceeding_id: string;
  from_version: string;
  to_version: string;
  status_transition?: string;
  total_changes: number;
  material_changes: number;
  impact_mappings: number;
  actions_created: number;
  escalated_to_expert_review: number;
  change_records: ChangeRecord[];
  actions: ActionRecommendation[];
  escalated_items: EscalatedItem[];
}

export interface AuditEventItem {
  id: string;
  timestamp: string;
  event_type: string;
  actor: string;
  summary: string;
  payload: any;
}

export interface AuditDossier {
  stream_id: string;
  total_events: number;
  reconstructed_timeline: AuditEventItem[];
}
