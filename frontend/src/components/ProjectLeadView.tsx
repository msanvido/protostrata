import React, { useState } from 'react';
import type { Project, Proceeding, Obligation, ActionRecommendation } from '../types';

interface ProjectLeadViewProps {
  projects: Project[];
  proceedings: Proceeding[];
  obligations: Obligation[];
  actions: ActionRecommendation[];
  selectedProjectId?: string;
  onSelectProject: (id: string) => void;
  onTransitionActionState: (actionId: string, newState: string, actorId?: string) => void;
  onOpenOverride: (action: ActionRecommendation) => void;
  onOpenNewProject: () => void;
}

export const ProjectLeadView: React.FC<ProjectLeadViewProps> = ({
  projects,
  proceedings,
  obligations,
  actions,
  selectedProjectId = 'ALL',
  onSelectProject,
  onTransitionActionState,
  onOpenOverride,
  onOpenNewProject,
}) => {
  // Available project leads
  const availableLeads = Array.from(new Set(projects.map(p => p.owner_id)));
  const [selectedLead, setSelectedLead] = useState<string>('ALL');

  // Filter projects by selected lead
  const filteredProjects = selectedLead === 'ALL' 
    ? projects 
    : projects.filter(p => p.owner_id === selectedLead);

  // Determine which projects to render detailed views for
  const projectsToDisplay = selectedProjectId === 'ALL'
    ? filteredProjects
    : filteredProjects.filter(p => p.id === selectedProjectId);

  // Fallback if selected project not found in current lead filter
  const displayedProjects = projectsToDisplay.length > 0 
    ? projectsToDisplay 
    : filteredProjects.length > 0 ? [filteredProjects[0]] : projects;

  // Helpers per project
  const getApplicableRegulations = (proj: Project) => {
    const desc = (proj.name + ' ' + proj.description).toLowerCase();
    return proceedings.filter(proc => {
      if (proc.id.includes('FERC') && (desc.includes('solar') || desc.includes('battery') || desc.includes('storage') || desc.includes('interconnection'))) return true;
      if (proc.id.includes('EPA') && (desc.includes('gas turbine') || desc.includes('combustion') || desc.includes('turbine'))) return true;
      if (proc.id.includes('NERC') && (desc.includes('substation') || desc.includes('bulk') || desc.includes('battery'))) return true;
      return false;
    });
  };

  const getProjectActions = (proj: Project) => {
    // Only directives approved by compliance reach the project lead's execution inbox
    return actions.filter(a => a.suggested_owner_id === proj.owner_id
      && (a.state === 'APPROVED' || a.state === 'IN_PROGRESS' || a.state === 'DONE'));
  };

  const getProjectObligations = (proj: Project) => {
    return obligations.filter(o => 
      proj.linked_obligations?.includes(o.id) || o.owner_id === proj.owner_id
    );
  };

  return (
    <div className="project-lead-container">
      {/* Lead & Project Selector Header Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            {/* Lead Filter */}
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
                  onSelectProject('ALL');
                }}
              >
                <option value="ALL">All Project Leads ({availableLeads.length})</option>
                {availableLeads.map(lead => (
                  <option key={lead} value={lead}>{lead}</option>
                ))}
              </select>
            </div>

            <div className="header-divider" style={{ height: '24px' }} />

            {/* Project Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="project-picker" style={{ fontSize: '0.85rem', color: '#9ca3af', fontWeight: 600 }}>
                Viewing Projects:
              </label>
              <select
                id="project-picker"
                className="select"
                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                value={selectedProjectId}
                onChange={(e) => onSelectProject(e.target.value)}
              >
                <option value="ALL">All Projects ({filteredProjects.length})</option>
                {filteredProjects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {selectedProjectId !== 'ALL' && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onSelectProject('ALL')}
                style={{ fontSize: '0.8rem' }}
              >
                ← View All Projects
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={onOpenNewProject}>
              + Add Capital Project
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Grid: Always show quick overview cards of all relevant projects */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6', margin: 0 }}>
            {selectedLead === 'ALL' ? 'Enterprise Capital Projects Portfolio' : `Projects Owned by ${selectedLead}`} ({filteredProjects.length} Projects)
          </h3>
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
            Click any project to focus view, or select "All Projects"
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredProjects.map(proj => {
            const isFocused = selectedProjectId === proj.id;
            const projActions = getProjectActions(proj);
            const done = projActions.filter(a => a.state === 'DONE').length;
            const pct = projActions.length > 0 ? Math.round((done / projActions.length) * 100) : 100;
            const applicableRegs = getApplicableRegulations(proj);

            return (
              <div
                key={proj.id}
                className="card stat-card"
                onClick={() => onSelectProject(proj.id)}
                style={{
                  padding: '1rem',
                  cursor: 'pointer',
                  border: isFocused ? '2px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isFocused ? 'rgba(30, 41, 59, 0.9)' : 'rgba(15, 23, 42, 0.6)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontFamily: 'var(--font-mono)' }}>
                      {proj.id} · Lead: <strong>{proj.owner_id}</strong>
                    </div>
                    <strong style={{ fontSize: '0.98rem', color: '#f3f4f6', marginTop: '2px', display: 'block' }}>
                      {proj.name}
                    </strong>
                  </div>
                  <span className={`badge ${proj.status === 'ACTIVE' ? 'badge-final' : 'badge-proposed'}`}>
                    {proj.status}
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0.5rem 0', lineHeight: 1.4 }}>
                  {proj.description.length > 90 ? proj.description.substring(0, 90) + '...' : proj.description}
                </p>

                {/* Progress bar */}
                <div style={{ margin: '0.5rem 0 0.75rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#9ca3af', marginBottom: '3px' }}>
                    <span>Compliance Progress</span>
                    <strong style={{ color: pct === 100 ? '#34d399' : '#fbbf24' }}>{pct}% ({done}/{projActions.length})</strong>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#10b981' : '#f59e0b' }} />
                  </div>
                </div>

                {/* Applicable Regs count */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', fontSize: '0.74rem' }}>
                  <span style={{ color: '#9ca3af' }}>
                    Regs: <strong style={{ color: '#38bdf8' }}>{applicableRegs.length} Active</strong>
                  </span>
                  <button
                    className={`btn ${isFocused ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                    style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectProject(proj.id);
                    }}
                  >
                    {isFocused ? '✓ Focused' : 'Focus Project →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Render Full Detailed View for each displayed project */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        {displayedProjects.map((project) => {
          const projectActions = getProjectActions(project);
          const totalActions = projectActions.length;
          const doneActions = projectActions.filter(a => a.state === 'DONE').length;
          const inProgressActions = projectActions.filter(a => a.state === 'IN_PROGRESS').length;
          const awaitingLeadActions = projectActions.filter(a => a.state === 'APPROVED').length;
          const pendingReviewCount = actions.filter(a => a.suggested_owner_id === project.owner_id && a.state === 'PENDING').length;
          const progressPercent = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 100;
          const projectObligations = getProjectObligations(project);
          const applicableProceedings = getApplicableRegulations(project);

          return (
            <div
              key={project.id}
              style={{
                background: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '1.25rem',
              }}
            >
              {/* Project Hero Header */}
              <div className="card" style={{ marginBottom: '1.25rem', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f3f4f6' }}>
                        {project.name}
                      </h2>
                      <span className={`badge ${project.status === 'ACTIVE' ? 'badge-final' : 'badge-proposed'}`}>
                        {project.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#9ca3af', fontFamily: 'var(--font-mono)', marginTop: '0.35rem' }}>
                      Project ID: <strong style={{ color: '#c7d2fe' }}>{project.id}</strong> · Engineering Lead: <strong style={{ color: '#a5b4fc' }}>{project.owner_id}</strong>
                    </div>
                    <p style={{ fontSize: '0.88rem', color: '#d1d5db', marginTop: '0.5rem', maxWidth: '750px' }}>
                      {project.description}
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

              {/* Split Grid: Applicable Regulations & Linked Obligations */}
              <div className="grid-split" style={{ marginBottom: '1.25rem' }}>
                {/* Section 1: Applicable Regulations Per Project & Current Versions */}
                <div className="card">
                  <div className="card-header">
                    <h3>Applicable Regulations & Version Status</h3>
                    <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                      Statutory proceedings and environmental standards directly governing {project.name}.
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
                      Target thresholds, operating permits, and contractual standards linked to {project.name}.
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
                    <h3>Project Lead Actions & Workstream Directives ({project.name})</h3>
                    <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                      Directives approved by compliance and adopted as obligations. Accept a directive to begin
                      work, and mark it done once the obligation is materialized.
                      {pendingReviewCount > 0 && ` ${pendingReviewCount} further directive(s) still awaiting compliance review.`}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="badge badge-proposed">{awaitingLeadActions} To Accept</span>
                    <span className="badge badge-high">{inProgressActions} In Progress</span>
                    <span className="badge badge-final">{doneActions} Done</span>
                  </div>
                </div>

                {projectActions.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic', padding: '1rem 0' }}>
                    No directives have been approved by compliance for this project yet. Approved directives will
                    appear here as adopted obligations once the compliance analyst accepts them.
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
                              <span className={`badge ${action.state === 'DONE' ? 'badge-final' : action.state === 'IN_PROGRESS' ? 'badge-high' : 'badge-proposed'}`}>
                                {action.state === 'APPROVED' ? 'Approved — Awaiting Acceptance' : action.state === 'IN_PROGRESS' ? 'In Progress' : action.state}
                              </span>
                            </div>
                            <p style={{ fontSize: '0.88rem', color: '#f3f4f6', margin: '0.5rem 0' }}>
                              {action.recommended_action}
                            </p>
                            {action.original_action && (
                              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0 0' }}>
                                Originally recommended: <em>{action.original_action}</em>
                                {action.override_rationale && ` — rationale: ${action.override_rationale}`}
                              </p>
                            )}
                          </div>

                          {/* Lead execution controls: Accept Directive / Mark Done / Modify */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {action.state === 'APPROVED' && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => onTransitionActionState(action.id, 'IN_PROGRESS', action.suggested_owner_id)}
                              >
                                Accept Directive
                              </button>
                            )}
                            {(action.state === 'APPROVED' || action.state === 'IN_PROGRESS') && (
                              <>
                                <button
                                  className="btn btn-primary btn-sm"
                                  style={{ fontSize: '0.75rem', background: '#10b981', borderColor: '#10b981' }}
                                  onClick={() => onTransitionActionState(action.id, 'DONE', action.suggested_owner_id)}
                                >
                                  ✓ Mark Done
                                </button>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: '0.75rem' }}
                                  onClick={() => onOpenOverride(action)}
                                >
                                  Modify
                                </button>
                              </>
                            )}
                            {action.state === 'DONE' && (
                              <span className="badge badge-final">✓ Completed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
