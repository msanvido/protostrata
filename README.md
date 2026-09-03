# Strata

**Citation-Grade Regulatory Intelligence & Living Operations Workspace**

Strata is a **change-to-action workspace** that bridges the gap between external regulatory evolution (dockets, NPRMs, revised drafts, final orders) and internal enterprise obligations, capital projects, and governing documents.

---

## Key Principles

1. **Citation-First, Zero Hallucination**: Every material claim is anchored to machine-verifiable paragraph/sentence coordinates checked by deterministic code against immutable document snapshots.
2. **Deterministic Diffing with Probabilistic Interpretation**: Mechanical text deltas are detected via sequence alignment algorithms; LLMs are bounded strictly to semantic interpretation, materiality scoring, and impact reasoning.
3. **Draft vs. Final Gating**: Proceeding status gates action urgency (`DRAFT` / `PROPOSED` = `MONITOR`, `FINAL` = `ACT_NOW`).
4. **Transparent Confidence Gating**: Ambiguous statutory phrases automatically downgrade confidence to `LOW` and route to an **Expert Review Queue** rather than generating unauthorized operational tasks.
5. **Living, Event-Sourced Audit State**: SQLite relational database with an append-only event store (`audit_events`). Human overrides never overwrite system claims—both are preserved chronologically for examination defense.
6. **Multi-Provider LLM Integration**: Natively supports Google Gemini (`google/gemini-2.5-flash` default), Anthropic Claude, OpenAI, OpenRouter, and local Ollama, with offline deterministic fallback.

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
make test        # Runs all test suites (UI, BDD, and Unit/Integration)
```

Alternatively, run manually:
```bash
pip install -r requirements.txt
npm --prefix frontend install && npm --prefix frontend run build
python3 run.py
```
This automatically seeds the database, launches the server, and opens your browser to **http://localhost:8000** (or visit **http://localhost:8000/docs** for the interactive Swagger API).

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
Executes business user-story acceptance tests covering change detection, expert escalation, impact mapping, and living audit trails:
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

Run the complete 6-stage compliance lifecycle directly from your terminal:
```bash
# Default: Live LLM with google/gemini-2.5-flash via OpenRouter
PYTHONPATH=. python3 strata/cli.py

# With OpenAI GPT-4o-mini
PYTHONPATH=. python3 strata/cli.py --llm openrouter --model openai/gpt-4o-mini

# Offline mode (deterministic rules engine, 0 network calls)
PYTHONPATH=. python3 strata/cli.py --llm mock
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
│   │   │                      # HumanOverrideModal, ExpertReviewQueue, AuditTimelineStream
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
│   ├── models/                # Pydantic domain entities, analysis records, and audit events
│   ├── parser/                # Document extractors (PyMuPDF, BS4) and segmenters
│   ├── pipeline/              # DiffEngine, CitationValidator, ChangeClassifier, ImpactMapper
│   ├── storage/               # SQLite database manager, repository layer, and append-only event store
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
