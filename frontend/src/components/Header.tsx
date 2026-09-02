import React from 'react';

interface HeaderProps {
  currentProceeding: string;
  onProceedingChange: (val: string) => void;
  onRunAnalysis: () => void;
  isAnalyzing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentProceeding,
  onProceedingChange,
  onRunAnalysis,
  isAnalyzing,
}) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="brand-logo">
          <span className="logo-strata">STRATA</span>
          <span className="logo-tag">REACT WORKSPACE</span>
        </div>
        <div className="header-divider" />
        <div className="header-context">
          <label htmlFor="proceeding-select">Proceeding:</label>
          <select
            id="proceeding-select"
            className="dropdown"
            value={currentProceeding}
            onChange={(e) => onProceedingChange(e.target.value)}
          >
            <option value="FERC-RM22-14">FERC RM22-14 / Order 2023 (Interconnection)</option>
            <option value="EPA-NSPS-KKKK">EPA NSPS Subpart KKKK (Combustion Turbines)</option>
          </select>
          <span className="badge badge-final">FINAL RULE</span>
        </div>
      </div>
      <div className="header-actions">
        <button
          className="btn btn-primary"
          onClick={onRunAnalysis}
          disabled={isAnalyzing}
        >
          <span>⚡</span> {isAnalyzing ? 'Analyzing Differences...' : 'Run Live Analysis'}
        </button>
        <div className="header-stat">
          <span className="stat-label">LLM Backend: </span>
          <span className="stat-value">openrouter:gemini-2.5-flash</span>
        </div>
      </div>
    </header>
  );
};
