import React from 'react';
import type { ChangeRecord } from '../types';

interface ChangeDiffViewerProps {
  changeRecords: ChangeRecord[];
}

export const ChangeDiffViewer: React.FC<ChangeDiffViewerProps> = ({ changeRecords }) => {
  return (
    <div>
      <div className="section-intro">
        <h2>Detected Regulatory Deltas & Citation Grounding</h2>
        <p>
          Changes detected via structural sequence alignment and evaluated for materiality. Every change is verified against immutable document character spans.
        </p>
      </div>

      {changeRecords.length === 0 ? (
        <div className="empty-state">
          No changes analyzed yet. Click <strong>"Run Live Analysis"</strong> in the header to trigger change detection.
        </div>
      ) : (
        <div className="change-cards-list">
          {changeRecords.map((cr) => (
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
