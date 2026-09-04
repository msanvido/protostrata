import React, { useState, useEffect } from 'react';
import type { ActionRecommendation } from '../types';

interface HumanOverrideModalProps {
  action: ActionRecommendation | null;
  onClose: () => void;
  onSubmit: (action: ActionRecommendation, updatedText: string, rationale: string) => Promise<void>;
}

export const HumanOverrideModal: React.FC<HumanOverrideModalProps> = ({
  action,
  onClose,
  onSubmit,
}) => {
  const [updatedText, setUpdatedText] = useState('');
  const [rationale, setRationale] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (action) {
      setUpdatedText(action.recommended_action);
      setRationale('');
    }
  }, [action]);

  if (!action) return null;

  const handleSubmit = async () => {
    if (!updatedText.trim() || !rationale.trim()) {
      alert('Please provide both the modified directive and mandatory compliance rationale.');
      return;
    }
    try {
      setIsSubmitting(true);
      await onSubmit(action, updatedText, rationale);
      onClose();
    } catch (err) {
      alert('Failed to record override: ' + err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Record Non-Destructive Human Override</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>
            Original system recommendations and revised instructions are recorded with defensible rationale directly in the database.
          </p>

          <div className="form-group">
            <label>Original System Recommendation:</label>
            <div className="quote-box">{action.recommended_action}</div>
          </div>

          <div className="form-group">
            <label htmlFor="override-text">Modified Operational Directive:</label>
            <textarea
              id="override-text"
              className="textarea"
              rows={3}
              value={updatedText}
              onChange={(e) => setUpdatedText(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="override-rationale">Mandatory Reviewer Rationale:</label>
            <textarea
              id="override-rationale"
              className="textarea"
              rows={2}
              placeholder="Explain why the system recommendation was adjusted for compliance defensibility..."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Committing...' : 'Commit Override'}
          </button>
        </div>
      </div>
    </div>
  );
};
