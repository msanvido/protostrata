import React, { useState } from 'react';
import type { Project } from '../types';

interface NewProjectModalProps {
  onClose: () => void;
  onSubmit: (project: Partial<Project>) => Promise<void>;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onSubmit }) => {
  const [id, setId] = useState('PROJ-');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('u_ops_lead');
  const [status, setStatus] = useState('ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name || !description) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        id: id.trim(),
        name: name.trim(),
        description: description.trim(),
        owner_id: ownerId,
        status: status,
        linked_obligations: []
      });
      onClose();
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Create New Enterprise Capital Project</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.82rem', color: '#9ca3af' }}>
              Register a new capital asset, generation facility, or compliance workstream to monitor against evolving regulatory dockets.
            </p>

            <div className="form-group">
              <label htmlFor="proj-id">Project Identifier:</label>
              <input
                id="proj-id"
                className="input"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="PROJ-BESS-PEAKER-03"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="proj-name">Facility / Project Name:</label>
              <input
                id="proj-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="PJM Fast-Response Battery Energy Storage"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="proj-desc">Operational Scope & Description:</label>
              <textarea
                id="proj-desc"
                className="textarea"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="50MW / 200MWh BESS facility providing fast frequency response and grid inertia support."
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="proj-owner">Assigned Lead / Owner:</label>
                <select
                  id="proj-owner"
                  className="select"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="u_ops_lead">u_ops_lead (Operations & Thermal Lead)</option>
                  <option value="u_solar_lead">u_solar_lead (Solar & Storage Lead)</option>
                  <option value="u_storage_eng">u_storage_eng (Grid Storage Engineer)</option>
                  <option value="u_compliance">u_compliance (Compliance Analyst)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="proj-status">Initial Status:</label>
                <select
                  id="proj-status"
                  className="select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ACTIVE">ACTIVE (EPC / Operation)</option>
                  <option value="PLANNED">PLANNED (Interconnection Queue)</option>
                  <option value="ON_HOLD">ON_HOLD (Suspended)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
