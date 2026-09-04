import React, { useState } from 'react';
import type { ActionRecommendation } from '../types';

interface ActionInboxProps {
  actions: ActionRecommendation[];
  onOpenOverride: (action: ActionRecommendation) => void;
  onTransitionState?: (actionId: string, newState: string, actorId?: string) => void;
}

const STATE_LABEL: Record<string, string> = {
  PENDING: 'Awaiting Compliance Review',
  APPROVED: 'Approved — With Project Lead',
  IN_PROGRESS: 'In Progress (Lead Accepted)',
  DONE: 'Done',
  REJECTED: 'Rejected',
};

export const ActionInbox: React.FC<ActionInboxProps> = ({ actions, onOpenOverride, onTransitionState }) => {
  // Stage 1 filters: the compliance analyst reviews PENDING items and tracks the outcome of approvals
  const [filter, setFilter] = useState<'NEEDS_REVIEW' | 'ALL' | 'APPROVED' | 'IN_PROGRESS' | 'DONE' | 'REJECTED'>('NEEDS_REVIEW');

  const pendingCount = actions.filter(a => a.state === 'PENDING').length;
  const approvedCount = actions.filter(a => a.state === 'APPROVED').length;

  const filtered = actions.filter((act) => {
    if (filter === 'NEEDS_REVIEW') return act.state === 'PENDING';
    if (filter === 'ALL') return true;
    return act.state === filter;
  });

  const getStateColor = (state: string) => {
    switch (state) {
      case 'APPROVED': return '#10b981';
      case 'IN_PROGRESS': return '#38bdf8';
      case 'DONE': return '#818cf8';
      case 'REJECTED': return '#6b7280';
      default: return '#f59e0b';
    }
  };

  return (
    <div>
      <div className="section-intro">
        <h2>Compliance Review Inbox</h2>
        <p>
          Operational directives derived from regulatory changes and grounded in internal obligations.
          Accepting a directive adopts it as a formal enterprise obligation and routes it to the responsible
          project lead, who then accepts it for execution and marks it done once materialized.
        </p>
      </div>

      <div className="inbox-filters">
        <button
          className={`filter-btn ${filter === 'NEEDS_REVIEW' ? 'active' : ''}`}
          onClick={() => setFilter('NEEDS_REVIEW')}
        >
          ⚠️ Awaiting Compliance Review ({pendingCount})
        </button>
        <button
          className={`filter-btn ${filter === 'APPROVED' ? 'active' : ''}`}
          onClick={() => setFilter('APPROVED')}
        >
          ✓ Approved → Project Lead ({approvedCount})
        </button>
        <button
          className={`filter-btn ${filter === 'IN_PROGRESS' ? 'active' : ''}`}
          onClick={() => setFilter('IN_PROGRESS')}
        >
          In Progress
        </button>
        <button
          className={`filter-btn ${filter === 'DONE' ? 'active' : ''}`}
          onClick={() => setFilter('DONE')}
        >
          Done
        </button>
        <button
          className={`filter-btn ${filter === 'REJECTED' ? 'active' : ''}`}
          onClick={() => setFilter('REJECTED')}
        >
          Rejected
        </button>
        <button
          className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          All Actions ({actions.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          {filter === 'NEEDS_REVIEW'
            ? 'No directives awaiting review. Run live analysis on a docket to generate action recommendations.'
            : 'No actions found matching filter.'}
        </div>
      ) : (
        <div>
          {filtered.map((act) => (
            <div
              key={act.id}
              className={`action-card ${act.urgency === 'ACT_NOW' ? 'urgent' : ''}`}
            >
              <div className="action-info">
                <div className="action-directive">{act.recommended_action}</div>
                {act.original_action && (
                  <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    Originally recommended: <em>{act.original_action}</em>
                    {act.override_rationale && ` — rationale: ${act.override_rationale}`}
                  </div>
                )}
                <div className="action-meta">
                  <span>
                    Assigned Owner: <strong>{act.suggested_owner_id}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Urgency:{' '}
                    <span
                      className={`badge ${act.urgency === 'ACT_NOW' ? 'badge-material' : 'badge-proposed'}`}
                    >
                      {act.urgency}
                    </span>
                  </span>
                  <span>·</span>
                  <span>
                    Lifecycle State:{' '}
                    <strong style={{ color: getStateColor(act.state) }}>
                      {STATE_LABEL[act.state] || act.state}
                    </strong>
                  </span>
                  {act.updated_by && (
                    <>
                      <span>·</span>
                      <span style={{ color: '#9ca3af' }}>Last Actor: {act.updated_by}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="action-buttons" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {act.state === 'PENDING' && (
                  <>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.5)', fontWeight: 600 }}
                      onClick={() => onTransitionState && onTransitionState(act.id, 'APPROVED')}
                    >
                      ✓ Accept & Adopt Obligation
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.4)' }}
                      onClick={() => onTransitionState && onTransitionState(act.id, 'REJECTED')}
                    >
                      ✕ Reject
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onOpenOverride(act)}
                    >
                      Modify Directive
                    </button>
                  </>
                )}
                {act.state === 'APPROVED' && (
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                    Awaiting project lead acceptance
                  </span>
                )}
                {act.state === 'IN_PROGRESS' && (
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                    Lead is executing this directive
                  </span>
                )}
                {act.state === 'DONE' && (
                  <span className="badge badge-final">✓ Done</span>
                )}
                {act.state === 'REJECTED' && (
                  <span className="badge" style={{ background: 'rgba(107,114,128,0.2)', color: '#9ca3af' }}>Rejected</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
