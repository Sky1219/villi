import { defineConfig } from "vitest/config";

// The eval runner: real Convex functions in convex-test worlds, live model calls.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test", "@convex-dev/action-retrier"] } },
    include: ["eval/**/*.eval.ts"],
    testTimeout: 12 * 60 * 60_000,
    hookTimeout: 10 * 60_000,
  },
});
