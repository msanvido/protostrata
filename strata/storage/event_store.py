import json
import sqlite3
from typing import List, Optional, Dict, Any
from strata.storage.database import Database
from strata.models.events import AuditEvent, AuditEventType, ActorType

class EventStore:
    def __init__(self, db: Database):
        self.db = db

    def append_event(self, event: AuditEvent) -> AuditEvent:
        with self.db.get_connection() as conn:
            payload_json = json.dumps(event.payload)
            cites_json = json.dumps(event.linked_citations)
            conn.execute(
                """INSERT INTO audit_events 
                   (id, stream_id, event_type, actor_type, actor_id, payload_json, linked_citations_json, timestamp)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (event.id, event.stream_id,
                 event.event_type.value if hasattr(event.event_type, 'value') else event.event_type,
                 event.actor_type.value if hasattr(event.actor_type, 'value') else event.actor_type,
                 event.actor_id, payload_json, cites_json, event.timestamp)
            )
            conn.commit()
        return event

    def get_events_for_stream(self, stream_id: str) -> List[AuditEvent]:
        with self.db.get_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_events WHERE stream_id = ? ORDER BY timestamp ASC",
                (stream_id,)
            ).fetchall()
            return [self._row_to_event(r) for r in rows]

    def get_all_events(self) -> List[AuditEvent]:
        with self.db.get_connection() as conn:
            rows = conn.execute("SELECT * FROM audit_events ORDER BY timestamp ASC").fetchall()
            return [self._row_to_event(r) for r in rows]

    def _row_to_event(self, row: sqlite3.Row) -> AuditEvent:
        return AuditEvent(
            id=row["id"],
            stream_id=row["stream_id"],
            event_type=row["event_type"],
            actor_type=row["actor_type"],
            actor_id=row["actor_id"],
            payload=json.loads(row["payload_json"]),
            linked_citations=json.loads(row["linked_citations_json"]) if row["linked_citations_json"] else [],
            timestamp=row["timestamp"]
        )

    def generate_audit_dossier(self, stream_id: str) -> Dict[str, Any]:
        """Reconstructs a living entity timeline from immutable events without data loss."""
        events = self.get_events_for_stream(stream_id)
        timeline = []
        for e in events:
            timeline.append({
                "event_id": e.id,
                "timestamp": e.timestamp,
                "event_type": e.event_type,
                "actor": f"{e.actor_type}:{e.actor_id}",
                "summary": e.payload.get("summary", ""),
                "details": e.payload,
                "citations": e.linked_citations
            })
        return {
            "stream_id": stream_id,
            "total_events": len(events),
            "reconstructed_timeline": timeline
        }
