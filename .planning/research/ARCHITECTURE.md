# Architecture Research

**Domain:** LLM tool-use agent with server-side safety passes (reviewer, moderation) on Convex + Next.js App Router
**Project:** Villi (Cal Hacks 13.0, solo, about 34h build)
**Researched:** 2026-10-23
**Confidence:** HIGH for Convex platform limits and semantics (read from official docs and the repo's own `convex/_generated/ai/guidelines.md`); MEDIUM for component APIs (Workpool, Aggregate, from READMEs/landing pages) and for the Anthropic SDK running in Convex's default runtime (untested); the safety-gating design is our own synthesis and is flagged as such.

## Decisions at a Glance

| # | Question | Decision | Confidence |
|---|----------|----------|------------|
| 1 | Agent loop | Hand-rolled `while` tool loop in one internal action; client never calls it directly. Public mutation inserts the `answers` row and enqueues the action. Each tool step is its own `runMutation` that appends to the trace. Retries via `@convex-dev/workpool` with `onComplete` that fails closed. Do NOT use `@convex-dev/agent`. | HIGH (limits), MEDIUM (Workpool API) |
| 2 | Hide drafts, no skipped moderation | Draft and reviewer decision live in a separate `answer_reviews` table that no public function reads. Only `answers.finalize` (internal) writes `answers.final`. Public mutations hardcode `pooled: null`; only an internal mutation flips it. Public community queries read only through a `pooled === true` index. Everything fails closed. | HIGH (platform), design is ours |
| 3 | Identity | `anonId` (random UUID in localStorage) used as a bearer capability, resolved server-side in one helper. Skip Convex Auth (beta, Next.js server support "under active development"). "Second device" = a `/demo` route that clones a template profile into a fresh anonId. | HIGH |
| 4 | Aggregates | Hand-rolled counter table, one doc per (itemId, anatomyKey), updated in a single `applyPooledTransition` helper that computes deltas. Real and synthetic counted separately. Not `@convex-dev/aggregate`. | MEDIUM-HIGH |
| 5 | Vector search | `vectorIndex` on `guideline_chunks` and `items`, 1024 dims (Voyage `voyage-4-lite`) behind one `embed()` wrapper. Search only in actions. Filters are equality and `q.or` only, so array-valued `anatomyScope` cannot be a filter: pre-filter on a scalar and post-filter after hydration. | HIGH |
| 6 | Boundaries and order | `convex/` split into `lib/`, public API files, `agent/`, `tools/`, `safety/`. Next.js `app/` is thin client pages over `components/`. M1 must also ship a stopgap profile (demo clone plus plain form) so the M2 pill flow runs before onboarding exists. | HIGH |

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      Next.js App Router (all client pages)               │
│  /scan  /scan/[answerId]  /log  /community  /saw  /sheet  /onboarding    │
│  /demo (clone template profile)                                          │
│  ConvexProvider + AnonIdProvider (localStorage)                          │
│     useQuery (live)                useMutation (only entry points)       │
└───────────┬────────────────────────────────┬─────────────────────────────┘
            │ subscribe                      │ call
┌───────────▼────────────────────────────────▼─────────────────────────────┐
│                  PUBLIC API  (convex/*.ts: query / mutation)              │
│  answers.get/start   logs.submit   swaps.submit/upvote   careTeam.submit  │
│  community.counts/swaps/careTeam   profiles.*   meds.*   storage.upload   │
│  RULES: resolve identity via lib/identity.requireProfile(anonId);         │
│         never accept pooled/synthetic/profileId; never read answer_reviews│
└───────────┬──────────────────────────────────────────────────────────────┘
            │ ctx.scheduler / workpool.enqueueAction  (atomic with the mutation)
┌───────────▼──────────────────────────────────────────────────────────────┐
│                  INTERNAL / ASYNC LAYER (internal* only)                  │
│  agent/run  ─► tools/* (internalQuery / internalAction)                   │
│     │  appendStep mutation per tool step ─► answers.toolTrace             │
│     └► saveDraft (mutation: store draft + schedule reviewer atomically)   │
│  safety/reviewer ─► lint + LLM ─► answers.finalize (sole writer of final) │
│  safety/moderate ─► (canonicalize) ─► LLM ─► moderation.apply             │
│                                         └► applyPooledTransition()        │
│  crons: sweep stuck answers, re-enqueue stale pooled:null rows            │
└───────────┬──────────────────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────────────────┐
│  DATA: profiles meds items(vec) log_entries swaps care_team_answers       │
│        questions guideline_chunks(vec) answers answer_reviews aggregates  │
│        fda_label_cache   _storage (photos)                                │
└──────────────────────────────────────────────────────────────────────────┘
   External: Anthropic Messages API (MAIN/FAST, vision) · Voyage embeddings
             · openFDA label API
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Public API (`convex/*.ts`) | The only surface the browser touches. Validates, resolves identity, inserts rows in the unsafe initial state, schedules async work. | `query`/`mutation` with strict arg validators (no `pooled`, `synthetic`, `profileId`) |
| `lib/identity.ts` | Single point turning `anonId` into a profile. Swap point if Convex Auth is added later. | `requireProfile(ctx, anonId)` using `by_anonId` index |
| Agent (`agent/run.ts`) | Tool loop with Claude. Never exposes draft text. Writes trace steps. | `internalAction`, manual loop over `messages.create` |
| Tool registry (`agent/registry.ts`) | Maps tool name to Anthropic tool schema plus an internal Convex function plus a code-written trace summary. | Plain TS object; handlers call `ctx.runQuery/runAction(internal.tools.*)` |
| Tools (`tools/*.ts`) | One file per tool. Queries where possible; actions where network or vector search is needed. All internal. | `internalQuery` / `internalAction` |
| Reviewer (`safety/reviewer*.ts`) | Deterministic lint plus second Claude call. Sole path from draft to `final`. | `internalAction` + `internalMutation finalize` |
| Moderation (`safety/moderate*.ts`) | Screens log/swap/care-team/question; flips `pooled`; updates aggregates. | `internalAction` + `internalMutation apply` |
| Aggregates (`aggregates.ts`) | O(1) item x anatomy x outcome counts. Only written by `applyPooledTransition`. | Counter table + helper |
| Vector search (`tools/guidelines.ts`, `tools/canonicalize.ts`) | Embed, `ctx.vectorSearch`, hydrate, post-filter. | Actions calling `lib/embed.ts` |
| Workpool | Concurrency cap for Anthropic calls, retries with backoff, `onComplete` for terminal failure. | `@convex-dev/workpool` component |
| Next.js client | Renders trace, final answer, live counts, GutDiagram. Holds anonId. | `"use client"` pages; `useQuery`/`useMutation` only |

## Recommended Project Structure

```
villi/
├── convex/
│   ├── schema.ts                 # ALL tables + indexes defined in M1 (cheap, avoids churn)
│   ├── convex.config.ts          # app.use(workpool) [+ rate-limiter if time]
│   ├── crons.ts                  # sweeper for stuck answers / stale pooled:null
│   ├── lib/                      # pure TS or ctx-typed helpers; no Convex function exports
│   │   ├── identity.ts           # requireProfile(ctx, anonId)
│   │   ├── anatomy.ts            # deriveAnatomyGroup(anatomy) -> anatomyKey (shared with client)
│   │   ├── segments.ts           # SegmentId union, shared with GutDiagram
│   │   ├── citations.ts          # parse/validate [G:] [L:] [C:] [T:] tokens
│   │   ├── lint.ts               # deterministic rules: dose/quantity regex, ASK count, citation presence
│   │   ├── schemas.ts            # AgentOutput / ReviewerOutput / ModerationOutput (validators + TS types)
│   │   ├── anthropic.ts          # client factory, MODEL_MAIN / MODEL_FAST from env
│   │   └── embed.ts              # embed(texts, "document"|"query") + EMBED_DIM constant
│   ├── profiles.ts  meds.ts  storage.ts      # public: profile CRUD, upload URL, med add
│   ├── answers.ts                # public: start, get | internal: beginAttempt, appendStep, saveDraft, finalize, fail
│   ├── logs.ts  swaps.ts  careTeam.ts  questions.ts   # public submit-style mutations (pooled:null) + author-only queries
│   ├── community.ts              # public live queries (pooled===true only): counts, swapsBoard, careTeamFor
│   ├── aggregates.ts             # internal: applyPooledTransition helper, rebuild, verify
│   ├── agent/
│   │   ├── run.ts                # internalAction: the loop
│   │   ├── prompts.ts            # system prompts (agent) with language placeholder
│   │   └── registry.ts           # tool schemas + dispatch + trace summarizers
│   ├── tools/                    # internal functions, one per agent tool
│   │   ├── profile.ts  label.ts  guidelines.ts  canonicalize.ts  community.ts
│   │   ├── myLog.ts  careTeam.ts  swaps.ts  ors.ts  matchPill.ts
│   ├── safety/
│   │   ├── reviewer.ts           # internalAction (LLM + lint)
│   │   ├── moderate.ts           # internalAction (canonicalize -> LLM -> apply)
│   │   └── moderation.ts         # internalMutation apply, sweep (non-LLM)
│   └── seed.ts                   # internal: ingestGuidelines, seedSynthetic (imports ../data/guidelines.json)
├── app/
│   ├── layout.tsx  providers.tsx # ConvexReactClient + AnonIdProvider
│   ├── page.tsx                  # scan entry (photo/text)
│   ├── scan/[answerId]/page.tsx  # live trace -> final AnswerCard
│   ├── onboarding/  log/  community/{swaps,care-team}/  saw/  sheet/  demo/
├── components/
│   ├── GutDiagram/               # SVG + props (M3)
│   ├── AnswerCard/  ToolTrace/  QuestionCard/  CountBadge/  AnatomyBadge/
├── lib/                          # client-only: anonId.ts, useAnonId.ts, imageResize.ts, exportSheet.ts
├── data/guidelines.json
├── tests/                        # vitest (pure) + convex-test (gating, aggregates); llm fixtures separate
└── .env.example                  # documents BOTH Next env and Convex deployment env
```

### Structure Rationale

- **`lib/` has no function exports:** Convex registers every exported function; keeping helpers out of public files prevents accidental API surface and keeps lint/citation logic unit-testable without a deployment (the brief's minimal tests are all pure functions or convex-test).
- **Public files vs `agent/`, `tools/`, `safety/`:** a grep for `export const x = query|mutation` shows the entire attack surface. Everything else is `internal*`.
- **`safety/` splits actions from mutations:** the reviewer/moderation actions call the LLM; the mutations that actually write `final`/`pooled` are separate, small, and heavily tested. If the SDK needs `"use node"`, that directive forces a file to export only actions, so this split is already correct (see Pattern 1 note).
- **`schema.ts` complete in M1:** later milestones only add code, never migrate.
- **`anatomy.ts` and `segments.ts` shared:** the client imports them for GutDiagram and onboarding derivation; Convex imports them for `anatomyKey` snapshots, so the derivation can never diverge.

## Architectural Patterns

### Pattern 1: Client enqueues, never calls the action (answer lifecycle)

**What:** `answers.start` is a public mutation that validates, inserts the `answers` row (`status: "running"`), and enqueues the agent action in the same transaction. The client then subscribes to `answers.get`. Convex docs: "Calling actions directly from a client is generally an anti-pattern. Have the client call a mutation that writes to the database and schedules the action."
**When to use:** every agent invocation (scan, follow-up, "I saw something").
**Trade-offs:** one extra hop; in exchange the enqueue is atomic with the row, so no orphan rows and no action without a row.

```typescript
// convex/answers.ts
export const start = mutation({
  args: { anonId: v.string(), kind: kindV, input: inputV, parentId: v.optional(v.id("answers")) },
  handler: async (ctx, a) => {
    const profile = await requireProfile(ctx, a.anonId);
    await rateLimitOrThrow(ctx, profile._id);                  // protects the Anthropic bill
    const answerId = await ctx.db.insert("answers", {
      profileId: profile._id, kind: a.kind, input: a.input, parentId: a.parentId,
      status: "running", attempt: 0, toolTrace: [], createdAt: Date.now(),
    });
    await agentPool.enqueueAction(ctx, internal.agent.run.run, { answerId }, {
      retry: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 },
      onComplete: internal.answers.onAgentComplete, context: { answerId },
    });
    return answerId;
  },
});
```

Note: scheduling from a mutation is atomic with that mutation; scheduling from an action is not (official docs). That is why `saveDraft` below is a mutation, not an action step.

Runtime note (MEDIUM, test in the first hour of M2): Convex's default runtime supports `fetch`; the Anthropic SDK is built for fetch-based runtimes and likely works there. If `convex dev` rejects an import, add `"use node"` to the LLM action files (512MB, 10 min). Either way the budget is ample (see Time Budget).

### Pattern 2: Manual tool loop with trace-as-subscription

**What:** one action runs the loop; each tool step is a separate `ctx.runMutation(appendStep)`, so the UI row updates per step. The model's final output is forced through a `submit_answer` pseudo-tool whose `input_schema` is the AgentOutput JSON, so there is no JSON-parsing step to fail. The trace holds code-written summaries ("search_guidelines: 4 chunks, top G:aga-07"), never model prose, so draft claims cannot leak through the trace.
**When to use:** the agent and follow-ups.
**Trade-offs:** you own the loop (about 80 lines). Preferred over `@convex-dev/agent`, which brings its own thread/message tables and text-delta streaming and would sit between you and the reviewer gate; the brief itself says components only "if they save time".

```typescript
// convex/agent/run.ts  (sketch)
export const run = internalAction({
  args: { answerId: v.id("answers") },
  handler: async (ctx, { answerId }) => {
    const { profile, input, attempt } = await ctx.runMutation(internal.answers.beginAttempt, { answerId }); // attempt++, clears trace
    const anthropic = makeClient();
    const messages: MessageParam[] = await buildInitialMessages(ctx, input);   // photo -> base64 image block
    const deadline = Date.now() + 4 * 60_000;
    for (let turn = 0; turn < MAX_TURNS; turn++) {                               // MAX_TURNS = 8
      const res = await anthropic.messages.create({
        model: MODEL_MAIN, max_tokens: 4096, system: SYSTEM, tools: TOOL_SCHEMAS, messages,
      }, { timeout: 90_000 });
      messages.push({ role: "assistant", content: res.content });
      const calls = res.content.filter((b) => b.type === "tool_use");
      const submit = calls.find((c) => c.name === "submit_answer");
      if (submit) {
        await ctx.runMutation(internal.answers.saveDraft, { answerId, attempt, draft: submit.input }); // schedules reviewer atomically
        return;
      }
      const results = await Promise.all(calls.map(async (c) => {
        // profileId/anatomy come from the server closure, NEVER from model-supplied args
        const out = await TOOLS[c.name].run(ctx, { profile }, c.input);
        await ctx.runMutation(internal.answers.appendStep, {
          answerId, attempt, step: { tool: c.name, summary: TOOLS[c.name].summarize(out), at: Date.now() },
        });
        return { type: "tool_result" as const, tool_use_id: c.id, content: JSON.stringify(out.forModel) };
      }));
      messages.push({ role: "user", content: results });
      if (Date.now() > deadline) break;                                          // force a submit turn or fail
    }
    throw new Error("agent did not submit");                                     // -> Workpool retry -> onComplete fails closed
  },
});
```

Key details:
- `appendStep` takes `attempt` and ignores stale writers, so a timed-out earlier attempt cannot corrupt a retry's trace. `beginAttempt` increments `attempt` and clears the trace, making the whole action safe to re-run.
- Tool args are validated against each tool's schema; `profileId` is never a tool parameter. This blocks prompt injection from FDA label text or OCR'd photo text asking the model to read another profile.
- Wrap tool results containing untrusted text (label sections, user notes) in a clearly delimited block and state in the system prompt that it is data, not instructions.
- Photo input: client downsizes to about 1568px longest edge JPEG before upload (phone HEIC/12MP photos are slow and large). Action loads bytes via `ctx.storage.get`/`getUrl` and passes a base64 image block.
- Enable prompt caching on system prompt plus tool schemas; the loop resends them every turn.

### Pattern 3: Draft is structurally unreachable; `final` has one writer

**What:** (a) Draft and reviewer decision are stored in `answer_reviews`, a table no public function ever reads. (b) `answers.final` is written only by `internal.answers.finalize`. (c) The public query returns an explicit projection and is the only client read path. (d) `saveDraft` stores the draft and schedules the reviewer in one transaction. (e) Every failure path ends in `status: "error"` or `"blocked"` with a code-authored fallback, never a draft.
**When to use:** all user-facing answers. This deviates slightly from the brief's single `answers` row (which lists `draft`/`reviewerDecision` on it). Reason: Convex cannot hide fields from a query that returns the whole document, so with one row, one careless `return ctx.db.get(id)` leaks an unreviewed medical draft. The split makes the guarantee structural. `toolTrace` and `final` stay on `answers` as the brief specifies, so the subscription is unchanged.
**Trade-offs:** one more table; the reviewer reads from it instead of the row.

```typescript
// convex/answers.ts (public)
export const get = query({
  args: { anonId: v.string(), answerId: v.id("answers") },
  handler: async (ctx, { anonId, answerId }) => {
    const profile = await findProfile(ctx, anonId);
    const a = await ctx.db.get(answerId);
    if (!profile || !a || a.profileId !== profile._id) return null;   // do not leak existence
    return {                                                           // explicit projection, never `return a`
      _id: a._id, status: a.status, trace: a.toolTrace,
      final: a.status === "final" || a.status === "blocked" ? a.final : null,
    };
  },
});

// internal: the ONLY writer of final
export const finalize = internalMutation({
  args: { answerId: v.id("answers"), attempt: v.number(), final: finalV, decision: v.any() },
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.answerId);
    if (!row || row.attempt !== a.attempt || row.status !== "reviewing") return;  // idempotent
    await ctx.db.patch(a.answerId, { final: a.final, status: a.decision.blocked ? "blocked" : "final" });
  },
});
```

Reviewer design (belt and braces, all ours):
1. Reviewer LLM returns `{ approved, revised: AgentOutput | null, blockedReasons[] }`. Prefer a full revised object over the brief's `edits: string`, because the answer is structured JSON.
2. After the LLM, run `lib/lint.ts` on the result as a hard gate: every `why[].claim` has a citation token; every `[G:id]` is in the set of chunk ids actually returned in this answer's tool results; every `[C:n/total, anatomy]` equals the aggregate values the tool returned; exactly one `ASK:`; no number+unit quantity pattern (mg, mL, g, kcal, "tablespoon"); no imperative stop/start/crush/split. A lint failure forces `blocked` regardless of the LLM's verdict.
3. `revised` may only remove or reword: its citation set must be a subset of the draft's. This enforces "never add medical facts of your own" in code.
4. Blocked answers render a code-written fallback ("I couldn't produce a safe answer. Here is a question to bring to your pharmacist: ...") plus the unchanged trace.
5. Reviewer decision, lint results and blocked reasons are persisted in `answer_reviews` (the brief's "decisions are logged"). A `/safety` page showing aggregate intervention counts is cheap and is direct evidence for the Microsoft track.

### Pattern 4: Pending-by-construction community writes (moderation cannot be skipped)

**What:** the only mutations that create community rows are `submit`-style public mutations that hardcode `pooled: null`, `synthetic: false`, and snapshot anatomy server-side, then schedule the pipeline. Only `internal.moderation.apply` can set `pooled`. Public community queries use an index on `pooled` and match `true` only.
**Why it holds:**
- Convex arg validators reject unknown fields, and these mutations' validators simply do not include `pooled`/`synthetic`/`anatomySnapshot`.
- Internal functions are not callable from the client at all.
- `null` and `false` are both invisible to community queries; the only way into the pool is an explicit `true` written by `apply`.
- If moderation fails after retries the row stays `null` (author-only "being checked") and the cron re-enqueues it. There is no code path that defaults to `true`.
- Other public mutations on these tables are limited to upvote and clinician-endorse, both of which first check `pooled === true` on the target and, for endorse, `profile.role === "clinician"`.

```typescript
// convex/logs.ts
export const submit = mutation({
  args: { anonId: v.string(), itemId: v.optional(v.id("items")), itemText: v.optional(v.string()),
          outcome: outcomeV, note: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const profile = await requireProfile(ctx, a.anonId);
    const id = await ctx.db.insert("log_entries", {
      profileId: profile._id, anatomySnapshot: profile.anatomy,
      anatomyKey: deriveAnatomyGroup(profile.anatomy),
      itemId: a.itemId ?? null, itemText: a.itemText, outcome: a.outcome, note: a.note,
      pooled: null, synthetic: false, createdAt: Date.now(),
    });
    await modPool.enqueueAction(ctx, internal.safety.moderate.run, { table: "log_entries", id }, { retry: true,
      onComplete: internal.safety.moderation.onModerationComplete, context: { table: "log_entries", id } });
    return id;
  },
});
```

Pipeline for a log from free text: `submit` -> `moderate.run` action: canonicalize (embed, `vectorSearch`, FAST confirm) -> get-or-create item via a mutation that re-checks a unique `slug` index -> FAST moderation -> `moderation.apply` (flips `pooled`, calls `applyPooledTransition`). Vector search is action-only, which is why log submit cannot be a plain one-shot mutation when the user types a name. Logs created from an answer card already carry `itemId` and skip canonicalization, keeping the "under 5 seconds" tap path.

Swaps add a guideline check in the moderate action (retrieve chunks via the guideline helper, then FAST model with the brief's `guidelineConflict` output). Add a deterministic backstop using canonical item attributes (for example `hypertonic: true`, `sugarAlcohol: true`) so the "rejects a soda swap" test does not depend on LLM behavior.

Test it: with convex-test, insert `pooled: null` and `pooled: false` rows, call every public community query, assert none are returned; assert no exported public mutation accepts `pooled`.

### Pattern 5: Transition-based counters (aggregates correct under flips)

**What:** one `aggregates` doc per (itemId, anatomyKey). All changes go through one helper that receives the old and new visibility of a row and applies a delta only when visibility changed.

```typescript
// convex/aggregates.ts
export async function applyPooledTransition(
  ctx: MutationCtx, entry: Doc<"log_entries">, nextPooled: boolean | null,
) {
  const was = entry.pooled === true, will = nextPooled === true;
  await ctx.db.patch(entry._id, { pooled: nextPooled });
  if (was === will || !entry.itemId) return;                 // idempotent: replays are no-ops
  const sign = will ? 1 : -1;
  const bucket = entry.synthetic ? "synthetic" : "real";
  const row = await ctx.db.query("aggregates")
    .withIndex("by_item_anatomy", (q) => q.eq("itemId", entry.itemId!).eq("anatomyKey", entry.anatomyKey)).unique();
  const base = row ?? { itemId: entry.itemId!, anatomyKey: entry.anatomyKey,
    real: { helped: 0, neutral: 0, hurt: 0 }, synthetic: { helped: 0, neutral: 0, hurt: 0 } };
  base[bucket][entry.outcome] += sign;
  row ? await ctx.db.replace(row._id, base) : await ctx.db.insert("aggregates", base);
}
```

Because the log patch and counter update happen in one mutation transaction, the counter can never disagree with the pool. A true-to-false flip (future takedown or re-moderation) decrements correctly. Provide `aggregates.rebuild` (recompute from `log_entries where pooled === true`) and use it in the "stratified counts correct" test: random sequences of transitions, then compare to rebuild.

Notes:
- Split `real` and `synthetic` rather than the brief's single `syntheticCount`; that lets the UI show "19 logged, 12 of them demo data" and drive the demo badge (`includesSynthetic = synthetic total > 0`). `[C:n/total, anatomy]` values come straight from this doc, and `lint.ts` checks them against tool output.
- `anatomyKey` is a coarse group derived once by `deriveAnatomyGroup` (the AGA groups: end-jejunostomy, jejuno-colic, jejuno-ileo-colic, plus ileostomy/colostomy/unknown as needed), snapshotted on each entry. Do not key on the raw three-field tuple: cardinality explodes and every cell has tiny n. `query_community` returns matching-group counts plus a sum over the other groups (at most about 6 doc reads), and a "too few reports" flag under a small-n threshold.
- Seeding 1,500 entries: write rows with `pooled: true, synthetic: true` in batches of about 200 per mutation (chained via scheduler), accumulate counters in memory, write each aggregate doc once, then run `aggregates.verify`. Do not call the per-row helper 1,500 times.
- Live counts vs cited counts: the final answer's `[C:14/19, ...]` is a frozen snapshot, and that is correct for a citation. The "live count updates from a second device" demo moment should come from a separate live widget (`useQuery(community.counts)`) labeled "now", beside the snapshot text. Never regenerate answer text on count changes.

### Pattern 6: Anonymous identity as a bearer capability

**What:** on first load the client generates `crypto.randomUUID()` and stores it in localStorage. Every public function takes `anonId`, calls `requireProfile`, and never trusts client-supplied `profileId`. `anonId` is never returned by any query, so it works as an unguessable credential (about 122 bits).
**Why not Convex Auth anonymous:** it exists, but Convex Auth is labeled beta, its Next.js server-side support is "under active development", the Anonymous provider adds JWT-key and `auth.config` setup, its own docs call it an advanced feature that invites abuse without CAPTCHA, and anonymous-to-real account linking needs custom code. That is an hour of risk for a demo that gains no user-visible benefit. Because identity resolution lives in `lib/identity.ts` alone, upgrading later means changing one function to read `ctx.auth.getUserIdentity()`.
**Trade-offs:** clearing storage loses the profile (acceptable; anonymous by design; the appointment-sheet export is the portable artifact); anyone holding the anonId is that user (same as any bearer link); no cross-device continuity (not needed).
**Client gotcha:** localStorage is unavailable on the server render. `useAnonId()` returns `undefined` until mounted; pass `"skip"` to `useQuery` until it exists, and render anonId-dependent UI only after hydration to avoid mismatches.

**The "second device" demo:** seed profiles have random, never-exposed anonIds, so nobody can impersonate them (good). For the demo, add `/demo?as=father` and `/demo?as=peer`: a public mutation `demo.startAs(template)` (gated by a `DEMO_MODE` Convex env flag) clones a template profile (anatomy plus, for "father", the med list) into a fresh non-synthetic profile and returns a new anonId stored in localStorage. Device 1 (phone) runs `as=father`; device 2 (laptop or a second phone via QR) runs `as=peer` with matching anatomy. Device 2 taps "hurt" on the sports-drink item; `logs.submit` inserts `pooled: null`, moderation flips it in about a second or two, `applyPooledTransition` bumps the counter, and device 1's `community.counts` subscription re-renders. The pending-then-shared transition is visible on device 2 and doubles as proof that moderation runs before sharing. Add a small "recent activity" strip (`community.recent`, anatomy and item only, `pooled === true`) so the audience sees the log land.

## Data Flow

### Request Flow: pill scan

```
Camera/text ─► resize ─► generateUploadUrl ─► POST to storage ─► storageId
   │
   ▼
answers.start(mutation) ──insert row(running)──┬─► workpool.enqueueAction(agent.run)
   │                                           │
   └─► client subscribes answers.get ◄─────────┘
                                   ▲  each patch re-pushes to subscribers
agent.run (action)                 │
  beginAttempt ──────────────────► │ (trace cleared)
  loop: Claude ─tool_use─► tools/* (internalQuery/Action) ─► appendStep ─► toolTrace
  submit_answer ─► saveDraft (mutation):  answer_reviews.insert(draft)
                                          answers.status="reviewing"
                                          scheduler/workpool -> reviewer   (atomic)
reviewer (action): LLM review ─► lint ─► finalize (mutation) ─► answers.final, status final|blocked
                                                  │
UI: trace streams during "running"; "Reviewer checking..." during "reviewing"; AnswerCard on "final"
```

### Key Data Flows

1. **Tool evidence flow:** `get_profile` (anatomy, language) -> `fetch_label` (cache lookup in `fda_label_cache`, else openFDA fetch plus cache write, keyed by normalized brand/generic) -> `search_guidelines` (embed query, `vectorSearch`, hydrate, post-filter by anatomy) -> optional community/log/care-team/swap queries. Tool outputs split into `forModel` (full text, truncated) and a short code-built trace `summary`. Chunk ids and counts seen by the model are recorded so the lint can verify citations against them.
2. **Community write flow:** `submit` (pooled null) -> moderation pipeline -> `apply` -> `pooled` true|false -> counters (true only) -> live queries push to all subscribers. Author's own view shows the pending/shared/held state from the same row.
3. **Follow-up flow:** `answers.start({kind:"followup", parentId})` with the same agent, seeded with the parent's final answer and trace summary. Chain rows by `parentId`; no separate messages table.
4. **Guideline ingest:** `seed.ingestGuidelines` imports `data/guidelines.json` (bundled with the Convex code), embeds in batches (`input_type: "document"`), inserts rows. Queries embed with `input_type: "query"`.
5. **Appointment sheet:** a pure query over `questions`, own log patterns (derived from own entries), and meds with last-answer flags; export markdown client-side, PDF via print stylesheet. No server work.

### State Management

```
Convex (source of truth) ──useQuery──► React components (read-only mirrors)
React events ──useMutation──► public mutations ──► DB ──► subscriptions re-fire
Local only: anonId (localStorage), UI toggles
```

No client store is needed. Optimistic updates are unnecessary: Convex mutations round-trip fast enough for a 5-second log tap, and "pending until moderated" is real server state.

## Vector Search Specifics

Verified against Convex docs (HIGH):
- Define in schema: `.vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1024, filterFields: [...] })`. `vectorField` must be `v.array(v.float64())`.
- Dimensions: 2 to 4096. Up to 4 vector indexes per table; up to 16 filter fields per index.
- `ctx.vectorSearch` works only in actions. It returns only `{ _id, _score }` (score -1 to 1); documents must be loaded with a follow-up `ctx.runQuery(internal.x.loadByIds, ...)`. `limit` is 1 to 256 (default 10).
- Filters: equality on declared `filterFields`, combined with `q.or(...)`. No cross-field AND, no inequality, no array-contains. The repo's own `convex/_generated/ai/guidelines.md` says the same: "apply remaining predicates after hydration."

Consequence for `anatomyScope[]` (an array in the brief's data model): it cannot be a filter field. Recommended:
- Keep `anatomyScope: string[]` on the chunk for display and post-filtering.
- Add a scalar `scopeKey` (`"all"` or one anatomy group) as the filter field only if you want server-side narrowing.
- With 40 to 100 chunks, the simplest robust approach is `vectorSearch` with `limit: 24`, hydrate, then filter `anatomyScope.includes(group) || anatomyScope.includes("all")` in the loader query and return the top 6. Worth doing even if a filter field is declared, because chunks that apply to several anatomies would otherwise need duplicate rows.

```typescript
// convex/tools/guidelines.ts
export const search = internalAction({
  args: { query: v.string(), anatomyKey: v.string() },
  handler: async (ctx, { query, anatomyKey }) => {
    const [vector] = await embed([query], "query");
    const hits = await ctx.vectorSearch("guideline_chunks", "by_embedding", { vector, limit: 24 });
    return await ctx.runQuery(internal.tools.guidelines.hydrate, {
      ids: hits.map((h) => h._id), scores: hits.map((h) => h._score), anatomyKey, take: 6,
    });
  },
});
```

Embeddings provider (the open M1 decision): Anthropic has no embeddings model and points to Voyage AI. Recommended: Voyage `voyage-4-lite`, default 1024 dims, multilingual-capable, normalized vectors (cosine = dot), via the Atlas-hosted endpoint `https://ai.mongodb.com/v1/embeddings` with a model API key created in MongoDB Atlas "AI Model APIs". Always pass `input_type` ("document" at ingest, "query" at search). If Atlas signup takes more than about 10 minutes, use OpenAI `text-embedding-3-small` instead (supports a `dimensions` parameter). Both sit behind `lib/embed.ts` with one `EMBED_DIM` constant. Switching provider means re-embedding and redefining the index, which for roughly 50 chunks plus a few hundred items takes minutes. No-key fallback: a Convex `searchIndex` (full-text) on chunk `text` with `anatomy`/tag filter fields, usable from a plain query; weaker semantically but fully inside Convex. Because the brief wants vectors visibly load-bearing, treat this as insurance only.

Mind that the Voyage 4 model names and Atlas endpoint come from the current Anthropic embeddings page (fetched today); older tutorials show `api.voyageai.com` and `voyage-3.5`. A legacy Voyage-platform key uses a different base URL.

`items` index: embed `canonicalName + aliases`. `canonicalize_item` flow: embed -> `vectorSearch("items", limit 5)` -> if top score above a threshold (calibrate on about 20 examples; start near 0.85) ask FAST model to confirm "same item?" -> reuse, else create through `items.getOrCreate` (an internalMutation that checks a unique `by_slug` index first, so concurrent creates cannot duplicate).

## Time Budget and Retries

Limits (official, HIGH): Node-runtime actions time out at 10 minutes (512MB); Convex-runtime actions at 30 minutes (64MB); queries and mutations get 1 second of user-code time; an action may run 1000 concurrent operations; scheduled mutations are exactly-once, scheduled actions are at-most-once and never retried automatically; scheduling from a mutation is atomic, from an action it is not; scheduled functions do not inherit auth (pass ids as args).

Budget: realistic agent loop is 4 to 8 model turns at roughly 5 to 20 seconds each, plus tool calls (an openFDA fetch is on the order of a second; vector search sub-second after embedding). Expect about 30 to 120 seconds total for the agent and 10 to 20 seconds for the reviewer (estimates, not measured). That is far inside 10 minutes. Guard rails anyway:
- `MAX_TURNS = 8`, a 4-minute wall-clock deadline in the loop, `timeout: 90_000` per Anthropic call (`maxRetries: 2` inside the SDK for 429/529).
- Truncate tool results (FDA label: only the sections named in the brief, each capped, never the full document) to keep context small and fast.
- Run parallel `tool_use` blocks with `Promise.all`.
- Reviewer is a separate action (its own timeout budget) so a slow agent never starves it.

Retries, recommended: `@convex-dev/workpool` for three pools (agent, reviewer, moderation). One component gives per-pool `maxParallelism` (protects Anthropic rate limits; the docs advise total parallelism under about 20 on the free plan), exponential backoff with `retry: { maxAttempts, initialBackoffMs, base }`, and an `onComplete` mutation that runs after success, failure or cancel with `result.kind`. Use `onComplete` for the fail-closed hook: on `kind === "failed"`, set `answers.status = "error"` with a generic message (or leave a log row at `pooled: null`). `NonRetryableError` stops retries for deterministic failures (bad schema from the model after one repair attempt).
- `@convex-dev/action-retrier` (verified README: `retrier.run(ctx, fn, args, { onComplete, maxFailures })`, `onComplete` exactly once) is the smaller alternative if Workpool gives trouble. Its README does not discuss idempotency, so the same attempt-guard design is needed.
- Zero-dependency fallback: wrap the loop in try/catch, on error call `answers.fail`, a mutation that reschedules `agent.run` with `runAfter(backoff)` until `attempt` reaches 3. This does not cover a killed or timed-out action, which is why the cron sweeper exists.
- Sweeper (`crons.ts`, every minute): `answers` in `running` or `reviewing` for over 5 minutes -> `error`; `log_entries`/`swaps`/`care_team_answers` at `pooled: null` older than 2 minutes -> re-enqueue moderation (cap attempts). This is the backstop for every "process died" case.
- Idempotency checklist: `beginAttempt` clears state; `appendStep`/`saveDraft`/`finalize` check `attempt` and `status`; `applyPooledTransition` is a no-op on replay; `items.getOrCreate` is keyed by slug; moderation `apply` re-reads the row and returns if `pooled !== null`.

## Anti-Patterns

### Anti-Pattern 1: One `answers` row holding the draft

**What people do:** put `draft`, `reviewerDecision`, `final` on the subscribed row and rely on the UI to show only `final`.
**Why it's wrong:** the subscription delivers the whole document; any `return ctx.db.get()` or devtools inspection exposes the unreviewed draft, defeating "safety cannot be skipped from the client."
**Do this instead:** separate `answer_reviews` table with no public reader; public query returns an explicit projection (Pattern 3).

### Anti-Pattern 2: Letting the model choose ids

**What people do:** give tools a `profileId` or `userId` argument.
**Why it's wrong:** FDA label text, OCR text and user notes are untrusted and can carry injected instructions; a model-chosen id turns that into cross-profile data access.
**Do this instead:** inject profile and anatomy from the server closure; tool schemas contain only item, query and section parameters.

### Anti-Pattern 3: Scheduling from an action, or sequential tiny mutations

**What people do:** inside the agent action, `await runMutation(saveDraft)` then `await scheduler.runAfter(reviewer)`.
**Why it's wrong:** actions are not transactional; a crash between the two leaves a draft that nothing will review (stuck forever, or worse, a path that "just shows the draft").
**Do this instead:** schedule inside the `saveDraft` mutation (atomic). Docs also warn against chains of `runQuery`/`runMutation` that could be one internal function.

### Anti-Pattern 4: Failing open

**What people do:** on reviewer or moderation error, show the draft "so the user isn't stuck", or default `pooled` to true.
**Why it's wrong:** the entire safety story is that it cannot be bypassed.
**Do this instead:** reviewer failure -> `error` state with a code-authored message and a reminder to ask a professional; moderation failure -> stays `null`, retried by cron. Never default open.

### Anti-Pattern 5: Trusting the LLM reviewer alone

**What people do:** one reviewer call decides everything.
**Why it's wrong:** reviewers miss things and can "fix" an answer by inventing facts.
**Do this instead:** deterministic lint (citation resolvability against the evidence actually retrieved, quantity regex, ASK count) as an unconditional gate, and the subset-of-citations check on edits. These are also the pure functions the minimal test suite can cover without model calls.

### Anti-Pattern 6: Keeping photos

**What people do:** store the pill/bottle photo and its URL on log entries (`photoUrl?` in the brief's model) or leave uploads in storage.
**Why it's wrong:** a pharmacy bottle label carries patient name, DOB and prescriber, which contradicts "records stay anonymous."
**Do this instead:** after the agent has identified the item, `ctx.storage.delete` the upload (keep nothing but the identified name); drop `photoUrl` from `log_entries`; tell the user in onboarding copy. Tablet-on-surface photos for "I saw something" are deleted the same way.

### Anti-Pattern 7: Streaming draft tokens

**What people do:** stream model text for perceived speed.
**Why it's wrong:** it shows unreviewed medical text by definition.
**Do this instead:** stream only the code-built tool trace and phase labels ("Reading label", "Checking guidelines", "Reviewer checking"). The trace is the visible-latency trade and doubles as the demo's wow moment.

### Anti-Pattern 8: Env confusion

**What people do:** put `ANTHROPIC_API_KEY` only in `.env.local`.
**Why it's wrong:** Convex functions read `process.env` from the Convex deployment, not Next's env. The action will silently have no key.
**Do this instead:** `npx convex env set ANTHROPIC_API_KEY ...` (and `VOYAGE_API_KEY`, `ANTHROPIC_MODEL_MAIN/FAST`, `DEMO_MODE`) for dev and prod; only `NEXT_PUBLIC_CONVEX_URL` lives in Next env. `.env.example` should list both groups.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Hackathon (about 10 to 100 users) | Everything above as-is. Workpool `maxParallelism` 4 to 8 for the agent pool. |
| About 1k to 10k users | Counter docs for the hottest items see OCC contention (every log is a write to one doc): shard counters (Convex sharded-counter component) or batch moderation applies. Add rate limiting per anonId (`@convex-dev/rate-limiter`). Move seed/synthetic out of live aggregates by `real`/`synthetic` split (already done). |
| Beyond | Real auth (swap `requireProfile`), clinician credential verification, corpus review process, cost controls (cache identical label + anatomy answers). Not a hackathon concern. |

Scaling priorities: (1) Anthropic spend and rate limits, solved by rate limiting and Workpool before anything else; (2) hot-item counter contention. Cost control now: a per-anonId limit on `answers.start` and `logs.submit` (a simple table or the rate-limiter component), since the public deployment URL is demoed and judges may poke at it.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic Messages API | SDK in LLM actions; MAIN for agent and reviewer, FAST for canonicalize/moderate/translate; tool use plus vision; prompt caching on system+tools | Models from env; set per-call timeout; the key lives in Convex env |
| Voyage embeddings | `fetch` in `lib/embed.ts` | `input_type` document vs query; keep dim constant in one place |
| openFDA label API | `fetch` in `tools/label.ts`, cached in `fda_label_cache` (query key + response + fetchedAt) | Brand name search then generic fallback; cap sections; treat as untrusted text; handle empty results as "unidentified/no label found", which is a first-class answer state |
| Convex storage | `generateUploadUrl` mutation; client POST; action reads then deletes | Resize on client first |
| Vercel | `npx convex deploy --cmd 'npm run build'` as build command, `NEXT_PUBLIC_CONVEX_URL` set | Seed prod once with `npx convex run --prod seed:run` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Browser to Convex | Public query/mutation only, `anonId` on every call | Never calls actions or internal functions |
| Public mutation to async layer | `workpool.enqueueAction` / `scheduler.runAfter` inside the mutation | Atomic with the insert |
| Agent to tools | `ctx.runQuery/runAction(internal.tools.*)` via registry | Same-runtime shared logic should be plain helpers rather than nested `runAction` (docs: `runAction` freezes the parent and adds overhead; use it only to cross runtimes) |
| Agent to reviewer | Only via `saveDraft` mutation (atomic schedule) | No direct call |
| Reviewer / moderation to data | Only through `finalize` / `apply` | Sole writers of `final` / `pooled` |
| Convex to client shared code | `convex/lib/anatomy.ts`, `segments.ts` imported by both | Keeps GutDiagram and `anatomyKey` in sync |

## Suggested Build Order (mapped to the brief's milestones)

Dependency spine: schema and helpers -> identity/profile bootstrap -> answers lifecycle with a fake agent -> real tools and loop -> reviewer gate -> UI polish. Later milestones reuse the same patterns (pooled pipeline, aggregates), so get those shapes right once.

### M1 Foundation (also pre-build what M2 needs)
1. Scaffold Next.js + Convex; `ConvexReactClient`, `AnonIdProvider`; spend at most 30 minutes before invoking the brief's SQLite fallback decision.
2. **Complete `schema.ts`** (all tables, all indexes, both vector indexes at the chosen `EMBED_DIM`, `pooled: v.union(v.boolean(), v.null())`, `answer_reviews`, `fda_label_cache`).
3. `lib/` skeleton: `identity`, `anatomy` (group derivation), `schemas`, `citations`, `lint` (these are pure and testable early), `anthropic`, `embed`.
4. Decide the embeddings provider; `seed.ingestGuidelines` (imports `data/guidelines.json`, embeds, inserts); smoke-test one `search` action.
5. `seed:run` synthetic data (profiles, logs with `pooled: true, synthetic: true`, aggregates in bulk, swaps, care-team answers, questions) and the template profiles (father, peer). `npm run seed` should call `convex run seed:run` with no arguments (avoids Windows shell JSON quoting).
6. **Stopgap profile bootstrap:** `/demo?as=father` clone route plus a plain dropdown profile form (this is the brief's M3 "describe it" fallback built first). Without this, M2 cannot run before onboarding.

### M2 Pill flow end to end (the shippable core)
1. `answers.start/get`, `beginAttempt/appendStep/fail`, the `ToolTrace` component, with a **fake agent** that appends canned steps on timers. Proves subscription streaming and the enqueue pattern before any model cost.
2. Tools: `get_profile`, `fetch_label` (+ cache), `search_guidelines`, plus `submit_answer`. Stub `query_community`, `query_my_log`, `query_care_team_answers`, `query_swaps` to honest empty results so the prompt and registry are stable; fill them in M4/M5. Stub `lookup_ors` with the reference chunk lookup.
3. Real loop, photo upload with client resize, vision. Include `diagram` and `confidence`/`unidentified` in the output schema now (rendering waits for M3), so the reviewer already treats `diagram.label` as a claim.
4. Draft table, `saveDraft` (atomic schedule), reviewer action, lint, `finalize`, blocked/error fallbacks. Wire Workpool retries and the sweeper cron.
5. `AnswerCard` with citation rendering (resolve `[G:id]` to chunk source and sentence), unidentified state, and `QuestionCard` ("Add to appointment sheet" writes a `questions` row from `final.ask`, not from an agent-called tool; the brief's `add_question` tool should persist only after finalize so unreviewed text never enters storage).
6. Fixture tests: reviewer/lint blocks dose-change and uncited claims.

### M3 Onboarding, GutDiagram, meds, follow-up
`GutDiagram` plus tap-to-anatomy derivation (shared `anatomy.ts`), meds add by photo (reuse upload + a small vision identify action) or typing, follow-up via `parentId`, diagram highlight in `AnswerCard`. Replace the stopgap form with the diagram; keep it as the "I'd rather describe it" link.

### M4 Drink flow, canonicalization, log, moderation, counts
`items` vector index plus `canonicalize_item`; `logs.submit`, moderation pipeline, `moderation.apply`, `applyPooledTransition`; `query_community` against real aggregates; community counts component with demo badge; live count widget; the second-device demo. Tests: moderation fixtures, counts rebuild equals counters, pooled gating.

### M5 Community
Swaps (guideline check in the moderate action plus deterministic backstop), upvotes, anatomy filter, care-team answers from the sheet, clinician endorse and badge. Reuses the pooled pipeline unchanged; only the moderation prompt branches by table.

### M6 "I saw something" and appointment sheet
`match_pill` as a deterministic scoring query over the user's meds (shape, color, imprint), then the agent explains with citations. Sheet is queries plus client-side export.

### M7 and M8
Language: put `profile.language` into `get_profile` output and the system prompt from M2 (one line) so multilingual is verification, not rework; note the regex lint is English-biased, so keep the LLM reviewer plus citation-token checks as the language-independent layer. Canonicalization prompt takes any language. README must list the Convex feature mapping literally as the brief asks.

Phases that likely need deeper research or a spike before planning: **M2** (Anthropic SDK in default runtime vs `"use node"`; Workpool enqueue-from-mutation atomicity and `onComplete` typing), **M1** (embedding provider key and endpoint), **M4** (similarity threshold calibration for `canonicalize_item`). M5, M6 are standard patterns after M4.

## Sources

- Convex vector search: https://docs.convex.dev/search/vector-search (index definition, dimensions 2 to 4096, up to 4 indexes per table, 16 filter fields, limit 1 to 256, actions only, `_id`/`_score` only). HIGH
- Convex actions: https://docs.convex.dev/functions/actions (no automatic retry, separate transactions per `runQuery`/`runMutation`, `runAction` guidance, do not call actions from client). HIGH
- Convex limits: https://docs.convex.dev/production/state/limits (Node action 10 min, Convex-runtime action 30 min, 1s query/mutation, scheduling and vector limits). HIGH
- Convex scheduled functions: https://docs.convex.dev/scheduling/scheduled-functions (mutations exactly-once, actions at-most-once, scheduling atomic from mutations, auth not propagated). HIGH
- Local: `convex/_generated/ai/guidelines.md` in this repo (vector filter semantics, internal vs public, `"use node"` rules). HIGH
- `@convex-dev/workpool` README (raw GitHub) and component page: constructor options, `enqueueAction` options (`onComplete`, `context`, `retry`), `onComplete` result kinds, `NonRetryableError`. MEDIUM (enqueue-from-mutation atomicity inferred, not confirmed)
- `@convex-dev/action-retrier` README (raw GitHub): `ActionRetrier`, `run`, `onComplete` exactly once, `status`, `cancel`. MEDIUM-HIGH
- `@convex-dev/aggregate` README: `TableAggregate`, namespaces avoid write contention, insert/replace/delete bookkeeping, B-tree reads, monotonic keys serialize inserts. MEDIUM-HIGH (basis for the hand-rolled-counter recommendation)
- Convex Auth docs (https://docs.convex.dev/auth/convex-auth, https://labs.convex.dev/auth/config/anonymous): beta status, Next.js server-side support under development, anonymous provider caveats. HIGH
- Anthropic embeddings page (https://platform.claude.com/docs/en/docs/build-with-claude/embeddings): no Anthropic embedding model; Voyage 4 family, 1024-dim default, Atlas endpoint, `input_type`. HIGH
- Prompt-injection, fail-closed, draft-isolation and deterministic-lint patterns: our own synthesis from the platform semantics above, not from an external reference. MEDIUM

---
*Architecture research for: LLM tool-use agent with server-side safety passes on Convex + Next.js*
*Researched: 2026-10-23*
