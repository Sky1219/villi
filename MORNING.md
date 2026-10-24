# Morning handoff (overnight run, 2026-10-24)

Started 05:52 PDT (H0). Updated after every task. Broken things first.

## Broken or not verified

- **No live check on dev.** This worktree has no `.env.local`, so the Convex CLI has no deployment (`npx convex codegen` and `npx convex run` both stop at "No CONVEX_DEPLOYMENT set"). Per the brief I did not copy secrets. Everything below is verified by tests, tsc, eslint and `next build` only. Run C1 yourself before the demo (see the commands at the end).
- `npm run build` needs `NEXT_PUBLIC_CONVEX_URL` at build time. I built with a placeholder URL (`https://placeholder-overnight.convex.cloud`); your `.env.local` / Vercel env covers this normally.

## Tasks

| Task | Commit | Status |
|---|---|---|
| A1 pill-flow bugs | ad83cc8 | Done, tests only (`convex/pillflow.test.ts`) |
| A2 red-team fixes | 17b8bd9 | Done, tests only (`convex/redteam.test.ts`, `convex/community.test.ts`) |
| A3 corpus source check | 771bc43 | Done; `convex/corpus.test.ts` |
| A4 cut features out of the agent | (next commit) | Done (code read + tsc/tests) |

## Decisions to check

**Corpus first (A3).** Every source exists; none was deleted. Three had wrong titles/authors and are corrected: Remane 2025 is *"Drug dissolution problems in ostomy patients: a chart review and patient interview analysis"* (Int J Colorectal Dis 40:113); Sood 2013 is *"Prescribing for a patient with reduced intestinal length"* (Aust Prescr 36:136-8); Hong 2021 is *"Changes of Drug Pharmacokinetics in Patients with Short Bowel Syndrome: A Systematic Review"* (46(4):465-478). I read the full text of AGA 2022 (via a copy at giboardreview.com, since the journal page 403s), PG #139, Parrish & DiBaise 2017, Remane, Sood and the UOAA article, and the PubMed abstract of Hong. 49/51 chunks are now `verified: true` (Claude-checked, not clinician) with a `section`.
- **Re-attributed (new ids, old ids deleted):** `pd-2017#sports-drinks` → `aga-sbs#fluids-sports-drinks` (the AGA update says it, Parrish & DiBaise doesn't mention sports drinks); `pd-2017#caffeine-alcohol` → `aga-sbs#fluids-hypotonic` (AGA lists water, tea, coffee, alcohol); `aga-sbs#diet-simple-sugars` → `pd-2017#simple-sugars` (Parrish Table 3; the AGA text doesn't say it). Old answers that cite a deleted id still show their stored evidence text but no source title.
- **Deleted, no source said it:** `pd-2017#thickening-foods`, `aga-sbs#fluids-sipping`, `pg139#pharmacist-review`, `sood-2013#ileostomy-dehydration`. The swaps check no longer uses "thickening food" as support.
- **Dehydration signs:** the AGA update has **no** list of warning signs (it says to measure daily urine output and monitor thirst). `aga-sbs#dehydration-signs` now says only that. The sign list (dark/less urine, thirst, dizziness on standing, output above intake…) comes from a new source, `uoaa-2025#dehydration-signs`: a UOAA patient-education article by a Jefferson hospital dietitian, **sponsored by Takeda**. B2's cards cite it. If you'd rather not cite sponsored content, swap in another source before the demo.
- **Crushing:** no source I read says crushing improves absorption or that crushing ER/EC "defeats the design". `pg139#crushing-immediate-release` now says only that a team may consider another formulation (e.g. crushed tablet, capsule, liquid) when a medicine isn't working; `sood-2013#ask-before-changing-form` says altering a solid form can change tolerability or efficacy, so ask the pharmacist.
- **PPIs:** new `pg139#ppi` (PPIs are the primary maintenance therapy for gastric hypersecretion; all oral PPIs are enteric-coated; IV trial if oral fails early) and `sood-2013#ppi` (often used with a short gut). `aga-sbs#acid-suppression` now quotes the 6-12 month hypersecretion and "sparingly beyond 12 months".
- **Other wording changes:** `aga-sbs#fluids-hypertonic` and `aga-sbs#fluids-ors` are scoped to short-bowel only (ileostomy dropped; the source is about SBS); "regardless of anatomy" gone. `pd-2017#ors-sodium` is 90-120 mmol/L, scoped to end-jejunostomy. `pd-2017#hypotonic-colon` scoped to colon-in-continuity (colostomy dropped). `aga-sbs#medications-proximal-absorption` no longer says "first part of the jejunum", scoped short-bowel; a new `sood-2013#absorption-site` (scope all) carries the same diagram. `hong-2021#absorption-findings` dropped the "single probability" gloss. New: `aga-sbs#diet-fat-jejunostomy`, `sood-2013#formulation`, `sood-2013#liquid-excipients`, `sood-2013#monitoring`, `hong-2021#colon-absorption` (a colon can contribute significantly to absorption of e.g. metoprolol).
- Several diagram labels were softened to what the cited text says (e.g. the ER diagram now reads "Guidance says to avoid sustained- and delayed-release forms after major resection").
- The two WHO chunks stay `verified: false`: the WHO page I opened shows the title and document number but not the composition table.
- Re-seeding re-embeds every changed chunk (content hash changed → embedding dropped → `embedMissing`); tested in `convex/corpus.test.ts`.

- A1: the no-concern repair prefixes "Nothing in the sources I checked raised a concern. " in English only. A dose question as a new check gets its own message ("Villi doesn't give doses or amounts…") instead of the generic one-item message. The label prefetch uses the canonical name plus any strength the user typed (strength only helps ranking; the cache key ignores it).

- A2 counts: `aggregates` counted **entries**. It now counts one pooled entry per profile and item, latest outcome wins (`applyPooledTransition` in `convex/community.ts`). Existing prod counters were built the old way; they are rebuilt correctly for synthetic rows on the next `seed:run` (it clears and re-inserts every synthetic log). Real rows on prod keep their old counts until you reseed; at hackathon scale real rows are your own test logs.
- A2 numerator: a `[C:n/total, anatomy]` claim is deleted unless n is one of that anatomy's retrieved counts (or the total), and every bare count number in the claim text also comes from that cell. Lengths ("100 cm"), percentages and mmol are ignored. Note: `[C:13/13, …]` itself is allowed by the brief's rule (n = total); the claim text's 5/5/3 must still match the cell.
- A2 new profiles: in its first 10 minutes a profile can share at most 3 note-free logs; later ones stay "Checking…" and a scheduled `moderation.recheckLog` re-runs moderation after the window. **Demo:** the laptop "second device" profile must be older than 10 minutes, or have fewer than 3 shared note-free logs, or the live count won't tick.
- A2 catalog: `canonicalize.run` no longer creates a pill that has no FDA label (returns `itemId: null`, path `unlisted`). Logs of such a name stay private ("could not identify the item"); the swaps form refuses it. **Prod cleanup:** the polluted item already on prod can be removed with `npx convex run --prod canonicalize:removeItem '{"canonicalName":"zorblatrin (immediate-release)"}'` (check the exact name in the dashboard first).
- A2 sports drinks: seeded and canonicalized as `isotonic` (+ `simpleSugar`, `lowSodium`); the canonicalizer prompt says so; `aga-sbs#fluids-hypertonic` lost its `sports-drink` tag and `pd-2017#sports-drinks` lost `hypertonic`. The swap check still treats any sugary drink as a conflict with `aga-sbs#fluids-hypertonic` ("a sugary drink").
- A2 swap source: a `community` swap with no retrieved swap group is relabeled `guideline` (and removed if it has no `[G:]` citation).

- A4: `browse_options` is gone from the agent's tools and from `convex/community.ts` (`optionsFor` was only its back-end). The open-question and multilingual paragraphs are gone from `AGENT_SYSTEM`; it now says "plain everyday English". The agent's dead open-question branch is removed (`answers.start` already refuses those). The caregiver wording, tone line and server-side refusals are unchanged.

## Couldn't do

## Morning commands, in order

1. Review and merge this branch.
2. `npm run deploy:convex`
3. `npx convex run --prod seed:run`
4. `npx convex env list --prod`: confirm `ANTHROPIC_API_KEY`, `OPENFDA_API_KEY`, `VOYAGE_API_KEY`.
5. Redeploy Vercel.
6. Real iPhone: bottle photo, blurry photo, "Can I crush it?" follow-up, care-team link opened on a second phone.
