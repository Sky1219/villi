import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const EMBEDDING_DIMS = 1024;

export const anatomyValidator = v.object({
  colonInContinuity: v.boolean(),
  stomaType: v.union(
    v.literal("none"),
    v.literal("ileostomy"),
    v.literal("colostomy"),
    v.literal("jejunostomy"),
  ),
  bowelLengthBand: v.union(
    v.literal("unknown"),
    v.literal("<100cm"),
    v.literal("100-200cm"),
    v.literal(">200cm"),
  ),
});

export const roleValidator = v.union(
  v.literal("patient"),
  v.literal("caregiver"),
  v.literal("clinician"),
);

export const outcomeValidator = v.union(
  v.literal("helped"),
  v.literal("neutral"),
  v.literal("hurt"),
);

export const categoryValidator = v.union(
  v.literal("pill"),
  v.literal("drink"),
  v.literal("food"),
  v.literal("action"),
);

export const professionalTypeValidator = v.union(
  v.literal("pharmacist"),
  v.literal("dietitian"),
  v.literal("doctor"),
  v.literal("nurse"),
);

// What a caregiver profile's patient is to them. A relationship, never a name.
export const caresForValidator = v.union(
  v.literal("parent"),
  v.literal("partner"),
  v.literal("child"),
  v.literal("other"),
);

export const questionStatusValidator = v.union(v.literal("open"), v.literal("asked"), v.literal("answered"));

// What the care team's answer led to: Villi's primary impact metric, logged by the user.
export const resultingChangeValidator = v.union(
  v.literal("formulation_changed"),
  v.literal("dose_monitored"),
  v.literal("no_change"),
  v.literal("pending"),
);

export const segmentModeValidator = v.union(
  v.literal("absorbs-here"),
  v.literal("releases-here"),
  v.literal("missing"),
);

// null = waiting on moderation, true = visible to others, false = author only.
const pooled = v.union(v.boolean(), v.null());

export const traceStepValidator = v.object({
  step: v.number(),
  tool: v.string(),
  summary: v.string(),
  ok: v.boolean(),
  at: v.number(),
});

export const sawValidator = v.object({
  shape: v.union(v.string(), v.null()),
  color: v.union(v.string(), v.null()),
  size: v.union(v.string(), v.null()),
  imprint: v.union(v.string(), v.null()),
});

// "Something's wrong with this answer": one tap, no free text.
export const problemKindValidator = v.union(
  v.literal("wrong_item"),
  v.literal("unsupported_claim"),
  v.literal("confusing"),
  v.literal("other"),
);

export const answerStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("reviewing"),
  v.literal("final"),
  v.literal("blocked"),
  v.literal("failed"),
);

export default defineSchema({
  profiles: defineTable({
    anonId: v.string(),
    role: roleValidator,
    anatomy: anatomyValidator,
    anatomyKey: v.string(),
    language: v.string(),
    // Set for caregivers: the profile holds the patient's anatomy and meds, run by the caregiver.
    caresFor: v.optional(caresForValidator),
    clinicianDemoVerified: v.boolean(),
    synthetic: v.boolean(),
    // What the user tapped on the gut diagram (coarse, non-identifying).
    diagram: v.optional(
      v.object({ removed: v.array(v.string()), stomaAfter: v.union(v.string(), v.null()) }),
    ),
    // "father" | "peer" for demo templates that /demo clones.
    templateKey: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_anonId", ["anonId"])
    .index("by_templateKey", ["templateKey"])
    .index("by_synthetic", ["synthetic"]),

  meds: defineTable({
    profileId: v.id("profiles"),
    name: v.string(),
    genericName: v.optional(v.string()),
    dosageForm: v.optional(v.string()),
    // Key into fda_label_cache (labels are ~200 KB; we store a trimmed copy there).
    fdaLabelKey: v.optional(v.string()),
    imprint: v.optional(v.string()),
    color: v.optional(v.string()),
    shape: v.optional(v.string()),
    addedAt: v.number(),
  }).index("by_profileId", ["profileId"]),

  items: defineTable({
    canonicalName: v.string(),
    category: categoryValidator,
    attributes: v.record(
      v.string(),
      v.union(v.string(), v.number(), v.boolean(), v.array(v.string())),
    ),
    aliases: v.array(v.string()),
    // canonicalName + aliases joined, for the full-text fallback.
    searchText: v.string(),
    embedding: v.optional(v.array(v.float64())),
    synthetic: v.boolean(),
  })
    .index("by_canonicalName", ["canonicalName"])
    .searchIndex("search_text", {
      searchField: "searchText",
      filterFields: ["category"],
    })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: EMBEDDING_DIMS,
      filterFields: ["category"],
    }),

  log_entries: defineTable({
    profileId: v.id("profiles"),
    anatomySnapshot: anatomyValidator,
    anatomyKey: v.string(),
    // Free-text entries are canonicalized by the moderation action before pooling.
    itemId: v.optional(v.id("items")),
    itemText: v.optional(v.string()),
    answerId: v.optional(v.id("answers")),
    outcome: outcomeValidator,
    note: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    pooled,
    moderationReason: v.optional(v.string()),
    nudgeUser: v.optional(v.string()),
    moderationRunId: v.optional(v.string()),
    // Warning signs found in the note when it was saved (no text, just which signs).
    warning: v.optional(v.object({ level: v.union(v.literal("emergency"), v.literal("dehydration")), signs: v.array(v.string()) })),
    // When the author tapped "Got it" on the warning card.
    warningAckAt: v.optional(v.number()),
    synthetic: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_profileId_and_itemId", ["profileId", "itemId"])
    .index("by_moderationRunId", ["moderationRunId"])
    .index("by_synthetic", ["synthetic"]),

  swaps: defineTable({
    profileId: v.id("profiles"),
    anatomySnapshot: anatomyValidator,
    anatomyKey: v.string(),
    insteadOfItemId: v.id("items"),
    useItemId: v.id("items"),
    note: v.string(),
    pooled,
    moderationReason: v.optional(v.string()),
    nudgeUser: v.optional(v.string()),
    moderationRunId: v.optional(v.string()),
    guidelineCheck: v.optional(
      v.object({ passed: v.boolean(), citations: v.array(v.string()) }),
    ),
    upvotes: v.number(),
    clinicianEndorsements: v.array(v.id("profiles")),
    synthetic: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_insteadOfItemId", ["insteadOfItemId"])
    .index("by_pooled_and_anatomyKey", ["pooled", "anatomyKey"])
    .index("by_profileId", ["profileId"])
    .index("by_moderationRunId", ["moderationRunId"])
    .index("by_synthetic", ["synthetic"]),

  // One upvote per profile per swap.
  swap_votes: defineTable({
    swapId: v.id("swaps"),
    profileId: v.id("profiles"),
  })
    .index("by_swapId_and_profileId", ["swapId", "profileId"])
    .index("by_profileId", ["profileId"]),

  care_team_answers: defineTable({
    profileId: v.id("profiles"),
    anatomySnapshot: anatomyValidator,
    anatomyKey: v.string(),
    questionId: v.optional(v.id("questions")),
    questionText: v.string(),
    itemId: v.optional(v.id("items")),
    professionalType: professionalTypeValidator,
    answerText: v.string(),
    resultingChange: v.optional(resultingChangeValidator),
    // Who recorded it: the patient or caregiver ("self", the default) or the
    // holder of a care-team link. The link holder is not identity-verified.
    source: v.optional(v.union(v.literal("self"), v.literal("team_link"))),
    pooled,
    moderationReason: v.optional(v.string()),
    nudgeUser: v.optional(v.string()),
    moderationRunId: v.optional(v.string()),
    clinicianEndorsements: v.array(v.id("profiles")),
    synthetic: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_pooled_and_anatomyKey", ["pooled", "anatomyKey"])
    .index("by_itemId", ["itemId"])
    .index("by_profileId", ["profileId"])
    .index("by_questionId", ["questionId"])
    .index("by_moderationRunId", ["moderationRunId"])
    .index("by_synthetic", ["synthetic"])
    .searchIndex("search_question", {
      searchField: "questionText",
      filterFields: ["pooled", "anatomyKey"],
    }),

  // "Share with the care team": a read-only capability link to the sheet, where
  // the holder can record what happened to each question. Unguessable token,
  // 14-day expiry (set by a scheduled mutation), revocable.
  team_links: defineTable({
    profileId: v.id("profiles"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    expiredAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token", ["token"])
    .index("by_profileId", ["profileId"]),

  questions: defineTable({
    profileId: v.id("profiles"),
    text: v.string(),
    context: v.object({
      answerId: v.optional(v.id("answers")),
      itemName: v.optional(v.string()),
      citations: v.optional(v.array(v.string())),
      // Added from a flagged row of the medicine list review.
      fromReview: v.optional(v.boolean()),
    }),
    // `resolved` is kept in step with status === "answered" for older rows.
    resolved: v.boolean(),
    status: v.optional(questionStatusValidator),
    askedAt: v.optional(v.number()),
    // After the care team changed the form: the new form's name, when the
    // change was logged, and the two-week follow-up (set due by a scheduled mutation).
    newFormName: v.optional(v.string()),
    changedAt: v.optional(v.number()),
    followUpDue: v.optional(v.boolean()),
    afterChangeOutcome: v.optional(outcomeValidator),
    afterChangeLogId: v.optional(v.id("log_entries")),
    synthetic: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_synthetic", ["synthetic"]),

  guideline_chunks: defineTable({
    // Stable citation id: `${sourceId}#${locator}`. Never the Convex _id.
    chunkId: v.string(),
    sourceId: v.string(),
    sourceTitle: v.string(),
    sourceUrl: v.string(),
    locator: v.string(),
    text: v.string(),
    quote: v.optional(v.string()),
    tags: v.array(v.string()),
    anatomyScope: v.array(v.string()),
    appliesTo: v.optional(v.string()),
    diagram: v.optional(
      v.object({
        segmentIds: v.array(v.string()),
        mode: segmentModeValidator,
        label: v.string(),
      }),
    ),
    verified: v.boolean(),
    // Where in the source the statement comes from (heading, Best Practice Advice, table).
    section: v.optional(v.string()),
    // What `verified` was checked against: "abstract" or "full text". Checked by Claude, not a clinician.
    verifiedAgainst: v.optional(v.string()),
    contentHash: v.string(),
    embedding: v.optional(v.array(v.float64())),
  })
    .index("by_chunkId", ["chunkId"])
    .searchIndex("search_text", { searchField: "text" })
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: EMBEDDING_DIMS,
      filterFields: ["sourceId"],
    }),

  answers: defineTable({
    profileId: v.id("profiles"),
    kind: v.union(v.literal("scan"), v.literal("followup")),
    parentId: v.optional(v.id("answers")),
    input: v.object({
      text: v.optional(v.string()),
      photoId: v.optional(v.id("_storage")),
      category: v.optional(categoryValidator),
      // "I saw something": chips the user picked (coarse descriptors only).
      saw: v.optional(sawValidator),
    }),
    status: answerStatusValidator,
    // What the agent identified, shown as correctable before the answer lands.
    identified: v.optional(v.string()),
    // Canonical item, so the answer can show live community counts and log against it.
    itemId: v.optional(v.id("items")),
    toolTrace: v.array(traceStepValidator),
    // Reviewed answer JSON (see lib/answerSchema.ts). Only answers.finalize writes it.
    final: v.optional(v.any()),
    reviewSummary: v.optional(
      v.object({
        approved: v.boolean(),
        edited: v.boolean(),
        blockedReasons: v.array(v.string()),
      }),
    ),
    error: v.optional(v.string()),
    // "Was this useful?" on the answer card.
    useful: v.optional(v.boolean()),
    problemReport: v.optional(problemKindValidator),
    problemReportedAt: v.optional(v.number()),
    // "Check the new form": the question whose form change this check follows.
    followsQuestionId: v.optional(v.id("questions")),
    createdAt: v.number(),
  })
    .index("by_profileId", ["profileId"])
    .index("by_status", ["status"]),

  // Hidden from every public query: drafts must never reach the client.
  answer_reviews: defineTable({
    answerId: v.id("answers"),
    draft: v.any(),
    lint: v.array(v.string()),
    reviewerDecision: v.optional(
      v.object({
        approved: v.boolean(),
        edits: v.union(v.string(), v.null()),
        blockedReasons: v.array(v.string()),
      }),
    ),
    // CitationRegistry from lib/safety.ts: what the agent actually retrieved.
    registry: v.any(),
    runId: v.optional(v.string()),
    attempts: v.number(),
    createdAt: v.number(),
  })
    .index("by_answerId", ["answerId"])
    .index("by_runId", ["runId"]),

  aggregates: defineTable({
    itemId: v.id("items"),
    anatomyKey: v.string(),
    helped: v.number(),
    neutral: v.number(),
    hurt: v.number(),
    syntheticCount: v.number(),
  }).index("by_itemId_and_anatomyKey", ["itemId", "anatomyKey"]),

  // What care teams changed, per (item x anatomy): one counter row, changed only
  // in the same mutation that pools or unpools a moderated care-team answer.
  // Like `aggregates`, it counts one answer per profile and item (the latest).
  care_outcomes: defineTable({
    itemId: v.id("items"),
    anatomyKey: v.string(),
    formulation_changed: v.number(),
    dose_monitored: v.number(),
    no_change: v.number(),
    pending: v.number(),
    syntheticCount: v.number(),
  }).index("by_itemId_and_anatomyKey", ["itemId", "anatomyKey"]),

  fda_label_cache: defineTable({
    queryKey: v.string(),
    found: v.boolean(),
    setId: v.optional(v.string()),
    brandName: v.optional(v.string()),
    genericName: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    effectiveTime: v.optional(v.string()),
    dosageForms: v.array(v.string()),
    routes: v.array(v.string()),
    sections: v.record(v.string(), v.string()),
    absentSections: v.array(v.string()),
    fetchedAt: v.number(),
  }).index("by_queryKey", ["queryKey"]),
});
