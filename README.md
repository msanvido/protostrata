# Strata

**Citation-Grade Regulatory Intelligence & Living Operations Workspace**

Strata is a **change-to-action workspace** that bridges the gap between external regulatory evolution (dockets, NPRMs, revised drafts, final orders) and internal enterprise obligations, capital projects, and governing documents.

---

## Key Principles

1. **Citation-First, Zero Hallucination**: Every material claim is anchored to machine-verifiable paragraph/sentence coordinates checked by deterministic code against immutable document snapshots.
2. **Deterministic Diffing with Probabilistic Interpretation**: Mechanical text deltas are detected via sequence alignment algorithms; LLMs are bounded strictly to semantic interpretation, materiality scoring, and impact reasoning.
3. **Draft vs. Final Gating**: Proceeding status gates action urgency (`DRAFT` / `PROPOSED` = `MONITOR`, `FINAL` = `ACT_NOW`).
4. **Transparent Confidence Gating**: Ambiguous statutory phrases automatically downgrade confidence to `LOW` and are highlighted in the **Expert Review Queue** (persisted in SQLite) rather than generating unauthorized operational tasks.
5. **Two-Stage, Persona-Owned Action Lifecycle**: Nothing reaches a project team without compliance sign-off. Compliance reviews every routed directive first; only then does it reach the project lead as a change in their obligations; the lead accepts it for execution and marks it done once materialized.
6. **Human In The Loop & Audit Attribution**: Every transition and modification records the acting user, mandatory rationale, and preserved original directive text directly in SQLite.
7. **Multi-Provider LLM Integration**: Natively supports Google Gemini (`google/gemini-2.5-flash` default), Anthropic Claude, OpenAI, OpenRouter, and local Ollama, with offline deterministic fallback.

---

## The Two-Stage Action Lifecycle

Strata turns regulatory changes into executed work through a strict, persona-owned flow:

```
Regulation change detected (diff + classifier)
        │
        ▼
Impacted projects & obligations identified (impact mapping)
        │
        ▼
┌─ STAGE 1 · COMPLIANCE REVIEW ─────────────────────────────────────────────┐
│  PENDING: directive queued in the Compliance Review Inbox                 │
│  ✓ Accept & Adopt Obligation → APPROVED (formal obligation created)       │
│  ✕ Reject                    → REJECTED (terminal)                        │
│  Modify (mandatory rationale) → stays PENDING, original text preserved    │
└───────────────────────────────────────────────────────────────────────────┘
        │  approved directives appear to the project lead as obligation changes
        ▼
┌─ STAGE 2 · PROJECT EXECUTION ─────────────────────────────────────────────┐
│  Accept Directive → IN_PROGRESS (lead accepts the work)                   │
│  ✓ Mark Done      → DONE (obligation materialized)                        │
└───────────────────────────────────────────────────────────────────────────┘
```

Transitions are **enforced server-side** — the wrong persona (or an illegal jump such as `PENDING → DONE`) is rejected with a 409 listing the allowed transitions. Low-confidence/critical items never enter the flow until counsel resolves them in the Expert Review Queue.

---

## Seeded Enterprise Regulations & Projects

### Real Regulations
- **FERC Order 2023 / Docket RM22-14 (Interconnection Queue Reform)**: NOPR vs. Final Rule testing status transitions, 150-day cluster study timelines, and mandatory IEEE 2800 inverter ride-through.
- **EPA 40 CFR Part 60 Subpart KKKK (Combustion Turbines)**: Draft vs. Final Rule testing NOx emission ceilings (2.5 ppmvd), quarterly CEMS reporting, and ambiguous statutory terminology (*"ancillary emergency generation asset"*).

### Enterprise Capital Projects
- **Project 1: Gas Turbine Substation for Tier 4 Datacenter (`PROJ-GT-DC-01`)**: 120MW Simple-Cycle Gas Turbine and 230kV substation for primary and mission-critical backup power.
- **Project 2: Mojave Desert Solar Array & Battery Storage (`PROJ-SOLAR-DESERT-02`)**: 250MW Solar PV + 100MW/400MWh BESS on federal desert land.

---

## Quickstart

Using `make` (simplest):
```bash
make install     # Installs Python & Node dependencies
make build       # Compiles React frontend into production assets
make run         # Starts backend & opens the React UI in your browser
make reset-db    # Resets SQLite database to empty schema (no seed data)
make test        # Runs all test suites (UI, BDD, and Unit/Integration)
```

Alternatively, run manually:
```bash
pip install -r requirements.txt
npm --prefix frontend install && npm --prefix frontend run build
python3 run.py
```
This seeds the database on first run (restarts preserve your workspace state; use `make reset-db` or `POST /reset` to start over), launches the server, and opens your browser to **http://localhost:8000** (or visit **http://localhost:8000/docs** for the interactive Swagger API).

### Walking the full flow in the UI (5 minutes)

1. **Compliance Analyst View** → pick a docket → **⚡ Run Live Analysis**. Change records, citations, and routed directives appear; ambiguous items land highlighted in the **Expert Review Queue**.
2. *(Optional)* Resolve an Expert Review item with a mandatory rationale — confirming it releases the directive into the review inbox.
3. In the **Compliance Action Inbox**, click **✓ Accept & Adopt Obligation** (or **✕ Reject** / **Modify Directive**). The directive becomes a formal obligation.
4. Switch to **Project Lead View** → select the project: the approved directive now appears as a change in the project's obligations. Click **Accept Directive**, then **✓ Mark Done** once the work is materialized.
5. Check the **Executive Dashboard** to see every directive's position in the lifecycle (Awaiting Compliance Review → With Project Leads → Done).

---

## Running the Automated Test Suites

Strata provides automated test verification across all layers:

### 1. Automated React UI Verification Suite
Validates component rendering, comparative citation highlights, action urgency filtering, human override commits, and full workspace navigation:
```bash
cd frontend
npm test
```

### 2. Cucumber / Gherkin BDD Acceptance Suite
Executes business user-story acceptance tests covering change detection, expert escalation, and impact mapping:
```bash
PYTHONPATH=. behave features/
```

### 3. Pytest Unit, Integration & Live LLM Suite
Runs all 14 backend test modules covering parsers, diff engine, citation gates, live LLM inference, and GEPA evolutionary prompt optimization:
```bash
PYTHONPATH=. pytest -v tests/
```

---

## Interactive CLI Demonstration

Run the complete compliance lifecycle directly from your terminal — including the full two-stage action lifecycle (compliance acceptance → project lead execution → done) and the state-machine guardrails:
```bash
# Default: Live LLM with google/gemini-2.5-flash via OpenRouter
PYTHONPATH=. python3 strata/cli.py

# With OpenAI GPT-4o-mini
PYTHONPATH=. python3 strata/cli.py --llm openrouter --model openai/gpt-4o-mini

# Offline mode (deterministic rules engine, 0 network calls)
PYTHONPATH=. python3 strata/cli.py --llm mock
```

---

## Build-Time Prompt Optimization & GEPA CLI

Optimize system prompt roles, negative constraints, and citation strictness offline against golden regulatory benchmarks:
```bash
# Run standalone evolutionary prompt optimizer
make optimize-prompts

# Or run via Python CLI with custom hyperparameters and optional JSON export:
PYTHONPATH=. python3 -m strata.evals.cli --generations 3 --population-size 6 --export optimal_prompt.json
```

---

## Project Structure

```
protostrata/
├── run.py                     # Unified root launcher (starts backend & opens React UI)
├── requirements.txt           # Python dependencies
├── Strata_PRD.md              # Product Requirements Document
├── Strata_TDD.md              # Technical Design Document
│
├── frontend/                  # React 19 + TypeScript + Vite Workspace SPA
│   ├── src/
│   │   ├── components/        # Header, OverviewTab, ChangeDiffViewer, ActionInbox,
│   │   │                      # HumanOverrideModal, ExpertReviewQueue
│   │   ├── api/client.ts      # Typed API client calling FastAPI endpoints
│   │   ├── types/index.ts     # TypeScript interfaces matching backend models
│   │   ├── test/              # Vitest & React Testing Library automated test suite
│   │   └── App.tsx            # Main application shell
│   └── dist/                  # Compiled production bundle served by FastAPI
│
├── strata/
│   ├── api/                   # FastAPI application & route definitions
│   ├── evals/                 # Golden dataset, PromptEvaluator, and GEPA optimizer
│   ├── llm/                   # Multi-provider LLM client (OpenRouter, Gemini, Claude, OpenAI)
│   ├── models/                # Pydantic domain entities and analysis records
│   ├── parser/                # Document extractors (PyMuPDF, BS4) and segmenters
│   ├── pipeline/              # DiffEngine, CitationValidator, ChangeClassifier, ImpactMapper
│   ├── storage/               # SQLite database manager and relational repository layer
│   ├── cli.py                 # Interactive terminal demonstration script
│   └── seed.py                # Database seeder with real energy regulations & projects
│
├── features/                  # Cucumber/Gherkin BDD feature specifications
│   └── steps/                 # BDD step definitions
│
└── tests/                     # Pytest unit, integration, and live LLM tests
```

---

## Documentation
- [Strata_PRD.md](Strata_PRD.md) — Product Requirements Document
- [Strata_TDD.md](Strata_TDD.md) — System Architecture & Technical Design Document
