import React, { useState } from 'react';
import type { ActionRecommendation } from '../types';

interface ActionInboxProps {
  actions: ActionRecommendation[];
  onOpenOverride: (action: ActionRecommendation) => void;
}

export const ActionInbox: React.FC<ActionInboxProps> = ({ actions, onOpenOverride }) => {
  const [filter, setFilter] = useState<'ALL' | 'ACT_NOW' | 'MONITOR' | 'MODIFIED'>('ALL');

  const filtered = actions.filter((act) => {
    if (filter === 'ALL') return true;
    if (filter === 'MODIFIED') return act.state === 'MODIFIED';
    return act.urgency === filter;
  });

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
          className={`filter-btn ${filter === 'MODIFIED' ? 'active' : ''}`}
          onClick={() => setFilter('MODIFIED')}
        >
          Human Overrides
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
                    Status:{' '}
                    <strong style={{ color: act.state === 'MODIFIED' ? '#f59e0b' : '#34d399' }}>
                      {act.state}
                    </strong>
                  </span>
                </div>
              </div>
              <div className="action-buttons">
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
