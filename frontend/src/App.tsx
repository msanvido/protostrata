import React, { useState, useEffect } from 'react';
import { api } from './api/client';
import type { 
  Project, 
  Proceeding,
  Obligation, 
  ChangeRecord, 
  ActionRecommendation, 
  EscalatedItem, 
  AuditDossier,
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
  const [changeRecords, setChangeRecords] = useState<ChangeRecord[]>([]);
  const [actions, setActions] = useState<ActionRecommendation[]>([]);
  const [escalatedItems, setEscalatedItems] = useState<EscalatedItem[]>([]);
  
  const [dossier, setDossier] = useState<AuditDossier | null>(null);
  const [isDossierLoading, setIsDossierLoading] = useState<boolean>(false);
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
      const [projs, obls, acts, procs, docs] = await Promise.all([
        api.getProjects(),
        api.getObligations(),
        api.getActions(),
        api.getProceedings(),
        api.getDocuments()
      ]);
      setProjects(projs);
      setObligations(obls);
      setActions(acts);
      setProceedings(procs);
      setDocuments(docs);

      // Load initial dossier
      fetchAuditDossier('obligation:OBL-CEMS-02');
    } catch (err) {
      console.error('Failed to load initial context:', err);
    }
  };

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const prevVer = currentProceeding === 'FERC-RM22-14' ? 'FERC-RM22-14_nopr' : 'EPA-NSPS-KKKK_draft_revision';
      const currVer = currentProceeding === 'FERC-RM22-14' ? 'FERC-RM22-14_final_rule' : 'EPA-NSPS-KKKK_final_rule';

      const result = await api.runAnalysis(currentProceeding, prevVer, currVer);

      setChangeRecords(result.change_records || []);
      setActions(result.actions || []);
      setEscalatedItems(result.escalated_items || []);

      // Refresh default dossier
      fetchAuditDossier(currentProceeding === 'FERC-RM22-14' ? 'obligation:OBL-RIDETHRU-03' : 'obligation:OBL-CEMS-02');
    } catch (err) {
      alert('Analysis execution failed: ' + err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRecordOverride = async (actionId: string, updatedText: string, rationale: string) => {
    await api.recordOverride(actionId, 'u_compliance', updatedText, rationale);
    const refreshed = await api.getActions();
    setActions(refreshed);
    if (dossier) {
      fetchAuditDossier(dossier.stream_id);
    }
  };

  const handleTransitionAction = async (actionId: string, newState: string) => {
    try {
      const updated = await api.transitionAction(actionId, newState, 'u_user');
      setActions(prev => prev.map(a => a.id === actionId ? updated : a));
    } catch (err) {
      console.error('Failed to transition action:', err);
    }
  };

  const handleResolveExpert = async (targetId: string, decision: string, rationale: string) => {
    await api.resolveExpertReview(targetId, 'u_counsel', decision, rationale);
    handleRunAnalysis();
  };

  const fetchAuditDossier = async (streamId: string) => {
    setIsDossierLoading(true);
    try {
      const res = await api.getAuditDossier(streamId);
      setDossier(res);
    } catch (err) {
      console.error('Failed to fetch audit dossier:', err);
    } finally {
      setIsDossierLoading(false);
    }
  };

  const handleCreateProject = async (project: Partial<Project>) => {
    await api.createProject(project);
    const refreshed = await api.getProjects();
    setProjects(refreshed);
    if (project.id) setSelectedProjectId(project.id);
    fetchAuditDossier(`project:${project.id}`);
  };

  const handleCreateProceeding = async (data: any) => {
    const res = await api.createProceeding(data);
    const procs = await api.getProceedings();
    setProceedings(procs);
    setCurrentProceeding(data.id);
    if (res.analysis) {
      setChangeRecords(res.analysis.change_records || []);
      setActions(res.analysis.actions || []);
      setEscalatedItems(res.analysis.escalated_items || []);
    }
    fetchAuditDossier(`proceeding:${data.id}`);
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
            escalatedCount={escalatedItems.length}
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
            changeRecords={changeRecords}
            actions={actions}
            escalatedItems={escalatedItems}
            dossier={dossier}
            isDossierLoading={isDossierLoading}
            currentProceeding={currentProceeding}
            isAnalyzing={isAnalyzing}
            onProceedingChange={setCurrentProceeding}
            onRunAnalysis={handleRunAnalysis}
            onOpenNewRegulation={() => setIsNewRegulationModalOpen(true)}
            onOpenOverride={(action) => setOverrideAction(action)}
            onTransitionActionState={handleTransitionAction}
            onResolveExpert={handleResolveExpert}
            onFetchDossier={fetchAuditDossier}
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
