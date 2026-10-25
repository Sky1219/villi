import { v } from "convex/values";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { env, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { anthropicClient, mainModel } from "./lib/llm";
import { REVIEWER_SYSTEM } from "./lib/prompts";
import { ReviewerSchema, type Answer, type ReviewerDecision } from "./lib/answerSchema";
import { reviewDraft, type CitationRegistry } from "./lib/safety";
import { attachEvidence } from "./lib/evidence";
import { safetyChanges } from "./lib/safetyBadge";
import { coverageNoteFor } from "./lib/coverage";

type Registry = CitationRegistry & { evidence?: Record<string, string> };

async function claudeReview(answer: Answer, reg: Registry, language: string): Promise<ReviewerDecision> {
  const client = anthropicClient(env);
  const res = await client.messages.parse({
    model: mainModel(env),
    max_tokens: 8000,
    system: REVIEWER_SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(ReviewerSchema) },
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          userLanguage: language,
          draft: answer,
          // What each citation actually says, so the reviewer can check support.
          retrievedSources: Object.fromEntries(
            Object.entries(reg.evidence ?? {}).map(([k, t]) => [k, t.slice(0, 1500)]),
          ),
        }),
      },
    ],
  });
  if (res.stop_reason === "refusal") {
    return { approved: false, edits: null, blockedReasons: ["reviewer declined to approve"] };
  }
  if (!res.parsed_output) throw new Error("reviewer returned no parseable decision");
  return res.parsed_output;
}

// Scheduled by answers.saveDraft through the action retrier. Throwing here
// retries; exhausting retries fails closed in answers.onReviewComplete.
export const run = internalAction({
  args: { answerId: v.id("answers") },
  handler: async (ctx, args): Promise<null> => {
    const r: { draft: unknown; registry: Registry; status: string; language: string } | null = await ctx.runQuery(
      internal.answers.getReview,
      { answerId: args.answerId },
    );
    if (!r || r.status !== "reviewing") return null;
    const outcome = await reviewDraft(r.draft, r.registry, (a) => claudeReview(a, r.registry, r.language));
    await ctx.runMutation(internal.answers.finalize, {
      answerId: args.answerId,
      status: outcome.status,
      final:
        outcome.status === "final"
          ? {
              ...outcome.final,
              evidence: attachEvidence(outcome.final, r.registry.evidence ?? {}),
              // Set by code from what was retrieved, not by the model.
              communitySynthetic: !!r.registry.communitySynthetic,
              // Rule-based, appended after review: liquid/IR swaps can cost more or need approval.
              coverageNote: coverageNoteFor(outcome.final, r.registry.labelSections ?? []),
            }
          : undefined,
      edited: outcome.status === "final" ? outcome.edited : false,
      blockedReasons: outcome.status === "blocked" ? outcome.blockedReasons : [],
      lint: outcome.lint,
      decision: outcome.decision,
      safetyChanges: outcome.status === "final" ? safetyChanges(outcome.linted, outcome.final, outcome.lint, outcome.edited) : [],
    });
    return null;
  },
});
