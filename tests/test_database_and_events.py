import pytest
from strata.storage.database import Database
from strata.storage.repositories import StrataRepository
from strata.models.entities import User, UserRole, Obligation, Project
from strata.models.analysis import ActionRecommendation, ActionUrgency, ActionState

def test_database_and_relational_persistence():
    db = Database(":memory:")
    repo = StrataRepository(db)

    # Create User
    user = User(id="u1", name="Alice", email="alice@enterprise.com", role=UserRole.PROJECT_LEAD)
    repo.create_user(user)
    assert repo.get_user("u1").name == "Alice"

    # Create Obligation
    obl = Obligation(id="OBL-1", description="Maintain battery backup", owner_id="u1")
    repo.create_obligation(obl)
    assert repo.get_obligation("OBL-1").description == "Maintain battery backup"

    # Create Project
    proj = Project(id="PROJ-1", name="Alpha Facility", description="Solar site", owner_id="u1", linked_obligations=["OBL-1"])
    repo.create_project(proj)
    fetched_proj = repo.get_project("PROJ-1")
    assert fetched_proj is not None
    assert fetched_proj.name == "Alpha Facility"
    assert "OBL-1" in fetched_proj.linked_obligations

    # Create Proceeding & Version & ChangeRecord & ImpactMapping for FK constraints
    from strata.models.entities import Proceeding, ProceedingVersion, ProceedingStatus
    from strata.models.analysis import ChangeRecord, ChangeType, Materiality, ConfidenceTier, ImpactMapping, Citation
    
    proc = Proceeding(id="P1", docket_id="D1", title="Test Rule", jurisdiction="FERC")
    repo.create_proceeding(proc)
    ver = ProceedingVersion(id="V1", proceeding_id="P1", version_label="Final", status=ProceedingStatus.FINAL, filed_date="2026-09-01", raw_text="text", sections=[])
    repo.create_proceeding_version(ver)

    cr = ChangeRecord(id="CR1", proceeding_id="P1", from_version_id=None, to_version_id="V1", change_type=ChangeType.NEW_REQUIREMENT, materiality=Materiality.MATERIAL, description="New requirement", confidence=ConfidenceTier.HIGH)
    repo.create_change_record(cr)

    cite = Citation(document_id="P1", version_id="V1", section_id="sec_1", para_id="p1", quoted_text="text")
    mapping = ImpactMapping(id="map_1", change_id="CR1", affected_type="OBLIGATION", affected_id="OBL-1", rationale="Impacted", change_citation=cite, affected_citation=cite, confidence=ConfidenceTier.HIGH)
    repo.create_impact_mapping(mapping)

    # Create and update action override
    act = ActionRecommendation(
        id="act_1",
        mapping_id="map_1",
        recommended_action="Inspect battery telemetry",
        suggested_owner_id="u1",
        urgency=ActionUrgency.ACT_NOW
    )
    repo.create_action(act)
    assert repo.get_action("act_1").state == ActionState.PENDING

    # Override preserves original directive text and records rationale (state returns to PENDING review)
    repo.update_action_override("act_1", "Inspect battery telemetry daily", ActionState.PENDING.value,
                                updated_by="u1", rationale="Frequency raised after audit")
    updated = repo.get_action("act_1")
    assert updated.state == ActionState.PENDING
    assert updated.recommended_action == "Inspect battery telemetry daily"
    assert updated.original_action == "Inspect battery telemetry"
    assert updated.override_rationale == "Frequency raised after audit"
    assert updated.updated_by == "u1"

    # State transitions persist actor attribution
    repo.update_action_state("act_1", ActionState.APPROVED.value, updated_by="u1", note="Reviewed")
    approved = repo.get_action("act_1")
    assert approved.state == ActionState.APPROVED
    assert approved.state_note == "Reviewed"
