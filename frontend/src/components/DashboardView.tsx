import React from 'react';
import type { Project, Proceeding, Obligation, ActionRecommendation } from '../types';

interface DashboardViewProps {
  projects: Project[];
  proceedings: Proceeding[];
  obligations: Obligation[];
  actions: ActionRecommendation[];
  escalatedCount: number;
  onNavigateProjectLead: (projectId?: string) => void;
  onNavigateCompliance: (proceedingId?: string) => void;
  onOpenNewProject: () => void;
  onOpenNewRegulation: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  proceedings,
  obligations,
  actions,
  escalatedCount,
  onNavigateProjectLead,
  onNavigateCompliance,
  onOpenNewProject,
  onOpenNewRegulation,
}) => {
  const actNowCount = actions.filter(a => a.urgency === 'ACT_NOW').length;
  const pendingActionsCount = actions.filter(a => a.state === 'PENDING').length;
  const completedActionsCount = actions.filter(a => a.state === 'DONE').length;

  return (
    <div className="dashboard-container">
      {/* KPI Stats Grid */}
      <div className="grid-cards">
        <div className="card stat-card">
          <div className="stat-title">Capital Projects</div>
          <div className="stat-number">{projects.length}</div>
          <div className="stat-desc">
            {projects.map(p => p.owner_id).filter((v, i, a) => a.indexOf(v) === i).length} Assigned Leads Across Portfolio
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-title">Tracked Dockets</div>
          <div className="stat-number">{proceedings.length}</div>
          <div className="stat-desc">
            {proceedings.map(p => p.jurisdiction).filter((v, i, a) => a.indexOf(v) === i).join(', ')} Proceedings
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-title">Governing Obligations</div>
          <div className="stat-number">{obligations.length}</div>
          <div className="stat-desc">Mapped to Assets & Technical Standards</div>
        </div>

        <div className={`card stat-card ${actNowCount > 0 ? 'alert' : ''}`}>
          <div className="stat-title">High Urgency Directives</div>
          <div className="stat-number" style={{ color: actNowCount > 0 ? '#f87171' : undefined }}>
            {actNowCount}
          </div>
          <div className="stat-desc">Gated by Binding FINAL Orders</div>
        </div>

        <div className={`card stat-card ${escalatedCount > 0 ? 'alert' : ''}`}>
          <div className="stat-title">Expert Review Items</div>
          <div className="stat-number" style={{ color: escalatedCount > 0 ? '#fbbf24' : undefined }}>
            {escalatedCount}
          </div>
          <div className="stat-desc">Ambiguous Terms Gated by Rubric</div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid-split" style={{ marginTop: '1.5rem' }}>
        {/* Enterprise Projects & Owners Summary */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Enterprise Capital Projects & Leads</h3>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                Monitored facilities, responsible engineering leads, and active compliance workload.
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={onOpenNewProject}>
              + Add Project
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {projects.map((p) => {
              const projectActions = actions.filter(a => a.suggested_owner_id === p.owner_id);
              const doneActions = projectActions.filter(a => a.state === 'DONE').length;
              return (
                <div key={p.id} className="card stat-card" style={{ padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ color: '#f3f4f6', fontSize: '0.95rem' }}>{p.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {p.id} · Responsible Lead: <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{p.owner_id}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`badge ${p.status === 'ACTIVE' ? 'badge-final' : 'badge-proposed'}`}>
                        {p.status}
                      </span>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.82rem', color: '#9ca3af', margin: '0.5rem 0' }}>
                    {p.description}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      Directives: <strong>{projectActions.length} total</strong> ({doneActions} resolved, {projectActions.length - doneActions} open)
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      onClick={() => onNavigateProjectLead(p.id)}
                    >
                      Open Lead View →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Regulatory Proceedings & Owners Summary */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Regulatory Proceedings & Dockets</h3>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
                Monitored regulatory bodies, docket identifiers, active versions, and legal scope.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={onOpenNewRegulation}>
              + Ingest Docket
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {proceedings.map((proc) => {
              const latestVersion = proc.versions && proc.versions.length > 0 ? proc.versions[proc.versions.length - 1] : null;
              const isFinal = latestVersion?.status === 'FINAL' || proc.id.includes('final');
              return (
                <div key={proc.id} className="card stat-card" style={{ padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ color: '#f3f4f6', fontSize: '0.95rem' }}>{proc.title}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        Docket: {proc.docket_id} · Jurisdiction: <span style={{ color: '#38bdf8', fontWeight: 600 }}>{proc.jurisdiction}</span>
                      </div>
                    </div>
                    <span className={`badge ${isFinal ? 'badge-final' : 'badge-proposed'}`}>
                      {latestVersion?.status || (isFinal ? 'FINAL RULE' : 'PROPOSED')}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.5rem 0' }}>
                    Current Ingested Version: <span style={{ color: '#e5e7eb', fontWeight: 500 }}>{latestVersion?.version_label || 'Latest Ingested Rule'}</span>
                    {latestVersion?.filed_date && ` · Filed: ${latestVersion.filed_date}`}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      Counsel / Compliance Owner: <span style={{ color: '#a5b4fc' }}>u_compliance / u_counsel</span>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                      onClick={() => onNavigateCompliance(proc.id)}
                    >
                      Inspect Diff & Impacts →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Enterprise Action Directives Matrix */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Enterprise Compliance Directives Matrix</h3>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '2px 0 0 0' }}>
              Consolidated lifecycle tasks generated from regulatory changes across all internal projects.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className="badge badge-final">{completedActionsCount} Resolved</span>
            <span className="badge badge-proposed">{pendingActionsCount} Pending Action</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#9ca3af' }}>
                <th style={{ padding: '8px' }}>Action ID</th>
                <th style={{ padding: '8px' }}>Recommended Directive</th>
                <th style={{ padding: '8px' }}>Assigned Lead</th>
                <th style={{ padding: '8px' }}>Urgency</th>
                <th style={{ padding: '8px' }}>State</th>
                <th style={{ padding: '8px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {actions.slice(0, 8).map((act) => (
                <tr key={act.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px', fontFamily: 'var(--font-mono)', color: '#818cf8' }}>{act.id}</td>
                  <td style={{ padding: '8px', color: '#e5e7eb', maxWidth: '380px' }}>{act.recommended_action}</td>
                  <td style={{ padding: '8px', color: '#a5b4fc', fontWeight: 600 }}>{act.suggested_owner_id}</td>
                  <td style={{ padding: '8px' }}>
                    <span className={`badge ${act.urgency === 'ACT_NOW' ? 'badge-material' : 'badge-proposed'}`}>
                      {act.urgency}
                    </span>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span className={`badge ${act.state === 'DONE' ? 'badge-final' : act.state === 'ACCEPTED' ? 'badge-high' : 'badge-proposed'}`}>
                      {act.state}
                    </span>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.72rem', padding: '2px 6px' }}
                      onClick={() => onNavigateProjectLead()}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
