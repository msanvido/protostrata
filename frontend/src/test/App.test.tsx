import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    getProjects: vi.fn(),
    getObligations: vi.fn(),
    getActions: vi.fn(),
    runAnalysis: vi.fn(),
    recordOverride: vi.fn(),
    resolveExpertReview: vi.fn(),
    getAuditDossier: vi.fn(),
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

  it('loads initial data and navigates between all workspace tabs', async () => {
    render(<App />);

    // Check header
    expect(screen.getByText('STRATA')).toBeInTheDocument();

    // Verify initial data loaded
    await waitFor(() => {
      expect(screen.getByText('Gas Turbine Substation for Tier 4 Datacenter')).toBeInTheDocument();
    });

    // Navigate to Change Records tab
    const changesTab = screen.getByRole('button', { name: /Change Records/i });
    fireEvent.click(changesTab);
    expect(screen.getByText(/Detected Regulatory Deltas & Citation Grounding/i)).toBeInTheDocument();

    // Navigate to Action Inbox tab
    const actionsTab = screen.getByRole('button', { name: /Action Inbox/i });
    fireEvent.click(actionsTab);
    expect(screen.getByText(/Routed Action Recommendations/i)).toBeInTheDocument();
    expect(screen.getByText('Review simple-cycle SCR catalyst tuning parameters.')).toBeInTheDocument();

    // Navigate to Expert Review Queue tab
    const expertTab = screen.getByRole('button', { name: /Expert Review Queue/i });
    fireEvent.click(expertTab);
    expect(screen.getByText(/Queue is clear/i)).toBeInTheDocument();

    // Navigate to Living Audit Dossier tab
    const auditTab = screen.getByRole('button', { name: /Living Audit Dossier/i });
    fireEvent.click(auditTab);
    expect(screen.getByText(/Living Entity State & Defensible Audit Timeline/i)).toBeInTheDocument();
  });

  it('triggers Run Live Analysis and updates change records, actions, and tabs', async () => {
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

    const runBtn = screen.getByRole('button', { name: /Run Live Analysis/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(api.runAnalysis).toHaveBeenCalledWith(
        'FERC-RM22-14',
        'FERC-RM22-14_nopr',
        'FERC-RM22-14_final_rule'
      );
    });

    // Should automatically switch to Change Records tab and render new change
    await waitFor(() => {
      expect(screen.getByText('FERC Order 2023 mandates 150 calendar day cluster studies.')).toBeInTheDocument();
    });
  });
});
