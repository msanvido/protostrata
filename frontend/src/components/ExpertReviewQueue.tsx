import React, { useState } from 'react';
import type { EscalatedItem } from '../types';

interface ExpertReviewQueueProps {
  escalatedItems: EscalatedItem[];
  onResolve: (targetId: string, decision: string, rationale: string) => Promise<void>;
}

export const ExpertReviewQueue: React.FC<ExpertReviewQueueProps> = ({
  escalatedItems,
  onResolve,
}) => {
  // Inline rationale capture per item (replaces blocking prompt()/alert() dialogs)
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (targetId: string, decision: string) => {
    const rationale = (rationales[targetId] || '').trim();
    if (!rationale) return;
    setResolvingId(targetId);
    try {
      await onResolve(targetId, decision, rationale);
      setRationales(prev => ({ ...prev, [targetId]: '' }));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div>
      <div className="section-intro alert-banner">
        <div className="alert-icon">⚠️</div>
        <div>
          <h2>Expert Review Queue (Confidence Gating)</h2>
          <p>
            Low-confidence interpretations or ambiguous statutory terms are structurally blocked from creating
            operational directives until resolved by qualified legal counsel. Confirming an item releases it to
            the compliance review inbox; dismissing it closes the item with a recorded rationale.
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
            const rationale = rationales[targetId] || '';
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
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <textarea
                    className="textarea"
                    rows={2}
                    placeholder="Mandatory counsel rationale (required to resolve)..."
                    value={rationale}
                    onChange={(e) => setRationales(prev => ({ ...prev, [targetId]: e.target.value }))}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!rationale || resolvingId === targetId}
                      onClick={() => handleResolve(targetId, 'CONFIRMED_APPLICABLE')}
                    >
                      Confirm Applicable
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!rationale || resolvingId === targetId}
                      onClick={() => handleResolve(targetId, 'DISMISS_NON_APPLICABLE')}
                    >
                      Dismiss as Exempt
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
