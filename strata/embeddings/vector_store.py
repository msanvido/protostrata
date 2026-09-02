import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import math

import os
import re

class VectorStore:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.model = None
        self._items: List[Dict[str, Any]] = [] # {id, entity_type, entity_id, text, vector}
        self._init_model()

    def _init_model(self):
        if os.environ.get("STRATA_OFFLINE_EMBEDDINGS", "1") == "1":
            self.model = None
            return
        try:
            import torch
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name)
        except Exception:
            self.model = None

    def embed_text(self, text: str) -> np.ndarray:
        if self.model is not None:
            vec = self.model.encode(text, convert_to_numpy=True)
            norm = np.linalg.norm(vec)
            return vec / norm if norm > 0 else vec
        
        # Deterministic lightweight hashing fallback for testing / offline
        words = text.lower().split()
        dim = 128
        vec = np.zeros(dim, dtype=np.float32)
        for w in words:
            idx = abs(hash(w)) % dim
            vec[idx] += 1.0
        norm = np.linalg.norm(vec)
        return vec / norm if norm > 0 else vec

    def add_document(self, item_id: str, entity_type: str, entity_id: str, text: str, metadata: Optional[Dict[str, Any]] = None):
        vec = self.embed_text(text)
        self._items.append({
            "item_id": item_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "text": text,
            "vector": vec,
            "metadata": metadata or {}
        })

    def search(self, query_text: str, top_k: int = 5, entity_type: Optional[str] = None, exclude_entity_type: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self._items:
            return []
        
        q_vec = self.embed_text(query_text)
        results = []
        
        for item in self._items:
            if entity_type and item["entity_type"] != entity_type:
                continue
            if exclude_entity_type and item["entity_type"] == exclude_entity_type:
                continue
            sim = float(np.dot(q_vec, item["vector"]))
            results.append({
                "item_id": item["item_id"],
                "entity_type": item["entity_type"],
                "entity_id": item["entity_id"],
                "text": item["text"],
                "score": sim,
                "metadata": item["metadata"]
            })
            
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def clear(self):
        self._items.clear()
