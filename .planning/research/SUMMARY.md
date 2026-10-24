# Project Research Summary

**Project:** Villi (Cal Hacks 13.0, solo build, ~34 hours, ends Sunday 2026-10-25)
**Domain:** Mobile-first consumer health web app for short bowel syndrome (SBS) and ileostomy/colostomy; Claude tool-use agent with vision inside Convex; anatomy-stratified community evidence
**Researched:** 2026-10-23
**Confidence:** MEDIUM-HIGH overall (HIGH for Convex limits, openFDA shapes, Claude API rules; MEDIUM for clinical wording sourced from paywalled or secondary text, Voyage unpaid-tier limits, and the Anthropic SDK inside Convex's default runtime)

---

## Executive Summary

Villi is an anatomy-aware "can this body use this?" checker for what goes in the mouth (pills, drinks, foods). Experts would build it as a narrow, cited, fail-closed system: deterministic evidence retrieval (FDA label, guideline chunks), a single agent loop that can only cite what it retrieved, a second reviewer pass plus code-level lint before anything is shown, and a community layer that is invisible until moderated. Nothing in the research suggests a broader product. No product found combines anatomy-aware absorption, cited verdicts, and stratified peer evidence, so the white space is real but the bar for medical-adjacent accuracy is high.

The recommended approach is fixed by the brief and tightened by research: Next.js (App Router, thin client) plus Convex as the only backend (queries, mutations, scheduler, vector and text search, file storage, realtime subscriptions). Claude Opus 5.5 runs the agent and reviewer; Haiku 5.5 runs canonicalization and moderation. Embeddings use Voyage `voyage-4-lite` at 1024 dimensions with an automatic degrade to the Convex full-text search index. Every answer is an `answers` row whose tool trace streams to the phone via subscription. The draft lives in a separate hidden table; only an internal mutation can write the final answer. Community writes start `pooled: null` and only an internal moderation mutation can make them visible.

The main risks are (1) clinically wrong claims the brief itself makes, (2) safety gates that silently fail open (Convex actions are never auto-retried), (3) false reassurance from missing label fields, and (4) hour-2 infrastructure traps (Convex env, Voyage access, SDK runtime). Part 0 of the Pitfalls file lists the brief claims that must be corrected before any corpus text is written. Those corrections, the stack corrections, and the architecture decisions below are binding for planning.

---

## Part A: Binding Corrections (read before writing code or corpus text)

### A1. Clinical and corpus corrections (PITFALLS.md Part 0)

| # | Brief claim | Required change |
|---|-------------|-----------------|
| 1 | Remane et al. (Leipzig 2025): a whole tablet visible in the pouch indicates impaired absorption | **Misstated.** Paper says a drug in the bag does not necessarily mean efficacy changed; shells and insoluble matrices commonly remain visible. Rewrite: "An intact tablet or shell in the pouch can mean it did not dissolve, or it can be an empty shell after the drug was released. Worth showing the pharmacist; not proof either way." Cite as Remane et al., Int J Colorectal Dis 2025 (pilot: 50 interviews, 85 charts; 11 of 50 patients saw undissolved drug; over 60% not told). Do not name Leipzig as first author. |
| 2 | AGA: limit hypotonic (water, tea, coffee) and hypertonic (juice, soda) fluids | **Partly unsupported.** Hypotonic-fluid restriction applies to end-jejunostomy patients (Parrish & DiBaise). Most SBS patients with a colon tolerate hypotonic fluids. Hypertonic drinks apply to everyone. Scope the hypotonic rule by `colonInContinuity=false` / end-jejunostomy. Do not attribute tea and coffee to AGA. |
| 3 | AGA: 5-6 small meals | Say "about 6 small meals or snacks." |
| 4 | AGA: intake ~50% above estimated needs | Keep, but the headline is "maintain compensatory hyperphagia rather than restriction." Villi must never output percentage or quantity advice. |
| 5 | AGA anatomy groups (end-jejunostomy, jejuno-colic, jejuno-ileo-colic) | Keep. Residual-length thresholds (<100 cm, <65 cm, <30 cm) are SBS risk bands, not "safe above this." |
| 6 | "Practical Gastroenterology #139 (Parrish 2015)" | Fix attribution: **Chan LN, DiBaise JK, Parrish CR** (2015). Parrish is series editor and third author. |
| 7 | Parrish: ER generally avoided; liquids or crushed tablets may help | Keep, but scope the crushing chunk to plain immediate-release tablets only (`appliesTo: immediate-release`). Crushing ER or EC products defeats release mechanics. The reviewer blocks any "crush" advice paired with an ER or EC item. |
| 8 | (covered in #1) | |
| 9 | Demo diagram: ER tablet releases in ileum and ascending colon | **Clinically risky. Change it.** Most drugs are absorbed in the first ~50 cm of jejunum (AGA). Enteric coatings dissolve proximally, not in the colon. ER products need transit time through a shorter bowel. Revised narration: "this design needs time in a gut that is now shorter." |
| 10 | Sood & Tanner 2013 | Authors are **Sood, Tanner, Testro** (Aust Prescr 2013). Colostomy is not residual length: do not infer "fine" from stoma type when bowel length is unknown. A 2023 review (Expert Opin Drug Metab Toxicol) is the more current source. |
| 11 | Hong et al. 2021 (Eur J Drug Metab Pharmacokinet) | Keep the numbers (29 of 37 drugs with reduced absorption; 6 lost effect). Never present as a per-user probability. |
| 12 | "WHO/standard ORS composition" | **Ambiguous and can contradict AGA.** WHO reduced-osmolarity ORS (2003) is ~75 mmol/L Na, 245 mOsm/L, designed for acute diarrhea. SBS guidance cites 90-120 mmol/L Na. `lookup_ors` must return both formulas, labeled, and the answer must say which one the SBS source supports. Do not claim a named commercial product meets the SBS range unless its label is checked. |
| 13 | Rule 2 (no quantities) vs. ORS composition and label strengths | Define an explicit allow-list: product identity strengths (from the confirmed item) and ORS composition tables are allowed; amounts to take or drink are blocked. Test both sides with fixtures. |
| 14 | PROJECT.md: "user never waits on safety" | **Contradiction.** The draft cannot be shown until review finishes. Stream the tool trace during the wait; show the answer only at `final`. |

**Attribution fixes:** Remane (not "Leipzig" as first author); Chan, DiBaise, Parrish 2015; Sood, Tanner, Testro 2013; Hong et al. 2021 with author list; Iyer, DiBaise, Rubio-Tapia (AGA 2022). Quote at most one short phrase per source; state rule-level points in our own words.

### A2. Stack corrections (STACK.md)

| Brief says | Reality (verified 2026-10-23) | Consequence |
|---|---|---|
| `openfda.dosage_form` is a label field | **Absent** on `/drug/label.json`. It exists only on `/drug/ndc.json` (`dosage_form`, e.g. `TABLET, FILM COATED, EXTENDED RELEASE`). | First check in `fetch_label` is NDC `dosage_form` (deterministic ER/EC flag), run in parallel with the label call. |
| `inactive_ingredient` and `warnings` are fields | Only on old-format labels. Modern PLR labels use `description`, `warnings_and_cautions`, `boxed_warning`, `dosage_forms_and_strengths`, `spl_product_data_elements`, `pharmacokinetics`. | Probe a key list in order; record which sections were absent; "nothing found" must list checked sections. Sugar-alcohol checks report "could not read" when no field has text. |
| Cache whole label in Convex | One label is ~130-200 KB (OxyContin 202,600 bytes). Convex document limit is 1 MiB. | Cache trimmed, section-keyed text (cap each section ~6-8k chars). The same subset is fed to the model. |
| openFDA works without a key | 240 req/min always; **1,000 req/day per IP** without key; 120,000/day with key. Convex egress IPs are shared. | Get a free openFDA key on day 1; send `api_key=`. |
| Agent forces output via tool or sets temperature | On `claude-opus-5-5`: forced `tool_choice` (`any`/`tool`) returns **400**; `temperature`, `top_p`, `top_k` return 400 on every model since 2026-10-21; assistant prefill returns 400; `thinking: {type:"disabled"}` and `budget_tokens` return 400; default effort is `medium`. | Never send sampling params, prefill, or forced tool choice. Get JSON via `output_config.format` or `strict: true` tools with `tool_choice: auto`. Set `output_config.effort` explicitly (agent `medium`, reviewer `low`, fast tasks `low`). |
| Next.js quickstart | Official page scaffolds with `create-next-app --js`. | Use the TypeScript scaffold in STACK.md. |

**Model config (env-driven, exact IDs, no date suffixes):**
- `ANTHROPIC_MODEL_MAIN` = `claude-opus-5-5` for agent and reviewer. Omit `thinking`; append `res.content` unchanged within a loop.
- `ANTHROPIC_MODEL_FAST` = `claude-haiku-5-5` for canonicalize, moderation, translation (effort `low`).
- `claude-sonnet-5-5` is an optional follow-up tier only if Opus latency hurts. Not needed for MVP.
- Treat `stop_reason: "refusal"` as a first-class outcome (canned safe message; `status: failed` with retry). Treat `max_tokens` as failure, not repair.

**Versions to pin (npm, 2026-10-23):** Node 24.x; Next.js 16.4.3; React 19.3.1; TypeScript `~6.0.3` (do not take 7.0.x); Tailwind 4.3.3; `convex` 1.48.0; `@anthropic-ai/sdk` 1.3.0; `zod` 4.6.7; `@convex-dev/action-retrier` 0.3.1; `jspdf` 4.2.1 (browser only, dynamic import); `vitest` 5.0.5; `convex-test` 0.0.65; `@edge-runtime/vm` 5.0.0; `@types/node@^24`.

### A3. Embeddings decision (resolved in M1)

**Decision: Voyage AI `voyage-4-lite`, 1024 dimensions, called by plain `fetch` from a Convex action, with automatic degrade to a Convex `searchIndex` on `text`.** Confidence MEDIUM-HIGH.

- `POST https://api.voyageai.com/v1/embeddings` with `output_dimension: 1024`; `input_type` = `"document"` at seed time and `"query"` at search time. Batch up to 1,000 texts per request.
- Add a card on day 1 for Tier 1 limits (free tokens still apply; expected spend ~$0). Unpaid-account RPM is undocumented: treat as LOW confidence.
- Reject local transformers.js (native `onnxruntime-node`, model download on cold start, must match at seed and query time).
- Use OpenAI `text-embedding-3-small` only if a funded OpenAI key already exists. Do not install the `openai` SDK for it.
- Schema: `embedding: v.optional(v.array(v.float64()))`; vector index `by_embedding` with `dimensions: 1024`. A seed-time assert checks length equals the constant.
- `search_guidelines`: embed query, `ctx.vectorSearch(... limit: 50)`, hydrate, post-filter `anatomyScope` in JS (array fields cannot be filter fields), take top 6. On any embedding error, fall back to `searchIndex` over `text`, and log which path ran in the trace.
- Keep `[G:<chunkId>]` ids stable as `sourceId#locator` strings, not Convex `_id`, so re-seeding never breaks citations.
- Mandatory-rule chunks (for example all release-form chunks for pill queries) are always included, not only top-k. Full corpus (~10-20k tokens, prompt-cached) is a legitimate fallback.
- Note: ARCHITECTURE.md suggested the Atlas-hosted endpoint (`ai.mongodb.com`). STACK.md's direct `api.voyageai.com` is adopted here. Confirm endpoint and key on day 1.

---

## Key Findings

### Recommended Stack

Convex is the load-bearing backend (tools, scheduler, live queries, vectors, storage). Next.js is a thin client shell with no API routes for Claude; secrets live only in the Convex deployment (`npx convex env set`, separately for dev and prod). Only `NEXT_PUBLIC_CONVEX_URL` belongs in Next env.

**Core technologies:**
- **Convex 1.48.0:** DB, functions, scheduled work, vector and text indexes, file storage, realtime. Fixed by the brief.
- **Next.js 16.4.3 (App Router) + React 19.3.1:** client-only pages; deploy to Vercel with `npx convex deploy --cmd 'npm run build'` and a Production `CONVEX_DEPLOY_KEY`.
- **`@anthropic-ai/sdk` 1.3.0 + Zod 4.6.7:** Claude Messages API with tool use and vision. Zod validates everything crossing the Claude boundary; Convex `v` validators cover the Convex boundary.
- **`@convex-dev/action-retrier` 0.3.1:** retries reviewer and moderation actions with backoff; `onComplete` runs exactly once and is where the code fails closed.
- **Voyage `voyage-4-lite` (1024d):** see A3.
- **Vitest 5.0.5 + convex-test 0.0.65:** pure-function tests for lint, citations, anatomy derivation; convex-test for gating, aggregates, pooled visibility.
- **jsPDF 4.2.1:** optional one-tap PDF for Latin-script languages only. Primary export is a `/sheet/print` route with `window.print()`.

**Components decided:**
- USE `action-retrier` (reviewer and moderation). Hand-roll a fallback (attempt counter on row plus `runAfter`) if setup costs more than 20 minutes.
- SKIP `aggregate` (hand-rolled counter table is simpler), `agent` and `rag` (force Vercel AI SDK `ai@^7` and own tables), `workflow`/`workpool` (scheduled chain plus state machine is simpler), `convex-helpers` unless required.
- OPTIONAL `rate-limiter` in M7. A hand-rolled per-`anonId` check (about 10 lines) is the default.

### Expected Features

Positioning: anatomy-aware suitability of what goes in the mouth, with a pharmacist question attached. Do not build an ostomy diary, interaction checker, or reminder app.

**Must have (table stakes, P1):**
- Anatomy onboarding (tap-to-mark GutDiagram with dropdown fallback). Every answer depends on the profile.
- Pill flow: bottle-label photo or typed name (primary), cited verdict, reviewer, visible tool trace, one ASK card.
- Three visual states only: Flagged / Nothing found in sources I checked / Can't tell. Never a bare green "safe."
- Correctable identification ("Is this X?") and "can't identify" as a first-class outcome.
- Follow-up chat ("can I crush it?") with reviewer enforcement.
- Drink and food flow with ORS swap; one-tap log from the answer card; "waiting to log" list.
- Stratified counts with demo badge; empty states that still answer.
- Appointment sheet (one page, questions plus evidence) with export.
- Static red-flag panel (dehydration; high output above ~2 L/day; "contact care team or emergency services"), scope disclosure ("not an interaction checker"), privacy statement, recovery code, delete-my-data, per-anonId rate limit.
- Accessibility baseline: 44 px targets, AA contrast, text scaling, GutDiagram text alternative, reduced motion.

**Should have (differentiators, P2):**
- "I saw something" flow (chips first, optional imprint or tablet photo, closed-set `match_pill` against the user's own meds).
- Safe-swaps board (guideline-checked on submit, upvotes, anatomy filter).
- Care-team answers `[T:]`, labeled "reported by another user from their own care team."
- Clinician endorse button, badged "demo verification, not a credential check."
- Caregiver wording (role-aware copy). Multilingual (M7, first to cut).

**Defer (v1.x / v2+):** ElevenLabs read-aloud; packaged-food barcode scanning; multiple profiles; "first 90 days" guide; counts-only output chip; real clinician verification; pharmacy integration; notifications.

**Do not build (anti-features):** DMs; comment threads or free-form feed; public profiles; dosing, quantity, calorie, or meal-plan output; "stop, start, crush, or split" instructions; interaction checker; reminders; output or fluid volume tracker; pouch or supply inventory; stoma photos; free-text medical history; green "safe" verdicts; 3D anatomy; cross-user "people like you should take X" recommendations.

### Architecture Approach

A single agent loop per answer runs in one Convex internal action (hand-rolled, not `@convex-dev/agent`). Public mutations insert the answer row and enqueue work atomically. Each tool step is a mutation that appends a code-written trace summary. The model's final output is validated, saved as a draft in a hidden table, and the reviewer is scheduled in the same transaction.

**Major components:**
1. **Public API (`convex/*.ts` query/mutation):** the only browser entry point. Resolves identity via `requireProfile(anonId)`. Strict arg validators never accept `pooled`, `synthetic`, `final`, or `profileId`.
2. **Agent (`convex/agent/run.ts`, `"use node"` action):** manual `messages.create` loop, max 8 turns, 4-minute deadline, parallel `tool_use` via `Promise.all`, `profileId` injected from the server closure.
3. **Tools (`convex/tools/*`, internal only):** `get_profile`, `fetch_label` (+ cache), `search_guidelines`, `canonicalize_item`, `query_community`, `query_my_log`, `query_care_team_answers`, `query_swaps`, `lookup_ors`, `match_pill`, `submit_answer`. M2 stubs return honest empty results.
4. **Reviewer (`convex/safety/reviewer.ts`):** deterministic lint is an unconditional gate, followed by a Claude review. Revised output may only remove or reword; its citation set must be a subset of the draft's.
5. **Hidden `answer_reviews` table:** draft and reviewer decision. Only `answers.finalize` (internal) writes `answers.final`.
6. **Moderation (`convex/safety/moderate.ts`):** canonicalize, FAST classify, then `moderation.apply` flips `pooled` and `applyPooledTransition` updates counters.
7. **Aggregates:** one counter row per (itemId, anatomyKey), split `real` and `synthetic`, updated only by `applyPooledTransition`.
8. **Identity (`lib/identity.ts`):** `anonId` (random UUID in localStorage) used as a bearer capability (~122 bits). Skip Convex Auth (beta; Next.js server support incomplete). `/demo?as=father` and `/demo?as=peer` clone a template profile into a fresh anonId, gated by a `DEMO_MODE` env flag.
9. **Next.js client:** `"use client"` pages, `useQuery` and `useMutation` only, trace rendering, GutDiagram.

**Structural decisions:**
- **Hidden `answer_reviews` table:** Convex cannot hide fields from a query that returns a whole document. One row with `draft` would leak unreviewed text through one careless `return ctx.db.get(id)`. Public `answers.get` returns an explicit projection; `final` is shown only at `final` or `blocked`.
- **Scheduled actions are not retried:** Convex actions are at-most-once. Model each answer as a state machine on the row: `queued -> agent_running -> drafted -> reviewing -> final | blocked | failed`. Each transition is a compare-and-set mutation. Use `action-retrier` for retries with an `onComplete` that fails closed. A **watchdog** (cron sweep, also `runAfter` 90-120 s) advances or marks `failed` stuck rows (answers `running` or `reviewing` over 5 minutes; `pooled: null` rows older than 2 minutes get re-enqueued, capped). Trace appends carry `attempt` or `stepIndex` and ignore duplicates. Scheduling from a mutation is atomic; from an action it is not.
- **Counts increment on approval, not on write:** the only path that changes counters is the internal mutation that sets `pooled: true`, and it decrements on reversal. Community queries filter `pooled === true`. `rebuild` must equal live counters (test with random transitions).
- **Anonymous bearer identity:** anonId is never returned by any query. Every function takes anonId and calls `requireProfile`. Clearing storage loses the profile (accepted; the appointment sheet is the portable artifact).
- **Stub profile form in M1/M2:** dropdown profile plus `/demo` clone is built before onboarding, so the M2 pill flow runs without M3.
- **`"use node"` file split:** Claude-calling files (`agent.ts`, `reviewer.ts`, `moderation.ts`, `canonicalize.ts`) use `"use node"` and export only `internalAction`. Queries and mutations live in default-runtime files, and default files must not import `"use node"` files. `convex/lib/*` is pure TS importable from both. Run a 15-minute M1 spike: if the SDK works in a default-runtime action, drop `"use node"`. Do not spend longer.
- **Vision via storage URL:** `ctx.storage.getUrl()` as `{type:"url"}` image source. Client downsizes to ~1568 px long edge JPEG (also strips EXIF/GPS). `<input type="file" accept="image/*" capture="environment">` plus a library path.
- **Delete photos after extraction:** after the vision step extracts name and strength, `ctx.storage.delete` the photo unless the user explicitly saves it. Storage URLs are public and non-expiring; bottle labels carry patient name, DOB, and prescriber. Say so in onboarding copy and README.
- **Diagram payloads are looked up, not generated:** each guideline chunk carries a fixed `diagram: {segmentIds, mode, label}`. The agent returns only `diagramChunkId`; code resolves it and verifies that chunk was cited. Null if no eligible chunk.
- **Model never picks ids:** `profileId`, `anatomy`, and `pooled` come from server closures or the answer row. Tool schemas contain only item, query, and section parameters.
- **Trace is code-written:** summaries like "search_guidelines: 4 chunks, top G:aga-07," never model prose. Only phase labels and trace steps are streamed. Draft tokens are never streamed.
- **Convex env is separate from Next env:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_MAIN`, `ANTHROPIC_MODEL_FAST`, `VOYAGE_API_KEY`, `OPENFDA_API_KEY`, `DEMO_MODE` set with `npx convex env set` for dev and `--prod`.

### Critical Pitfalls

1. **Hallucinated or misattributed citations pass the reviewer.** Validate citations in code against a run-scoped registry (ids retrieved this run, anatomy scope match, quote as normalized substring, `C:` fraction equals aggregate, `L:` section present and non-empty). Re-run after any reviewer edit. Uncited claims are deleted, not repaired.
2. **False reassurance from silence.** Code computes `sourcesChecked` and `sourcesUnavailable`. If release form is unknown or key sections are empty, force `confidence: low` and ask a pharmacist question about the gap. "No concern" requires a positive immediate-release determination plus successful label and guideline retrieval. `inactive_ingredient` was missing in 100/100 sampled metformin labels.
3. **Medication advice leaks** (stop, crush, split, dose; paraphrase). Layered: deterministic verb and number-plus-unit pre-filter with the A1 #13 allow-list; label quote for "swallow whole"; fixed canned line ("don't change or stop on your own; ask your prescriber or pharmacist"); ER/EC plus crush short-circuits to label quote and ASK; reviewer fixtures include adversarial paraphrases.
4. **ER vs IR collapse.** Metformin generic search returned 355 labels mixing IR and ER. Resolve identity from the user-confirmed name and strength plus NDC dosage form; candidates that disagree on release form produce "which is on your bottle?" Canonical pill key = (ingredient, releaseForm); `canonicalize_item` never merges across release form. Test metoprolol tartrate vs succinate and bupropion IR/SR/XL. Filter `route: ORAL`; prefer `is_original_packager`.
5. **Invented diagram claim.** Lookup-only payloads (see Architecture). Labels are builder-written and fact-checked once.
6. **Community stats mislead** (small n, self-selection, double counting, ER/IR mix). Count distinct profiles per item x anatomy. Hide or label cells under 5 profiles. Show denominators and "self-reported, not a trial." Community counts never change a guideline flag (test: ER tablet with 19/19 "helped" still flags).
7. **Injection and bad advice through the pool.** Counters increment on approve only. The agent never sees raw free text from other users, only structured fields plus a moderation-produced neutral summary, wrapped as untrusted data. Drop others' `note` fields entirely. Add three injection fixtures.
8. **Pill misidentification and photo privacy.** Two steps: vision extracts verbatim printed fields with per-field legibility; UI confirms ("I read: metoprolol succinate ER 50 mg. Correct?") before `fetch_label`. `match_pill` is a closed-set match against the user's own meds, reported as "possible match." Delete photos after identification.
9. **Scheduled actions not retried; manual retries duplicate.** State machine plus watchdog plus idempotent transitions. Kill-action test: UI shows the fallback, never the draft.
10. **Convex limits and thinking blocks.** Trace rows hold summaries (<=300 chars), not raw tool results, to stay well under 1 MiB and avoid large subscription pushes. If the loop spans actions, persist content verbatim including thinking blocks. Do not rebuild history from the trace summary.

### Stack and build hazards (hour-2 traps)

- Convex fails to start: check `NEXT_PUBLIC_CONVEX_URL` (needs `npx convex dev`), dev-vs-prod env drift, and a `"use node"` file also exporting a query or mutation.
- Vercel and phones: `NEXT_PUBLIC_*` is inlined at build time (redeploy on change). Prod Convex is an empty database until `npx convex run --prod seed:run`. Deploy a "hello, phone" smoke in M1.
- Live demo: use a personal hotspot, not venue Wi-Fi. Put the `*.vercel.app` URL in a QR code. Keep a labeled screen recording as last resort. Camera requires HTTPS.

---

## Implications for Roadmap

Milestones are the brief's M1-M8, in order. Each ends with a phone smoke test and a commit. Cut order is at the bottom of this section.

### Phase M1: Foundation (data, corpus, safety contract, deploy)
**Rationale:** Everything later depends on the schema (complete in M1), the citation and item-key contracts, the corpus ids, and a live deployment. Embedding dimension, item key, and vector index are expensive to change later.
**Delivers:** Next.js + Convex scaffold with TypeScript pins; `convex.config.ts` with `action-retrier`; complete `schema.ts` (all tables, both vector indexes at 1024 dims, `pooled: v.union(v.boolean(), v.null())`, `answer_reviews`, `fda_label_cache`, `aggregates`); `lib/` skeleton (`identity`, `anatomy`, `citations`, `lint`, `schemas`, `anthropic`, `embed`); `data/guidelines.json` with 40+ cited chunks (A1 corrections applied, `appliesTo`, `anatomyScope`, fixed `diagram` payloads) and precomputed Voyage embeddings; synthetic seed (`npm run seed`, under 60 s, idempotent, `synthetic: true` on every row, writes `pooled: true` directly); template profiles (father, peer); `/demo?as=...` clone route and dropdown profile form (stub); openFDA key; Voyage card; Vercel and Convex prod deploy with `check-env`.
**Uses:** Convex, Next.js, Voyage, openFDA, Zod.
**Implements:** Public API boundary, identity helper, state-machine schema, counter schema.
**Avoids:** Pitfalls 1, 4, 5, 12, 17, 18, 19, 20, 22.
**Research flag:** NEEDS SPIKE (Voyage account limits; Convex env wiring; Anthropic SDK default-runtime vs `"use node"`, 15-minute spike).

### Phase M2: Pill flow end to end (the shippable core)
**Rationale:** The hero feature and the "if only this ships, Villi still demos" core. Depends on profile (stub), corpus, and the answers lifecycle. Build the fake-agent subscription first to prove streaming before spending model budget.
**Delivers:** `answers.start/get`, state machine and watchdog, `ToolTrace` component with a fake agent; tools `get_profile`, `fetch_label` (NDC dosage form first; label sections probed in order with absence reporting; cached 30 days, negatives 1 day), `search_guidelines` (Voyage with searchIndex fallback), `submit_answer`; real loop with photo upload (storage URL source, client downscale), verbatim extraction and "Correct?" confirm; `saveDraft` (atomic schedule), reviewer action (deterministic lint plus Claude review, subset-of-citations rule), `finalize`, blocked and error fallbacks; `AnswerCard` with citation resolution, unidentified state, and `QuestionCard` ("Add to appointment sheet" writes from `final.ask` after finalize); fixture tests (reviewer blocks dose-change, crush paraphrase, fake citation, wrong `C:` fraction, empty label sections, injection); photo deletion after extraction; Opus 5.5 smoke test with no forced tool_choice and no sampling params; spike `tools` + `output_config.format` composition (if it fails, use a second no-tools `messages.parse` formatting call).
**Uses:** Opus 5.5 (agent, reviewer), Haiku 5.5 (lint-adjacent tasks if needed), openFDA, Voyage, action-retrier.
**Implements:** Agent loop, reviewer gate, trace-as-subscription, citation registry.
**Avoids:** Pitfalls 1, 2, 3, 8, 10, 13, 14, 15, 16, 26, 27, 28.
**Exit test:** father profile plus typed ER drug plus bottle photo produces a validated cited answer on a real phone, with the photo deleted.
**Research flag:** NEEDS RESEARCH-PHASE (SDK runtime; structured output composed with tools; action-retrier `onComplete` typing; openFDA ranking across the six demo meds; NDC flag fires for ER and EC; sorbitol appears in `spl_product_data_elements` for the liquid).

### Phase M3: Onboarding, GutDiagram, meds, follow-up
**Rationale:** Replaces the stub profile with tap-to-mark anatomy. Follow-up chat reuses the agent with `parentId` and must be reviewer-gated, since "can I crush it?" is the most likely misuse.
**Delivers:** `GutDiagram` SVG (8 paths, no animation, dashed removed segments, CSS pulse only, text alternative); shared `anatomy.ts` derivation with contradiction handling (ask, never guess; `unknown` bowel length fails to the cautious scope); onboarding with the dropdown kept as "I'd rather describe it"; meds add by photo or typing; follow-up chat via `answers.start({kind:"followup", parentId})` seeded with the parent final and trace summary; diagram highlight in `AnswerCard` from chunk-resolved payloads; short-circuit for ER/EC plus crush follow-ups to label quote and ASK.
**Uses:** Next.js, Tailwind 4 (`motion-safe:`), Convex.
**Implements:** Anatomy derivation, diagram resolution.
**Avoids:** Pitfalls 5, 9, 3 (follow-up), 10.
**Research flag:** STANDARD (SVG and form patterns). Anatomy derivation tests are the risk, not research.

### Phase M4: Drink flow, canonicalization, log, moderation, counts
**Rationale:** Shares the agent and canonicalization with pills. Community counts are the core "people like you" payoff and the largest correctness risk (counters must match pooled rows).
**Delivers:** `items` vector index and `canonicalize_item` (embed, `vectorSearch` limit 5, FAST "same item?" confirm above a threshold calibrated on ~20 examples, starting near 0.85; `getOrCreate` keyed by slug); `logs.submit` (`pooled: null`, anatomy snapshot server-side); moderation action and `moderation.apply` (pooled flip plus `applyPooledTransition`); deterministic backstop for drink rules (hypertonic, sugar alcohol, hypotonic scoped by anatomy); ORS swap via `lookup_ors` returning both formulas; `query_community` on real aggregates with demo badge and "too few reports" gate; live count widget ("now") beside snapshot citations; second-device demo via `/demo?as=peer`; sweeper cron for `pooled: null` rows.
**Uses:** Haiku 5.5 (canonicalize, moderate), Voyage, action-retrier.
**Implements:** Pooled-by-construction writes, transition-based counters.
**Avoids:** Pitfalls 6, 7, 12, 22.
**Tests:** pooled gating (`null` and `false` invisible); counter rebuild equals live; moderation fixtures (10); release-form split (metoprolol, bupropion); "counts never change a guideline flag."
**Research flag:** NEEDS RESEARCH-PHASE (canonicalize similarity threshold calibration).

### Phase M5: Community (swaps, care-team answers, endorse)
**Rationale:** Reuses the pooled pipeline unchanged; only the moderation prompt branches by table. Swaps must not ship without moderation and the guideline check (the soda-swap rejection test is mandatory).
**Delivers:** Safe-swaps board (guideline check in the moderate action with deterministic backstop; upvotes; anatomy filter); care-team answers logged from the appointment sheet, surfaced as `[T:]`; clinician endorse with inline "demo verification, not a credential check" badge and no effect on ranking; endorsements seeded with `synthetic: true`; injection fixtures on swaps and care-team text.
**Uses:** Haiku 5.5 (moderation); Opus 5.5 only if the reviewer needs it.
**Avoids:** Pitfalls 7, 11, 12.
**Research flag:** STANDARD (pattern reuse from M4).

### Phase M6: "I saw something" and appointment sheet
**Rationale:** The sheet is a P1 deliverable (Microsoft evidence) and must stay one page. "I saw something" is P2 and reuses the closed-set match and neutral wording.
**Delivers:** Appointment sheet (queries over `questions`, own pattern labeled "my pattern, n=3, patient-reported," meds with last-answer flags) rendered at `/sheet/print` with `window.print()`; markdown download; optional jsPDF button only for Latin-script languages; "I saw something" chips (shape, colour, size), optional imprint or tablet photo (deleted after use), `match_pill` deterministic scoring over the user's own meds, cited neutral explanation ending in ASK (shell or undissolved wording per A1 #1).
**Uses:** Opus 5.5 (explanation), Convex queries; no new packages.
**Avoids:** Pitfalls 8, 21, 30.
**Research flag:** STANDARD for the sheet; NEEDS CHECK for `match_pill` tuning if imprint scoring is attempted.

### Phase M7: Multilingual, polish, README and DEMO
**Rationale:** Multilingual is verification, not rework: `profile.language` is already in `get_profile` and the M2 system prompt. Run the reviewer on the English canonical answer, translate validated fields with Haiku, and re-verify citation tokens by count equality. Keep the English version stored.
**Delivers:** Language selection in onboarding; translation of validated fields only; post-translation citation-token equality check; empty, error, and loading states; accessibility pass; warm-up script (pre-warm demo drugs, label cache, one real run per demo prompt); golden-set eval (20 items: 3 ER, 2 EC, 2 sorbitol liquids, 3 plain IR, 2 ER/IR ambiguous names, 3 unidentifiable or typo photos, 5 adversarial prompts); README with the literal Convex feature mapping, failure-modes table, top-of-page synthetic-data disclosure, limitations (small n, pilot evidence), path-to-production; DEMO.md (two-minute script around the father profile, revised diagram narration).
**Uses:** Haiku 5.5 (translation); rate-limiter component only if already working.
**Avoids:** Pitfalls 12, 16, 18, 21, 24, 25.
**Research flag:** STANDARD for README and DEMO; translation safety needs a fixture run, not research.

### Phase M8: Stretch (cut first)
Packaged-food labels (only if the validator covers the new source type); ElevenLabs read-aloud; "first 90 days" guide per anatomy. Skip unless M7 is complete by Saturday midday.

### Cut order (if time runs out, cut from the bottom)
1. M8 entirely.
2. Multilingual (M7 translation), keeping English only.
3. Care-team answers and clinician endorse (M5 parts that are not swaps).
4. "I saw something" imprint or photo path (keep chips and text only).
5. Safe-swaps board (M5), keeping logs and counts.
6. Never cut: M1 safety contract, M2 pill flow with reviewer and lint, M3 anatomy profile (or dropdown fallback), M4 pooled moderation and counts with demo badge, red-flag panel, scope disclosure, delete-my-data.

This follows the brief's "cut from the bottom" rule, the features priority matrix, and the Pitfall 23 time-box. The builder should confirm it at the M2 checkpoint.

### Phase Ordering Rationale
- M1 before anything: schema, corpus ids, and embedding dimension are expensive to change. Stub profile and `/demo` make M2 possible without M3.
- M2 before community: the pill flow proves the safety gate, which every later feature reuses.
- M4 before M5: swaps and care-team answers reuse the pooled pipeline and counters.
- Diagram work (M3) only after the M2 safety plumbing; SVG polish is the main scope-creep risk.
- The appointment sheet waits for `questions` (M2) and care-team answers (M5), so it is last among user-facing features.

### Research Flags

**Needs deeper research or spike during planning:**
- **M1:** Voyage account limits and endpoint (api.voyageai.com vs Atlas); Anthropic SDK default-runtime vs `"use node"`; `convex dev` env wiring.
- **M2:** `tools` plus `output_config.format` composition; action-retrier `onComplete` and enqueue atomicity; openFDA ranking across demo drugs; NDC flag coverage.
- **M4:** canonicalize similarity threshold calibration; `pooled: null` watchdog timing.
- **M6:** `match_pill` scoring if imprint matching is attempted.

**Standard patterns (skip research-phase):**
- **M3:** SVG and form patterns; anatomy derivation is a unit-test task.
- **M5:** pattern reuse of the M4 pooled pipeline.
- **M6 (sheet):** `window.print()` route and markdown.
- **M7:** README, DEMO, golden-set run.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (versions, Convex wiring, openFDA shapes, Claude API rules); MEDIUM (Voyage unpaid limits, SDK default runtime, tools plus structured output) | Versions read from npm 2026-10-23; openFDA behavior verified with live calls; Claude rules from bundled API reference. |
| Features | MEDIUM | Clinical claims HIGH (peer-reviewed or society guidance). Competitor inventory MEDIUM to LOW (listings, vendor pages, no independent reviews). |
| Architecture | HIGH (Convex limits and semantics); MEDIUM (Workpool and action-retrier APIs; default-runtime SDK untested); our own design for safety gating | Convex limits from official docs and the repo's `_generated/ai/guidelines.md`. Hidden-table and fail-closed patterns are our synthesis. |
| Pitfalls | MEDIUM-HIGH | Convex, Claude, openFDA verified. AGA wording MEDIUM (paywalled, slide-deck read). Latency and cost estimates MEDIUM-LOW. iOS camera behavior LOW (test on device). |

**Overall confidence:** MEDIUM-HIGH. Safe to plan from. Unresolved items below are time-boxed spikes, not blockers.

### Gaps to Address

- **Voyage unpaid-account rate limit:** undocumented; treat as LOW. Add a card on day 1 and verify in the dashboard. Fallback: searchIndex (already designed).
- **Voyage endpoint:** STACK says `api.voyageai.com`, ARCHITECTURE says Atlas `ai.mongodb.com`. Confirm on day 1; the `embed()` wrapper isolates the change.
- **Anthropic SDK in Convex default runtime:** untested. Run the 15-minute spike in M1; default to `"use node"` if it fails.
- **`tools` + `output_config.format` in one request:** unverified. Spike in M2; fall back to a second no-tools `messages.parse` formatting call.
- **action-retrier vs Workpool:** STACK chose action-retrier; ARCHITECTURE chose Workpool. Decision here: action-retrier (smaller, verified README). Either way the state machine and watchdog are required because the at-most-once rule still applies.
- **Label size:** OxyContin ~200 KB; 100-record sample averaged ~128 KB. Trim and cap sections regardless.
- **AGA full text:** paywalled. Wording from slide deck and summaries (MEDIUM). Verify BPA 3, 6, and 8 wording against the full article before quoting.
- **ORS formula for SBS:** SBS sodium target (90-120 mmol/L) vs WHO reduced formula (75 mmol/L). Corpus must label both. Do not claim a commercial product meets the SBS range without checking its label.
- **Sports drink sodium and sugar:** not verified against a specific label. Do not quote numbers for named products.
- **Remane wording and sample:** the brief's "whole tablet means impaired absorption" is misstated (A1 #1). Use corrected wording and disclose pilot size.
- **Ghost tablets / shells:** supported by a UCL note and a case report only (MEDIUM). Use neutral wording and the pharmacist question.
- **Dose-withdrawal drug list (beta blockers, clonidine, antiepileptics, steroids):** general principle HIGH, specific list MEDIUM. Use as examples, not an exhaustive list.
- **iOS Safari camera and HEIC:** test on a real iPhone by end of M2 and again before judging. Use `capture="environment"` plus a library path.
- **Clinical review of the corpus:** not available in this build. README must state corpus claims are builder-authored and not clinician-reviewed; clinician verification is honor-system and badged.
- **Golden-set and community evidence:** small-sample, builder-labeled. Present as such. Do not claim measured usefulness from seeded data.

---

## Sources

### Primary (HIGH confidence)
- Convex docs: scheduled functions (https://docs.convex.dev/scheduling/scheduled-functions); limits (https://docs.convex.dev/production/state/limits); vector and text search (https://docs.convex.dev/search/vector-search, /search/text-search); runtimes and actions (https://docs.convex.dev/functions/runtimes, /functions/actions); file serving (https://docs.convex.dev/file-storage/serve-files); Vercel deploy (https://docs.convex.dev/production/hosting/vercel); convex-test (https://docs.convex.dev/testing/convex-test); Convex Auth beta status (https://docs.convex.dev/auth/convex-auth)
- openFDA authentication and query syntax (https://open.fda.gov/apis/authentication/, /apis/query-syntax/); live calls to `/drug/label.json` and `/drug/ndc.json` (2026-10-23)
- Anthropic model and API reference, bundled with the claude-api skill (cached 2026-10-06): Opus 5.5 constraints, structured outputs, refusal handling, preserved thinking
- Anthropic embeddings page (https://platform.claude.com/docs/en/docs/build-with-claude/embeddings): no Anthropic embedding model; Voyage recommended
- Voyage docs (https://docs.voyageai.com/docs/pricing, /embeddings, /rate-limits): model names, 1024 default dims, `output_dimension`, `input_type`
- npm registry (2026-10-23): package versions and peer/engine fields
- Remane Y et al., Int J Colorectal Dis 2025;40(1):113 (https://pmc.ncbi.nlm.nih.gov/articles/PMC12065682/)
- Hong WB et al., Eur J Drug Metab Pharmacokinet 2021;46(4):465-78 (Europe PMC record, abstract)
- Chan LN, DiBaise JK, Parrish CR, Pract Gastroenterol #139 (2015); Parrish CR, DiBaise JK, Pract Gastroenterol #138 (2015)
- Bing Copilot medication answers, BMJ Quality and Safety 2025 (https://qualitysafety.bmj.com/content/34/2/100)
- Drug absorption from oral formulations in SBS, 2023 review (https://pubmed.ncbi.nlm.nih.gov/37668362/)

### Secondary (MEDIUM confidence)
- Iyer K, DiBaise JK, Rubio-Tapia A, AGA Clinical Practice Update on SBS (Clin Gastroenterol Hepatol 2022;20:2185-94; DOI 10.1016/j.cgh.2022.05.032). Full text paywalled; wording from ACG virtual grand rounds slides and Healio summary.
- Sood S, Tanner F, Testro A, Aust Prescr 2013;36:136-8
- WHO reduced-osmolarity ORS comparison (J Health Popul Nutr 2006 secondary summary)
- Vendor and app listings: MyOstomyLife (Coloplast), OstoBuddy, Cara Care, Spoonful, Fig
- PatientsLikeMe privacy history (WBUR 2010; MobiHealthNews 2019)
- Misinformation in peer-led health groups (PMC10546261; JMIR 2025; directional only)
- Dexterity-impaired mHealth accessibility study (PMC6329431; small n)
- Barriers to clinician use of patient-generated data (Southampton; PMC8663681)
- AHRQ Question Builder; COPD Foundation Pocket Consultant Guide

### Tertiary (LOW confidence, needs validation)
- Pill-identifier app listings (appfollow)
- Unpaid-tier Voyage limits (third-party reports)
- Ghost tablets (UCL clinical note; single case report)
- iOS Safari camera and HEIC behavior (general platform knowledge)
- Latency and cost estimates (uncached Opus loop; not measured)
- TypeScript 7.0 status (vendor and third-party blogs)

---

*Research completed: 2026-10-23*
*Ready for roadmap: yes, with Part A corrections applied to every corpus and prompt change*
