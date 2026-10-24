// `npm run eval:report`: writes eval/REPORT.md from the graded runs in eval/runs/.
// Runs it knows: baseline (tuning split, before fixes), patched (tuning split,
// after fixes), holdout (held-out split, after fixes; the reported number).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { DIMENSIONS, type Dimension, type EvalCase, type GradedResult, type RunResult, type ShownAnswer } from "./types";

const FIXES_PATH = "eval/FIXES.md";
const SEVERITY: Dimension[] = ["decided", "quantity", "guideline_contradicted", "pooled_when_shouldnt", "overconfident", "uncited_claim", "missing_ask"];

const cases = new Map<string, EvalCase>(
  readFileSync("eval/cases.jsonl", "utf8").trim().split("\n").map((l) => {
    const c: EvalCase = JSON.parse(l);
    return [c.id, c];
  }),
);

type Row = { c: EvalCase; r: RunResult; g: GradedResult };

function load(run: string): Row[] | null {
  const dir = `eval/runs/${run}`;
  if (!existsSync(`${dir}/graded.jsonl`)) return null;
  const results = new Map<string, RunResult>();
  for (const l of readFileSync(`${dir}/results.jsonl`, "utf8").trim().split("\n").filter(Boolean)) {
    const r: RunResult = JSON.parse(l);
    if (!r.harnessError || !results.has(r.id)) results.set(r.id, r);
  }
  const rows: Row[] = [];
  for (const l of readFileSync(`${dir}/graded.jsonl`, "utf8").trim().split("\n").filter(Boolean)) {
    const g: GradedResult = JSON.parse(l);
    const r = results.get(g.id);
    const c = cases.get(g.id);
    if (r && c && !r.harnessError) rows.push({ c, r, g });
  }
  return rows;
}

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
const frac = (n: number, d: number) => `${n}/${d} (${pct(n, d)})`;
const isAnswer = (row: Row) => !["log", "swap"].includes(row.c.input.type);
const bad = (g: GradedResult["finalGrade"] | null, dims: readonly Dimension[] = DIMENSIONS) => (g ? dims.filter((d) => g[d].violated) : []);
const drafted = (rows: Row[]) => rows.filter((x) => isAnswer(x) && x.g.draftGrade);

function quantile(xs: number[], q: number) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}
const secs = (ms: number) => (Number.isNaN(ms) ? "n/a" : `${(ms / 1000).toFixed(1)}s`);

function statusTable(rows: Row[]) {
  const counts: Record<string, number> = {};
  for (const x of rows) {
    const k = isAnswer(x) ? (x.r.status === "blocked" ? `blocked (${x.r.blockedBy})` : x.r.status ?? "?") : x.r.status === "rejected" ? "rejected" : x.r.pooled ? "pooled" : "kept private";
    counts[`${isAnswer(x) ? "answer" : x.c.input.type}: ${k}`] = (counts[`${isAnswer(x) ? "answer" : x.c.input.type}: ${k}`] ?? 0) + 1;
  }
  return ["| Outcome | Cases |", "|---|---|", ...Object.entries(counts).sort().map(([k, v]) => `| ${k} | ${v} |`)].join("\n");
}

// Violation rate per dimension and per case category, draft vs final.
function violationTables(rows: Row[]) {
  const ans = rows.filter(isAnswer);
  const d = drafted(rows);
  const nonAns = rows.filter((x) => !isAnswer(x));
  const lines = [
    "Rates are per case. Draft = the agent's submitted answer before the reviewer (it has already passed the agent-side code lint retry loop); final = what the user saw. A blocked answer shows the user no medical content, so it has no final violations.",
    "",
    "| Dimension | Draft | Final |",
    "|---|---|---|",
  ];
  for (const dim of DIMENSIONS) {
    if (dim === "pooled_when_shouldnt") {
      lines.push(`| ${dim} (log/swap cases) | n/a | ${frac(nonAns.filter((x) => x.g.finalGrade[dim].violated).length, nonAns.length)} |`);
      continue;
    }
    const fin = rows.filter((x) => x.g.finalGrade[dim].violated).length;
    lines.push(`| ${dim} | ${frac(d.filter((x) => x.g.draftGrade![dim].violated).length, d.length)} | ${frac(fin, dim === "decided" || dim === "quantity" ? rows.length : ans.length)} |`);
  }
  lines.push(
    `| **any violation** | ${frac(d.filter((x) => bad(x.g.draftGrade).length).length, d.length)} | ${frac(rows.filter((x) => bad(x.g.finalGrade).length).length, rows.length)} |`,
  );
  lines.push("", "| Case category | Cases | Any violation, draft | Any violation, final | decided or quantity, final |", "|---|---|---|---|---|");
  for (const cat of ["routine", "adversarial", "edge"] as const) {
    const sub = rows.filter((x) => x.c.category === cat);
    const sd = drafted(sub);
    lines.push(
      `| ${cat} | ${sub.length} | ${frac(sd.filter((x) => bad(x.g.draftGrade).length).length, sd.length)} | ${frac(sub.filter((x) => bad(x.g.finalGrade).length).length, sub.length)} | ${frac(sub.filter((x) => bad(x.g.finalGrade, ["decided", "quantity"]).length).length, sub.length)} |`,
    );
  }
  return lines.join("\n");
}

function reviewerTables(rows: Row[]) {
  const d = drafted(rows);
  const dirty = d.filter((x) => bad(x.g.draftGrade, DIMENSIONS).length);
  const caught = dirty.filter((x) => bad(x.g.draftGrade).every((dim) => !x.g.finalGrade[dim].violated));
  const how = (xs: Row[]) => {
    const m: Record<string, number> = {};
    for (const x of xs) {
      const k = x.r.status === "blocked" ? `blocked by ${x.r.blockedBy}` : x.r.status === "final" ? (x.r.edited ? "edited by reviewer" : "removed by code lint") : x.r.status!;
      m[k] = (m[k] ?? 0) + 1;
    }
    return Object.entries(m).map(([k, v]) => `${k}: ${v}`).join("; ");
  };
  const fine = d.filter((x) => bad(x.g.draftGrade).length === 0);
  const fineBlocked = fine.filter((x) => x.r.status === "blocked");
  const perDim = DIMENSIONS.filter((dim) => dim !== "pooled_when_shouldnt").map((dim) => {
    const had = d.filter((x) => x.g.draftGrade![dim].violated);
    const fixed = had.filter((x) => !x.g.finalGrade[dim].violated);
    return `| ${dim} | ${had.length} | ${frac(fixed.length, had.length)} |`;
  });
  return [
    `- **Reviewer catch rate:** ${frac(caught.length, dirty.length)} of drafts with at least one graded violation reached the user with none of those violations (${how(caught)}).`,
    `- **Missed:** ${dirty.length - caught.length} draft(s) kept a violation into the final (${how(dirty.filter((x) => !caught.includes(x)))}).`,
    `- **False-positive rate:** ${frac(fineBlocked.length, fine.length)} of drafts the grader found clean were blocked anyway (${how(fineBlocked) || "none"}).`,
    "",
    "| Draft violation | Drafts with it | Absent from final |",
    "|---|---|---|",
    ...perDim,
  ].join("\n");
}

function latencyTable(rows: Row[]) {
  const groups: [string, Row[]][] = [
    ["pill / drink / food (answer)", rows.filter((x) => ["pill", "drink", "food"].includes(x.c.input.type) && x.r.status !== "rejected")],
    ["follow-up (answer)", rows.filter((x) => x.c.input.type === "followup" && x.r.status !== "rejected")],
    ["log (moderation)", rows.filter((x) => x.c.input.type === "log")],
    ["swap (moderation)", rows.filter((x) => x.c.input.type === "swap")],
  ];
  const lines = ["| Path | n | p50 | p90 | p95 | max |", "|---|---|---|---|---|---|"];
  for (const [name, xs] of groups) {
    const t = xs.map((x) => x.r.latency.totalMs);
    lines.push(`| ${name}, total | ${t.length} | ${secs(quantile(t, 0.5))} | ${secs(quantile(t, 0.9))} | ${secs(quantile(t, 0.95))} | ${secs(Math.max(...t))} |`);
  }
  const ans = rows.filter((x) => x.r.latency.draftMs !== undefined);
  for (const [name, f] of [["agent to draft", (x: Row) => x.r.latency.draftMs!], ["review (lint + Claude reviewer)", (x: Row) => x.r.latency.reviewMs!]] as const) {
    const t = ans.map(f);
    lines.push(`| ${name} | ${t.length} | ${secs(quantile(t, 0.5))} | ${secs(quantile(t, 0.9))} | ${secs(quantile(t, 0.95))} | ${secs(Math.max(...t))} |`);
  }
  // Buckets for a quick shape of the distribution.
  const totals = rows.filter((x) => isAnswer(x) && x.r.status !== "rejected").map((x) => x.r.latency.totalMs / 1000);
  const edges = [15, 30, 45, 60, 90, 120, Infinity];
  const hist = edges.map((e, i) => {
    const lo = i === 0 ? 0 : edges[i - 1];
    const n = totals.filter((t) => t >= lo && t < e).length;
    return `| ${lo}-${e === Infinity ? "" : e}s | ${n} | ${"#".repeat(Math.round((40 * n) / Math.max(1, totals.length)))} |`;
  });
  return [...lines, "", "Answer latency distribution (submit to final or blocked, per case):", "", "| Bucket | Cases | |", "|---|---|---|", ...hist].join("\n");
}

function shownText(a: ShownAnswer) {
  const out = [`state: ${a.state} (confidence ${a.confidence})`, `verdict: ${a.verdict}`];
  for (const w of a.why) out.push(`- ${w.claim} ${w.citation}`);
  if (a.swapToAskAbout) out.push(`swap to ask about: ${a.swapToAskAbout.text} ${a.swapToAskAbout.citation}`);
  for (const p of a.personal) out.push(`personal: ${p}`);
  for (const c of a.careTeamAnswers) out.push(`care team (${c.professionalType}): ${c.summary}`);
  if (a.diagram) out.push(`diagram: ${a.diagram.label} ${a.diagram.citation}`);
  out.push(a.ask);
  return out.join("\n");
}

function worst(rows: Row[], n = 10) {
  const score = (x: Row) => bad(x.g.finalGrade).reduce((s, d) => s + (SEVERITY.length - SEVERITY.indexOf(d)) ** 2, 0);
  const ranked = rows.filter((x) => score(x) > 0).sort((a, b) => score(b) - score(a)).slice(0, n);
  if (!ranked.length) return "No final output had a graded violation.";
  return ranked
    .map((x, i) => {
      const dims = bad(x.g.finalGrade);
      const input = { ...x.c.input, anatomy: x.c.anatomy };
      const shown = isAnswer(x) && x.r.final ? shownText(x.r.final) : `pooled=${x.r.pooled}\nnudge: ${x.r.nudge ?? "(none)"}`;
      return [
        `### ${i + 1}. ${x.c.id} (${x.c.category}; ${x.c.tags.filter((t) => !t.startsWith("intended:")).join(", ")})`,
        "",
        `Case: \`${JSON.stringify(input)}\``,
        "",
        "Final output, verbatim:",
        "",
        "```text",
        shown,
        "```",
        "",
        ...dims.map((d) => `- **${d}:** ${x.g.finalGrade[d].why}`),
      ].join("\n");
    })
    .join("\n\n");
}

function flagRecall(rows: Row[]) {
  const must = rows.filter((x) => x.c.expected.mustFlag && isAnswer(x) && x.r.status === "final");
  const hit = must.filter((x) => x.r.final!.state === "flagged");
  return `Of final answers where the case's anatomy and item hit a guideline concern by construction (expected.mustFlag), ${frac(hit.length, must.length)} were shown as "flagged".`;
}

function cost(run: string) {
  const p = `eval/runs/${run}/usage.json`;
  if (!existsSync(p)) return null;
  const PRICE: Record<string, [number, number]> = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5] };
  let usd = 0;
  let wall = 0;
  for (const s of JSON.parse(readFileSync(p, "utf8")).segments) {
    wall += s.wallMs;
    for (const [m, u] of Object.entries(s.usage as Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }>)) {
      const [i, o] = PRICE[m] ?? [4, 20];
      usd += (u.input * i + u.cacheWrite * i * 1.25 + u.cacheRead * i * 0.1 + u.output * o) / 1e6;
    }
  }
  return `pipeline model spend for this run about $${usd.toFixed(2)} (grader not included), wall clock ${(wall / 60000).toFixed(0)} min`;
}

function compare(before: Row[], after: Row[]) {
  const ids = new Set(after.map((x) => x.c.id));
  const b = before.filter((x) => ids.has(x.c.id));
  const bIds = new Set(b.map((x) => x.c.id));
  const a = after.filter((x) => bIds.has(x.c.id));
  const lines = [`Same ${a.length} tuning cases before and after the fixes.`, "", "| Dimension | Draft before | Draft after | Final before | Final after |", "|---|---|---|---|---|"];
  for (const dim of DIMENSIONS) {
    const d0 = drafted(b);
    const d1 = drafted(a);
    lines.push(
      `| ${dim} | ${frac(d0.filter((x) => x.g.draftGrade![dim].violated).length, d0.length)} | ${frac(d1.filter((x) => x.g.draftGrade![dim].violated).length, d1.length)} | ${frac(b.filter((x) => x.g.finalGrade[dim].violated).length, b.length)} | ${frac(a.filter((x) => x.g.finalGrade[dim].violated).length, a.length)} |`,
    );
  }
  const blocked = (xs: Row[]) => xs.filter((x) => x.r.status === "blocked").length;
  lines.push(`| answers blocked | | | ${frac(blocked(b), b.filter(isAnswer).length)} | ${frac(blocked(a), a.filter(isAnswer).length)} |`);
  return lines.join("\n");
}

function section(title: string, run: string, rows: Row[]) {
  const c = cost(run);
  return [
    `## ${title}`,
    "",
    `${rows.length} cases (${["routine", "adversarial", "edge"].map((k) => `${rows.filter((x) => x.c.category === k).length} ${k}`).join(", ")}). Run date ${rows[0]?.r.startedAt.slice(0, 10) ?? "?"}${c ? `; ${c}` : ""}.`,
    "",
    "### Outcomes",
    "",
    statusTable(rows),
    "",
    "### Violation rates",
    "",
    violationTables(rows),
    "",
    "### Reviewer",
    "",
    reviewerTables(rows),
    "",
    flagRecall(rows),
    "",
    "### Latency",
    "",
    latencyTable(rows),
  ].join("\n");
}

// A rerun that has results but no grades: compare what code can measure without a model.
function ungradedCompare(run: string): string | null {
  const p = `eval/runs/${run}/results.jsonl`;
  if (!existsSync(p) || existsSync(`eval/runs/${run}/graded.jsonl`) || !existsSync("eval/runs/baseline/results.jsonl")) return null;
  const read = (f: string): RunResult[] => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const before = new Map(read("eval/runs/baseline/results.jsonl").map((r) => [r.id, r]));
  const after = read(p).filter((r) => r.status && before.has(r.id));
  const prior = after.map((r) => before.get(r.id)!);
  const blocked = (xs: RunResult[]) => xs.filter((r) => r.status === "blocked").length;
  const phrase = (xs: RunResult[]) => xs.filter((r) => r.status === "blocked" && (r.blockedReasons ?? []).some((s) => s.includes("nothing in the sources"))).length;
  const types = after.reduce<Record<string, number>>((m, r) => ((m[cases.get(r.id)!.input.type] = (m[cases.get(r.id)!.input.type] ?? 0) + 1), m), {});
  return [
    `## Partial rerun after the fixes (${run}, not graded)`,
    "",
    `The rerun of the tuning split stopped at ${after.length} answer cases when the API credit ran out, and it was not graded, so it gives no violation rates. By input type: ${Object.entries(types).map(([k, v]) => `${v} ${k}`).join(", ")}. Almost no adversarial follow-ups ran, so the \`decided\` fix is untested. What code can compare on the same cases:`,
    "",
    "| On the same cases | Baseline | After fixes |",
    "|---|---|---|",
    `| answers blocked | ${frac(blocked(prior), prior.length)} | ${frac(blocked(after), after.length)} |`,
    `| blocked because a reviewer edit dropped "nothing in the sources I checked" | ${phrase(prior)} | ${phrase(after)} |`,
  ].join("\n");
}

const baseline = load("baseline");
const patched = load("patched");
const holdout = load("holdout");

const allCases = [...cases.values()];
const parts: string[] = [
  "# Villi safety evaluation",
  "",
  `Generated ${new Date().toISOString().slice(0, 10)} by \`npm run eval:report\`. Cases: ${allCases.length} in \`eval/cases.jsonl\` (${allCases.filter((c) => c.category === "adversarial").length} adversarial, ${allCases.filter((c) => c.category === "edge").length} edge, ${allCases.filter((c) => c.category === "routine").length} routine), ${allCases.filter((c) => c.split === "holdout").length} held out. The prompt fixes were chosen from the tuning split only; ${holdout ? "the held-out split was run once, after the fixes." : "the held-out split has not been run yet."}`,
  "",
  "**How it works.** Each case runs in a fresh in-memory Convex world (convex-test) seeded with `seed:run`, through the same public mutations the app calls (`answers.start`, `logs.create`, `swaps.submit`), the real agent loop, the deterministic safety lint, and the Claude reviewer scheduled through the action retrier, with live Claude, openFDA and Voyage calls. Follow-ups run on a real parent answer. A Claude grader (the strongest model) scores the agent's draft and the user-visible final on seven dimensions with a one-line reason each. Latency is wall-clock under concurrency 8 with an in-memory database, so it is a little faster than the deployed app on the database side and similar on the model side.",
  "",
  "**What it does not cover.** No real patients and no real photos (every case is typed text; the vision path and \"I saw something\" are untested here). Cases and grades are both model-written, so the grader can share blind spots with the agent. The held-out split is 100 cases, so each percentage point is one case.",
  "",
];
if (holdout) parts.push(section("Held-out result (after fixes)", "holdout", holdout), "", "### The 10 worst final outputs (held-out)", "", worst(holdout), "");
if (baseline && patched) {
  parts.push("## Before and after the prompt fixes (tuning split)", "", existsSync(FIXES_PATH) ? readFileSync(FIXES_PATH, "utf8").trim() : "", "", compare(baseline, patched), "");
}
if (patched) parts.push(section("Tuning split after fixes", "patched", patched), "");
if (!holdout) {
  parts.push(
    "## Status",
    "",
    "The held-out split has **not** been run, so this report has no held-out number. Everything below is the tuning split. The fixes are in the prompts and corpus, but their effect on violation rates is unmeasured. Finish with `npm run eval -- --split tune --run patched` (it resumes), then `npm run eval` for the held-out split.",
    "",
  );
}
const partial = ungradedCompare("patched");
if (partial) parts.push(partial, "", existsSync(FIXES_PATH) ? `### The fixes

${readFileSync(FIXES_PATH, "utf8").trim()}` : "", "");
if (baseline) parts.push(section("Tuning split baseline (before fixes)", "baseline", baseline), "", "### The 10 worst final outputs (tuning baseline)", "", worst(baseline), "");
writeFileSync("eval/REPORT.md", parts.join("\n") + "\n");
console.log(`wrote eval/REPORT.md (${[baseline && "baseline", patched && "patched", holdout && "holdout"].filter(Boolean).join(", ") || "no graded runs yet"})`);
