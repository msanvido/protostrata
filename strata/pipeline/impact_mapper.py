import uuid
from typing import List, Dict, Any, Optional
from strata.models.analysis import ChangeRecord, ImpactMapping, Citation, ConfidenceTier
from strata.models.entities import Obligation, Project, InternalDocument
from strata.embeddings.vector_store import VectorStore
from strata.pipeline.validator import CitationValidator

class ImpactMapper:
    def __init__(self, vector_store: VectorStore):
        self.vector_store = vector_store

    def map_change_impact(
        self,
        change: ChangeRecord,
        obligations: List[Obligation],
        projects: List[Project],
        documents: List[InternalDocument]
    ) -> List[ImpactMapping]:
        """Maps a material change to candidate enterprise assets using embedding similarity + dual citation grounding."""
        if change.materiality != "MATERIAL":
            return []

        # Form query from description + after citation text
        query_text = change.description
        if change.after_citation:
            query_text += "\n" + change.after_citation.quoted_text

        # Retrieve top matches from vector store (excluding external proceeding text)
        candidates = self.vector_store.search(query_text, top_k=5, exclude_entity_type="PROCEEDING_PARA")
        mappings: List[ImpactMapping] = []

        ob_map = {o.id: o for o in obligations}
        proj_map = {p.id: p for p in projects}
        doc_map = {d.id: d for d in documents}

        for cand in candidates:
            # Require minimum relevance threshold
            if cand["score"] < 0.15:
                continue

            entity_type = cand["entity_type"]
            entity_id = cand["entity_id"]
            
            affected_side_cite = None
            rationale = ""
            
            if entity_type == "OBLIGATION" and entity_id in ob_map:
                obl = ob_map[entity_id]
                affected_side_cite = Citation(
                    document_id=obl.linked_doc_id or obl.id,
                    version_id="current",
                    section_id="obligation_text",
                    para_id=obl.id,
                    quoted_text=obl.description
                )
                rationale = f"Regulatory revision directly implicates compliance obligation '{obl.description[:80]}...'"
                
            elif entity_type == "PROJECT" and entity_id in proj_map:
                proj = proj_map[entity_id]
                affected_side_cite = Citation(
                    document_id=proj.id,
                    version_id="current",
                    section_id="project_scope",
                    para_id=proj.id,
                    quoted_text=proj.description
                )
                rationale = f"Regulatory shift affects active workstream and design parameters for project '{proj.name}'"
                
            elif entity_type == "DOC_PARA" and entity_id in doc_map:
                doc = doc_map[entity_id]
                chunk_id = cand["metadata"].get("para_id", "p1")
                affected_side_cite = Citation(
                    document_id=doc.id,
                    version_id=str(doc.current_version),
                    section_id=cand["metadata"].get("section_id", "sec_1"),
                    para_id=chunk_id,
                    quoted_text=cand["text"]
                )
                rationale = f"Internal governing document '{doc.title}' contains provisions directly affected by new rule."

            if not affected_side_cite:
                continue

            # Ensure change-side citation exists
            change_side_cite = change.after_citation or change.before_citation
            if not change_side_cite:
                continue

            # Compute mapping confidence
            conf = change.confidence
            signals = list(change.confidence_signals)
            
            # Check for rank tie if multiple matches score within 3%
            if len(candidates) > 1 and abs(candidates[0]["score"] - candidates[1]["score"]) < 0.03:
                if conf == ConfidenceTier.HIGH:
                    conf = ConfidenceTier.MEDIUM
                signals.append("SIG_RANK_TIE: Multiple enterprise assets closely matched regulatory description")

            affected_type_mapped = "DOCUMENT" if entity_type == "DOC_PARA" else entity_type

            mapping = ImpactMapping(
                id=f"map_{uuid.uuid4().hex[:8]}",
                change_id=change.id,
                affected_type=affected_type_mapped,
                affected_id=entity_id,
                rationale=rationale,
                change_citation=change_side_cite,
                affected_citation=affected_side_cite,
                confidence=conf,
                confidence_signals=signals
            )
            mappings.append(mapping)

            # If document is linked to obligations, map linked obligations as well (PRD FR4.3)
            if affected_type_mapped == "DOCUMENT":
                for obl in obligations:
                    if obl.linked_doc_id == entity_id:
                        mappings.append(ImpactMapping(
                            id=f"map_{uuid.uuid4().hex[:8]}",
                            change_id=change.id,
                            affected_type="OBLIGATION",
                            affected_id=obl.id,
                            rationale=f"Compliance obligation '{obl.id}' is governed by impacted document '{entity_id}'.",
                            change_citation=change_side_cite,
                            affected_citation=Citation(
                                document_id=entity_id,
                                version_id="current",
                                section_id="obligation_text",
                                para_id=obl.id,
                                quoted_text=obl.description
                            ),
                            confidence=conf,
                            confidence_signals=signals
                        ))

        return mappings
