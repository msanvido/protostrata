import React from 'react';
import type { Project, Obligation } from '../types';

interface OverviewTabProps {
  projects: Project[];
  obligations: Obligation[];
  materialChangesCount: number;
  escalatedCount: number;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  projects,
  obligations,
  materialChangesCount,
  escalatedCount,
}) => {
  return (
    <div>
      <div className="grid-cards">
        <div className="card stat-card">
          <div className="stat-title">Active Projects</div>
          <div className="stat-number">{projects.length}</div>
          <div className="stat-desc">Gas Turbine DC Substation & Mojave Solar Array</div>
        </div>
        <div className="card stat-card">
          <div className="stat-title">Governing Obligations</div>
          <div className="stat-number">{obligations.length}</div>
          <div className="stat-desc">NOx (2.5ppm), CEMS (30d), Tortoise Protection, IEEE 2800</div>
        </div>
        <div className="card stat-card">
          <div className="stat-title">Material Changes Detected</div>
          <div className="stat-number">{materialChangesCount}</div>
          <div className="stat-desc">Verified sequence alignment deltas with exact citations</div>
        </div>
        <div className={`card stat-card ${escalatedCount > 0 ? 'alert' : ''}`}>
          <div className="stat-title">Items Requiring Review</div>
          <div className="stat-number" style={{ color: escalatedCount > 0 ? '#f87171' : undefined }}>
            {escalatedCount}
          </div>
          <div className="stat-desc">Gated by transparent confidence rubric</div>
        </div>
      </div>

      <div className="grid-split">
        {/* Projects List */}
        <div className="card">
          <div className="card-header">
            <h3>Enterprise Capital Projects</h3>
          </div>
          <div>
            {projects.map((p) => (
              <div key={p.id} className="card stat-card" style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ color: '#f3f4f6' }}>{p.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {p.id} · Owner: {p.owner_id}
                    </div>
                  </div>
                  <span className="badge badge-final">{p.status}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '0.45rem' }}>
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Obligations List */}
        <div className="card">
          <div className="card-header">
            <h3>Compliance Obligations</h3>
          </div>
          <div>
            {obligations.map((o) => (
              <div key={o.id} className="card stat-card" style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ color: '#f3f4f6', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {o.id}
                    </strong>
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
                      Linked Doc: {o.linked_doc_id || 'None'} · Owner: {o.owner_id}
                    </div>
                  </div>
                  <span className="badge badge-final">{o.status}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginTop: '0.45rem' }}>
                  {o.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
