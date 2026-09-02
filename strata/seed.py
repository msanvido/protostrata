import json
import os
from strata.service import StrataService
from strata.models.entities import UserRole

def seed_database(db_path: str = "strata.db") -> StrataService:
    """Initializes and seeds the database with the two enterprise projects and energy regulations."""
    service = StrataService(db_path=db_path)
    service.db.reset()

    # 1. Seed Reviewer & Admin Users
    service.ingest_user("u_reviewer", "Elena Rostova", "e.rostova@regulated-compliance.com", UserRole.REVIEWER)
    service.ingest_user("u_counsel", "David Sterling", "d.sterling@regulated-compliance.com", UserRole.LEAD)

    # 2. Seed Gas Turbine Datacenter Project
    gt_path = os.path.join(os.path.dirname(__file__), "..", "data", "company_context", "gas_turbine_datacenter.json")
    with open(gt_path, "r") as f:
        gt_data = json.load(f)

    service.ingest_user(gt_data["user"]["id"], gt_data["user"]["name"], gt_data["user"]["email"], UserRole.ASSIGNEE)
    for doc in gt_data["documents"]:
        service.ingest_document(doc["id"], doc["title"], doc["doc_type"], doc["owner_id"], doc["raw_text"])
    for obl in gt_data["obligations"]:
        service.ingest_obligation(obl["id"], obl["description"], obl["owner_id"], obl.get("linked_doc_id"))
    service.ingest_project(
        gt_data["project"]["id"], gt_data["project"]["name"], gt_data["project"]["description"],
        gt_data["project"]["owner_id"], gt_data["project"]["linked_obligations"]
    )

    # 3. Seed Desert Solar Farm Project
    solar_path = os.path.join(os.path.dirname(__file__), "..", "data", "company_context", "desert_solar_farm.json")
    with open(solar_path, "r") as f:
        solar_data = json.load(f)

    service.ingest_user(solar_data["user"]["id"], solar_data["user"]["name"], solar_data["user"]["email"], UserRole.ASSIGNEE)
    for doc in solar_data["documents"]:
        service.ingest_document(doc["id"], doc["title"], doc["doc_type"], doc["owner_id"], doc["raw_text"])
    for obl in solar_data["obligations"]:
        service.ingest_obligation(obl["id"], obl["description"], obl["owner_id"], obl.get("linked_doc_id"))
    service.ingest_project(
        solar_data["project"]["id"], solar_data["project"]["name"], solar_data["project"]["description"],
        solar_data["project"]["owner_id"], solar_data["project"]["linked_obligations"]
    )

    # 4. Ingest FERC Order 2023 (NOPR vs Final Rule)
    ferc_nopr_path = os.path.join(os.path.dirname(__file__), "..", "data", "regulations", "ferc_order_2023_nopr.txt")
    ferc_final_path = os.path.join(os.path.dirname(__file__), "..", "data", "regulations", "ferc_order_2023_final.txt")
    service.ingest_proceeding_version(
        proceeding_id="FERC-RM22-14",
        version_label="NOPR",
        file_path_or_content=ferc_nopr_path,
        docket_id="RM22-14-000",
        title="Improvements to Generator Interconnection Procedures",
        jurisdiction="FERC"
    )
    service.ingest_proceeding_version(
        proceeding_id="FERC-RM22-14",
        version_label="Final Rule",
        file_path_or_content=ferc_final_path,
        docket_id="RM22-14-000",
        title="Improvements to Generator Interconnection Procedures",
        jurisdiction="FERC"
    )

    # 5. Ingest EPA NSPS Subpart KKKK (Draft vs Final Rule)
    epa_v1_path = os.path.join(os.path.dirname(__file__), "..", "data", "regulations", "epa_nsps_kkkk_v1.txt")
    epa_v2_path = os.path.join(os.path.dirname(__file__), "..", "data", "regulations", "epa_nsps_kkkk_v2.txt")
    service.ingest_proceeding_version(
        proceeding_id="EPA-NSPS-KKKK",
        version_label="Draft Revision",
        file_path_or_content=epa_v1_path,
        docket_id="EPA-HQ-OAR-2023-0105",
        title="Standards of Performance for Stationary Combustion Turbines",
        jurisdiction="EPA"
    )
    service.ingest_proceeding_version(
        proceeding_id="EPA-NSPS-KKKK",
        version_label="Final Rule",
        file_path_or_content=epa_v2_path,
        docket_id="EPA-HQ-OAR-2023-0105",
        title="Standards of Performance for Stationary Combustion Turbines",
        jurisdiction="EPA"
    )

    return service

if __name__ == "__main__":
    svc = seed_database()
    print("Successfully seeded Strata database with 2 enterprise projects and 2 energy regulations.")
