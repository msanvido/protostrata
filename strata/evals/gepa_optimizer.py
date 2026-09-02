import random
import copy
from typing import List, Dict, Any, Tuple
from strata.evals.evaluator import PromptEvaluator, EvaluationMetrics

class GEPAPromptOptimizer:
    """Generative Evolutionary Prompt Architecture (GEPA) Optimizer for Strata."""

    # Evolutionary mutation operators and prompt component genes
    SYSTEM_ROLES = [
        "You are an expert energy regulatory compliance officer specialized in FERC and EPA enforcement.",
        "You are a forensic regulatory intelligence analyst ensuring strict audit-defensible attribution.",
        "You are a citation-grade legal operations engineer translating regulatory deltas into enterprise obligations."
    ]

    NEGATIVE_CONSTRAINTS = [
        "CRITICAL: Never alter, paraphrase, or truncate quoted spans. Quotes must be verbatim character substrings.",
        "MANDATORY: Reject any inference not supported by a verbatim source citation. Flag ambiguity immediately.",
        "GUARDRAIL: Distinguish non-binding draft/proposed language from legally binding final rule mandates."
    ]

    REASONING_STYLES = [
        "stepwise_forensic",
        "dual_grounded_deduction",
        "concise_materiality_first"
    ]

    EXEMPLAR_SETS = [
        ["ferc_order_2023_cluster_150_days", "epa_nsps_kkkk_scr_tightening"],
        ["ferc_order_2023_ieee_2800", "epa_nsps_kkkk_cems_quarterly"],
        ["ferc_all_combined", "epa_all_combined"]
    ]

    def __init__(self, population_size: int = 6, generations: int = 3, mutation_rate: float = 0.3):
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.history: List[Dict[str, Any]] = []

    def initialize_population(self) -> List[Dict[str, Any]]:
        """Creates an initial diversified population of prompt candidates."""
        population = []
        for i in range(self.population_size):
            candidate = {
                "candidate_id": f"gen0_cand{i+1}",
                "system_role": random.choice(self.SYSTEM_ROLES),
                "negative_constraints": random.sample(self.NEGATIVE_CONSTRAINTS, k=random.randint(1, len(self.NEGATIVE_CONSTRAINTS))),
                "reasoning_style": random.choice(self.REASONING_STYLES),
                "exemplars": random.choice(self.EXEMPLAR_SETS),
                "allow_paraphrasing": False,  # Strict anti-hallucination baseline
                "require_dual_citations": True,
                "materiality_strictness": 0.6 + random.uniform(-0.1, 0.2)
            }
            population.append(candidate)
        return population

    def mutate_candidate(self, candidate: Dict[str, Any], gen_idx: int, cand_idx: int) -> Dict[str, Any]:
        """Mutates prompt parameters and instructions."""
        mutant = copy.deepcopy(candidate)
        mutant["candidate_id"] = f"gen{gen_idx}_cand{cand_idx}"

        if random.random() < self.mutation_rate:
            mutant["system_role"] = random.choice(self.SYSTEM_ROLES)
        if random.random() < self.mutation_rate:
            mutant["negative_constraints"] = random.sample(self.NEGATIVE_CONSTRAINTS, k=random.randint(1, len(self.NEGATIVE_CONSTRAINTS)))
        if random.random() < self.mutation_rate:
            mutant["reasoning_style"] = random.choice(self.REASONING_STYLES)
        if random.random() < self.mutation_rate:
            mutant["exemplars"] = random.choice(self.EXEMPLAR_SETS)
        if random.random() < self.mutation_rate:
            mutant["materiality_strictness"] = max(0.2, min(0.9, mutant["materiality_strictness"] + random.uniform(-0.15, 0.15)))

        return mutant

    def crossover(self, parent_a: Dict[str, Any], parent_b: Dict[str, Any], gen_idx: int, cand_idx: int) -> Dict[str, Any]:
        """Combines structural prompt elements from two high-fitness parents."""
        child = {
            "candidate_id": f"gen{gen_idx}_cross{cand_idx}",
            "system_role": parent_a["system_role"],
            "negative_constraints": list(set(parent_a["negative_constraints"] + parent_b["negative_constraints"])),
            "reasoning_style": parent_b["reasoning_style"],
            "exemplars": parent_a["exemplars"] if random.random() > 0.5 else parent_b["exemplars"],
            "allow_paraphrasing": False,
            "require_dual_citations": True,
            "materiality_strictness": (parent_a["materiality_strictness"] + parent_b["materiality_strictness"]) / 2.0
        }
        return child

    def run_optimization(self) -> Tuple[Dict[str, Any], EvaluationMetrics, List[Dict[str, Any]]]:
        """Executes the evolutionary optimization loop over the golden benchmark dataset."""
        population = self.initialize_population()
        best_candidate = None
        best_metrics = None

        for gen in range(self.generations):
            evaluated_population: List[Tuple[Dict[str, Any], EvaluationMetrics]] = []

            for cand in population:
                metrics = PromptEvaluator.evaluate_candidate(cand)
                evaluated_population.append((cand, metrics))

            # Sort by fitness score descending
            evaluated_population.sort(key=lambda x: x[1].fitness_score, reverse=True)

            gen_best_cand, gen_best_metrics = evaluated_population[0]
            if best_metrics is None or gen_best_metrics.fitness_score > best_metrics.fitness_score:
                best_candidate = gen_best_cand
                best_metrics = gen_best_metrics

            gen_summary = {
                "generation": gen + 1,
                "best_candidate_id": gen_best_cand["candidate_id"],
                "best_fitness": gen_best_metrics.fitness_score,
                "citation_veracity": gen_best_metrics.citation_veracity_rate,
                "materiality_f1": gen_best_metrics.materiality_f1,
                "hard_gate_passed": gen_best_metrics.hard_gate_passed,
                "population_fitness_avg": sum(m.fitness_score for _, m in evaluated_population) / len(evaluated_population)
            }
            self.history.append(gen_summary)

            # Prune candidates failing the hard gate (zero fitness)
            valid_survivors = [item for item in evaluated_population if item[1].hard_gate_passed]
            if not valid_survivors:
                valid_survivors = evaluated_population[:2]  # Fallback to top if all pruned

            # Select elite (top 2) for reproduction
            elites = [item[0] for item in valid_survivors[:2]]

            # Build next generation via mutation and crossover
            next_generation = [copy.deepcopy(elites[0])]  # Preserve best
            
            while len(next_generation) < self.population_size:
                if len(elites) >= 2 and random.random() > 0.4:
                    child = self.crossover(elites[0], elites[1], gen + 1, len(next_generation))
                else:
                    parent = random.choice(elites)
                    child = self.mutate_candidate(parent, gen + 1, len(next_generation))
                next_generation.append(child)

            population = next_generation

        return best_candidate, best_metrics, self.history
