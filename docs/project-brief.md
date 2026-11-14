# Project brief

## What we are building
A web dashboard for the NASA Space Apps 2026 challenge "Flame in Freefall". It summarizes, ranks and explains NASA's microgravity combustion experiments from the PSI repository, to give fire safety insights for crewed space exploration. Audience: professors, students, aerospace researchers and engineers.

## Source data
Source: https://psi.nasa.gov/physci/repo/search?q=combustion lists 26 results. We use 24: 19 flight experiments and 5 ground studies. Ground studies re-analyse flight data, so they appear in the list but not on the map. We skip PSI-181 (solder) and PSI-108 (fluid physics).

- Received: 16 experiment JSON records (PSI-10, 20, 21, 22, 23, 25, 26, 39, 47, 68, 69, 100, 101, 102, 107, 159).
- Pending from teammates: PSI-98, 99, 106 (flight, full format) and PSI-117, 62, 60, 115, 142 (ground, light format). Also more test-table CSVs and PDF reports.
- Test-table CSVs so far: PSI-25 and PSI-69, plus normal-flame tables for PSI-10 and PSI-159. PSI-20 has only a daily summary.
- CSV quirks:
  - Pressure comes in mmHg (PSI-69), atm (PSI-10, PSI-20) and bar (PSI-159).
  - Column names differ per file.
  - PSI-69 and PSI-159 need cp1252 encoding.
  - One PSI-69 row has pressure 0 and must be excluded.
  - The PSI-20 table has typos ("3400%", "2100%").
  - Inverse-flame tables give oxygen from the burner, not ambient, so they must not share a map with ambient oxygen.

## Reference atmospheres (from the challenge text)
- Lunar base or rover: 30% oxygen or more at 10.2 psi or less.
- ISS cabin: about 21% oxygen at 14.7 psi.
- Spacesuit: 100% oxygen at 4.3 psi.
- PSI has no partial-gravity data.

## Screens
- Habitat selector: ISS, lunar base or rover, custom.
- Atmosphere map: oxygen against pressure, one dot per real test, markers for conditions known only from reports, the target zone shaded.
- Gap finder: a plain-language finding that is computed from the data.
- Ranked list: two visible scores, atmosphere match and material relevance, from fixed rules.
- Experiment detail.
- Compare two or three experiments.
- Safety lens: prevention, detection, suppression.
- Earth tab: small. NASA spinoffs are history and must be labelled as NASA history, not PSI results.

## Assistant
Python FastAPI backend, Gemini as the model. It answers from the same checked data as the dashboard, plus deeper JSON fields and short site texts.

- Few tools: search experiments, get experiment, query tests, compare, set dashboard view.
- A small fixed set of visuals (about four) and five skills at most.
- Numbers come only from checked data; documents explain.
- Chat UI: assistant-ui or CopilotKit, decided later by a one-hour test. React is needed for both.

## Design rules
Minimal UI, plain words, no AI jargon, no filler features, quality over quantity, every number shows its source.

## Current understanding
To be recomputed from data, never typed into the app. In the PSI data reviewed, no solid-fuel test ran near lunar-base conditions.

- Closest tests:
  - PSI-69 (liquid droplets, 17 tests at 30-34% O2 and 10.3-10.5 psi).
  - PSI-159 (gas, 20 tests at 7.3 psi and 33-39% O2).
  - PSI-20 (gas, 26.5% at 10.2 psia and 34% at 8.2 psia, from the report).
- Saffire-IV to VI, SoFIE and FM2 exist but are not in PSI.
