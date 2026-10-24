---
quick_id: 261024-aqc
status: complete
date: 2026-10-24
---

# Summary: drug formulation table

- `npm run build:drugs` (`scripts/build-drugs.ts`) built `data/drugs.json`: 794 records (one per ingredients × NDC dosage form) from the ClinCalc Top 300 of 2024, 1,400 openFDA requests, `claude-haiku-5-5` for extraction and verification.
- Every non-null fact has a <15-word verbatim quote and section; code checks the quote and cross-checks the NDC dosage form and ingredient regex; a second Claude pass verifies. 413 lines in `data/drugs_review.log` (205 skips, 89 quote-check drops, 119 verifier drops). 20 spot-check records in `data/drugs_spotcheck.md`.
- `fetch_label` resolves from the table first (exact, alias, fuzzy via `canonicalize_item`), never across release forms or salts, then saved/live openFDA. `LabelResult.source` + `tableMatch` drive the trace line; the model gets `tableFacts`. `match_pill` passes `needFullText`.
- Tests: `convex/drugTable.test.ts` (evidence completeness, release-form and salt guards, three demo items from the table with no network in <300 ms). All 29 tests pass. Dev deployment: table hits run in 12–76 ms.
- README "How Claude built this" and DEMO.md updated.

Known limits: one label per dosage form, so a brand query can be answered from another manufacturer's label of the same form (shown in the trace). 59 list drugs skipped (non-oral, vitamins, co-packaged kits).
