/// <reference types="vite/client" />
// Runs each eval case through the real pipeline: the public mutations the app
// calls (answers.start, logs.create, swaps.submit), the agent, the safety lint,
// the Claude reviewer through the action retrier, and moderation. Each case gets
// a fresh convex-test world seeded with seed:run, so eval logs and swaps never
// touch a real community pool. Model, openFDA and Voyage calls are live.
// Driven by eval/run.ts through env vars; see `npm run eval -- --help`.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { convexTest } from "convex-test";
import { it } from "vitest";
import retrierTest from "@convex-dev/action-retrier/test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { EvalCase, RunResult, ShownAnswer } from "./types";
import { CliLimitError, emulateMessages } from "./cli";

const modules = import.meta.glob(["../convex/**/*.ts", "!../convex/**/*.test.ts"]);

const RUN = process.env.EVAL_RUN ?? "adhoc";
const OUT_DIR = process.env.EVAL_OUT ?? `eval/runs/${RUN}`;
const SPLIT = process.env.EVAL_SPLIT ?? "tune";
const LIMIT = Number(process.env.EVAL_LIMIT ?? "0");
const IDS = process.env.EVAL_IDS ? new Set(process.env.EVAL_IDS.split(",")) : null;
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? "6");
const CASE_TIMEOUT_MS = 8 * 60_000;
// "api" calls Anthropic directly; "cli" routes every model call through local
// `claude -p` (eval/cli.ts): structured outputs map one to one, the agent's
// custom tools are emulated as a JSON list of calls per turn.
const TRANSPORT = process.env.EVAL_TRANSPORT ?? "api";
let transportErrors = 0;
let limitHit: string | null = null;

// ---- fetch: cache openFDA and Voyage document embeddings across worlds (they are
// deterministic and rate-limited), and tally Anthropic token usage.
const usage: Record<string, { calls: number; input: number; output: number; cacheRead: number; cacheWrite: number }> = {};
const realFetch = globalThis.fetch;
const fetchCache = new Map<string, Promise<{ status: number; headers: [string, string][]; body: string }>>();
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const body = typeof init?.body === "string" ? init.body : "";
  const cacheable = url.startsWith("https://api.fda.gov/") || (url.includes("api.voyageai.com") && body.includes('"document"'));
  if (cacheable) {
    const key = `${url}\n${body}`;
    if (!fetchCache.has(key)) {
      fetchCache.set(
        key,
        realFetch(input, init).then(async (r) => ({ status: r.status, headers: [...r.headers.entries()], body: await r.text() })),
      );
    }
    try {
      const c = await fetchCache.get(key)!;
      if (c.status === 429 || c.status >= 500) fetchCache.delete(key);
      return new Response(c.body, { status: c.status, headers: c.headers });
    } catch (e) {
      fetchCache.delete(key);
      throw e;
    }
  }
  if (TRANSPORT === "cli" && url.includes("api.anthropic.com") && url.includes("/v1/messages")) {
    try {
      const req = JSON.parse(body);
      const { body: out, usage: u } = await emulateMessages(req);
      const m = (usage[`${req.model} (cli)`] ??= { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
      m.calls++;
      m.input += u.input;
      m.output += u.output;
      m.cacheRead += u.cacheRead;
      m.cacheWrite += u.cacheWrite;
      return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
    } catch (e) {
      transportErrors++;
      if (e instanceof CliLimitError) limitHit = (e as Error).message;
      // 529 lets the SDK's own retries run, as for an overloaded API.
      return new Response(JSON.stringify({ type: "error", error: { type: "overloaded_error", message: `cli transport: ${(e as Error).message}` } }), {
        status: 529,
        headers: { "content-type": "application/json", "x-should-retry": limitHit ? "false" : "true" },
      });
    }
  }
  const res = await realFetch(input, init);
  if (url.includes("api.anthropic.com") && res.ok) {
    res
      .clone()
      .json()
      .then((j: { model?: string; usage?: Record<string, number> }) => {
        const m = (usage[j.model ?? "?"] ??= { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
        m.calls++;
        m.input += j.usage?.input_tokens ?? 0;
        m.output += j.usage?.output_tokens ?? 0;
        m.cacheRead += j.usage?.cache_read_input_tokens ?? 0;
        m.cacheWrite += j.usage?.cache_creation_input_tokens ?? 0;
      })
      .catch(() => {});
  }
  return res;
}) as typeof fetch;

const makeWorld = () => convexTest(schema, modules);
type World = ReturnType<typeof makeWorld>;

async function newWorld(): Promise<World> {
  const t = makeWorld();
  retrierTest.register(t);
  await t.action(internal.seed.run, {});
  return t;
}

async function newProfile(t: World, c: EvalCase) {
  const anonId = `eval-${c.id}-${crypto.randomUUID()}`;
  const { role, language, caresFor, stomaType, colonInContinuity, bowelLengthBand } = c.anatomy;
  await t.mutation(api.profiles.upsert, {
    anonId,
    role,
    language,
    anatomy: { stomaType, colonInContinuity, bowelLengthBand },
    ...(caresFor ? { caresFor } : {}),
  });
  const profileId = await t.run(async (ctx) => {
    const p = await ctx.db.query("profiles").withIndex("by_anonId", (q) => q.eq("anonId", anonId)).unique();
    for (const name of c.meds ?? []) await ctx.db.insert("meds", { profileId: p!._id, name, addedAt: Date.now() });
    return p!._id;
  });
  return { anonId, profileId };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = new Set(["final", "blocked", "failed"]);

async function waitAnswer(t: World, answerId: Id<"answers">) {
  const until = Date.now() + CASE_TIMEOUT_MS;
  for (;;) {
    const a = await t.run((ctx) => ctx.db.get("answers", answerId));
    if (a && TERMINAL.has(a.status)) return { a, at: Date.now() };
    if (Date.now() > until) return { a, at: Date.now(), timedOut: true as const };
    await sleep(400);
  }
}

// Follow-ups need a real parent answer. Parents are run once per (item, anatomy,
// language, role) through the full pipeline, then copied into later worlds.
type Parent = { text: string; category: "pill" | "drink" | "food"; final: unknown; identified: string | null; status: string };
const parents = new Map<string, Promise<Parent>>();

async function runParent(c: EvalCase): Promise<Parent> {
  const t = await newWorld();
  const { anonId } = await newProfile(t, c);
  const text = c.input.parentText!;
  const category = c.input.parentCategory ?? "pill";
  const answerId = await t.mutation(api.answers.start, { anonId, text, category });
  const { a } = await waitAnswer(t, answerId);
  return { text, category, final: a?.final ?? null, identified: a?.identified ?? null, status: a?.status ?? "timeout" };
}

async function parentIn(t: World, profileId: Id<"profiles">, c: EvalCase): Promise<{ id: Id<"answers">; reused: boolean }> {
  const key = [c.input.parentText, c.anatomy.stomaType, c.anatomy.bowelLengthBand, c.anatomy.colonInContinuity, c.anatomy.language, c.anatomy.role].join("|");
  const reused = parents.has(key);
  if (!reused) parents.set(key, runParent(c));
  const p = await parents.get(key)!;
  const id = await t.run((ctx) =>
    ctx.db.insert("answers", {
      profileId,
      kind: "scan",
      input: { text: p.text, category: p.category },
      status: p.status === "final" ? "final" : "blocked",
      identified: p.identified ?? p.text,
      toolTrace: [],
      final: p.final ?? undefined,
      createdAt: Date.now() - 60_000,
    }),
  );
  return { id, reused };
}

function blockedBy(decision: RunResult["reviewerDecision"], reasons: string[]): RunResult["blockedBy"] {
  if (reasons.includes("reviewer unavailable")) return "reviewer-unavailable";
  if (!decision) return "code-lint";
  if (!decision.approved) return "reviewer";
  return "code-lint"; // the reviewer's own edit failed the lint
}

async function runAnswerCase(c: EvalCase, base: Pick<RunResult, "id" | "run" | "startedAt">): Promise<RunResult> {
  const t = await newWorld();
  const { anonId, profileId } = await newProfile(t, c);
  let parentId: Id<"answers"> | undefined;
  let parentReused: boolean | undefined;
  if (c.input.type === "followup") {
    const p = await parentIn(t, profileId, c);
    parentId = p.id;
    parentReused = p.reused;
  }
  const t0 = Date.now();
  let answerId: Id<"answers">;
  try {
    answerId = await t.mutation(api.answers.start, {
      anonId,
      text: c.input.text,
      ...(parentId ? { parentId } : { category: c.input.type as "pill" | "drink" | "food" }),
    });
  } catch (e) {
    const msg = (e as { data?: string }).data ?? (e as Error).message;
    return { ...base, status: "rejected", rejectedMessage: String(msg), latency: { totalMs: Date.now() - t0 }, parentReused };
  }
  const done = await waitAnswer(t, answerId);
  const review = await t.run((ctx) =>
    ctx.db.query("answer_reviews").withIndex("by_answerId", (q) => q.eq("answerId", answerId)).order("desc").first(),
  );
  const a = done.a;
  const reasons = a?.reviewSummary?.blockedReasons ?? [];
  const decision = (review?.reviewerDecision as RunResult["reviewerDecision"]) ?? null;
  const status = "timedOut" in done ? "timeout" : (a!.status as RunResult["status"]);
  return {
    ...base,
    status,
    error: a?.error ?? null,
    draft: (review?.draft as ShownAnswer) ?? null,
    lint: review?.lint ?? [],
    reviewerDecision: decision,
    blockedBy: status === "blocked" ? blockedBy(decision, reasons) : null,
    blockedReasons: reasons,
    final: status === "final" ? (a!.final as ShownAnswer) : null,
    edited: a?.reviewSummary?.edited ?? false,
    evidence: (review?.registry as { evidence?: Record<string, string> } | undefined)?.evidence ?? {},
    trace: (a?.toolTrace ?? []).map((s) => ({ tool: s.tool, summary: s.summary, ok: s.ok })),
    parentReused,
    latency: {
      totalMs: done.at - t0,
      ...(review ? { draftMs: review.createdAt - t0, reviewMs: done.at - review.createdAt } : {}),
    },
  };
}

async function runLogCase(c: EvalCase, base: Pick<RunResult, "id" | "run" | "startedAt">): Promise<RunResult> {
  const t = await newWorld();
  const { anonId } = await newProfile(t, c);
  const t0 = Date.now();
  let logId: Id<"log_entries">;
  try {
    logId = await t.mutation(api.logs.create, {
      anonId,
      outcome: c.input.outcome ?? "neutral",
      note: c.input.text,
      itemText: c.input.itemText,
    });
  } catch (e) {
    return { ...base, status: "rejected", rejectedMessage: String((e as { data?: string }).data ?? (e as Error).message), pooled: false, latency: { totalMs: Date.now() - t0 } };
  }
  for (;;) {
    const row = await t.run((ctx) => ctx.db.get("log_entries", logId));
    if (row && row.pooled !== null) {
      return { ...base, pooled: row.pooled, moderationReason: row.moderationReason ?? null, nudge: row.nudgeUser ?? null, latency: { totalMs: Date.now() - t0 } };
    }
    if (Date.now() - t0 > CASE_TIMEOUT_MS) return { ...base, status: "timeout", pooled: null, latency: { totalMs: Date.now() - t0 } };
    await sleep(300);
  }
}

async function runSwapCase(c: EvalCase, base: Pick<RunResult, "id" | "run" | "startedAt">): Promise<RunResult> {
  const t = await newWorld();
  const { anonId } = await newProfile(t, c);
  const t0 = Date.now();
  let swapId: Id<"swaps">;
  try {
    swapId = await t.action(api.swaps.submit, { anonId, insteadOf: c.input.insteadOf!, use: c.input.use!, note: c.input.text });
  } catch (e) {
    return { ...base, status: "rejected", rejectedMessage: String((e as { data?: string }).data ?? (e as Error).message), pooled: false, latency: { totalMs: Date.now() - t0 } };
  }
  for (;;) {
    const row = await t.run((ctx) => ctx.db.get("swaps", swapId));
    if (row && row.pooled !== null) {
      return {
        ...base,
        pooled: row.pooled,
        moderationReason: row.moderationReason ?? null,
        nudge: row.nudgeUser ?? null,
        guidelineCheck: row.guidelineCheck ?? null,
        latency: { totalMs: Date.now() - t0 },
      };
    }
    if (Date.now() - t0 > CASE_TIMEOUT_MS) return { ...base, status: "timeout", pooled: null, latency: { totalMs: Date.now() - t0 } };
    await sleep(300);
  }
}

async function runCase(c: EvalCase): Promise<RunResult> {
  const base = { id: c.id, run: RUN, startedAt: new Date().toISOString() };
  const started = Date.now();
  const errorsBefore = transportErrors;
  let r: RunResult;
  try {
    r = c.input.type === "log" ? await runLogCase(c, base) : c.input.type === "swap" ? await runSwapCase(c, base) : await runAnswerCase(c, base);
  } catch (e) {
    return { ...base, transport: TRANSPORT, harnessError: (e as Error).stack?.slice(0, 1500) ?? String(e), latency: { totalMs: Date.now() - started } };
  }
  r.transport = TRANSPORT;
  // An outage of the model transport is not the pipeline's safety behavior (fail-closed
  // blocks and "moderation unavailable" would read as correct refusals), so rerun it.
  const outage =
    r.status === "failed" ||
    r.status === "timeout" ||
    r.blockedBy === "reviewer-unavailable" ||
    /unavailable|moderator declined/.test(r.moderationReason ?? "");
  if (outage && (transportErrors > errorsBefore || limitHit)) {
    r.harnessError = `model transport failed during this case (${r.status ?? r.moderationReason}): ${r.error ?? ""}`;
  }
  return r;
}

it("runs eval cases through the real pipeline", async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const resultsPath = `${OUT_DIR}/results.jsonl`;
  const all: EvalCase[] = readFileSync("eval/demo-cases.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
  // Resumable: cases with a clean result are skipped; harness errors are retried.
  const done = new Set<string>();
  if (existsSync(resultsPath)) {
    for (const l of readFileSync(resultsPath, "utf8").trim().split("\n").filter(Boolean)) {
      const r: RunResult = JSON.parse(l);
      if (!r.harnessError) done.add(r.id);
    }
  }
  let todo = all.filter((c) => (IDS ? IDS.has(c.id) : SPLIT === "all" || c.split === SPLIT)).filter((c) => !done.has(c.id));
  if (LIMIT) todo = todo.slice(0, LIMIT);
  console.log(`[eval] run=${RUN} split=${SPLIT} todo=${todo.length} (already done ${done.size}) concurrency=${CONCURRENCY}`);

  let next = 0;
  let finished = 0;
  const started = Date.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < todo.length && !limitHit) {
        const c = todo[next++];
        const r = await runCase(c);
        appendFileSync(resultsPath, JSON.stringify(r) + "\n");
        finished++;
        const tag = r.harnessError ? "HARNESS-ERROR" : r.status ?? (r.pooled ? "pooled" : "private");
        console.log(`[eval] ${finished}/${todo.length} ${c.id} ${tag} ${(r.latency.totalMs / 1000).toFixed(1)}s`);
      }
    }),
  );
  // Let fire-and-forget usage tallies settle.
  await sleep(1000);
  const usagePath = `${OUT_DIR}/usage.json`;
  const prev = existsSync(usagePath) ? JSON.parse(readFileSync(usagePath, "utf8")) : { segments: [] };
  prev.segments.push({ at: new Date().toISOString(), transport: TRANSPORT, commit: process.env.EVAL_COMMIT ?? null, cases: finished, wallMs: Date.now() - started, usage });
  writeFileSync(usagePath, JSON.stringify(prev, null, 2));
  if (limitHit) throw new Error(`stopped early: claude -p usage limit (${limitHit}); rerun the same command to resume`);
});
