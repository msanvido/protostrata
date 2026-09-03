import React, { useState } from 'react';
import type { 
  Project, 
  Proceeding, 
  Obligation, 
  ChangeRecord, 
  ActionRecommendation, 
  EscalatedItem, 
  AuditDossier 
} from '../types';

import { ChangeDiffViewer } from './ChangeDiffViewer';
import { ActionInbox } from './ActionInbox';
import { ExpertReviewQueue } from './ExpertReviewQueue';
import { AuditTimelineStream } from './AuditTimelineStream';

interface ComplianceAnalystViewProps {
  proceedings: Proceeding[];
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
  const [subTab, setSubTab] = useState<'impacts' | 'changes' | 'actions' | 'expert' | 'audit'>('impacts');

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
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${subTab === 'impacts' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
          onClick={() => setSubTab('impacts')}
        >
          Downstream Impacts ({impactedProjects.length} Projects · {obligations.length} Obligations)
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

      {/* Subtab Contents */}
      {subTab === 'impacts' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(30, 41, 59, 0.5)' }}>
            <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.35rem 0', color: '#f3f4f6' }}>
              Downstream Enterprise Impacts for {selectedProc?.title || currentProceeding}
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: 0 }}>
              AI Semantic Mapper cross-references this docket against all internal capital projects and operational permits with dual verifiable citations.
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

      {subTab === 'changes' && (
        <ChangeDiffViewer changeRecords={changeRecords} />
      )}

      {subTab === 'actions' && (
        <ActionInbox
          actions={actions}
          onOpenOverride={onOpenOverride}
          onTransitionState={onTransitionActionState}
        />
      )}

      {subTab === 'expert' && (
        <ExpertReviewQueue
          escalatedItems={escalatedItems}
          onResolve={onResolveExpert}
        />
      )}

      {subTab === 'audit' && (
        <AuditTimelineStream
          dossier={dossier}
          isLoading={isDossierLoading}
          onFetchDossier={onFetchDossier}
        />
      )}
    </div>
  );
};
