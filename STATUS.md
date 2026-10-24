# Status (overnight run, 2026-10-24)

Works / Partial / Broken / Cut, how it was verified, and where it lives.

- **Tests** means vitest + convex-test with Claude, openFDA and Voyage scripted (`testing/fetchMock.ts`). 17 files, 82 tests, all passing.
- **Local UI** means I opened it at 320 px in the in-app browser against an **anonymous local Convex backend** (`CONVEX_AGENT_MODE=anonymous`, no account, no cloud, no keys), seeded with `seed:run`, with real openFDA label lookups. No Anthropic key was available, so nothing that calls Claude ran live (checks, follow-ups, vision, moderation; moderation failed closed to "private", as designed).
- **Nothing ran on your dev or prod deployment** (no `.env.local` in the worktree; I did not copy secrets). The 50-check live run in the brief's C1 is still yours to do.

| Feature | Status | Verified by | Files |
|---|---|---|---|
| Pill flow: no-concern repair, canonical label prefetch, dose questions refused (A1) | Works | `pillflow.test.ts`; prefetch by code read | `convex/lib/safety.ts`, `convex/agent.ts`, `convex/lib/answerSchema.ts`, `convex/answers.ts` |
| Red-team fixes: numerator lint, counts are people, new-profile throttle, catalog hygiene, sports drinks isotonic, swap source (A2) | Works | `redteam.test.ts`, `community.test.ts` | `convex/lib/safety.ts`, `convex/community.ts`, `convex/moderation.ts`, `convex/canonicalize.ts`, `convex/lib/seedData.ts` |
| Corpus source check: sections, verified flags, corrections (A3) | Works (Claude-checked, not clinician-reviewed) | `corpus.test.ts`; sources read on the web; local UI shows the citation sheet text | `data/guidelines.json`, `convex/guidelines.ts`, `src/app/answer/[id]/page.tsx` |
| Cut features out of the agent (A4) | Works | tsc, tests, code read | `convex/agent.ts`, `convex/lib/prompts.ts`, `convex/community.ts` |
| Answer pipeline end to end (A5) | Works | `pipeline.test.ts` | `convex/answers.ts`, `convex/agent.ts`, `convex/reviewer.ts` |
| Medicine list review (B1) | Works | `medReview.test.ts`; local UI with real openFDA labels for all 5 demo medicines | `convex/lib/medReview.ts`, `convex/meds.ts`, `convex/questions.ts`, `src/components/MedReview.tsx` |
| Warning-sign escalation (B2) | Works | `warningSigns.test.ts`; local UI (card on save, sheet section, impact count) | `convex/lib/warningSigns.ts`, `convex/logs.ts`, `src/components/WarningCard.tsx`, `QuickLog.tsx`, `LogCard.tsx`, `convex/sheet.ts` |
| Care-team link (B3) | Works | `teamLink.test.ts`; local UI in two tabs (create, open, respond, sheet shows it, revoke → "expired") | `convex/careTeam.ts`, `convex/sheet.ts`, `src/app/team/[token]/page.tsx`, `src/components/ShareWithTeam.tsx` |
| After-change follow-up (B4) | Works | `afterChange.test.ts`, `seed.test.ts`; local UI (seeded demo card, Worse → soft card) | `convex/questions.ts`, `convex/careTeam.ts`, `convex/logs.ts`, `src/components/AfterChange.tsx`, `convex/seed.ts`, `convex/profiles.ts` |
| What care teams changed (B5) | Works; the agent tool is untested live | `careOutcomes.test.ts`, `seed.test.ts`; local UI (community care tab) | `convex/community.ts`, `convex/careTeam.ts`, `convex/agent.ts`, `src/components/CareOutcomes.tsx`, `convex/lib/seedData.ts` |
| Impact funnel and safety record (B6) | Works | `impact.test.ts`; local UI (funnel showed the link answer) | `convex/impact.ts`, `convex/lib/impact.ts`, `src/app/impact/page.tsx` |
| "Something's wrong" reports (B7) | Works (UI not clicked; no final answer existed locally without a key) | `problemReport.test.ts` | `convex/answers.ts`, `src/app/answer/[id]/page.tsx` |
| "How Villi decides" page (B8) | Works | local UI; every sentence checked against the code | `src/app/how/page.tsx` |
| Second phone on the same profile (B9) | Works (UI not clicked through on two phones) | `deviceLinks.test.ts` | `convex/profiles.ts`, `src/components/DeviceLinks.tsx`, `src/app/page.tsx` |

## C1: what ran, and what didn't

The brief's C1 live table (each agent check three times on dev) **could not run**: no deployment and no Anthropic key in this worktree. What I could run against the local backend:

| Step | Result | Notes |
|---|---|---|
| `npx convex dev --once` (anonymous local) | Pushed the full schema and all functions; codegen output identical to the committed `_generated` files | Confirms the additive schema deploys cleanly |
| `seed:run` | 51 chunks, 67 profiles, 1,500 logs, 83 care-team answers inserted, 1.8 s | Voyage skipped (no key), as expected |
| Clone "my dad" (`/demo?as=father`) | caregiver, "Checking for your parent", 5 meds, demo two-week card | |
| Medicine list review | All 5 rows from real openFDA labels within seconds: metoprolol ER flagged (ER + swallow whole), pantoprazole flagged (PPI chunks + mannitol + do not crush), Tylenol liquid flagged (sorbitol), loperamide "Nothing found in the sections checked" with the sections listed (I did not read the ondansetron row) | Found and fixed: quotes started with "4 Administration" / a table header; two chips both read "Aust Prescr 2013" |
| Warning-sign log ("dizzy and peeing less", Worse) | Card shown at once, sheet lists "dark or less urine, dizziness or lightheadedness", impact counts 1 dehydration card | Moderation failed closed (no key) → "private" |
| Care-team link | Created, opened in a second tab, recorded "Reviewed: form changed" + note + new form; the family's sheet showed "Recorded through the care-team link…"; revoke flipped the open tab to "This link has expired" | Found and fixed: the seeded demo question showed unbadged |
| Two-week card | Worse → "Worth telling the care team." + soft card; the card left the home screen | |
| `/impact`, `/community`, `/how`, `/sheet` at 320 px | No horizontal overflow, no console errors | Found and fixed: seeded care-outcome counts were lower than seeded because of profile collisions |
| Agent checks (metoprolol, crush follow-up, Gatorade, pantoprazole, zorblatrin, dose question, yellow oval) | **Not run** | Needs your dev deployment and key |

Note on tooling: in the in-app browser's 320 px emulation, coordinate clicks did not land on the right element, so I drove buttons through the DOM. That's a tool quirk, not an app bug; the page measured 320 px wide with no overflow.
