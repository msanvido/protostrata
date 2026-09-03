import type { 
  Project, 
  Obligation, 
  Proceeding, 
  ActionRecommendation, 
  AnalysisResult, 
  AuditDossier,
  InternalDocument
} from '../types';

export const api = {
  async getProjects(): Promise<Project[]> {
    const res = await fetch('/projects');
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async createProject(project: Partial<Project>): Promise<Project> {
    const res = await fetch('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteProject(projectId: string): Promise<void> {
    const res = await fetch(`/projects/${projectId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
  },

  async getObligations(): Promise<Obligation[]> {
    const res = await fetch('/obligations');
    if (!res.ok) throw new Error('Failed to fetch obligations');
    return res.json();
  },

  async getDocuments(): Promise<InternalDocument[]> {
    const res = await fetch('/documents');
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  async getProceedings(): Promise<Proceeding[]> {
    const res = await fetch('/proceedings');
    if (!res.ok) throw new Error('Failed to fetch proceedings');
    return res.json();
  },

  async createProceeding(data: {
    id: string;
    docket_id: string;
    title: string;
    jurisdiction: string;
    version_label: string;
    raw_text: string;
    status: string;
    auto_analyze?: boolean;
  }): Promise<any> {
    const res = await fetch('/proceedings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteProceeding(proceedingId: string): Promise<void> {
    const res = await fetch(`/proceedings/${proceedingId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
  },

  async getActions(ownerId?: string, state?: string): Promise<ActionRecommendation[]> {
    const params = new URLSearchParams();
    if (ownerId) params.append('owner_id', ownerId);
    if (state) params.append('state', state);
    const res = await fetch(`/actions?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch actions');
    return res.json();
  },

  async runAnalysis(proceedingId: string, prevVersionId: string, currVersionId: string): Promise<AnalysisResult> {
    const res = await fetch(`/analyze?proceeding_id=${proceedingId}&prev_version_id=${prevVersionId}&curr_version_id=${currVersionId}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async recordOverride(actionId: string, userId: string, updatedText: string, rationale: string): Promise<ActionRecommendation> {
    const params = new URLSearchParams({
      user_id: userId,
      updated_text: updatedText,
      rationale: rationale
    });
    const res = await fetch(`/actions/${actionId}/override?${params.toString()}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async transitionAction(actionId: string, userId: string, newState: string, notes: string = ''): Promise<ActionRecommendation> {
    const params = new URLSearchParams({
      user_id: userId,
      new_state: newState,
      notes: notes
    });
    const res = await fetch(`/actions/${actionId}/transition?${params.toString()}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async resolveExpertReview(targetId: string, reviewerId: string, decision: string, rationale: string): Promise<any> {
    const params = new URLSearchParams({
      reviewer_id: reviewerId,
      decision: decision,
      rationale: rationale
    });
    const res = await fetch(`/expert_review/${targetId}/resolve?${params.toString()}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getAuditDossier(streamId: string): Promise<AuditDossier> {
    const res = await fetch(`/audit/${encodeURIComponent(streamId)}`);
    if (!res.ok) throw new Error('Failed to fetch audit dossier');
    return res.json();
  }
};
