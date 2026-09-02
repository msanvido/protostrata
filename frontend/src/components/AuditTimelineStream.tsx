import React, { useState } from 'react';
import type { AuditDossier } from '../types';

interface AuditTimelineStreamProps {
  dossier: AuditDossier | null;
  isLoading: boolean;
  onFetchDossier: (streamId: string) => void;
}

export const AuditTimelineStream: React.FC<AuditTimelineStreamProps> = ({
  dossier,
  isLoading,
  onFetchDossier,
}) => {
  const [streamInput, setStreamInput] = useState('obligation:OBL-CEMS-02');

  const handleLoad = () => {
    if (streamInput.trim()) {
      onFetchDossier(streamInput.trim());
    }
  };

  const handlePreset = (id: string) => {
    setStreamInput(id);
    onFetchDossier(id);
  };

  return (
    <div>
      <div className="section-intro">
        <h2>Living Entity State & Defensible Audit Timeline</h2>
        <p>
          Append-only event stream reconstructing the complete historical decision timeline without loss of original system claims or human modifications.
        </p>
      </div>

      <div className="audit-controls">
        <label htmlFor="stream-input">Stream Identifier:</label>
        <input
          id="stream-input"
          type="text"
          className="input-text"
          value={streamInput}
          onChange={(e) => setStreamInput(e.target.value)}
          placeholder="e.g. obligation:OBL-CEMS-02 or project:PROJ-GT-DC-01"
        />
        <button className="btn btn-secondary" onClick={handleLoad} disabled={isLoading}>
          {isLoading ? 'Reconstructing...' : 'Load Living Dossier'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => handlePreset('obligation:OBL-RIDETHRU-03')}
        >
          Preset: Solar Inverter Ride-Through
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => handlePreset('project:PROJ-GT-DC-01')}
        >
          Preset: Gas Turbine Datacenter
        </button>
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        {isLoading ? (
          <div className="empty-state">Reconstructing immutable timeline from append-only event store...</div>
        ) : !dossier || dossier.reconstructed_timeline.length === 0 ? (
          <div className="empty-state">
            No historical audit events found for stream "{streamInput}". Enter a valid stream identifier and click Load.
          </div>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                  Reconstructed Timeline for {dossier.stream_id}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  Auditable chronological lineage with actor attribution
                </span>
              </div>
              <span className="badge badge-final">
                {dossier.total_events} Immutable Events Reconstructed
              </span>
            </div>

            <div className="timeline-stream">
              {dossier.reconstructed_timeline.map((evt) => (
                <div key={evt.id} className="timeline-node">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-time">{evt.timestamp}</div>
                    <div className="timeline-actor">
                      {evt.actor} → <span style={{ color: '#f3f4f6' }}>{evt.event_type}</span>
                    </div>
                    <div className="timeline-summary">{evt.summary}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
