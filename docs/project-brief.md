# Project brief

## What we are building
A web dashboard for the NASA Space Apps 2026 challenge "Flame in Freefall". It summarizes, ranks and explains NASA's microgravity combustion experiments from the PSI repository, to give fire safety insights for crewed space exploration. Audience: professors, students, aerospace researchers and engineers.

## Source data
Source: https://psi.nasa.gov/physci/repo/search?q=combustion lists 26 results. We use 24: 19 flight experiments and 5 ground studies. Ground studies re-analyse flight data, so they appear in the list but not on the map. We skip PSI-181 (solder) and PSI-108 (fluid physics).

- Received: all 24 experiment JSON records (19 flight, 5 ground), 21 test-table CSVs and 14 PDF reports (PDFs are git-ignored).
- The 21 CSVs cover all 19 flight experiments. PSI-10 and PSI-159 each have a normal and an inverse table. The 5 ground studies have no CSV.
- What the CSVs can give:
  - Ambient oxygen and pressure per test: PSI-10 normal, PSI-39, PSI-69, PSI-159 normal.
  - Ambient oxygen per test, pressure only from the JSON record: PSI-25, PSI-98, PSI-99.
  - Burner oxygen per test (inverse flames): PSI-10 inverse, PSI-159 inverse.
  - No per-test oxygen or pressure (daily or planned summaries, or other measurements): PSI-20, 21, 22, 23, 26, 47, 68, 100, 101, 102, 106, 107.
- CSV quirks:
  - Pressure comes in mmHg (PSI-69), atm (PSI-10), text such as "1 atm" (PSI-39) and bar (PSI-159). PSI-20 and PSI-25 have no pressure column.
  - Oxygen is a fraction in PSI-10, 39, 69 and 159, a percent in PSI-25, and text in PSI-98 and 99 ("21.5 - 21.7", "~ 22.1"). The PSI-100 CSV has no oxygen column.
  - Column names differ per file.
  - Only PSI-69 needs cp1252 encoding. PSI-25 and PSI-26 start with a byte order mark (read as utf-8-sig). The others are plain ASCII.
  - One PSI-69 row (FLEX test 114) has pressure 0 and must be excluded.
  - PSI-39 has 8 exact duplicate rows (87 rows, 79 unique).
  - PSI-10 normal has 60 RAMP or RAMPED rows. Their fuel-flow cells are text, but oxygen and pressure are numbers.
  - PSI-159 inverse has 154 real rows followed by 861 blank lines.
  - The PSI-20 table has typos ("3400%", "2100%").
  - Inverse-flame tables give oxygen from the burner, not ambient, so they must not share a map with ambient oxygen.
- The oxygen and pressure ranges in the JSON records are not safe to plot. PSI-10 and PSI-159 include burner oxygen up to 85%, and PSI-68 gives a planned range, not tests run.

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
  - PSI-69 (liquid droplets, 17 tests at 30-34% O2 and 10.33-10.50 psi; all above 10.2 psi, so outside the lunar zone).
  - PSI-159 (gas, 20 normal-flame tests at 7.35 psi and 33.2-39.3% O2; inside the lunar zone).
  - PSI-20 (gas, 26.5% at 10.2 psia and 34% at 8.2 psia, from the report).
- Saffire-IV to VI, SoFIE and FM2 exist but are not in PSI.
