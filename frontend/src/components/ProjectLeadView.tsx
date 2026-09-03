import React, { useState } from 'react';
import type { Project, Proceeding, Obligation, ActionRecommendation } from '../types';

interface ProjectLeadViewProps {
  projects: Project[];
  proceedings: Proceeding[];
  obligations: Obligation[];
  actions: ActionRecommendation[];
  selectedProjectId?: string;
  onSelectProject: (id: string) => void;
  onTransitionActionState: (actionId: string, newState: string) => void;
  onOpenOverride: (action: ActionRecommendation) => void;
  onOpenNewProject: () => void;
}

export const ProjectLeadView: React.FC<ProjectLeadViewProps> = ({
  projects,
  proceedings,
  obligations,
  actions,
  selectedProjectId,
  onSelectProject,
  onTransitionActionState,
  onOpenOverride,
  onOpenNewProject,
}) => {
  // Determine available project leads
  const availableLeads = Array.from(new Set(projects.map(p => p.owner_id)));
  const [selectedLead, setSelectedLead] = useState<string>('ALL');

  // Filter projects by selected lead
  const filteredProjects = selectedLead === 'ALL' 
    ? projects 
    : projects.filter(p => p.owner_id === selectedLead);

  // Active project
  const activeProject = filteredProjects.find(p => p.id === selectedProjectId) || filteredProjects[0] || projects[0];

  // Actions for active project / lead
  const projectActions = actions.filter(a => {
    if (!activeProject) return true;
    return a.suggested_owner_id === activeProject.owner_id;
  });

  // Calculate project compliance metrics
  const totalActions = projectActions.length;
  const doneActions = projectActions.filter(a => a.state === 'DONE').length;
  const acceptedActions = projectActions.filter(a => a.state === 'ACCEPTED').length;
  const pendingActions = projectActions.filter(a => a.state === 'PENDING').length;
  const progressPercent = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 100;

  // Find linked obligations
  const projectObligations = obligations.filter(o => 
    activeProject?.linked_obligations?.includes(o.id) || o.owner_id === activeProject?.owner_id
  );

  // Determine applicable regulations for this project
  // In Strata, FERC Order 2023 applies to Solar & Storage, EPA Subpart KKKK applies to Gas Turbines, NERC CIP-014 applies to Substations
  const applicableProceedings = proceedings.filter(proc => {
    if (!activeProject) return true;
    const desc = (activeProject.name + ' ' + activeProject.description).toLowerCase();
    if (proc.id.includes('FERC') && (desc.includes('solar') || desc.includes('battery') || desc.includes('storage') || desc.includes('interconnection'))) return true;
    if (proc.id.includes('EPA') && (desc.includes('gas turbine') || desc.includes('combustion') || desc.includes('turbine'))) return true;
    if (proc.id.includes('NERC') && (desc.includes('substation') || desc.includes('bulk') || desc.includes('battery'))) return true;
    return false;
  });

  return (
    <div className="project-lead-container">
      {/* Lead & Project Selector Header Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="lead-filter" style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 600 }}>
                Lead Persona:
              </label>
              <select
                id="lead-filter"
                className="select"
                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                value={selectedLead}
                onChange={(e) => {
                  setSelectedLead(e.target.value);
                  const firstProj = e.target.value === 'ALL' 
                    ? projects[0]?.id 
                    : projects.find(p => p.owner_id === e.target.value)?.id;
                  if (firstProj) onSelectProject(firstProj);
                }}
              >
                <option value="ALL">All Project Leads ({availableLeads.length})</option>
                {availableLeads.map(lead => (
                  <option key={lead} value={lead}>{lead}</option>
                ))}
              </select>
            </div>

            <div className="header-divider" style={{ height: '24px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="project-picker" style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 600 }}>
                Active Project:
              </label>
              <select
                id="project-picker"
                className="select"
                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                value={activeProject?.id || ''}
                onChange={(e) => onSelectProject(e.target.value)}
              >
                {filteredProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
            </div>
          </div>

          <button className="btn btn-primary btn-sm" onClick={onOpenNewProject}>
            + Add Capital Project
          </button>
        </div>
      </div>

      {/* Active Project Detail Hero */}
      {activeProject && (
        <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f3f4f6' }}>
                  {activeProject.name}
                </h2>
                <span className={`badge ${activeProject.status === 'ACTIVE' ? 'badge-final' : 'badge-proposed'}`}>
                  {activeProject.status}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontFamily: 'var(--font-mono)', marginTop: '0.35rem' }}>
                Project ID: <strong style={{ color: '#c7d2fe' }}>{activeProject.id}</strong> · Engineering Lead: <strong style={{ color: '#a5b4fc' }}>{activeProject.owner_id}</strong>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#d1d5db', marginTop: '0.5rem', maxWidth: '750px' }}>
                {activeProject.description}
              </p>
            </div>

            {/* Compliance Progress Widget */}
            <div className="card stat-card" style={{ minWidth: '220px', padding: '0.75rem 1rem', background: 'rgba(15, 23, 42, 0.6)' }}>
              <div className="stat-title" style={{ fontSize: '0.75rem' }}>Project Compliance Completion</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.25rem 0' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: progressPercent === 100 ? '#34d399' : '#fbbf24' }}>
                  {progressPercent}%
                </span>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  ({doneActions}/{totalActions} Directives Resolved)
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: progressPercent === 100 ? '#10b981' : '#f59e0b', transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split Grid: Applicable Regulations & Linked Obligations */}
      <div className="grid-split" style={{ marginBottom: '1.5rem' }}>
        {/* Section 1: Applicable Regulations Per Project & Current Versions */}
        <div className="card">
          <div className="card-header">
            <h3>Applicable Regulations & Version Status</h3>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
              Statutory proceedings and environmental standards directly governing this project.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {applicableProceedings.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic' }}>
                No active regulatory dockets currently impacting this asset.
              </p>
            ) : (
              applicableProceedings.map(proc => {
                const latestVersion = proc.versions && proc.versions.length > 0 
                  ? proc.versions[proc.versions.length - 1] 
                  : null;
                const isFinal = latestVersion?.status === 'FINAL' || proc.id.includes('final');
                return (
                  <div key={proc.id} className="card stat-card" style={{ padding: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong style={{ color: '#f3f4f6', fontSize: '0.92rem' }}>{proc.title}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          {proc.id} ({proc.docket_id}) · Jurisdiction: <span style={{ color: '#38bdf8' }}>{proc.jurisdiction}</span>
                        </div>
                      </div>
                      <span className={`badge ${isFinal ? 'badge-final' : 'badge-proposed'}`}>
                        {isFinal ? 'FINAL RULE - ACT NOW' : 'PROPOSED - MONITOR'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '4px' }}>
                      Current Ingested Version: <strong style={{ color: '#e5e7eb' }}>{latestVersion?.version_label || 'Latest Regulatory Filing'}</strong>
                      {latestVersion?.filed_date && ` · Filed: ${latestVersion.filed_date}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Section 2: Governing Compliance Obligations */}
        <div className="card">
          <div className="card-header">
            <h3>Governing Compliance Obligations</h3>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
              Target thresholds, operating permits, and contractual standards linked to this asset.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {projectObligations.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic' }}>
                No specific compliance obligations assigned to this project.
              </p>
            ) : (
              projectObligations.map(obl => (
                <div key={obl.id} className="card stat-card" style={{ padding: '0.75rem 0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#a5b4fc', fontWeight: 600 }}>
                      {obl.id}
                    </span>
                    <span className="badge badge-final">{obl.status}</span>
                  </div>
                  <p style={{ fontSize: '0.82rem', color: '#e5e7eb', margin: '0.35rem 0 0 0' }}>
                    {obl.description}
                  </p>
                  {obl.linked_doc_id && (
                    <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      Governing Document: {obl.linked_doc_id}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Section 3: Project Lead Actions Inbox */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Project Lead Actions & Workstream Directives</h3>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
              Actionable directives assigned to {activeProject?.owner_id || 'you'}. Review, accept, or mark tasks as completed.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className="badge badge-proposed">{pendingActions} Pending</span>
            <span className="badge badge-high">{acceptedActions} In Progress</span>
            <span className="badge badge-final">{doneActions} Done</span>
          </div>
        </div>

        {projectActions.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic', padding: '1rem 0' }}>
            No pending action recommendations for this project lead. Run Live Analysis on a docket to generate actionable directives.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {projectActions.map(action => (
              <div key={action.id} className="card stat-card" style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#818cf8', fontWeight: 700 }}>
                        {action.id}
                      </span>
                      <span className={`badge ${action.urgency === 'ACT_NOW' ? 'badge-material' : 'badge-proposed'}`}>
                        {action.urgency}
                      </span>
                      <span className={`badge ${action.state === 'DONE' ? 'badge-final' : action.state === 'ACCEPTED' ? 'badge-high' : 'badge-proposed'}`}>
                        State: {action.state}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: '#f3f4f6', margin: '0.5rem 0' }}>
                      {action.recommended_action}
                    </p>
                  </div>

                  {/* State Transition & Human Override Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {action.state !== 'ACCEPTED' && action.state !== 'DONE' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => onTransitionActionState(action.id, 'ACCEPTED')}
                      >
                        Accept Directive
                      </button>
                    )}
                    {action.state !== 'DONE' && (
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.75rem', background: '#10b981', borderColor: '#10b981' }}
                        onClick={() => onTransitionActionState(action.id, 'DONE')}
                      >
                        ✓ Mark Done
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => onOpenOverride(action)}
                    >
                      Modify Directive
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
