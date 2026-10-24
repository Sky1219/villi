/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

const modules = import.meta.glob("./**/*.ts");
const CAUTIOUS = { stomaType: "jejunostomy", colonInContinuity: false, bowelLengthBand: "unknown" } as const;

describe("I don't know my anatomy", () => {
  it("saves the cautious anatomy unconfirmed and adds the anatomy question once", async () => {
    const t = convexTest(schema, modules);
    const anonId = "anatomy-unknown-0001-aaaa";
    const args = { anonId, role: "caregiver" as const, caresFor: "parent" as const, language: "en", anatomy: CAUTIOUS, anatomyConfirmed: false };
    await t.mutation(api.profiles.upsert, args);
    await t.mutation(api.profiles.upsert, args);
    const me = await t.query(api.profiles.me, { anonId });
    expect(me?.anatomyConfirmed).toBe(false);
    expect(me?.anatomyKey).toBe("end-jejunostomy");
    const qs = await t.query(api.questions.listMine, { anonId });
    const texts = JSON.stringify(qs);
    expect(texts.match(/What exactly was removed in my parent's surgery/g)?.length).toBe(1);
  });

  it("is confirmed once the anatomy is saved the normal way", async () => {
    const t = convexTest(schema, modules);
    const anonId = "anatomy-unknown-0002-aaaa";
    await t.mutation(api.profiles.upsert, { anonId, role: "patient", language: "en", anatomy: CAUTIOUS, anatomyConfirmed: false });
    await t.mutation(api.profiles.upsert, {
      anonId,
      role: "patient",
      language: "en",
      anatomy: { stomaType: "ileostomy", colonInContinuity: false, bowelLengthBand: ">200cm" },
    });
    expect((await t.query(api.profiles.me, { anonId }))?.anatomyConfirmed).toBe(true);
  });
});
