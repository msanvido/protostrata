from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from typing import Dict, Any, Optional, List
from pydantic import BaseModel
from strata.service import StrataService
from strata.seed import seed_database
import os

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Strata Regulatory Operations API", version="1.0")

# Enable CORS for Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount React production build assets if present
react_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
react_assets = os.path.join(react_dist, "assets")
if os.path.exists(react_assets):
    app.mount("/assets", StaticFiles(directory=react_assets), name="assets")

# Mount fallback UI static assets
ui_dir = os.path.join(os.path.dirname(__file__), "..", "ui")
if os.path.exists(ui_dir):
    app.mount("/static", StaticFiles(directory=ui_dir), name="static")

# Initialize shared database service
DB_PATH = os.environ.get("STRATA_DB_PATH", "strata.db")
service = StrataService(db_path=DB_PATH)

@app.on_event("startup")
def startup_event():
    # Ensure database is initialized
    if not os.path.exists(DB_PATH) or os.path.getsize(DB_PATH) == 0:
        seed_database(DB_PATH)

@app.get("/", response_class=HTMLResponse)
def get_ui():
    react_index = os.path.join(react_dist, "index.html")
    if os.path.exists(react_index):
        return FileResponse(react_index)
    index_path = os.path.join(os.path.dirname(__file__), "..", "ui", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("<h1>Strata API Online. UI not found.</h1>")

@app.get("/health")
def health():
    return {"status": "ok", "service": "Strata MVP"}

class CreateProjectRequest(BaseModel):
    id: str
    name: str
    description: str
    owner_id: str
    status: str = "ACTIVE"
    linked_obligations: List[str] = []

class CreateProceedingRequest(BaseModel):
    id: str
    docket_id: str
    title: str
    jurisdiction: str = "FERC"
    version_label: str = "Initial Filing"
    raw_text: str
    status: str = "PROPOSED"
    auto_analyze: bool = True

@app.get("/proceedings")
def list_proceedings():
    with service.db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM proceedings").fetchall()
        result = []
        for r in rows:
            p = dict(r)
            versions = service.repo.get_proceeding_versions(p["id"])
            p["versions"] = [
                {
                    "id": v.id,
                    "version_label": v.version_label,
                    "status": v.status.value if hasattr(v.status, 'value') else v.status,
                    "filed_date": str(v.filed_date) if v.filed_date else None,
                    "sections_count": len(v.sections)
                }
                for v in versions
            ]
            result.append(p)
        return result

@app.post("/proceedings")
def create_proceeding(req: CreateProceedingRequest):
    try:
        from strata.models.entities import ProceedingStatus
        status_enum = ProceedingStatus(req.status)
        proc, ver = service.create_proceeding(
            proceeding_id=req.id,
            docket_id=req.docket_id,
            title=req.title,
            jurisdiction=req.jurisdiction,
            version_label=req.version_label,
            raw_text=req.raw_text,
            status=status_enum
        )
        result = {"proceeding": proc.dict(), "version": ver.dict()}
        if req.auto_analyze and req.raw_text:
            analysis = service.analyze_new_regulation(req.id, ver.id)
            result["analysis"] = analysis
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/proceedings/{proceeding_id}")
def delete_proceeding(proceeding_id: str, user_id: str = "u_admin"):
    success = service.delete_proceeding(proceeding_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Proceeding not found")
    return {"deleted": True, "id": proceeding_id}

@app.get("/projects")
def list_projects():
    with service.db.get_connection() as conn:
        rows = conn.execute("SELECT * FROM projects").fetchall()
        return [dict(r) for r in rows]

@app.post("/projects")
def create_project(req: CreateProjectRequest, user_id: str = "u_admin"):
    try:
        from strata.models.entities import Project
        proj = Project(
            id=req.id,
            name=req.name,
            description=req.description,
            owner_id=req.owner_id,
            status=req.status,
            linked_obligations=req.linked_obligations
        )
        created = service.create_project(proj, creator_id=user_id)
        return created.dict()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/projects/{project_id}")
def delete_project(project_id: str, user_id: str = "u_admin"):
    success = service.delete_project(project_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"deleted": True, "id": project_id}

@app.get("/obligations")
def list_obligations():
    return [o.dict() for o in service.repo.list_obligations()]

@app.post("/analyze")
def run_analysis(proceeding_id: str, prev_version_id: str, curr_version_id: str):
    try:
        res = service.analyze_versions(proceeding_id, prev_version_id, curr_version_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/actions")
def list_actions(owner_id: Optional[str] = None, state: Optional[str] = None):
    actions = service.repo.list_actions(owner_id=owner_id, state=state)
    return [a.dict() for a in actions]

@app.post("/actions/{action_id}/override")
def record_override(action_id: str, user_id: str, updated_text: str, rationale: str):
    try:
        updated = service.record_human_override(action_id, user_id, updated_text, rationale)
        return updated.dict()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/actions/{action_id}/transition")
def transition_action(action_id: str, user_id: str, new_state: str, notes: str = ""):
    try:
        from strata.models.analysis import ActionState
        state_enum = ActionState(new_state)
        updated = service.transition_action_state(action_id, user_id, state_enum, notes)
        return updated.dict()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/expert_review/{target_id}/resolve")
def resolve_expert(target_id: str, reviewer_id: str, decision: str, rationale: str):
    try:
        event = service.resolve_expert_review(target_id, reviewer_id, decision, rationale)
        return event.dict()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/audit/{stream_id}")
def get_audit_dossier(stream_id: str):
    return service.event_store.generate_audit_dossier(stream_id)
