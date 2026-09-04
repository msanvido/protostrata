import React, { useState } from 'react';
import type { ChangeRecord, ActionRecommendation } from '../types';

interface ChangeDiffViewerProps {
  changeRecords: ChangeRecord[];
  actions?: ActionRecommendation[];
  onOpenOverride?: (action: ActionRecommendation) => void;
  onTransitionActionState?: (actionId: string, newState: string) => void;
}

export const ChangeDiffViewer: React.FC<ChangeDiffViewerProps> = ({
  changeRecords,
  actions = [],
  onOpenOverride,
  onTransitionActionState,
}) => {
  const [filter, setFilter] = useState<'NEEDS_ATTENTION' | 'ALL' | 'APPROVED'>('NEEDS_ATTENTION');

  // Filter logic:
  // - NEEDS_ATTENTION: Records with directives awaiting compliance review OR low confidence requiring expert review
  // - APPROVED: Records whose linked directives were approved (adopted as obligations)
  // - ALL: All detected changes
  const filteredRecords = changeRecords.filter((cr) => {
    const linked = actions.filter((a) => a.change_id === cr.id);
    const hasApprovedAction = linked.some((a) => a.state === 'APPROVED' || a.state === 'DONE');
    const hasPendingAction = linked.some((a) => a.state === 'PENDING');
    const isEscalated = cr.confidence === 'LOW';

    if (filter === 'NEEDS_ATTENTION') {
      if (hasPendingAction || isEscalated) return true;
      if (cr.materiality === 'MATERIAL' && linked.length === 0) return true;
      return false;
    }
    if (filter === 'APPROVED') {
      return hasApprovedAction;
    }
    return true;
  });

  const needsAttentionCount = changeRecords.filter((cr) => {
    const linked = actions.filter((a) => a.change_id === cr.id);
    return linked.some((a) => a.state === 'PENDING') || cr.confidence === 'LOW' || (cr.materiality === 'MATERIAL' && linked.length === 0);
  }).length;

  const approvedCount = changeRecords.filter((cr) => {
    const linked = actions.filter((a) => a.change_id === cr.id);
    return linked.some((a) => a.state === 'APPROVED' || a.state === 'DONE');
  }).length;

  return (
    <div>
      <div className="section-intro">
        <h2>Detected Regulatory Deltas & Compliance Review</h2>
        <p>
          Changes detected via structural sequence alignment and evaluated for materiality. Compliance can inspect the routed action directive for each delta, override the directive with defensible rationale, and accept the directive to formally adopt an enterprise obligation — which is then routed to the responsible project lead for execution.
        </p>
      </div>

      {changeRecords.length > 0 && (
        <div className="inbox-filters" style={{ marginBottom: '1.25rem' }}>
          <button
            className={`filter-btn ${filter === 'NEEDS_ATTENTION' ? 'active' : ''}`}
            onClick={() => setFilter('NEEDS_ATTENTION')}
          >
            ⚠️ Needs Attention ({needsAttentionCount})
          </button>
          <button
            className={`filter-btn ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            All Change Records ({changeRecords.length})
          </button>
          <button
            className={`filter-btn ${filter === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setFilter('APPROVED')}
          >
            ✓ Approved & Adopted ({approvedCount})
          </button>
        </div>
      )}

      {changeRecords.length === 0 ? (
        <div className="empty-state">
          No changes analyzed yet. Click <strong>"Run Live Analysis"</strong> in the docket monitoring bar above to trigger change detection.
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          {filter === 'NEEDS_ATTENTION' ? (
            <span>
              🎉 All pending change records have been reviewed and approved! View them in the <strong>"Approved & Adopted"</strong> tab or under <strong>Governing Obligations</strong>.
            </span>
          ) : (
            <span>No change records match the selected filter.</span>
          )}
        </div>
      ) : (
        <div className="change-cards-list">
          {filteredRecords.map((cr) => {
            const linked = actions.filter((a) => a.change_id === cr.id);
            return (
              <div key={cr.id} className="change-card">
                <div className="change-card-header">
                  <div className="change-card-meta">
                    <span className={`badge ${cr.materiality === 'MATERIAL' ? 'badge-material' : 'badge-proposed'}`}>
                      {cr.materiality}
                    </span>
                    <span className="badge" style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                      {cr.change_type}
                    </span>
                    <span className={`badge ${cr.confidence === 'LOW' ? 'badge-low' : 'badge-high'}`}>
                      {cr.confidence} CONFIDENCE
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#6b7280' }}>
                    {cr.id}
                  </span>
                </div>

                <div className="change-desc">{cr.description}</div>

                <div className="citation-diff-box">
                  <div className="diff-col">
                    <h4>Before (NOPR / Draft Filing)</h4>
                    <div className="quote-before">
                      "{cr.before_citation ? cr.before_citation.quoted_text : 'No prior language (New Addition)'}"
                    </div>
                  </div>
                  <div className="diff-col">
                    <h4>After (Final Mandate)</h4>
                    <div className="quote-after">
                      "{cr.after_citation ? cr.after_citation.quoted_text : 'Provisions removed'}"
                    </div>
                  </div>
                </div>

                {/* Linked Actions & Compliance Decision Block */}
                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.85rem' }}>
                  {linked.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Routed Action Recommendation:
                      </div>
                      {linked.map((act) => {
                        const isApproved = act.state === 'APPROVED' || act.state === 'DONE';
                        const stateBadge = {
                          PENDING: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', label: 'Awaiting Compliance Review' },
                          APPROVED: { bg: 'rgba(16, 185, 129, 0.25)', color: '#34d399', label: '✓ Approved — With Project Lead' },
                          IN_PROGRESS: { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', label: 'In Progress (Lead)' },
                          DONE: { bg: 'rgba(16, 185, 129, 0.25)', color: '#34d399', label: '✓ Done' },
                          REJECTED: { bg: 'rgba(107, 114, 128, 0.25)', color: '#9ca3af', label: 'Rejected' },
                        }[act.state] || { bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', label: act.state };
                        return (
                          <div
                            key={act.id}
                            style={{
                              background: isApproved ? 'rgba(16, 185, 129, 0.08)' : 'rgba(30, 41, 59, 0.7)',
                              border: isApproved ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '6px',
                              padding: '0.75rem 1rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className={`badge ${act.urgency === 'ACT_NOW' ? 'badge-material' : 'badge-proposed'}`}>
                                  {act.urgency}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                  Assigned Lead: <strong style={{ color: '#a5b4fc' }}>{act.suggested_owner_id}</strong>
                                </span>
                              </div>
                              <div>
                                <span className="badge" style={{ background: stateBadge.bg, color: stateBadge.color, fontWeight: 600 }}>
                                  {stateBadge.label}
                                </span>
                              </div>
                            </div>

                            <div style={{ fontSize: '0.85rem', color: '#e5e7eb', marginBottom: '0.65rem', lineHeight: '1.4' }}>
                              {act.recommended_action}
                            </div>

                            {act.state === 'PENDING' ? (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
                                {onOpenOverride && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                                    onClick={() => onOpenOverride(act)}
                                  >
                                    Modify Directive
                                  </button>
                                )}
                                {onTransitionActionState && (
                                  <>
                                    <button
                                      className="btn btn-sm"
                                      style={{
                                        background: 'rgba(16, 185, 129, 0.25)',
                                        color: '#34d399',
                                        border: '1px solid rgba(16, 185, 129, 0.5)',
                                        fontSize: '0.75rem',
                                        padding: '0.25rem 0.65rem',
                                        fontWeight: 600
                                      }}
                                      onClick={() => onTransitionActionState(act.id, 'APPROVED')}
                                    >
                                      ✓ Accept & Adopt Obligation
                                    </button>
                                    <button
                                      className="btn btn-sm"
                                      style={{
                                        background: 'rgba(107, 114, 128, 0.2)',
                                        color: '#9ca3af',
                                        border: '1px solid rgba(107, 114, 128, 0.4)',
                                        fontSize: '0.75rem',
                                        padding: '0.25rem 0.65rem'
                                      }}
                                      onClick={() => onTransitionActionState(act.id, 'REJECTED')}
                                    >
                                      ✕ Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : act.state === 'APPROVED' ? (
                              <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', textAlign: 'right' }}>
                                Approved as obligation — awaiting project lead acceptance
                              </div>
                            ) : act.state === 'IN_PROGRESS' ? (
                              <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', textAlign: 'right' }}>
                                Project lead accepted this directive
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : cr.confidence === 'LOW' ? (
                    <div style={{ fontSize: '0.8rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>⚠️ Low Confidence: Escalated to Legal Counsel / Expert Review Queue</span>
                    </div>
                  ) : cr.materiality === 'IMMATERIAL' ? (
                    <div style={{ fontSize: '0.78rem', color: '#6b7280', fontStyle: 'italic' }}>
                      No operational action required (Immaterial regulatory delta).
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
