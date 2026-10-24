/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";
import { tallyImpact } from "./lib/impact";
import { personFor, preparedBy } from "./lib/careFor";
import { OPEN_QUESTION_RE } from "./lib/answerSchema";

const modules = import.meta.glob("./**/*.ts");

const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const ANON = "test-device-0000000000000001";

describe("impact tally", () => {
  it("splits each metric by anatomy and by real vs demo", () => {
    const m = tallyImpact([
      { metric: "questionsAsked", anatomyKey: "end-jejunostomy", synthetic: false },
      { metric: "questionsAsked", anatomyKey: "end-jejunostomy", synthetic: true },
      { metric: "questionsAsked", anatomyKey: "ileostomy", synthetic: true },
      { metric: "formulationChanged", anatomyKey: "ileostomy", synthetic: false },
    ]);
    const asked = m.find((x) => x.key === "questionsAsked")!;
    expect([asked.real, asked.demo]).toEqual([1, 2]);
    expect(asked.byAnatomy.find((a) => a.anatomyKey === "end-jejunostomy")).toMatchObject({ real: 1, demo: 1 });
    expect(m.find((x) => x.key === "formulationChanged")).toMatchObject({ real: 1, demo: 0 });
  });
});

describe("ASK loop", () => {
  it("moves a question open -> asked -> back, and counts asked questions in the impact view", async () => {
    const t = convexTest(schema, modules);
    const questionId = await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
        anonId: ANON,
        role: "caregiver",
        caresFor: "parent",
        anatomy: JEJ,
        anatomyKey: anatomyKeyOf(JEJ),
        language: "en",
        clinicianDemoVerified: false,
        synthetic: false,
        createdAt: 0,
      });
      return await ctx.db.insert("questions", {
        profileId,
        text: "Is the extended-release tablet being absorbed?",
        context: {},
        resolved: false,
        status: "open",
        synthetic: false,
        createdAt: 0,
      });
    });

    await t.mutation(api.questions.setAsked, { anonId: ANON, questionId, asked: true });
    let sheet = await t.query(api.sheet.get, { anonId: ANON });
    expect(sheet.open[0].status).toBe("asked");
    expect(sheet.caresFor).toBe("parent");
    const impact = await t.query(api.impact.summary, { anonId: ANON });
    expect(impact.metrics.find((m) => m.key === "questionsAsked")).toMatchObject({ real: 1, demo: 0 });

    await t.mutation(api.questions.setAsked, { anonId: ANON, questionId, asked: false });
    sheet = await t.query(api.sheet.get, { anonId: ANON });
    expect(sheet.open[0].status).toBe("open");
  });

  it("refuses an open question as a new check", async () => {
    const t = convexTest(schema, modules);
    await t.mutation(api.profiles.upsert, { anonId: ANON, role: "patient", language: "en", anatomy: JEJ });
    await expect(t.mutation(api.answers.start, { anonId: ANON, text: "What can I have that's sweet?" })).rejects.toThrow(
      /one named item/,
    );
  });
});

describe("caregiver wording", () => {
  it("names the patient by relationship, never by name", () => {
    expect(personFor("caregiver", "parent")).toBe("your parent");
    expect(personFor("patient", null)).toBe("you");
    expect(preparedBy("caregiver", "parent")).toBe("a family caregiver (their son or daughter)");
    expect(preparedBy("patient", null)).toBe("the patient");
  });

  it("treats questions as open questions but names as items", () => {
    expect(OPEN_QUESTION_RE.test("What can I have that's sweet?")).toBe(true);
    expect(OPEN_QUESTION_RE.test("Metoprolol succinate ER 50 mg")).toBe(false);
  });
});
