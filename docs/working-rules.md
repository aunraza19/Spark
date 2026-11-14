# Working rules

## How we work
- Smallest complete change but never skip tests, proofs, approvals or stop points.
- Work in phases. Phase 1 is investigation only: reproduce, find the root cause with file and line references and your confidence, propose the fix. Then STOP and wait.
- Stop at every stop point I give. Never continue past one on your own.
- If a result is unexpected, stop and report it with evidence and a hypothesis. Don't work around it.

## Fixing
- Fix at the core, where the defect starts. No patches, wrappers or special cases at call sites.
- After a core fix, walk up the caller chain one level at a time and re-check each level.

## Tests
- Tests first: write the failing test, run it, show it failing, then fix, then show it passing.
- Never edit an existing test or expected value to make it pass. If a test seems wrong, stop and ask. Setup-only changes, and changes that follow a behaviour I approved, still need my sign-off: show the diff.
- Every commit must pass the full suite on its own tree. Report suite and lint results per commit, against the baseline.

## Git
- No Co-Authored-By trailer.

## Code quality
- Only the code the fix needs. No speculative options, one-use helpers or wrappers.
- No comments that restate the code; comment only the reason, when it isn't obvious.
- Match the repo's existing style.
- Remove code made unused by the change; prove it's unused and list it.

## Reports (every time)
Write for someone who can't open your files. Put key facts inline; file paths are extra, never instead of the content.
1. OUTCOME: two or three sentences. What passed, what failed, what's blocked.
2. CHECKLIST: every numbered item from my last message: DONE / NOT DONE / BLOCKED / VOID, and why.
3. CHECKS: the exact input, the expected value and its source, the actual result (quoted), pass/fail.
4. TIMINGS: a stage-by-stage table and why the slowest stage was slow.
5. FAILURES: what happened, quoted evidence, your hypothesis and confidence, what you did NOT do.
6. CHANGES: files, key diffs inline; each commit's id, message, suite and lint result.
7. TESTS: each new test by name, shown failing (quoted), then passing.
8. DECISIONS NEEDED: numbered, with options, trade-offs and your recommendation.
10. NOT CHECKED, RISKS, DEPLOY NOTE: anything unverified, what could break, and any grant, env, schema or deploy-order requirement.
Plain language, short sentences.
