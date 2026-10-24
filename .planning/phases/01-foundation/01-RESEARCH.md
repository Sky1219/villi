# Phase 1: Foundation - Research

**Researched:** 2026-10-24
**Domain:** Next.js 16 + Convex shell, complete Convex schema, hand-authored cited guideline corpus with Voyage embeddings and full-text fallback, idempotent synthetic seed, anonymous profile + `/demo` clone, Vercel + Convex prod deploy
**Confidence:** MEDIUM-HIGH (HIGH: scaffold state, Next/Convex/vitest behavior, openFDA picks, Convex limits, all spikes marked VERIFIED; MEDIUM: Voyage unpaid limits, AGA wording, Anthropic SDK in default runtime, TS 6 + `convex deploy` typecheck)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Shell look and feel**
- **D-01:** Warm and human tone: cream/off-white background, one warm accent (terracotta or coral), rounded cards. Not the generic white-and-teal health-app look.
- **D-02:** Follow the system light/dark setting (`prefers-color-scheme`), with color tokens defined for both themes from the start.
- **D-03:** Typeface is Atkinson Hyperlegible loaded via `next/font/google`, replacing the scaffold's Geist fonts in `src/app/layout.tsx`.
- **D-04:** Phone-first layout; the shell is designed at ~375 px width and centered on a laptop.

**Home screen and quick profile form**
- **D-05:** A new visitor's home screen shows two large demo buttons first ("See it as my dad" -> `/demo?as=father`, a peer button -> `/demo?as=peer`), then the short quick profile form below them.
- **D-06:** The quick form has three inputs: role (patient / caregiver / clinician), anatomy, and language.
- **D-07:** Anatomy is one plain-language picker (e.g. "End-jejunostomy (no colon)", "Small bowel joined to colon", "Ileostomy", "Colostomy"), mapped in code to the three schema fields (`stomaType`, `colonInContinuity`, `bowelLengthBand`), plus an optional bowel-length dropdown that includes "I don't know" (-> `unknown`). Patients are never asked "colon in continuity" directly.
- **D-08:** The language dropdown offers English, Spanish, Hindi, Chinese (Simplified), Arabic, and Telugu now. Answers only get translated in Phase 7; Phase 1 just stores the choice.
- **D-09:** The profile stores only role, coarse anatomy, and language (SAFE-07): no name, no DOB, no free-text history field anywhere in the schema or form.

**Guideline corpus authoring**
- **D-10:** The builder has no source PDFs. Claude writes the chunks from openly available full text and abstracts plus `.planning/research/` notes. Any chunk whose locator or wording could not be checked against an accessible source is marked in the JSON (e.g. a `verified: false` / note field), not silently presented as checked.
- **D-11:** Locators are section-level (e.g. `aga-sbs#medications`, `pg139#time-release`), not page-level. `[G:<chunkId>]` ids are the stable `sourceId#locator` strings.
- **D-12:** The builder will not hand-review the chunks ("trust it"). The guard is that every chunk applies the SUMMARY.md Part A corrections (Remane wording, anatomy-scoped hypotonic rule, IR-only crushing, both ORS formulas, corrected attributions). The planner should include a self-check task that compares each chunk against those corrections. A short chunk table (id, rule, source) is still shown at the checkpoint for transparency, but the builder doesn't have to approve it.
- **D-13:** Rule-level statements in our own words, at most one short quoted phrase per chunk, never full article text (from the brief).

**Deploy and accounts**
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

### Deferred Ideas (OUT OF SCOPE)
- Attach the `villi.tech` custom domain (Phase 7).
- Turn off `DEMO_MODE` in prod after the hackathon.
- Upgrade Voyage to a carded account if the trial's rate limits hurt the live demo.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | `npm run dev` gives a Next.js (App Router, TS, Tailwind) + Convex shell at phone width | Scaffold audit, pins, `cacheComponents` Suspense rule, Providers pattern, `dev` + `dev:convex` scripts |
| FND-02 | Complete Convex schema incl. `answer_reviews`, `fda_label_cache`, `aggregates`, `pooled: boolean \| null` | Full schema draft (Code Examples), index/vector/search definitions, convex-test schema checks |
| FND-03 | `data/guidelines.json` 40+ rule-level chunks, stable `sourceId#locator` ids, citation, `anatomyScope`, `appliesTo`, optional `diagram`, corrections applied | Corpus JSON shape, source bank with verification status, 60+ claim bank, corrections checklist, Zod validator test |
| FND-04 | Voyage 1024d embeddings in Convex vector index + automatic full-text fallback | Voyage endpoint/model facts, `embed:run` action, `guidelines.search` pattern, convex-test findings (vector mock quirk) |
| FND-05 | `npm run seed`: ~60 profiles, ~1,500 logs, ~40 swaps, ~30 care-team answers, ~20 questions, idempotent, <60 s, father profile + 5 meds | Seed strategy (upsert reference tables, replace-all synthetic, hash gate), distribution spec, verified father med list |
| FND-06 | Profile without onboarding via dropdown form or `/demo?as=father\|peer` | Anatomy mapping table, `profiles.create`, `demo.startAs`, anonId client pattern, Suspense for `useSearchParams` |
| FND-07 | Deployed to Vercel + Convex prod, phone over HTTPS, `.env.example`, no secrets committed | Vercel/Convex deploy recipe, builder to-do list, `.gitignore` `.env*` trap, secret-scan test |
| SAFE-07 | Profiles store only coarse anatomy, role, language | Strict enum-only profile validator, field allow-list test, create-mutation arg test |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Extracted from `./CLAUDE.md` and `./.claude/CLAUDE.md`. Treat as locked.

- Read `convex/_generated/ai/guidelines.md` before writing any `convex/` code (done for this research; executors must re-read). Key rules it sets: object-form functions with `args` validators on every function; `internal*` for private; `withIndex` not `filter`; no unbounded `.collect()` (use `.take()`/paginate); index names include all fields (`by_a_and_b`); read env through `env` from `./_generated/server` declared in `convex.config.ts`, **not** `process.env`; `ctx.vectorSearch` actions only, results are `{_id,_score}` and must be hydrated by one internal query; tests via `convex-test` + vitest + `@edge-runtime/vm`; no `Date.now()` in queries.
- `AGENTS.md` (written by `next dev`): "This is NOT the Next.js you know." Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. (Used here: Cache Components docs; confirmed by build experiment below.)
- Pinned stack: Node 24.x, Next 16.4.3, React 19.3.1, TypeScript `~6.0.3` (never 7.x), `@types/node@^24`, Tailwind 4.3.x, `convex` 1.48.x, `zod` 4.6.7, `@anthropic-ai/sdk` 1.3.0, `@convex-dev/action-retrier` 0.3.1, `vitest` 5.0.5, `convex-test` 0.0.65, `@edge-runtime/vm` 5.0.0.
- Do NOT use: `@convex-dev/agent|rag|workflow|aggregate`, Next API routes/server actions for Claude, local transformers.js embeddings, `html2pdf`, `openfda.dosage_form` as a label field, model-chosen `profileId`.
- No sampling params / prefill / forced `tool_choice` on Opus 5.5 (Phase 2+; keep out of any Phase 1 spike).
- Secrets only in Convex env (dev and prod). `.env.example` lists every key. Nothing secret committed.
- Convex fallback tripwire: if Convex still fights at 30 minutes, tell the builder before switching to SQLite + Prisma. (Convex is already provisioned and the CLI is logged in; tripwire is unlikely to fire.)
- Checkpoint: stop and show the builder after the phase; commit after the phase.
- Before using Edit/Write on repo files, work through a GSD command (executor runs under `/gsd-execute-phase`).

## Summary

Phase 1 is a data-contract phase with a thin UI. The scaffold already exists (Next 16.4.3, React 19.3.0, Tailwind 4.3.3 via `@tailwindcss/turbopack`, Convex 1.48.0 installed, `convex/_generated` in place with *permissive `any` types because no `schema.ts` exists yet*). Nothing is committed: `git status` shows the entire scaffold as untracked and there is no git remote. Four scaffold facts matter for planning: `next.config.ts` turns on `cacheComponents` and `partialPrefetching` (a client page using `useSearchParams` outside `<Suspense>` **fails `next build`**, verified by experiment); the build also **requires `NEXT_PUBLIC_CONVEX_URL`** at build time (verified); `.gitignore` contains `.env*`, which would silently ignore `.env.example`; and `package.json` still has TypeScript `^5`, `@types/node ^20`, React 19.3.0.

The riskiest work is not code but content: the 40+ chunk guideline corpus. I fetched the open sources this session and built a claim bank (below) with a per-source verification status. Open full text was readable for Practical Gastroenterology #138 and #139, the Parrish and DiBaise 2017 review (PMC), Sood, Tanner and Testro 2013, Remane et al. 2025, the BIFA/BAPEN 2025 ORS tip sheet, and abstracts for Hong 2021 and Azuz 2023. The AGA 2022 update is paywalled (403) and only reachable through Healio, the gastro.org topic list, and the slide-derived notes in PITFALLS.md, so all `aga-sbs#...` chunks must carry `verified: false`. One discovery changes locators: secondary sources disagree on AGA best-practice-advice numbering (gastro.org lists ORS as item 5 and Drug dosing as item 7; PITFALLS.md says 6 and 8), so use **topical locators** (`aga-sbs#drug-dosing`), never BPA numbers.

Voyage works as documented but unpaid-account limits are undocumented; both `api.voyageai.com` and `ai.mongodb.com` return 401 without a key (verified), so key type decides the host (make the base URL an optional env var). The architecture is therefore: `npm run seed` never calls Voyage (so it is fast, deterministic, key-free); a separate idempotent `npm run embed` action embeds only chunks whose content hash changed, in one batched request with backoff; `guidelines.search` tries Voyage once with a short timeout and falls back to the Convex search index on *any* failure or empty result. The father's five-drug med list was verified against live openFDA (below), and I found two traps: NDC `dosage_form:"TABLET"` is a **token match** (it matches `TABLET, FILM COATED, EXTENDED RELEASE`), and `convex-test`'s `vectorSearch` mock **throws if any scanned document lacks the vector field** (real Convex skips them).

**Primary recommendation:** Build a walking skeleton first (pins + initial commit + `convex.config.ts` + full `schema.ts` + Providers + one live query rendered in the shell + vitest harness), then run corpus authoring, seed, search, and profile/demo as parallel slices on top of that schema, and end with the deploy/checkpoint slice driven by one batched builder to-do list.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| App shell, home, profile summary, `/demo` redirect | Browser / Client (`"use client"` pages) | CDN / Static (Vercel serves prerendered shell) | All data is live Convex queries; no Next server logic or API routes |
| anonId generation + storage | Browser / Client (localStorage) | API / Backend (validates format, enforces uniqueness) | Bearer capability lives with the user; server never returns it |
| Profile create / `me` / demo clone | API / Backend (Convex public mutation/query) | Database | Server derives `anatomy` and `anatomyKey` from the picker id; client can never submit them |
| Anatomy mapping + `anatomyKey` derivation | Shared pure TS (`convex/lib/anatomy.ts`) | Browser (imports for labels) | One function, used by Convex and client, unit-tested |
| Guideline corpus content | Repo data (`data/guidelines.json`) | Database (`guideline_chunks`) | Source of truth is the reviewed JSON; DB is a derived, hash-synced copy |
| Embedding generation | API / Backend (`embed:run` internal action) | External (Voyage) | Needs secret; keeps `seed` key-free |
| Guideline search | API / Backend (internal action: Voyage -> vector -> hydrate; fallback text query) | Database (vector + search indexes) | `ctx.vectorSearch` is action-only; fallback is a reactive-capable query |
| Synthetic seed | API / Backend (internal action + batched internal mutations) | Database | Runs via CLI (`convex run`), never reachable from the browser |
| Counters (`aggregates`) | Database (written by seed, later by `applyPooledTransition`) | API / Backend | Phase 1 only needs the table + a rebuild-equals-recount invariant |
| Secrets / env | Convex deployment env (dev + prod) | Vercel env (`CONVEX_DEPLOY_KEY` only) | `NEXT_PUBLIC_CONVEX_URL` is the only value Next needs |
| Deploy | Vercel build runs `npx convex deploy --cmd 'npm run build'` | Convex cloud | Pushes functions and injects the prod URL at build time |

## Standard Stack

Versions below are the project pins from `.claude/CLAUDE.md`, re-checked against the npm registry this session (`npm view`).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.3 (installed) | App Router shell | Pinned; `cacheComponents` + `partialPrefetching` already on in `next.config.ts` [VERIFIED: next.config.ts:5-6, quoted: `cacheComponents: true,` / `partialPrefetching: true,`] |
| react / react-dom | 19.3.1 (npm latest; installed 19.3.0) | UI | Bump from 19.3.0: `package.json:14-15` currently `"react": "19.3.0"` |
| typescript | `~6.0.3` (npm has 6.0.2, 6.0.3) | Types | `package.json:25` currently `"typescript": "^5"`. Verified `tsc 6.0.3` typechecks the scaffold + providers file cleanly [VERIFIED: scratch tsc run] |
| @types/node | `^24` (24.19.2 latest 24.x) | Node types | `package.json:19` currently `"@types/node": "^20"`. Under TS 6, `convex/` gets **no** `process`/`Buffer` types (verified: TS2591) which is consistent with the guideline to read env via `env` from `_generated/server` |
| tailwindcss + @tailwindcss/turbopack | 4.3.3 | Styling | Scaffold uses the Turbopack loader rule, not `@tailwindcss/postcss` [VERIFIED: next.config.ts:7-14, package.json:18]; build compiled CSS fine in scratch |
| convex | 1.48.0 (installed) | Backend | Has typed app env: `defineApp({ env: {...} })` [VERIFIED: node_modules/convex/dist/esm-types/server/components/index.d.ts "A definition of environment variables for the app"] |
| zod | 4.6.7 | Corpus JSON validation, later Claude boundary | Phase 1 use: `tests/corpus.test.ts` schema; avoids hand-written validators |
| @convex-dev/action-retrier | 0.3.1 | Retries (Phase 2) | Install + mount now (3 lines in `convex.config.ts`), 20-minute cap, drop if it fights |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.5 | Test runner | Verified working with `test.projects` (see Validation Architecture) |
| convex-test | 0.0.65 | In-memory Convex | Schema, seed, search, demo-clone tests |
| @edge-runtime/vm | 5.0.0 | Convex-like test env | Required for `environment: "edge-runtime"` |
| @anthropic-ai/sdk | 1.3.0 | Phase 2; only the 15-minute runtime spike here | Install now only if the spike is run in Phase 1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Atkinson_Hyperlegible` (400/700) | `Atkinson_Hyperlegible_Next` (variable 200-800) | Both exist in `next/font/google` [VERIFIED: font-data.json]; D-03 names the classic family, use it. Both are Latin/Latin-ext only: Hindi, Arabic, Telugu, Chinese dropdown labels fall back to system fonts, so keep a system fallback stack |
| Precomputed vectors committed to `data/` | DB-as-cache via `contentHash` | Chosen: DB-as-cache + separate `embed` action (keeps the secret in Convex env per SC5). Committing vectors needs a local key |
| `tsx` for scripts | Convex actions run via `convex run` | Chosen: all scripts are Convex functions; no extra dev dependency |

**Installation (after one batched human-verify checkpoint, see audit):**
```bash
npm i convex@^1.48.0 zod@4.6.7 @convex-dev/action-retrier@0.3.1
npm i react@19.3.1 react-dom@19.3.1
npm i -D typescript@~6.0.3 @types/node@^24 vitest@5.0.5 convex-test@0.0.65 @edge-runtime/vm@5.0.0
# only if running the Anthropic runtime spike in Phase 1:
npm i @anthropic-ai/sdk@1.3.0
```

**Version verification:** `npm view` this session returned: zod 4.6.7, @anthropic-ai/sdk 1.3.0, vitest 5.0.5, convex-test 0.0.65, @edge-runtime/vm 5.0.0, @convex-dev/action-retrier 0.3.1, react 19.3.1, convex 1.48.0, typescript 6.0.3 (in the 6.0.x line) [VERIFIED: npm registry].

## Package Legitimacy Audit

Run: `gsd-tools query package-legitimacy check --ecosystem npm ...` (this session). The seam's only SUS reason is `too-new`, which is computed from the **latest version's publish date**, not package age. All SUS rows are long-established, high-download packages with official source repos and no `postinstall` scripts. Per protocol they are flagged; the planner should add **one batched** `checkpoint:human-verify` before the install task (show the table, confirm versions) instead of one per package.

| Package | Registry | Latest published | Weekly downloads | Source Repo | Verdict | Disposition |
|---------|----------|------------------|------------------|-------------|---------|-------------|
| @convex-dev/action-retrier | npm | 2026-06-25 | 167K | github.com/get-convex/action-retrier | OK | Approved |
| @edge-runtime/vm | npm | 2024-12-02 | 4.1M | (registry) | OK | Approved |
| typescript | npm | 2026-07-08 | 196M | microsoft/TypeScript | OK | Approved |
| zod | npm | 2026-10-12 | 221M | github.com/colinhacks/zod | SUS (too-new) | Flagged, batched checkpoint |
| vitest | npm | 2026-10-15 | 83M | github.com/vitest-dev/vitest | SUS (too-new) | Flagged, batched checkpoint |
| convex-test | npm | 2026-10-23 | 719K | github.com/convex/convex-test | SUS (too-new) | Flagged, batched checkpoint |
| @anthropic-ai/sdk | npm | 2026-10-23 (1.0.0 only on 2026-10-21) | 30M | github.com/anthropics/anthropic-sdk-typescript | SUS (too-new) | Flagged; only needed for the optional spike |
| @types/node | npm | 2026-10-09 | 296M | DefinitelyTyped | SUS (too-new) | Flagged, batched checkpoint |
| convex | npm | 2026-10-22 | 1.16M | get-convex/convex-js | SUS (too-new) | Already installed (1.48.0) |
| react | npm | 2026-10-14 | 124M | facebook/react | SUS (too-new) | Flagged, batched checkpoint |

**Packages removed due to SLOP verdict:** none.
**Packages flagged SUS:** zod, vitest, convex-test, @anthropic-ai/sdk, @types/node, convex, react (all `too-new` only). Fallback if the builder is uneasy: pin the prior patch (`zod@4.6.6`, `convex-test@0.0.64`).
**Provenance:** package names come from the project's own STACK research and official docs (docs.convex.dev/testing/convex-test names vitest, convex-test, @edge-runtime/vm) [CITED: docs.convex.dev/testing/convex-test]. `postinstall` was `null` in the seam output for every package checked.

## Architecture Patterns

### System Architecture Diagram

```
                     (builder / CLI only)                          (any visitor, phone or laptop)
  npm run seed ──► convex run seed:run                       Browser ── https://*.vercel.app
  npm run embed ─► convex run embed:run                         │  "use client" pages (home, /demo, profile)
        │                    │                                  │  useQuery / useMutation only
        ▼                    ▼                                  ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ Convex deployment (dev: .env.local, prod: Vercel build via convex deploy)     │
 │                                                                                │
 │  PUBLIC API (query/mutation)            INTERNAL (internal* only)              │
 │   profiles.create(anonId, picker)        seed.run (action) ─► internal muts:   │
 │   profiles.me(anonId) -> projection        clearSynthetic / upsertReference /  │
 │   demo.startAs(anonId, template)           insertBatch / writeAggregates       │
 │     └ gated by env.DEMO_MODE              embed.run (action) ─► Voyage ─► patch │
 │                                           guidelines.search (action)            │
 │                                             embed(query) ─► vectorSearch ─►    │
 │                                             hydrate ─► post-filter anatomy     │
 │                                             └─ on ANY error / 0 hits ─► text   │
 │                                                 searchIndex query (BM25)       │
 │                                           guidelines.smoke / seed.report        │
 └───────────────┬───────────────────────────────────────────────┬──────────────┘
                 ▼                                               ▼
   TABLES: profiles meds items log_entries swaps swap_votes care_team_answers
           questions guideline_chunks(vec+search) answers answer_reviews
           aggregates fda_label_cache seed_meta
                                                     External: Voyage api.voyageai.com (optional)
```

### Recommended Project Structure
```
villi/
├── convex/
│   ├── schema.ts                 # ALL tables; vector dims from lib/constants
│   ├── convex.config.ts          # defineApp({ env: {...optional...} }); app.use(actionRetrier)
│   ├── lib/                      # pure TS, no function exports
│   │   ├── constants.ts          # EMBED_DIM=1024, EMBED_MODEL, thresholds
│   │   ├── validators.ts         # shared v.* unions (role, anatomy, language, outcome...)
│   │   ├── anatomy.ts            # picker->anatomy map, deriveAnatomyKey, label (client imports too)
│   │   ├── embed.ts              # embed(texts, kind) -> number[][]; throws typed errors
│   │   └── prng.ts               # mulberry32 for deterministic seed data
│   ├── profiles.ts  demo.ts      # public API (create, me, startAs)
│   ├── guidelines.ts             # internal: search, hydrate, textSearch, smoke
│   ├── embed.ts                  # internal: run (embed missing/changed), setEmbeddings
│   ├── seed.ts  seed/*.ts        # internal: run + batch mutations (data builders in seed/)
│   ├── aggregates.ts             # internal: rebuild (pure recompute), verify
│   └── *.test.ts                 # convex-test (edge-runtime); skipped by the Convex bundler (multi-dot filenames)
├── data/guidelines.json          # authored corpus (sources[] + chunks[])
├── src/
│   ├── app/ layout.tsx providers.tsx page.tsx  demo/page.tsx  globals.css
│   ├── components/               # DemoButtons, QuickProfileForm, ProfileSummary
│   └── lib/anonId.ts             # secure-context-safe UUID + localStorage + useSyncExternalStore
├── tests/                        # node project: corpus.test.ts, env.test.ts
├── vitest.config.mts  .env.example
└── package.json                  # scripts below
```
[VERIFIED: convex CLI entry-point rules, node_modules/convex/dist/esm/bundler/index.js: files whose basename has more than one dot are skipped, so `*.test.ts` inside `convex/` is never deployed; every other `.ts` under `convex/` (including `lib/`) is bundled as a module.]

### Pattern 1: Walking skeleton first (MVP mode)
**What:** One thin vertical slice that touches every layer before any slice goes deep: pins + initial commit -> `convex.config.ts` + full `schema.ts` -> `ConvexProvider` -> one public query (`profiles.me` or a `meta.ping`) rendered in a phone-width shell -> vitest harness green -> `npm run build` green. Everything else (corpus, seed, search, profile UI, deploy) layers on this.
**When to use:** Always for this phase; it proves the Convex wiring early and makes the Vercel "hello, phone" smoke possible as soon as the builder does their to-do.

### Pattern 2: Reference tables upsert, community tables replace-all (seed idempotency)
**What:** Split the seed by whether other rows can reference the data.
- **Upsert by stable key (never delete):** `items` (by `slug`), `guideline_chunks` (by `chunkId`, content-hash gated), template profiles + their meds (by `templateKey`). Real logs and clones reference these.
- **Replace-all-synthetic, hash-gated:** synthetic profiles, `log_entries`, `swaps`, `care_team_answers`, `questions`, and the `synthetic` bucket of `aggregates`. Computed from a deterministic PRNG (`mulberry32`, fixed seed constant). A `seed_meta` row stores `{ key: "synthetic", hash }` of (generator version + counts); if the hash matches and counts are present, `seed:run` is a no-op.
- All seeded community rows are written `pooled: true, synthetic: true` directly (no LLM moderation; documented in code and README).
**Why:** satisfies "re-run without duplicating rows" and stays safe for real data in prod (only `synthetic: true` rows are ever deleted; real-bucket counters are untouched).
**Orchestration:** `seed:run` is an `internalAction` (so it can loop) calling batched `internalMutation`s of ~200-300 rows (well under the 16k-write limit [CITED: .claude/CLAUDE.md "Limits to design around"]). Expect well under 60 s; this is an estimate to measure, not a fact [ASSUMED].

### Pattern 3: Embeddings are a separate, idempotent step
**What:** `seed` inserts/updates chunk rows with `contentHash` and **no** embedding. `embed:run` (internalAction) loads chunks (and items) where `embedding` is missing or `embeddingHash !== contentHash`, calls Voyage in one batched request (`input_type: "document"`, `output_dimension: 1024`, model `voyage-4-lite`), asserts each vector length equals `EMBED_DIM`, and patches rows. Retry with exponential backoff on 429/5xx (this step is allowed to be slow; it is not part of the 60 s seed budget).
**Why:** seed works with no key (D-17); re-runs never re-embed unchanged text (D-16); prod gets its own one-time embed using the prod Voyage key from Convex env.

### Pattern 4: Search tries vector once, then degrades silently
**What:** `guidelines.search` (internalAction): (1) if no `VOYAGE_API_KEY` -> text path; (2) `embed([query],"query")` with ~3 s timeout and **no retries**; (3) `ctx.vectorSearch("guideline_chunks","by_embedding",{vector,limit:50})`; (4) hydrate via one `internalQuery`, post-filter `anatomyScope` (`all` or the user's `anatomyKey`; `unknown` key = no filtering, cautious), take top 6; (5) on any thrown error **or zero hits** -> `internalQuery` using the search index on `searchText`. Return `{ path: "vector" | "text", results }` so the trace can say which path ran.
**Why:** unpaid Voyage limits are unknown; the demo must survive 429 [VERIFIED: D-16]. Convex text search is BM25-ranked, partial-match, no stemming, no typo tolerance, last term prefix-matched [CITED: docs.convex.dev/search/text-search], so build `searchText` = title + text + tags + synonym tokens (`slow-release`, `sustained-release`, `modified-release`, `time-release`, `enteric coated`, `delayed release`).

### Pattern 5: Anonymous identity, server-derived anatomy
**What:** Client generates the anonId once and stores it in localStorage; every profile function takes it; no function ever returns it. The create mutation accepts only `{ role, anatomyChoice, bowelLength?, language, anonId }` and derives `anatomy` + `anatomyKey` with the shared pure function. `demo.startAs({ template, anonId })` is gated by `env.DEMO_MODE === "true"`, copies the template profile and its meds into a new non-synthetic profile, sets `clonedFrom`, and is idempotent when the caller's existing profile already has the same `clonedFrom`.
**Gotchas (verified/known):**
- `crypto.randomUUID()` exists only in secure contexts; plain-HTTP LAN testing would crash. Use `crypto.getRandomValues` to build a v4 UUID [ASSUMED: general platform behavior, low risk].
- localStorage can throw (Safari private mode): wrap in try/catch with in-memory fallback.
- Read it with `useSyncExternalStore` (server snapshot `undefined`), pass `"skip"` to `useQuery` until defined.

### Pattern 6: `useSearchParams` only inside `<Suspense>` (Next 16 Cache Components)
**What:** `/demo?as=father` page = a small client `Inner` using `useSearchParams` wrapped by `<Suspense fallback=...>` in the page default export.
**Evidence:** with `cacheComponents: true`, a page calling `useSearchParams()` outside Suspense failed `next build`: `Route "/demo": Next.js encountered URL data useSearchParams() in a Client Component outside of <Suspense>` (digest `CLIENT_HOOK_DYNAMIC`); the Suspense variant built and prerendered as static [VERIFIED: scratch build, Next 16.4.3 Turbopack].

### Anti-Patterns to Avoid
- **Calling Voyage inside `seed:run`:** breaks key-free seeding and the 60 s budget.
- **Using `ctx.db.query(...).collect().length` for counts** (guidelines.md forbids it); use bounded `.take()` in diagnostics or the dashboard.
- **Letting the client send `anatomy`, `anatomyKey`, `synthetic`, `pooled`, or `profileId`.** Strict validators reject unknown args; the schema lets only the server set them.
- **Exporting `seed`/`embed`/`guidelines` as public functions.** They must be `internal*`; the browser must not be able to run them.
- **BPA-number locators** (`aga-sbs#bpa-8`): secondary sources disagree on numbering (see corpus).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema checks for the corpus | Ad-hoc `if` checks in a script | `zod` schema + vitest | Also gives the D-12 self-check as repeatable assertions |
| Test DB / scheduler | A fake Convex | `convex-test` | Verified: handles vector + text search, schema validators |
| Env typing | `process.env.X!` in Convex files | `defineApp({env})` + `env` from `_generated/server` | Required by guidelines.md; `process` is not even typed under TS 6 in `convex/` |
| Dedup/idempotency | Custom "already seeded?" heuristics | `seed_meta.hash` gate + upsert-by-key | One place decides; testable by running twice |
| UUIDs | Math.random strings | `crypto.getRandomValues` v4 builder | Bearer credential needs real entropy |
| Fonts | Self-hosted font files | `next/font/google` `Atkinson_Hyperlegible` | Per D-03; handles preload/CLS |
| Full-text ranking | Own TF-IDF | Convex `searchIndex` | Built in, BM25 [CITED: docs.convex.dev/search/text-search] |
| Deploy glue | Custom build scripts | `npx convex deploy --cmd 'npm run build'` | Official; injects the URL env var [CITED: docs.convex.dev/production/hosting/vercel] |

**Key insight:** every "clever" shortcut in this phase (seeding via client, embedding at seed time, trusting client-sent anatomy) removes a safety property later phases rely on. Keep the boring split: pure libs, internal functions, a tiny public surface.

## Common Pitfalls

### Pitfall 1: `.gitignore` swallows `.env.example`
**What goes wrong:** `.gitignore:34` is `.env*` [VERIFIED: .gitignore:33-34, quoted: `# env files (can opt-in for committing if needed)` / `.env*`]. A new `.env.example` is ignored, so SC5 ("`.env.example` lists every key") silently fails.
**How to avoid:** add `!.env.example` after `.env*`; add a test that `git ls-files .env.example` returns it and `git ls-files` returns no `.env.local`.
**Warning signs:** `git status` does not list `.env.example` after creating it.

### Pitfall 2: Build fails without `NEXT_PUBLIC_CONVEX_URL`
**What goes wrong:** `new ConvexReactClient(undefined)` throws "No address provided to ConvexReactClient" during prerender, so `npm run build` fails in CI or a fresh clone [VERIFIED: scratch build].
**How to avoid:** local builds rely on `.env.local`; on Vercel the URL is injected by `npx convex deploy --cmd 'npm run build'`. Never set the Vercel build command to plain `npm run build`. Document in README/to-do.

### Pitfall 3: `useSearchParams` outside Suspense breaks the build
See Pattern 6. Also applies to anything else dynamic you add to the shell (e.g., `cookies()`); the shell must stay static + client hooks inside Suspense.

### Pitfall 4: Required Convex env vars break deploy
**What goes wrong:** `defineApp({ env: { VOYAGE_API_KEY: v.string() } })` makes the key mandatory for every deployment; deploy fails where it is unset, contradicting D-17.
**How to avoid:** declare every var `v.optional(v.string())`; code handles `undefined` (text path, DEMO off). Typed-env validators must be string-like [VERIFIED: components/index.d.ts, `StringLikeValidator`].

### Pitfall 5: `convex-test` `vectorSearch` crashes on docs without a vector
**What goes wrong:** with a mix of embedded and un-embedded chunks, the mock throws `Cannot read properties of undefined (reading '0')` (real Convex skips such docs) [VERIFIED: scratch test; mock source `cosineSimilarity(vector, doc[vectorField])` in convex-test/dist/index.js]. A `try/catch` fallback hides it and makes the vector-path test pass vacuously on the text path.
**How to avoid:** in the "vector path" test, give **every** chunk an embedding (small dims in a test-only schema is not possible; use real 1024-length arrays built with a tiny helper). Assert `path === "vector"` explicitly. A separate test inserts un-embedded rows and asserts the text fallback.

### Pitfall 6: NDC `dosage_form` query is a token match
**What goes wrong:** `ndc.json?search=generic_name:"metoprolol succinate"+AND+dosage_form:"TABLET"` returned 254 records, i.e. it matches `TABLET, FILM COATED, EXTENDED RELEASE` [VERIFIED: live openFDA]. Filtering by query alone can mislabel ER as plain tablet.
**How to avoid (Phase 2 hand-off):** fetch candidates then string-test the returned `dosage_form` in code. In Phase 1 the seed hard-codes each med's verified `dosageForm`.

### Pitfall 7: Hypotonic rule over-warns colon-in-continuity users
Sources: PG138 and Parrish/DiBaise say most patients with a colon tolerate hypotonic fluids; BIFA covers *high-output small-bowel stoma*. The rule chunk must carry `anatomyScope: ["end-jejunostomy","ileostomy"]` (never `all`), and a counterpart chunk states the colon-in-continuity tolerance. Test it.

### Pitfall 8: Remane misstatement
The brief's "whole tablet in the pouch indicates impaired absorption" is wrong. The paper says presence of a drug in the bag does not necessarily indicate a change in efficacy; it is a 50-interview pilot with internal count inconsistencies (10/50 vs 11/50). Test that no chunk contains "indicates impaired absorption".

### Pitfall 9: Synthetic text that breaks Villi's own rules
Seeded swaps and care-team answers are shown to users in later phases. A swap that recommends a soda or a care-team answer that says "stop taking X" would contradict rules 1 and 2. Test: no seeded swap `useItem` is hypertonic or a sugar-alcohol item; no seeded text matches `\b(stop|start|skip|crush|split|double)\b.*\b(your|the)\s+(med|pill|dose)` or a dose pattern `\d+\s?(mg|mcg|g|ml|mL|tablets?)` (allow-list product identity in item names only).

### Pitfall 10: Demo live-update needs the same stratum
The brief's "log hurt from a second device, counts update live on the first" only moves the first device's *matching-anatomy* count if both devices share an `anatomyKey`. A contrasting peer (per CONTEXT) logs into a different stratum. `demo.startAs` creates a fresh clone per call, so the live-update demo can run `?as=father` on both devices. Flag for Phase 4.

### Pitfall 11: TS 6 and `convex deploy` typecheck (untested)
`convex deploy` typechecks with the project's TypeScript. 6.0.3 typechecks the scaffold and the Convex tsconfig in isolation [VERIFIED: scratch tsc], but the full `convex deploy` path has not been run here [ASSUMED]. If it fails on Vercel, `--typecheck=disable` is the escape hatch while keeping `npm run typecheck` as the real gate.

### Pitfall 12: Windows shell quoting for `convex run`
JSON args on PowerShell are painful. Give every diagnostic a **no-arg** entry point (`seed:run`, `embed:run`, `guidelines:smoke`, `seed:report`) and call them from npm scripts.

## Code Examples

### Package scripts (Windows-safe, no JSON args)
```jsonc
// package.json "scripts" (additions; existing: dev, build, start, lint)
"dev:convex": "convex dev",
"typecheck": "tsc --noEmit && tsc --noEmit -p convex",
"test": "vitest",
"test:once": "vitest run",
"seed": "convex run seed:run",
"seed:prod": "convex run --prod seed:run",
"embed": "convex run embed:run",
"embed:prod": "convex run --prod embed:run",
"smoke:search": "convex run guidelines:smoke"
// plus "engines": { "node": "24.x" }  (Vercel: major-only range; exact patch versions fail)
```
[CITED: `npx convex run --help` locally: supports `--prod`, `--push`; Vercel Node docs: `engines.node: "24.x"`]

### `convex/convex.config.ts`
```ts
import { defineApp } from "convex/server";
import { v } from "convex/values";
import actionRetrier from "@convex-dev/action-retrier/convex.config";

// All optional so a missing key never blocks a deploy (D-17).
const app = defineApp({
  env: {
    ANTHROPIC_API_KEY: v.optional(v.string()),
    ANTHROPIC_MODEL_MAIN: v.optional(v.string()),
    ANTHROPIC_MODEL_FAST: v.optional(v.string()),
    VOYAGE_API_KEY: v.optional(v.string()),
    VOYAGE_BASE_URL: v.optional(v.string()),
    OPENFDA_API_KEY: v.optional(v.string()),
    DEMO_MODE: v.optional(v.string()),
  },
});
app.use(actionRetrier);
export default app;
// usage: import { env } from "./_generated/server";  env.DEMO_MODE === "true"
```
[Pattern per guidelines.md "Mounting a component" and "typed app environment variables"; `env` export is `process.env` at runtime: `_generated/server.js:101` `export const env = process.env;`]

### Schema draft (complete; Phase 2+ add only optional fields)
```ts
// convex/lib/validators.ts
import { v } from "convex/values";
export const roleV = v.union(v.literal("patient"), v.literal("caregiver"), v.literal("clinician"));
export const stomaTypeV = v.union(v.literal("none"), v.literal("ileostomy"), v.literal("colostomy"), v.literal("jejunostomy"));
export const bowelLengthBandV = v.union(v.literal("unknown"), v.literal("<100cm"), v.literal("100-200cm"), v.literal(">200cm"));
export const anatomyV = v.object({ colonInContinuity: v.boolean(), stomaType: stomaTypeV, bowelLengthBand: bowelLengthBandV });
export const anatomyKeyV = v.union(v.literal("end-jejunostomy"), v.literal("ileostomy"), v.literal("colostomy"), v.literal("colon-in-continuity"), v.literal("unknown"));
export const languageV = v.union(v.literal("en"), v.literal("es"), v.literal("hi"), v.literal("zh-Hans"), v.literal("ar"), v.literal("te"));
export const outcomeV = v.union(v.literal("helped"), v.literal("neutral"), v.literal("hurt"));
export const pooledV = v.union(v.boolean(), v.null());       // null = pending moderation
export const categoryV = v.union(v.literal("pill"), v.literal("drink"), v.literal("food"), v.literal("action"));
export const releaseFormV = v.union(v.literal("immediate-release"), v.literal("extended-release"), v.literal("delayed-release"), v.literal("unknown"));
export const profTypeV = v.union(v.literal("pharmacist"), v.literal("dietitian"), v.literal("doctor"), v.literal("nurse"));
export const countsV = v.object({ helped: v.number(), neutral: v.number(), hurt: v.number() });
```
```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { EMBED_DIM } from "./lib/constants";
import * as V from "./lib/validators";

export default defineSchema({
  // SAFE-07: enum/boolean/number fields only. No name, DOB, or free-text anywhere on this table.
  profiles: defineTable({
    anonId: v.string(),
    role: V.roleV, anatomy: V.anatomyV, anatomyKey: V.anatomyKeyV, language: V.languageV,
    clinicianDemoVerified: v.boolean(),
    synthetic: v.boolean(),
    templateKey: v.optional(v.union(v.literal("father"), v.literal("peer"))), // seeded templates
    clonedFrom: v.optional(v.union(v.literal("father"), v.literal("peer"))),
    seedKey: v.optional(v.string()),
  }).index("by_anonId", ["anonId"]).index("by_templateKey", ["templateKey"]).index("by_synthetic", ["synthetic"]),

  meds: defineTable({
    profileId: v.id("profiles"), name: v.string(), genericName: v.optional(v.string()),
    strength: v.optional(v.string()), dosageForm: v.optional(v.string()), releaseForm: V.releaseFormV,
    imprint: v.optional(v.string()), color: v.optional(v.string()), shape: v.optional(v.string()),
    labelCacheId: v.optional(v.id("fda_label_cache")), addedAt: v.number(),
  }).index("by_profileId", ["profileId"]),

  items: defineTable({
    slug: v.string(), canonicalName: v.string(), category: V.categoryV,
    releaseForm: v.optional(V.releaseFormV),            // pills: part of identity (never merge across)
    attributes: v.optional(v.any()), aliases: v.array(v.string()),
    embedding: v.optional(v.array(v.float64())), embeddingHash: v.optional(v.string()),
  }).index("by_slug", ["slug"])
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: EMBED_DIM, filterFields: ["category"] }),

  log_entries: defineTable({
    profileId: v.id("profiles"), anatomySnapshot: V.anatomyV, anatomyKey: V.anatomyKeyV,
    itemId: v.id("items"), outcome: V.outcomeV, note: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),        // author-only, never pooled
    pooled: V.pooledV, moderationReason: v.optional(v.string()),
    synthetic: v.boolean(), createdAt: v.number(),
  }).index("by_profileId_and_createdAt", ["profileId", "createdAt"])
    .index("by_pooled_and_createdAt", ["pooled", "createdAt"])
    .index("by_itemId_and_pooled", ["itemId", "pooled"])
    .index("by_synthetic", ["synthetic"]),

  swaps: defineTable({
    profileId: v.id("profiles"), anatomySnapshot: V.anatomyV, anatomyKey: V.anatomyKeyV,
    insteadOfItemId: v.id("items"), useItemId: v.id("items"), note: v.string(),
    pooled: V.pooledV, moderationReason: v.optional(v.string()),
    guidelineCheck: v.object({ passed: v.boolean(), citations: v.array(v.string()) }),
    upvotes: v.number(), clinicianEndorsements: v.array(v.id("profiles")),
    synthetic: v.boolean(), createdAt: v.number(),
  }).index("by_pooled_and_anatomyKey", ["pooled", "anatomyKey"]).index("by_synthetic", ["synthetic"]),

  swap_votes: defineTable({ swapId: v.id("swaps"), profileId: v.id("profiles") })
    .index("by_swapId_and_profileId", ["swapId", "profileId"]),

  care_team_answers: defineTable({
    profileId: v.id("profiles"), anatomySnapshot: V.anatomyV, anatomyKey: V.anatomyKeyV,
    questionId: v.optional(v.id("questions")), questionText: v.string(),
    professionalType: V.profTypeV, answerText: v.string(),
    pooled: V.pooledV, moderationReason: v.optional(v.string()),
    clinicianEndorsements: v.array(v.id("profiles")), synthetic: v.boolean(), createdAt: v.number(),
  }).index("by_pooled_and_anatomyKey", ["pooled", "anatomyKey"]).index("by_synthetic", ["synthetic"]),

  questions: defineTable({
    profileId: v.id("profiles"), text: v.string(), context: v.optional(v.any()), resolved: v.boolean(),
    pooled: V.pooledV, moderationReason: v.optional(v.string()), synthetic: v.boolean(), createdAt: v.number(),
  }).index("by_profileId", ["profileId"]).index("by_synthetic", ["synthetic"]),

  guideline_chunks: defineTable({
    chunkId: v.string(),                                  // "sourceId#locator" -- the citation id
    sourceId: v.string(), sourceTitle: v.string(), sourceUrl: v.string(), citation: v.string(),
    locator: v.string(), text: v.string(), searchText: v.string(),
    tags: v.array(v.string()), anatomyScope: v.array(v.string()), appliesTo: v.array(v.string()),
    diagram: v.optional(v.object({ segmentIds: v.union(v.array(v.string()), v.literal("user-removed")), mode: v.string(), label: v.string() })),
    verified: v.boolean(), verifyNote: v.optional(v.string()),
    contentHash: v.string(), embedding: v.optional(v.array(v.float64())), embeddingHash: v.optional(v.string()),
  }).index("by_chunkId", ["chunkId"]).index("by_sourceId", ["sourceId"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["sourceId"] })
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: EMBED_DIM, filterFields: ["sourceId"] }),

  answers: defineTable({                                   // Phase 2 state machine; shape additive-only after this
    profileId: v.id("profiles"), kind: v.union(v.literal("scan"), v.literal("followup")),
    parentId: v.optional(v.id("answers")),
    status: v.union(v.literal("queued"), v.literal("agent_running"), v.literal("drafted"), v.literal("reviewing"), v.literal("final"), v.literal("blocked"), v.literal("failed")),
    attempt: v.number(), input: v.any(), toolTrace: v.array(v.any()), final: v.optional(v.any()),
  }).index("by_profileId", ["profileId"]).index("by_status", ["status"]),

  answer_reviews: defineTable({                            // hidden: no public function reads this
    answerId: v.id("answers"), draft: v.any(), lint: v.optional(v.any()), reviewerDecision: v.optional(v.any()),
  }).index("by_answerId", ["answerId"]),

  aggregates: defineTable({
    itemId: v.id("items"), anatomyKey: V.anatomyKeyV, real: V.countsV, synthetic: V.countsV,
  }).index("by_itemId_and_anatomyKey", ["itemId", "anatomyKey"]),

  fda_label_cache: defineTable({
    queryKey: v.string(), found: v.boolean(), setId: v.optional(v.string()), effectiveTime: v.optional(v.string()),
    manufacturer: v.optional(v.string()), productNdc: v.optional(v.string()),
    dosageForms: v.array(v.string()), sections: v.record(v.string(), v.string()),   // each capped ~6-8k chars
    fetchedAt: v.number(),
  }).index("by_queryKey", ["queryKey"]).index("by_setId", ["setId"]),

  seed_meta: defineTable({ key: v.string(), hash: v.string(), counts: v.any(), seededAt: v.number() })
    .index("by_key", ["key"]),
});
```
[Index/field conventions per guidelines.md "Schema guidelines"; vector/search definitions per docs.convex.dev; scratch test confirmed `schema.tables.profiles.validator.fields` is inspectable for the SAFE-07 allow-list test.]

### Anatomy mapping (shared, pure; the only place D-07 lives)
```ts
// convex/lib/anatomy.ts
export type AnatomyChoice = "end-jejunostomy" | "colon-joined" | "ileostomy" | "colostomy";
export const ANATOMY_CHOICES: { id: AnatomyChoice; label: string }[] = [
  { id: "end-jejunostomy", label: "End-jejunostomy (no colon)" },
  { id: "colon-joined",    label: "Small bowel joined to colon" },
  { id: "ileostomy",       label: "Ileostomy" },
  { id: "colostomy",       label: "Colostomy" },
];
// colostomy = part of the colon remains: colonInContinuity true (stoma on colon).
export function anatomyFromChoice(c: AnatomyChoice, band: BowelLengthBand = "unknown"): Anatomy {
  switch (c) {
    case "end-jejunostomy": return { stomaType: "jejunostomy", colonInContinuity: false, bowelLengthBand: band };
    case "colon-joined":    return { stomaType: "none",        colonInContinuity: true,  bowelLengthBand: band };
    case "ileostomy":       return { stomaType: "ileostomy",   colonInContinuity: false, bowelLengthBand: band };
    case "colostomy":       return { stomaType: "colostomy",   colonInContinuity: true,  bowelLengthBand: band };
  }
}
// Stratification key. Coarse on purpose (small n). Never keyed on band. Contradictory/unknown -> "unknown" (callers fail CAUTIOUS = no scope filtering).
export function deriveAnatomyKey(a: Anatomy): AnatomyKey {
  if (a.stomaType === "jejunostomy") return "end-jejunostomy";
  if (a.stomaType === "ileostomy")   return "ileostomy";
  if (a.stomaType === "colostomy")   return "colostomy";
  return a.colonInContinuity ? "colon-in-continuity" : "unknown";   // no stoma and no colon is contradictory
}
```
The vocabulary `anatomyScope` uses in the corpus is exactly: `all | end-jejunostomy | ileostomy | colostomy | colon-in-continuity`. Note: the three profile fields cannot distinguish AGA's jejuno-colic from jejuno-ileo-colic (no ileum info), hence the single `colon-in-continuity` key.

### Voyage call (plain fetch; same function for seed-time and query-time)
```ts
// convex/lib/embed.ts  (default runtime; fetch is available)
export async function embed(texts: string[], kind: "document" | "query", opts: { apiKey?: string; baseUrl?: string; timeoutMs?: number } = {}) {
  if (!opts.apiKey) throw new EmbedError("no-key");
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 3000);
  try {
    const res = await fetch(`${opts.baseUrl ?? "https://api.voyageai.com/v1"}/embeddings`, {
      method: "POST", signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model: "voyage-4-lite", input: texts, input_type: kind, output_dimension: 1024 }),
    });
    if (!res.ok) throw new EmbedError(res.status === 429 ? "rate-limited" : "http-" + res.status);
    const json = await res.json() as { data: { index: number; embedding: number[] }[] };
    const out = json.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
    if (out.some(v => v.length !== 1024)) throw new EmbedError("bad-dim");
    return out;
  } finally { clearTimeout(t); }
}
```
[Endpoint, body fields, `input_type`, `output_dimension`, 1000-item batch limit: CITED docs.voyageai.com/docs/embeddings. Response field names `data[].embedding/index` follow Voyage's API reference but were not shown on the fetched page: MEDIUM. Both hosts answered 401 without a key (VERIFIED), so the base URL is configurable.]

### Home/profile skeleton (Suspense + secure-context-safe anonId)
```tsx
// src/app/demo/page.tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
function Inner() { const as = useSearchParams().get("as"); /* validate "father"|"peer"; call demo.startAs; redirect to "/" */ return null; }
export default function DemoPage() { return <Suspense fallback={<p>Loading</p>}><Inner /></Suspense>; }
```
Layout font swap (D-03): `import { Atkinson_Hyperlegible } from "next/font/google"; const atk = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400","700"] });` [VERIFIED: builds under Turbopack in scratch; font names VERIFIED in next font-data.json]. In `globals.css` map `--font-sans: var(--font-atkinson), system-ui, sans-serif;` and keep the scaffold's `:root` + `@media (prefers-color-scheme: dark)` token pattern.

### Palette candidates (D-01/D-02), contrast computed this session
| Token | Light | Dark | Check |
|-------|-------|------|-------|
| background | `#FBF6EE` | `#1C1612` | ink on bg 14.64 / 15.15 |
| card | `#FFFFFF` | `#2A221B` | ink on card 15.75 / 13.23 |
| ink | `#2B2118` | `#F3EBE0` | - |
| muted text | `#6B5B4E` | `#B9AA9A` | on bg 6.04 / 7.91 (AA) |
| accent (terracotta / coral) | `#B5472B` | `#E58A66` | white on accent btn 5.38; dark ink on coral btn 6.96; accent text on bg 5.00 / 6.96 |
| accent-soft + accent-dark text | `#F6E3D8` / `#8A3A22` | - | 6.24 |
All pairs meet WCAG AA 4.5:1 [VERIFIED: computed with the WCAG luminance formula in scratch].

## Verified Father Med List (openFDA, live, 2026-10-24)

| # | Item (seed name) | Role in demo | NDC `dosage_form` (verified) | Label evidence (verified) |
|---|------------------|--------------|------------------------------|---------------------------|
| 1 | Metoprolol succinate ER 50 mg tablet (generic; brand Toprol-XL) | ER | `TABLET, FILM COATED, EXTENDED RELEASE` (39 recs) and `TABLET, EXTENDED RELEASE` (43), `CAPSULE, EXTENDED RELEASE` (3); strengths 25/50/100/200 mg | Original-packager label present; D&A: "do not crush or chew the whole or half tablet"; no `inactive_ingredient`/`warnings` sections (PLR) |
| 2 | Pantoprazole sodium DR 40 mg tablet | EC/DR | `TABLET, DELAYED RELEASE` (52+5); 20/40 mg | Label mentions "enteric" 6x, "delayed-release" 227x; 173 KB (needs trimming) |
| 3 | **Sucralfate oral suspension 1 g/10 mL** (Carafate or generic) | Sorbitol liquid | `SUSPENSION` / ORAL (24 recs, 1 g/10mL) | 16 of the sucralfate labels list **sorbitol** in `spl_product_data_elements` (e.g., Carafate, Allergan, set_id `0fb67b1c-b4c0-46f2-8a81-df1510e006aa`: "... WATER SORBITOL SOLUTION ..."); old-format label, **no `inactive_ingredient` section**, so `spl_product_data_elements` is the only reliable source |
| 4 | Loperamide hydrochloride 2 mg capsule (Rx) | Plain IR | `CAPSULE` (25) / ORAL; 2 mg | Rx query (`product_type:"HUMAN PRESCRIPTION DRUG"`): 10 original-packager labels, 9 with description + clinical_pharmacology, median 51 KB, **0** sugar-alcohol hits. The OTC-format loperamide labels are tiny (3 KB, no description) and would force "could not read sections"; prefer Rx |
| 5 | Baclofen 10 mg tablet | Plain IR | `TABLET` / ORAL (68); 5/10/15/20 mg | 20 original-packager labels, all rich, median 14 KB, 0 sorbitol/mannitol/xylitol |

**Why not the CONTEXT examples:** lisinopril (mannitol in 9 mentions, would trip a sugar-alcohol flag on a "plain IR" demo item), metoclopramide solution (works: sorbitol in spl, set_id `4e12e98a-06fe-4b3c-bb64-f2701e195c74`, but Aust Prescr 2013 says prokinetics are best avoided, which would sit awkwardly beside our own corpus), acetaminophen liquids (almost all pediatric brands). **Alternates verified:** metoclopramide oral solution 5 mg/5 mL (sorbitol), prednisone, tizanidine (0 sugar alcohols, plain `TABLET`).
**Caveats:** labels change; Phase 2 re-resolves identity live and must not trust these set_ids. `releaseForm` seed values: 1 extended-release, 2 delayed-release, 3-5 immediate-release. "Film coated" is **not** enteric-coated (e.g., famotidine, loperamide tablets are `TABLET, FILM COATED`); the Phase 2 flag must key on `EXTENDED RELEASE` / `DELAYED RELEASE` / `ENTERIC` tokens only.

**Peer template (discretion):** `colon-joined` (stomaType `none`, colonInContinuity `true`, band `100-200cm`), role `patient`, English, empty or two-item med list (optionally metoprolol **tartrate** IR 25 mg as the Pitfall 4 anchor; not verified here). Contrasts with father on every axis.

## Corpus Research (FND-03)

### JSON shape (validate with Zod in a vitest node test)
```jsonc
{
  "meta": { "schemaVersion": 1, "embeddingModel": "voyage-4-lite", "embeddingDim": 1024, "authoredBy": "builder-authored with Claude; NOT clinician-reviewed" },
  "sources": [{ "sourceId": "pg139", "title": "...", "authors": ["Chan LN","DiBaise JK","Parrish CR"], "venue": "Pract Gastroenterol 2015 Mar (Series #139)", "url": "...", "access": "open-full-text|abstract-only|secondary-only", "verified": true, "verifyNote": "..." }],
  "chunks": [{
    "chunkId": "pg139#time-release",            // MUST equal `${sourceId}#${locator}`
    "sourceId": "pg139", "locator": "time-release", "locatorKind": "section|topic",
    "text": "Our own words, 1-3 sentences, <= ~450 chars.",
    "quote": "optional, <= 25 words, verbatim",
    "citation": "Chan LN, DiBaise JK, Parrish CR. Pract Gastroenterol 2015;39(3) (#139), drug formulation section.",
    "tags": ["release-form","mandatory-pill-rule"], "anatomyScope": ["all"],
    "appliesTo": ["extended-release"],            // immediate-release | extended-release | delayed-release | liquid | any-oral
    "diagram": { "segmentIds": ["..."] | "user-removed", "mode": "absorbs-here|releases-here|missing", "label": "fixed string" },
    "verified": true, "verifyNote": "..."
  }]
}
```
`diagram` is lookup-only (Pitfall 5): the model never invents segments. Allowed `SegmentId`s: `stomach, duodenum, jejunum, ileum, cecum, ascending-colon, transverse-colon, descending-sigmoid` [CITED: BRIEF.md "The gut diagram"]. Only chunks whose claim is genuinely anatomical get a payload (target 4-6). Do **not** author "releases-here on ileum/ascending colon" (SUMMARY A1 #9); the truthful ER label is "slow-release designs need time in a gut that is now shorter", `segmentIds: "user-removed"`, `mode: "missing"`.

### Source bank (what was and was not readable this session)
| sourceId | Full citation | Access this session | `verified` for chunks |
|----------|---------------|---------------------|------------------------|
| `aga-sbs` | Iyer K, DiBaise JK, Rubio-Tapia A. AGA Clinical Practice Update on Management of Short Bowel Syndrome: Expert Review. Clin Gastroenterol Hepatol 2022;20:2185-94. doi:10.1016/j.cgh.2022.05.032 | Full text 403. Only Healio summary, gastro.org topic list, and slide-derived notes in PITFALLS.md | **false** for all (note which secondary source). Use topical locators (`#drug-dosing`, `#oral-rehydration`, `#diet`, `#bowel-anatomy`, `#antisecretory`); do not use BPA numbers: gastro.org lists ORS = item 5, Drug dosing = item 7; PITFALLS.md says 6 and 8 |
| `pg139` | Chan LN, DiBaise JK, Parrish CR. Short Bowel Syndrome in Adults, Part 4A: A Guide to Front Line Drugs Used in the Treatment of SBS. Pract Gastroenterol 2015 Mar;39(3), Nutrition Issues in Gastroenterology Series #139 | Full article text read (practicalgastro.com) | **true** for content; locators are topic slugs, not verbatim headings (`locatorKind: "topic"`). **Correction to PITFALLS.md:** the "Guide to Front Line Drugs" title is Part 4A = #139 (Part 4B = #140 is anti-motility) |
| `pg138` | Parrish CR, DiBaise JK. Hydrating the Adult Patient with Short Bowel Syndrome. Pract Gastroenterol 2015 Feb;39(2), Series #138 | Full text read; section headings: Assessment of Hydration Status, Management of Dehydration, Special Considerations, Fluid Options for Those with SBS, Oral Rehydration Solution, Parenteral Fluid | **true**; locators can be real section headings |
| `gh2017` | Parrish CR, DiBaise JK. Managing the Adult Patient With Short Bowel Syndrome. Gastroenterol Hepatol (N Y) 2017;13(10):600-608 (PMC5718176) | Full text read; headings: Diet Therapy, Fluids (oral rehydration solution), Medications | **true** |
| `aust-prescr-2013` | Sood S, Tanner F, Testro A. Prescribing for a patient with reduced intestinal length. Aust Prescr 2013;36:136-8. doi:10.18773/austprescr.2013.048 | Full text read; headings: Intestinal length, Presence of a stoma, Drug formulation, Drug dose | **true**, except the "large intestine minimal role ... slow-release" sentence (carried over from PITFALLS.md, not re-seen): `verified:false` |
| `remane-2025` | Remane Y, Stolz MA, Heinitz K, Hoffmeister A, Mehdorn M, Niebisch S, Lincke K, Huke A, Seehofer D, Bertsche T. Drug dissolution problems in ostomy patients: a chart review and patient interview analysis. Int J Colorectal Dis 2025;40(1):113. doi:10.1007/s00384-025-04907-9 (PMC12065682) | Full text read | **true**. Pilot: 85 charts / 598 drugs, 50 interviews |
| `hong-2021` | Hong WB, Tan WK, Law LS, Ong DE, Lo EA. Changes of drug pharmacokinetics in patients with short bowel syndrome: a systematic review. Eur J Drug Metab Pharmacokinet 2021;46(4):465-78. doi:10.1007/s13318-021-00696-y | Abstract (Europe PMC) | **true** (abstract-level) |
| `azuz-2023` | Azuz S, Poulsen JL, Vinter-Jensen L, Olesen AE. Drug absorption from oral formulations in patients with short bowel syndrome: a comprehensive update of the literature. Expert Opin Drug Metab Toxicol 2023:577-600. doi:10.1080/17425255.2023.2256216 | Abstract (Europe PMC) | **true** (abstract-level); volume not confirmed |
| `bifa-2025` | Speakman A, Farrer K, Meade U, Culkin A, Nightingale J, BIFA Committee. The Use of Oral Rehydration Solutions for the Management of High Output Stomas and Fistulas. BIFA Top Tips (BAPEN), May 2025 | Full PDF read | **true** |
| `who-ors` | WHO/UNICEF. Reduced osmolarity oral rehydration salts (ORS) formulation (technical consultation July 2001; statement dated 2002; often cited as 2003) | Via rehydrate.org mirror and WHO Drug Information table (secondary mirror) | **true** for the numbers, `verifyNote: "secondary mirror of WHO statement"` |

### Claim bank (rule-level; rewrite in own words; pick 45-55)
Legend: scope `all` unless noted; **M** = mandatory pill rule (always included for pill queries); **F** = mandatory fluid rule; **R** = red-flag/when-to-get-help (Phase 2 SAFE-06 will cite these); verified shown as `v` / `u` (unverified).

| chunkId | Rule (paraphrase target) | Scope / appliesTo | Notes |
|---------|--------------------------|-------------------|-------|
| `aga-sbs#drug-dosing` | Tablets must disintegrate and dissolve before absorption; this shapes formulation choice | all; any-oral | **M**, u (Healio) |
| `aga-sbs#modified-release-avoid` | Sustained- and delayed-release products should be avoided; consider liquids/topicals and drug-level monitoring | all; extended/delayed-release | **M**, u (slides) |
| `aga-sbs#first-50cm` | Most oral drugs are absorbed in roughly the first 50 cm of jejunum | all | u; diagram `jejunum` `absorbs-here` |
| `aga-sbs#diet-hyperphagia` | Diet aims to maintain compensatory hyperphagia, not heavy restriction. Number (>=50% above needs) is quantity-sensitive: tag `no-quantity-output` | all | u (Healio); implies Villi never prints percentages |
| `aga-sbs#diet-meal-pattern` | About 6 small meals or snacks a day (corrected from "5-6") | all | u (slides) |
| `aga-sbs#bowel-anatomy` | Advice differs by anatomy: end-jejunostomy, jejuno-colic, jejuno-ileo-colic | all | u |
| `aga-sbs#oral-rehydration` | Glucose-electrolyte (isotonic, higher-sodium) ORS is recommended, particularly for high-output end-jejunostomy with borderline dehydration; not universal | end-jejunostomy, ileostomy | **F**, u |
| `aga-sbs#antisecretory` | PPIs or H2 blockers may reduce gastric secretion volume and stool losses | all | u (Healio) |
| `aga-sbs#team-care` | Care needs a multidisciplinary team (dietitians, nurses, surgeons, GI, social work) | all | u (Healio) |
| `aga-sbs#sbs-definition` | SBS is generally defined by residual small bowel <=200 cm (some use <=150 cm); these are risk bands, not "safe above" | all | u (search snippet) |
| `pg139#dissolution` | Solid forms must disintegrate and dissolve; upper-GI resection or achlorhydria can reduce absorption of regular tablets | all; any-oral | v |
| `pg139#liquid-or-crushed` | For some plain **immediate-release** tablets, a pharmacist may suggest liquid or crushed forms; scope strictly IR | all; **immediate-release only** | v; D-12 correction; text must say "ask the pharmacist" and must never name ER/EC |
| `pg139#sugar-alcohols` | In liquid forms, watch sugar alcohols such as sorbitol and xylitol; they can worsen diarrhea | all; liquid | **M**, v |
| `pg139#delayed-release-coating` | Delayed-release/enteric-coated tablets use a coating to delay breakdown until after the stomach | all; delayed-release | v |
| `pg139#time-release` | After extensive resection, sustained/extended-release products should generally be avoided; absorption can be erratic or severely impaired | all; extended-release | **M**, v; diagram `user-removed` `missing` "Slow-release designs need time in a gut that is now shorter" |
| `pg139#partial-resection` | With partial jejunal or proximal ileal loss the rate may change but total absorption appears preserved: not all resections are equal | all | v |
| `pg139#distal-loss` | Loss of distal jejunum, ileum, terminal ileum or ileocecal valve raises malabsorption risk; other routes (patch, injection, IV) are considered when oral fails | all | v |
| `pg139#ppi-enteric` | Oral PPIs are enteric-coated and absorbed in the small bowel, so bioavailability may be limited; colonic absorption is unclear | all; delayed-release | **M**, v |
| `pg139#colon-absorption` | Some drugs are absorbed in the colon | colon-in-continuity | v |
| `pg139#absorption-review` | When a drug seems not to work, the team reviews patient and product factors before deciding anything | all | v; phrase as "worth raising", no dose/route changes |
| `pg139#pill-burden` | Tally all prescription, OTC and supplements; their osmotic effects and the fluid used to take them add to stool output | all | v |
| `gh2017#sugary-drinks` | Sodas, juices, sweet teas and liquid supplements raise stool output because of their sugar | all | **F**, v |
| `gh2017#hypotonic-colon-ok` | People with a colon in continuity usually tolerate hypotonic fluids | colon-in-continuity | **F**, v; D-12 correction |
| `gh2017#ors-sodium` | Glucose-electrolyte ORS around 90-120 mEq/L sodium (about 1:1 carbohydrate to sodium) may help end-jejunostomy; composition numbers are allow-listed | end-jejunostomy | **F**, v; SBS formula #1 |
| `gh2017#meal-pattern` | 6-8 small meals/snacks; protein at each; favor complex carbohydrates | all | v |
| `gh2017#sugar-alcohol-limit` | Limit simple sugars and sugar alcohols; avoid supplemental nutrition drinks | all | **F**, v |
| `gh2017#med-formulation` | Choose formulations and timing with absorption in mind; avoid delayed- or extended-release | all | **M**, v |
| `gh2017#loperamide-form` | Crushed loperamide tablets may absorb better than capsules; liquids exist for several antimotility drugs | all; immediate-release | v; tag `crush-statement`: reviewer must never echo as an instruction |
| `gh2017#anatomy-types` | Jejunocolonic, jejunoileocolonic, end-jejunostomy; end-jejunostomy generally hardest | all | v |
| `gh2017#pn-length-bands` | With colon, under ~50-70 cm functional small bowel predicts long-term PN; without colon ~100-150 cm | all | v; clinician-context, risk bands |
| `pg138#hypotonic-end-jejunostomy` | In end-jejunostomy, plain water and other hypo-osmolar fluids lack sodium and glucose for absorption; large amounts can draw sodium and water into the gut and dehydrate | **end-jejunostomy** (+ileostomy via bifa) | **F**, v; D-12 correction |
| `pg138#hypertonic-soda-juice` | Regular soda and fruit juice are hyperosmolar; they draw fluid into the gut and raise diarrhea/stoma output | all | **F**, v |
| `pg138#sports-drinks` | Sports drinks carry more carbohydrate and less sodium than ORS and should not replace ORS | all | **F**, v |
| `pg138#ors-composition` | ORS sodium ~90-120 mEq/L for jejunal absorption, carbohydrate:sodium ~1:1; may add potassium, magnesium | end-jejunostomy | **F**, v; SBS formula #2 |
| `pg138#dehydration-signs` | Fatigue, rapid weight loss; chronic dehydration risks kidney stones and kidney injury | all | **R**, v |
| `pg138#net-secretor` | End-jejunostomy with <100 cm jejunum and output >2 L/day are often net secretors who need parenteral fluids | end-jejunostomy | **R**, v |
| `bifa-2025#limit-hypotonic` | For high-output small-bowel stoma, plain water, fizzy drinks, tea, coffee and juice are best limited; caffeine and alcohol act as diuretics | end-jejunostomy, ileostomy | **F**, v; this is where tea/coffee are attributed (not AGA) |
| `bifa-2025#sugary-drinks` | High-sugar drinks draw water into the bowel and worsen output | all | **F**, v |
| `bifa-2025#sports-not-ors` | Isotonic sports drinks are not recommended as ORS for small-bowel stoma: sodium too low, glucose too high | end-jejunostomy, ileostomy | **F**, v |
| `bifa-2025#ors-composition` | ORS should contain ~90-120 mmol/L sodium, osmolality near 300 mOsm/kg | end-jejunostomy, ileostomy | **F**, v; SBS formula #3 |
| `bifa-2025#licensed-ors` | Standard-recipe pharmaceutical ORS is preferred over costly unlicensed specials; ORS belongs in a care plan | end-jejunostomy, ileostomy | v |
| `bifa-2025#st-marks` | St Mark's solution is a modified WHO solution at ~90 mmol/L sodium / 80 mmol/L glucose; **do not include gram quantities** | end-jejunostomy, ileostomy | v; quantity rule |
| `who-ors#reduced-osmolarity` | WHO/UNICEF reduced-osmolarity ORS: Na 75, glucose 75, Cl 65, K 20, citrate 10 mmol/L, 245 mOsm/L; developed for acute diarrhea in children | all | **F**, v; WHO formula; must be labeled "not the SBS target" via `appliesTo`/tags, never as SBS advice |
| `who-ors#previous-standard` | Earlier standard WHO ORS: 90 mmol/L sodium, 311 mOsm/L | all | v |
| `aust-prescr-2013#colostomy` | With a colostomy most absorption happens in the small bowel, so usual doses and forms are usually adequate | colostomy | v; code, not corpus, handles "small bowel also lost" |
| `aust-prescr-2013#stoma-length` | With a jejunostomy or ileostomy absorption depends mostly on remaining small-bowel length | end-jejunostomy, ileostomy | v |
| `aust-prescr-2013#formulations` | Prefer liquids, capsules, uncoated or dispersible forms; avoid modified-release and enteric-coated where possible | all | **M**, v |
| `aust-prescr-2013#check-before-crushing` | If tablets look unchanged in output, check whether a product can be crushed/opened; check product information or ask a pharmacist first because tolerability and effect may change | all | **M**, v; carries the "ask first" framing |
| `aust-prescr-2013#liquids` | For liquids consider osmolarity, excipients such as sorbitol, and volume | all; liquid | **M**, v |
| `aust-prescr-2013#alternative-routes` | Transdermal, sublingual, buccal or injected routes may suit some drugs | all | v |
| `aust-prescr-2013#lack-of-efficacy` | A drug that seems ineffective should prompt review of absorption before assuming drug failure | all | v |
| `aust-prescr-2013#pharmacist` | Pharmacists and medicines-information services can advise on formulations | all | v |
| `aust-prescr-2013#colon-slow-release` | The large intestine has a minimal role in drug absorption, mainly for slow-release drugs | all | **u** (carried from PITFALLS.md) |
| `remane-2025#not-proof` | An intact tablet or shell in the pouch can mean it did not dissolve, or an empty shell after release; worth showing the pharmacist; not proof either way. State pilot size | ileostomy, colostomy, all | v; D-12 correction #1 |
| `remane-2025#formulation-classes` | Accelerated-release (liquids, chewables, sublingual) / regular-release (coated, film-coated, hard capsules) / modified-release (enteric-coated, matrix, prolonged-release) | all | v |
| `remane-2025#frequency` | In a 50-patient pilot, 11 (22%) had seen undissolved drug in the bag at least once (8 ileostomy, 3 colostomy); 62% had not been told about possible efficacy changes | all | v; use only with "pilot" |
| `remane-2025#team-review` | Authors recommend interprofessional medication review and weighing efficacy before changing therapy | all | v |
| `hong-2021#counts` | Across 50 studies of 37 drugs, 29 showed reduced absorption, 6 lost effect, 14 kept benefit with monitoring; **not a per-person probability** | all | v |
| `hong-2021#drug-specific` | The effect is drug-specific and depends on where and how much bowel was resected; wide-window or colon-absorbed drugs are least affected | all | v |
| `hong-2021#colon-contributes` | A colon in continuity can contribute meaningfully to absorption of some drugs (the abstract names metoprolol) | colon-in-continuity | v; diagram colon segments `absorbs-here`; relevant to the father's metoprolol |
| `hong-2021#monitoring` | Individualized dosing and drug-level monitoring, where available, are suggested, especially for narrow-therapeutic-index drugs | all | v; phrase as "teams may monitor", no dosing advice |
| `azuz-2023#diminished` | Oral drug absorption is often altered and typically reduced in SBS; anatomy, remaining absorptive capacity and drug properties all matter | all | v (abstract) |

That is 61 candidate rows; the planner should select ~48 and keep every **M**, **F**, **R** row. Target counts: >=40 chunks (FND-03), every `anatomyScope` value used at least once, every `appliesTo` value used at least once.

### Corrections self-check (D-12) as assertions
1. No chunk text contains `indicates impaired absorption` or `Leipzig`; `remane-2025#not-proof` contains `not proof` and `pilot`.
2. Every chunk tagged `hypotonic` has `anatomyScope` that excludes `all` and `colon-in-continuity`; `gh2017#hypotonic-colon-ok` exists with scope `colon-in-continuity`.
3. Any chunk whose text mentions `crush` has `appliesTo` equal to `["immediate-release"]` or text containing `ask` (pharmacist) and never `appliesTo` containing `extended-release`/`delayed-release` as a permission.
4. At least one chunk each for WHO 75 mmol/L (`who-ors`) and SBS 90-120 (`gh2017|pg138|bifa-2025`), and no chunk presents 75 as the SBS target.
5. `sources[]` author strings: `pg139` includes Chan, DiBaise, Parrish; `aust-prescr-2013` includes Testro; `remane-2025` first author is Remane (not "Leipzig"); `hong-2021` lists all five authors; `aga-sbs` lists Iyer, DiBaise, Rubio-Tapia.
6. No chunk attributes tea or coffee to `aga-sbs`.
7. No `text` contains a dose/quantity pattern (`\d+\s?(mg|mcg|g|ml|mL)`) except `tags` including `composition` (ORS mmol/L, mEq/L) or `no-quantity-output`-excluded rows.
8. No `diagram` with `releases-here` on `ileum`/`ascending-colon`; every `diagram` chunk is `verified` or flagged.
9. `quote`, if present, is <= 25 words; no chunk `text` > ~600 chars (D-13).
10. Every `verified:false` chunk has a non-empty `verifyNote`.

## Seed Specification (FND-05)

**Counts:** 60 synthetic profiles; ~1,500 logs; 40 swaps; 30 care-team answers; 20 questions; ~40 items; 40+ guideline chunks; 2 template profiles (not counted in the 60); father's 5 meds.
**Anatomy mix (skewed so headline cells reach n>=15 and the "14 of 19" style demo is possible):** 22 end-jejunostomy, 14 colon-in-continuity, 14 ileostomy, 10 colostomy. Clinician role on ~4 (`clinicianDemoVerified: true`), ~12 caregiver, rest patient. Languages mostly `en`, some others.
**Log design:** each profile logs ~25 of the ~40 items **without replacement** (distinct profile per item x anatomy, per Pitfall 6), so cell n ~= 0.6 x anatomy size. `outcome` drawn from a per-(category, anatomyKey) probability table with noise; no cell is 100%. Spread `createdAt` over the previous ~60 days (needs `createdAt` field).

| Item class | end-jejunostomy | ileostomy | colon-in-continuity | colostomy |
|------------|-----------------|-----------|---------------------|-----------|
| Plain water, tea, coffee | hurt-heavy (~60-70% hurt) | mixed (~35% hurt) | mostly neutral/helped | mostly neutral |
| Regular soda, juice, sports drink | hurt-heavy (~70%+) | hurt-heavy (~60%) | hurt moderate (~45%) | hurt moderate (~40%) |
| Sugar-free / sorbitol-sweetened items | hurt-heavy (~75%) | hurt-heavy | hurt-heavy | hurt moderate |
| ORS, broth, banana, white rice, salted crackers, plain pasta | helped-heavy (~65-75%) | helped-heavy | helped-heavy | helped-heavy |
| ER / DR pills | hurt-heavy with "didn't seem to work" notes (~65%) | hurt-heavy (~55%) | mixed (~35%) | mostly neutral (~20% hurt) |
| Plain IR pills, liquids w/o sugar alcohol | mostly neutral/helped | same | same | same |

Notes: free-text `note` appears on ~25% of logs from a small authored list (templated, no names, no dosing). Patterns mirror the corpus, so state plainly in README that the seed is circular by design ("modeled on the expected patterns, not patient data").
**Swaps (40):** pairs like "sports drink -> oral rehydration solution", "apple juice -> diluted?": **never** a hypertonic or sugar-alcohol `useItem`; ~6 carry `clinicianEndorsements` (seeded clinician profiles), `guidelineCheck.passed: true` with real `chunkId` citations, upvotes 0-30 (values only; per-voter rows not needed for synthetic). **Care-team answers (30):** authored questions/answers across the four professional types, phrased as "my pharmacist said it is worth asking about the liquid form", never "stop/start/crush/dose". **Questions (20):** open questions in the same voice.
**Aggregates:** compute in memory from the inserted logs, write each `(itemId, anatomyKey)` doc once with `real: {0,0,0}` and `synthetic: {...}`; `aggregates:rebuild` is the pure recount used by the test (`live == rebuild`). Do **not** call a per-row counter helper 1,500 times.
**Items (~40):** `slug` = kebab of canonical name; pills use `ingredient-releaseform` (e.g., `metoprolol-succinate-extended-release`, `metoprolol-tartrate-immediate-release`) so canonicalization never merges across release form. Include the father's five meds as items.
**Embedding of items:** optional in Phase 1 (include in `embed:run` if trivial); Phase 4 depends on it.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@tailwindcss/postcss` | `@tailwindcss/turbopack` loader rule in `next.config.ts` | Next 16.4 / Tailwind 4.3 scaffold | No `postcss.config`; CSS pipeline lives in `next.config.ts` |
| `useSearchParams` anywhere in a client page | Must be inside `<Suspense>` with `cacheComponents` | Next 16 Cache Components | Build error otherwise |
| `process.env.X` in Convex functions | `defineApp({env})` + `env` from `_generated/server` | convex ^1.44 per guidelines.md | Typed, deploy-time visible; TS 6 does not type `process` in `convex/` anyway |
| TS auto-includes `@types/*` | TS 6: `process`/`Buffer` types not ambient in the Convex tsconfig | TS 6.0 | Reinforces the `env` rule; `"use node"` files (Phase 2) may need `types: ["node"]` in `convex/tsconfig.json` |
| Vitest 3 `environmentMatchGlobs` | `test.projects` array | Vitest 4/5 | Verified working with vitest 5.0.5 |

**Deprecated/outdated:** the brief's `openfda.dosage_form` label field (absent; NDC endpoint only); the brief's Remane "whole tablet indicates impaired absorption" claim; BPA-number locators for the AGA update.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Unpaid-trial Voyage limits are low (reports of ~3 RPM / 10K TPM are unverified; docs only define Tier 1 = payment method) | Summary, Pattern 3-4 | If limits are tighter, `embed:run` may need smaller batches; fallback path already covers search |
| A2 | `@anthropic-ai/sdk` 1.3.0 works in Convex default runtime (its `browser` field maps node-only modules to browser shims: observed in package.json) | Spikes | If not, Claude files need `"use node"` (already the fallback); cost is only a file-split |
| A3 | `convex deploy` typechecks cleanly under TS 6.0.3 | Pitfall 11 | Vercel build fails; escape hatch `--typecheck=disable` |
| A4 | Seed completes well under 60 s with ~10-15 batched mutations | Pattern 2 | Increase batch size or move aggregates to one extra mutation; measure with `time npm run seed` |
| A5 | `AbortController`+`setTimeout` timeout works in the Convex default runtime | embed example | Use SDK-less fallback: `Promise.race` with a timer |
| A6 | AGA 2022 statements (modified-release avoidance, first ~50 cm jejunum, ORS for high-output end-jejunostomy, "about 6 meals") match the paywalled full text | Corpus | Chunks stay `verified:false`; README says corpus is builder-authored, not clinician-reviewed |
| A7 | PG #139 locators are topic slugs; real headings were not visible in the fetched text | Corpus | Mark `locatorKind:"topic"`; no claim of verbatim headings |
| A8 | Voyage response is `{data:[{index,embedding}]}` | embed example | Adjust parse after first live call (smoke script surfaces it) |
| A9 | `crypto.getRandomValues`-based UUID is acceptable as a bearer id (~122 bits) | Pattern 5 | Weak ids only harm their own owner; server also enforces format + uniqueness |
| A10 | Vercel `engines.node: "24.x"` is accepted (docs say major-only ranges work) | Scripts | Set Node version in Vercel project settings instead |
| A11 | Metoprolol tartrate IR 25 mg exists in NDC as plain `TABLET` (peer med, optional) | Father/Peer | Skip peer meds or verify in Phase 2 |
| A12 | Sorbitol/other excipients in the picked labels will still be present when Phase 2 re-resolves labels | Med list | Re-verify at Phase 2 start |
| A13 | Azuz 2023 volume/issue number | Corpus | Cite DOI + pages only |

## Open Questions

1. **Does the builder's dev Convex deployment already have env vars set (ANTHROPIC, VOYAGE, OPENFDA)?**
   - What we know: `.env.local` exists (cannot be read in this environment by policy); Convex CLI login config exists (`~/.convex/config.json`).
   - What's unclear: which `npx convex env` names exist on dev, and whether a prod deployment exists.
   - Recommendation: first executor step runs `npx convex env list --names-only` (and `--prod`); missing items go in the batched builder to-do (D-17).
2. **Live-update demo vs contrasting peer.** Peer is chosen to contrast with father (per CONTEXT), but the Phase 4 "second device updates the first" moment needs a same-stratum log.
   - Recommendation: keep peer contrasting; run `?as=father` on the second device for the live-update beat (fresh clone each call). Note it in the Phase 4 context.
3. **Does the `answers`/`answer_reviews` shape need final field-level design now?**
   - Recommendation: ship the draft above with `v.any()` blobs; Phase 2 adds optional fields only (no migration).
4. **Chunk selection (48 of 61).** Planner picks; keep all M/F/R rows. Checkpoint shows the id/rule/source table (D-12).
5. **Where do the red-flag chunks (R) get their final text?** SAFE-06 is Phase 2, but the chunks it will cite must exist now. Two rows are in the bank; confirm wording is guideline-faithful and contains no quantities beyond what the source gives.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v24.13.1 | - |
| npm | install/scripts | yes | 11.8.0 | - |
| git | commits | yes (no remote) | - | builder adds remote (to-do) |
| Convex CLI | dev/deploy/seed | yes | 1.48.0, login config present | - |
| Convex dev deployment | dev, seed, tests of real behavior | likely (`.env.local`, `_generated/` exist) | unverified | builder re-runs `npx convex dev` |
| Convex prod deployment | FND-07 | unknown | - | builder creates (to-do) |
| Vercel account / project | FND-07 | account yes (D-15); project not linked | - | builder links after push (to-do) |
| GitHub remote | Vercel import | no | - | builder `git remote add` + push (to-do) |
| openFDA (network) | med verification, Phase 2 | yes, reachable | live calls succeeded | key in Convex env (builder; D-15 says ready) |
| Voyage API | embeddings | endpoint reachable (401 without key) | `voyage-4-lite` per docs | text-only fallback (designed) |
| Voyage key (trial) | `embed:run` | builder has (D-16); in Convex env unknown | - | seed + text search work without |
| Anthropic key | optional SDK spike | STATE says ready; Convex env unknown | - | skip spike, default `"use node"` |
| Real phone | SC1 / checkpoint | builder | - | - |

**Missing dependencies with no fallback:** none block coding; deploy + phone check are blocked on the builder's batched to-do.
**Missing with fallback:** Voyage key (text path), Anthropic key (skip spike).

### Builder batched to-do (D-17) -- hand this to the builder once, do not stop for each
1. `git remote add origin <url>` and push after the executor's initial commit.
2. In Convex dashboard: confirm dev deployment; create **production** deployment; generate a **Production Deploy Key** (`deployment:deploy` permission).
3. Vercel: import repo; Framework Next.js; **Build Command override** `npx convex deploy --cmd 'npm run build'`; env var `CONVEX_DEPLOY_KEY` = prod key, scope **Production only**; Node 24.x.
4. Convex env (dev, then `--prod`): `npx convex env set DEMO_MODE true` (dev and prod); `VOYAGE_API_KEY` (interactive `npx convex env set VOYAGE_API_KEY` keeps it out of shell history); `OPENFDA_API_KEY`; `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_MAIN=claude-opus-5-5`, `ANTHROPIC_MODEL_FAST=claude-haiku-5-5` (needed from Phase 2, harmless now).
5. After the first successful Vercel build (it pushes prod functions): `npm run seed:prod`, then `npm run embed:prod`; confirm row counts in the Convex dashboard.
6. Phone: open the `*.vercel.app` URL, then `/demo?as=father`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.5 + convex-test 0.0.65 + @edge-runtime/vm 5.0.0 |
| Config file | `vitest.config.mts` (Wave 0) |
| Quick run command | `npx vitest run --project convex` / `npx vitest run --project node` |
| Full suite command | `npm run test:once && npm run typecheck && npm run lint && npm run build` |

Verified config (ran green in a scratch copy with the real scaffold; edge-runtime project passed a vector + text-fallback test, node project read files):
```ts
// vitest.config.mts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { projects: [
    { test: { name: "convex", environment: "edge-runtime", include: ["convex/**/*.test.ts"], server: { deps: { inline: ["convex-test"] } } } },
    { test: { name: "node", environment: "node", include: ["tests/**/*.test.ts"] } },   // fs/git/zod checks
  ] },
});
```
Each convex test file starts with `/// <reference types="vite/client" />` and `const modules = import.meta.glob("./**/*.ts"); const t = convexTest(schema, modules);` [CITED: guidelines.md "Testing guidelines"]. Env in tests: `process.env.DEMO_MODE = "true"` (the generated `env` is just `process.env`). Stub network with `vi.stubGlobal("fetch", ...)` and `vi.unstubAllGlobals()` [CITED: docs.convex.dev/testing/convex-test].

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-01 | App builds and typechecks; shell renders | build/typecheck (+ manual phone width) | `npm run typecheck && npm run build` (needs `NEXT_PUBLIC_CONVEX_URL`, from `.env.local`) | Wave 0 scripts |
| FND-02 | Every required table present; `pooled` accepts true/false/null on logs, swaps, care_team_answers, questions and rejects strings; 1024-length embedding insertable | convex-test | `npx vitest run --project convex convex/schema.test.ts` | Wave 0 |
| FND-03 | >=40 chunks; `chunkId === sourceId#locator`; unique ids; required fields; quote <=25 words; the 10 correction assertions; every `verified:false` has a note; diagram payloads use valid segment ids | zod + node test | `npx vitest run --project node tests/corpus.test.ts` | Wave 0 |
| FND-04 | Vector path returns stable ids when all chunks embedded; text path when embed throws / returns 429 / no key / zero hits; "extended release after resection" returns >=1 chunk on the text path; result carries `path` | convex-test + fetch stub | `npx vitest run --project convex convex/guidelines.test.ts` | Wave 0 |
| FND-04 (live) | Voyage reachable with the trial key; 1024 dims; search path `vector` | manual smoke | `npm run embed && npm run smoke:search` | needs key |
| FND-05 | After `seed:run` x2: counts equal and match spec (60 / ~1,500 / 40 / 30 / 20 / >=40 chunks / 5 father meds); every community row `synthetic:true, pooled:true`; aggregates equal `rebuild`; templates untouched by re-run; seeded text passes the rule-lint (Pitfall 9) | convex-test | `npx vitest run --project convex convex/seed.test.ts` | Wave 0 |
| FND-05 (time) | Seed < 60 s on a real deployment | manual | `time npm run seed` | n/a |
| FND-06 | `anatomyFromChoice` table (4 choices x bands); `profiles.create` stores only allowed fields and ignores/rejects extras (`name`); `demo.startAs` clones father with 5 meds, non-synthetic, fresh anonId; second call with same `clonedFrom` is idempotent; `DEMO_MODE` unset -> throws; `profiles.me` never returns `anonId`; bad anonId format rejected | convex-test + pure | `npx vitest run --project convex convex/profiles.test.ts convex/demo.test.ts convex/lib/anatomy.test.ts` | Wave 0 |
| FND-07 | `.env.example` exists, tracked, lists every key in `convex.config.ts` env + `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY`; no tracked `.env.local`; no tracked file matches secret patterns (`sk-ant-`, `pa-[A-Za-z0-9_-]{20,}`, 32+ hex in `.env*`) | node (git ls-files) | `npx vitest run --project node tests/env.test.ts` | Wave 0 |
| FND-07 (deploy) | Phone loads HTTPS shell; `/demo?as=father` shows profile; dashboard counts | manual checkpoint | - | n/a |
| SAFE-07 | `Object.keys(schema.tables.profiles.validator.fields)` equals the allow-list exactly; no `string` free-text fields on profiles (only enums/ids/synthetic-key fields); home form has exactly three controls | convex-test + manual | `npx vitest run --project convex convex/schema.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project <affected project>` (< 30 s) plus `npm run typecheck` when TS changed.
- **Per wave merge:** `npm run test:once && npm run typecheck && npm run lint`.
- **Phase gate:** full suite green + `npm run build` + manual checkpoint (phone, `/demo?as=father`, dashboard counts) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `vitest.config.mts`, `package.json` scripts, deps installed (single batched human-verify first)
- [ ] `convex/schema.test.ts` (schema, pooled, vector dim, SAFE-07 allow-list)
- [ ] `convex/lib/anatomy.test.ts` (pure table tests)
- [ ] `tests/corpus.test.ts` (zod + 10 correction assertions) — needs the zod schema in `tests/` or `convex/lib`
- [ ] `convex/guidelines.test.ts` (vector vs text path; see Pitfall 5 for the embedding-everywhere rule)
- [ ] `convex/seed.test.ts` (idempotency, counts, flags, aggregate recount, text-lint)
- [ ] `convex/profiles.test.ts`, `convex/demo.test.ts`
- [ ] `tests/env.test.ts` (git ls-files, `.env.example`, secret patterns)
- [ ] `.gitignore`: add `!.env.example`

## Security Domain

`security_enforcement` is enabled (absent in config = enabled; `security_asvs_level: 1`).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (no accounts) | Anonymous by design; revisit only if Convex Auth is added later |
| V3 Session Management | partial | anonId is a bearer capability: >=122 bits, never returned by any query, stored only in localStorage |
| V4 Access Control | yes | Public surface limited to `profiles.create/me`, `demo.startAs`; everything else `internal*`; `profiles.me` returns an explicit projection; no "list profiles"; client cannot send `profileId`, `pooled`, `synthetic`, `anatomy` |
| V5 Input Validation | yes | Convex `v` validators on every function (reject unknown args); Zod for `guidelines.json`; anonId regex + length |
| V6 Cryptography | partial | `crypto.getRandomValues` for ids; no hand-rolled crypto; TLS via Vercel/Convex |
| V8 Data Protection | yes | SAFE-07: no name/DOB/free-text on profiles; photos not used in Phase 1; `photoStorageId` is author-only |
| V14 Configuration | yes | Secrets only in Convex env; only `NEXT_PUBLIC_CONVEX_URL` reaches the browser; `.env.example` split by owner; secret-scan test; `DEMO_MODE` explicit |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Seed/embed/search functions invoked from the browser | Elevation | Register as `internalAction/internalMutation/internalQuery` only; test that they are absent from `api` (public) |
| anonId leaked in a query result or log | Information disclosure | Never select it into return values or traces; test `profiles.me` output keys |
| Profile spam / orphan clones via `demo.startAs` | DoS | Idempotent per `clonedFrom`; `DEMO_MODE` kill switch; rate limit is POL-03 (Phase 7) |
| Client forges anatomy/`synthetic`/`pooled` | Tampering | Server derives anatomy from picker id; strict arg validators; schema has no client path to `pooled` |
| Secret in `NEXT_PUBLIC_*` or committed `.env*` | Information disclosure | `.gitignore` + `!.env.example`; env test; keys only via `npx convex env set` |
| Stored injection via seeded free text | Tampering | Synthetic text is authored + lint-tested; later phases treat community text as untrusted data |
| Voyage/openFDA outage | DoS | Text fallback; openFDA cache + key (Phase 2) |

## Spike Results (research flag: "Spike first")

| Spike | Outcome | Confidence |
|-------|---------|------------|
| Voyage endpoint | `POST https://api.voyageai.com/v1/embeddings` per docs; `ai.mongodb.com/v1/embeddings` also live; both 401 without a key, so key origin decides host. Make `VOYAGE_BASE_URL` optional env | HIGH endpoint, MEDIUM response shape |
| Voyage account limits | Docs define Tier 1 (2,000 RPM / 16M TPM for `voyage-4-lite`) as requiring a payment method and say nothing about unpaid-account limits; 200M free tokens per model. Treat trial limits as unknown | HIGH (doc statement), LOW (actual limits) |
| Anthropic SDK in Convex default runtime | Not runnable without a deployment + key. SDK 1.3.0 declares a `browser` field remapping `./internal/node.js` etc. to browser shims, which is the signal that a browser-platform bundle should work; plan a 15-minute spike: internalAction `spike:ping` (no `"use node"`) with `messages.create` on `ANTHROPIC_MODEL_FAST`, `max_tokens` small, no sampling params; if it fails, default to `"use node"` for Claude files. Not a Phase 1 requirement; recommend running it in the final deploy slice if the builder has set the key | LOW-MEDIUM |
| Convex env wiring dev vs prod | `npx convex env set NAME` (dev) / `--prod`; `list --names-only` is safe; typed env via `defineApp({env})`; all optional | HIGH |
| Next + Convex build behavior | Suspense rule and `NEXT_PUBLIC_CONVEX_URL` requirement verified by building | HIGH |
| convex-test vectors/search | Vector + text search work in the mock; vector mock crashes on un-embedded docs; text search matched `"extended release after resection"` against "extended-release ... resection" | HIGH |

## Recommended Slicing (for the planner; MVP / walking skeleton)

1. **Skeleton (blocking, first):** `.gitignore` fix, deps/pins (after the batched checkpoint), initial scaffold commit, `convex.config.ts`, validators + full `schema.ts`, `ConvexProvider`, Atkinson + tokens, a live-query tracer on the home shell, vitest config + schema test, `.env.example`.
2. **Corpus (parallel):** `data/guidelines.json` + Zod test + corrections self-check; chunk table for the checkpoint.
3. **Seed (parallel after schema):** constants/PRNG/item catalog/authored text, `seed:run`, `aggregates:rebuild`, tests (idempotency, counts, lint, recount).
4. **Search (after corpus + schema):** `embed` lib, `embed:run`, `guidelines.search/smoke`, tests (both paths).
5. **Profile + demo UI (after schema):** `anatomy.ts`, `profiles.create/me`, `demo.startAs`, home buttons + form + profile summary, `/demo` with Suspense, tests.
6. **Deploy + checkpoint:** `.env.example` finalized, env test, README stub for env/DEMO_MODE, builder to-do list handed over, prod deploy/seed/embed once the builder finishes, optional Anthropic spike, phone check.

## Sources

### Primary (HIGH confidence)
- Local files read this session: `package.json`, `next.config.ts`, `.gitignore`, `src/app/*`, `convex/_generated/*`, `convex/tsconfig.json`, `convex/_generated/ai/guidelines.md`, `.planning/{BRIEF,REQUIREMENTS,STATE,ROADMAP}.md`, `.planning/research/{SUMMARY,ARCHITECTURE,PITFALLS}.md`, `.planning/config.json`
- Live openFDA label + NDC queries (2026-10-24): father med picks, dosage_form token-match behavior, sorbitol in `spl_product_data_elements`
- Scratch experiments (copy of scaffold): `next build` with `cacheComponents` (Suspense rule, missing `NEXT_PUBLIC_CONVEX_URL` failure), TS 6.0.3 `tsc`, vitest 5.0.5 `projects` + convex-test vector/text tests
- node_modules/convex bundler source (entry-point rules), `components/index.d.ts` (typed env), `_generated/server.{js,d.ts}`
- docs.voyageai.com/docs/embeddings, /rate-limits, /pricing; docs.convex.dev/search/text-search, /search/vector-search, /testing/convex-test, /production/hosting/vercel
- npm registry (`npm view`) and `gsd-tools query package-legitimacy check`
- Remane et al. 2025 (PMC12065682); Sood, Tanner, Testro 2013 (australianprescriber.tg.org.au); Practical Gastroenterology #138 and #139 (practicalgastro.com); BIFA/BAPEN 2025 tip sheet (bapen.org.uk)

### Secondary (MEDIUM confidence)
- Parrish & DiBaise 2017, Gastroenterol Hepatol (PMC5718176) via fetch summary
- Hong 2021 and Azuz 2023 abstracts via Europe PMC REST
- WHO/UNICEF reduced-osmolarity ORS via rehydrate.org / WHO Drug Information mirror
- AGA 2022 via Healio and gastro.org topic list
- Vercel Node.js version docs (search result)

### Tertiary (LOW confidence)
- Third-party Voyage free-tier figures (3 RPM / 10K TPM): not confirmed anywhere; search aggregators disagree on free-token amounts
- UOAA/consumer sources explaining ER avoidance via "colon bypass" (conflicts with the transit-time mechanism in Aust Prescr); not used

## Metadata

**Confidence breakdown:**
- Standard stack / scaffold / build behavior: HIGH (installed versions read; build, tsc, vitest experiments run)
- Architecture (seed split, embed/search split, identity): HIGH for platform semantics, MEDIUM for timing estimates
- Corpus: MEDIUM (9 of 10 sources readable; AGA unverifiable; PG139 locators are topic slugs)
- Pitfalls: HIGH (most reproduced this session)
- Voyage unpaid limits / Anthropic SDK default runtime / `convex deploy` under TS 6: LOW-MEDIUM, all have designed fallbacks

**Research date:** 2026-10-24
**Valid until:** 2026-10-31 (fast-moving: SDK 1.x and convex-test versions published within the last 3 days; hackathon ends 2026-10-25)
