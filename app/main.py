from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import reports, risk_radar, patterns, precedents, actions, auth, analyse, dashboard, intelligence

app = FastAPI(
    title="Sanketak API",
    description="Backend for Sanketak — an anonymous, multilingual worker safety reporting "
                "system with AI-powered risk analysis, historical disaster precedent matching, "
                "and pattern detection. Built for OIL's HSE team, fully self-hosted with no "
                "external cloud AI dependencies.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reports.router)
app.include_router(risk_radar.router)
app.include_router(patterns.router)
app.include_router(precedents.router)
app.include_router(actions.router)
app.include_router(auth.router)
app.include_router(analyse.router)
app.include_router(dashboard.router)
app.include_router(intelligence.router)

# Serve the HSE dashboard from the API itself, at http://localhost:8000/dashboard/
#
# Previously the only way to open it was VS Code's Live Server, which meant the
# dashboard was unreachable for anyone not using that editor, and which served
# the repository root -- where an older Supabase-era copy of the same pages
# used to sit (now in dashboard-legacy.superseded/).
#
# Registered after every API router, so it cannot shadow an API route, and
# guarded so the API still boots if the directory is missing. Serving it from this origin also
# means the dashboard's fetch() calls are same-origin.
_dashboard = Path(__file__).resolve().parent.parent / "dashboard"

if _dashboard.is_dir():
    app.mount(
        "/dashboard",
        StaticFiles(directory=str(_dashboard), html=True),
        name="dashboard",
    )

@app.get(
    "/health",
    tags=["health"],
    summary="Health check",
    description="Simple liveness check to confirm the API is running.",
)
def health():
    return {"status": "ok"}