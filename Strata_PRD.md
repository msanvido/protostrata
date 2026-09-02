# Strata — Product Requirements Document (PRD)

**A citation-grade regulatory intelligence and operations workspace for regulated enterprises**

Version: 1.0 · Status: Draft

---

## 1. Problem Statement

Regulated enterprises (utilities, banks, insurers, healthcare payers, telecom operators) live inside a constant stream of regulatory proceedings — dockets, NPRMs, orders, comment periods, final rules. Each proceeding evolves through multiple versions (draft → revised draft → final order), and each version can quietly change scope, deadlines, or requirements in ways that ripple into the company's internal obligations, active projects, and governing documents (policies, procedures, contracts).

Today, compliance and regulatory affairs teams handle this by manually re-reading full proceedings every time a new version drops, then playing a slow game of institutional telephone to figure out who needs to know and what they need to do. The bottleneck is **not detection** ("a new version was filed") — alert feeds and search tools already do that. The bottleneck is **interpretation and action**:

- What *specifically* changed between this version and the last one?
- Is the change in a draft (non-binding, still negotiable) or a final order (binding, triggers obligations)?
- What internal obligation, project, or document does this change actually touch?
- What should a human do about it, and who is the right human to do it?
- Can we trust this interpretation enough to act on it automatically, or does a person need to check it first (human-in-the-loop)?
- Who is responsible for acting on this change?
- What is the timing, by when does this change need to be actioned (due date)?
- What happens if we don't act on this change (risk)?
- Are there any conflicts or dependencies with other existing or pending regulations?

Strata is built to close this gap: a **change-to-action workspace**, not another feed.

## 2. Goals

| # | Goal | Why it matters |
|---|---|---|
| G1 | Detect and characterize material changes between successive versions of a regulatory proceeding | Manual full-text re-review doesn't scale across dozens of live dockets |
| G2 | Ground every claim in an exact, quotable source passage (citation-grade) | Compliance teams cannot act on an unverifiable summary; audit and legal defensibility require traceability |
| G3 | Correctly classify document status (draft vs. final) and adjust urgency/bindingness accordingly | Acting on a draft as if it were final wastes effort or creates false compliance posture; missing a final order creates real exposure |
| G4 | Map each detected change to the specific company obligations, projects, and documents it affects | This is the "so what" — the thing generic search/alert tools cannot do because they don't have company context |
| G5 | Recommend a concrete next action and route it to the correct reviewer/role | Turns intelligence into an assigned, trackable task |
| G6 | Maintain a living, versioned, auditable project state, including impacts and actions, over time | Regulatory response is a long-lived process; the system must show *why* a decision was made months later, to an auditor or examiner |
| G7 | Escalate low-confidence interpretations instead of guessing | A confidently wrong compliance interpretation is worse than an honest "needs human review" — trust is the product |
| G8 | Detect conflicts or dependencies with other existing or pending regulations | Enables holistic cross-docket risk visibility and prevents siloed compliance errors |

### Non-Goals (out of scope for this build)

- Legal advice or final regulatory determinations — Strata assists human reviewers, it does not replace legal judgment.
- Real-time crawling of live government docket systems (the challenge uses synthetic/ingested proceeding versions, not live scraping infrastructure).
- Multi-tenant SaaS concerns (billing, org management, SSO) — single-tenant demo scope.
- Full workflow/ticketing system parity with tools like Jira/ServiceNow — routing creates actionable records, not a full PM suite.

## 3. Users & Personas

**Primary persona — Compliance/Regulatory Affairs Analyst ("Reviewer")**
Monitors 10–50 active dockets across their portfolio. Needs to know, per new filing, "does this change anything I'm responsible for," with enough evidence to trust the answer or quickly override it.

**Secondary persona — Obligation/Project Owner ("Assignee")**
Owns a specific compliance obligation, project workstream, or internal document (e.g., "Data Retention Policy v4," "Q3 Grid Interconnection Filing Project"). Receives routed actions when a regulatory change affects something they own.

## 4. Core User Stories

1. *As a Reviewer*, when a new version of a docket I follow is ingested, I want a diff-level summary of what materially changed (not a reprint of the whole document), so I don't have to re-read everything.
2. *As a Reviewer*, I want every claim of "this changed" backed by the exact source sentence/paragraph from both versions, so I can verify it in seconds rather than re-deriving it myself.
3. *As a Reviewer*, I want to immediately know if a proceeding is a draft/NPRM or a final/adopted order, and have recommended urgency reflect that, so I don't over- or under-react.
4. *As an Assignee*, I want to be told specifically which of my obligations, projects, or documents are affected by a change, with a short rationale, so I know what to do without reading the underlying filing.
5. *As a Reviewer*, I want a recommended action (e.g., "update Section 4.2 of Data Retention Policy," "notify Project X owner of new deadline") routed to the correct owner, so nothing falls through the cracks.


## 5. Functional Requirements

### FR1 — Ingestion
- FR1.1: Accept successive versions of a regulatory proceeding (title, docket ID, version label, status [draft/final/other], effective/comment dates, full text, section structure).
- FR1.2: Accept a synthetic company context bundle: obligations (id, description, source citation, owner, status), projects (id, name, description, linked obligations, owner, milestones), and documents (id, title, type, current text/sections, owner, version).
- FR1.3: Normalize all ingested text into an addressable structure (document → section → paragraph → sentence) so every downstream claim can cite a stable location, not just "the document."
- FR1.4: Persist raw ingested versions immutably; all analysis derives from immutable snapshots.

### FR2 — Change Detection
- FR2.1: Given two versions of the same proceeding, compute a structural diff at section/paragraph granularity.
- FR2.2: Classify each detected diff as material (substantive obligation, deadline, scope, or definition change) vs. immaterial (formatting, renumbering, non-substantive wording) via LLM judgment layered on top of the raw diff.
- FR2.3: For each material change, produce a structured "Change Record": change type (new requirement / deadline shift / scope change / requirement removed / definition change / other), plain-language description, and paired citations (exact passage in v(n-1), exact passage in v(n), or "new" / "removed" if one side is absent).
- FR2.4: Detect and surface the proceeding's status per version (draft, proposed, final/adopted, effective date if present) and flag any status transition (e.g., draft → final) as a distinct, high-salience event.

### FR3 — Citation Grounding
- FR3.1: Every material claim (a change existing, an obligation being affected, an action being recommended) must carry at least one machine-checkable citation: source document ID + version + section/paragraph locator + verbatim quoted span.
- FR3.2: The system must refuse to state a claim it cannot ground in a citation; ungroundable claims degrade to "possible interpretation, needs review" rather than an assertion.
- FR3.3: Citations must be independently verifiable in the UI (clicking a citation shows the exact source passage highlighted in context).

### FR4 — Impact Mapping
- FR4.1: For each material Change Record, identify candidate obligations, projects, and documents in the company context that it plausibly affects.
- FR4.2: Score/rank candidate matches with a rationale (why this obligation/project/document is implicated) grounded in a citation from both the change and the affected item.
- FR4.3: Support many-to-many mapping (one change can affect multiple obligations; one obligation can be affected by multiple changes over time).

### FR5 — Action Recommendation & Routing
- FR5.1: For each confirmed impact mapping, generate a recommended action (e.g., "revise document section," "update obligation deadline," "notify project owner," "no action — informational only").
- FR5.2: Assign a suggested reviewer/owner based on the owner metadata of the affected obligation/project/document.
- FR5.3: Recommended urgency must reflect proceeding status (draft = lower urgency / "monitor," final = higher urgency / "act") and any explicit deadlines found in the text.
- FR5.4: Actions are created as trackable records with state (pending / accepted / modified / rejected / done), not just chat output.

### FR6 — Confidence & Escalation
- FR6.1: Every Change Record, impact mapping, and action recommendation carries a confidence tier (High / Medium / Low) derived from: citation strength, ambiguity of language, novelty of the situation, and materiality/stakes.
- FR6.2: Low-confidence items are automatically routed to an "Expert Review" queue instead of being auto-applied or presented as settled fact.
- FR6.3: The system explains *why* it is uncertain (e.g., "ambiguous whether 'affected entities' includes Tier 2 vendors — no explicit definition found") rather than a generic low-confidence flag.
- FR6.4: Human decisions on escalated items are captured and reduce/adjust confidence scoring context going forward (logged, not necessarily model-retrained, for MVP).

### FR7 — Living Project State & Audit Trail
- FR7.1: Every obligation, project, and document maintains a timeline of every regulatory change that touched it, the mapping rationale, the action taken, who took it, and when.
- FR7.2: All state transitions (draft→final, action pending→done, low-confidence→resolved) are append-only events; nothing is silently overwritten.
- FR7.3: A full audit export (per obligation/project or company-wide, for a date range) must be producible showing: what changed, when the company became aware, what was concluded, what was done, and by whom.
- FR7.4: Human overrides of any system claim/mapping/action are recorded alongside the original system output — never replacing it, always alongside it (for defensibility: "the system said X, a human corrected to Y, on this date").
- FR7.5: Modern single-page Workspace User Interface:
  - FR7.5.1: Multi-view workspace providing Dashboard & Overview, Change Records & Paired Citations, Action Inbox, Expert Review Queue, and Living Audit Dossier.
  - FR7.5.2: Side-by-side comparative citation viewer with highlighted character offsets into immutable source snapshots.
  - FR7.5.3: Non-destructive human override modal capturing reviewer modification and mandatory audit rationale.
  - FR7.5.4: Expert review queue resolution workflow allowing legal counsel to confirm or dismiss ambiguous items with recorded justification.

## 6. Success Metrics (for the challenge demo)

| Metric | Target for demo |
|---|---|
| Citation coverage | 100% of material claims (changes, mappings, actions) carry a verifiable citation |
| Draft/final classification accuracy | Correctly labels status for every version in the synthetic dataset |
| Change recall vs. precision | Every seeded material change in the test scenario is detected (recall), with minimal noise flagged as material when it isn't (precision) |
| Impact mapping correctness | Every seeded obligation/project/document link in the test scenario is surfaced with correct rationale |
| Escalation behavior | Every seeded "ambiguous" scenario is routed to Expert Review rather than confidently asserted |
| Audit reconstructability | A reviewer can answer "why did we conclude X" for any item using only the audit trail, with zero access to chat/model logs |

## 7. Scope for the Build Challenge

**In scope (must demo):**
- Ingest ≥2 versions of one synthetic proceeding (draft + final, or draft v1 + draft v2 + final) with at least one status transition.
- Synthetic company context: a handful of obligations, 1–2 projects, 1–2 governing documents, with owners.
- End-to-end pipeline: ingest → diff → classify materiality → cite → map to company context → recommend action + route → log to living project state.
- At least one deliberately ambiguous change that triggers Expert Review escalation, to demonstrate FR6.
- A viewable audit trail / project timeline for at least one obligation and one project.

**Explicitly deferred (mention as future work, not built):**
- Live docket ingestion/connectors to government systems (e.g., regulations.gov, PUC filing systems).
- Multi-user permissions, notifications infrastructure (email/Slack), and SLA tracking on routed actions.
- Fine-tuned/learned confidence calibration (MVP uses a rubric-based heuristic, not a trained model).
- Multi-jurisdiction / multi-language proceedings.

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| LLM hallucinates a change or citation that isn't actually in the source text | Enforce citation-then-claim architecture (Section 3 of TDD): no claim is rendered without a validated, span-checked citation; validation is a deterministic code check, not just model self-report |
| Draft language gets treated with final-order urgency (or vice versa) | Status is extracted as a structured, validated field per version, independent of change analysis, and gates urgency downstream |
| Over-triggering Expert Review erodes trust in the "living workspace" framing (too much manual work) | Confidence rubric is calibrated to escalate only genuine ambiguity (undefined terms, conflicting sections, novel scenario types), not every change |
| Under-triggering Expert Review causes silent bad guesses | Bias the rubric conservatively for the demo; err toward escalation on anything touching deadlines, penalties, or scope-of-applicability language |
| Impact mapping matches too broadly (every change "affects everything") | Require a citation-grounded rationale connecting change language to obligation/project/document language, not just topical similarity |

## 9. MVP Scoping Assumptions

- The compliance and regulation should be scoped to the energy sector in particular the electricy generation and transmission sector. 
- Should action recommendations ever auto-execute (e.g., auto-update a document draft) or should all actions require human acceptance? MVP: always human-accepted, system never writes to a governing document autonomously, but highlight the confidence level of the action recommendation and the confidence score should be displayed in the UI.
- How should conflicting interpretations from two different change records touching the same obligation be reconciled? MVP: both surface on the obligation's timeline; conflict itself becomes a Low-confidence flag for review.
