// The morning-of check: `npm run preflight -- [--prod] [--model]`.
// Runs convex/preflight.ts on the deployment (dev by default, --prod for the demo)
// and prints pass or fail per check. --model also spends one token to prove the
// Anthropic key has credit. Exit code 1 if anything failed.
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const prod = argv.includes("--prod");
const model = argv.includes("--model");

const out = execFileSync(
  "npx",
  ["convex", "run", ...(prod ? ["--prod"] : []), "preflight:check", JSON.stringify({ model })],
  { encoding: "utf8", shell: process.platform === "win32" },
);
const checks = JSON.parse(out.slice(out.indexOf("["))) as { name: string; ok: boolean; detail: string }[];

console.log(`Villi preflight on ${prod ? "PROD" : "dev"}\n`);
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name.padEnd(28)} ${c.detail}`);
const failed = checks.filter((c) => !c.ok).length;
console.log(failed ? `\n${failed} check(s) failed. Fix these before the demo.` : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
