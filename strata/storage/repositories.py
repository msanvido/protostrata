import json
import sqlite3
from typing import List, Optional, Dict, Any
from strata.storage.database import Database
from strata.models.entities import (
    User, Proceeding, ProceedingVersion, InternalDocument, Obligation, Project, Section, Paragraph, Sentence
)
from strata.models.analysis import ChangeRecord, ImpactMapping, ActionRecommendation, Citation

class StrataRepository:
    def __init__(self, db: Database):
        self.db = db

    # --- Users ---
    def create_user(self, user: User) -> User:
        with self.db.get_connection() as conn:
            conn.execute(
                "INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)",
                (user.id, user.name, user.email, user.role.value if hasattr(user.role, 'value') else user.role)
            )
            conn.commit()
        return user

    def get_user(self, user_id: str) -> Optional[User]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
            if not row:
                return None
            return User(id=row["id"], name=row["name"], email=row["email"], role=row["role"], created_at=row["created_at"])

    # --- Proceedings & Versions ---
    def create_proceeding(self, proc: Proceeding) -> Proceeding:
        with self.db.get_connection() as conn:
            conn.execute(
                "INSERT INTO proceedings (id, docket_id, title, jurisdiction) VALUES (?, ?, ?, ?)",
                (proc.id, proc.docket_id, proc.title, proc.jurisdiction)
            )
            conn.commit()
        return proc

    def get_proceeding(self, proc_id: str) -> Optional[Proceeding]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM proceedings WHERE id = ?", (proc_id,)).fetchone()
            if not row:
                return None
            return Proceeding(id=row["id"], docket_id=row["docket_id"], title=row["title"], jurisdiction=row["jurisdiction"], created_at=row["created_at"])

    def create_proceeding_version(self, ver: ProceedingVersion) -> ProceedingVersion:
        with self.db.get_connection() as conn:
            sections_json = json.dumps([s.dict() if hasattr(s, 'dict') else s for s in ver.sections])
            conn.execute(
                """INSERT INTO proceeding_versions 
                   (id, proceeding_id, version_label, status, filed_date, effective_date, comment_due_date, raw_text, parsed_sections_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (ver.id, ver.proceeding_id, ver.version_label, 
                 ver.status.value if hasattr(ver.status, 'value') else ver.status,
                 ver.filed_date, ver.effective_date, ver.comment_due_date, ver.raw_text, sections_json)
            )
            conn.commit()
        return ver

    def get_proceeding_version(self, ver_id: str) -> Optional[ProceedingVersion]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM proceeding_versions WHERE id = ?", (ver_id,)).fetchone()
            if not row:
                return None
            sections_data = json.loads(row["parsed_sections_json"])
            sections = [Section.parse_obj(s) for s in sections_data]
            return ProceedingVersion(
                id=row["id"], proceeding_id=row["proceeding_id"], version_label=row["version_label"],
                status=row["status"], filed_date=row["filed_date"], effective_date=row["effective_date"],
                comment_due_date=row["comment_due_date"], raw_text=row["raw_text"], sections=sections,
                created_at=row["created_at"]
            )

    def get_proceeding_versions(self, proceeding_id: str) -> List[ProceedingVersion]:
        with self.db.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM proceeding_versions WHERE proceeding_id = ? ORDER BY filed_date ASC",
                (proceeding_id,)
            ).fetchall()
            results = []
            for row in rows:
                sections_data = json.loads(row["parsed_sections_json"])
                sections = [Section.parse_obj(s) for s in sections_data]
                results.append(ProceedingVersion(
                    id=row["id"], proceeding_id=row["proceeding_id"], version_label=row["version_label"],
                    status=row["status"], filed_date=row["filed_date"], effective_date=row["effective_date"],
                    comment_due_date=row["comment_due_date"], raw_text=row["raw_text"], sections=sections,
                    created_at=row["created_at"]
                ))
            return results

    # --- Documents ---
    def create_document(self, doc: InternalDocument) -> InternalDocument:
        with self.db.get_connection() as conn:
            sections_json = json.dumps([s.dict() if hasattr(s, 'dict') else s for s in doc.sections])
            conn.execute(
                """INSERT INTO documents (id, title, doc_type, owner_id, current_version, raw_text, parsed_sections_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (doc.id, doc.title, doc.doc_type.value if hasattr(doc.doc_type, 'value') else doc.doc_type,
                 doc.owner_id, doc.current_version, doc.raw_text, sections_json)
            )
            conn.commit()
        return doc

    def get_document(self, doc_id: str) -> Optional[InternalDocument]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
            if not row:
                return None
            sections_data = json.loads(row["parsed_sections_json"])
            sections = [Section.parse_obj(s) for s in sections_data]
            return InternalDocument(
                id=row["id"], title=row["title"], doc_type=row["doc_type"], owner_id=row["owner_id"],
                current_version=row["current_version"], raw_text=row["raw_text"], sections=sections,
                created_at=row["created_at"]
            )

    # --- Obligations ---
    def create_obligation(self, obl: Obligation) -> Obligation:
        with self.db.get_connection() as conn:
            cite_json = json.dumps(obl.source_citation) if obl.source_citation else None
            conn.execute(
                """INSERT INTO obligations (id, description, owner_id, status, linked_doc_id, source_citation_json)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (obl.id, obl.description, obl.owner_id, 
                 obl.status.value if hasattr(obl.status, 'value') else obl.status,
                 obl.linked_doc_id, cite_json)
            )
            conn.commit()
        return obl

    def get_obligation(self, obl_id: str) -> Optional[Obligation]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM obligations WHERE id = ?", (obl_id,)).fetchone()
            if not row:
                return None
            cite = json.loads(row["source_citation_json"]) if row["source_citation_json"] else None
            return Obligation(
                id=row["id"], description=row["description"], owner_id=row["owner_id"],
                status=row["status"], linked_doc_id=row["linked_doc_id"], source_citation=cite,
                created_at=row["created_at"]
            )

    def list_obligations(self) -> List[Obligation]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM obligations").fetchall()
            results = []
            for row in rows:
                cite = json.loads(row["source_citation_json"]) if row["source_citation_json"] else None
                results.append(Obligation(
                    id=row["id"], description=row["description"], owner_id=row["owner_id"],
                    status=row["status"], linked_doc_id=row["linked_doc_id"], source_citation=cite,
                    created_at=row["created_at"]
                ))
            return results

    # --- Projects ---
    def create_project(self, proj: Project) -> Project:
        with self.db.get_connection() as conn:
            milestones_json = json.dumps([m.dict() if hasattr(m, 'dict') else m for m in proj.milestones])
            conn.execute(
                "INSERT INTO projects (id, name, description, owner_id, status, milestones_json) VALUES (?, ?, ?, ?, ?, ?)",
                (proj.id, proj.name, proj.description, proj.owner_id, proj.status, milestones_json)
            )
            for obl_id in proj.linked_obligations:
                conn.execute("INSERT OR IGNORE INTO project_obligations (project_id, obligation_id) VALUES (?, ?)", (proj.id, obl_id))
            conn.commit()
        return proj

    def get_project(self, proj_id: str) -> Optional[Project]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM projects WHERE id = ?", (proj_id,)).fetchone()
            if not row:
                return None
            obls = [r[0] for r in conn.execute("SELECT obligation_id FROM project_obligations WHERE project_id = ?", (proj_id,)).fetchall()]
            milestones_data = json.loads(row["milestones_json"]) if row["milestones_json"] else []
            return Project(
                id=row["id"], name=row["name"], description=row["description"], owner_id=row["owner_id"],
                status=row["status"], linked_obligations=obls, milestones=milestones_data, created_at=row["created_at"]
            )

    # --- ChangeRecords ---
    def create_change_record(self, cr: ChangeRecord) -> ChangeRecord:
        with self.db.get_connection() as conn:
            before_json = json.dumps(cr.before_citation.dict()) if cr.before_citation else None
            after_json = json.dumps(cr.after_citation.dict()) if cr.after_citation else None
            signals_json = json.dumps(cr.confidence_signals)
            conn.execute(
                """INSERT INTO change_records 
                   (id, proceeding_id, from_version_id, to_version_id, change_type, materiality, description,
                    before_citation_json, after_citation_json, confidence, confidence_signals_json, confidence_rationale)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (cr.id, cr.proceeding_id, cr.from_version_id, cr.to_version_id,
                 cr.change_type.value if hasattr(cr.change_type, 'value') else cr.change_type,
                 cr.materiality.value if hasattr(cr.materiality, 'value') else cr.materiality,
                 cr.description, before_json, after_json,
                 cr.confidence.value if hasattr(cr.confidence, 'value') else cr.confidence,
                 signals_json, cr.confidence_rationale)
            )
            conn.commit()
        return cr

    def list_change_records(self, proceeding_id: Optional[str] = None) -> List[ChangeRecord]:
        with self.db.get_connection() as conn:
            if proceeding_id:
                rows = conn.execute("SELECT * FROM change_records WHERE proceeding_id = ?", (proceeding_id,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM change_records").fetchall()
            results = []
            for r in rows:
                before = Citation.parse_obj(json.loads(r["before_citation_json"])) if r["before_citation_json"] else None
                after = Citation.parse_obj(json.loads(r["after_citation_json"])) if r["after_citation_json"] else None
                signals = json.loads(r["confidence_signals_json"]) if r["confidence_signals_json"] else []
                results.append(ChangeRecord(
                    id=r["id"], proceeding_id=r["proceeding_id"], from_version_id=r["from_version_id"],
                    to_version_id=r["to_version_id"], change_type=r["change_type"], materiality=r["materiality"],
                    description=r["description"], before_citation=before, after_citation=after,
                    confidence=r["confidence"], confidence_signals=signals, confidence_rationale=r["confidence_rationale"],
                    detected_at=r["detected_at"]
                ))
            return results

    # --- ImpactMappings ---
    def create_impact_mapping(self, im: ImpactMapping) -> ImpactMapping:
        with self.db.get_connection() as conn:
            change_cite = json.dumps(im.change_citation.dict())
            aff_cite = json.dumps(im.affected_citation.dict())
            signals_json = json.dumps(im.confidence_signals)
            conn.execute(
                """INSERT INTO impact_mappings
                   (id, change_id, affected_type, affected_id, rationale, change_citation_json, affected_citation_json, confidence, confidence_signals_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (im.id, im.change_id, im.affected_type, im.affected_id, im.rationale,
                 change_cite, aff_cite,
                 im.confidence.value if hasattr(im.confidence, 'value') else im.confidence,
                 signals_json)
            )
            conn.commit()
        return im

    def list_impact_mappings(self, change_id: Optional[str] = None) -> List[ImpactMapping]:
        with self.db.get_connection() as conn:
            if change_id:
                rows = conn.execute("SELECT * FROM impact_mappings WHERE change_id = ?", (change_id,)).fetchall()
            else:
                rows = conn.execute("SELECT * FROM impact_mappings").fetchall()
            results = []
            for r in rows:
                c_cite = Citation.parse_obj(json.loads(r["change_citation_json"]))
                a_cite = Citation.parse_obj(json.loads(r["affected_citation_json"]))
                signals = json.loads(r["confidence_signals_json"]) if r["confidence_signals_json"] else []
                results.append(ImpactMapping(
                    id=r["id"], change_id=r["change_id"], affected_type=r["affected_type"],
                    affected_id=r["affected_id"], rationale=r["rationale"], change_citation=c_cite,
                    affected_citation=a_cite, confidence=r["confidence"], confidence_signals=signals,
                    created_at=r["created_at"]
                ))
            return results

    # --- Actions ---
    def create_action(self, action: ActionRecommendation) -> ActionRecommendation:
        with self.db.get_connection() as conn:
            conn.execute(
                """INSERT INTO actions (id, mapping_id, recommended_action, suggested_owner_id, urgency, state)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (action.id, action.mapping_id, action.recommended_action, action.suggested_owner_id,
                 action.urgency.value if hasattr(action.urgency, 'value') else action.urgency,
                 action.state.value if hasattr(action.state, 'value') else action.state)
            )
            conn.commit()
        return action

    def update_action_state(self, action_id: str, new_state: str) -> Optional[ActionRecommendation]:
        with self.db.get_connection() as conn:
            conn.execute("UPDATE actions SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_state, action_id))
            conn.commit()
        return self.get_action(action_id)

    def get_action(self, action_id: str) -> Optional[ActionRecommendation]:
        with self.db.get_connection() as conn:
            row = conn.execute("SELECT * FROM actions WHERE id = ?", (action_id,)).fetchone()
            if not row:
                return None
            return ActionRecommendation(
                id=row["id"], mapping_id=row["mapping_id"], recommended_action=row["recommended_action"],
                suggested_owner_id=row["suggested_owner_id"], urgency=row["urgency"], state=row["state"],
                created_at=row["created_at"], updated_at=row["updated_at"]
            )

    def list_actions(self, owner_id: Optional[str] = None, state: Optional[str] = None) -> List[ActionRecommendation]:
        with self.db.get_connection() as conn:
            query = "SELECT * FROM actions WHERE 1=1"
            params = []
            if owner_id:
                query += " AND suggested_owner_id = ?"
                params.append(owner_id)
            if state:
                query += " AND state = ?"
                params.append(state)
            rows = conn.execute(query, params).fetchall()
            return [ActionRecommendation(
                id=r["id"], mapping_id=r["mapping_id"], recommended_action=r["recommended_action"],
                suggested_owner_id=r["suggested_owner_id"], urgency=r["urgency"], state=r["state"],
                created_at=r["created_at"], updated_at=r["updated_at"]
            ) for r in rows]
