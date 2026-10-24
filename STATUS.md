# Status (overnight run, 2026-10-24)

Works / Partial / Broken / Cut, how it was verified, and where it lives. "Tests" means vitest + convex-test with Claude, openFDA and Voyage scripted; nothing here was run against a live deployment (no `.env.local` in this worktree), and the UI was not opened in a browser (no Convex backend to render against).

| Feature | Status | Verified by | Files |
|---|---|---|---|
| Pill flow: no-concern repair, canonical label prefetch, dose questions refused (A1) | Works | `convex/pillflow.test.ts`; agent prefetch by code read | `convex/lib/safety.ts`, `convex/agent.ts`, `convex/lib/answerSchema.ts`, `convex/answers.ts` |
| Red-team fixes (A2) | Works | `convex/redteam.test.ts`, `convex/community.test.ts` | `convex/lib/safety.ts`, `convex/community.ts`, `convex/moderation.ts`, `convex/canonicalize.ts` |
| Corpus source check (A3) | Works (Claude-checked, not clinician-reviewed) | `convex/corpus.test.ts`; sources read on the web | `data/guidelines.json`, `convex/guidelines.ts` |
| Cut features out of the agent (A4) | Works | tsc, tests, code read | `convex/agent.ts`, `convex/lib/prompts.ts` |
| Answer pipeline end to end (A5) | Works | `convex/pipeline.test.ts` | `convex/answers.ts`, `convex/agent.ts`, `convex/reviewer.ts` |
| Medicine list review (B1) | Works (UI not opened in a browser) | `convex/medReview.test.ts` | `convex/lib/medReview.ts`, `convex/meds.ts`, `convex/questions.ts`, `src/components/MedReview.tsx` |
| Warning-sign escalation (B2) | Works (UI not opened in a browser) | `convex/warningSigns.test.ts` | `convex/lib/warningSigns.ts`, `convex/logs.ts`, `src/components/WarningCard.tsx`, `src/components/QuickLog.tsx`, `src/components/LogCard.tsx`, `convex/sheet.ts` |
| Care-team link (B3) | Works (UI not opened in a browser) | `convex/teamLink.test.ts` | `convex/careTeam.ts`, `convex/sheet.ts`, `src/app/team/[token]/page.tsx`, `src/components/ShareWithTeam.tsx` |
| After-change follow-up (B4) | Works (UI not opened in a browser) | `convex/afterChange.test.ts` | `convex/questions.ts`, `convex/careTeam.ts`, `convex/logs.ts`, `src/components/AfterChange.tsx`, `convex/seed.ts`, `convex/profiles.ts` |
| What care teams changed (B5) | Works (UI not opened in a browser) | `convex/careOutcomes.test.ts`, `convex/seed.test.ts` | `convex/community.ts`, `convex/careTeam.ts`, `convex/agent.ts`, `src/components/CareOutcomes.tsx`, `convex/lib/seedData.ts` |
| "Something's wrong" reports (B7) | Works (UI not opened in a browser) | `convex/problemReport.test.ts` | `convex/answers.ts`, `src/app/answer/[id]/page.tsx` |
| Impact funnel and safety record (B6) | Works (UI not opened in a browser) | `convex/impact.test.ts` | `convex/impact.ts`, `convex/lib/impact.ts`, `src/app/impact/page.tsx` |
| "How Villi decides" page (B8) | Works (not opened in a browser) | build + code read of each sentence | `src/app/how/page.tsx` |
