import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { Header } from '../components/Header';
import { OverviewTab } from '../components/OverviewTab';
import { ChangeDiffViewer } from '../components/ChangeDiffViewer';
import { ActionInbox } from '../components/ActionInbox';
import { HumanOverrideModal } from '../components/HumanOverrideModal';
import { ExpertReviewQueue } from '../components/ExpertReviewQueue';
import { AuditTimelineStream } from '../components/AuditTimelineStream';
import type { 
  Project, 
  Obligation, 
  ChangeRecord, 
  ActionRecommendation, 
  EscalatedItem, 
  AuditDossier 
} from '../types';

const mockProjects: Project[] = [
  {
    id: 'PROJ-GT-DC-01',
    name: 'Gas Turbine Substation for Tier 4 Datacenter',
    description: 'On-site 120MW dual-fuel simple-cycle combustion turbine.',
    owner_id: 'u_ops_lead',
    status: 'ACTIVE',
    created_at: '2026-09-02'
  }
];

const mockObligations: Obligation[] = [
  {
    id: 'OBL-NOX-01',
    description: 'Maintain steady-state gas turbine NOx emissions at or below 2.5 ppmvd.',
    owner_id: 'u_ops_lead',
    status: 'ACTIVE',
    linked_doc_id: 'DOC-GT-AIR-01',
    created_at: '2026-09-02'
  }
];

const mockChangeRecords: ChangeRecord[] = [
  {
    id: 'cr_01',
    proceeding_id: 'FERC-RM22-14',
    to_version_id: 'FERC-RM22-14_final_rule',
    change_type: 'DEADLINE_SHIFT',
    materiality: 'MATERIAL',
    description: 'Transmission providers must complete cluster studies within 150 calendar days.',
    confidence: 'HIGH',
    confidence_signals: [],
    before_citation: {
      document_id: 'FERC-RM22-14',
      version_id: 'nopr',
      section_id: 'sec_1',
      para_id: 'p1',
      quoted_text: 'complete studies within 180 days.'
    },
    after_citation: {
      document_id: 'FERC-RM22-14',
      version_id: 'final_rule',
      section_id: 'sec_1',
      para_id: 'p1',
      quoted_text: 'must complete all cluster studies within 150 calendar days.'
    }
  }
];

const mockActions: ActionRecommendation[] = [
  {
    id: 'act_01',
    mapping_id: 'map_01',
    recommended_action: 'Initiate cluster study workflow review for PROJ-GT-DC-01.',
    suggested_owner_id: 'u_ops_lead',
    urgency: 'ACT_NOW',
    state: 'PENDING'
  },
  {
    id: 'act_02',
    mapping_id: 'map_02',
    recommended_action: 'Monitor upcoming draft guidance for air permitting.',
    suggested_owner_id: 'u_ops_lead',
    urgency: 'MONITOR',
    state: 'MODIFIED'
  }
];

describe('UI Component Unit & Integration Tests', () => {
  it('renders Header with proceeding selector and live LLM indicator', () => {
    const handleProceeding = vi.fn();
    const handleRun = vi.fn();

    render(
      <Header
        currentProceeding="FERC-RM22-14"
        onProceedingChange={handleProceeding}
        onRunAnalysis={handleRun}
        isAnalyzing={false}
      />
    );

    expect(screen.getByText('STRATA')).toBeInTheDocument();
    expect(screen.getByText('FINAL RULE')).toBeInTheDocument();
    expect(screen.getByText(/openrouter:gemini-2.5-flash/i)).toBeInTheDocument();

    const runBtn = screen.getByText(/Run Live Analysis/i);
    fireEvent.click(runBtn);
    expect(handleRun).toHaveBeenCalledTimes(1);

    const select = screen.getByLabelText(/Proceeding:/i);
    fireEvent.change(select, { target: { value: 'EPA-NSPS-KKKK' } });
    expect(handleProceeding).toHaveBeenCalledWith('EPA-NSPS-KKKK');
  });

  it('renders OverviewTab with metric counts and enterprise asset cards', () => {
    render(
      <OverviewTab
        projects={mockProjects}
        obligations={mockObligations}
        materialChangesCount={1}
        escalatedCount={2}
      />
    );

    expect(screen.getByText('Gas Turbine Substation for Tier 4 Datacenter')).toBeInTheDocument();
    expect(screen.getByText('OBL-NOX-01')).toBeInTheDocument();
    expect(screen.getByText('Maintain steady-state gas turbine NOx emissions at or below 2.5 ppmvd.')).toBeInTheDocument();
  });

  it('renders ChangeDiffViewer with dual-column comparative citations', () => {
    render(<ChangeDiffViewer changeRecords={mockChangeRecords} />);

    expect(screen.getByText(/DEADLINE_SHIFT/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH CONFIDENCE/i)).toBeInTheDocument();
    expect(screen.getByText(/"complete studies within 180 days."/i)).toBeInTheDocument();
    expect(screen.getByText(/"must complete all cluster studies within 150 calendar days."/i)).toBeInTheDocument();
  });

  it('renders ActionInbox and filters actions by urgency and modified state', () => {
    const handleOverride = vi.fn();
    render(<ActionInbox actions={mockActions} onOpenOverride={handleOverride} />);

    expect(screen.getByText('Initiate cluster study workflow review for PROJ-GT-DC-01.')).toBeInTheDocument();
    expect(screen.getByText('Monitor upcoming draft guidance for air permitting.')).toBeInTheDocument();

    // Filter ACT_NOW
    const actNowBtn = screen.getByRole('button', { name: /Act Now \(Final\)/i });
    fireEvent.click(actNowBtn);
    expect(screen.getByText('Initiate cluster study workflow review for PROJ-GT-DC-01.')).toBeInTheDocument();
    expect(screen.queryByText('Monitor upcoming draft guidance for air permitting.')).not.toBeInTheDocument();

    // Click Modify Directive
    const modifyBtns = screen.getAllByText('Modify Directive');
    fireEvent.click(modifyBtns[0]);
    expect(handleOverride).toHaveBeenCalledWith(mockActions[0]);
  });

  it('renders HumanOverrideModal and commits non-destructive overrides', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <HumanOverrideModal
        action={mockActions[0]}
        onClose={handleClose}
        onSubmit={handleSubmit}
      />
    );

    expect(screen.getByText(/Record Non-Destructive Human Override/i)).toBeInTheDocument();
    expect(screen.getAllByText(mockActions[0].recommended_action).length).toBeGreaterThanOrEqual(1);

    const textareaText = screen.getByLabelText(/Modified Operational Directive:/i);
    fireEvent.change(textareaText, { target: { value: 'Updated Directive Text.' } });

    const textareaRationale = screen.getByLabelText(/Mandatory Reviewer Rationale:/i);
    fireEvent.change(textareaRationale, { target: { value: 'Legal compliance policy requires direct notification.' } });

    const commitBtn = screen.getByText('Commit Override');
    fireEvent.click(commitBtn);

    expect(handleSubmit).toHaveBeenCalledWith(
      'act_01',
      'Updated Directive Text.',
      'Legal compliance policy requires direct notification.'
    );
  });

  it('renders ExpertReviewQueue with trigger signal chips and resolve buttons', () => {
    const handleResolve = vi.fn();
    const mockEscalated: EscalatedItem[] = [
      {
        change: mockChangeRecords[0],
        signals: ['SIG_AMBIG_TERM: Undefined statutory phrasing', 'SIG_CITE_FAIL: Unverified quote']
      }
    ];

    render(
      <ExpertReviewQueue
        escalatedItems={mockEscalated}
        onResolve={handleResolve}
      />
    );

    expect(screen.getByText('LOW CONFIDENCE — ESCALATED')).toBeInTheDocument();
    expect(screen.getByText('SIG_AMBIG_TERM: Undefined statutory phrasing')).toBeInTheDocument();
    expect(screen.getByText('Confirm Applicable')).toBeInTheDocument();
    expect(screen.getByText('Dismiss as Exempt')).toBeInTheDocument();
  });

  it('renders AuditTimelineStream with chronological events and stream presets', () => {
    const handleFetch = vi.fn();
    const mockDossier: AuditDossier = {
      stream_id: 'obligation:OBL-CEMS-02',
      total_events: 1,
      reconstructed_timeline: [
        {
          id: 'evt_1',
          timestamp: '2026-09-02 12:00:00',
          event_type: 'HUMAN_OVERRIDE_RECORDED',
          actor: 'USER:u_reviewer',
          summary: 'Reviewer u_reviewer modified action with rationale.',
          payload: {}
        }
      ]
    };

    render(
      <AuditTimelineStream
        dossier={mockDossier}
        isLoading={false}
        onFetchDossier={handleFetch}
      />
    );

    expect(screen.getByText(/1 Immutable Events Reconstructed/i)).toBeInTheDocument();
    expect(screen.getByText(/Reviewer u_reviewer modified action with rationale/i)).toBeInTheDocument();

    const solarBtn = screen.getByText('Preset: Solar Inverter Ride-Through');
    fireEvent.click(solarBtn);
    expect(handleFetch).toHaveBeenCalledWith('obligation:OBL-RIDETHRU-03');
  });
});
