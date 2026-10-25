import Anthropic from "@anthropic-ai/sdk";

export type LlmEnv = {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL_MAIN?: string;
  ANTHROPIC_MODEL_FAST?: string;
  ANTHROPIC_MODEL_REVIEWER?: string;
};

export function anthropicClient(e: LlmEnv): Anthropic {
  if (!e.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set on the Convex deployment (npx convex env set ANTHROPIC_API_KEY ...)");
  }
  return new Anthropic({ apiKey: e.ANTHROPIC_API_KEY, maxRetries: 2 });
}

export const mainModel = (e: LlmEnv) => e.ANTHROPIC_MODEL_MAIN || "claude-sonnet-5-5";
// The reviewer is one call per answer, so it can run on a stronger model than the agent loop.
export const reviewerModel = (e: LlmEnv) => e.ANTHROPIC_MODEL_REVIEWER || mainModel(e);
export const fastModel = (e: LlmEnv) => e.ANTHROPIC_MODEL_FAST || "claude-haiku-5-5";
