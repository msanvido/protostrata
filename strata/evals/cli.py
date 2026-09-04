"""Strata Prompt Evaluation & GEPA Evolutionary Optimizer CLI.

Standalone build/eval tool for measuring prompt fitness against golden benchmarks
and evolving system prompts, negative constraints, and extraction strictness.
"""

import sys
import json
import argparse
from strata.evals.gepa_optimizer import GEPAPromptOptimizer

def main():
    parser = argparse.ArgumentParser(
        description="Strata Build-Time GEPA Prompt Evaluator & Evolutionary Optimizer"
    )
    parser.add_argument(
        "--population-size",
        type=int,
        default=4,
        help="Candidate prompt population size per generation (default: 4)"
    )
    parser.add_argument(
        "--generations",
        type=int,
        default=2,
        help="Number of evolutionary iterations/generations to run (default: 2)"
    )
    parser.add_argument(
        "--mutation-rate",
        type=float,
        default=0.4,
        help="Probability of mutation vs crossover (default: 0.4)"
    )
    parser.add_argument(
        "--export",
        type=str,
        default="",
        help="Optional path to export optimal candidate configuration as JSON"
    )
    args = parser.parse_args()

    print("=" * 80)
    print("STRATA BUILD-TIME PROMPT EVALS & GEPA OPTIMIZER")
    print("=" * 80)
    print(f"[*] Hyperparameters: Generations={args.generations}, Population={args.population_size}, MutationRate={args.mutation_rate}")

    optimizer = GEPAPromptOptimizer(
        population_size=args.population_size,
        generations=args.generations,
        mutation_rate=args.mutation_rate
    )

    best_cand, best_metrics, history = optimizer.run_optimization()

    print("\n[+] Optimization Completed Successfully:")
    print(f"    - Generations Evaluated:           {len(history)}")
    print(f"    - Best Prompt Fitness Score:       {best_metrics.fitness_score:.4f}")
    print(f"    - Verbatim Citation Veracity Rate: {best_metrics.citation_veracity_rate * 100:.1f}%")
    print(f"    - Zero-Tolerance Hard Gate:        {'PASSED' if best_metrics.hard_gate_passed else 'FAILED (Pruned)'}")
    print(f"    - Materiality Classification F1:   {best_metrics.materiality_f1:.4f}")
    print(f"    - Change Type Classification Acc:  {best_metrics.change_type_accuracy:.4f}")
    print(f"    - Dual Citation Grounding Acc:     {best_metrics.grounding_accuracy:.4f}")
    print(f"    - Benchmark Inference Latency:     {best_metrics.latency_ms:.2f} ms")

    print("\n[+] Optimal Prompt Configuration:")
    print(f"    - Candidate ID: \"{best_cand['candidate_id']}\"")
    print(f"    - System Role:  \"{best_cand['system_role']}\"")
    print(f"    - Verbatim Citations Only: {not best_cand.get('allow_paraphrasing', False)}")
    print(f"    - Dual Citation Enforcement: {best_cand.get('require_dual_citations', True)}")
    print(f"    - Materiality Strictness Threshold: {best_cand.get('materiality_strictness', 0.6):.2f}")
    print(f"    - Active Negative Constraints ({len(best_cand['negative_constraints'])}):")
    for rule in best_cand["negative_constraints"]:
        print(f"      * {rule}")

    if args.export:
        export_payload = {
            "optimal_candidate": best_cand,
            "metrics": best_metrics.to_dict(),
            "generations": len(history)
        }
        with open(args.export, "w") as f:
            json.dump(export_payload, f, indent=2)
        print(f"\n[+] Exported optimal candidate configuration to: {args.export}")

    print("=" * 80)

if __name__ == "__main__":
    main()
