import { defineApp } from "convex/server";
import { v } from "convex/values";
import actionRetrier from "@convex-dev/action-retrier/convex.config";

const app = defineApp({
  env: {
    ANTHROPIC_API_KEY: v.optional(v.string()),
    ANTHROPIC_MODEL_MAIN: v.optional(v.string()),
    ANTHROPIC_MODEL_FAST: v.optional(v.string()),
    VOYAGE_API_KEY: v.optional(v.string()),
    OPENFDA_API_KEY: v.optional(v.string()),
    DEMO_MODE: v.optional(v.string()),
  },
});
app.use(actionRetrier);

export default app;
