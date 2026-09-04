import pytest
from strata.evals.golden_dataset import (
    MATERIALITY_BENCHMARK_CASES,
    CITATION_VERACITY_CASES,
    IMPACT_GROUNDING_CASES
)
from strata.evals.evaluator import PromptEvaluator
from strata.evals.gepa_optimizer import GEPAPromptOptimizer

def test_golden_dataset_structure():
    assert len(MATERIALITY_BENCHMARK_CASES) >= 10
    assert len(CITATION_VERACITY_CASES) >= 6
    assert len(IMPACT_GROUNDING_CASES) >= 6

    # Verify all change types are represented in golden dataset
    change_types_covered = {case["expected_change_type"] for case in MATERIALITY_BENCHMARK_CASES}
    assert "NEW_REQUIREMENT" in change_types_covered
    assert "DEADLINE_SHIFT" in change_types_covered
    assert "SCOPE_CHANGE" in change_types_covered
    assert "REQUIREMENT_REMOVED" in change_types_covered
    assert "DEFINITION_CHANGE" in change_types_covered

    # Verify both Material and Immaterial cases are present
    materialities = {case["expected_materiality"] for case in MATERIALITY_BENCHMARK_CASES}
    assert "MATERIAL" in materialities
    assert "IMMATERIAL" in materialities

    # Verify negative controls exist in impact grounding
    has_negative_control = any(case["expected_affected_project"] is None for case in IMPACT_GROUNDING_CASES)
    assert has_negative_control is True

    for case in MATERIALITY_BENCHMARK_CASES:
        assert "expected_materiality" in case
        assert "expected_change_type" in case
        assert "before_text" in case
        assert "after_text" in case

def test_evaluator_metrics_and_hard_gate_pass():
    # Compliant prompt with strict citation constraints
    strict_candidate = {
        "candidate_id": "test_strict_candidate",
        "system_role": "Forensic compliance analyst",
        "allow_paraphrasing": False,
        "require_dual_citations": True,
        "materiality_strictness": 0.6
    }
    metrics = PromptEvaluator.evaluate_candidate(strict_candidate)
    
    assert metrics.hard_gate_passed is True
    assert metrics.citation_veracity_rate == 1.0
    assert metrics.materiality_f1 > 0.7
    assert metrics.fitness_score > 0.7
    assert metrics.latency_ms > 0

def test_evaluator_zero_tolerance_pruning_on_hallucination():
    # Flawed candidate that allows paraphrased citations
    hallucinating_candidate = {
        "candidate_id": "test_hallucinating_candidate",
        "system_role": "Loose summarizer",
        "allow_paraphrasing": True,  # Permitting non-verbatim text
        "require_dual_citations": True,
        "materiality_strictness": 0.5
    }
    metrics = PromptEvaluator.evaluate_candidate(hallucinating_candidate)
    
    # Assert zero-tolerance hard constraint immediately prunes candidate
    assert metrics.hard_gate_passed is False
    assert metrics.citation_veracity_rate < 1.0
    assert metrics.fitness_score == 0.0

def test_gepa_optimizer_evolutionary_loop():
    optimizer = GEPAPromptOptimizer(population_size=4, generations=2, mutation_rate=0.4)
    best_candidate, best_metrics, history = optimizer.run_optimization()

    assert best_candidate is not None
    assert best_metrics is not None
    assert len(history) == 2
    assert best_metrics.hard_gate_passed is True
    assert best_metrics.citation_veracity_rate == 1.0
    assert best_metrics.fitness_score > 0.0

    # Ensure optimizer selected valid prompt genes
    assert "system_role" in best_candidate
    assert "negative_constraints" in best_candidate
    assert best_candidate["allow_paraphrasing"] is False
