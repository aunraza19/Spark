# "Explain this": plan

Status: plan only. No code is written for it yet.

## What it is
A button on the map and on each experiment page that reveals a short explanation. The explanations are written ahead of time by Gemini from our checked data, checked by a person on the team, and stored in the repo. The site never calls a model while someone is using it.

## The pieces

### 1. Snapshots (Python, in backend/spark_data)
- Map: the lunar zone, the ISS cabin and the NASA test atmosphere (a custom point at 34 % and 8.2 psi), each with the default 0 to 20 psi view. These snapshots exist today.
- Experiments: one snapshot per experiment (24). A new "experiment" snapshot is built from the same data the experiment page uses: the title, what was burned, where it ran, the tests on the map and their ranges, the key results and the data-quality notes, rounded to 3 decimals. Same rules as the map snapshots: built in Python, keyed by the SHA-256 of canonical JSON.
- 27 snapshots in all.

### 2. The script: scripts/build_explanations.py
- Builds each snapshot, sends it to Gemini with one fixed prompt, validates the answer, and saves the draft in data/reference/reviewed/explanations.json.
- Each entry holds: the snapshot key, the view name, status "ai_drafted", the model id, the backend, the date, the prompt version, the answer, and the validator result.
- The prompt is a file in the repo (data/reference/reviewed/prompt.v1.txt). It says: use only the snapshot, copy numbers exactly, write for professors and students in plain words, never say whether something will burn, and say "the data cannot tell" when it does not.
- The answer is requested as structured JSON with four fields:
  1. What you are seeing.
  2. What it means for fire safety.
  3. What the data cannot tell you.
  4. Sources: a list of PSI ids.

### 3. The validator: backend/spark_data/explain_check.py
It rejects an answer when any of these is true:
- A number in the text does not appear in the snapshot (compared after the same rounding). PSI ids such as PSI-159 are not counted as numbers, but each id must be in the snapshot.
- A sentence is 20 words or longer (the same rule as the rest of the site).
- A word appears that predicts or reassures: for example "will burn", "will ignite", "likely to burn", "safe", "dangerous". The list is a file with a test.
- A field is empty, or the sources list has an id that is not in the snapshot.
- A banned word from the site rules appears ("snapshot", "data version", "distance").
A rejected answer is retried twice with the reasons added to the prompt. After that the entry is saved with status "rejected" and its reasons, and it is never shown.

The validator checks numbers and phrases. It cannot check meaning. That is what the human review is for.

### 4. The review step: scripts/review_explanations.py
- Shows each "ai_drafted" entry next to its snapshot, one at a time. You answer: check it, reject it, or skip it.
- Checking sets status "human_checked", your name (from --reviewer) and the date. Nothing is ever checked automatically.
- You can also edit the JSON by hand. A checked entry whose text is edited afterwards goes back to "ai_drafted" (the script compares a hash of the text).

### 5. The API
- GET /api/explanation, with the same parameters as the map snapshot (habitat, or habitat=custom with o2 and psi), or with an experiment id.
- The server rebuilds the snapshot for that view, finds the entry with the same snapshot key, and returns it only if its status is "human_checked" and it has a name and a date. Otherwise it answers 404.
- Because the key is the hash of the snapshot, any change to the data changes the key. An explanation written for old data stops showing by itself. Nothing stale is ever served.
- A custom target that matches no stored view (anything other than the NASA test atmosphere numbers) gets 404, so no button is shown.

### 6. The site
- "Explain this" is a button in the "What the data says here" card and on each experiment page. It is only drawn when the API returns an explanation.
- It reveals the four parts under these headings, each source id as a link to its experiment page, and the label "AI explanation, checked by our team. Source: NASA PSI data." Under it, in small text: the model id, the date drafted, who checked it and when.
- Nothing moves, fades or opens by itself.

## Tests, written first
- Validator: each rejection rule has a test, plus an answer that passes.
- Script: a fake model client, no network. It checks the retry, the "rejected" path, that every entry carries the model id and date, and that the stored key equals the snapshot key.
- Review: nothing becomes "human_checked" without a name and a date; editing a checked entry resets it.
- API: serves only "human_checked" entries, 404 for "ai_drafted", "rejected", a stale key and a custom target; read-only.
- Site: no button on 404; the label text; the sources are links; the explanation is hidden until the click.
- A data test: every stored explanation's numbers are all in the snapshot with the stored key (this re-runs the validator on the repo's own data).

## Model access
One setting chooses the backend: SPARK_GEMINI_BACKEND, either "vertex" (default, because the credits cover Vertex AI) or "aistudio". The model id is a second setting, SPARK_GEMINI_MODEL. I have not picked a model id: I will take it from Google's current model list on the day, and the script records whichever id it used in every entry.

Both use the same Python package (google-genai), the same prompt and the same JSON answer shape. Only the way the client is built differs.

| | AI Studio | Vertex AI |
|---|---|---|
| Credentials | An API key from Google AI Studio, in GEMINI_API_KEY. | A Google Cloud project, no key. |
| Account | A Google account. | A Google Cloud project with billing or credits attached. |
| Setup | None beyond the key. | Enable the Vertex AI API in the project. Sign in with "gcloud auth application-default login" on a laptop, or give the Cloud Run service account the "Vertex AI User" role. |
| Settings | GEMINI_API_KEY | GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION |
| Covered by our credits | No (per CLAUDE.md). | Yes. |

What is sent to Google is our own snapshots of public NASA data. No personal data is sent. I have not read the current AI Studio terms on how free-tier input is used, so that should be checked before using it for anything other than public data.

## Cost
About 27 requests, a few thousand tokens each. This is small. A rate limit is possible, so the script waits and retries.

## Build time estimate
| Part | Hours |
|---|---|
| Experiment snapshot and its tests | 1 |
| Validator and its tests | 1 |
| Generation script, fake-client tests | 1.5 |
| Review script and tests | 0.5 |
| API endpoint and tests | 0.5 |
| Button, display and tests | 1 |
| First real run, fixing rejected entries and the prompt | 1 |
| Total | about 6.5 |

Your review time is extra: about 3 minutes for each of 27 entries, about 1.5 hours.

A smaller first version: the 3 map views and 4 experiments that cover each fuel type (PSI-25 solid, PSI-159 gas, PSI-69 liquid, PSI-20 emulated solid). That is 7 entries, about 4.5 hours of build and 25 minutes of review.

## Risks
- The validator cannot catch a wrong claim made with correct numbers. Only the human check does. If a check is rushed, the label "checked by our team" would be false.
- The model may write fire-safety advice that sounds firm. The prompt and the banned-phrase list reduce this. They do not remove it.
- A rejected entry costs a retry and your time. Some experiments have little data (16 of 24 have no per-test conditions), and their explanations will be short and mostly say what the data cannot tell.
- The label wording you gave uses a middle dot ("... checked by our team · NASA PSI data"). The copy test forbids middle dots, following the design plan. I propose a full stop instead (see above), and need your decision.
