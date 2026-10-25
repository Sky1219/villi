// `npm run eval -- [--split tune|holdout|all] [--run NAME] [--limit N] [--ids a,b]
//                  [--concurrency N] [--transport api|cli] [--no-grade] [--no-report]`
// Runs cases through the pipeline (eval/pipeline.eval.ts), grades them
// (eval/grade.ts), and rewrites eval/REPORT.md (eval/report.ts).
// Defaults: the held-out split, run name "holdout"; its results are also copied
// to eval/results.jsonl.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { loadEnv } from "./env";

const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  console.log(readUsage());
  process.exit(0);
}
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const split = flag("split") ?? "holdout";
const run = flag("run") ?? split;
const out = `eval/runs/${run}`;

loadEnv();
const env = {
  ...process.env,
  EVAL_RUN: run,
  EVAL_OUT: out,
  EVAL_SPLIT: split,
  // The code the run measured: commit plus whether the tree had uncommitted changes.
  EVAL_COMMIT: `${execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim()}${execFileSync("git", ["status", "--porcelain", "convex", "data"], { encoding: "utf8" }).trim() ? "+dirty" : ""}`,
  ...(flag("limit") ? { EVAL_LIMIT: flag("limit") } : {}),
  ...(flag("ids") ? { EVAL_IDS: flag("ids") } : {}),
  ...(flag("concurrency") ? { EVAL_CONCURRENCY: flag("concurrency") } : {}),
  // api (default) or cli: every model call through local `claude -p` (eval/cli.ts).
  ...(flag("transport") ? { EVAL_TRANSPORT: flag("transport") } : {}),
};
const sh = process.platform === "win32";

const runner = spawnSync("npx", ["vitest", "run", "--config", "eval/vitest.config.ts"], { stdio: "inherit", env, shell: sh });
if (runner.status !== 0) process.exit(runner.status ?? 1);
if (split === "holdout" && existsSync(`${out}/results.jsonl`)) copyFileSync(`${out}/results.jsonl`, "eval/results.jsonl");

if (!argv.includes("--no-grade")) {
  const g = spawnSync("npx", ["tsx", "eval/grade.ts", run], { stdio: "inherit", env, shell: sh });
  if (g.status !== 0) process.exit(g.status ?? 1);
}
if (!argv.includes("--no-report")) {
  const r = spawnSync("npx", ["tsx", "eval/report.ts"], { stdio: "inherit", env, shell: sh });
  process.exit(r.status ?? 0);
}

function readUsage() {
  return "npm run eval -- [--split tune|holdout|all] [--run NAME] [--limit N] [--ids a,b] [--concurrency N] [--transport api|cli] [--no-grade] [--no-report]";
}
