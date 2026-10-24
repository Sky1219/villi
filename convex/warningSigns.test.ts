/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import retrierTest from "@convex-dev/action-retrier/test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { cardFor, cardText, scanWarningSigns } from "./lib/warningSigns";
import { prefilter } from "./lib/moderation";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";

const modules = import.meta.glob("./**/*.ts");
const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };

describe("warning signs in a log note", () => {
  it("finds dehydration signs", () => {
    const cases: [string, string[]][] = [
      ["I've been dizzy and peeing less", ["dark or less urine", "dizziness or lightheadedness"]],
      ["really thirsty all afternoon", ["thirst"]],
      ["dark urine this morning", ["dark or less urine"]],
      ["lightheaded when I stand up", ["dizziness or lightheadedness"]],
      ["output way up since lunch", ["much higher output"]],
      ["dry mouth", ["dry mouth"]],
    ];
    for (const [note, signs] of cases) expect({ note, ...scanWarningSigns(note) }).toEqual({ note, level: "dehydration", signs });
  });

  it("treats negations as matches (false positives are accepted)", () => {
    expect(scanWarningSigns("not dizzy today").level).toBe("dehydration");
    expect(scanWarningSigns("no chest pain").level).toBe("emergency");
  });

  it("emergency outranks dehydration", () => {
    expect(scanWarningSigns("dizzy, thirsty and then I fainted")).toEqual({ level: "emergency", signs: ["fainting"] });
    expect(scanWarningSigns("he seemed confused").signs).toEqual(["confusion"]);
    expect(scanWarningSigns("some blood in the bag").signs).toEqual(["blood"]);
  });

  it("ignores ordinary notes and everyday uses of the words", () => {
    for (const note of ["output went up a bit", "thickened things up", "blood pressure was fine", "felt less tired", ""]) {
      expect({ note, level: scanWarningSigns(note).level }).toEqual({ note, level: null });
    }
  });

  it("picks the card: signs first, then a worse drink, else none", () => {
    expect(cardFor(scanWarningSigns("dizzy"), "helped", "pill")).toBe("dehydration");
    expect(cardFor(scanWarningSigns(""), "hurt", "drink")).toBe("drink-worse");
    expect(cardFor(scanWarningSigns(""), "hurt", "pill")).toBeNull();
    expect(cardFor(scanWarningSigns(""), "neutral", "drink")).toBeNull();
  });

  it("card wording has no advice, fluids guidance or amounts, and names the patient for caregivers", () => {
    expect(cardText("dehydration", "your parent")).toBe("These can be warning signs of dehydration. Contact your parent's care team today.");
    expect(cardText("emergency", "you")).toBe("If you are fainting, confused, or have chest pain or bleeding, call emergency services now.");
    expect(cardText("emergency", "your parent")).toBe("If your parent is fainting, confused, or has chest pain or bleeding, call emergency services now.");
    for (const c of ["dehydration", "emergency", "drink-worse"] as const) {
      expect(cardText(c, "you")).not.toMatch(/\d|drink more|ORS|water|fluid/i);
    }
    expect(cardText("drink-worse", "you")).not.toMatch(/today|now|emergency/i);
  });

  it("keeps emergency notes out of anything shared", () => {
    for (const note of ["I fainted after", "felt confused", "bleeding from the stoma", "chest pain"]) expect(prefilter(note)?.pooled).toBe(false);
  });
});

describe("warning signs through the log", () => {
  it("are stored on save, shown until acknowledged, and reach the sheet as date + signs only", async () => {
    const t = convexTest(schema, modules);
    retrierTest.register(t);
    const anonId = "overnight-warning-000000000001";
    await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("profiles", {
        anonId,
        role: "caregiver",
        caresFor: "parent",
        anatomy: JEJ,
        anatomyKey: anatomyKeyOf(JEJ),
        language: "en",
        clinicianDemoVerified: false,
        synthetic: false,
        createdAt: 0,
      });
      return profileId;
    });
    const logId = await t.mutation(api.logs.create, { anonId, outcome: "hurt", itemText: "sports drink", note: "dizzy and peeing less" });
    let mine = await t.query(api.logs.listMine, { anonId });
    expect(mine[0].card).toBe("dehydration");
    const sheet = await t.query(api.sheet.get, { anonId });
    expect(sheet.warnings).toEqual([{ at: expect.any(Number), level: "dehydration", signs: ["dark or less urine", "dizziness or lightheadedness"] }]);
    expect(JSON.stringify(sheet.warnings)).not.toContain("peeing less");

    await t.mutation(api.logs.ackWarning, { anonId, logId });
    mine = await t.query(api.logs.listMine, { anonId });
    expect(mine[0].card).toBeNull();
  });
});
