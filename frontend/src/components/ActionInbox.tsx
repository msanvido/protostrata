import React, { useState } from 'react';
import type { ActionRecommendation } from '../types';

interface ActionInboxProps {
  actions: ActionRecommendation[];
  onOpenOverride: (action: ActionRecommendation) => void;
  onTransitionState?: (actionId: string, newState: string) => void;
}

export const ActionInbox: React.FC<ActionInboxProps> = ({ actions, onOpenOverride, onTransitionState }) => {
  const [filter, setFilter] = useState<'ALL' | 'ACT_NOW' | 'MONITOR' | 'ACCEPTED' | 'MODIFIED' | 'DONE'>('ALL');

  const filtered = actions.filter((act) => {
    if (filter === 'ALL') return true;
    if (filter === 'MODIFIED') return act.state === 'MODIFIED';
    if (filter === 'ACCEPTED') return act.state === 'ACCEPTED';
    if (filter === 'DONE') return act.state === 'DONE';
    return act.urgency === filter;
  });

  const getStateColor = (state: string) => {
    switch (state) {
      case 'ACCEPTED': return '#10b981';
      case 'MODIFIED': return '#f59e0b';
      case 'DONE': return '#818cf8';
      default: return '#38bdf8';
    }
  };

  return (
    <div>
      <div className="section-intro">
        <h2>Routed Action Recommendations</h2>
        <p>
          Operational directives derived from regulatory changes and grounded in internal obligations. Action urgency is deterministically gated by docket status.
        </p>
      </div>

      <div className="inbox-filters">
        <button
          className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          All Actions ({actions.length})
        </button>
        <button
          className={`filter-btn ${filter === 'ACT_NOW' ? 'active' : ''}`}
          onClick={() => setFilter('ACT_NOW')}
        >
          Act Now (Final)
        </button>
        <button
          className={`filter-btn ${filter === 'MONITOR' ? 'active' : ''}`}
          onClick={() => setFilter('MONITOR')}
        >
          Monitor (Draft)
        </button>
        <button
          className={`filter-btn ${filter === 'ACCEPTED' ? 'active' : ''}`}
          onClick={() => setFilter('ACCEPTED')}
        >
          Accepted
        </button>
        <button
          className={`filter-btn ${filter === 'MODIFIED' ? 'active' : ''}`}
          onClick={() => setFilter('MODIFIED')}
        >
          Human Overrides
        </button>
        <button
          className={`filter-btn ${filter === 'DONE' ? 'active' : ''}`}
          onClick={() => setFilter('DONE')}
        >
          Completed
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          No actions found matching filter. Run live analysis to route actions.
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
                      {act.state}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="action-buttons" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {act.state !== 'ACCEPTED' && act.state !== 'DONE' && (
                  <button
                    className="btn btn-sm"
                    style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}
                    onClick={() => onTransitionState && onTransitionState(act.id, 'ACCEPTED')}
                  >
                    Accept
                  </button>
                )}
                {act.state !== 'DONE' && (
                  <button
                    className="btn btn-sm"
                    style={{ background: 'rgba(129, 140, 248, 0.2)', color: '#a5b4fc', border: '1px solid rgba(129, 140, 248, 0.4)' }}
                    onClick={() => onTransitionState && onTransitionState(act.id, 'DONE')}
                  >
                    Mark Done
                  </button>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onOpenOverride(act)}
                >
                  Modify Directive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
