# Phase 1: Foundation - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning

<domain>
## Phase Boundary

The app runs locally and on a real phone over HTTPS (Vercel + Convex prod), with the complete Convex schema, a cited guideline corpus (`data/guidelines.json`, 40+ chunks) that can be searched by vector and by full-text fallback, an idempotent synthetic community seed (`npm run seed`, under 60 s), the father and peer template profiles, and a usable profile without onboarding (quick dropdown form or `/demo?as=father|peer`). Requirements: FND-01 to FND-07, SAFE-07. No pill flow, no agent loop, no onboarding diagram (those are Phases 2 and 3).

</domain>

<decisions>
## Implementation Decisions

### Shell look and feel
- **D-01:** Warm and human tone: cream/off-white background, one warm accent (terracotta or coral), rounded cards. Not the generic white-and-teal health-app look.
- **D-02:** Follow the system light/dark setting (`prefers-color-scheme`), with color tokens defined for both themes from the start.
- **D-03:** Typeface is Atkinson Hyperlegible loaded via `next/font/google`, replacing the scaffold's Geist fonts in `src/app/layout.tsx`.
- **D-04:** Phone-first layout; the shell is designed at ~375 px width and centered on a laptop.

### Home screen and quick profile form
- **D-05:** A new visitor's home screen shows two large demo buttons first ("See it as my dad" -> `/demo?as=father`, a peer button -> `/demo?as=peer`), then the short quick profile form below them.
- **D-06:** The quick form has three inputs: role (patient / caregiver / clinician), anatomy, and language.
- **D-07:** Anatomy is one plain-language picker (e.g. "End-jejunostomy (no colon)", "Small bowel joined to colon", "Ileostomy", "Colostomy"), mapped in code to the three schema fields (`stomaType`, `colonInContinuity`, `bowelLengthBand`), plus an optional bowel-length dropdown that includes "I don't know" (-> `unknown`). Patients are never asked "colon in continuity" directly.
- **D-08:** The language dropdown offers English, Spanish, Hindi, Chinese (Simplified), Arabic, and Telugu now. Answers only get translated in Phase 7; Phase 1 just stores the choice.
- **D-09:** The profile stores only role, coarse anatomy, and language (SAFE-07): no name, no DOB, no free-text history field anywhere in the schema or form.

### Guideline corpus authoring
- **D-10:** The builder has no source PDFs. Claude writes the chunks from openly available full text and abstracts plus `.planning/research/` notes. Any chunk whose locator or wording could not be checked against an accessible source is marked in the JSON (e.g. a `verified: false` / note field), not silently presented as checked.
- **D-11:** Locators are section-level (e.g. `aga-sbs#medications`, `pg139#time-release`), not page-level. `[G:<chunkId>]` ids are the stable `sourceId#locator` strings.
- **D-12:** The builder will not hand-review the chunks ("trust it"). The guard is that every chunk applies the SUMMARY.md Part A corrections (Remane wording, anatomy-scoped hypotonic rule, IR-only crushing, both ORS formulas, corrected attributions). The planner should include a self-check task that compares each chunk against those corrections. A short chunk table (id, rule, source) is still shown at the checkpoint for transparency, but the builder doesn't have to approve it.
- **D-13:** Rule-level statements in our own words, at most one short quoted phrase per chunk, never full article text (from the brief).

### Deploy and accounts
- **D-14:** Phase 1 deploys to the Vercel `*.vercel.app` URL. The `villi.tech` custom domain is attached later (Phase 7).
- **D-15:** Ready now: Vercel account (it needs the repo files pushed before linking), openFDA API key, GitHub remote. Note: `git remote -v` shows no remote configured locally yet, so adding the remote and pushing is one of the builder's to-dos.
- **D-16:** Voyage: use the **free trial key with no card**, so rate limits will be low. Consequences for the plan: embed the corpus once at seed time in one batched request (with backoff/retry on 429); cache embeddings so re-running the seed doesn't re-embed unchanged chunks (e.g. a content hash, or precomputed vectors stored in `data/`); the full-text `searchIndex` fallback must kick in automatically on any Voyage error, including 429, and the trace logs which path ran. The demo has to work when Voyage is rate-limited.
- **D-17:** When a step needs the builder (Convex login, Vercel link, `npx convex env set` for dev and prod, Voyage/openFDA keys, GitHub push), keep building everything that doesn't need it and give the builder **one batched to-do list**, instead of stopping at each step. Seed and search must run without a Voyage key (embeddings left empty, full-text only).
- **D-18:** `DEMO_MODE` is on in production so judges can use `/demo?as=father|peer` on the public URL. Turn it off after the hackathon (note it in the README).

### Claude's Discretion
- **Father demo profile (the builder did not discuss it; use this default and confirm at the checkpoint):** based on the builder's father, who lost his entire large intestine and most of his small intestine. Anatomy: `stomaType: 'jejunostomy'`, `colonInContinuity: false`, `bowelLengthBand: '<100cm'`; role `caregiver`-viewed patient profile (anatomy only, no identity). Med list of five real drugs: one extended-release tablet (e.g. metoprolol succinate ER, which has a confirmed NDC `EXTENDED RELEASE` dosage form), one enteric-coated/delayed-release tablet (e.g. pantoprazole DR), one sorbitol-containing oral liquid (pick one whose openFDA `spl_product_data_elements` actually lists sorbitol), and two plain immediate-release items (e.g. loperamide 2 mg, plus one more IR tablet). The researcher should check every pick against openFDA before it is seeded.
- **Peer template profile:** Claude picks a contrasting anatomy (e.g. small bowel joined to colon, or ileostomy) so the community counts visibly differ between the two demos.
- Exact palette values, spacing, and component styling within D-01/D-02.
- Seed data shape and noise levels (within the brief's patterns, all `synthetic: true`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product rules, data model, corpus, seed
- `.planning/BRIEF.md` — authoritative: non-negotiable product rules, data model, guideline corpus sources, seed shape, milestones
- `.planning/research/SUMMARY.md` — Part A corrections are binding over the brief (clinical wording, attributions, openFDA fields, embeddings); "Phase M1" section lists the deliverables
- `.planning/REQUIREMENTS.md` — FND-01..07, SAFE-07
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria, checkpoint, spike list

### Stack and architecture
- `.claude/CLAUDE.md` — pinned versions (TS ~6.0.3, @types/node ^24), Voyage/openFDA/Convex decisions, what not to use
- `.planning/research/STACK.md` — stack detail and spikes
- `.planning/research/ARCHITECTURE.md` — identity (`anonId` bearer, `requireProfile`), public API boundary, schema state machine, `/demo` clone
- `.planning/research/PITFALLS.md` — pitfalls 1, 4, 5, 12, 17–20, 22 apply to this phase
- `convex/_generated/ai/guidelines.md` — Convex API rules; read before writing any `convex/` code (per `CLAUDE.md`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`: create-next-app scaffold (Tailwind v4 CSS-first, `prefers-color-scheme` block already present). Replace the Geist fonts and placeholder content; keep the token pattern in `globals.css`.
- `convex/`: only `README.md` and `_generated/` exist; no schema or functions yet. `.env.local` exists (a Convex dev deployment has likely been created).

### Established Patterns
- None yet in app code. Follow `.claude/CLAUDE.md` and the Convex skills.

### Integration Points
- `package.json` needs pins: `typescript@~6.0.3` (currently `^5`), `@types/node@^24` (currently `^20`), and react/react-dom 19.3.1 (currently 19.3.0). Add the `seed` script and the deps for Convex, zod, `@anthropic-ai/sdk`, `@convex-dev/action-retrier`, vitest, and convex-test.

</code_context>

<specifics>
## Specific Ideas

- The home screen's main button says "See it as my dad". The father story is the emotional anchor for the demo.
- The style should feel made by a family for families, not like a hospital portal.

</specifics>

<deferred>
## Deferred Ideas

- Attach the `villi.tech` custom domain (Phase 7).
- Turn off `DEMO_MODE` in prod after the hackathon.
- Upgrade Voyage to a carded account if the trial's rate limits hurt the live demo.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-10-23*
