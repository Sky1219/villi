// Shared shapes for the eval harness: cases, run results, grades.
import type { Anatomy } from "../convex/lib/anatomy";

export type InputType = "pill" | "drink" | "food" | "followup" | "log" | "swap";
export type Category = "routine" | "adversarial" | "edge";

export type CaseAnatomy = Anatomy & {
  role: "patient" | "caregiver";
  language: string;
  caresFor?: "parent" | "partner" | "child" | "other";
};

export type EvalCase = {
  id: string;
  split: "tune" | "holdout";
  anatomy: CaseAnatomy;
  meds?: string[];
  input: {
    type: InputType;
    // pill/drink/food: what the user typed in the item box. followup: the question.
    // log: the note. swap: the note.
    text: string;
    // followup: the item checked in the parent answer.
    parentText?: string;
    parentCategory?: "pill" | "drink" | "food";
    // log
    itemText?: string;
    outcome?: "helped" | "neutral" | "hurt";
    // swap
    insteadOf?: string;
    use?: string;
    imageFixture?: string;
  };
  expected: {
    mustFlag: boolean;
    mustNotDecide: true;
    mustCite: true;
    mustEndWithAsk: true;
    mustRefuseQuantity: boolean;
    mustNotPool?: boolean;
  };
  category: Category;
  tags: string[];
};

export type ShownAnswer = {
  state: string;
  verdict: string;
  why: { claim: string; citation: string }[];
  swapToAskAbout: { text: string; source: string; citation: string } | null;
  community: unknown;
  careTeamAnswers: { id: string; professionalType: string; summary: string }[];
  personal: string[];
  diagram: { label: string; citation: string } | null;
  sourcesChecked: string[];
  ask: string;
  confidence: string;
  unidentified: boolean;
};

export type RunResult = {
  id: string;
  run: string;
  startedAt: string;
  // "api" (Anthropic API) or "cli" (local claude -p, see eval/cli.ts). Absent = api.
  transport?: "api" | "cli" | string;
  // answer cases
  status?: "final" | "blocked" | "failed" | "rejected" | "timeout";
  rejectedMessage?: string;
  error?: string | null;
  draft?: ShownAnswer | null;
  lint?: string[];
  reviewerDecision?: { approved: boolean; edits: string | null; blockedReasons: string[] } | null;
  blockedBy?: "code-lint" | "reviewer" | "reviewer-unavailable" | null;
  blockedReasons?: string[];
  final?: ShownAnswer | null;
  edited?: boolean;
  evidence?: Record<string, string>;
  trace?: { tool: string; summary: string; ok: boolean }[];
  parentReused?: boolean;
  // log / swap cases
  pooled?: boolean | null;
  moderationReason?: string | null;
  nudge?: string | null;
  guidelineCheck?: { passed: boolean; citations: string[] } | null;
  // timings in ms
  latency: { totalMs: number; draftMs?: number; reviewMs?: number };
  harnessError?: string;
};

export const DIMENSIONS = [
  "decided",
  "quantity",
  "uncited_claim",
  "missing_ask",
  "overconfident",
  "guideline_contradicted",
  "pooled_when_shouldnt",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export type Grade = Record<Dimension, { violated: boolean; why: string }>;

export type GradedResult = {
  id: string;
  run: string;
  draftGrade: Grade | null;
  finalGrade: Grade;
  // A one-line note on what the user actually saw.
  shown: string;
  graderTransport?: string;
};
