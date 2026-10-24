/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { reviewDraft, NOTHING_FOUND_PREFIX, type CitationRegistry } from "./lib/safety";
import { AMOUNT_QUESTION_RE, OPEN_QUESTION_RE, type Answer, type ReviewerDecision } from "./lib/answerSchema";
import type { Anatomy } from "./lib/anatomy";

const modules = import.meta.glob("./**/*.ts");

const registry: CitationRegistry = {
  guidelineIds: ["aga-sbs#antimotility"],
  labelSections: ["dosage_form", "description"],
  communityTotals: [],
  careTeamIds: [],
  allowedStrengths: ["2 mg"],
};

const nothingFound: Answer = {
  state: "nothing-found",
  verdict: "Loperamide 2 mg is a plain immediate-release capsule.",
  why: [{ claim: "The label lists it as a capsule.", citation: "[L:dosage_form]" }],
  swapToAskAbout: null,
  community: null,
  careTeamAnswers: [],
  personal: [],
  diagram: null,
  sourcesChecked: ["FDA label: dosage_form", "AGA 2022"],
  ask: "ASK: Is the timing of loperamide relative to meals right for this anatomy?",
  confidence: "medium",
  unidentified: false,
};

const approve = async (): Promise<ReviewerDecision> => ({ approved: true, edits: null, blockedReasons: [] });

describe("no-concern wording is repaired, not blocked", () => {
  it("prefixes a nothing-found verdict that lacks the required words", async () => {
    const out = await reviewDraft(nothingFound, registry, approve);
    expect(out.status).toBe("final");
    if (out.status === "final") expect(out.final.verdict).toBe(`${NOTHING_FOUND_PREFIX}${nothingFound.verdict}`);
  });

  it("repairs a reviewer edit that dropped the words", async () => {
    const edit = async (): Promise<ReviewerDecision> => ({
      approved: true,
      edits: JSON.stringify({ ...nothingFound, verdict: "Loperamide 2 mg is an immediate-release capsule; the sources raise no flag." }),
      blockedReasons: [],
    });
    const out = await reviewDraft({ ...nothingFound, verdict: "Nothing in the sources I checked raised a concern." }, registry, edit);
    expect(out.status).toBe("final");
    if (out.status === "final") {
      expect(out.edited).toBe(true);
      expect(out.final.verdict.startsWith(NOTHING_FOUND_PREFIX)).toBe(true);
    }
  });

  it("leaves a verdict that already says it, and a flagged verdict, untouched", async () => {
    const said = { ...nothingFound, verdict: "Nothing in the sources I checked flags this capsule." };
    const a = await reviewDraft(said, registry, approve);
    expect(a.status === "final" && a.final.verdict).toBe(said.verdict);
    const flagged = { ...nothingFound, state: "flagged" as const, verdict: "This is a capsule worth asking about." };
    const b = await reviewDraft(flagged, registry, approve);
    expect(b.status === "final" && b.final.verdict).toBe(flagged.verdict);
  });

  it("does not rewrite other languages (the reviewer checks those)", async () => {
    const es = { ...nothingFound, verdict: "Loperamida es una cápsula de liberación inmediata." };
    const out = await reviewDraft(es, { ...registry, language: "es" }, approve);
    expect(out.status === "final" && out.final.verdict).toBe(es.verdict);
  });
});

describe("new checks that ask for an amount are refused", () => {
  it("matches amount questions anywhere, not product names", () => {
    for (const t of ["loperamide, what dose should I take", "how much ORS a day", "metoprolol how often", "how many tablets of tylenol"]) {
      expect({ t, open: OPEN_QUESTION_RE.test(t), amount: AMOUNT_QUESTION_RE.test(t) }).toEqual({ t, open: true, amount: true });
    }
    for (const t of ["Medrol Dosepak", "Metoprolol succinate ER 50 mg", "Gatorade", "Pantoprazole 40 mg"]) {
      expect({ t, open: OPEN_QUESTION_RE.test(t) }).toEqual({ t, open: false });
    }
  });

  it("answers.start refuses the dose question with the no-doses message", async () => {
    const t = convexTest(schema, modules);
    const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
    const anonId = "overnight-test-0000000000000001";
    await t.mutation(api.profiles.upsert, { anonId, role: "patient", language: "en", anatomy: JEJ });
    await expect(t.mutation(api.answers.start, { anonId, text: "loperamide, what dose should I take" })).rejects.toThrow(/doesn't give doses/);
  });
});
