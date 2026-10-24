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
| TBD (filled by planner) | — | — | FND-01 | — | N/A | build/typecheck | `npm run typecheck && npm run build` | ❌ W0 | ⬜ pending |
| TBD | — | — | FND-02 | — | `pooled` rejects non-boolean | convex-test | `npx vitest run --project convex convex/schema.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | FND-03 | — | N/A | zod + node | `npx vitest run --project node tests/corpus.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | FND-04 | — | Embedding failure degrades to text path | convex-test + fetch stub | `npx vitest run --project convex convex/guidelines.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | FND-05 | — | All community rows `synthetic:true` | convex-test | `npx vitest run --project convex convex/seed.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | FND-06 | — | `profiles.me` never returns `anonId`; demo gated by `DEMO_MODE` | convex-test | `npx vitest run --project convex convex/profiles.test.ts convex/demo.test.ts convex/lib/anatomy.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | FND-07 | — | No secret tracked in git | node (git ls-files) | `npx vitest run --project node tests/env.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | SAFE-07 | — | Profile fields match allow-list exactly | convex-test | `npx vitest run --project convex convex/schema.test.ts` | ❌ W0 | ⬜ pending |

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
