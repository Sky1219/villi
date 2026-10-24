---
quick_id: 261024-718
slug: judging-prep-fixes
date: 2026-10-24
---

# Judging-prep fixes from the judge-panel critique

1. DEMO.md: rebuild around pre-run answers (one live check), fix step 6 (laptop can't open the phone's answer), and correct claims (exact sentence, crush, community swap, "screened by Claude").
2. Safety lint: remove `why` claims that name another medicine on file (citation laundering); reviewer prompt checks that cited evidence states the claim.
3. Citations UI: guideline chunks shown as Villi's summary (no quote marks, "not yet clinician-checked"); README claims corrected.
4. Community integrity: seed swaps pass `checkSwap`; `swapsForItem` / `optionsFor` re-check with the viewer's anatomy; demo-data badge on community citation chips when synthetic rows were counted.
5. Moderation: broaden the stop/skip rule; care-team reports of stopping/starting a medicine stay private; extend the quantity regex (milligrams, number words, twice daily, every N hours).
6. Verify: tsc, vitest; commit.
