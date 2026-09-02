import React from 'react';
import type { EscalatedItem } from '../types';

interface ExpertReviewQueueProps {
  escalatedItems: EscalatedItem[];
  onResolve: (targetId: string, decision: string, rationale: string) => Promise<void>;
}

export const ExpertReviewQueue: React.FC<ExpertReviewQueueProps> = ({
  escalatedItems,
  onResolve,
}) => {
  const handleResolvePrompt = async (targetId: string, decision: string) => {
    const defaultReason = decision === 'CONFIRMED_APPLICABLE' 
      ? 'Verified against enterprise operational scope and environmental classification.'
      : 'Determined facility qualifies for specific statutory exclusion.';
    const rationale = prompt(`Enter legal counsel rationale for ${decision}:`, defaultReason);
    if (!rationale) return;

    try {
      await onResolve(targetId, decision, rationale);
      alert(`Item ${targetId} resolved successfully. Audit event recorded.`);
    } catch (err) {
      alert('Failed to resolve item: ' + err);
    }
  };

  return (
    <div>
      <div className="section-intro alert-banner">
        <div className="alert-icon">⚠️</div>
        <div>
          <h2>Expert Review Queue (Confidence Gating)</h2>
          <p>
            Under PRD FR6, low-confidence interpretations or ambiguous statutory terms are structurally blocked from auto-creating operational tasks until resolved by qualified legal counsel.
          </p>
        </div>
      </div>

      {escalatedItems.length === 0 ? (
        <div className="empty-state">
          Queue is clear. No ambiguous changes or low-confidence interpretations pending review.
        </div>
      ) : (
        <div className="expert-list">
          {escalatedItems.map((item, idx) => {
            const targetId = item.mapping ? item.mapping.id : item.change.id;
            return (
              <div key={targetId || idx} className="expert-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-low">LOW CONFIDENCE — ESCALATED</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#fca5a5' }}>
                    Target: {targetId}
                  </span>
                </div>

                <div className="signals-list">
                  {item.signals.map((sig, sIdx) => (
                    <span key={sIdx} className="signal-chip">
                      {sig}
                    </span>
                  ))}
                </div>

                <div style={{ fontSize: '0.92rem', color: '#f3f4f6', lineHeight: 1.5 }}>
                  <strong>Change Excerpt:</strong> {item.change.description}
                </div>

                <div
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    paddingTop: '0.85rem',
                    display: 'flex',
                    gap: '0.5rem',
                    justifyContent: 'flex-end',
                  }}
                >
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleResolvePrompt(targetId, 'CONFIRMED_APPLICABLE')}
                  >
                    Confirm Applicable
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleResolvePrompt(targetId, 'DISMISS_NON_APPLICABLE')}
                  >
                    Dismiss as Exempt
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
