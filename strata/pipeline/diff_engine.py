import difflib
from typing import List, Dict, Any, Tuple, Optional
from strata.models.entities import ProceedingVersion, Paragraph
from strata.models.analysis import ChangeRecord, ChangeType, Materiality, Citation, ConfidenceTier

class DiffEngine:
    @classmethod
    def align_and_diff(cls, prev_version: ProceedingVersion, curr_version: ProceedingVersion) -> List[Dict[str, Any]]:
        """Performs deterministic paragraph-level sequence alignment between two versions."""
        prev_paras = cls._flatten_paragraphs(prev_version)
        curr_paras = cls._flatten_paragraphs(curr_version)
        
        prev_texts = [p["text"] for p in prev_paras]
        curr_texts = [p["text"] for p in curr_paras]
        
        matcher = difflib.SequenceMatcher(None, prev_texts, curr_texts)
        diff_pairs = []
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                continue
            elif tag == 'replace':
                # Modified paragraphs
                for p_idx, c_idx in zip(range(i1, i2), range(j1, j2)):
                    diff_pairs.append({
                        "diff_type": "MODIFIED",
                        "prev_para": prev_paras[p_idx],
                        "curr_para": curr_paras[c_idx]
                    })
                # If length difference, handle leftover as added or removed
                if (i2 - i1) > (j2 - j1):
                    for p_idx in range(i1 + (j2 - j1), i2):
                        diff_pairs.append({
                            "diff_type": "REMOVED",
                            "prev_para": prev_paras[p_idx],
                            "curr_para": None
                        })
                elif (j2 - j1) > (i2 - i1):
                    for c_idx in range(j1 + (i2 - i1), j2):
                        diff_pairs.append({
                            "diff_type": "ADDED",
                            "prev_para": None,
                            "curr_para": curr_paras[c_idx]
                        })
            elif tag == 'delete':
                for p_idx in range(i1, i2):
                    diff_pairs.append({
                        "diff_type": "REMOVED",
                        "prev_para": prev_paras[p_idx],
                        "curr_para": None
                    })
            elif tag == 'insert':
                for c_idx in range(j1, j2):
                    diff_pairs.append({
                        "diff_type": "ADDED",
                        "prev_para": None,
                        "curr_para": curr_paras[c_idx]
                    })
                    
        return diff_pairs

    @classmethod
    def _flatten_paragraphs(cls, version: ProceedingVersion) -> List[Dict[str, Any]]:
        flat = []
        for sec in version.sections:
            for p in sec.paragraphs:
                flat.append({
                    "version_id": version.id,
                    "section_id": sec.section_id,
                    "para_id": p.para_id,
                    "text": p.text,
                    "char_span": p.char_span.dict() if p.char_span else None
                })
        return flat
