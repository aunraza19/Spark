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
- Stack: Python 3.12 (uv, one root pyproject.toml with a uv build section, no .python-version, requires-python = ">=3.12,<3.13"), FastAPI, Gemini. Frontend: Vite + React + TypeScript, plain single-page app. Packages: uv for Python, npm for the web.
- Git: existing repo and origin. Setup is the root commit on main. Later work goes on feature branches. Commit messages are short and imperative, no trailer. First push only when the user asks.
- Scripts: write them in Python, never in bash or PowerShell only. The main machine is Windows, teammates may use other systems.
- Data in git: Pydantic models in backend/spark_data. Clean files are JSON and are committed. data/incoming JSON and CSV are committed, PDFs are not.
- Lunar zone: oxygen >= 30% and pressure <= 10.2 psi, bounds inclusive, no tolerance band. ISS is one reference point (21% at 14.7 psi), not a zone. Spacesuit (100% at 4.3 psi) is a note only. Values live only in data/reference/habitats.json.
- Test points: o2_pct_min and o2_pct_max with an approximate flag, never a midpoint. Raw fuel and outcome text kept. Inverse-flame (burner oxygen) points go in their own file, never with ambient points.
- Clean output: PSI-39 exact duplicate rows are dropped and listed in the build report. ambient_temperature_K is left out. A record that fails validation is left out and listed, and the validator exits 1.
- Conditions known only from reports: data/reference/report_conditions.json, a few entries with source file, page, figure and test id.
- Chat library: assistant-ui, chosen by the spike in docs/chat-library-spike.md. The spike branch was deleted after the agent phase; its findings stay in that file.
- Deployment target: one Cloud Run service, FastAPI serves the built frontend. Priority: the dashboard first, the agent second.
- Dashboard: FastAPI serves all data and computed views and the frontend only draws. The map is plain SVG. Styling is plain CSS with variables, no gradients. Frontend tests: Vitest, Testing Library, jsdom, no browser automation.
- Ranking: two visible scores. Atmosphere match is 100 x (1 - distance of the experiment's nearest test), distance as a share of the target's own values. Material relevance is the weight of the fuel category in data/reference/fuel_categories.json ("our weighting"). Order: atmosphere match, tests inside the zone, material relevance, PSI id. Experiments without per-test conditions are listed as not scored, with reasons.
- Snapshots for "Explain this": built in Python from data/clean and data/reference, rounded to 3 decimals, keyed by the SHA-256 of canonical JSON. Reviewed AI text will live in data/reference/reviewed/.

## Open decisions
- Gemini access: through Vertex AI on Google Cloud, because the credits cover Gemini only through Vertex AI, not the AI Studio key. Set up in the agent phase.
- In a browser, confirm the assistant-ui tool card and the page highlight. Agent phase.
- Where the assistant's documents live. PDFs are git-ignored, so probably short text extracts in `data/clean`.

## Commands
- `uv sync` set up the Python environment
- `uv run pytest` run the tests
- `uv run ruff check .` lint (ruff default rules)
- `uv run python scripts/validate_data.py` check the experiment records (exit 1 on any error)
- `uv run python scripts/build_data.py` write the clean files into `data/clean`
- `uv run uvicorn --factory spark_data.api:create_app --port 8000` run the API (data from `data/clean`, read-only). It also serves `web/dist` at `/` when that build exists.
- In `web/`: `npm install`, `npm run dev` (port 5173, proxies `/api` to port 8000), `npm test`, `npm run typecheck`, `npm run build`
- Windows: start the web commands from a shell whose path has an upper-case drive letter (`C:\...`). With a lower-case `c:\...` start folder, Vitest fails with "failed to find the current suite".

## Rules and context
@docs/working-rules.md
@docs/project-brief.md
@docs/data-rules.md
