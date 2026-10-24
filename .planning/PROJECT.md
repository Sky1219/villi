# Villi

## What This Is

Villi is a mobile-first web app for people living with short bowel syndrome (SBS) or an ileostomy/colostomy, and for their family caregivers. A user photographs or describes a pill, a drink, or a food, and Villi answers one question: *can a body with this much intestine actually use this?* It puts clinical guidelines, the FDA drug label, and an anatomy-stratified community tolerance pool behind a camera. Patients teach each other what bodies like theirs tolerate, clinicians can check it, and Claude keeps it honest. Built solo for Cal Hacks 13.0 (domain: villi.tech).

Named for the intestinal villi that do the absorbing. Origin: the builder's father lost his entire large intestine and most of his small intestine and spent years in and out of hospitals. Guidelines (AGA and others) say to avoid extended-release and enteric-coated medications after major bowel resection, to prefer oral rehydration solution over hypotonic (water, tea) and hypertonic (juice, soda) drinks, and to watch sorbitol and simple sugars. Patients are almost never told any of this.

## Core Value

Photograph or type a pill and get a cited, reviewer-checked answer about whether it can work for *this user's anatomy*, ending in one question to bring to a pharmacist or doctor. If only the pill flow ships, Villi still demos.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Safety and evidence rules (these are the design, not disclaimers)**
- [ ] Three tiers of evidence in strict priority: guidelines are hard constraints; community pool is tolerance evidence (always stratified by anatomy, always with counts, never a recommendation alone); the user's own log is the strongest signal about this person but still soft. "What can I have?" is answered with *the safest version of what you want*.
- [ ] Villi never decides: it flags, cites, suggests a swap *to ask about*, and writes the question. Never tells anyone to stop, start, crush, split, or change a medication or dose. No gram/mL/calorie quantities, no meal plans.
- [ ] Every answer ends with exactly one question for a human professional, rendered as a card with "Add to appointment sheet".
- [ ] Every factual claim carries a citation: `[G:<chunkId>]` guideline, `[L:<section>]` FDA label, `[C:<n>/<total>, <anatomy>]` community, `[T:<id>]` care-team answer from another user (labeled "reported by another user from their own care team").
- [ ] Uncertainty is explicit: unidentified item → say so and ask for a name or clearer photo; "no concern found" is worded "nothing in the sources I checked" and lists them.
- [ ] Reviewer pass: every user-facing answer goes through a second Claude call that enforces the rules above and edits or blocks; decisions are logged.
- [ ] Moderation before sharing: every community artifact (log entry, swap, care-team answer, question) is screened by Claude before others can see it. Unsafe entries stay author-only (`pooled: false`) with a gentle "please tell your care team". No DMs, no comment threads, no public profiles.
- [ ] Anatomy stays coarse and records stay anonymous: no names, DOB, or free-text medical history.
- [ ] Seed data is synthetic and labeled: `synthetic: true` on every seed record, a "demo data" badge on any count that includes synthetic records, README disclosure. Clinician verification is honor-system and badged "demo verification".

**Flows (milestone order from the brief)**
- [ ] M1 Foundation: Next.js + Convex scaffold, schema and indexes, env, `data/guidelines.json` with 40+ cited chunks plus embeddings, synthetic seed script (`npm run seed`).
- [ ] M2 Pill flow end to end: photo or typed name → agent with tools (Convex functions) → draft → scheduled reviewer → final; live tool trace streamed via subscription; citations; question card.
- [ ] M3 Onboarding with the hand-authored `GutDiagram` SVG (tap-to-mark removed segments, stoma placement, guided prompts, dropdown fallback), meds list (photo or typed), follow-up chat on an answer, and diagram highlight wired into the answer card.
- [ ] M4 Drink flow, `canonicalize_item`, 5-second log entry, scheduled moderation, stratified community counts with demo badge in answers.
- [ ] M5 Community: safe-swaps board (guideline-checked on submit, upvotes, anatomy filter), care-team answers (logged from the appointment sheet, surfaced in answers), clinician endorse button with "demo verification" badge.
- [ ] M6 "I saw something" flow (shape/color/size chips, optional imprint/photo → `match_pill` → cited impaired-absorption explanation; no stoma-bag imagery) and appointment sheet with markdown/PDF export.
- [ ] M7 Multilingual (canonicalize any language; answer in profile language), mobile polish, empty/error/loading states, README and DEMO.md.
- [ ] M8 Stretch: packaged-food labels; ElevenLabs read-aloud; "first 90 days" guide per anatomy.

**Tests (minimal)**
- [ ] Reviewer blocks dose-change and uncited claims on fixtures; moderation classifies 10 fixture entries correctly; stratified counts are correct; swap guideline check rejects a soda swap.

### Out of Scope

- DMs, comment threads, public profiles — removes the main channels for bad advice and identification; the community is evidence, not a social network.
- Dosing, quantities, meal plans, or medication change instructions — Villi never decides; that's the care team's job.
- Names, DOB, free-text medical history — keeps records non-identifying and stratification meaningful.
- 3D anatomy / anatomical realism / stoma-bag imagery — costs solo-build hours, reads as gimmick next to a safety product, and can distress users. Flat friendly SVG only.
- Real clinician credential verification — honor-system for the hackathon, badged "demo verification".
- Native mobile apps — mobile-first web is enough for the demo and for "usable Monday".

## Context

- **Hackathon:** Cal Hacks 13.0, solo hacker. Started Fri 2026-10-23 ~23:00 PT; hacking ends Sunday morning (2026-10-25). Claude is the whole engineering team: plan, build, test, keep going, stop only at milestone checkpoints or for decisions that belong to the builder.
- **Tracks the design must serve:** Anthropic (named community, lived problem, one thing done well, thoughtful Claude use with known failure modes); Best People-First Hack; Best Solo Hack; Microsoft "Built for the Real World" (responsible design, end-to-end, measurable usefulness, path to production — the reviewer/moderation passes and appointment sheet are the evidence); Convex (must be load-bearing; README lists exactly which Convex features do what); Meta "Bringing People Closer Together with AI" (patients teaching each other, clinicians checking, Claude mediating). MLH Gen AI, Hacker's Choice, Commit Fellowship, .Tech domain have no design impact.
- **Full brief:** `.planning/BRIEF.md` is the authoritative source for the data model, agent/reviewer/moderation prompts, guideline corpus sources, flows, `GutDiagram` spec, seed-data shape, README contents, and DEMO.md script. (`prompt.md` at the repo root is an older draft; where they differ, BRIEF.md wins.)
- **Architecture (Convex load-bearing):** agent tools (`get_profile`, `fetch_label`, `search_guidelines`, `canonicalize_item`, `query_community`, `query_my_log`, `query_care_team_answers`, `query_swaps`, `lookup_ors`, `match_pill`, `add_question`) are Convex queries/actions; the agent runs in a Convex action and appends each tool step to the `answers` row so the UI subscription streams the trace. Shared writes land `pooled: null` and schedule moderation; the reviewer is a scheduled step after the draft, with retries; safety cannot be skipped from the client. (The user does wait for the reviewer before seeing an answer; the live tool trace covers that wait.) Community counts, swaps board, and care-team answers are live queries. Guideline chunks and canonical items live in Convex vector indexes. Photos in Convex file storage. Item × anatomy × outcome aggregates maintained on write so `query_community` is O(1).
- **Guideline corpus sources:** AGA Clinical Practice Update on SBS (Iyer, DiBaise, Rubio-Tapia); Practical Gastroenterology #139 SBS Part 4A (Parrish 2015); Int J Colorectal Dis 2025 (Leipzig) on drug dissolution in ostomy patients; Australian Prescriber 2013 (Sood & Tanner); Eur J Drug Metab Pharmacokinet 2021 systematic review; WHO/standard ORS composition. Rule-level statements in our own words, at most one short quoted phrase each, never full articles.
- **Demo:** two-minute script in BRIEF.md built around the father's profile (anatomy only): ER tablet → streaming trace → label + AGA citation → gut diagram highlights where the tablet releases over the segments he no longer has → ASK card; then crush follow-up, sports drink with ORS swap, "something sweet", live count update from a second device, "I saw something", appointment sheet export. Shown both on a real phone (deployed URL) and on a laptop at phone viewport as fallback.

## Constraints

- **Timeline:** ~34 hours of build time, ending Sunday morning 2026-10-25. Milestones build in order; cut from the bottom if time runs out.
- **Tech stack:** Next.js (App Router) + TypeScript + Tailwind; Convex (DB, functions, scheduler, vector search, file storage); Anthropic SDK with tool use and vision; openFDA drug label API cached in Convex. Prefer boring, working choices.
- **Models:** `ANTHROPIC_MODEL_MAIN` (strongest available) for agent and reviewer; `ANTHROPIC_MODEL_FAST` for canonicalization, moderation, translation.
- **Convex fallback:** if Convex is still fighting at 30 minutes, fall back to SQLite + Prisma with a simple job queue, same module boundaries — tell the builder first.
- **Accounts available:** Anthropic API key and Convex account are ready. No embeddings provider key yet (Anthropic has no embeddings API) — needs a decision in M1. ElevenLabs only for stretch.
- **Deployment:** deployed URL (Vercel + Convex cloud, villi.tech) for a real phone, plus a laptop fallback.
- **Secrets:** `.env.example` lists all keys; no secrets committed.
- **Checkpoints:** stop and show the builder after each milestone; commit after each milestone.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Convex as load-bearing backend (tools, scheduler, live queries, vectors, storage) | Serves the Convex track and gives streaming trace + realtime community for free | — Pending |
| Safety passes (reviewer, moderation) run server-side on the scheduler | User never waits on safety; client cannot skip it | — Pending |
| Single hand-authored 2D `GutDiagram` SVG reused in onboarding, answers, community | 90% of the visual payoff for a fraction of the cost; diagram only illustrates cited claims | — Pending |
| Downloads brief (`.planning/BRIEF.md`) is source of truth over root `prompt.md` | Newer version with full GutDiagram spec and updated diagram schema | — Pending |
| Embeddings provider for vector search | No key yet; options include Voyage/OpenAI embeddings or Convex full-text search as fallback | — Pending (decide in M1) |
| Demo on real phone + laptop fallback | Live camera is more convincing; fallback protects against venue Wi-Fi | — Pending |
| Hero diagram uses corrected wording: highlight missing segments + cited "designed to release slowly in a gut that is now much shorter", payload looked up from a fact-checked guideline chunk | Brief's "releases in ileum/colon" claim is unsupported (most absorption is in the first ~50 cm of jejunum; labels rarely name a segment) | — Pending |
| Research corrections (SUMMARY.md Part A) override the brief where they conflict | Several brief clinical claims, attributions, and openFDA field names were wrong | — Pending |
| Embeddings: Voyage `voyage-4-lite` 1024d with Convex full-text fallback | Anthropic has no embeddings API; Voyage is Anthropic's recommendation | — Pending |
| Drafts hidden in a separate `answer_reviews` table; the tool trace streams while safety runs | Convex can't hide fields from a whole-document query; the user waits on review but sees progress | — Pending |
| Added v1 table stakes: help-now + scope panel, pill confirm step, delete-my-data + rate limit, waiting-to-log list | Research: expected by users or needed for a public URL | — Pending |
| Vertical MVP roadmap structure | Each milestone ships a working end-to-end capability | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-23 after initialization*
