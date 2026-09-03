import React, { useState } from 'react';
import type { 
  Project, 
  Proceeding, 
  Obligation, 
  ChangeRecord, 
  ActionRecommendation, 
  EscalatedItem, 
  AuditDossier,
  InternalDocument
} from '../types';

import { ChangeDiffViewer } from './ChangeDiffViewer';
import { ActionInbox } from './ActionInbox';
import { ExpertReviewQueue } from './ExpertReviewQueue';
import { AuditTimelineStream } from './AuditTimelineStream';
import { FullTextDrawer } from './FullTextDrawer';

interface ComplianceAnalystViewProps {
  proceedings: Proceeding[];
  documents: InternalDocument[];
  projects: Project[];
  obligations: Obligation[];
  changeRecords: ChangeRecord[];
  actions: ActionRecommendation[];
  escalatedItems: EscalatedItem[];
  dossier: AuditDossier | null;
  isDossierLoading: boolean;
  currentProceeding: string;
  isAnalyzing: boolean;
  onProceedingChange: (val: string) => void;
  onRunAnalysis: () => void;
  onOpenNewRegulation: () => void;
  onOpenOverride: (action: ActionRecommendation) => void;
  onTransitionActionState: (actionId: string, newState: string) => void;
  onResolveExpert: (targetId: string, decision: string, rationale: string) => Promise<void>;
  onFetchDossier: (streamId: string) => void;
}

export const ComplianceAnalystView: React.FC<ComplianceAnalystViewProps> = ({
  proceedings,
  documents,
  projects,
  obligations,
  changeRecords,
  actions,
  escalatedItems,
  dossier,
  isDossierLoading,
  currentProceeding,
  isAnalyzing,
  onProceedingChange,
  onRunAnalysis,
  onOpenNewRegulation,
  onOpenOverride,
  onTransitionActionState,
  onResolveExpert,
  onFetchDossier,
}) => {
  const [subTab, setSubTab] = useState<'versions_docs' | 'impacts' | 'changes' | 'actions' | 'expert' | 'audit'>('versions_docs');

  // Full Text Side Panel Drawer state
  const [activeFullText, setActiveFullText] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    statusBadge?: string;
    rawText: string;
    sections?: any[];
  }>({
    isOpen: false,
    title: '',
    rawText: '',
  });

  const selectedProc = proceedings.find(p => p.id === currentProceeding) || proceedings[0];
  const latestVersion = selectedProc?.versions && selectedProc.versions.length > 0 
    ? selectedProc.versions[selectedProc.versions.length - 1] 
    : null;
  const isFinal = latestVersion?.status === 'FINAL' || currentProceeding.includes('final') || currentProceeding.includes('FERC');

  // Compute downstream impacted projects based on current docket
  const impactedProjects = projects.filter(proj => {
    const desc = (proj.name + ' ' + proj.description).toLowerCase();
    if (currentProceeding.includes('FERC') && (desc.includes('solar') || desc.includes('storage') || desc.includes('interconnection') || desc.includes('battery'))) return true;
    if (currentProceeding.includes('EPA') && (desc.includes('turbine') || desc.includes('combustion'))) return true;
    if (currentProceeding.includes('NERC') && (desc.includes('substation') || desc.includes('bulk'))) return true;
    return false;
  });

  const materialChangesCount = changeRecords.filter(c => c.materiality === 'MATERIAL').length;

  const openVersionFullText = (ver: any) => {
    setActiveFullText({
      isOpen: true,
      title: `${selectedProc?.title || currentProceeding} (${ver.version_label})`,
      subtitle: `Version ID: ${ver.id} · Filed Date: ${ver.filed_date || 'N/A'} · Status: ${ver.status}`,
      statusBadge: ver.status,
      rawText: ver.raw_text || '',
      sections: ver.sections || [],
    });
  };

  const openDocumentFullText = (doc: InternalDocument) => {
    setActiveFullText({
      isOpen: true,
      title: `${doc.title} (${doc.id})`,
      subtitle: `Document Type: ${doc.doc_type} · Owner: ${doc.owner_id} · Current Version: v${doc.current_version}`,
      statusBadge: doc.doc_type,
      rawText: doc.raw_text || '',
      sections: doc.sections || [],
    });
  };

  return (
    <div className="compliance-analyst-container">
      {/* Docket Monitoring Control Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="comp-docket-select" style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 600 }}>
                Monitored Docket:
              </label>
              <select
                id="comp-docket-select"
                className="select"
                style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                value={currentProceeding}
                onChange={(e) => onProceedingChange(e.target.value)}
              >
                {proceedings.map(proc => (
                  <option key={proc.id} value={proc.id}>
                    {proc.title} ({proc.id})
                  </option>
                ))}
              </select>
            </div>

            <span className={`badge ${isFinal ? 'badge-final' : 'badge-proposed'}`}>
              {latestVersion?.status || (isFinal ? 'FINAL RULE - BINDING' : 'PROPOSED - MONITOR')}
            </span>

            <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
              Jurisdiction: <strong style={{ color: '#38bdf8' }}>{selectedProc?.jurisdiction || 'FERC'}</strong>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenNewRegulation}
            >
              + Ingest Docket
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn btn-primary"
              onClick={onRunAnalysis}
              disabled={isAnalyzing}
            >
              <span>⚡</span> {isAnalyzing ? 'Analyzing Differences...' : 'Run Live Analysis'}
            </button>
          </div>
        </div>
      </div>

      {/* Compliance Subnavigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        <button
          className={`btn ${subTab === 'versions_docs' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setSubTab('versions_docs')}
        >
          📚 Regulatory Versions & Documents ({selectedProc?.versions?.length || 0} Versions)
        </button>
        <button
          className={`btn ${subTab === 'impacts' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setSubTab('impacts')}
        >
          Downstream Impacts ({impactedProjects.length} Projects)
        </button>
        <button
          className={`btn ${subTab === 'changes' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setSubTab('changes')}
        >
          Change Records ({materialChangesCount} Material / {changeRecords.length})
        </button>
        <button
          className={`btn ${subTab === 'actions' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setSubTab('actions')}
        >
          Compliance Action Inbox ({actions.length})
        </button>
        <button
          className={`btn ${subTab === 'expert' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setSubTab('expert')}
          style={{ position: 'relative' }}
        >
          Expert Review Queue
          {escalatedItems.length > 0 && (
            <span style={{ marginLeft: '6px', background: '#ef4444', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
              {escalatedItems.length}
            </span>
          )}
        </button>
        <button
          className={`btn ${subTab === 'audit' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setSubTab('audit')}
        >
          Living Audit Dossier
        </button>
      </div>

      {/* Subtab 1: Regulatory Versions & Governing Internal Documents */}
      {subTab === 'versions_docs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Proceeding Versions Showcase */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Ingested Proceeding Versions for {selectedProc?.title || currentProceeding}</h3>
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                  Every immutable version snapshot ingested into Strata. Click "View Full Text" to inspect the complete unedited text in the side panel.
                </p>
              </div>
              <span className="badge badge-high">{selectedProc?.versions?.length || 0} Versions Ingested</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {selectedProc?.versions && selectedProc.versions.length > 0 ? (
                selectedProc.versions.map((ver, idx) => (
                  <div key={ver.id} className="card stat-card" style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>
                          Version {idx + 1} of {selectedProc.versions?.length}
                        </div>
                        <strong style={{ fontSize: '1rem', color: '#f3f4f6', marginTop: 2, display: 'block' }}>
                          {ver.version_label}
                        </strong>
                      </div>
                      <span className={`badge ${ver.status === 'FINAL' ? 'badge-final' : 'badge-proposed'}`}>
                        {ver.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.75rem 0' }}>
                      <div>Filing Date: <strong style={{ color: '#e5e7eb' }}>{ver.filed_date || 'Initial Filing'}</strong></div>
                      <div style={{ marginTop: '2px' }}>Canonical Coordinates: <strong style={{ color: '#a5b4fc' }}>{ver.sections_count || ver.sections?.length || 0} Sections Segmented</strong></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.65rem' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.78rem' }}
                        onClick={() => openVersionFullText(ver)}
                      >
                        📄 View Full Text (Side Panel) →
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#9ca3af', fontStyle: 'italic' }}>No versions ingested for this docket.</div>
              )}
            </div>
          </div>

          {/* Governing Internal Documents Showcase */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Tracked Governing Internal Documents</h3>
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                  Enterprise operating permits, technical standards, and contracts cross-referenced during compliance mapping.
                </p>
              </div>
              <span className="badge badge-high">{documents.length} Internal Documents</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
              {documents.map((doc) => (
                <div key={doc.id} className="card stat-card" style={{ padding: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#818cf8', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {doc.id}
                      </span>
                      <strong style={{ fontSize: '0.95rem', color: '#f3f4f6', marginTop: 2, display: 'block' }}>
                        {doc.title}
                      </strong>
                    </div>
                    <span className="badge badge-final">{doc.doc_type}</span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.65rem 0' }}>
                    <div>Owner: <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{doc.owner_id}</span> · Version: v{doc.current_version}</div>
                    <div style={{ marginTop: '2px' }}>Sections: <strong style={{ color: '#e5e7eb' }}>{doc.sections?.length || 1} Document Sections</strong></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.65rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem' }}
                      onClick={() => openDocumentFullText(doc)}
                    >
                      📄 View Full Text (Side Panel) →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: Downstream Impacts */}
      {subTab === 'impacts' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.5)' }}>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.35rem 0', color: '#f3f4f6' }}>
              Downstream Enterprise Impacts for {selectedProc?.title || currentProceeding}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: 0 }}>
              AI Semantic Mapper cross-references this docket against all {projects.length} internal capital projects and {obligations.length} governing obligations with dual verifiable citations.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {impactedProjects.map(proj => {
              const projActions = actions.filter(a => a.suggested_owner_id === proj.owner_id);
              return (
                <div key={proj.id} className="card stat-card" style={{ padding: '1.15rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '0.98rem', color: '#f3f4f6' }}>{proj.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {proj.id} · Lead: <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{proj.owner_id}</span>
                      </div>
                    </div>
                    <span className="badge badge-final">{proj.status}</span>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: '#d1d5db', margin: '0.65rem 0' }}>
                    {proj.description}
                  </p>

                  <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.75rem', borderRadius: '4px', fontSize: '0.78rem', color: '#9ca3af' }}>
                    <div>
                      Regulatory Link: <strong style={{ color: '#38bdf8' }}>{selectedProc?.id}</strong> ({selectedProc?.jurisdiction})
                    </div>
                    <div style={{ marginTop: '0.25rem' }}>
                      Routed Tasks: <strong style={{ color: '#e5e7eb' }}>{projActions.length} Actions Assigned</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setSubTab('actions')}
                    >
                      Inspect Routed Actions →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtab 3: Change Records & Citations */}
      {subTab === 'changes' && (
        <ChangeDiffViewer changeRecords={changeRecords} />
      )}

      {/* Subtab 4: Action Inbox */}
      {subTab === 'actions' && (
        <ActionInbox
          actions={actions}
          onOpenOverride={onOpenOverride}
          onTransitionState={onTransitionActionState}
        />
      )}

      {/* Subtab 5: Expert Review Queue */}
      {subTab === 'expert' && (
        <ExpertReviewQueue
          escalatedItems={escalatedItems}
          onResolve={onResolveExpert}
        />
      )}

      {/* Subtab 6: Living Audit Dossier */}
      {subTab === 'audit' && (
        <AuditTimelineStream
          dossier={dossier}
          isLoading={isDossierLoading}
          onFetchDossier={onFetchDossier}
        />
      )}

      {/* Slide-over Full Text Side Panel Drawer */}
      <FullTextDrawer
        isOpen={activeFullText.isOpen}
        title={activeFullText.title}
        subtitle={activeFullText.subtitle}
        statusBadge={activeFullText.statusBadge}
        rawText={activeFullText.rawText}
        sections={activeFullText.sections}
        onClose={() => setActiveFullText(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
