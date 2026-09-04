import os
from typing import List, Dict, Any, Optional, Tuple
from strata.storage.database import Database
from strata.storage.repositories import StrataRepository
from strata.models.entities import (
    User, Proceeding, ProceedingVersion, InternalDocument, DocumentType, Obligation, ObligationStatus, Project, ProceedingStatus, UserRole
)
from strata.models.analysis import (
    ChangeRecord, ImpactMapping, ActionRecommendation, ConfidenceTier, ActionState, Citation
)
from strata.parser.extractor import DocumentExtractor
from strata.parser.segmenter import DocumentSegmenter
from strata.parser.metadata import MetadataExtractor
from strata.embeddings.vector_store import VectorStore
from strata.pipeline.diff_engine import DiffEngine
from strata.pipeline.validator import CitationValidator
from strata.pipeline.classifier import ChangeClassifier
from strata.pipeline.impact_mapper import ImpactMapper
from strata.pipeline.confidence import ConfidenceRubric
from strata.pipeline.action_router import ActionRouter

COMPLIANCE_REVIEWER = "u_compliance"

class TransitionError(ValueError):
    """Raised when an action lifecycle transition violates the state machine or role ownership."""

class StrataService:
    """Core orchestrator for Strata Regulatory Intelligence & Living Operations.
    
    Coordinates the 5-stage lifecycle:
      1. Ingestion: Canonical paragraph segmentation, status detection, and immutable snapshot storage.
      2. Deterministic Diffing: Sequence alignment detecting paragraph modifications, additions, and deletions.
      3. Classification & Citation Gating: Verbatim quote validation with optional live LLM enrichment.
      4. Impact Mapping: Semantic dense retrieval mapping regulatory shifts to enterprise assets.
      5. Action Routing: Deterministic urgency calculation gated by proceeding status (FINAL -> ACT_NOW).
    """
    def __init__(self, db_path: str = "strata.db", llm_client: Optional[Any] = None):
        self.db = Database(db_path)
        self.repo = StrataRepository(self.db)
        self.vector_store = VectorStore()
        self.impact_mapper = ImpactMapper(self.vector_store)
        self.llm_client = llm_client
        self.rebuild_vector_index()

    def rebuild_vector_index(self):
        """Indexes all existing documents, obligations, and projects into the vector store."""
        try:
            for doc in self.repo.list_documents():
                for sec in doc.sections:
                    for p in sec.paragraphs:
                        self.vector_store.add_document(
                            item_id=f"{doc.id}_{p.para_id}",
                            entity_type="DOC_PARA",
                            entity_id=doc.id,
                            text=f"{doc.title} - {sec.heading}: {p.text}",
                            metadata={"document_id": doc.id, "section_id": sec.section_id, "para_id": p.para_id}
                        )
            for obl in self.repo.list_obligations():
                self.vector_store.add_document(
                    item_id=f"obl_{obl.id}",
                    entity_type="OBLIGATION",
                    entity_id=obl.id,
                    text=f"Compliance Obligation: {obl.description}",
                    metadata={"obligation_id": obl.id, "owner_id": obl.owner_id}
                )
            for p_row in self.db.get_connection().execute("SELECT id FROM projects").fetchall():
                proj = self.repo.get_project(p_row["id"])
                if proj:
                    self.vector_store.add_document(
                        item_id=f"proj_{proj.id}",
                        entity_type="PROJECT",
                        entity_id=proj.id,
                        text=f"Capital Project: {proj.name}. {proj.description}",
                        metadata={"project_id": proj.id, "owner_id": proj.owner_id}
                    )
        except Exception:
            pass

    # --- Ingestion ---
    def ingest_user(self, user_id: str, name: str, email: str, role: UserRole) -> User:
        user = User(id=user_id, name=name, email=email, role=role)
        return self.repo.create_user(user)

    def ingest_proceeding_version(
        self,
        proceeding_id: str,
        version_label: str,
        file_path_or_content: str,
        docket_id: str = "",
        title: str = "",
        jurisdiction: str = "FERC",
        is_raw_content: bool = False,
        file_type: Optional[str] = None
    ) -> ProceedingVersion:
        # Ensure proceeding entity exists
        proc = self.repo.get_proceeding(proceeding_id)
        if not proc:
            proc = Proceeding(id=proceeding_id, docket_id=docket_id or proceeding_id, title=title or proceeding_id, jurisdiction=jurisdiction)
            self.repo.create_proceeding(proc)

        # Extract and segment text
        raw_text = DocumentExtractor.extract_text(file_path_or_content, is_raw_content=is_raw_content, file_type=file_type)
        sections = DocumentSegmenter.segment(raw_text)
        meta = MetadataExtractor.extract_metadata(raw_text)

        version_id = f"{proceeding_id}_{version_label.lower().replace(' ', '_')}"
        version = ProceedingVersion(
            id=version_id,
            proceeding_id=proceeding_id,
            version_label=version_label,
            status=meta["status"],
            filed_date="2026-03-15",
            effective_date=meta["effective_date"],
            comment_due_date=meta["comment_due_date"],
            raw_text=raw_text,
            sections=sections
        )
        self.repo.create_proceeding_version(version)

        # Index paragraphs in vector store
        for sec in sections:
            for p in sec.paragraphs:
                self.vector_store.add_document(
                    item_id=f"{version_id}_{p.para_id}",
                    entity_type="PROCEEDING_PARA",
                    entity_id=proceeding_id,
                    text=f"{sec.heading}: {p.text}",
                    metadata={"version_id": version_id, "section_id": sec.section_id, "para_id": p.para_id}
                )

        return version

    def ingest_document(self, doc_id: str, title: str, doc_type: str, owner_id: str, raw_text: str) -> InternalDocument:
        sections = DocumentSegmenter.segment(raw_text)
        doc = InternalDocument(
            id=doc_id, title=title, doc_type=DocumentType(doc_type), owner_id=owner_id, raw_text=raw_text, sections=sections
        )
        self.repo.create_document(doc)

        for sec in sections:
            for p in sec.paragraphs:
                self.vector_store.add_document(
                    item_id=f"{doc_id}_{p.para_id}",
                    entity_type="DOC_PARA",
                    entity_id=doc_id,
                    text=f"{title} - {sec.heading}: {p.text}",
                    metadata={"document_id": doc_id, "section_id": sec.section_id, "para_id": p.para_id}
                )

        return doc

    def ingest_obligation(self, obl_id: str, description: str, owner_id: str, linked_doc_id: Optional[str] = None) -> Obligation:
        obl = Obligation(id=obl_id, description=description, owner_id=owner_id, linked_doc_id=linked_doc_id)
        self.repo.create_obligation(obl)

        self.vector_store.add_document(
            item_id=f"obl_{obl_id}",
            entity_type="OBLIGATION",
            entity_id=obl_id,
            text=f"Compliance Obligation: {description}",
            metadata={"obligation_id": obl_id, "owner_id": owner_id}
        )
        return obl

    def ingest_project(self, proj_id: str, name: str, description: str, owner_id: str, linked_obligations: Optional[List[str]] = None) -> Project:
        proj = Project(id=proj_id, name=name, description=description, owner_id=owner_id, linked_obligations=linked_obligations or [])
        return self.create_project(proj, creator_id="pipeline:seed")

    def create_project(self, proj: Project, creator_id: str = "u_admin") -> Project:
        """Creates a new project and indexes it into vector search."""
        if not self.repo.get_user(proj.owner_id):
            self.repo.create_user(User(id=proj.owner_id, name=proj.owner_id, email=f"{proj.owner_id}@enterprise.internal", role=UserRole.PROJECT_LEAD))
        created = self.repo.create_project(proj)
        self.vector_store.add_document(
            item_id=f"proj_{proj.id}",
            entity_type="PROJECT",
            entity_id=proj.id,
            text=f"Project {proj.name}: {proj.description}",
            metadata={"project_id": proj.id, "owner_id": proj.owner_id}
        )
        return created

    def delete_project(self, proj_id: str, user_id: str = "u_admin") -> bool:
        """Deletes a project."""
        return self.repo.delete_project(proj_id)

    def create_proceeding(
        self,
        proceeding_id: str,
        docket_id: str,
        title: str,
        jurisdiction: str = "FERC",
        version_label: str = "Initial Docket Text",
        raw_text: str = "",
        status: ProceedingStatus = ProceedingStatus.PROPOSED,
        user_id: str = "u_admin"
    ) -> Tuple[Proceeding, ProceedingVersion]:
        """Creates a new regulatory proceeding and ingests its initial version with full coordinate segmentation."""
        proc = self.repo.create_proceeding(Proceeding(
            id=proceeding_id, docket_id=docket_id, title=title, jurisdiction=jurisdiction
        ))
        
        sections = DocumentSegmenter.segment(raw_text) if raw_text else []
        version_id = f"{proceeding_id}_{version_label.lower().replace(' ', '_').replace('-', '_')}"
        version = ProceedingVersion(
            id=version_id,
            proceeding_id=proceeding_id,
            version_label=version_label,
            status=status,
            filed_date="2026-09-03",
            raw_text=raw_text,
            sections=sections
        )
        self.repo.create_proceeding_version(version)

        for sec in sections:
            for p in sec.paragraphs:
                self.vector_store.add_document(
                    item_id=f"{proceeding_id}_{sec.section_id}_{p.para_id}",
                    entity_type="PROCEEDING_PARA",
                    entity_id=proceeding_id,
                    text=f"{sec.heading}: {p.text}",
                    metadata={"version_id": version.id, "section_id": sec.section_id, "para_id": p.para_id}
                )

        return proc, version

    def delete_proceeding(self, proc_id: str, user_id: str = "u_admin") -> bool:
        """Deletes a regulatory proceeding."""
        return self.repo.delete_proceeding(proc_id)

    def _company_context(self) -> Tuple[List[Obligation], List[Project], List[InternalDocument], Dict[str, str]]:
        """Loads all enterprise assets and an owner lookup (entity_id -> owner user_id)."""
        all_obls = self.repo.list_obligations()
        all_projs = [p for p in (self.repo.get_project(r["id"]) for r in self.db.get_connection().execute("SELECT id FROM projects").fetchall()) if p]
        all_docs = [d for d in (self.repo.get_document(r["id"]) for r in self.db.get_connection().execute("SELECT id FROM documents").fetchall()) if d]
        owner_lookup: Dict[str, str] = {}
        owner_lookup.update({o.id: o.owner_id for o in all_obls})
        owner_lookup.update({p.id: p.owner_id for p in all_projs})
        owner_lookup.update({d.id: d.owner_id for d in all_docs})
        return all_obls, all_projs, all_docs, owner_lookup

    def _map_and_route_changes(
        self,
        change_records: List[ChangeRecord],
        proceeding_status: ProceedingStatus,
    ) -> Tuple[List[ImpactMapping], List[ActionRecommendation], List[Dict[str, Any]]]:
        """Shared post-classification stage: impact mapping, expert-review persistence, action routing.

        Confidence gating:
          - LOW-confidence mappings are structurally blocked from creating actions and are
            persisted to the Expert Review Queue (survives across sessions).
          - All other mappings generate PENDING actions routed to the deterministic owner for
            compliance review (state PENDING until a compliance analyst approves).
        """
        all_obls, all_projs, all_docs, owner_lookup = self._company_context()

        impact_mappings: List[ImpactMapping] = []
        action_recommendations: List[ActionRecommendation] = []
        escalated_items: List[Dict[str, Any]] = []

        for cr in change_records:
            if cr.materiality != "MATERIAL":
                continue

            mappings = self.impact_mapper.map_change_impact(cr, all_obls, all_projs, all_docs)

            # If change itself has LOW confidence and no mappings were produced, escalate directly
            if cr.confidence == ConfidenceTier.LOW and not mappings:
                escalated_items.append({
                    "change": cr.dict(),
                    "mapping": None,
                    "signals": cr.confidence_signals
                })

            for m in mappings:
                self.repo.create_impact_mapping(m)
                impact_mappings.append(m)

                # Confidence Gating: LOW -> Expert Review Queue, else -> compliance review inbox
                if ConfidenceRubric.should_escalate_to_expert_review(m.confidence):
                    escalated_items.append({
                        "change": cr.dict(),
                        "mapping": m.dict(),
                        "signals": m.confidence_signals
                    })
                else:
                    action = ActionRouter.generate_and_route(m, proceeding_status, cr.change_type.value, owner_lookup)
                    if action:
                        self.repo.create_action(action)
                        action_recommendations.append(action)

        # Persist escalations so the Expert Review Queue survives across sessions & reloads
        for item in escalated_items:
            target_id = item["mapping"]["id"] if item["mapping"] else item["change"]["id"]
            self.repo.create_expert_review(
                review_id=target_id,
                change_id=item["change"]["id"],
                mapping_id=item["mapping"]["id"] if item["mapping"] else None,
                change_description=item["change"]["description"],
                signals=item["signals"],
            )

        return impact_mappings, action_recommendations, escalated_items

    def analyze_new_regulation(self, proceeding_id: str, version_id: str) -> Dict[str, Any]:
        """Performs baseline analysis for a brand new regulation where all sections are new additions."""
        curr_ver = self.repo.get_proceeding_version(version_id)
        if not curr_ver:
            raise ValueError(f"Proceeding version not found: {version_id}")

        curr_paras = DiffEngine._flatten_paragraphs(curr_ver)
        diff_pairs = [{"diff_type": "ADDED", "prev_para": None, "curr_para": p} for p in curr_paras]

        change_records: List[ChangeRecord] = []
        for pair in diff_pairs:
            rec = ChangeClassifier.classify_diff_pair(pair, proceeding_id, curr_ver, curr_ver, llm_client=self.llm_client)
            if rec.after_citation and rec.after_citation.quoted_text:
                is_valid, reason = CitationValidator.validate_citation(rec.after_citation, curr_ver)
                if not is_valid:
                    rec.confidence = ConfidenceTier.LOW
                    rec.confidence_signals.append(f"SIG_CITE_FAIL: {reason}")

            self.repo.create_change_record(rec)
            change_records.append(rec)

        impact_mappings, action_recommendations, escalated_items = self._map_and_route_changes(change_records, curr_ver.status)

        return {
            "proceeding_id": proceeding_id,
            "from_version": None,
            "to_version": version_id,
            "total_changes": len(change_records),
            "material_changes": len([c for c in change_records if c.materiality == "MATERIAL"]),
            "impact_mappings": len(impact_mappings),
            "actions_created": len(action_recommendations),
            "escalated_to_expert_review": len(escalated_items),
            "change_records": [c.dict() for c in change_records],
            "actions": [a.dict() for a in action_recommendations],
            "escalated_items": escalated_items
        }

    # --- Change Detection & Processing Pipeline ---
    def analyze_versions(self, proceeding_id: str, prev_version_id: str, curr_version_id: str) -> Dict[str, Any]:
        if not prev_version_id or prev_version_id == "none" or prev_version_id == curr_version_id:
            return self.analyze_new_regulation(proceeding_id, curr_version_id)
        prev_ver = self.repo.get_proceeding_version(prev_version_id)
        curr_ver = self.repo.get_proceeding_version(curr_version_id)
        if not prev_ver or not curr_ver:
            raise ValueError(f"Versions not found: {prev_version_id}, {curr_version_id}")

        # 1. Structural Diff
        diff_pairs = DiffEngine.align_and_diff(prev_ver, curr_ver)
        change_records: List[ChangeRecord] = []

        # 2. Status Transition Check
        if prev_ver.status != curr_ver.status:
            status_rec = ChangeClassifier.create_status_transition_record(proceeding_id, prev_ver, curr_ver)
            self.repo.create_change_record(status_rec)
            change_records.append(status_rec)

        # 3. Classify Diff Pairs & Validate Citations
        for pair in diff_pairs:
            rec = ChangeClassifier.classify_diff_pair(pair, proceeding_id, prev_ver, curr_ver, llm_client=self.llm_client)
            
            # Programmatic Citation Validation
            if rec.after_citation:
                valid, reason = CitationValidator.validate_citation(rec.after_citation, curr_ver)
                if not valid:
                    rec.confidence = ConfidenceTier.LOW
                    rec.confidence_signals.append(f"SIG_CITE_FAIL: {reason}")
            if rec.before_citation:
                valid, reason = CitationValidator.validate_citation(rec.before_citation, prev_ver)
                if not valid:
                    rec.confidence = ConfidenceTier.LOW
                    rec.confidence_signals.append(f"SIG_CITE_FAIL: {reason}")

            self.repo.create_change_record(rec)
            change_records.append(rec)

        # 4. Impact Mapping, Expert Review Gating & Action Routing (shared stage)
        impact_mappings, action_recommendations, escalated_items = self._map_and_route_changes(change_records, curr_ver.status)

        return {
            "proceeding_id": proceeding_id,
            "total_changes": len(change_records),
            "material_changes": sum(1 for c in change_records if c.materiality == "MATERIAL"),
            "impact_mappings": len(impact_mappings),
            "actions_created": len(action_recommendations),
            "escalated_to_expert_review": len(escalated_items),
            "change_records": [c.dict() for c in change_records],
            "actions": [a.dict() for a in action_recommendations],
            "escalated_items": escalated_items
        }

    # --- Expert Review & Human Review Lifecycle ---
    def list_expert_reviews(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns persisted expert review queue items (open and/or resolved determinations)."""
        return self.repo.list_expert_reviews(status=status)

    def resolve_expert_review(self, target_id: str, reviewer_id: str, decision: str, rationale: str) -> Dict[str, Any]:
        """Resolves a persisted expert review item and records the human determination.

        - DISMISS_NON_APPLICABLE: the item is closed with no operational action created.
        - Any confirming decision (e.g. CONFIRMED_APPLICABLE, APPLY_WITH_MONITORING): the item's
          impact mapping is released to the normal review flow as a PENDING compliance action.
        """
        review = self.repo.get_expert_review(target_id)
        if not review:
            raise ValueError(f"Expert review item not found: {target_id}")

        resolved = self.repo.resolve_expert_review(target_id, decision, reviewer_id, rationale)

        created_action_id = None
        mapping_id = review.get("mapping_id")
        if decision != "DISMISS_NON_APPLICABLE" and mapping_id:
            target_map = next((m for m in self.repo.list_impact_mappings() if m.id == mapping_id), None)
            if target_map and not self._action_exists_for_mapping(mapping_id):
                # Human confirmation restores actionable confidence (post-resolution MEDIUM)
                target_map.confidence = ConfidenceTier.MEDIUM
                target_map.confidence_signals.append("SIG_EXPERT_CONFIRMED")
                _, _, _, owner_lookup = self._company_context()
                change = self.repo.list_change_records()
                cr = next((c for c in change if c.id == review.get("change_id")), None)
                version = self.repo.get_proceeding_version(cr.to_version_id) if cr else None
                status = version.status if version else ProceedingStatus.FINAL
                action = ActionRouter.generate_and_route(
                    target_map, status, cr.change_type.value if cr else "OTHER", owner_lookup
                )
                if action:
                    self.repo.create_action(action)
                    created_action_id = action.id

        return {
            "status": "resolved",
            "target_id": target_id,
            "reviewer_id": reviewer_id,
            "decision": decision,
            "rationale": rationale,
            "created_action_id": created_action_id,
            "review": resolved,
        }

    def _action_exists_for_mapping(self, mapping_id: str) -> bool:
        return any(a.mapping_id == mapping_id for a in self.repo.list_actions())

    def record_human_override(self, action_id: str, user_id: str, updated_action_text: str, override_rationale: str) -> ActionRecommendation:
        """Records an explicit human modification of a directive with mandatory rationale.

        The revised directive always returns to PENDING so the compliance analyst re-reviews it:
          - A compliance analyst may modify a directive under review (stays PENDING).
          - A project lead may modify an APPROVED/IN_PROGRESS directive (returns to PENDING,
            re-entering compliance review).
        Original directive text, actor, and rationale are persisted on the record for audit.
        """
        action = self.repo.get_action(action_id)
        if not action:
            raise ValueError(f"Action not found: {action_id}")
        if action.state in (ActionState.DONE, ActionState.REJECTED):
            raise TransitionError(
                f"Action '{action_id}' is {action.state.value} (terminal) and can no longer be modified."
            )

        updated = self.repo.update_action_override(
            action_id, updated_action_text, ActionState.PENDING.value,
            updated_by=user_id, rationale=override_rationale
        )
        return updated or action

    def transition_action_state(self, action_id: str, user_id: str, new_state: ActionState, notes: str = "") -> ActionRecommendation:
        """Persona-owned action lifecycle transition.

        Two-stage review lifecycle (each transition is performed by exactly one persona):
          Stage 1 - Compliance review:  PENDING -> APPROVED (accept & adopt obligation) | REJECTED
          Stage 2 - Project execution:  APPROVED -> IN_PROGRESS (lead accepts) | DONE (lead marks done)
                                        IN_PROGRESS -> DONE (lead marks done)

        When a compliance analyst approves (APPROVED), a formal enterprise Obligation is
        automatically adopted from the directive and indexed into vector search.
        """
        action = self.repo.get_action(action_id)
        if not action:
            raise ValueError(f"Action not found: {action_id}")

        old_state = action.state
        allowed = ActionState.allowed_transitions()
        rule = allowed.get((old_state, new_state))
        if rule is None:
            legal = " | ".join(
                f"{frm.value} -> {to.value} ({role})"
                for (frm, to), role in allowed.items() if frm == old_state
            )
            raise TransitionError(
                f"Invalid action transition: {old_state.value} -> {new_state.value}. "
                f"Allowed from {old_state.value}: {legal or 'none (terminal state)'}"
            )

        # Enforce persona ownership of the transition
        user = self.repo.get_user(user_id)
        user_role = user.role.value if user and hasattr(user.role, "value") else (user.role if user else None)
        if user_role != rule and user_role != "ADMIN":
            raise TransitionError(
                f"Transition {old_state.value} -> {new_state.value} must be performed by a {rule} "
                f"(user '{user_id}' has role {user_role or 'UNKNOWN'})."
            )

        updated = self.repo.update_action_state(
            action_id, new_state.value if hasattr(new_state, "value") else str(new_state),
            updated_by=user_id, note=notes or None
        )
        action = updated or action

        # When compliance approves, formally adopt the directive as an Enterprise Obligation
        if new_state == ActionState.APPROVED:
            clean_suffix = action_id.replace("act_", "").upper()
            obl_id = f"OBL-ADOPTED-{clean_suffix}"

            # Check if obligation already exists
            existing_obl = self.repo.get_obligation(obl_id)
            if not existing_obl:
                target_map = next((m for m in self.repo.list_impact_mappings() if m.id == action.mapping_id), None)
                source_cite = target_map.change_citation.dict() if (target_map and target_map.change_citation) else None
                new_obl = Obligation(
                    id=obl_id,
                    description=action.recommended_action,
                    owner_id=action.suggested_owner_id or user_id,
                    status=ObligationStatus.ACTIVE,
                    source_citation=source_cite
                )
                self.repo.create_obligation(new_obl)

                # Index adopted obligation in vector store
                self.vector_store.add_document(
                    item_id=f"obl_{obl_id}",
                    entity_type="OBLIGATION",
                    entity_id=obl_id,
                    text=f"Compliance Obligation: {action.recommended_action}",
                    metadata={"obligation_id": obl_id, "owner_id": new_obl.owner_id, "source_action": action_id}
                )

                # If affected entity is a project, link newly adopted obligation
                if target_map and target_map.affected_type == "PROJECT":
                    with self.repo.db.get_connection() as conn:
                        conn.execute(
                            "INSERT OR IGNORE INTO project_obligations (project_id, obligation_id) VALUES (?, ?)",
                            (target_map.affected_id, obl_id)
                        )
                        conn.commit()

        return self.repo.get_action(action_id) or action
