import React, { useState } from 'react';

interface NewRegulationModalProps {
  onClose: () => void;
  onSubmit: (data: {
    id: string;
    docket_id: string;
    title: string;
    jurisdiction: string;
    version_label: string;
    raw_text: string;
    status: string;
    auto_analyze: boolean;
  }) => Promise<void>;
}

export const NewRegulationModal: React.FC<NewRegulationModalProps> = ({ onClose, onSubmit }) => {
  const [id, setId] = useState('');
  const [docketId, setDocketId] = useState('');
  const [title, setTitle] = useState('');
  const [jurisdiction, setJurisdiction] = useState('NERC');
  const [versionLabel, setVersionLabel] = useState('Initial Standard Filing');
  const [status, setStatus] = useState('PROPOSED');
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [rawText, setRawText] = useState(
`Section 1: Mandatory Physical Security Protections
All transmission owners operating critical 500kV bulk electric substations must implement 24/7 automated perimeter intrusion detection systems and physical barriers within 90 calendar days.

Section 2: Maintenance and Audit Retention
Owners must retain all perimeter inspection records on-site for five years.`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !docketId || !title || !rawText) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        id: id.trim(),
        docket_id: docketId.trim(),
        title: title.trim(),
        jurisdiction,
        version_label: versionLabel.trim(),
        raw_text: rawText.trim(),
        status,
        auto_analyze: autoAnalyze
      });
      onClose();
    } catch (err) {
      console.error('Failed to ingest regulation:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h3>Ingest New Regulatory Proceeding</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>
              Ingest an entirely new regulation docket. All sections will be segmented into canonical coordinate trees and analyzed as new additions against your enterprise projects.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="reg-id">Internal Docket Identifier:</label>
                <input
                  id="reg-id"
                  className="input"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="NERC-CIP-014"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-docket">Official Docket Number:</label>
                <input
                  id="reg-docket"
                  className="input"
                  value={docketId}
                  onChange={(e) => setDocketId(e.target.value)}
                  placeholder="RD24-02"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-title">Proceeding Title:</label>
              <input
                id="reg-title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Physical Security Reliability Standards for Bulk Power Systems"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="reg-jur">Jurisdiction:</label>
                <select
                  id="reg-jur"
                  className="select"
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                >
                  <option value="FERC">FERC</option>
                  <option value="EPA">EPA</option>
                  <option value="NERC">NERC</option>
                  <option value="DOE">DOE</option>
                  <option value="STATE_PUC">State PUC</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="reg-status">Filing Status:</label>
                <select
                  id="reg-status"
                  className="select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="PROPOSED">PROPOSED (NOPR / Monitor)</option>
                  <option value="FINAL">FINAL (Binding / Act Now)</option>
                  <option value="DRAFT">DRAFT (Discussion Paper)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="reg-ver">Version Label:</label>
                <input
                  id="reg-ver"
                  className="input"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-text">Regulation Full Text / Sections:</label>
              <textarea
                id="reg-text"
                className="textarea"
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                type="checkbox"
                id="auto-analyze"
                checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
              />
              <label htmlFor="auto-analyze" style={{ margin: 0, cursor: 'pointer', fontSize: '0.85rem' }}>
                Run Baseline Analysis immediately (treat all sections as new requirements & map impacts)
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Ingesting & Analyzing...' : 'Ingest Regulation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
