---
quick_id: 261024-aqc
date: 2026-10-24
---

# Drug formulation table (`data/drugs.json`)

Precomputed, reviewed formulation facts for the ClinCalc top 300 (2024) so the pill flow is fast and does not depend on openFDA during the demo.

## Tasks

1. `scripts/build-drugs.ts` (`npm run build:drugs`)
   - Source list: ClinCalc Top 300 of 2024, cached to `data/top300.json`; demo-profile meds added if missing.
   - openFDA: NDC by `generic_name` (fallback `brand_name`), single-ingredient oral products only, grouped by dosage form; one label per distinct dosage form fetched by SPL id. Raw JSON cached in `data/labels_raw/` (gitignored).
   - Extraction: fast model, structured output; every field carries a <15-word quote + section. Code checks each quote is verbatim in the named section and nulls it otherwise.
   - Verification: second fast-model call per record; unsupported fields flip to null. All disagreements to `data/drugs_review.log`.
   - 20 spot-check records flagged `spotCheck: true` and listed in `data/drugs_spotcheck.md`.
2. `convex/lib/drugTable.ts`: pure lookup (exact generic, alias/brand, never across release form).
3. `fetch_label`: table first (exact, alias, then fuzzy via `canonicalize_item`), cache/live openFDA on a miss; `source` on `LabelResult`, shown in the trace.
4. Test: three demo items (metoprolol succinate ER, pantoprazole DR, Tylenol liquid) resolve from the table under 300 ms.
5. README "How Claude built this": record count + generation date.
