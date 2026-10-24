---
quick_id: 261024-ask
status: complete
date: 2026-10-24
---

# Summary: ASK loop, impact view, caregiver role, cuts

- Questions: `status` open/asked/answered (`questions.setAsked`, `statusOf` falls back to `resolved`). `careTeam.logAnswer` takes `resultingChange` and marks the question answered; `careTeam.setResultingChange` updates it later. Sheet: "I asked this", "What did they say?" with "What changed because of it?", outcome on answered cards; print and Markdown show asked status and outcome.
- `/impact` "Is Villi working?" backed by `impact.summary` (bounded scans; `answers.by_status` index) and the pure `lib/impact.ts` tally: flags raised, questions asked, answers logged, formulation changes, monitoring started, by anatomy, real vs demo; plus `answers.rateUseful` ("Was this useful?").
- Caregivers: `profiles.caresFor` (parent/partner/child/other); onboarding relation step; home, quick log, sheet ("Prepared by a family caregiver (their son or daughter)") and agent context (`checkingFor`) use it. Demo father template seeds as caregiver for a parent.
- Cuts: onboarding language step and quick-form language picker removed (profiles English); `answers.start` refuses open questions (`OPEN_QUESTION_RE`); food-package photos return a can't-tell draft. No 90-day guide exists in the code.
- Seed: synthetic care-team answers get a `resultingChange`, a third of synthetic questions are "asked".
- Also fixed: `<figure>` inside `<p>` hydration warning on onboarding.
- Verified: tsc app + convex, eslint, vitest 23 passed / 1 skipped (new `impact.test.ts`), browser check at 320px of /impact, /sheet (toggle and form, restored after), onboarding relation step, answer page "Was this useful?", home.
- Not verified: a live agent run with the caregiver wording; prod deploy and re-seed.
