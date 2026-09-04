# AGENTS.md — Strata Engineering & Agent Guidelines

## 1. Project Mission & Identity
**Strata** is an automated regulatory intelligence and operations platform designed for energy and infrastructure developers. It converts complex, evolving regulatory filings (e.g., FERC Order 2023, EPA NSPS Subpart KKKK) into machine-verified compliance deltas and operationally assigned work directives.

- **PRD Reference**: [`Strata_PRD.md`](file:///Users/marco/src/protostrata/Strata_PRD.md)
- **TDD Reference**: [`Strata_TDD.md`](file:///Users/marco/src/protostrata/Strata_TDD.md)
- **Primary Service Orchestrator**: [`strata/service.py`](file:///Users/marco/src/protostrata/strata/service.py)

---

## 2. Core Architectural Invariants (Never Break These)

1. **Citation-First & Zero Hallucination**:
   - Every regulatory or internal citation MUST be backed by exact character-for-character substring verification against immutable raw document snapshots via [`CitationValidator.validate_citation()`](file:///Users/marco/src/protostrata/strata/pipeline/validator.py#L12).
   - If an LLM-generated quote fails exact or whitespace-normalized substring check, immediately flag `SIG_CITE_FAIL` and force confidence to `ConfidenceTier.LOW`. Never bypass or soften this check.

2. **Deterministic Diffing with Bounded LLM Semantic Scoring**:
   - Lexical deltas are computed deterministically via sequence alignment ([`DiffEngine.align_and_diff`](file:///Users/marco/src/protostrata/strata/pipeline/diff_engine.py#L8)).
   - LLMs are strictly bounded to semantic materiality classification, change type categorization, and impact description through structured JSON / Pydantic schemas ([`ChangeClassifier.classify_diff_pair`](file:///Users/marco/src/protostrata/strata/pipeline/classifier.py#L14)).

3. **Status-Gated Action Urgency**:
   - In [`ActionRouter._determine_urgency`](file:///Users/marco/src/protostrata/strata/pipeline/action_router.py#L43):
     - $\text{ProceedingStatus.FINAL} \implies \text{ActionUrgency.ACT_NOW}$
     - $\text{ProceedingStatus.DRAFT}$ or $\text{PROPOSED} \implies \text{ActionUrgency.MONITOR}$
   - Proposed rules / NOPRs cannot legally be enforced as immediate binding directives.

4. **Transparent Confidence Gating & Ambiguity Escalation**:
   - Low-confidence items (`ConfidenceTier.LOW` triggered by `SIG_CITE_FAIL` or `SIG_AMBIG_TERM` like *"ancillary emergency generation asset"*) are **structurally blocked** from generating action recommendations.
   - They are persisted directly into the **Expert Review Queue** ([`strata/storage/database.py`](file:///Users/marco/src/protostrata/strata/storage/database.py)) for human legal counsel determination.

5. **Direct Relational Persistence (No Event Sourcing)**:
   - State and human overrides live directly in SQLite tables (`actions`, `change_records`, `impact_mappings`, `expert_reviews`).
   - Human overrides and state changes are recorded via `update_action_override` and `update_action_state` in [`strata/storage/repositories.py`](file:///Users/marco/src/protostrata/strata/storage/repositories.py) preserving `original_action`, `updated_by`, and `override_rationale`. Do not introduce complex event-replay or append-only event stores.

---

## 3. Two-Stage Persona-Owned Action Lifecycle

All directive transitions are strictly enforced server-side in [`StrataService.transition_action_state`](file:///Users/marco/src/protostrata/strata/service.py#L420) and [`ActionState.allowed_transitions`](file:///Users/marco/src/protostrata/strata/models/analysis.py):

```
                       [Analysis Engine]
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │  PENDING (Compliance Action Inbox)       │
        └───────┬──────────────────────────┬───────┘
                │                          │
(COMPLIANCE)    │ Accept & Adopt           │ Reject (COMPLIANCE)
                ▼                          ▼
        ┌───────────────┐          ┌───────────────┐
        │   APPROVED    │          │   REJECTED    │ (Terminal)
        └───────┬───────┘          └───────────────┘
                │
                │ Handed off to Project Lead
                │
                ├──────────────────────────┐
(PROJECT_LEAD)  │ Accept Directive         │ Mark Done directly (PROJECT_LEAD)
                ▼                          │
        ┌───────────────┐                  │
        │  IN_PROGRESS  │                  │
        └───────┬───────┘                  │
                │                          │
(PROJECT_LEAD)  │ Mark Done                │
                └──────────► ┌───────────┐ ◄┘
                             │   DONE    │ (Terminal)
                             └───────────┘
```

- **Human Modifications / Overrides**:
  - Compliance analyst modifying `PENDING` $\implies$ remains `PENDING`.
  - Project lead modifying `APPROVED` or `IN_PROGRESS` $\implies$ resets back to `PENDING` for compliance re-review.
  - Terminal states (`DONE`, `REJECTED`) can never be modified.
  - Mandatory audit rationale must be provided.

---

## 4. Repository & Codebase Layout

```
protostrata/
├── strata/
│   ├── api/
│   │   └── app.py                # FastAPI routes (REST API & UI static serving)
│   ├── embeddings/
│   │   └── vector_store.py       # Dual TF-IDF / Cosine / Embedding vector search
│   ├── evals/
│   │   ├── evaluator.py          # Ground-truth evaluation harness (Hallucination gate)
│   │   ├── gepa_optimizer.py     # Evolutionary prompt optimizer (GEPA loop)
│   │   └── golden_dataset.py     # Hardcoded golden regulatory benchmark cases
│   ├── llm/
│   │   └── client.py             # Multi-provider client (OpenRouter, Gemini, Claude, Mock)
│   ├── models/
│   │   ├── analysis.py           # ChangeRecord, ImpactMapping, ActionRecommendation, ConfidenceTier
│   │   └── entities.py           # ProceedingVersion, Paragraph, Obligation, Project, Document
│   ├── parser/
│   │   ├── extractor.py          # HTML/PDF raw text extraction
│   │   ├── metadata.py           # Status, docket ID, date extraction
│   │   └── segmenter.py          # Markdown & section paragraph chunking
│   ├── pipeline/
│   │   ├── action_router.py      # Urgency determination & role-based action assignment
│   │   ├── classifier.py         # Semantic materiality & status transition detection
│   │   ├── confidence.py         # ConfidenceRubric & Expert Review gating
│   │   ├── diff_engine.py        # SequenceMatcher paragraph-level alignment
│   │   ├── impact_mapper.py      # Vector similarity matching to obligations & assets
│   │   └── validator.py          # Exact substring CitationValidator
│   ├── storage/
│   │   ├── database.py           # SQLite DDL schema & initialization
│   │   ├── repositories.py       # Relational CRUD operations & queries
│   │   └── seed_data.py          # Initial regulatory dockets & enterprise assets
│   ├── cli.py                    # Interactive terminal simulation & demo runner
│   └── service.py                # Primary business logic coordinator
├── frontend/                     # React 18 + Tailwind CSS + Lucide Icons + Vite
├── features/                     # Cucumber / Behave Gherkin BDD specs & step definitions
├── tests/                        # 14 Pytest test suites (30+ test cases)
├── data/                         # Sample FERC & EPA HTML dockets
├── Makefile                      # Standardized developer commands
└── run.py                        # Service bootstrapper (auto-seeds DB & opens browser)
```

---

## 5. Development & Testing Commands

Always verify changes using these commands before finalizing work:

### Backend Tests
```bash
# Run all unit and integration tests (must pass 30/30)
make test-unit
# Alternatively:
PYTHONPATH=. pytest -v tests/

# Run specific test modules
PYTHONPATH=. pytest -v tests/test_diff_engine.py
PYTHONPATH=. pytest -v tests/test_action_lifecycle.py
PYTHONPATH=. pytest -v tests/test_citation_validator.py
```

### BDD Acceptance Tests
```bash
# Run Gherkin feature specs
PYTHONPATH=. behave features/
```

### Frontend Verification
```bash
# Run React Jest / Vitest test suite
cd frontend && npm test -- --watchAll=false
```

### Database Management
```bash
# Reset database to empty schema (no data)
make reset-db

# Reset and re-seed baseline FERC/EPA dockets & enterprise projects
make seed
```

### Local Execution
```bash
# Compile frontend and start FastAPI server on http://localhost:8000
make run
```

---

## 6. Coding & Agent Best Practices

- **Never mock or bypass citation validation in production pipeline paths**: All regulatory changes must trace to verified paragraph coordinates.
- **Maintain docstrings and type annotations**: Preserve Pydantic models and explicit type hints on all pipeline inputs/outputs.
- **Preserve git hygiene**: Keep temporary interview prep materials (`interview_prep/`) untracked in `.gitignore`.
- **Atomic commits**: Group logical changes together with concise, descriptive commit messages.
- **Fail fast on invalid state transitions**: Raise `TransitionError` whenever an action lifecycle rule is violated.
