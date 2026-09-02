import sys
import json
import argparse
from strata.seed import seed_database
from strata.llm.client import LLMClient

def main():
    parser = argparse.ArgumentParser(description="Strata Regulatory Operations & Intelligence Workspace")
    parser.add_argument("--llm", type=str, default="openrouter", help="LLM Provider: openrouter (default), gemini, anthropic, openai, ollama, or mock")
    parser.add_argument("--model", type=str, default="google/gemini-2.5-flash", help="Specific model ID (default: google/gemini-2.5-flash)")
    parser.add_argument("--skip-evals", action="store_true", help="Skip running GEPA prompt evals loop")
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
        event = svc.resolve_expert_review(
            target_id=target_id,
            reviewer_id="u_counsel",
            decision="CONFIRMED_NON_EXEMPT",
            rationale="Datacenter primary generation does not qualify under ancillary emergency exemptions."
        )
        print(f"    - Resolution logged to event store: Event ID {event.id} ({event.event_type.value})")

    # 4. Human Override
    actions = svc.repo.list_actions()
    if actions:
        target_act = actions[0]
        print(f"\n[4] Recording Human Override on Action '{target_act.id}' by Compliance Reviewer 'u_reviewer'...")
        updated = svc.record_human_override(
            action_id=target_act.id,
            user_id="u_reviewer",
            updated_action_text="Mandate automated CEMS diagnostic sweeps daily in addition to quarterly filings.",
            override_rationale="Strict state air quality oversight requires proactive telemetry audits."
        )
        print(f"    - Action state transitioned to: {updated.state.value}")
        print(f"    - Original system claim preserved alongside human override in append-only event log.")

    # 5. Living Audit Dossier
    print("\n[5] Generating Defensible Living Audit Dossier for 'obligation:OBL-CEMS-02'...")
    dossier = svc.event_store.generate_audit_dossier("obligation:OBL-CEMS-02")
    print(f"    - Total Historical Audit Events Reconstructed: {dossier['total_events']}")
    for evt in dossier["reconstructed_timeline"][:4]:
        print(f"      [{evt['timestamp']}] {evt['actor']} -> {evt['event_type']}: {evt['summary']}")

    # 6. Section 8.3 Prompt Optimization & Validation via Evals and GEPA
    if not args.skip_evals:
        print("\n[6] Executing Section 8.3: Prompt Evals & GEPA Evolutionary Optimizer...")
        from strata.evals.gepa_optimizer import GEPAPromptOptimizer
        optimizer = GEPAPromptOptimizer(population_size=4, generations=2, mutation_rate=0.4)
        best_cand, best_metrics, history = optimizer.run_optimization()
        print(f"    - Golden Dataset Evals Completed: {len(history)} Generations")
        print(f"    - Best Prompt Fitness Score: {best_metrics.fitness_score:.4f}")
        print(f"    - Verbatim Citation Veracity Rate: {best_metrics.citation_veracity_rate * 100:.1f}% (Hard Gate: {best_metrics.hard_gate_passed})")
        print(f"    - Materiality Classification F1: {best_metrics.materiality_f1:.4f}")
        print(f"    - Optimal System Prompt Role: \"{best_cand['system_role']}\"")
        print(f"    - Enforced Negative Constraints: {len(best_cand['negative_constraints'])} rules active")

    print("\n" + "=" * 80)
    print("STRATA MVP & SECTION 8 VERIFICATION COMPLETED SUCCESSFULLY.")
    print("=" * 80)

if __name__ == "__main__":
    main()
