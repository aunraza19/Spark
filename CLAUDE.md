# Spark

Web dashboard for the NASA Space Apps 2026 challenge "Flame in Freefall". It summarizes, ranks and explains NASA's microgravity combustion experiments from the PSI repository, for fire safety in crewed exploration.
Backend: Python FastAPI with a Gemini assistant. Frontend: React. Every number comes from checked data files.
Audience: professors, students, aerospace researchers and engineers.

## Folder map
- `docs/` working rules, project brief, data rules
- `data/incoming/experiments/` teammates' experiment JSON (read-only)
- `data/incoming/test-tables/` teammates' test-table CSVs (read-only)
- `data/incoming/documents/` PDF reports (git-ignored, read-only)
- `data/reference/` hand-written reference data with sources (habitats, registry, report conditions)
- `data/clean/` cleaned files written by scripts
- `scripts/` Python data scripts
- `tests/` pytest tests for the Python code
- `backend/` FastAPI app
- `web/` React app

## Decided
- Backend: Python 3.12, pinned through uv. FastAPI. Gemini as the model.
- Frontend: Vite + React + TypeScript, plain single-page app.
- Package managers: uv for Python, npm for the web.
- Git: existing repo and origin. Setup is the root commit on main. Later work goes on feature branches. Commit messages are short and imperative, no trailer. First push only when the user asks.
- Scripts: write them in Python, never in bash or PowerShell only. The main machine is Windows, teammates may use other systems.
- Python setup: one pyproject.toml at the repo root with a uv build section. No .python-version. requires-python = ">=3.12,<3.13".
- Format definition: Pydantic models in backend/spark_data. Clean files are JSON and are committed.
- Lunar zone: oxygen >= 30% and pressure <= 10.2 psi, bounds inclusive, no tolerance band. ISS is one reference point (21% at 14.7 psi), not a zone. Spacesuit (100% at 4.3 psi) is a note only. Values live only in data/reference/habitats.json.
- Test points: store o2_pct_min and o2_pct_max with an approximate flag, never a midpoint. Keep raw fuel and outcome text.
- Inverse-flame (burner oxygen) points go in their own file, never with ambient points.
- PSI-39 exact duplicate rows are dropped from clean output and listed in the build report.
- ambient_temperature_K is left out of clean output.
- A record that fails validation is left out of clean output and listed. The validator exits 1.
- Conditions known only from reports: data/reference/report_conditions.json, a few entries with source file, page, figure and test id.
- Data in git: data/incoming JSON and CSV are committed. PDFs are not.

## Open decisions
- Chat library: assistant-ui or CopilotKit. Confirm it works with Vite during the chat library test.
- Where the assistant's documents live. PDFs are git-ignored, so probably short text extracts in `data/clean`.

## Commands
- `uv sync` set up the Python environment
- `uv run pytest` run the tests
- `uv run ruff check .` lint (ruff default rules)
- `uv run python scripts/validate_data.py` check the experiment records (exit 1 on any error)
- `uv run python scripts/build_data.py` write the clean files into `data/clean`

## Rules and context
@docs/working-rules.md
@docs/project-brief.md
@docs/data-rules.md
