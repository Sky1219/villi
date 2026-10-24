import { describe, expect, it } from "vitest";
import { moderateText, type ModerationDecision } from "./lib/moderation";
import { MODERATION_FIXTURES as FIXTURES } from "./lib/moderationFixtures";


// A permissive model: anything the deterministic rules miss is pooled.
const permissive = async (): Promise<ModerationDecision> => ({ pooled: true, reason: null, nudgeUser: null });

describe("moderation", () => {
  it("classifies the 11 fixture entries correctly (rules are an unconditional gate)", async () => {
    for (const f of FIXTURES) {
      const d = await moderateText(f.text, permissive);
      expect({ text: f.text, pooled: d.pooled }).toEqual({ text: f.text, pooled: f.pooled });
      if (!d.pooled) expect(d.nudgeUser).toBeTruthy();
    }
  });

  // Same fixtures against the real fast model, with the rules turned off.
  it.skipIf(!process.env.ANTHROPIC_API_KEY)("the Claude moderator alone agrees on the fixtures", async () => {
    const { claudeModerate } = await import("./moderation");
    for (const f of FIXTURES) {
      const d = await claudeModerate(f.text);
      expect({ text: f.text, pooled: d.pooled }).toEqual({ text: f.text, pooled: f.pooled });
    }
  }, 120_000);
});
