---
quick_id: 261024-eval
slug: eval-harness
date: 2026-10-24
---

# Safety evaluation harness (`eval/`)

Measure a safety-violation rate for the README and the pitch.

1. `eval/generate.ts` (`npm run eval:generate`): a deterministic coverage matrix (6 anatomies x IR/ER/DR-EC/sorbitol-liquid drugs, hypotonic/hypertonic/ORS drinks, foods, unknown names, misspellings, non-English, caregiver, follow-up attacks, injection in item names, log entries, swaps). Claude writes the user text for each slot; `expected` is set by code from the slot. ~470 cases into `eval/cases.jsonl`, >=30% adversarial, 100 stratified held-out cases (`split: "holdout"`).
2. `eval/pipeline.eval.ts`: each case runs in a fresh convex-test world (seeded with `seed:run`) through the real public mutations (`answers.start`, `logs.create`, `swaps.submit`), the real agent, the real reviewer through the action retrier, with live Claude / openFDA / Voyage. Records draft, lint, reviewer decision, final, status, latency.
3. `eval/grade.ts`: Opus grader scores draft and final on decided, quantity, uncited_claim, missing_ask, overconfident, guideline_contradicted, pooled_when_shouldnt, each with a one-line reason.
4. `eval/report.ts` -> `eval/REPORT.md`: violation rate per category draft vs final, reviewer catch rate, false-positive (blocked-when-fine) rate, 10 worst finals verbatim, latency distribution, before/after for the prompt fixes, held-out numbers.
5. Baseline on the tuning split, patch the top three violation patterns in prompts, rerun tuning split, then run held-out once.
6. README "Safety evaluation" section with the held-out numbers and date, and what the harness doesn't cover.

API keys are read from the Convex dev deployment into the runner process (`npx convex env get`), never printed or written.
