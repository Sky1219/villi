/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { anatomyKeyOf, type Anatomy } from "./lib/anatomy";

const modules = import.meta.glob("./**/*.ts");
const JEJ: Anatomy = { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" };
const OWNER_A = "overnight-device-owner-a-000000001";
const OWNER_B = "overnight-device-owner-b-000000001";
const PHONE = "overnight-device-second-phone-0001";

afterEach(() => vi.useRealTimers());

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(api.profiles.upsert, { anonId: OWNER_A, role: "caregiver", caresFor: "parent", language: "en", anatomy: JEJ });
  await t.mutation(api.profiles.upsert, { anonId: OWNER_B, role: "patient", language: "en", anatomy: { ...JEJ, stomaType: "ileostomy" } });
  await t.mutation(api.meds.add, { anonId: OWNER_A, name: "Metoprolol succinate ER 50 mg" });
  return t;
}

describe("a second phone on the same profile", () => {
  it("joins with a code, sees the same profile, and loses access when removed", async () => {
    const t = await setup();
    const { code } = await t.mutation(api.profiles.createDeviceCode, { anonId: OWNER_A });
    expect(code).toMatch(/^\d{6}$/);
    expect(await t.mutation(api.profiles.redeemDeviceCode, { anonId: PHONE, code })).toEqual({ ok: true });
    const me = await t.query(api.profiles.me, { anonId: PHONE });
    expect(me?.anatomyKey).toBe(anatomyKeyOf(JEJ));
    expect(me?.meds.map((m) => m.name)).toEqual(["Metoprolol succinate ER 50 mg"]);

    // Single use.
    expect((await t.mutation(api.profiles.redeemDeviceCode, { anonId: "overnight-device-third-phone-00001", code })).ok).toBe(false);

    const list = await t.query(api.profiles.listDevices, { anonId: OWNER_A });
    expect(list.devices).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(PHONE);
    await t.mutation(api.profiles.revokeDevice, { anonId: OWNER_A, linkId: list.devices[0]._id });
    expect(await t.query(api.profiles.me, { anonId: PHONE })).toBeNull();
    await expect(t.query(api.sheet.get, { anonId: PHONE })).rejects.toThrow(/No profile/);
  });

  it("an expired code fails", async () => {
    vi.useFakeTimers();
    const t = await setup();
    const { code } = await t.mutation(api.profiles.createDeviceCode, { anonId: OWNER_A });
    vi.advanceTimersByTime(11 * 60_000);
    expect(await t.mutation(api.profiles.redeemDeviceCode, { anonId: PHONE, code })).toMatchObject({ ok: false });
  });

  it("throttles guessing per device", async () => {
    const t = await setup();
    const { code } = await t.mutation(api.profiles.createDeviceCode, { anonId: OWNER_A });
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await t.mutation(api.profiles.redeemDeviceCode, { anonId: PHONE, code: wrong })).ok).toBe(false);
    // Even the right code is refused once the device is throttled.
    expect(await t.mutation(api.profiles.redeemDeviceCode, { anonId: PHONE, code })).toMatchObject({ ok: false, reason: expect.stringMatching(/Too many tries/) });
  });

  it("one profile's phones can't reach another's data, or remove its phones", async () => {
    const t = await setup();
    const { code } = await t.mutation(api.profiles.createDeviceCode, { anonId: OWNER_B });
    await t.mutation(api.profiles.redeemDeviceCode, { anonId: PHONE, code });
    expect((await t.query(api.profiles.me, { anonId: PHONE }))?.meds).toEqual([]);
    const aCode = await t.mutation(api.profiles.createDeviceCode, { anonId: OWNER_A });
    await t.mutation(api.profiles.redeemDeviceCode, { anonId: "overnight-device-a-phone-000000001", code: aCode.code });
    const aDevices = await t.query(api.profiles.listDevices, { anonId: OWNER_A });
    await expect(t.mutation(api.profiles.revokeDevice, { anonId: PHONE, linkId: aDevices.devices[0]._id })).rejects.toThrow(/not found/);
  });

  it("Delete my data removes the links", async () => {
    const t = await setup();
    const { code } = await t.mutation(api.profiles.createDeviceCode, { anonId: OWNER_A });
    await t.mutation(api.profiles.redeemDeviceCode, { anonId: PHONE, code });
    for (let i = 0; i < 5; i++) if ((await t.mutation(api.profiles.deleteMine, { anonId: OWNER_A })).done) break;
    expect(await t.query(api.profiles.me, { anonId: PHONE })).toBeNull();
    expect(await t.run(async (ctx) => (await ctx.db.query("device_links").take(5)).length)).toBe(0);
  });
});
