import React, { useState, useEffect } from 'react';
import { api } from './api/client';
import type { 
  Project, 
  Proceeding, 
  Obligation, 
  ChangeRecord, 
  ActionRecommendation, 
  ActionState,
  EscalatedItem, 
  ExpertReviewRecord,
  InternalDocument
} from './types';

import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ProjectLeadView } from './components/ProjectLeadView';
import { ComplianceAnalystView } from './components/ComplianceAnalystView';
import { HumanOverrideModal } from './components/HumanOverrideModal';
import { NewProjectModal } from './components/NewProjectModal';
import { NewRegulationModal } from './components/NewRegulationModal';

export const App: React.FC = () => {
  // Primary View Mode: Dashboard vs Project Lead vs Compliance Analyst
  const [viewMode, setViewMode] = useState<'dashboard' | 'project_lead' | 'compliance_analyst'>('dashboard');

  const [currentProceeding, setCurrentProceeding] = useState<string>('FERC-RM22-14');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');

  const [projects, setProjects] = useState<Project[]>([]);
  const [proceedings, setProceedings] = useState<Proceeding[]>([]);
  const [documents, setDocuments] = useState<InternalDocument[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [actions, setActions] = useState<ActionRecommendation[]>([]);
  const [expertReviewRecords, setExpertReviewRecords] = useState<ExpertReviewRecord[]>([]);
  const [analyzedByProceeding, setAnalyzedByProceeding] = useState<Record<string, {
    changeRecords: ChangeRecord[];
    actions: ActionRecommendation[];
    escalatedItems: EscalatedItem[];
  }>>({});

  // Merge persisted OPEN expert reviews (survive reloads) with the current analysis escalations
  const currentEscalatedItems: EscalatedItem[] = (() => {
    const analysisItems = analyzedByProceeding[currentProceeding]?.escalatedItems || [];
    const seen = new Set(analysisItems.map(i => i.mapping?.id || i.change?.id));
    const fromDb = expertReviewRecords
      .filter(r => r.status === 'OPEN' && !seen.has(r.id))
      .map(r => ({
        change: { id: r.change_id || r.id, description: r.change_description } as ChangeRecord,
        mapping: r.mapping_id ? { id: r.mapping_id } : undefined,
        signals: r.signals,
      }));
    return [...analysisItems, ...fromDb];
  })();

  const currentAnalysis = {
    changeRecords: analyzedByProceeding[currentProceeding]?.changeRecords || [],
    actions: analyzedByProceeding[currentProceeding]?.actions || [],
    escalatedItems: currentEscalatedItems,
  };
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const [overrideAction, setOverrideAction] = useState<ActionRecommendation | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState<boolean>(false);
  const [isNewRegulationModalOpen, setIsNewRegulationModalOpen] = useState<boolean>(false);

  // Initial Data Load
  useEffect(() => {
    loadInitialContext();
  }, []);

  const loadInitialContext = async () => {
    try {
      const [projs, obls, acts, procs, docs, reviews] = await Promise.all([
        api.getProjects(),
        api.getObligations(),
        api.getActions(),
        api.getProceedings(),
        api.getDocuments(),
        api.getExpertReviews()
      ]);
      setProjects(projs);
      setObligations(obls);
      setActions(acts);
      setProceedings(procs);
      setDocuments(docs);
      setExpertReviewRecords(reviews);
    } catch (err) {
      console.error('Failed to load initial context:', err);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const proc = proceedings.find(p => p.id === currentProceeding);
      let prevVer = '';
      let currVer = '';
      if (proc && proc.versions && proc.versions.length >= 2) {
        prevVer = proc.versions[0].id;
        currVer = proc.versions[proc.versions.length - 1].id;
      } else if (proc && proc.versions && proc.versions.length === 1) {
        currVer = proc.versions[0].id;
      } else {
        prevVer = currentProceeding === 'FERC-RM22-14' ? 'FERC-RM22-14_nopr' : 'EPA-NSPS-KKKK_draft_revision';
        currVer = currentProceeding === 'FERC-RM22-14' ? 'FERC-RM22-14_final_rule' : 'EPA-NSPS-KKKK_final_rule';
      }

      const result = await api.runAnalysis(currentProceeding, prevVer, currVer);

      const newAnalysis = {
        changeRecords: result.change_records || [],
        actions: result.actions || [],
        escalatedItems: result.escalated_items || [],
      };

      setAnalyzedByProceeding(prev => ({
        ...prev,
        [currentProceeding]: newAnalysis
      }));

      // Refresh global actions, obligations, projects, and the persisted expert queue
      const [allActs, allObls, allProjs, reviews] = await Promise.all([
        api.getActions(),
        api.getObligations(),
        api.getProjects(),
        api.getExpertReviews()
      ]);
      setActions(allActs);
      setObligations(allObls);
      setProjects(allProjs);
      setExpertReviewRecords(reviews);
    } catch (err) {
      alert('Analysis execution failed: ' + err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const COMPLIANCE_REVIEWER = 'u_compliance';

  const handleRecordOverride = async (action: ActionRecommendation, updatedText: string, rationale: string) => {
    // Persona attribution: modifications of PENDING items are compliance edits; APPROVED/IN_PROGRESS
    // edits come from the assigned project lead. Either way the directive returns to PENDING review.
    const actorId = action.state === 'PENDING' ? COMPLIANCE_REVIEWER : action.suggested_owner_id;
    try {
      const updated = await api.recordOverride(action.id, actorId, updatedText, rationale);
      const updatedState: ActionState = 'PENDING';
      setActions(prev => prev.map(a => a.id === action.id ? { ...a, ...updated, state: updatedState } : a));
      setAnalyzedByProceeding(prev => {
        const next = { ...prev };
        for (const p in next) {
          if (next[p]) {
            next[p] = {
              ...next[p],
              actions: next[p].actions.map(a => a.id === action.id ? { ...a, ...updated, state: updatedState } : a)
            };
          }
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to record override:', err);
      alert('Failed to record override: ' + err);
      throw err;
    }
  };

  const handleTransitionAction = async (actionId: string, newState: string, actorId?: string) => {
    try {
      const targetState = newState as ActionState;
      // Persona attribution: Stage 1 (PENDING -> APPROVED/REJECTED) is compliance; Stage 2
      // (APPROVED/IN_PROGRESS -> IN_PROGRESS/DONE) is the assigned project lead.
      const existing = actions.find(a => a.id === actionId);
      const actor = actorId || (targetState === 'APPROVED' || targetState === 'REJECTED'
        ? COMPLIANCE_REVIEWER
        : existing?.suggested_owner_id || COMPLIANCE_REVIEWER);
      const updated = await api.transitionAction(actionId, newState, actor);
      setActions(prev => prev.map(a => a.id === actionId ? { ...a, ...updated, state: targetState } : a));
      setAnalyzedByProceeding(prev => {
        const next = { ...prev };
        for (const p in next) {
          if (next[p]) {
            next[p] = {
              ...next[p],
              actions: next[p].actions.map(a => a.id === actionId ? { ...a, ...updated, state: targetState } : a)
            };
          }
        }
        return next;
      });

      // When compliance approves, refresh obligations & projects so the adopted obligation appears immediately
      if (targetState === 'APPROVED') {
        const [refreshedObls, refreshedProjs] = await Promise.all([
          api.getObligations(),
          api.getProjects()
        ]);
        setObligations(refreshedObls);
        setProjects(refreshedProjs);
      }
    } catch (err) {
      console.error('Failed to transition action:', err);
      alert('Failed to update action state: ' + err);
    }
  };

  const handleResolveExpert = async (targetId: string, decision: string, rationale: string) => {
    try {
      await api.resolveExpertReview(targetId, 'u_counsel', decision, rationale);
      // Refresh queue + any action released by the confirmation (no full re-analysis needed)
      const [reviews, allActs, allObls, allProjs] = await Promise.all([
        api.getExpertReviews(),
        api.getActions(),
        api.getObligations(),
        api.getProjects()
      ]);
      setExpertReviewRecords(reviews);
      setActions(allActs);
      setObligations(allObls);
      setProjects(allProjs);
      setAnalyzedByProceeding(prev => {
        const next = { ...prev };
        for (const p in next) {
          if (next[p]) {
            next[p] = { ...next[p], escalatedItems: next[p].escalatedItems.filter(i => (i.mapping?.id || i.change?.id) !== targetId) };
          }
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to resolve expert review:', err);
      alert('Failed to resolve expert review: ' + err);
    }
  };

  const handleCreateProject = async (project: Partial<Project>) => {
    await api.createProject(project);
    const refreshed = await api.getProjects();
    setProjects(refreshed);
    if (project.id) setSelectedProjectId(project.id);
  };

  const handleCreateProceeding = async (data: any) => {
    const res = await api.createProceeding(data);
    const procs = await api.getProceedings();
    setProceedings(procs);
    setCurrentProceeding(data.id);
    if (res.analysis) {
      setAnalyzedByProceeding(prev => ({
        ...prev,
        [data.id]: {
          changeRecords: res.analysis.change_records || [],
          actions: res.analysis.actions || [],
          escalatedItems: res.analysis.escalated_items || [],
        }
      }));
    }
  };

  return (
    <div className="app-shell">
      {/* Universal Header with View Switcher */}
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Main Content Area Routed by Persona / View */}
      <main className="app-main" style={{ padding: '1.5rem 2rem' }}>
        {viewMode === 'dashboard' && (
          <DashboardView
            projects={projects}
            proceedings={proceedings}
            obligations={obligations}
            actions={actions}
            escalatedCount={currentAnalysis.escalatedItems.length}
            onNavigateProjectLead={(projId) => {
              if (projId) setSelectedProjectId(projId);
              setViewMode('project_lead');
            }}
            onNavigateCompliance={(procId) => {
              if (procId) setCurrentProceeding(procId);
              setViewMode('compliance_analyst');
            }}
            onOpenNewProject={() => setIsNewProjectModalOpen(true)}
            onOpenNewRegulation={() => setIsNewRegulationModalOpen(true)}
          />
        )}

        {viewMode === 'project_lead' && (
          <ProjectLeadView
            projects={projects}
            proceedings={proceedings}
            obligations={obligations}
            actions={actions}
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
            onTransitionActionState={handleTransitionAction}
            onOpenOverride={(action) => setOverrideAction(action)}
            onOpenNewProject={() => setIsNewProjectModalOpen(true)}
          />
        )}

        {viewMode === 'compliance_analyst' && (
          <ComplianceAnalystView
            proceedings={proceedings}
            documents={documents}
            projects={projects}
            obligations={obligations}
            changeRecords={currentAnalysis.changeRecords}
            actions={actions}
            escalatedItems={currentAnalysis.escalatedItems}
            currentProceeding={currentProceeding}
            isAnalyzing={isAnalyzing}
            onProceedingChange={setCurrentProceeding}
            onRunAnalysis={handleRunAnalysis}
            onOpenNewRegulation={() => setIsNewRegulationModalOpen(true)}
            onOpenOverride={(action) => setOverrideAction(action)}
            onTransitionActionState={handleTransitionAction}
            onResolveExpert={handleResolveExpert}
          />
        )}
      </main>

      {/* Non-Destructive Human Override Modal */}
      <HumanOverrideModal
        action={overrideAction}
        onClose={() => setOverrideAction(null)}
        onSubmit={handleRecordOverride}
      />

      {/* New Project Creation Modal */}
      {isNewProjectModalOpen && (
        <NewProjectModal
          onClose={() => setIsNewProjectModalOpen(false)}
          onSubmit={handleCreateProject}
        />
      )}

      {/* New Regulation Ingestion Modal */}
      {isNewRegulationModalOpen && (
        <NewRegulationModal
          onClose={() => setIsNewRegulationModalOpen(false)}
          onSubmit={handleCreateProceeding}
        />
      )}
    </div>
  );
};

export default App;
