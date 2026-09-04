#!/usr/bin/env python3
"""Strata Regulatory Intelligence & Operations Workspace — Unified Launcher

Starts the FastAPI server with the compiled React SPA mounted at http://localhost:8000.
"""

import os
import sys
import webbrowser
import uvicorn
from strata.seed import seed_database

def main():
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    db_path = os.environ.get("STRATA_DB_PATH", "strata.db")

    print("=" * 80)
    print("  STRATA REGULATORY INTELLIGENCE & LIVING OPERATIONS WORKSPACE")
    print("=" * 80)

    # Seed only on first run (or after an explicit reset) so restarts preserve workspace state
    if not os.path.exists(db_path) or os.path.getsize(db_path) == 0:
        print(f"[*] Initializing local database: {db_path}")
        seed_database(db_path)
    else:
        print(f"[*] Using existing local database: {db_path} (run 'make reset-db' to reseed)")

    url = f"http://localhost:{port}"
    print(f"[*] Serving React SPA & REST API at: {url}")
    print(f"[*] Interactive Swagger Docs at:     {url}/docs")
    print("=" * 80)

    if "--no-browser" not in sys.argv:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    uvicorn.run("strata.api.app:app", host=host, port=port, reload=False)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[*] Strata workspace stopped cleanly.")
        sys.exit(0)
