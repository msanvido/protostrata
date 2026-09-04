"""Quality gate: persona-owned two-stage action lifecycle state machine.

Stage 1 (Compliance): PENDING -> APPROVED | REJECTED
Stage 2 (Project Lead): APPROVED -> IN_PROGRESS | DONE; IN_PROGRESS -> DONE
Modifications always return the directive to PENDING compliance review.
"""
import pytest
from strata.seed import seed_database
from strata.models.analysis import ActionState
from strata.service import TransitionError


@pytest.fixture(scope="module")
def svc():
    service = seed_database(":memory:")
    service.analyze_versions("FERC-RM22-14", "FERC-RM22-14_nopr", "FERC-RM22-14_final_rule")
    return service


def _pending_action(service):
    actions = [a for a in service.repo.list_actions() if a.state == ActionState.PENDING]
    assert actions, "No PENDING actions available"
    return actions[0]


def test_compliance_approval_adopts_obligation_and_routes_to_lead(svc):
    act = _pending_action(svc)
    approved = svc.transition_action_state(act.id, "u_compliance", ActionState.APPROVED, notes="Reviewed")
    assert approved.state == ActionState.APPROVED
    assert approved.updated_by == "u_compliance"

    adopted = svc.repo.get_obligation(f"OBL-ADOPTED-{act.id.replace('act_', '').upper()}")
    assert adopted is not None


def test_compliance_rejection_is_terminal(svc):
    act = _pending_action(svc)
    rejected = svc.transition_action_state(act.id, "u_compliance", ActionState.REJECTED, notes="Inapplicable")
    assert rejected.state == ActionState.REJECTED
    with pytest.raises(TransitionError):
        svc.transition_action_state(act.id, rejected.suggested_owner_id, ActionState.APPROVED)


def test_lead_accept_then_done(svc):
    act = _pending_action(svc)
    approved = svc.transition_action_state(act.id, "u_compliance", ActionState.APPROVED)
    lead = approved.suggested_owner_id

    in_progress = svc.transition_action_state(act.id, lead, ActionState.IN_PROGRESS)
    assert in_progress.state == ActionState.IN_PROGRESS
    assert in_progress.updated_by == lead

    done = svc.transition_action_state(act.id, lead, ActionState.DONE, notes="Materialized")
    assert done.state == ActionState.DONE
    assert done.state_note == "Materialized"


def test_lead_can_mark_done_directly(svc):
    act = _pending_action(svc)
    approved = svc.transition_action_state(act.id, "u_compliance", ActionState.APPROVED)
    done = svc.transition_action_state(act.id, approved.suggested_owner_id, ActionState.DONE)
    assert done.state == ActionState.DONE


def test_invalid_transitions_blocked(svc):
    act = _pending_action(svc)
    # Compliance cannot mark a pending action done (that is the project lead's stage)
    with pytest.raises(TransitionError):
        svc.transition_action_state(act.id, "u_compliance", ActionState.DONE)
    # Project lead cannot approve a pending action (that is the compliance stage)
    with pytest.raises(TransitionError):
        svc.transition_action_state(act.id, "u_ops_lead", ActionState.APPROVED)
    # Terminal states accept nothing further
    done = svc.transition_action_state(act.id, "u_compliance", ActionState.APPROVED)
    svc.transition_action_state(act.id, done.suggested_owner_id, ActionState.DONE)
    with pytest.raises(TransitionError):
        svc.transition_action_state(act.id, "u_compliance", ActionState.APPROVED)


def test_override_returns_to_compliance_review_with_audit_trail(svc):
    act = _pending_action(svc)
    original_text = act.recommended_action

    # Compliance modifies a pending directive: stays in review, original preserved
    modified = svc.record_human_override(act.id, "u_compliance", "Revised directive", "Scope tightened")
    assert modified.state == ActionState.PENDING
    assert modified.original_action == original_text
    assert modified.override_rationale == "Scope tightened"

    # Terminal states cannot be modified
    approved = svc.transition_action_state(act.id, "u_compliance", ActionState.APPROVED)
    done = svc.transition_action_state(act.id, approved.suggested_owner_id, ActionState.DONE)
    with pytest.raises(TransitionError):
        svc.record_human_override(act.id, "u_compliance", "Too late", "No longer allowed")


def test_expert_review_persisted_and_confirmation_releases_action():
    service = seed_database(":memory:")
    epa_res = service.analyze_versions("EPA-NSPS-KKKK", "EPA-NSPS-KKKK_draft_revision", "EPA-NSPS-KKKK_final_rule")
    assert epa_res["escalated_to_expert_review"] > 0

    open_items = service.list_expert_reviews("OPEN")
    assert len(open_items) >= epa_res["escalated_to_expert_review"]

    item = open_items[0]
    result = service.resolve_expert_review(item["id"], "u_counsel", "CONFIRMED_APPLICABLE", "Verified scope")

    assert result["status"] == "resolved"
    resolved = service.list_expert_reviews("RESOLVED")
    resolved_item = next(r for r in resolved if r["id"] == item["id"])
    assert resolved_item["decision"] == "CONFIRMED_APPLICABLE"
    assert resolved_item["reviewer_id"] == "u_counsel"
    assert resolved_item["rationale"] == "Verified scope"

    if item["mapping_id"]:
        # Confirmation releases the mapping as a PENDING compliance action
        released = [a for a in service.repo.list_actions() if a.mapping_id == item["mapping_id"]]
        assert len(released) == 1
        assert released[0].state == ActionState.PENDING
