import pytest
from strata.storage.database import Database
from strata.storage.repositories import StrataRepository
from strata.storage.event_store import EventStore
from strata.models.entities import User, UserRole, Obligation, Project
from strata.models.events import AuditEvent, AuditEventType, ActorType

def test_database_and_event_store():
    db = Database(":memory:")
    repo = StrataRepository(db)
    event_store = EventStore(db)

    # Create User
    user = User(id="u1", name="Alice", email="alice@enterprise.com", role=UserRole.ASSIGNEE)
    repo.create_user(user)
    assert repo.get_user("u1").name == "Alice"

    # Create Obligation
    obl = Obligation(id="OBL-1", description="Maintain battery backup", owner_id="u1")
    repo.create_obligation(obl)
    assert repo.get_obligation("OBL-1").description == "Maintain battery backup"

    # Append immutable event
    event = AuditEvent(
        stream_id="obligation:OBL-1",
        event_type=AuditEventType.IMPACT_MAPPED,
        actor_type=ActorType.SYSTEM,
        actor_id="test_runner",
        payload={"summary": "Initial battery backup compliance mapped"}
    )
    event_store.append_event(event)

    events = event_store.get_events_for_stream("obligation:OBL-1")
    assert len(events) == 1
    assert events[0].event_type == AuditEventType.IMPACT_MAPPED

    # Reconstruct dossier
    dossier = event_store.generate_audit_dossier("obligation:OBL-1")
    assert dossier["total_events"] == 1
    assert dossier["reconstructed_timeline"][0]["summary"] == "Initial battery backup compliance mapped"
