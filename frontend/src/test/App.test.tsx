import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    getProjects: vi.fn(),
    getProceedings: vi.fn(),
    getObligations: vi.fn(),
    getActions: vi.fn(),
    runAnalysis: vi.fn(),
    recordOverride: vi.fn(),
    resolveExpertReview: vi.fn(),
    getAuditDossier: vi.fn(),
    transitionAction: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    createProceeding: vi.fn(),
    deleteProceeding: vi.fn(),
  }
}));

describe('Strata Full React App Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.getProjects).mockResolvedValue([
      {
        id: 'PROJ-GT-DC-01',
        name: 'Gas Turbine Substation for Tier 4 Datacenter',
        description: 'On-site 120MW dual-fuel simple-cycle combustion turbine.',
        owner_id: 'u_ops_lead',
        status: 'ACTIVE',
        created_at: '2026-09-02'
      }
    ]);

    vi.mocked(api.getProceedings).mockResolvedValue([
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
    ]);

    vi.mocked(api.getObligations).mockResolvedValue([
      {
        id: 'OBL-NOX-01',
        description: 'Maintain steady-state gas turbine NOx emissions at or below 2.5 ppmvd.',
        owner_id: 'u_ops_lead',
        status: 'ACTIVE',
        linked_doc_id: 'DOC-GT-AIR-01',
        created_at: '2026-09-02'
      }
    ]);

    vi.mocked(api.getActions).mockResolvedValue([
      {
        id: 'act_01',
        mapping_id: 'map_01',
        recommended_action: 'Review simple-cycle SCR catalyst tuning parameters.',
        suggested_owner_id: 'u_ops_lead',
        urgency: 'ACT_NOW',
        state: 'PENDING'
      }
    ]);

    vi.mocked(api.getAuditDossier).mockResolvedValue({
      stream_id: 'obligation:OBL-CEMS-02',
      total_events: 1,
      reconstructed_timeline: [
        {
          id: 'evt_01',
          timestamp: '2026-09-02 12:00:00',
          event_type: 'IMPACT_MAPPED',
          actor: 'SYSTEM:pipeline:impact_mapper',
          summary: 'Impact mapped to OBL-CEMS-02.',
          payload: {}
        }
      ]
    });
  });

  it('loads initial data and renders Executive Dashboard by default', async () => {
    render(<App />);

    // Check header & logo
    expect(screen.getByText('STRATA')).toBeInTheDocument();

    // Verify view mode buttons
    expect(screen.getByText(/Executive Dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Project Lead View/i)).toBeInTheDocument();
    expect(screen.getByText(/Compliance Analyst View/i)).toBeInTheDocument();

    // Verify initial data loaded into Dashboard
    await waitFor(() => {
      expect(screen.getByText('Gas Turbine Substation for Tier 4 Datacenter')).toBeInTheDocument();
      expect(screen.getByText('FERC Order 2023 Generator Interconnection')).toBeInTheDocument();
      expect(screen.getByText('Enterprise Compliance Directives Matrix')).toBeInTheDocument();
    });
  });

  it('switches between Executive Dashboard, Project Lead View, and Compliance Analyst View', async () => {
    render(<App />);

    // 1. Switch to Project Lead View
    const leadViewBtn = screen.getByRole('button', { name: /Project Lead View/i });
    fireEvent.click(leadViewBtn);

    await waitFor(() => {
      expect(screen.getByText('Applicable Regulations & Version Status')).toBeInTheDocument();
      expect(screen.getByText(/Project Lead Actions & Workstream Directives/i)).toBeInTheDocument();
    });

    // 2. Switch to Compliance Analyst View
    const compViewBtn = screen.getByRole('button', { name: /Compliance Analyst View/i });
    fireEvent.click(compViewBtn);

    await waitFor(() => {
      expect(screen.getByText(/Monitored Docket:/i)).toBeInTheDocument();
      expect(screen.getByText(/Run Live Analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/Downstream Impacts/i)).toBeInTheDocument();
    });

    // 3. Switch back to Executive Dashboard
    const dashViewBtn = screen.getByRole('button', { name: /Executive Dashboard/i });
    fireEvent.click(dashViewBtn);

    await waitFor(() => {
      expect(screen.getByText('Enterprise Capital Projects & Leads')).toBeInTheDocument();
    });
  });

  it('triggers Run Live Analysis in Compliance Analyst View and updates change records', async () => {
    vi.mocked(api.runAnalysis).mockResolvedValue({
      proceeding_id: 'FERC-RM22-14',
      from_version: 'FERC-RM22-14_nopr',
      to_version: 'FERC-RM22-14_final_rule',
      total_changes: 1,
      material_changes: 1,
      impact_mappings: 1,
      actions_created: 1,
      escalated_to_expert_review: 0,
      change_records: [
        {
          id: 'cr_ferc_01',
          proceeding_id: 'FERC-RM22-14',
          to_version_id: 'FERC-RM22-14_final_rule',
          change_type: 'DEADLINE_SHIFT',
          materiality: 'MATERIAL',
          description: 'FERC Order 2023 mandates 150 calendar day cluster studies.',
          confidence: 'HIGH',
          confidence_signals: [],
          after_citation: {
            document_id: 'FERC-RM22-14',
            version_id: 'final_rule',
            section_id: 'sec_1',
            para_id: 'p1',
            quoted_text: 'must complete all cluster studies within 150 calendar days.'
          }
        }
      ],
      actions: [
        {
          id: 'act_ferc_01',
          mapping_id: 'map_01',
          recommended_action: 'Revise Mojave Solar grid interconnection milestones.',
          suggested_owner_id: 'u_solar_lead',
          urgency: 'ACT_NOW',
          state: 'PENDING'
        }
      ],
      escalated_items: []
    });

    render(<App />);

    // Switch to Compliance Analyst View
    const compViewBtn = screen.getByRole('button', { name: /Compliance Analyst View/i });
    fireEvent.click(compViewBtn);

    // Click Run Live Analysis
    const runBtn = screen.getByRole('button', { name: /Run Live Analysis/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(api.runAnalysis).toHaveBeenCalledWith(
        'FERC-RM22-14',
        'FERC-RM22-14_nopr',
        'FERC-RM22-14_final_rule'
      );
    });
  });
});
