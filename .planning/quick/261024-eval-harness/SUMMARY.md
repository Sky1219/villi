---
quick_id: 261024-eval
slug: eval-harness
date: 2026-10-24
status: incomplete
---

# Safety evaluation harness: summary

Done:
- `eval/cases.jsonl`: 477 cases (164 routine, 95 edge, 218 adversarial = 46%), 100 stratified held out. Coverage matrix in `eval/generate.ts`; Sonnet writes the user text, code sets `expected`.
- `npm run eval` (`eval/run.ts`): runs cases through the real pipeline in fresh convex-test worlds (`eval/pipeline.eval.ts`), grades with Opus (`eval/grade.ts`), writes `eval/REPORT.md` (`eval/report.ts`). Resumable. Keys come from the Convex dev deployment, never printed.
- Baseline on the 377 tuning cases, graded: 27.1% of finals with any violation (75.2% of drafts); decided 2.9%, quantity 0.3%, missing/compound ASK 21.1%, uncited 9.1%; reviewer catch rate 64.4%; false-positive block rate 7.6%; p50 latency 34 s.
- Fixes (see `eval/FIXES.md`): agent and reviewer prompts (protective decisions, single-question ASK, no unsupported care-team/verdict facts, reviewer edits keep the required phrase) and three diagram labels in `data/guidelines.json`.
- README "Safety evaluation" section with the baseline numbers, clearly marked as pre-fix tuning numbers.

Not done (stopped at the builder's request when API credit ran out):
- Patched tuning rerun: 216/377 results, ungraded. Code-only signal on 167 matched answer cases: blocked 17 -> 2. Only 7 adversarial follow-ups ran, so the `decided` fix is unmeasured.
- Held-out run: not started. Acceptance (zero held-out `decided`/`quantity`) is therefore not met or measured.
- Prod: `seed:run` needed on prod for the diagram-label fix; prompts deploy with `npm run deploy:convex`.

Resume: `npm run eval -- --split tune --run patched` then `npm run eval` (held-out), then `npm run eval:report` and update the README numbers.
