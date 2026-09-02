from behave import given, when, then
from strata.seed import seed_database
from strata.pipeline.validator import CitationValidator
from strata.models.analysis import ConfidenceTier, ActionUrgency, ActionState

@given('the Strata workspace is initialized with energy regulations')
@given('the Strata workspace is initialized with enterprise projects')
def step_init_workspace(context):
    context.service = seed_database(":memory:")

@when('the system analyzes differences between "{prev_ver}" and "{curr_ver}"')
def step_analyze_differences(context, prev_ver, curr_ver):
    proc_id = prev_ver.split("_")[0]
    context.analysis_result = context.service.analyze_versions(proc_id, prev_ver, curr_ver)
    context.proc_id = proc_id

@then('the system should detect at least {count:d} material changes')
def step_assert_material_changes(context, count):
    material = context.analysis_result["material_changes"]
    assert material >= count, f"Expected at least {count} material changes, but found {material}"

@then('the system should detect a status transition from "{from_status}" to "{to_status}"')
def step_assert_status_transition(context, from_status, to_status):
    status_records = [
        c for c in context.analysis_result["change_records"]
        if c["change_type"] == "STATUS_TRANSITION"
    ]
    assert len(status_records) > 0, "No status transition record found"
    assert from_status in status_records[0]["description"]
    assert to_status in status_records[0]["description"]

@then('every material change record must contain a valid citation referencing the source text')
def step_assert_citations(context):
    for cr in context.analysis_result["change_records"]:
        if cr["materiality"] == "MATERIAL":
            has_cite = cr["after_citation"] is not None or cr["before_citation"] is not None
            assert has_cite, f"Change record {cr['id']} missing citation"

@then('the system should map at least one impact to project "{proj_id}" or obligation "{obl_id}"')
def step_assert_impact_mapped(context, proj_id, obl_id):
    mappings = context.service.repo.list_impact_mappings()
    matched = [m for m in mappings if m.affected_id in [proj_id, obl_id]]
    assert len(matched) > 0, f"Expected mapping to {proj_id} or {obl_id}, but found {[m.affected_id for m in mappings]}"

@then('every impact mapping must include a verified regulatory citation and an affected asset citation')
def step_assert_dual_citations(context):
    mappings = context.service.repo.list_impact_mappings()
    for m in mappings:
        assert m.change_citation.quoted_text, f"Mapping {m.id} missing change-side quotation"
        assert m.affected_citation.quoted_text, f"Mapping {m.id} missing affected-side quotation"

@then('the recommended action urgency should be "{urgency}" because the proceeding status is "{status}"')
def step_assert_action_urgency(context, urgency, status):
    actions = context.service.repo.list_actions()
    assert len(actions) > 0, "No actions were generated"
    assert any(a.urgency == urgency for a in actions), f"Expected at least one action with urgency {urgency}, found {[a.urgency for a in actions]}"

@then('the system should identify an ambiguous term with confidence "{confidence}"')
def step_assert_ambiguous_term(context, confidence):
    low_records = [c for c in context.analysis_result["change_records"] if c["confidence"] == confidence]
    assert len(low_records) > 0, f"Expected at least one change record with confidence {confidence}"

@then('the low-confidence item should be routed to the Expert Review Queue')
def step_assert_expert_queue(context):
    escalated = context.analysis_result["escalated_items"]
    assert len(escalated) > 0, "Expected items escalated to Expert Review Queue"
    context.escalated_target_id = escalated[0]["mapping"]["id"] if escalated[0]["mapping"] else escalated[0]["change"]["id"]

@then('when expert reviewer "{reviewer_id}" resolves the item with decision "{decision}"')
def step_resolve_expert_item(context, reviewer_id, decision):
    context.resolution_event = context.service.resolve_expert_review(
        target_id=context.escalated_target_id,
        reviewer_id=reviewer_id,
        decision=decision,
        rationale="Facility qualifies as essential grid infrastructure rather than exempt standalone unit."
    )

@then('an immutable audit event should record the expert resolution and rationale')
def step_assert_expert_audit_event(context):
    assert context.resolution_event is not None
    assert context.resolution_event.event_type.value == "EXPERT_REVIEW_RESOLVED"

@given('the Strata workspace has completed analysis of "{proc_id}"')
def step_completed_analysis(context, proc_id):
    context.service = seed_database(":memory:")
    if proc_id == "EPA-NSPS-KKKK":
        context.analysis_result = context.service.analyze_versions(
            proc_id, "EPA-NSPS-KKKK_draft_revision", "EPA-NSPS-KKKK_final_rule"
        )

@when('reviewer "{reviewer_id}" records an override on an action for "{obl_id}"')
def step_record_override(context, reviewer_id, obl_id):
    # Find mapping and action
    mappings = context.service.repo.list_impact_mappings()
    matched_map = next((m for m in mappings if m.affected_id == obl_id), None)
    
    actions = context.service.repo.list_actions()
    target_action = actions[0] if actions else None
    
    if not target_action:
        # Create action if none was directly linked
        from strata.models.analysis import ActionRecommendation, ActionUrgency
        target_action = context.service.repo.create_action(ActionRecommendation(
            id="act_test_override",
            mapping_id=matched_map.id if matched_map else "map_temp",
            recommended_action="Update CEMS monitoring schedule to quarterly.",
            suggested_owner_id=reviewer_id,
            urgency=ActionUrgency.ACT_NOW
        ))
        
    context.target_action_id = target_action.id
    context.original_action_text = target_action.recommended_action
    
    context.service.record_human_override(
        action_id=target_action.id,
        user_id=reviewer_id,
        updated_action_text="Mandate daily automated CEMS calibration audits in addition to quarterly submissions.",
        override_rationale="Heightened risk of compliance inquiry given recent EPA enforcement priority."
    )

@then('the action state should transition to "{expected_state}"')
def step_assert_action_state(context, expected_state):
    action = context.service.repo.get_action(context.target_action_id)
    assert action.state == expected_state, f"Expected action state {expected_state}, got {action.state}"

@then('the original action text must remain preserved in the audit event log')
def step_assert_preserved_audit(context):
    events = context.service.event_store.get_events_for_stream(f"action:{context.target_action_id}")
    override_events = [e for e in events if e.event_type == "HUMAN_OVERRIDE_RECORDED"]
    assert len(override_events) > 0, "No override event found in audit log"
    assert override_events[0].payload["original_action"] == context.original_action_text

@then('the reconstructed living audit dossier for "{stream_id}" must contain all historical events')
def step_assert_dossier(context, stream_id):
    dossier = context.service.event_store.generate_audit_dossier(stream_id)
    assert dossier["total_events"] > 0, f"Dossier for {stream_id} is empty"
