import sys
import json
import argparse
from strata.seed import seed_database
from strata.llm.client import LLMClient

def main():
    parser = argparse.ArgumentParser(description="Strata Regulatory Operations & Intelligence Workspace")
    parser.add_argument("--llm", type=str, default="openrouter", help="LLM Provider: openrouter (default), gemini, anthropic, openai, ollama, or mock")
    parser.add_argument("--model", type=str, default="google/gemini-2.5-flash", help="Specific model ID (default: google/gemini-2.5-flash)")
    args = parser.parse_args()

    print("=" * 80)
    print("STRATA REGULATORY INTELLIGENCE & OPERATIONS WORKSPACE (MVP DEMO)")
    print("=" * 80)

    # Configure Live LLM (default: openrouter + google/gemini-2.5-flash)
    llm_client = None
    if args.llm and args.llm != "mock":
        llm_client = LLMClient(provider=args.llm, model=args.model)
        print(f"\n[*] Live LLM Backend Enabled:")
        print(f"    - Provider: {llm_client.provider}")
        print(f"    - Model:    {llm_client.model}")
    else:
        print("\n[*] Backend: High-Speed Deterministic Offline Rules Engine (Mock)")

    # 1. Initialize and Seed
    print("\n[1] Initializing SQLite database and seeding enterprise projects & regulations...")
    svc = seed_database("strata.db")
    if llm_client:
        svc.llm_client = llm_client

    print("    - Seeded Project 1: Gas Turbine Substation for Tier 4 Datacenter (PROJ-GT-DC-01)")
    print("    - Seeded Project 2: Mojave Desert 250MW Solar Array & Storage (PROJ-SOLAR-DESERT-02)")
    print("    - Ingested FERC Order 2023 (NOPR vs Final Rule)")
    print("    - Ingested EPA NSPS Subpart KKKK (Draft vs Final Rule)")

    # 2. Analyze FERC Order 2023
    print("\n[2] Executing Change Analysis on FERC Order 2023 (RM22-14)...")
    ferc_res = svc.analyze_versions("FERC-RM22-14", "FERC-RM22-14_nopr", "FERC-RM22-14_final_rule")
    print(f"    - Total Changes Detected: {ferc_res['total_changes']}")
    print(f"    - Material Changes: {ferc_res['material_changes']}")
    print(f"    - Impact Mappings Generated: {ferc_res['impact_mappings']}")
    print(f"    - Action Recommendations Created: {ferc_res['actions_created']}")

    print("\n    Sample Routed Action Recommendation:")
    for act in ferc_res["actions"][:2]:
        print(f"    * Action ID: {act['id']}")
        print(f"      Assigned Owner: {act['suggested_owner_id']}")
        print(f"      Urgency: {act['urgency']} (Gated by FINAL Rule status)")
        print(f"      Recommendation: {act['recommended_action']}")

    # 3. Analyze EPA NSPS Subpart KKKK (Ambiguity & Escalation)
    print("\n[3] Executing Change Analysis on EPA NSPS Subpart KKKK (Combustion Turbines)...")
    epa_res = svc.analyze_versions("EPA-NSPS-KKKK", "EPA-NSPS-KKKK_draft_revision", "EPA-NSPS-KKKK_final_rule")
    print(f"    - Total Changes Detected: {epa_res['total_changes']}")
    print(f"    - Ambiguous Items Escalated to Expert Review Queue: {epa_res['escalated_to_expert_review']}")
    
    if epa_res["escalated_items"]:
        item = epa_res["escalated_items"][0]
        print("\n    Sample Expert Review Queue Item:")
        print(f"    * Trigger Signals: {item['signals']}")
        print(f"    * Regulatory Excerpt: \"{item['change']['description']}\"")
        
        # Expert resolves item
        target_id = item["mapping"]["id"] if item["mapping"] else item["change"]["id"]
        print(f"\n    [Resolving Item via Expert Reviewer 'u_counsel' (General Counsel)]...")
        res = svc.resolve_expert_review(
            target_id=target_id,
            reviewer_id="u_counsel",
            decision="CONFIRMED_NON_EXEMPT",
            rationale="Datacenter primary generation does not qualify under ancillary emergency exemptions."
        )
        print(f"    - Resolution recorded: Decision '{res['decision']}' by reviewer '{res['reviewer_id']}'")

    # 4. Two-Stage Action Lifecycle Demonstration (Compliance Review -> Project Lead Execution)
    actions = svc.repo.list_actions()
    if actions:
        from strata.models.analysis import ActionState
        target_act = actions[0]

        print(f"\n[4] Two-Stage Action Lifecycle on Action '{target_act.id}' (owner: {target_act.suggested_owner_id})...")

        # Stage 1: Compliance analyst reviews and accepts the directive (adopts the obligation)
        print(f"    [Stage 1 - Compliance Review] Accepting directive as 'u_compliance'...")
        approved = svc.transition_action_state(
            target_act.id, "u_compliance", ActionState.APPROVED,
            notes="Reviewed against enterprise scope; adopted as formal obligation."
        )
        print(f"    - State: PENDING -> {approved.state.value}; formal obligation 'OBL-ADOPTED-{target_act.id.replace('act_', '').upper()}' created and routed to project lead.")

        # Stage 2a: Project lead accepts the directive
        lead = approved.suggested_owner_id
        print(f"    [Stage 2 - Project Execution] Accepting directive as project lead '{lead}'...")
        in_progress = svc.transition_action_state(target_act.id, lead, ActionState.IN_PROGRESS)
        print(f"    - State: APPROVED -> {in_progress.state.value}")

        # Stage 2b: Project lead marks done once the obligation is materialized
        done = svc.transition_action_state(target_act.id, lead, ActionState.DONE, notes="Obligation materialized in operations.")
        print(f"    - State: IN_PROGRESS -> {done.state.value}")

        # Invalid transition rejected by the persona-owned state machine
        other = actions[1] if len(actions) > 1 else target_act
        try:
            svc.transition_action_state(other.id, "u_compliance", ActionState.DONE)
        except ValueError as e:
            print(f"    [Guardrail] Invalid transition blocked by the state machine: {str(e)[:110]}")

        # Compliance modification of a still-pending directive (returns to PENDING with rationale)
        if other is not target_act and other.state == ActionState.PENDING:
            updated = svc.record_human_override(
                action_id=other.id,
                user_id="u_compliance",
                updated_action_text="Mandate automated CEMS diagnostic sweeps daily in addition to quarterly filings.",
                override_rationale="Strict state air quality oversight requires proactive telemetry audits."
            )
            print(f"    - Modified pending directive (state stays {updated.state.value}); original text & rationale persisted.")

    # 5. Dynamic Project & Regulation Lifecycle with Baseline Analysis
    print("\n[5] Dynamic Lifecycle: Adding New Project & Ingesting New Regulation Baseline...")
    # Add new project
    from strata.models.entities import Project, ProceedingStatus
    new_proj = Project(
        id="PROJ-BESS-PEAKER-03",
        name="PJM Fast-Response Battery Energy Storage System",
        description="50MW / 200MWh lithium-ion battery system providing primary frequency response in PJM.",
        owner_id="u_storage_eng",
        status="PLANNED"
    )
    svc.create_project(new_proj, creator_id="u_admin")
    print(f"    - Created Project: '{new_proj.name}' ({new_proj.id}) assigned to '{new_proj.owner_id}'")

    # Ingest brand new regulation
    nerc_text = """Section 1: Mandatory Physical Security Protections
All transmission owners operating critical 500kV bulk electric substations must implement 24/7 automated perimeter intrusion detection systems and physical barriers within 90 calendar days.

Section 2: Maintenance and Audit Retention
Owners must retain all perimeter inspection records on-site for five years.
"""
    proc, ver = svc.create_proceeding(
        proceeding_id="NERC-CIP-014",
        docket_id="RD24-02",
        title="Physical Security Reliability Standards for Bulk Power Systems",
        jurisdiction="NERC",
        version_label="Initial Standard Filing",
        raw_text=nerc_text,
        status=ProceedingStatus.FINAL,
        user_id="u_admin"
    )
    print(f"    - Ingested New Regulation: '{proc.title}' ({proc.id}) with {len(ver.sections)} sections")

    # Baseline analysis: all sections analyzed as new additions
    print("    - Running Baseline Analysis (all sections treated as new additions)...")
    baseline_res = svc.analyze_new_regulation(proc.id, ver.id)
    print(f"      * Total Detected Requirements: {baseline_res['total_changes']}")
    print(f"      * Material Substantive Changes: {baseline_res['material_changes']}")
    print(f"      * Verifiable Citations Grounded: {len([c for c in baseline_res['change_records'] if c.get('after_citation')])}")

    print("\n" + "=" * 80)
    print("STRATA MVP & FULL LIFECYCLE DEMONSTRATION COMPLETED SUCCESSFULLY.")
    print("=" * 80)

if __name__ == "__main__":
    main()
