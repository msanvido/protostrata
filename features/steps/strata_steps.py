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
    context.resolution_result = context.service.resolve_expert_review(
        target_id=context.escalated_target_id,
        reviewer_id=reviewer_id,
        decision=decision,
        rationale="Facility qualifies as essential grid infrastructure rather than exempt standalone unit."
    )

@then('the expert resolution and rationale should be recorded successfully')
def step_assert_expert_resolution(context):
    assert context.resolution_result is not None
    assert context.resolution_result["status"] == "resolved"
    assert context.resolution_result["decision"] == "CONFIRMED_APPLICABLE"

