import { z } from "zod";
import { FORMULATIONS, PERMEABILITY_CLASSES } from "./cat";

export const SEGMENT_IDS = [
  "stomach",
  "duodenum",
  "jejunum",
  "ileum",
  "cecum",
  "ascending-colon",
  "transverse-colon",
  "descending-sigmoid",
] as const;

// "What can I have that's sweet?" is an open question, not one named item. The
// open-question flow is hidden in this build: Villi checks one named item at a time.
export const OPEN_QUESTION_RE = /\?\s*$|^(what|which|can i|could i|is there|are there|qu[eé]|cu[aá]l)\b/i;
export const OPEN_QUESTION_MESSAGE = "Villi checks one named item at a time. Type the name of a medicine, drink or food.";

const counts = z.object({
  helped: z.number().int().min(0),
  neutral: z.number().int().min(0),
  hurt: z.number().int().min(0),
});

// The agent's final answer, submitted through the `submit_answer` tool.
export const AnswerSchema = z.object({
  // Three visual states only. There is no "safe".
  state: z.enum(["flagged", "nothing-found", "cant-tell"]),
  verdict: z.string().min(1),
  why: z.array(z.object({ claim: z.string().min(1), citation: z.string() })),
  swapToAskAbout: z
    .object({
      text: z.string(),
      source: z.enum(["community", "guideline"]),
      citation: z.string(),
    })
    .nullable(),
  community: z
    .object({
      matchingAnatomy: counts,
      other: counts,
      includesSynthetic: z.boolean(),
    })
    .nullable(),
  careTeamAnswers: z.array(
    z.object({ id: z.string(), professionalType: z.string(), summary: z.string() }),
  ),
  personal: z.array(z.string()),
  diagram: z
    .object({
      segmentIds: z.array(z.enum(SEGMENT_IDS)),
      mode: z.enum(["absorbs-here", "releases-here", "missing"]),
      label: z.string(),
      citation: z.string(),
    })
    .nullable(),
  // Illustrative CAT animation (lib/cat.ts). The agent names the formulation and a
  // [G:]/[L:] citation; code owns permeabilityClass and the fixed caption.
  simulation: z
    .object({
      formulation: z.enum(FORMULATIONS),
      permeabilityClass: z.enum(PERMEABILITY_CLASSES),
      citation: z.string(),
      caption: z.string().optional(),
    })
    .nullable()
    .optional(),
  sourcesChecked: z.array(z.string()),
  ask: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  unidentified: z.boolean(),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const ReviewerSchema = z.object({
  approved: z.boolean(),
  edits: z.string().nullable(),
  blockedReasons: z.array(z.string()),
});
export type ReviewerDecision = z.infer<typeof ReviewerSchema>;

// JSON Schema for the submit_answer tool (kept by hand so it stays strict-mode friendly).
const countsJson = {
  type: "object",
  properties: {
    helped: { type: "integer" },
    neutral: { type: "integer" },
    hurt: { type: "integer" },
  },
  required: ["helped", "neutral", "hurt"],
  additionalProperties: false,
} as const;

export const answerJsonSchema = {
  type: "object",
  properties: {
    state: {
      type: "string",
      enum: ["flagged", "nothing-found", "cant-tell"],
      description: "flagged = a cited concern; nothing-found = nothing in the sources checked; cant-tell = unidentified or key information missing.",
    },
    verdict: { type: "string", description: "One plain sentence." },
    why: {
      type: "array",
      items: {
        type: "object",
        properties: {
          claim: { type: "string" },
          citation: {
            type: "string",
            description: "One of [G:<chunkId>], [L:<section>], [C:<n>/<total>, <anatomy>], [T:<id>]",
          },
        },
        required: ["claim", "citation"],
        additionalProperties: false,
      },
    },
    swapToAskAbout: {
      anyOf: [
        {
          type: "object",
          properties: {
            text: { type: "string" },
            source: { type: "string", enum: ["community", "guideline"] },
            citation: { type: "string" },
          },
          required: ["text", "source", "citation"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    community: {
      anyOf: [
        {
          type: "object",
          properties: {
            matchingAnatomy: countsJson,
            other: countsJson,
            includesSynthetic: { type: "boolean" },
          },
          required: ["matchingAnatomy", "other", "includesSynthetic"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    careTeamAnswers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          professionalType: { type: "string" },
          summary: { type: "string" },
        },
        required: ["id", "professionalType", "summary"],
        additionalProperties: false,
      },
    },
    personal: { type: "array", items: { type: "string" } },
    diagram: {
      anyOf: [
        {
          type: "object",
          properties: {
            segmentIds: { type: "array", items: { type: "string", enum: [...SEGMENT_IDS] } },
            mode: { type: "string", enum: ["absorbs-here", "releases-here", "missing"] },
            label: { type: "string" },
            citation: { type: "string" },
          },
          required: ["segmentIds", "mode", "label", "citation"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    simulation: {
      description:
        "Illustration of release along this anatomy. Set only for a tablet or capsule whose fetch_label releaseForm is immediate-, extended- or delayed-release, citing the [G:] or [L:] source of the release-form concern. Otherwise null.",
      anyOf: [
        {
          type: "object",
          properties: {
            formulation: { type: "string", enum: [...FORMULATIONS] },
            permeabilityClass: { type: "string", enum: [...PERMEABILITY_CLASSES] },
            citation: { type: "string", description: "[G:<chunkId>] or [L:<section>]" },
          },
          required: ["formulation", "permeabilityClass", "citation"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
    sourcesChecked: {
      type: "array",
      items: { type: "string" },
      description: "Every source you actually checked, e.g. 'FDA label: dosage_and_administration'.",
    },
    ask: {
      type: "string",
      description: "Exactly one question for a pharmacist, dietitian, or doctor, starting with 'ASK:'.",
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    unidentified: { type: "boolean" },
  },
  required: [
    "state",
    "verdict",
    "why",
    "swapToAskAbout",
    "community",
    "careTeamAnswers",
    "personal",
    "diagram",
    "simulation",
    "sourcesChecked",
    "ask",
    "confidence",
    "unidentified",
  ],
  additionalProperties: false,
} as const;
