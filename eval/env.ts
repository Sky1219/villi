// Loads model keys from the Convex dev deployment into this process only.
// Values are never printed or written to disk.
import { execFileSync } from "node:child_process";

const NAMES = ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL_MAIN", "ANTHROPIC_MODEL_FAST", "VOYAGE_API_KEY", "OPENFDA_API_KEY"];

export function loadEnv(): void {
  for (const name of NAMES) {
    if (process.env[name]) continue;
    try {
      const out = execFileSync("npx", ["convex", "env", "get", name], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        shell: process.platform === "win32",
      }).trim();
      if (out && !/not found|no environment variable/i.test(out)) process.env[name] = out;
    } catch {
      // Optional keys may be unset.
    }
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not found in the shell or on the Convex dev deployment");
  }
}

export const MAIN_MODEL = () => process.env.ANTHROPIC_MODEL_MAIN || "claude-opus-5-5";
