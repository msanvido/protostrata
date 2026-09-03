import pytest
from strata.service import StrataService
from strata.models.entities import Project, ProceedingStatus
from strata.models.events import AuditEventType

def test_project_lifecycle_and_audit():
    service = StrataService(db_path=":memory:")
    
    # 1. Create Project
    proj = Project(
        id="PROJ-BESS-PEAKER-03",
        name="PJM Fast-Response Battery Energy Storage System",
        description="50MW / 200MWh lithium-ion battery system providing primary frequency response in PJM.",
        owner_id="u_storage_eng",
        status="PLANNED",
        linked_obligations=[]
    )
    created = service.create_project(proj, creator_id="u_admin")
    assert created.id == "PROJ-BESS-PEAKER-03"
    
    # Verify in repo
    retrieved = service.repo.get_project("PROJ-BESS-PEAKER-03")
    assert retrieved is not None
    assert retrieved.name == "PJM Fast-Response Battery Energy Storage System"
    assert retrieved.owner_id == "u_storage_eng"

    # Verify audit event
    dossier = service.event_store.generate_audit_dossier("project:PROJ-BESS-PEAKER-03")
    assert dossier["total_events"] == 1
    assert dossier["reconstructed_timeline"][0]["event_type"] == AuditEventType.PROJECT_CREATED.value

    # 2. Delete Project
    deleted = service.delete_project("PROJ-BESS-PEAKER-03", user_id="u_admin")
    assert deleted is True
    assert service.repo.get_project("PROJ-BESS-PEAKER-03") is None

    # Verify deletion audit event
    dossier = service.event_store.generate_audit_dossier("project:PROJ-BESS-PEAKER-03")
    assert dossier["total_events"] == 2
    assert dossier["reconstructed_timeline"][1]["event_type"] == AuditEventType.PROJECT_DELETED.value

def test_regulation_lifecycle_and_baseline_analysis():
    service = StrataService(db_path=":memory:")

    # First ingest a test project to receive impacts
    proj = Project(
        id="PROJ-CYBER-01",
        name="Bulk Electric Substation Cyber & Physical Security",
        description="Substation control center operating 500kV bulk electric transformers.",
        owner_id="u_sec_lead",
        status="ACTIVE"
    )
    service.create_project(proj)

    sample_regulation_text = """Section 1: Mandatory Physical Security Protections
All transmission owners operating critical 500kV bulk electric substations must implement 24/7 automated perimeter intrusion detection systems and physical barriers within 90 calendar days.

Section 2: Administrative Record Retention
Facilities shall retain maintenance logs for five years.
"""

    # 1. Create brand new regulation
    proc, ver = service.create_proceeding(
        proceeding_id="NERC-CIP-014",
        docket_id="RD24-02",
        title="Physical Security Reliability Standards for Bulk Power Systems",
        jurisdiction="NERC",
        version_label="Proposed Standard",
        raw_text=sample_regulation_text,
        status=ProceedingStatus.FINAL,
        user_id="u_admin"
    )

    assert proc.id == "NERC-CIP-014"
    assert len(ver.sections) == 2
    assert service.repo.get_proceeding("NERC-CIP-014") is not None

    # Verify audit event
    proc_dossier = service.event_store.generate_audit_dossier("proceeding:NERC-CIP-014")
    assert proc_dossier["total_events"] >= 1
    assert any(e["event_type"] == AuditEventType.PROCEEDING_CREATED.value for e in proc_dossier["reconstructed_timeline"])

    # 2. Run baseline analysis (all sections analyzed as ADDED)
    res = service.analyze_new_regulation("NERC-CIP-014", ver.id)
    assert res["proceeding_id"] == "NERC-CIP-014"
    assert res["total_changes"] == 2
    assert res["material_changes"] >= 1
    
    # Material change must contain citation
    material_crs = [c for c in res["change_records"] if c["materiality"] == "MATERIAL"]
    assert len(material_crs) >= 1
    assert material_crs[0]["after_citation"]["quoted_text"] is not None

    # 3. Delete regulation
    del_proc = service.delete_proceeding("NERC-CIP-014", user_id="u_admin")
    assert del_proc is True
    assert service.repo.get_proceeding("NERC-CIP-014") is None

    # Verify deletion audit event
    proc_dossier = service.event_store.generate_audit_dossier("proceeding:NERC-CIP-014")
    assert any(e["event_type"] == AuditEventType.PROCEEDING_DELETED.value for e in proc_dossier["reconstructed_timeline"])
