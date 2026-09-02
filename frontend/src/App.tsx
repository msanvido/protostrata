import React, { useState, useEffect } from 'react';
import { api } from './api/client';
import type { 
  Project, 
  Obligation, 
  ChangeRecord, 
  ActionRecommendation, 
  EscalatedItem, 
  AuditDossier 
} from './types';

import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { ChangeDiffViewer } from './components/ChangeDiffViewer';
import { ActionInbox } from './components/ActionInbox';
import { ExpertReviewQueue } from './components/ExpertReviewQueue';
import { AuditTimelineStream } from './components/AuditTimelineStream';
import { HumanOverrideModal } from './components/HumanOverrideModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'changes' | 'actions' | 'expert' | 'audit'>('overview');
  const [currentProceeding, setCurrentProceeding] = useState<string>('FERC-RM22-14');

  const [projects, setProjects] = useState<Project[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [changeRecords, setChangeRecords] = useState<ChangeRecord[]>([]);
  const [actions, setActions] = useState<ActionRecommendation[]>([]);
  const [escalatedItems, setEscalatedItems] = useState<EscalatedItem[]>([]);
  
  const [dossier, setDossier] = useState<AuditDossier | null>(null);
  const [isDossierLoading, setIsDossierLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const [overrideAction, setOverrideAction] = useState<ActionRecommendation | null>(null);

  // Initial Data Load
  useEffect(() => {
    loadInitialContext();
  }, []);

  const loadInitialContext = async () => {
    try {
      const [projs, obls, acts] = await Promise.all([
        api.getProjects(),
        api.getObligations(),
        api.getActions()
      ]);
      setProjects(projs);
      setObligations(obls);
      setActions(acts);

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

      // If EPA, switch to expert review or changes
      if (result.escalated_items && result.escalated_items.length > 0) {
        setActiveTab('expert');
      } else {
        setActiveTab('changes');
      }

      // Refresh default dossier
      fetchAuditDossier(currentProceeding === 'FERC-RM22-14' ? 'obligation:OBL-RIDETHRU-03' : 'obligation:OBL-CEMS-02');
    } catch (err) {
      alert('Analysis execution failed: ' + err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRecordOverride = async (actionId: string, updatedText: string, rationale: string) => {
    await api.recordOverride(actionId, 'u_reviewer', updatedText, rationale);
    // Refresh actions
    const refreshed = await api.getActions();
    setActions(refreshed);
    // Refresh active dossier
    if (dossier) {
      fetchAuditDossier(dossier.stream_id);
    }
  };

  const handleResolveExpert = async (targetId: string, decision: string, rationale: string) => {
    await api.resolveExpertReview(targetId, 'u_counsel', decision, rationale);
    // Refresh analysis
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

  return (
    <div className="app-shell">
      <Header
        currentProceeding={currentProceeding}
        onProceedingChange={setCurrentProceeding}
        onRunAnalysis={handleRunAnalysis}
        isAnalyzing={isAnalyzing}
      />

      {/* Navigation Tabs */}
      <nav className="app-nav">
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Dashboard & Overview
          </button>
          <button
            className={`nav-tab ${activeTab === 'changes' ? 'active' : ''}`}
            onClick={() => setActiveTab('changes')}
          >
            Change Records{' '}
            <span className="tab-pill">{changeRecords.length}</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            Action Inbox{' '}
            <span className="tab-pill">{actions.length}</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'expert' ? 'active' : ''}`}
            onClick={() => setActiveTab('expert')}
          >
            Expert Review Queue{' '}
            <span className={`tab-pill ${escalatedItems.length > 0 ? 'alert' : ''}`}>
              {escalatedItems.length}
            </span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            Living Audit Dossier
          </button>
        </div>

        <div className="nav-meta">
          Enterprise Context: <strong>{projects.length} Projects · {obligations.length} Obligations</strong>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="app-main">
        {activeTab === 'overview' && (
          <OverviewTab
            projects={projects}
            obligations={obligations}
            materialChangesCount={changeRecords.filter(c => c.materiality === 'MATERIAL').length}
            escalatedCount={escalatedItems.length}
          />
        )}

        {activeTab === 'changes' && (
          <ChangeDiffViewer changeRecords={changeRecords} />
        )}

        {activeTab === 'actions' && (
          <ActionInbox
            actions={actions}
            onOpenOverride={(action) => setOverrideAction(action)}
          />
        )}

        {activeTab === 'expert' && (
          <ExpertReviewQueue
            escalatedItems={escalatedItems}
            onResolve={handleResolveExpert}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTimelineStream
            dossier={dossier}
            isLoading={isDossierLoading}
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
    </div>
  );
};

export default App;
