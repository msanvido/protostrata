import os
import pytest
from strata.llm.client import LLMClient
from strata.service import StrataService
from strata.seed import seed_database
from strata.models.analysis import Materiality

def get_active_provider():
    if os.environ.get("OPENROUTER_API_KEY"):
        return "openrouter"
    elif os.environ.get("GEMINI_API_KEY"):
        return "gemini"
    elif os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    elif os.environ.get("OPENAI_API_KEY"):
        return "openai"
    elif os.environ.get("STRATA_LLM_PROVIDER") == "ollama":
        return "ollama"
    return None

def test_live_llm_e2e_pipeline():
    """Runs a full end-to-end regulatory change analysis using a real live LLM."""
    provider = get_active_provider()
    if not provider:
        pytest.skip("Skipping live LLM test: No API key detected (set OPENROUTER_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY).")

    # Allow custom model override, default to fast smart model
    model = os.environ.get("STRATA_LLM_MODEL")
    client = LLMClient(provider=provider, model=model)
    print(f"\n[LIVE LLM TEST] Running live E2E with provider: {client.provider}, model: {client.model}")

    # Initialize and seed database
    svc = seed_database(":memory:")
    # Attach live LLM client
    svc.llm_client = client

    # Run analysis with live LLM
    result = svc.analyze_versions("FERC-RM22-14", "FERC-RM22-14_nopr", "FERC-RM22-14_final_rule")

    assert result["total_changes"] >= 3
    assert result["material_changes"] >= 2
    assert result["actions_created"] > 0

    # Verify that LLM produced descriptions
    change_records = result["change_records"]
    has_llm_descriptions = any(client.model in c["description"] for c in change_records)
    assert has_llm_descriptions, "Expected at least one change record enriched by live LLM inference"

    # Verify that every citation passes programmatic validation
    for cr in change_records:
        if cr["after_citation"]:
            assert len(cr["after_citation"]["quoted_text"]) > 0

    # Verify status transition
    status_records = [c for c in change_records if c["change_type"] == "STATUS_TRANSITION"]
    assert len(status_records) == 1

    print(f"[LIVE LLM TEST] Success: Processed {result['total_changes']} changes, created {result['actions_created']} actions using live {client.model}.")
