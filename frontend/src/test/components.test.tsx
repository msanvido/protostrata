import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { Header } from '../components/Header';
import { OverviewTab } from '../components/OverviewTab';
import { ChangeDiffViewer } from '../components/ChangeDiffViewer';
import { ActionInbox } from '../components/ActionInbox';
import { HumanOverrideModal } from '../components/HumanOverrideModal';
import { ExpertReviewQueue } from '../components/ExpertReviewQueue';
import { DashboardView } from '../components/DashboardView';
import { ProjectLeadView } from '../components/ProjectLeadView';
import { ComplianceAnalystView } from '../components/ComplianceAnalystView';
import type { 
  Project, 
  Proceeding,
  Obligation, 
  ChangeRecord, 
  ActionRecommendation, 
  EscalatedItem 
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

const mockProceedings: Proceeding[] = [
  {
    id: 'FERC-RM22-14',
    docket_id: 'RM22-14',
    title: 'FERC Order 2023 Generator Interconnection',
    jurisdiction: 'FERC',
    versions: [
      {
        id: 'ver_01',
        version_label: 'Final Rule',
        status: 'FINAL',
        filed_date: '2026-09-02',
        sections_count: 5
      }
    ]
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
    state: 'APPROVED'
  }
];

const mockDocuments = [
  {
    id: 'DOC-GT-AIR-01',
    title: 'Gas Turbine Air Quality Operating Permit',
    doc_type: 'PROCEDURE',
    owner_id: 'u_ops_lead',
    current_version: 1,
    raw_text: 'Section 1: Operating Limits\nTurbine NOx must not exceed 2.5 ppmvd.',
    sections: [
      {
        section_id: 'sec_1',
        heading: 'Section 1: Operating Limits',
        paragraphs: [{ para_id: 'p1', text: 'Turbine NOx must not exceed 2.5 ppmvd.' }]
      }
    ]
  }
];

describe('UI Component Unit & Integration Tests', () => {
  it('renders Header with primary view mode switcher', () => {
    const handleModeChange = vi.fn();

    render(
      <Header
        viewMode="dashboard"
        onViewModeChange={handleModeChange}
      />
    );

    expect(screen.getByText('STRATA')).toBeInTheDocument();
    expect(screen.getByText(/Executive Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Project Lead View/i)).toBeInTheDocument();
    expect(screen.getByText(/Compliance Analyst View/i)).toBeInTheDocument();
    expect(screen.getByText(/mock \(deterministic\)/i)).toBeInTheDocument();

    const projLeadBtn = screen.getByText(/Project Lead View/i);
    fireEvent.click(projLeadBtn);
    expect(handleModeChange).toHaveBeenCalledWith('project_lead');
  });

  it('renders DashboardView with projects, proceedings, and action directives matrix', () => {
    const navLead = vi.fn();
    const navComp = vi.fn();
    const addProj = vi.fn();
    const addReg = vi.fn();

    render(
      <DashboardView
        projects={mockProjects}
        proceedings={mockProceedings}
        obligations={mockObligations}
        actions={mockActions}
        escalatedCount={1}
        onNavigateProjectLead={navLead}
        onNavigateCompliance={navComp}
        onOpenNewProject={addProj}
        onOpenNewRegulation={addReg}
      />
    );

    expect(screen.getByText('Capital Projects')).toBeInTheDocument();
    expect(screen.getByText('Tracked Dockets')).toBeInTheDocument();
    expect(screen.getByText('Gas Turbine Substation for Tier 4 Datacenter')).toBeInTheDocument();
    expect(screen.getByText('FERC Order 2023 Generator Interconnection')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Compliance Directives Matrix')).toBeInTheDocument();
  });

  it('renders ProjectLeadView with project switcher, applicable regulations, and action transition buttons', () => {
    const handleSelectProj = vi.fn();
    const handleTransition = vi.fn();
    const handleOverride = vi.fn();
    const handleAddProj = vi.fn();

    render(
      <ProjectLeadView
        projects={mockProjects}
        proceedings={mockProceedings}
        obligations={mockObligations}
        actions={mockActions}
        selectedProjectId="PROJ-GT-DC-01"
        onSelectProject={handleSelectProj}
        onTransitionActionState={handleTransition}
        onOpenOverride={handleOverride}
        onOpenNewProject={handleAddProj}
      />
    );

    expect(screen.getByText(/Enterprise Capital Projects Portfolio/i)).toBeInTheDocument();
    expect(screen.getAllByText('Gas Turbine Substation for Tier 4 Datacenter').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Applicable Regulations & Version Status')).toBeInTheDocument();
    expect(screen.getByText(/Governing Compliance Obligations/i)).toBeInTheDocument();
    expect(screen.getByText(/Project Lead Actions & Workstream Directives/i)).toBeInTheDocument();

    // Only compliance-approved (APPROVED) directives appear in the lead's execution inbox
    const acceptBtns = screen.getAllByRole('button', { name: /Accept Directive/i });
    fireEvent.click(acceptBtns[0]);
    expect(handleTransition).toHaveBeenCalledWith('act_02', 'IN_PROGRESS', 'u_ops_lead');

    const markDoneBtns = screen.getAllByRole('button', { name: /✓ Mark Done/i });
    fireEvent.click(markDoneBtns[0]);
    expect(handleTransition).toHaveBeenCalledWith('act_02', 'DONE', 'u_ops_lead');
  });

  it('renders ComplianceAnalystView with docket selector, downstream impacts, and subtabs', () => {
    const handleProcChange = vi.fn();
    const handleRunAnalysis = vi.fn();
    const handleAddReg = vi.fn();
    const handleOverride = vi.fn();
    const handleTransition = vi.fn();
    const handleResolve = vi.fn().mockResolvedValue(undefined);

    render(
      <ComplianceAnalystView
        proceedings={mockProceedings}
        documents={mockDocuments}
        projects={mockProjects}
        obligations={mockObligations}
        changeRecords={mockChangeRecords}
        actions={mockActions}
        escalatedItems={[]}
        currentProceeding="FERC-RM22-14"
        isAnalyzing={false}
        onProceedingChange={handleProcChange}
        onRunAnalysis={handleRunAnalysis}
        onOpenNewRegulation={handleAddReg}
        onOpenOverride={handleOverride}
        onTransitionActionState={handleTransition}
        onResolveExpert={handleResolve}
      />
    );

    expect(screen.getByText(/Monitored Docket:/i)).toBeInTheDocument();
    expect(screen.getByText(/Run Live Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Regulatory Versions & Documents/i)).toBeInTheDocument();
    expect(screen.getByText('Gas Turbine Air Quality Operating Permit')).toBeInTheDocument();

    // Test clicking View Full Text (Side Panel)
    const viewFullTextBtns = screen.getAllByRole('button', { name: /View Full Text/i });
    fireEvent.click(viewFullTextBtns[0]);

    // Side panel should open
    expect(screen.getByPlaceholderText(/Search within document text.../i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Text/i })).toBeInTheDocument();

    // Close side panel
    const closeBtn = screen.getByRole('button', { name: '×' });
    fireEvent.click(closeBtn);
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

  it('renders ActionInbox compliance review filters and stage-1 decisions', () => {
    const handleOverride = vi.fn();
    const handleTransition = vi.fn();
    render(<ActionInbox actions={mockActions} onOpenOverride={handleOverride} onTransitionState={handleTransition} />);

    expect(screen.getByText('Initiate cluster study workflow review for PROJ-GT-DC-01.')).toBeInTheDocument();

    // Default filter "Awaiting Compliance Review" only shows PENDING directives (act_02 is APPROVED)
    expect(screen.queryByText('Monitor upcoming draft guidance for air permitting.')).not.toBeInTheDocument();

    // Switch to Approved filter
    const approvedBtn = screen.getByRole('button', { name: /Approved → Project Lead/i });
    fireEvent.click(approvedBtn);
    expect(screen.getByText('Monitor upcoming draft guidance for air permitting.')).toBeInTheDocument();

    // Back to review filter; Stage-1 decision buttons
    const reviewBtn = screen.getByRole('button', { name: /Awaiting Compliance Review/i });
    fireEvent.click(reviewBtn);

    // Click Accept & Adopt (PENDING -> APPROVED)
    const acceptBtn = screen.getByRole('button', { name: /Accept & Adopt Obligation/i });
    fireEvent.click(acceptBtn);
    expect(handleTransition).toHaveBeenCalledWith('act_01', 'APPROVED');

    // Reject button targets REJECTED
    const rejectBtn = screen.getByRole('button', { name: /✕ Reject/i });
    fireEvent.click(rejectBtn);
    expect(handleTransition).toHaveBeenCalledWith('act_01', 'REJECTED');

    // Click Modify Directive
    const modifyBtns = screen.getAllByText('Modify Directive');
    fireEvent.click(modifyBtns[0]);
    expect(handleOverride).toHaveBeenCalledWith(mockActions[0]);
  });

  it('renders ChangeDiffViewer with embedded action recommendation and review decisions', () => {
    const handleOverride = vi.fn();
    const handleTransition = vi.fn();

    const mockActionsWithChangeId = [
      {
        ...mockActions[0],
        change_id: 'cr_01'
      }
    ];

    render(
      <ChangeDiffViewer
        changeRecords={mockChangeRecords}
        actions={mockActionsWithChangeId}
        onOpenOverride={handleOverride}
        onTransitionActionState={handleTransition}
      />
    );

    // Verify change delta and routed action are visible
    expect(screen.getByText('DEADLINE_SHIFT')).toBeInTheDocument();
    expect(screen.getByText('Routed Action Recommendation:')).toBeInTheDocument();
    expect(screen.getByText('Initiate cluster study workflow review for PROJ-GT-DC-01.')).toBeInTheDocument();

    // Verify Accept & Adopt button triggers transition to APPROVED (compliance adoption)
    const acceptBtn = screen.getByRole('button', { name: /Accept & Adopt Obligation/i });
    fireEvent.click(acceptBtn);
    expect(handleTransition).toHaveBeenCalledWith('act_01', 'APPROVED');

    // Verify Modify Directive button opens override
    const modifyBtn = screen.getByRole('button', { name: /Modify Directive/i });
    fireEvent.click(modifyBtn);
    expect(handleOverride).toHaveBeenCalledWith(mockActionsWithChangeId[0]);
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
      mockActions[0],
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
});

