---
quick_id: 261024-718
status: complete
date: 2026-10-24
---

# Summary: judging-prep fixes

- DEMO.md rebuilt: one live check (typed metoprolol), everything else pre-run and opened from Recent checks; crush follow-up kept in a second tab; step 6 uses QuickLog on the laptop (which really is screened by Claude); corrected claims; unprompted limitation line; deploy + re-seed in setup.
- `lintAnswer` removes `why` claims naming another medicine on file and blocks verdict/swap/ask that do (`otherMedWords`, set in `agent.ts`). Extended quantity patterns (milligrams, spelled-out counts, twice a day, every N hours). `reviewDraft` no longer applies an edit the reviewer didn't approve. Reviewer prompt checks claim support against retrieved text and rejects claims about other products.
- `swapsForItem` re-runs `checkSwap` with the reader's anatomy. Seed swaps must pass `checkSwap`; the pantoprazole DR -> omeprazole DR swap was removed.
- `communitySynthetic` set by code from retrieved counts, attached to the final answer; `[C:]` chips show "demo data". Guideline citations render as "Villi's summary of this source, not yet checked by a clinician" without quote marks.
- Moderation: broader medicine word list (potassium, magnesium, supplements, ...); care-team reports of a clinician telling the author to stop/start/change a dose stay private.
- README claims corrected to match the code.
- Verified: `tsc` (convex + app) clean; vitest 18 passed, 1 skipped; citation display checked in the browser on an existing answer.
- Not verified: a fresh live agent run with the new lint and prompt; prod deploy and re-seed not run.
