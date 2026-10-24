# Walking Skeleton — Villi

**Phase:** 1
**Generated:** 2026-10-24

## Capability Proven End-to-End

A visitor opens the deployed, phone-width Villi shell, either saves a three-dropdown anonymous profile or taps "See it as my dad", and sees that profile (anatomy and meds) read live from Convex, on a deployment that also holds the cited guideline corpus (searchable by vector or full-text fallback) and the synthetic community seed.

Tracer task: `01-01` Task 3 (quick profile -> `profiles.create` -> profiles table -> `profiles.me` -> rendered summary, pushed to the dev deployment).

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.4.3 App Router, React 19.3.1, TypeScript ~6.0.3 (never 7.x) | Pinned in `.claude/CLAUDE.md`; Next is a thin client shell. `cacheComponents` is on, so `useSearchParams` always sits inside `<Suspense>`; no Next API routes or server actions for app logic |
| Data layer | Convex 1.48 (DB, functions, vector + full-text search); full 14-table schema defined in Phase 1 | Every later phase adds only optional fields. `pooled` is boolean-or-null; `aggregates` keeps separate `real` and `synthetic` buckets; `answer_reviews` holds hidden drafts |
| Auth / identity | No accounts. A UUID v4 `anonId` built from `crypto.getRandomValues`, stored in localStorage, sent on every public call, never returned by any function; `requireProfile` / `findProfileByAnonId` in `convex/lib/identity.ts` is the single swap point if real auth is added | Anonymous by design (SAFE-07); Convex Auth skipped |
| Public API surface | Only `profiles.create`, `profiles.me`, `demo.startAs`; everything else `internal*`, pinned by `convex/publicSurface.test.ts` | The public URL is unauthenticated; nothing public calls a paid API in Phase 1 |
| Env and secrets | `defineApp({ env })` in `convex/convex.config.ts`, every key optional, read via `env` from `./_generated/server`; secrets only in Convex env (dev and prod); `NEXT_PUBLIC_CONVEX_URL` is the only browser value | A missing key never blocks a deploy (D-17); `.env.example` lists keys by owner |
| Embeddings and search | Voyage `voyage-4-lite`, 1024 dims, plain `fetch`; `embed:run` is separate from the seed and hash-gated; `guidelines.search` tries the vector index once (3 s, no retry) and falls back to the `search_text` index on any failure, reporting the path | Trial key with low limits (D-16); the demo must work when Voyage is rate-limited |
| Citation identity | `chunkId = sourceId#locator` (section/topic slugs) for every guideline chunk, used by both search paths, seeds, and citations | D-11; survives re-seeding; one identity for vector and text paths |
| Corpus | `data/guidelines.json` (51 chunks, 10 sources) validated by Zod and the ten SUMMARY Part A correction tests | D-10 to D-13; the tests are the review |
| Seed | Convex internal action `seed:run` via `npm run seed` (no `scripts/` runtime); reference tables upserted by stable key; synthetic rows replaced only when the generator hash changes; all seeded community rows `synthetic: true, pooled: true` | Idempotent, key-free, under 60 s; real data never deleted |
| Tests | vitest 5 with two projects: `convex` (edge-runtime + convex-test) for `convex/**/*.test.ts`, `node` for `tests/**/*.test.ts` | Verified config; `*.test.ts` under `convex/` is never bundled (multi-dot names) |
| Styling | Tailwind v4 CSS-first tokens in `globals.css`: cream `#FBF6EE` / dark `#1C1612`, terracotta accent `#B5472B` / coral `#E58A66`, rounded cards, `prefers-color-scheme`; Atkinson Hyperlegible via `next/font/google`; ~375 px centered column | D-01 to D-04 |
| Deployment target | Vercel `*.vercel.app` (custom domain later) with Build Command `npx convex deploy --cmd 'npm run build'` and a Production-only `CONVEX_DEPLOY_KEY`; Convex prod deployment seeded by the builder; `DEMO_MODE=true` on prod for judges | D-14, D-18 |
| Directory layout | `convex/lib/*` pure shared TS (client may import `anatomy.ts`, `identity.ts`); `convex/seedData/*` seed builders; `convex/*.ts` function modules; `src/app` routes; `src/components` UI; `src/lib` client helpers; `data/` corpus; `tests/` node tests; `scripts/` Node CLIs | Keeps Convex function modules small and the client free of server code |
| Claude runtime | TBD by the 15-minute spike in `01-07` Task 3 (default runtime vs `"use node"`); if not run, Phase 2 Claude files use `"use node"` | `.claude/CLAUDE.md` Decision 3 |

## Stack Touched in Phase 1

- [ ] Project scaffold (framework, build, lint, test runner) — 01-01 Task 2
- [ ] Routing — `/` (01-01, 01-02) and `/demo?as=father|peer` (01-03)
- [ ] Database — real write `profiles.create` / `demo.startAs` / seed, real read `profiles.me` / `guidelines.search`
- [ ] UI — quick profile form and demo buttons wired to Convex mutations
- [ ] Deployment — dev deployment push (01-01) and Vercel + Convex prod (01-07)

## Out of Scope (Deferred to Later Slices)

- Pill flow, agent loop, reviewer, lint, openFDA label fetch, photo upload (Phase 2)
- GutDiagram onboarding, meds add/edit UI, follow-up chat, diagram highlight (Phase 3)
- Item embeddings, canonicalization, logging UI, moderation, live community counts (Phase 4)
- Swaps board, care-team answers UI, clinician endorse (Phase 5)
- "I saw something", appointment sheet (Phase 6)
- Translation of answers, rate limiting, delete-my-data, custom domain, full README and DEMO.md (Phase 7)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: photo or typed pill -> cited, reviewer-checked answer with live tool trace and one question card
- Phase 3: tap-to-mark GutDiagram onboarding, meds list, follow-up chat, diagram highlight on answers
- Phase 4: drink/food answers with ORS swap, canonicalization, 5-second log, moderation, live stratified counts
- Phase 5: guideline-checked swaps board, care-team answers in answers, clinician endorse
- Phase 6: "I saw something" chip match and the appointment sheet with export
- Phase 7: answers in profile language, empty/loading/error states, data controls, test suite, README and DEMO.md
