<!-- GSD:project-start source:PROJECT.md -->

## Project

**Villi**

Villi is a mobile-first web app for people living with short bowel syndrome (SBS) or an ileostomy/colostomy, and for their family caregivers. A user photographs or describes a pill, a drink, or a food, and Villi answers one question: *can a body with this much intestine actually use this?* It puts clinical guidelines, the FDA drug label, and an anatomy-stratified community tolerance pool behind a camera. Patients teach each other what bodies like theirs tolerate, clinicians can check it, and Claude keeps it honest. Built solo for Cal Hacks 13.0 (domain: villi.health).

Named for the intestinal villi that do the absorbing. Origin: the builder's father lost his entire large intestine and most of his small intestine and spent years in and out of hospitals. Guidelines (AGA and others) say to avoid extended-release and enteric-coated medications after major bowel resection, to prefer oral rehydration solution over hypotonic (water, tea) and hypertonic (juice, soda) drinks, and to watch sorbitol and simple sugars. Patients are almost never told any of this.

**Core Value:** Photograph or type a pill and get a cited, reviewer-checked answer about whether it can work for *this user's anatomy*, ending in one question to bring to a pharmacist or doctor. If only the pill flow ships, Villi still demos.

### Constraints

- **Timeline:** ~34 hours of build time, ending Sunday morning 2026-10-25. Milestones build in order; cut from the bottom if time runs out.
- **Tech stack:** Next.js (App Router) + TypeScript + Tailwind; Convex (DB, functions, scheduler, vector search, file storage); Anthropic SDK with tool use and vision; openFDA drug label API cached in Convex. Prefer boring, working choices.
- **Models:** `ANTHROPIC_MODEL_MAIN` (strongest available) for agent and reviewer; `ANTHROPIC_MODEL_FAST` for canonicalization, moderation, translation.
- **Convex fallback:** if Convex is still fighting at 30 minutes, fall back to SQLite + Prisma with a simple job queue, same module boundaries — tell the builder first.
- **Accounts available:** Anthropic API key and Convex account are ready. No embeddings provider key yet (Anthropic has no embeddings API) — needs a decision in M1. ElevenLabs only for stretch.
- **Deployment:** deployed URL (Vercel + Convex cloud, villi.health) for a real phone, plus a laptop fallback.
- **Secrets:** `.env.example` lists all keys; no secrets committed.
- **Checkpoints:** stop and show the builder after each milestone; commit after each milestone.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Corrections to the brief (read first, these change code)

| Brief says | Reality (verified 2026-10-23) | Consequence |
|---|---|---|
| `openfda.dosage_form` is a label field | **Absent** on `/drug/label.json` results (checked OxyContin, metformin, loperamide). The `openfda` block has `brand_name, generic_name, route, substance_name, product_ndc, rxcui, unii, manufacturer_name, ...` only. | Get dosage form from the **NDC endpoint** `/drug/ndc.json` (`dosage_form` = e.g. `"TABLET, FILM COATED, EXTENDED RELEASE"`). This is a deterministic ER/EC signal and should be the first check in `fetch_label`. |
| Fields `inactive_ingredient` and `warnings` | Only present on old-format (OTC / non-PLR) labels. Modern PLR labels (OxyContin) have **no** `inactive_ingredient` and **no** `warnings`; they use `description` (inactive ingredients are in prose), `warnings_and_cautions`, `boxed_warning`, `dosage_forms_and_strengths`, `spl_product_data_elements` (flat ingredient text), `pharmacokinetics`. | `fetch_label` must probe a list of section keys with fallbacks and report which sections were absent ("nothing in the sources I checked" must list them). |
| Cache the label in Convex | One label is **~200 KB** (OxyContin: 202,600 bytes; `dosage_and_administration` alone 21 KB). Convex document limit is **1 MiB**. | Cache only a trimmed, section-keyed subset (cap each section ~6-8k chars) in `meds.fdaLabelCache`; this is also what you feed the model (cost and latency). |
| openFDA works without a key | 240 req/min and **1,000 req/day per IP** without a key. Convex cloud actions egress from shared IPs. | Get a free openFDA key now (120,000/day per key) and send `api_key=`. Treat as a day-1 task. |
| Agent forces output via tool / sets temperature | On `claude-opus-5-5`: forced `tool_choice` (`any`/`tool`) returns **400**; thinking cannot be disabled; `temperature`/`top_p`/`top_k` are rejected on every model as of 2026-10-21; assistant prefill is a 400. Opus 5.5 default effort is `medium`, not `high`. | Never send sampling params, prefill, or forced tool choice. Get JSON via structured outputs (`output_config.format`) or `strict: true` tools + prompt. Set `output_config.effort` explicitly. |
| Convex quickstart for Next.js | The official page scaffolds with `create-next-app --js`. | Use the TypeScript scaffold below. |

## Recommended Stack

### Core Technologies

| Technology | Version (npm `latest`, 2026-10-23) | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 24.x (local is 24.13.1) | Runtime for dev tooling; matches Convex's default Node 24 for `"use node"` actions | vitest 5 requires `^22.12 \|\| ^24 \|\| >=26`; Next 16 requires >=20.9; Convex supports 22 and 24 |
| Next.js | **16.4.3** (App Router, Turbopack default) | Front end, deployed on Vercel | Current stable. Nothing server-side is needed from Next: all data and AI goes through Convex, so Next is a thin client shell. Do not add Next API routes for Claude. |
| React | **19.3.1** (+ `react-dom` same) | UI | Peer range of Next 16 and `convex` both accept it |
| TypeScript | **~6.0.3** (pin; do NOT take 7.0.2) | Types | TS 7.0 (native compiler, GA July 2026) ships without a stable JS programmatic API until 7.1, which breaks typescript-eslint and other tooling. 6.0.x keeps everything working. `npm i -D typescript@~6.0.3` right after scaffold. MEDIUM-HIGH |
| Tailwind CSS | **4.3.3** with `@tailwindcss/postcss` 4.3.3 | Styling | create-next-app installs it by default. v4 is CSS-first: `@import "tailwindcss";` in `globals.css`, no `tailwind.config.js`. Dark mode via `@custom-variant dark (&:where(.dark, .dark *));` or `prefers-color-scheme` default. Use `motion-safe:` / `motion-reduce:` variants for the `GutDiagram` pulse. |
| Convex | **`convex` 1.48.0** | DB, functions, scheduler, vector + text search, file storage, realtime | Fixed by brief. `convex-test@0.0.65` and all `@convex-dev/*` components in this file are compatible (peer `convex ^1.43`-`^1.46`). |
| Anthropic TypeScript SDK | **`@anthropic-ai/sdk` 1.3.0** | Claude Messages API, tool use, vision | Latest stable (1.x). Peer `zod ^3.25 \|\| ^4`. Supports `source: {type: "url"}` images, `messages.parse` + `zodOutputFormat`, typed errors. |
| Zod | **4.6.7** | Schemas for Claude JSON outputs and tool inputs | Required peer for SDK helpers. Use Zod for everything crossing the Claude boundary, Convex `v` validators for everything crossing the Convex function boundary. |

### Claude models (env-configured, per the brief)

| Env var | Value | Used for | API settings |
|---|---|---|---|
| `ANTHROPIC_MODEL_MAIN` | `claude-opus-5-5` ($4 / $20 per MTok, 1M ctx) | Main agent, reviewer | Omit `thinking` (adaptive is always on; `disabled` and `budget_tokens` are 400s). Set `output_config: { effort: "medium" }` explicitly (default is medium; raise to `high` only if the reviewer fixtures show misses; higher effort costs latency in a live demo). No `temperature`. |
| `ANTHROPIC_MODEL_FAST` | `claude-haiku-5-5` ($0.10 / $0.50 per MTok) | `canonicalize_item`, moderation, translation | Adaptive thinking on by default; set `output_config: { effort: "low" }`. Non-default sampling params 400. |
| (optional middle tier) | `claude-sonnet-5-5` ($2 / $10) | Follow-up chat if Opus latency hurts | Only if measured; not needed for MVP |

### Database / storage / search (all Convex)

| Feature | Detail | Notes |
|---|---|---|
| Vector index | `defineTable(...).vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1024, filterFields: [...] })` | Dimensions 2-4096; max 4 vector indexes per table; `ctx.vectorSearch` works **only in actions**, returns only `{_id, _score}` (hydrate with `ctx.runQuery`), `limit` 1-256. `filterFields` supports equality (`q.eq`, `q.or`) only, not array membership: since the corpus is ~50 chunks, search with `limit: 50` and filter `anatomyScope` in JS after hydration. Dimension is fixed at index creation; changing it later means re-embedding. |
| Full-text search index | `.searchIndex("search_text", { searchField: "text", filterFields: [...] })` | Reactive, works in queries, BM25 ranking, last term is prefix-matched, English-tokenized, no typo tolerance. Use as the degraded path for `search_guidelines` and for `canonicalize_item` alias lookup. |
| File storage | `generateUploadUrl` mutation, client POSTs the blob, `ctx.storage.getUrl(id)` | URLs are **public to anyone holding the URL** and do not expire (revoke by deleting the file). Fine for a hackathon. |
| Limits to design around | Document 1 MiB; query/mutation 1 s CPU, 16k writes; action 10 min (Node) memory 512 MiB; default-runtime action memory 64 MiB; Node action arg 5 MiB; S16 (free/starter) concurrency 64 actions, 8 scheduled jobs at once | The 8 concurrent scheduled-job cap matters: seed + live demo traffic share it. Do not run the seed during the demo. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@convex-dev/action-retrier` | 0.3.1 | Retry reviewer / moderation actions with backoff; `onComplete` mutation runs exactly once | **Use** for the scheduled reviewer and moderation (see Components below) |
| `jspdf` | 4.2.1 | Client-side PDF of the appointment sheet (text layout, dynamic `import()` only on click) | Latin-script languages only (see PDF section) |
| `lucide-react` | 1.61.0 | Icons | Optional; only if you want icons without hand-drawing SVGs |
| `clsx` | latest | Class composition | Optional |
| `convex-helpers` | 0.1.129 | Only if a component demands it as a peer | Do not install unless required |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| `vitest` | 5.0.5 | Test runner | Needs Node 22.12+/24 and `@types/node` `^22 \|\| >=24` (pin `@types/node@^24`, not 26, to match the Convex Node 24 runtime) |
| `convex-test` | 0.0.65 | In-memory Convex mock for function tests | Peer `convex ^1.43` |
| `@edge-runtime/vm` | 5.0.0 | Vitest environment that approximates the Convex runtime | Required by convex-test docs |
| `tsx` | latest | Run local scripts (embedding precompute, fixtures) | Only if you add scripts outside `npx convex run` |
| ESLint | whatever create-next-app generates | Lint | Keep default (Biome is optional; do not spend time switching) |

## Installation

# 1. Scaffold (TypeScript, Tailwind, App Router, ESLint, npm are all defaults; --yes accepts them)

# 2. Pin TypeScript 6 (see above) and Node types

# 3. Convex + AI + validation

# 4. Tests

# 5. Create the dev deployment (interactive login the first time; writes .env.local with

#    CONVEX_DEPLOYMENT and NEXT_PUBLIC_CONVEX_URL). Keep this running in its own terminal.

## Decision 1: Embeddings (resolve in M1)

| Option | Free? | Dims | Hackathon verdict |
|---|---|---|---|
| **Voyage `voyage-4-lite`** | 200M free tokens per account (voyage-4 family; $0.02/M after). Docs: Tier 1 base limits (2,000 RPM; 16M TPM for lite) "require a payment method". Limits for accounts with no card are not documented (third-party reports suggest a very low RPM; treat as LOW confidence). | Default 1024; also 256/512/2048 via `output_dimension`. 32k context; `input_type: "query" \| "document"`. voyage-4 family embeddings are mutually compatible. | **Pick.** Anthropic's own recommended embeddings partner, best quality per dollar, free tokens cover the entire project (the corpus is ~50 chunks + a few thousand tiny queries). **Add a card on day 1** (free tokens still apply, expected spend $0) to get Tier 1 limits instead of the unpaid cap, because the demo makes one query embedding per scan. |
| OpenAI `text-embedding-3-small` | No free tier; needs prepaid credit ($0.02/M) | 1536 default (adjustable) | Use **only if the builder already has an OpenAI key.** Equivalent quality for this use, same raw-`fetch` wiring. Do not install the `openai` SDK (7.43.0) just for this. |
| Local `@huggingface/transformers` 4.3.1 inside a Convex Node action | Free, no key | e.g. 384 (MiniLM) | **Reject.** Needs `onnxruntime-node` as a native package via `convex.json` `node.externalPackages`, downloads the model from the HF hub on cold start (seconds, in a Lambda with 512 MiB RAM), and the model must be identical at seed time and query time. High chance of eating hours at hour 2 of 34; the brief's own 30-minute Convex tripwire argues against it. |
| Convex full-text `searchIndex` only | Free, zero keys | n/a | **Keep as the fallback, not the primary.** Lexical search misses "slow-release" vs "extended-release" vs "sustained-release" and cross-language canonicalization (M7), which is exactly what embeddings are for. But it is a 15-line safety net and it keeps the demo alive if Voyage is down or rate-limited. |
- Embed guideline chunks and seed canonical items **once in the seed action** (batch up to 1,000 texts per request, `input_type: "document"`); queries use `input_type: "query"`.
- Schema: `embedding: v.array(v.float64())`, `dimensions: 1024`. Mark `embedding` optional on the table so inserts do not fail if Voyage is down; the vector index ignores docs without a vector of the right size.
- `search_guidelines` = embed query, `ctx.vectorSearch("guideline_chunks", "by_embedding", { vector, limit: 50 })`, hydrate, filter `anatomyScope`, take top 6. On any embedding error fall back to `searchIndex` over `text`. Log which path ran in the tool trace (honest and demo-friendly).
- Keep the `[G:<chunkId>]` ids stable (use the `sourceId#locator` string, not the Convex `_id`) so re-seeding never breaks stored citations.

## Decision 2: Convex components

| Component | Version | Verdict | Reason |
|---|---|---|---|
| `@convex-dev/action-retrier` | 0.3.1 | **USE** (reviewer + moderation) | Convex actions are **at-most-once and never auto-retried**; the brief requires "retries on failure". `retrier.run(ctx, internal.reviewer.run, args, { onComplete: internal.reviewer.onDone })` retries with exponential backoff (defaults: 250 ms initial, base 2, 4 failures) and calls `onComplete` exactly once, which is where you fail closed (`reviewerDecision = { approved: false, blockedReasons: ["reviewer unavailable"] }`) so an unreviewed draft can never become `final`. Setup: `convex/convex.config.ts` with `app.use(actionRetrier)`. Risk is low. For tests, call the action/handler directly (convex-test needs components registered: `t.registerComponent(...)` or the component's `/test` helper), so keep the retrier call in a thin scheduling mutation. If the component setup costs more than 20 minutes, hand-roll: attempt counter on the row + `ctx.scheduler.runAfter(backoff, ...)` from a catching wrapper. |
| `@convex-dev/aggregate` | 0.3.4 | **SKIP** | It is a B-tree for ranked/range/sum queries. The need here is point counters keyed by `(itemId, anatomyKey)`, which is one `aggregates` row patched in the same mutation as the log insert (atomic, O(1) read). A plain table is simpler, trivially testable, and equally "Convex-load-bearing" for the README. Revisit only for a leaderboard-style feature. Hot-row OCC contention is irrelevant at demo scale. |
| `@convex-dev/agent` | 0.7.8 | **SKIP** | Peer-depends on Vercel AI SDK `ai@^7`, `@ai-sdk/provider@^4`, `@ai-sdk/provider-utils@^5`, `convex-helpers`, and Node >=22; owns its own thread/message tables. Our design needs the tool trace written onto the `answers` row and direct control of the Anthropic loop (citations, reviewer, fail-closed). Adopting it would mean two abstractions and a second model-call path. |
| `@convex-dev/rag` | 0.7.8 | **SKIP** | Same `ai@^7` coupling plus its own embedding abstraction. The corpus is ~50 hand-authored chunks with anatomy tags; a plain vector index with a post-filter is less code than configuring RAG namespaces. |
| `@convex-dev/workflow` (+ `@convex-dev/workpool`) | 0.4.10 / 0.4.14 | **SKIP** | Durable multi-step workflows are overkill for draft -> reviewer -> final. A scheduled function chain with a status field on the `answers` row is easier to reason about and to demo ("scheduled safety pass"). |
| `@convex-dev/rate-limiter` | 0.4.2 | **OPTIONAL, M7** | The deployed URL is public and unauthenticated, so anyone can burn the Anthropic key. A hand-rolled check ("reject if this `anonId` created >N answers in the last minute", using an index on `answers`) is 10 lines and needs no component. Use the component only if it is already working smoothly. |

## Decision 3: Anthropic SDK inside Convex actions

- `convex/ai/agent.ts`, `reviewer.ts`, `moderation.ts`, `canonicalize.ts`: `"use node"`, export `internalAction` only.
- `convex/answers.ts`, `logs.ts`, `swaps.ts`, `tools.ts` (queries/mutations the actions call via `ctx.runQuery/runMutation`): default runtime. A non-node file must not import a `"use node"` file.
- `convex/lib/*.ts`: pure TypeScript (prompt strings, Zod schemas, deterministic safety checks, citation parsing) importable from both.
- Quick spike at M1 (15 minutes): try the SDK in a default-runtime action first; if it works, you may drop `"use node"` for faster starts. Do not spend more than that.
- Validate every `tool_use.input` with Zod before executing; return `is_error: true` tool_results instead of throwing.
- **Never let the model pick `profileId`.** Inject it from the `answers` row. Tools take only domain args.
- Append `res.content` untouched within a loop. Do **not** persist raw content blocks across actions and replay them in the follow-up chat; persist plain `draft`/`final` JSON and start a **fresh** message list per action (answer JSON goes in as user-turn context). Thinking blocks are bound to the producing conversation, and editing history under them invalidates them (enforced for accounts created on/after 2026-08-31).
- JSON outputs for reviewer, moderation, canonicalize: `client.messages.parse({ ..., output_config: { format: zodOutputFormat(Schema), effort: "low" } })` and guard `parsed_output === null`. For the main agent's final answer JSON (`verdict, why[], diagram, ask, ...`), **spike in M2** whether `tools` + `output_config.format` compose in one request; if not, do a second no-tools `messages.parse` call that formats the final draft into the schema. (Unverified combination; docs consulted do not state it. LOW-MEDIUM.)
- Treat `stop_reason: "refusal"` as a first-class outcome. A medical-adjacent app may trip safeguards (`stop_details.category`); the answer row gets `status: "failed"` with a user-visible retry, never a silent empty answer. If M2 testing shows false-positive refusals, enable the server-side fallback (`betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"` on `client.beta.messages.create`).
- Cost control: Opus 5.5 at $4/$20 with a 5-6 turn loop is real money per scan. Feed trimmed label sections (not 200 KB), keep top-level `cache_control`, and verify `usage.cache_read_input_tokens > 0` from turn 2 on.
- Convex actions are not retried automatically; the SDK's own `maxRetries: 2` handles 429/5xx inside one call, and `action-retrier` handles whole-action failure.
- `max_tokens: 16000` non-streaming is safe. Only go above that with `client.messages.stream(...).finalMessage()`.
- Defense in depth (stack-level, high value): implement the cheap deterministic checks as pure functions in `convex/lib/safety.ts` and run them **before** the LLM reviewer: citation-presence regex (`\[(G|L|C|T):[^\]]+\]`), a dose/quantity pattern check (`\d+\s?(mg|mcg|g|ml|mL|tablets?)`), a verb check (stop/start/crush/split/skip + "your medication"), and exactly-one `ASK:` line. These are unit-testable without any API key, cover the "reviewer blocks fixtures" requirement deterministically, and fail closed if the reviewer is down.

### Vision: Convex storage URL vs base64

- Content type: the client must set `Content-Type: image/jpeg` on the upload POST so the stored blob is served with a correct type.
- **Downscale on the client before upload** (canvas, long edge <= 1568 px, JPEG ~0.85, ~200-400 KB). Phone photos are 3-8 MB (HEIC from camera roll), the API caps images at 5 MB, and large images multiply vision tokens (Opus-tier models accept up to 2576 px long edge but charge ~3x tokens). Canvas re-encode also strips EXIF/GPS, which is a privacy win for a health app. `<input type="file" accept="image/*" capture="environment">` opens the rear camera on phones.
- Fallback: if a URL fetch ever fails (404 from a deleted file), read `await ctx.storage.get(id)` -> `arrayBuffer` -> base64 -> `{type:"base64", media_type:"image/jpeg", data}`. Needs `"use node"` (`Buffer`) and the 512 MiB budget; keep as a 10-line fallback, not the default.
- Privacy: the URL is unguessable but public and permanent. After the vision step has extracted the name/imprint, **delete the stored photo** (`ctx.storage.delete`) unless the user explicitly attaches it to a log. Say so in the README.

## Decision 4: openFDA

- **Base:** `https://api.fda.gov/drug/label.json`. Add `&api_key=KEY` (free, instant email signup). Limits: **240 requests/min always; 1,000/day per IP without a key; 120,000/day per key**.
- **Query syntax:** `search=field:term`; phrase with `"..."` (URL-encode quotes as `%22`); AND = `+AND+`; OR = a bare `+` (space) between terms; wildcard prefix `openfda.brand_name:metfor*` works; `limit` (default 1; use 3-5) and `skip`; pagination via `Link: rel="next"` header (`search_after`).
- **Lookup order for `fetch_label(name)`:**
- **A query returns many labels** (307 for metformin: every repackager). Rank client-side: prefer `openfda.is_original_packager[0] === true`, prefer a result whose `openfda.brand_name` equals the query (case-insensitive), prefer the newest `effective_time`, then take one and store its `set_id`. Show the user which label was used (manufacturer + effective date); that is part of honest citation `[L:section]`.
- **No match = HTTP 404** with body `{"error":{"code":"NOT_FOUND","message":"No matches found!"}}`, not an empty 200. Handle 404 as "not found", 429 as rate limit, others as upstream error. Never let a 404 reach the model as an exception; return `{found:false}` so the agent says "unidentified, ask for the name".
- **Response shape:** `{ meta: { disclaimer, terms, license, last_updated, results: { skip, limit, total } }, results: [ { ... } ] }`. Every label section is an **array of strings** (usually length 1; long prose, may contain section numbers and "Table" text), with a sibling `*_table` array of HTML. Metadata: `set_id`, `id`, `effective_time` (YYYYMMDD), `version`. `openfda.*` fields are arrays of strings.
- **Sections to read (probe in this order, record absence):** `dosage_forms_and_strengths` (PLR labels; e.g. "Extended-release tablets: ..."), `description`, `clinical_pharmacology` / `pharmacokinetics` / `mechanism_of_action`, `how_supplied`, `dosage_and_administration` (crush/chew/split statements live here, e.g. "swallow whole"), `inactive_ingredient` (old format only), `spl_product_data_elements` (flat ingredient text, the reliable inactive-ingredient source for PLR labels, includes sorbitol/mannitol/xylitol when present), `boxed_warning`, `warnings_and_cautions` or `warnings` (old format), `spl_unclassified_section`. Cite as `[L:<section_key>]`.
- **NDC endpoint for dosage form:** `https://api.fda.gov/drug/ndc.json?search=brand_name:"OxyContin"&limit=1` -> `dosage_form: "TABLET, FILM COATED, EXTENDED RELEASE"`, `route: ["ORAL"]`, `active_ingredients: [{name, strength}]`, `pharm_class`. Also works by `generic_name:"metoprolol succinate"` (returns `TABLET, FILM COATED, EXTENDED RELEASE`). SPL dosage-form vocabulary contains `EXTENDED RELEASE`, `DELAYED RELEASE`, `ENTERIC COATED`, `FILM COATED, EXTENDED RELEASE`, `CAPSULE, EXTENDED RELEASE`, `TABLET, ORALLY DISINTEGRATING`, `SOLUTION`, etc. A string match on these is a deterministic, citable flag (cite as the NDC listing; add `[L:dosage_form]` as a pseudo-section in your own taxonomy). Run this in `fetch_label` in parallel with the label call.
- **Cache:** table `label_cache(queryKey, setId, fetchedAt, sections, dosageForms[], found)`; TTL 30 days; also cache negative results for 1 day. Do the fetch from a default-runtime action (plain `fetch`, no `"use node"`).
- The response `disclaimer` ("Do not rely on openFDA to make decisions regarding medical care") belongs in the UI footer of any label-derived claim.

## Decision 5: Appointment sheet export

| Need | Choice | Why |
|---|---|---|
| Markdown | Build the string in the client; `Blob` + `<a download>`; plus `navigator.share` (files) / `navigator.clipboard.writeText` on mobile | Zero dependencies, 20 lines. |
| PDF (universal) | A dedicated route `/sheet/print` with `@media print` styles and a **Print / Save as PDF** button calling `window.print()` | Zero dependencies, selectable text, correct fonts for every script (Hindi, Chinese, Arabic from M7 render correctly), accessible. iOS/Android print preview saves to PDF/Files. |
| PDF (one-tap download) | `jspdf` 4.2.1, **dynamic `import("jspdf")` inside the click handler**, text-only layout (`doc.text(doc.splitTextToSize(...))`, manual page breaks) | Small, works offline, deterministic output for the demo. **Limitation:** built-in PDF fonts are Latin-only; non-Latin answers render as garbage unless you embed a font. So show the jsPDF button only when `profile.language` is a Latin-script language, otherwise show only Print. |

## Decision 6: Testing (convex-test 0.0.65 + vitest 5.0.5)

- `const t = convexTest(schema, import.meta.glob("./**/*.ts"))` (glob relative to the test file; in `convex/` the default module discovery works). Use `t.run(ctx => ctx.db.insert(...))` for fixtures, `t.mutation/query/action(internal.x.y, args)`, `t.withIdentity` is unused (no auth).
- Scheduled functions: `vi.useFakeTimers()`, then `await t.finishAllScheduledFunctions(vi.runAllTimers)` to assert "log entry -> moderation sets `pooled`".
- Mocking Claude and HTTP: `vi.stubGlobal("fetch", vi.fn(...))` (the Anthropic SDK and Voyage/openFDA calls all use global `fetch`) and `vi.unstubAllGlobals()` in `afterEach`. For the unit-sized fixtures prefer **dependency injection**: handlers call `callClaudeJson(schema, prompt)` from `convex/lib/llm.ts`, which tests replace with `vi.mock`.
- Limits to know: convex-test is a mock. Cron jobs are unsupported (not needed). `vectorSearch` works but is a brute-force scan (fine for 50 chunks). Text search does **not** sort by relevance (assert membership, not order). Components need registration (see action-retrier note).
- Minimum test set from the brief and what makes each deterministic:

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Voyage `voyage-4-lite` | OpenAI `text-embedding-3-small` | Builder already holds a funded OpenAI key and does not want to touch Voyage billing |
| Manual loop on `messages.create` | `client.beta.messages.toolRunner` + `betaZodTool` | A flow with no per-step persistence (e.g., a standalone follow-up chat). It is beta, hides step boundaries, and does not auto-resume `pause_turn` |
| `"use node"` for Claude files | Default runtime for Claude files | If the 15-minute spike shows the SDK works there and cold starts hurt demo latency |
| Hand-rolled `aggregates` table | `@convex-dev/aggregate` | If you add ranked/range queries (top swaps by upvotes across 10k+ rows) |
| `typescript@~6.0.3` | TypeScript 7.0.2 | After 7.1 ships the stable JS API and typescript-eslint supports it; not during a 34-hour build |
| `window.print()` + jsPDF | `@react-pdf/renderer` | A server-rendered, branded multi-page PDF is a product requirement (it is not) |
| Convex scaffold via `create-next-app` + `npm i convex` | `npm create convex@latest` templates (`nextjs-shadcn`, `bare`, ...) | If you want shadcn/ui preinstalled. Template list was not verified for current TS/Tailwind versions, so the explicit scaffold above is the safer boring choice |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@convex-dev/agent` and `@convex-dev/rag` | Force Vercel AI SDK `ai@^7` and their own tables; duplicate the loop you must control for the reviewer/trace design | Direct Anthropic SDK in an action |
| `temperature`, `top_p`, `top_k`, assistant prefill, `thinking: {type:"disabled"}`, `budget_tokens`, forced `tool_choice` on `claude-opus-5-5` | All return 400 on current models | `strict: true` tools + prompt, `output_config.format`, `output_config.effort` |
| Date-suffixed model IDs (`claude-opus-5-5-2026...`) | Not valid; IDs are complete as given | `claude-opus-5-5`, `claude-haiku-5-5` |
| Local transformers.js embeddings in Convex | Native `onnxruntime-node`, model download on cold start, externalPackages config | Voyage via `fetch`, `searchIndex` fallback |
| `openfda.dosage_form` / `inactive_ingredient` / `warnings` as required fields | Missing on modern labels | NDC `dosage_form`, `spl_product_data_elements`, `description`, `warnings_and_cautions`, `boxed_warning` with absence reporting |
| Passing model-chosen `profileId` to tools | Prompt injection / impersonation of another user's profile | Server-injected `profileId` from the answer row |
| Public queries keyed by a guessable profile `_id` | Anyone can read any profile's log | Treat the random `anonId` (UUID in localStorage) as the capability secret; look up by index; no "list profiles" function |
| Next.js API routes or server actions for Claude | Splits secrets and logic across two backends; loses the live trace | Convex mutation -> scheduled action; client subscribes with `useQuery` |
| `html2pdf.js` / `html2canvas` | Fails on `oklch()` colors; blurry raster | `window.print()` route, jsPDF text |
| TypeScript 7.0.x in this repo | Missing JS API breaks lint/tooling | `typescript@~6.0.3` |
| `@types/node@26` | Mismatch with Convex Node 24 runtime | `@types/node@^24` |
| Running seed during the demo | Scheduled-job concurrency is 8 on the starter class | Seed once, ahead of time |

## Stack Patterns by Variant

- Ship `searchIndex` for `search_guidelines` and `canonicalize_item` first; leave the `embedding` field optional and the vector index defined.
- Add Voyage when the key is working. The agent contract does not change; only the search implementation behind the tool.
- The listed symptoms are usually (a) `NEXT_PUBLIC_CONVEX_URL` missing because `npx convex dev` was not run, (b) env vars set on dev but not prod, (c) `"use node"` file also exporting a query/mutation. Check these three before invoking the SQLite + Prisma fallback.
- Run independent tools in parallel (the model emits several `tool_use` blocks per turn; execute with `Promise.all`), prefetch `get_profile` and `fetch_label` server-side before the first model call and hand them over as the first turn, and keep `effort: "medium"`. Do not switch the agent to Haiku; keep Opus for agent + reviewer and Haiku for the rest.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `convex@1.48.0` | `react ^18 \|\| ^19`, Node >=20 | Peer deps on clerk/auth0 are optional |
| `convex-test@0.0.65` | `convex ^1.43` | Needs `@edge-runtime/vm` for the edge-runtime environment |
| `vitest@5.0.5` | Node `^22.12 \|\| ^24 \|\| >=26`, Vite `^6.4 \|\| ^7 \|\| ^8` | Do not run on Node 20 |
| `next@16.4.3` | `react ^18.2 \|\| ^19`, Node >=20.9 | Turbopack default; `middleware` is now `proxy` (not needed here) |
| `@anthropic-ai/sdk@1.3.0` | `zod ^3.25 \|\| ^4` | Same Zod instance must be used for `zodOutputFormat` |
| `@convex-dev/action-retrier@0.3.1` | `convex ^1.24.8` | Register in `convex.config.ts` |
| `@convex-dev/agent@0.7.8`, `@convex-dev/rag@0.7.8` | `ai ^7`, `convex ^1.46`, `convex-helpers ^0.1.127` | Not used; listed so nobody adds them by accident |
| `typescript@~6.0.3` | Next 16.4.3 (`typescript` is an optional peer), `convex-helpers` (`^5.5 \|\| ^6 \|\| ^7`) | |
| `jspdf@4.2.1` | Browser only | Import dynamically; it must never be imported in a Server Component or a Convex file |

## Spikes to run in M1/M2 (each <= 15-30 minutes, each has a stated fallback)

## Sources

- npm registry (`npm view`, 2026-10-23): versions and peer/engine fields for next 16.4.3, react 19.3.1, convex 1.48.0, @anthropic-ai/sdk 1.3.0, tailwindcss 4.3.3, typescript 7.0.2 / 6.0.3, convex-test 0.0.65, vitest 5.0.5, @convex-dev/{aggregate 0.3.4, agent 0.7.8, workflow 0.4.10, rag 0.7.8, action-retrier 0.3.1, workpool 0.4.14, rate-limiter 0.4.2}, jspdf 4.2.1, zod 4.6.7 (HIGH)
- https://docs.convex.dev/quickstart/nextjs: scaffold, `ConvexClientProvider` (HIGH)
- https://docs.convex.dev/functions/runtimes and /functions/actions: `"use node"` rules, Node 24/22, memory/arg limits (HIGH)
- https://docs.convex.dev/production/state/limits: action timeouts, memory, concurrency by class, vector limits (HIGH)
- https://docs.convex.dev/search/vector-search and /search/text-search: index definitions, `ctx.vectorSearch` actions-only, 256 limit, filter syntax, BM25 behavior (HIGH)
- https://docs.convex.dev/scheduling/scheduled-functions: actions at-most-once, no auto retry (HIGH)
- https://docs.convex.dev/file-storage/serve-files: public non-expiring URLs (HIGH)
- https://docs.convex.dev/components/using, https://github.com/get-convex/action-retrier README: component install, retrier API (HIGH)
- https://docs.convex.dev/testing/convex-test: vitest setup, fake timers, limitations (HIGH; `server.deps.inline` is not on that page, MEDIUM)
- https://docs.convex.dev/production/hosting/vercel: build command and deploy key (HIGH)
- https://docs.voyageai.com/docs/pricing, /embeddings, /rate-limits: models, 200M free tokens, 1024 default dims, `output_dimension`, `input_type`, Tier 1 requires payment method (HIGH for models/dims, LOW for unpaid-account limits)
- https://open.fda.gov/apis/authentication/ and /apis/query-syntax/: rate limits, query syntax (HIGH)
- Live calls to `https://api.fda.gov/drug/label.json` and `/drug/ndc.json` on 2026-10-23: field presence, array shapes, 404 body, 200 KB label size, `dosage_form` in NDC only (HIGH, first-hand)
- Anthropic SDK / model reference bundled with the Claude Code `claude-api` skill (cached 2026-10-06): model IDs and pricing, Opus 5.5 / Haiku 5.5 / Sonnet 5.5 API rules, URL image source, structured outputs, tool loop, refusal handling, preserved-thinking rules (HIGH for rules; `tools` + `output_config.format` composition unverified)
- Web search results on TypeScript 7.0 (GA 2026-07-08, no stable JS API until 7.1, Next 16.3+ builds OK): third-party and vendor blogs (MEDIUM)
- https://ai.google.dev/gemini-api/docs/embeddings: `gemini-embedding-2` exists as a further free-key option; not recommended because free-tier status was not confirmed (LOW, informational)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| convex | "Convex is the backend agents get right on the first try: an all-TypeScript reactive platform where the database, server functions, scheduling, file storage, auth, and realtime sync are one type-safe system, every function is a transaction, and `tsc` catches most mistakes before deploy. Ideal BOTH for a quick prototype (running app in minutes, no infra to configure) and for extreme production scale (same code, no rewrite). Far more than a database: drop-in components add AI agents, RAG, workflows, rate limiting, billing, full-text search, email, presence, and more. Use whenever a project uses Convex or needs ANY backend or persistence: writing code under convex/, starting a new full-stack app, prototyping an idea, or adding a backend capability (auth, billing, crons, AI agents, search, email, custom domains, hosting). Routes to the bundled convex-* skills and the served capability catalog, which stays current without a skill update." | `.claude/skills/convex/SKILL.md` |
| convex-add | "Add a capability to the CURRENT Convex app — consults the served Convex capability catalog for always-current procedures (billing, crons, auth, agent, search, …); falls back to built-in hosting or @convex-dev component search. TRIGGER when the user runs /add, or asks to add hosting/publishing or any backend capability to an existing Convex app." | `.claude/skills/convex-add/SKILL.md` |
| convex-advisor | "Read the Convex deployment's 72h insights (read limits, OCC contention), root-cause each event in code, report evidence-backed perf/cost findings with fixes." | `.claude/skills/convex-advisor/SKILL.md` |
| convex-agent | "Add an AI agent / RAG backend (@convex-dev/agent) to the Convex app." | `.claude/skills/convex-agent/SKILL.md` |
| convex-auth | "Add authentication (passkeys/OAuth) to the current Convex app, including the auth.config.ts wiring." | `.claude/skills/convex-auth/SKILL.md` |
| convex-authz | "Audit and harden a Convex app's authorization: identity-from-arg impersonation, missing per-document ownership checks, public queries leaking data by a client-supplied id, and writes into a parent/container the caller doesn't own. Scans for the 4 shapes, applies requireIdentity/requireOwner, verifies with tsc. TRIGGER on 'secure my app', 'audit auth/authz', 'who can access this data'. SKIP when there is no convex/ directory." | `.claude/skills/convex-authz/SKILL.md` |
| convex-backup | "Set up Convex backups and run a restore DRILL that proves recovery — snapshot, restore into a throwaway preview, assert the data came back — plus a schedule matched to your RPO and a gated recovery runbook." | `.claude/skills/convex-backup/SKILL.md` |
| convex-billing | "Add Stripe billing/payments to the Convex app via @convex-dev/stripe (checkout + webhook + gating)." | `.claude/skills/convex-billing/SKILL.md` |
| convex-cost | "Preview Convex spend — rank functions by bytes/documents-read × call-volume from insights, project each cost driver's growth curve, name the cheapest fix; confirm-cost for paid actions." | `.claude/skills/convex-cost/SKILL.md` |
| convex-create-component | Builds reusable Convex components with isolated tables and app-facing APIs. Use for new components, reusable backend modules, integrations, or component boundary work. | `.claude/skills/convex-create-component/SKILL.md` |
| convex-crons | "Add recurring scheduled jobs (crons) to the Convex app." | `.claude/skills/convex-crons/SKILL.md` |
| convex-deploy-guard | "Classify + announce the target Convex deployment before any deployment-affecting command; fresh explicit consent for prod actions; session read-only mode." | `.claude/skills/convex-deploy-guard/SKILL.md` |
| convex-design | "Design and build reactive, type-safe, production-grade backends on Convex. Covers schema, queries/mutations/actions, indexes, auth, file storage, scheduling, real-time multiplayer, mobile backends, and LLM/agent workflows on Convex's one-platform stack." | `.claude/skills/convex-design/SKILL.md` |
| convex-docs | "Pull version-current Convex docs for the version this project uses — pin the installed version, fetch page-as-markdown or check node_modules types, freshness hierarchy — instead of writing a possibly-stale API from memory." | `.claude/skills/convex-docs/SKILL.md` |
| convex-domains | "Point a domain you already own at your Convex app (DNS records, custom-domain attach, auth-origin rebind)." | `.claude/skills/convex-domains/SKILL.md` |
| convex-env | "Set and wire Convex deployment env vars / secrets for the app." | `.claude/skills/convex-env/SKILL.md` |
| convex-expert | "Convex backend specialist. Use this agent for any code inside a `convex/` directory — function definitions, schemas, indexes, queries, mutations, actions, HTTP endpoints, cron jobs, file storage, auth wiring, and component installation. Knows the object-form function syntax, validator patterns, resource limits, and component ecosystem that generic Claude routinely gets wrong." | `.claude/skills/convex-expert/SKILL.md` |
| convex-explain-app | "Explain an existing Convex app — data model + relationships, public vs internal functions, auth/ownership model, components, a request→data flow — read from the schema and function surface. Read-only." | `.claude/skills/convex-explain-app/SKILL.md` |
| convex-improve-convex-plugin | "Send this coding session's transcript to the Convex team for an AI post-mortem that improves the quickstart system. Run only when the user explicitly asks." | `.claude/skills/convex-improve-convex-plugin/SKILL.md` |
| convex-insights | "Query a running Convex app's logs + health in natural language (official MCP): failures, slow/expensive functions, deploy causality — scoped, evidence-backed, with a dashboard deep link." | `.claude/skills/convex-insights/SKILL.md` |
| convex-launch-readiness | "Run every Convex audit (authz, reviewer, advisor, insights) into one scored, deduped readiness report with an ordered fix plan — Lighthouse for your backend." | `.claude/skills/convex-launch-readiness/SKILL.md` |
| convex-migrate | "Migrate schema + backfill data on a deployed Convex app using @convex-dev/migrations." | `.claude/skills/convex-migrate/SKILL.md` |
| convex-migrate-rehearse | "Rehearse a live-app schema change + backfill on a snapshot-seeded preview deployment, verify, then promote the proven change to prod with the snapshot as rollback." | `.claude/skills/convex-migrate-rehearse/SKILL.md` |
| convex-monitor | "Watch for the next dev/prod error or request in a Convex app and react to it." | `.claude/skills/convex-monitor/SKILL.md` |
| convex-optimize | "Audit and optimize an existing Convex app: security, scale, upgrades, observability." | `.claude/skills/convex-optimize/SKILL.md` |
| convex-quickstart | "Get a barebones Convex + web template running from a one-sentence idea." | `.claude/skills/convex-quickstart/SKILL.md` |
| convex-reviewer | "Convex code reviewer — security, auth, validators, performance, and pattern checks for code in a convex/ directory. Use to review or audit Convex functions before shipping." | `.claude/skills/convex-reviewer/SKILL.md` |
| convex-seed | "Seed or import data into the Convex database." | `.claude/skills/convex-seed/SKILL.md` |
| convex-self-heal | "Production error → triaged, root-caused, repaired, and certified (tsc + rehearsal + reproduce-then-gone) fix PR for a human to merge — then confirm the error stops recurring. Never auto-merges." | `.claude/skills/convex-self-heal/SKILL.md` |
| convex-sentinel | "Set up Sentinel production error capture in your own Convex deployment." | `.claude/skills/convex-sentinel/SKILL.md` |
| convex-suggest | "Suggest the matching Convex component when the user hand-rolls a pattern it already solves (crons, sharded-counter, rate-limiter, storage, search, presence, workflow, RAG, prosemirror-sync). Passive — suggest after the task, never interrupt. Never install without consent." | `.claude/skills/convex-suggest/SKILL.md` |
| convex-test | "Generate convex-test tests for the app's Convex functions." | `.claude/skills/convex-test/SKILL.md` |
| convex-verify | "Prove a Convex feature works — seed, drive as multiple mocked users via convex-test, assert behavior including the negative authz cases (wrong user refused, data-scope enforced)." | `.claude/skills/convex-verify/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
