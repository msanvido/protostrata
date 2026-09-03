interface HeaderProps {
  viewMode: 'dashboard' | 'project_lead' | 'compliance_analyst';
  onViewModeChange: (mode: 'dashboard' | 'project_lead' | 'compliance_analyst') => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
}) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo">
          <span className="logo-strata">STRATA</span>
          <span className="logo-tag">INTELLIGENCE</span>
        </div>
        <div className="header-divider" />

        {/* Primary View Mode Switcher */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.35)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', gap: '2px' }}>
          <button
            className={`btn btn-sm ${viewMode === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.8rem', padding: '4px 11px', borderRadius: '4px' }}
            onClick={() => onViewModeChange('dashboard')}
          >
            📊 Executive Dashboard
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'project_lead' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.8rem', padding: '4px 11px', borderRadius: '4px' }}
            onClick={() => onViewModeChange('project_lead')}
          >
            👷 Project Lead View
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'compliance_analyst' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ fontSize: '0.8rem', padding: '4px 11px', borderRadius: '4px' }}
            onClick={() => onViewModeChange('compliance_analyst')}
          >
            ⚖️ Compliance Analyst View
          </button>
        </div>
      </div>
      <div className="header-actions">
        <div className="header-stat">
          <span className="stat-label">System Mode: </span>
          <span className="stat-value" style={{ textTransform: 'capitalize' }}>
            {viewMode.replace('_', ' ')}
          </span>
        </div>
        <div className="header-stat">
          <span className="stat-label">LLM Backend: </span>
          <span className="stat-value">openrouter:gemini-2.5-flash</span>
        </div>
      </div>
    </header>
  );
};
