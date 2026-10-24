---
phase: "01"
slug: "foundation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-24"
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 5.0.5 + convex-test 0.0.65 + @edge-runtime/vm 5.0.0 (projects: `convex` edge-runtime, `node`) |
| **Config file** | `vitest.config.mts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --project convex` / `npx vitest run --project node` |
| **Full suite command** | `npm run test:once && npm run typecheck && npm run lint && npm run build` |
| **Estimated runtime** | ~30 seconds (tests); build adds ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project <affected project>` (plus `npm run typecheck` when TS changed)
- **After every plan wave:** Run `npm run test:once && npm run typecheck && npm run lint`
- **Before `/gsd-verify-work`:** Full suite + `npm run build` green, plus the manual checkpoint below
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01-01 | 1 | (gate) | T-01-SC | Package legitimacy confirmed before install | checkpoint (blocking-human) | — (builder reply) | n/a | ⬜ pending |
| 01-01-T2 | 01-01 | 1 | FND-01 | T-01-03, T-01-SC | Pinned toolchain; env file stays ignored | config | `npx tsc --version` / `npm ls ...` / `npx vitest run --passWithNoTests` / `npm run lint` | ✅ (installs harness) | ⬜ pending |
| 01-01-T3 | 01-01 | 1 | FND-01, FND-02, FND-06, SAFE-07 | T-01-01, T-01-02, T-01-04 | `profiles.me` projection has no anonId / `_id`; server-derived anatomy | tracer: convex-test + push + build | `npx convex dev --once` / `npx vitest run --project convex convex/profiles.test.ts` / `npm run typecheck` / `npm run build` | created in task | ⬜ pending |
| 01-02-T1 | 01-02 | 2 | FND-02, SAFE-07 | T-01-05, T-01-06, T-01-07 | Profile fields match allow-list exactly; `pooled` rejects non-boolean | convex-test (tdd) | `npx vitest run --project convex convex/lib/anatomy.test.ts convex/schema.test.ts convex/profiles.test.ts` | created in task | ⬜ pending |
| 01-02-T2 | 01-02 | 2 | FND-01, FND-06 | T-01-05 | Form has selects only | build/lint/typecheck + human-check | `npm run build` / `npm run lint` / `npm run typecheck` | n/a | ⬜ pending |
| 01-03-T1 | 01-03 | 2 | FND-06, SAFE-07 | T-01-08, T-01-09, T-01-10 | Demo gated by `DEMO_MODE`; never overwrites; returns null | convex-test (tdd) | `npx vitest run --project convex convex/demo.test.ts` | created in task | ⬜ pending |
| 01-03-T2 | 01-03 | 2 | FND-06 | — | Suspense around `useSearchParams` | build/lint | `npm run build` / `npm run lint` | n/a | ⬜ pending |
| 01-04-T1 | 01-04 | 2 | FND-03 | T-01-11, T-01-12 | Correction assertions exist | zod + node (tdd) | `npx vitest run --project node tests/corpus.test.ts -t "ChunkSchema boundaries\|buildSearchText"` | created in task | ⬜ pending |
| 01-04-T2 | 01-04 | 2 | FND-03 | T-01-11, T-01-12 | Unverified chunks flagged; corrections hold | zod + node | `npx vitest run --project node tests/corpus.test.ts` | ✅ (from T1) | ⬜ pending |
| 01-05-T1 | 01-05 | 2 | FND-04 | T-01-14, T-01-15 | Key never in errors; embed is internal | convex-test + fetch stub (tdd) | `npx vitest run --project convex convex/embed.test.ts` | created in task | ⬜ pending |
| 01-05-T2 | 01-05 | 2 | FND-04 | T-01-13, T-01-15 | Embedding failure degrades to text path | convex-test + fetch stub (tdd) | `npx vitest run --project convex convex/guidelines.test.ts` | created in task | ⬜ pending |
| 01-06-T1 | 01-06 | 3 | FND-05, FND-03 | T-01-17 | Seed internal only, no network | convex-test (tdd) | `npx vitest run --project convex convex/seed.test.ts` | created in task | ⬜ pending |
| 01-06-T2 | 01-06 | 3 | FND-05 | T-01-18 | All community rows `synthetic:true`; seeded text lint | convex-test (tdd) | `npx vitest run --project convex convex/seedData/generate.test.ts convex/seed.test.ts` | created in task | ⬜ pending |
| 01-06-T3 | 01-06 | 3 | FND-05, FND-02 | T-01-16 | Real rows and real buckets survive re-seed | convex-test + live dev run | `npx vitest run --project convex convex/seed.test.ts convex/seedData/generate.test.ts` / `time npm run seed` / `npx convex run aggregates:verify` | ✅ | ⬜ pending |
| 01-07-T1 | 01-07 | 4 | FND-07, FND-06 | T-01-19, T-01-20, T-01-21 | No secret tracked in git; public surface pinned | node (git ls-files) + convex-test | `npx vitest run --project node tests/env.test.ts` / `npx vitest run --project convex convex/publicSurface.test.ts` / `npm run test:once` / `npm run build` | created in task | ⬜ pending |
| 01-07-T2 | 01-07 | 4 | FND-07 | T-01-22 | Prod changes made by the builder only | checkpoint (human-action) | — (builder reply) | n/a | ⬜ pending |
| 01-07-T3 | 01-07 | 4 | FND-07, FND-04, FND-01 | T-01-21 | Live env names only; spike deleted after run | live checks + human-check | `npm run check-env` / `npm run smoke:search` / `npm run test:once` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.mts`, `package.json` scripts, deps installed (single batched human-verify of package legitimacy first)
- [ ] `convex/schema.test.ts` — schema, pooled, vector dim, SAFE-07 allow-list
- [ ] `convex/lib/anatomy.test.ts` — pure table tests
- [ ] `tests/corpus.test.ts` — zod + 10 correction assertions
- [ ] `convex/guidelines.test.ts` — vector vs text path (embed every chunk for the vector-path test)
- [ ] `convex/seed.test.ts` — idempotency, counts, flags, aggregate recount, text-lint
- [ ] `convex/profiles.test.ts`, `convex/demo.test.ts`
- [ ] `tests/env.test.ts` — git ls-files, `.env.example`, secret patterns
- [ ] `.gitignore`: add `!.env.example`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phone loads deployed HTTPS shell at phone width | FND-01 / FND-07 | Needs real device + Vercel deploy | Open villi.tech (or Vercel URL) on phone |
| `/demo?as=father` shows father profile on deploy | FND-06 | Deployed environment | Open URL on phone, confirm five meds |
| Seed < 60 s on real deployment | FND-05 | Timing on cloud deployment | `time npm run seed` |
| Voyage live search returns `path: vector` | FND-04 | Needs real key | `npm run embed && npm run smoke:search` |
| Seed counts in Convex dashboard | FND-05 | Dashboard UI | Open dashboard Data tab |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
