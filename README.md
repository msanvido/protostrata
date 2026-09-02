# Strata

**A citation-grade regulatory intelligence and operations workspace for regulated enterprises**

Strata is a **change-to-action workspace** that bridges the gap between external regulatory evolution (dockets, NPRMs, draft revisions, final orders) and internal enterprise obligations, capital projects, and governing documents.

---

## Key Principles

1. **Citation-First & Machine-Verifiable**: Every claim is anchored to verifiable paragraph/sentence spans checked by deterministic code against immutable document snapshots.
2. **Deterministic Diffing with Probabilistic Interpretation**: Structural text deltas are detected via sequence alignment algorithms; LLMs are used strictly for bounded semantic interpretation, materiality classification, and impact reasoning.
3. **Draft vs. Final Gating**: Proceeding status gates action urgency (`DRAFT` / `PROPOSED` = `MONITOR`, `FINAL` = `ACT_NOW`).
4. **Living, Event-Sourced Audit State**: SQLite relational database with an append-only event store (`audit_events`) ensuring zero data loss and full audit defensibility. Human overrides never overwrite system claims.
5. **Open-Source Ingestion & Embeddings**: Ingests PDF (`PyMuPDF`) and HTML (`BeautifulSoup4`), segments into addressable hierarchies, and indexes semantic embeddings for impact mapping.
6. **Confidence Gating & Expert Review**: Low-confidence or ambiguous statutory phrases are structurally blocked from generating unauthorized operational tasks and route exclusively to an Expert Review Queue.

---

## Real Energy Regulations & Test Projects Included

### Regulations
- **FERC Order 2023 / Docket RM22-14 (Interconnection Queue Reform)**: Successive NOPR vs. Final Rule versions testing status transition, 150-day study timelines, and mandatory IEEE 2800 inverter ride-through.
- **EPA 40 CFR Part 60 Subpart KKKK (Combustion Turbines)**: Draft vs. Final Rule testing NOx emission ceilings (2.5 ppmvd), quarterly CEMS reporting, and ambiguous statutory terminology (*"ancillary emergency generation asset"*).

### Enterprise Projects
- **Project 1: Gas Turbine Substation for Tier 4 Datacenter (`PROJ-GT-DC-01`)**: 120MW Simple-Cycle Gas Turbine and 230kV substation for primary and mission-critical backup power.
- **Project 2: Mojave Desert Solar Array & Battery Storage (`PROJ-SOLAR-DESERT-02`)**: 250MW Solar PV + 100MW/400MWh BESS on federal desert land.

---

## Quickstart & Verification

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```
*(Dependencies: `fastapi`, `uvicorn`, `pydantic`, `behave`, `pytest`, `PyMuPDF`, `beautifulsoup4`, `sentence-transformers`, `numpy`)*

### 2. Run Cucumber / Gherkin BDD Tests
```bash
PYTHONPATH=. behave features/
```

### 3. Run Pytest Unit & Integration Tests
```bash
PYTHONPATH=. pytest -v tests/
```

### 4. Run Interactive CLI Demonstration
```bash
PYTHONPATH=. python3 strata/cli.py
```

### 5. Launch the REST API
```bash
PYTHONPATH=. uvicorn strata.api.app:app --reload --port 8000
```

---

## Documentation
- [Strata_PRD.md](Strata_PRD.md) — Product Requirements Document
- [Strata_TDD.md](Strata_TDD.md) — System Architecture & Technical Design Document
