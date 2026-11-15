# Chat library spike: assistant-ui or CopilotKit

Date: 2026-11-15. Spike code: branch `spike/chat`, commit `cd11faf`. It is never merged. It stays as reference for the agent phase.

## Decision

assistant-ui.

## Reasons

- One deployable service. FastAPI can serve the built frontend, so Cloud Run runs one service. CopilotKit needs a separate Node runtime next to FastAPI, so three processes.
- Less code shipped to the browser: about 249 KB of gzipped JavaScript against about 1.04 MB.
- No Node runtime in production.
- A much smaller install: 135 top-level npm packages against 677 (165 against 1,295 counting nested ones). `node_modules` is 138 MB against 761 MB.
- No telemetry settings to manage. CopilotKit's telemetry is off with `COPILOTKIT_TELEMETRY_DISABLED=true`, and its install-time analytics (Scarf) is off with `scarfSettings` in `package.json` or `SCARF_ANALYTICS=false`.
- Integration code was about the same size: about 157 lines for assistant-ui, about 152 for CopilotKit.

Costs of the choice:

- More client glue: a 91-line adapter that flattens messages.
- The Vite toolkit plugin `@assistant-ui/vite` is young (version 0.0.21).
- The chat shell is ours to style. The styled components need shadcn and Tailwind. The spike used the unstyled primitives.

## What was tested

Vite + React + TypeScript frontend, FastAPI backend, one shared Python Gemini loop (`gemini-2.5-flash`, `google-genai`, API version v1beta), one backend tool `query_tests` that reads `data/clean/test_points.json`, and one page tool `highlight_experiment`.

| | assistant-ui 0.15.36 | CopilotKit 1.88.0 |
|---|---|---|
| Streamed reply (server logs) | pass | pass |
| Backend tool answered "20 tests, all PSI-159" (server logs, matches `build_report.json`) | pass | pass |
| Card in the chat | built, not seen in a browser | built, not seen in a browser |
| Page highlight | built, not seen in a browser | built, not seen in a browser |
| Services to run | 2 | 3 |
| Time from working core to built | 5.1 min | 11.2 min |

## Not yet verified

- The tool card and the page highlight in a browser, for either library. Postponed to the agent phase.
- Vertex AI. The spike used a Gemini API key from AI Studio. Not tested on Vertex AI.
- Production behaviour: authentication, several users, error display in the chat.
- Whether assistant-ui's `assistant-cloud` dependency makes network calls.

## Credits and model access

The Google Cloud credits cover Gemini only through Vertex AI, not through the AI Studio key. The agent phase must use Vertex AI. Deployment target: one Cloud Run service.

## Gotchas found

- The Gemini SDK needs `api_version="v1beta"` for function calling. The default version rejects it.
- The free tier allowed 5 requests per minute per model. It returned `429 RESOURCE_EXHAUSTED` once.
