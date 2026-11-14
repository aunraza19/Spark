# Spark

Web dashboard for the NASA Space Apps 2026 challenge "Flame in Freefall". It summarizes, ranks and explains NASA's microgravity combustion experiments from the PSI repository, for fire safety in crewed exploration.
Backend: Python FastAPI with a Gemini assistant. Frontend: React. Every number comes from checked data files.
Audience: professors, students, aerospace researchers and engineers.

## Folder map
- `docs/` working rules, project brief, data rules
- `data/incoming/experiments/` teammates' experiment JSON (read-only)
- `data/incoming/test-tables/` teammates' test-table CSVs (read-only)
- `data/incoming/documents/` PDF reports (git-ignored, read-only)
- `data/clean/` cleaned files written by scripts
- `scripts/` Python data scripts
- `backend/` FastAPI app
- `web/` React app

## Decided
- Backend: Python 3.12, pinned through uv. FastAPI. Gemini as the model.
- Frontend: Vite + React + TypeScript, plain single-page app.
- Package managers: uv for Python, npm for the web.
- Git: existing repo and origin. Setup is the root commit on main. Later work goes on feature branches. Commit messages are short and imperative, no trailer. First push only when the user asks.
- Scripts: write them in Python, never in bash or PowerShell only. The main machine is Windows, teammates may use other systems.

## Open decisions
- Where the lunar zone values file lives (one place only).
- Chat library: assistant-ui or CopilotKit. Confirm it works with Vite during the chat library test.
- Where the assistant's documents live. PDFs are git-ignored, so probably short text extracts in `data/clean`.

## Commands
none yet

## Rules and context
@docs/working-rules.md
@docs/project-brief.md
@docs/data-rules.md
