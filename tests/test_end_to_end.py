import pytest
from strata.seed import seed_database
from strata.models.analysis import ActionState, ConfidenceTier

def test_full_pipeline_ferc_and_epa():
    svc = seed_database(":memory:")

    # 1. Analyze FERC Order 2023 (NOPR -> Final Rule)
    ferc_res = svc.analyze_versions("FERC-RM22-14", "FERC-RM22-14_nopr", "FERC-RM22-14_final_rule")
    assert ferc_res["material_changes"] >= 3
    assert ferc_res["actions_created"] > 0
    
    # Check that status transition was recorded
    status_records = [c for c in ferc_res["change_records"] if c["change_type"] == "STATUS_TRANSITION"]
    assert len(status_records) == 1
    assert "PROPOSED to FINAL" in status_records[0]["description"]

    # Check that inverter ride-through or cluster study mapped to solar project
    mappings = svc.repo.list_impact_mappings()
    solar_or_obl = [m for m in mappings if m.affected_id in ["PROJ-SOLAR-DESERT-02", "OBL-RIDETHRU-03", "DOC-SOLAR-GRID-03"]]
    assert len(solar_or_obl) > 0

    # 2. Analyze EPA NSPS Subpart KKKK (Draft -> Final Rule)
    epa_res = svc.analyze_versions("EPA-NSPS-KKKK", "EPA-NSPS-KKKK_draft_revision", "EPA-NSPS-KKKK_final_rule")
    assert epa_res["total_changes"] >= 2
    
    # Check that ambiguous term was detected and placed in Expert Review Queue
    ambig_cr = [c for c in epa_res["change_records"] if c["confidence"] == "LOW"]
    assert len(ambig_cr) > 0
    assert "SIG_AMBIG_TERM" in ambig_cr[0]["confidence_signals"][0]
    assert epa_res["escalated_to_expert_review"] > 0

    # 3. Resolve Expert Review Item
    escalated = epa_res["escalated_items"][0]
    target_id = escalated["mapping"]["id"] if escalated["mapping"] else escalated["change"]["id"]
    res = svc.resolve_expert_review(target_id, "u_counsel", "APPLY_WITH_MONITORING", "Unit is subject to SCR requirements.")
    assert res["status"] == "resolved"

    # 4. Human Override (returns directive to PENDING compliance review, preserves original)
    actions = svc.repo.list_actions()
    assert len(actions) > 0
    act = actions[0]
    orig_text = act.recommended_action
    
    updated_act = svc.record_human_override(
        action_id=act.id,
        user_id="u_reviewer",
        updated_action_text="Mandate daily automated calibration checks.",
        override_rationale="Heightened enforcement priority."
    )
    assert updated_act.state == ActionState.PENDING
    assert updated_act.recommended_action == "Mandate daily automated calibration checks."
    assert updated_act.original_action == orig_text
    assert updated_act.override_rationale == "Heightened enforcement priority."

def test_action_approval_adopts_obligation():
    svc = seed_database(":memory:")
    initial_obls = len(svc.repo.list_obligations())

    ferc_res = svc.analyze_versions("FERC-RM22-14", "FERC-RM22-14_nopr", "FERC-RM22-14_final_rule")
    actions = svc.repo.list_actions()
    assert len(actions) > 0

    # Ensure actions carry change_id
    for a in actions:
        assert a.change_id is not None, f"Action {a.id} missing change_id"

    # Stage 1: compliance analyst accepts the action (adopts the obligation)
    act = actions[0]
    approved_act = svc.transition_action_state(act.id, "u_compliance", ActionState.APPROVED, notes="Approved during review")
    assert approved_act.state == ActionState.APPROVED

    # Verify new Obligation was adopted and indexed
    new_obls = svc.repo.list_obligations()
    assert len(new_obls) == initial_obls + 1
    clean_suffix = act.id.replace("act_", "").upper()
    adopted = svc.repo.get_obligation(f"OBL-ADOPTED-{clean_suffix}")
    assert adopted is not None
    assert adopted.description == act.recommended_action
    assert adopted.owner_id == act.suggested_owner_id

    # Stage 2: project lead accepts, then marks done
    lead = approved_act.suggested_owner_id
    in_progress = svc.transition_action_state(act.id, lead, ActionState.IN_PROGRESS)
    assert in_progress.state == ActionState.IN_PROGRESS
    done = svc.transition_action_state(act.id, lead, ActionState.DONE)
    assert done.state == ActionState.DONE

