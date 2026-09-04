import os
from typing import List, Dict, Any, Optional, Tuple
from strata.storage.database import Database
from strata.storage.repositories import StrataRepository
from strata.storage.event_store import EventStore
from strata.models.entities import (
    User, Proceeding, ProceedingVersion, InternalDocument, Obligation, Project, ProceedingStatus, UserRole
)
from strata.models.analysis import (
    ChangeRecord, ImpactMapping, ActionRecommendation, ConfidenceTier, ActionState, Citation
)
from strata.models.events import AuditEvent, AuditEventType, ActorType
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

class StrataService:
    """Core orchestrator for Strata Regulatory Intelligence & Living Operations.
    
    Coordinates the 6-stage lifecycle:
      1. Ingestion: Canonical paragraph segmentation, status detection, and immutable snapshot storage.
      2. Deterministic Diffing: Sequence alignment detecting paragraph modifications, additions, and deletions.
      3. Classification & Citation Gating: Verbatim quote validation with optional live LLM enrichment.
      4. Impact Mapping: Semantic dense retrieval mapping regulatory shifts to enterprise assets.
      5. Action Routing: Deterministic urgency calculation gated by proceeding status (FINAL -> ACT_NOW).
      6. Living Audit Trail: Append-only event store for defensible timeline reconstruction.
    """
    def __init__(self, db_path: str = "strata.db", llm_client: Optional[Any] = None):
        self.db = Database(db_path)
        self.repo = StrataRepository(self.db)
        self.event_store = EventStore(self.db)
        self.vector_store = VectorStore()
        self.impact_mapper = ImpactMapper(self.vector_store)
        self.llm_client = llm_client

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

        # Append audit event
        self.event_store.append_event(AuditEvent(
            stream_id=f"proceeding:{proceeding_id}",
            event_type=AuditEventType.PROCEEDING_VERSION_INGESTED,
            actor_type=ActorType.SYSTEM,
            actor_id="pipeline:ingestion",
            payload={
                "proceeding_id": proceeding_id,
                "version_id": version.id,
                "version_label": version_label,
                "status": version.status.value,
                "summary": f"Proceeding version '{version_label}' ({version.status.value}) ingested."
            }
        ))
        return version

    def ingest_document(self, doc_id: str, title: str, doc_type: str, owner_id: str, raw_text: str) -> InternalDocument:
        sections = DocumentSegmenter.segment(raw_text)
        doc = InternalDocument(
            id=doc_id, title=title, doc_type=doc_type, owner_id=owner_id, raw_text=raw_text, sections=sections
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

        self.event_store.append_event(AuditEvent(
            stream_id=f"document:{doc_id}",
            event_type=AuditEventType.DOCUMENT_INGESTED,
            actor_type=ActorType.SYSTEM,
            actor_id="pipeline:ingestion",
            payload={"document_id": doc_id, "title": title, "owner_id": owner_id, "summary": f"Governing document '{title}' ingested."}
        ))
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

    def ingest_project(self, proj_id: str, name: str, description: str, owner_id: str, linked_obligations: List[str] = None) -> Project:
        proj = Project(id=proj_id, name=name, description=description, owner_id=owner_id, linked_obligations=linked_obligations or [])
        return self.create_project(proj, creator_id="pipeline:seed")

    def create_project(self, proj: Project, creator_id: str = "u_admin") -> Project:
        """Creates a new project, indexes it into vector search, and records an audit event."""
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
        self.event_store.append_event(AuditEvent(
            stream_id=f"project:{proj.id}",
            event_type=AuditEventType.PROJECT_CREATED,
            actor_type=ActorType.USER,
            actor_id=creator_id,
            payload={
                "project_id": proj.id,
                "name": proj.name,
                "owner_id": proj.owner_id,
                "status": proj.status,
                "summary": f"Project '{proj.name}' ({proj.id}) created and assigned to {proj.owner_id}."
            }
        ))
        return created

    def delete_project(self, proj_id: str, user_id: str = "u_admin") -> bool:
        """Deletes a project and logs an immutable audit event."""
        proj = self.repo.get_project(proj_id)
        name = proj.name if proj else proj_id
        success = self.repo.delete_project(proj_id)
        if success:
            self.event_store.append_event(AuditEvent(
                stream_id=f"project:{proj_id}",
                event_type=AuditEventType.PROJECT_DELETED,
                actor_type=ActorType.USER,
                actor_id=user_id,
                payload={
                    "project_id": proj_id,
                    "name": name,
                    "summary": f"Project '{name}' ({proj_id}) deleted by {user_id}."
                }
            ))
        return success

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

        self.event_store.append_event(AuditEvent(
            stream_id=f"proceeding:{proceeding_id}",
            event_type=AuditEventType.PROCEEDING_CREATED,
            actor_type=ActorType.USER,
            actor_id=user_id,
            payload={
                "proceeding_id": proceeding_id,
                "docket_id": docket_id,
                "title": title,
                "jurisdiction": jurisdiction,
                "summary": f"Regulatory docket '{title}' ({docket_id}) created by {user_id}."
            }
        ))
        return proc, version

    def delete_proceeding(self, proc_id: str, user_id: str = "u_admin") -> bool:
        """Deletes a regulatory proceeding and records an audit event."""
        proc = self.repo.get_proceeding(proc_id)
        title = proc.title if proc else proc_id
        success = self.repo.delete_proceeding(proc_id)
        if success:
            self.event_store.append_event(AuditEvent(
                stream_id=f"proceeding:{proc_id}",
                event_type=AuditEventType.PROCEEDING_DELETED,
                actor_type=ActorType.USER,
                actor_id=user_id,
                payload={
                    "proceeding_id": proc_id,
                    "title": title,
                    "summary": f"Regulatory proceeding '{title}' ({proc_id}) deleted by {user_id}."
                }
            ))
        return success

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
            self.event_store.append_event(AuditEvent(
                stream_id=f"proceeding:{proceeding_id}",
                event_type=AuditEventType.CHANGE_DETECTED,
                actor_type=ActorType.SYSTEM,
                actor_id="pipeline:baseline_analyzer",
                payload={"change_id": rec.id, "type": rec.change_type.value, "materiality": rec.materiality.value, "summary": rec.description, "confidence": rec.confidence.value}
            ))

        all_obls = self.repo.list_obligations()
        all_projs = [self.repo.get_project(r["id"]) for r in self.db.get_connection().execute("SELECT id FROM projects").fetchall()]
        all_docs = [self.repo.get_document(r["id"]) for r in self.db.get_connection().execute("SELECT id FROM documents").fetchall()]

        owner_lookup = {o.id: o.owner_id for o in all_obls}
        owner_lookup.update({p.id: p.owner_id for p in all_projs})
        owner_lookup.update({d.id: d.owner_id for d in all_docs})

        impact_mappings: List[ImpactMapping] = []
        action_recommendations: List[ActionRecommendation] = []
        escalated_items: List[Dict[str, Any]] = []

        for cr in change_records:
            if cr.materiality != "MATERIAL":
                continue

            mappings = self.impact_mapper.map_change_impact(cr, all_obls, all_projs, all_docs)
            for m in mappings:
                self.repo.create_impact_mapping(m)
                impact_mappings.append(m)

                stream_id = f"obligation:{m.affected_id}" if m.affected_type == "OBLIGATION" else f"project:{m.affected_id}"
                self.event_store.append_event(AuditEvent(
                    stream_id=stream_id,
                    event_type=AuditEventType.IMPACT_MAPPED,
                    actor_type=ActorType.SYSTEM,
                    actor_id="pipeline:impact_mapper",
                    payload={"mapping_id": m.id, "change_id": cr.id, "affected_id": m.affected_id, "rationale": m.rationale, "summary": f"Impact mapped to {m.affected_id}."}
                ))

                if ConfidenceRubric.should_escalate_to_expert_review(m.confidence):
                    escalated_items.append({"change": cr.dict(), "mapping": m.dict(), "signals": m.confidence_signals})
                    self.event_store.append_event(AuditEvent(
                        stream_id=stream_id,
                        event_type=AuditEventType.ACTION_ESCALATED_TO_EXPERT,
                        actor_type=ActorType.SYSTEM,
                        actor_id="pipeline:confidence_rubric",
                        payload={"mapping_id": m.id, "signals": m.confidence_signals, "summary": f"Escalated to Expert Review: {'; '.join(m.confidence_signals)}"}
                    ))
                else:
                    action = ActionRouter.generate_and_route(m, curr_ver.status, cr.change_type.value, owner_lookup)
                    self.repo.create_action(action)
                    action_recommendations.append(action)
                    self.event_store.append_event(AuditEvent(
                        stream_id=stream_id,
                        event_type=AuditEventType.ACTION_RECOMMENDED,
                        actor_type=ActorType.SYSTEM,
                        actor_id="pipeline:action_router",
                        payload={"action_id": action.id, "mapping_id": m.id, "owner_id": action.suggested_owner_id, "urgency": action.urgency.value, "summary": action.recommended_action}
                    ))

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
            self.event_store.append_event(AuditEvent(
                stream_id=f"proceeding:{proceeding_id}",
                event_type=AuditEventType.STATUS_TRANSITION_DETECTED,
                actor_type=ActorType.SYSTEM,
                actor_id="pipeline:status_engine",
                payload={"proceeding_id": proceeding_id, "from_status": prev_ver.status.value, "to_status": curr_ver.status.value, "summary": status_rec.description}
            ))

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
            self.event_store.append_event(AuditEvent(
                stream_id=f"proceeding:{proceeding_id}",
                event_type=AuditEventType.CHANGE_DETECTED,
                actor_type=ActorType.SYSTEM,
                actor_id="pipeline:diff_engine",
                payload={"change_id": rec.id, "type": rec.change_type.value, "materiality": rec.materiality.value, "summary": rec.description, "confidence": rec.confidence.value}
            ))

        # 4. Impact Mapping & Action Routing
        all_obls = self.repo.list_obligations()
        all_projs = [self.repo.get_project(r["id"]) for r in self.db.get_connection().execute("SELECT id FROM projects").fetchall()]
        all_docs = [self.repo.get_document(r["id"]) for r in self.db.get_connection().execute("SELECT id FROM documents").fetchall()]
        
        owner_lookup = {}
        for o in all_obls:
            owner_lookup[o.id] = o.owner_id
        for p in all_projs:
            owner_lookup[p.id] = p.owner_id
        for d in all_docs:
            owner_lookup[d.id] = d.owner_id

        impact_mappings: List[ImpactMapping] = []
        action_recommendations: List[ActionRecommendation] = []
        escalated_items: List[Dict[str, Any]] = []

        for cr in change_records:
            if cr.materiality != "MATERIAL":
                continue

            mappings = self.impact_mapper.map_change_impact(cr, all_obls, all_projs, all_docs)

            # If change itself has LOW confidence and no mappings were produced, escalate directly
            if cr.confidence == ConfidenceTier.LOW and not mappings:
                stream_id = f"proceeding:{proceeding_id}"
                escalated_items.append({
                    "change": cr.dict(),
                    "mapping": None,
                    "signals": cr.confidence_signals
                })
                self.event_store.append_event(AuditEvent(
                    stream_id=stream_id,
                    event_type=AuditEventType.ACTION_ESCALATED_TO_EXPERT,
                    actor_type=ActorType.SYSTEM,
                    actor_id="pipeline:confidence_rubric",
                    payload={"change_id": cr.id, "signals": cr.confidence_signals, "summary": f"Change escalated to Expert Review: {'; '.join(cr.confidence_signals)}"}
                ))

            for m in mappings:
                self.repo.create_impact_mapping(m)
                impact_mappings.append(m)

                stream_id = f"obligation:{m.affected_id}" if m.affected_type == "OBLIGATION" else f"project:{m.affected_id}"
                self.event_store.append_event(AuditEvent(
                    stream_id=stream_id,
                    event_type=AuditEventType.IMPACT_MAPPED,
                    actor_type=ActorType.SYSTEM,
                    actor_id="pipeline:impact_mapper",
                    payload={"mapping_id": m.id, "change_id": cr.id, "affected_id": m.affected_id, "rationale": m.rationale, "summary": f"Impact mapped to {m.affected_id}."}
                ))

                # Confidence Gating
                if ConfidenceRubric.should_escalate_to_expert_review(m.confidence):
                    escalated_items.append({
                        "change": cr.dict(),
                        "mapping": m.dict(),
                        "signals": m.confidence_signals
                    })
                    self.event_store.append_event(AuditEvent(
                        stream_id=stream_id,
                        event_type=AuditEventType.ACTION_ESCALATED_TO_EXPERT,
                        actor_type=ActorType.SYSTEM,
                        actor_id="pipeline:confidence_rubric",
                        payload={"mapping_id": m.id, "signals": m.confidence_signals, "summary": f"Escalated to Expert Review: {'; '.join(m.confidence_signals)}"}
                    ))
                else:
                    action = ActionRouter.generate_and_route(m, curr_ver.status, cr.change_type.value, owner_lookup)
                    if action:
                        self.repo.create_action(action)
                        action_recommendations.append(action)
                        self.event_store.append_event(AuditEvent(
                            stream_id=stream_id,
                            event_type=AuditEventType.ACTION_RECOMMENDED,
                            actor_type=ActorType.SYSTEM,
                            actor_id="pipeline:action_router",
                            payload={"action_id": action.id, "suggested_owner": action.suggested_owner_id, "urgency": action.urgency.value, "summary": action.recommended_action}
                        ))

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

    # --- Expert Review & Human Override ---
    def resolve_expert_review(self, target_id: str, reviewer_id: str, decision: str, rationale: str) -> AuditEvent:
        """Resolves an escalated item and logs a defensible AuditEvent preserving system claim alongside human decision."""
        mappings = self.repo.list_impact_mappings()
        target_map = next((m for m in mappings if m.id == target_id), None)
        if target_map:
            stream_id = f"obligation:{target_map.affected_id}" if target_map.affected_type == "OBLIGATION" else f"project:{target_map.affected_id}"
        else:
            stream_id = f"expert_review:{target_id}"

        event = self.event_store.append_event(AuditEvent(
            stream_id=stream_id,
            event_type=AuditEventType.EXPERT_REVIEW_RESOLVED,
            actor_type=ActorType.USER,
            actor_id=reviewer_id,
            payload={
                "target_id": target_id,
                "decision": decision,
                "reviewer_rationale": rationale,
                "summary": f"Expert review resolved by {reviewer_id}: {decision}. Rationale: {rationale}"
            }
        ))
        return event

    def record_human_override(self, action_id: str, user_id: str, updated_action_text: str, override_rationale: str) -> ActionRecommendation:
        """Records an explicit human override without erasing the original recommendation."""
        action = self.repo.get_action(action_id)
        if not action:
            raise ValueError(f"Action not found: {action_id}")

        original_text = action.recommended_action
        action.recommended_action = updated_action_text
        action.state = ActionState.MODIFIED
        self.repo.update_action_state(action_id, ActionState.MODIFIED.value)

        # Append override event to action stream
        self.event_store.append_event(AuditEvent(
            stream_id=f"action:{action_id}",
            event_type=AuditEventType.HUMAN_OVERRIDE_RECORDED,
            actor_type=ActorType.USER,
            actor_id=user_id,
            payload={
                "action_id": action_id,
                "original_action": original_text,
                "modified_action": updated_action_text,
                "override_rationale": override_rationale,
                "summary": f"Action modified by {user_id}. Rationale: {override_rationale}"
            }
        ))

        # Also append to affected entity stream (obligation/project/document)
        mappings = self.repo.list_impact_mappings()
        target_map = next((m for m in mappings if m.id == action.mapping_id), None)
        if target_map:
            prefix = target_map.affected_type.lower()
            self.event_store.append_event(AuditEvent(
                stream_id=f"{prefix}:{target_map.affected_id}",
                event_type=AuditEventType.HUMAN_OVERRIDE_RECORDED,
                actor_type=ActorType.USER,
                actor_id=user_id,
                payload={
                    "action_id": action_id,
                    "original_action": original_text,
                    "modified_action": updated_action_text,
                    "override_rationale": override_rationale,
                    "summary": f"Action modified by {user_id}. Rationale: {override_rationale}"
                }
            ))
        return action

    def transition_action_state(self, action_id: str, user_id: str, new_state: ActionState, notes: str = "") -> ActionRecommendation:
        """Transitions an action to ACCEPTED, DONE, etc. and appends an immutable audit event."""
        action = self.repo.get_action(action_id)
        if not action:
            raise ValueError(f"Action not found: {action_id}")

        old_state = action.state
        action.state = new_state
        self.repo.update_action_state(action_id, new_state.value if hasattr(new_state, "value") else str(new_state))

        state_val = new_state.value if hasattr(new_state, "value") else str(new_state)
        old_val = old_state.value if hasattr(old_state, "value") else str(old_state)

        # Append state transition to action stream
        self.event_store.append_event(AuditEvent(
            stream_id=f"action:{action_id}",
            event_type=AuditEventType.ACTION_STATE_CHANGED,
            actor_type=ActorType.USER,
            actor_id=user_id,
            payload={
                "action_id": action_id,
                "from_state": old_val,
                "to_state": state_val,
                "notes": notes,
                "summary": f"Action state transitioned from {old_val} to {state_val} by {user_id}. Notes: {notes}"
            }
        ))

        # Also append to affected entity stream
        mappings = self.repo.list_impact_mappings()
        target_map = next((m for m in mappings if m.id == action.mapping_id), None)
        if target_map:
            prefix = target_map.affected_type.lower()
            self.event_store.append_event(AuditEvent(
                stream_id=f"{prefix}:{target_map.affected_id}",
                event_type=AuditEventType.ACTION_STATE_CHANGED,
                actor_type=ActorType.USER,
                actor_id=user_id,
                payload={
                    "action_id": action_id,
                    "from_state": old_val,
                    "to_state": state_val,
                    "notes": notes,
                    "summary": f"Action state transitioned to {state_val} for {target_map.affected_id}."
                }
            ))
        return action
