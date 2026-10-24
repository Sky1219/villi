import { describe, expect, it } from "vitest";
import {
  CAPTIONS,
  MODEL_IGNORES,
  PERMEABILITY_CLASSES,
  SI_COMPARTMENTS,
  SI_TRANSIT_H,
  buildChain,
  captionFor,
  particleStory,
  simulate,
  type Formulation,
} from "./lib/cat";
import { COLON, type DiagramState } from "./lib/anatomy";

const baseline: DiagramState = { removed: [], stomaAfter: null };
const endJejunostomy: DiagramState = { removed: ["ileum", ...COLON], stomaAfter: "jejunum" };
const jejunoColic: DiagramState = { removed: ["ileum", "cecum"], stomaAfter: null };
const colostomy: DiagramState = { removed: ["descending-sigmoid"], stomaAfter: "transverse-colon" };

const last = (xs: number[]) => xs[xs.length - 1];
const KA = { high: 2, medium: 0.5, low: 0.1 };

describe("CAT model, baseline anatomy", () => {
  it("has a stomach, seven small-intestine compartments and the colon", () => {
    const chain = buildChain(baseline);
    expect(chain.map((c) => c.kind)).toEqual(["stomach", ...Array(SI_COMPARTMENTS).fill("si"), ...COLON.map(() => "colon")]);
    const siTransit = chain.filter((c) => c.kind === "si").reduce((s, c) => s + c.transitH, 0);
    expect(siTransit).toBeCloseTo(SI_TRANSIT_H, 6);
  });

  it.each(["high", "medium", "low"] as const)(
    "matches the closed-form small-intestine uptake for %s permeability",
    (p) => {
      // Instant release and no colon uptake reduce CAT to Fa = 1 - (1 + ka*T/N)^-N.
      const c = simulate(baseline, "immediate-release", p, { dtH: 0.0005, fastReleasePerH: 400, colonUptake: false });
      const analytic = 1 - Math.pow(1 + (KA[p] * SI_TRANSIT_H) / SI_COMPARTMENTS, -SI_COMPARTMENTS);
      expect(last(c.exposed)).toBeCloseTo(analytic, 2);
    },
  );

  it.each(["immediate-release", "extended-release", "delayed-release"] as const)("keeps curves monotone and bounded (%s)", (f) => {
    const c = simulate(baseline, f, "medium");
    for (let i = 1; i < c.t.length; i++) {
      expect(c.released[i]).toBeGreaterThanOrEqual(c.released[i - 1] - 1e-12);
      expect(c.exposed[i]).toBeGreaterThanOrEqual(c.exposed[i - 1] - 1e-12);
      expect(c.exposed[i]).toBeLessThanOrEqual(c.released[i] + 1e-9);
    }
    expect(last(c.released) + c.exitedUnreleased).toBeLessThanOrEqual(1 + 1e-6);
    expect(c.exitedReleased + last(c.exposed)).toBeLessThanOrEqual(last(c.released) + 1e-6);
  });

  it("releases extended-release drug over hours, not minutes", () => {
    const ir = simulate(baseline, "immediate-release", "medium");
    const er = simulate(baseline, "extended-release", "medium");
    const at = (c: typeof ir, h: number) => c.released[Math.round(h / 0.1)];
    expect(at(ir, 1)).toBeGreaterThan(0.95);
    expect(at(er, 1)).toBeLessThan(0.15);
    expect(at(er, 5)).toBeGreaterThan(0.4);
    expect(last(er.released)).toBeGreaterThan(0.85);
  });

  it("releases nothing from a delayed-release tablet while it is in the stomach", () => {
    const dr = simulate(baseline, "delayed-release", "medium");
    const ir = simulate(baseline, "immediate-release", "medium");
    // At the first sample only what has already emptied into the duodenum can release.
    expect(dr.released[1]).toBeGreaterThan(0);
    expect(dr.released[1]).toBeLessThan(ir.released[1] / 3);
  });

  it("ranks uptake by permeability", () => {
    const [h, m, l] = (["high", "medium", "low"] as const).map((p) => last(simulate(baseline, "immediate-release", p).exposed));
    expect(h).toBeGreaterThan(m);
    expect(m).toBeGreaterThan(l);
  });
});

describe("CAT model, anatomy cases", () => {
  const er = (d: DiagramState) => simulate(d, "extended-release", "medium");
  const ir = (d: DiagramState) => simulate(d, "immediate-release", "high");

  it("end-jejunostomy: chain stops at the stoma, an extended-release tablet leaves mostly unreleased", () => {
    const chain = buildChain(endJejunostomy);
    expect(chain.map((c) => c.kind)).toEqual(["stomach", "si", "si", "si"]);
    const c = er(endJejunostomy);
    expect(last(c.released)).toBeLessThan(0.3);
    expect(c.exitedUnreleased).toBeGreaterThan(0.7);
    expect(last(c.exposed)).toBeLessThan(last(er(baseline).exposed) / 2);
    // Immediate release still releases nearly everything before the stoma.
    expect(last(ir(endJejunostomy).released)).toBeGreaterThan(0.9);
    expect(last(ir(endJejunostomy).exposed)).toBeLessThan(last(ir(baseline).exposed));
  });

  it("jejuno-colic: ileum gone, the colon still in the stream does most of the extended releasing", () => {
    const chain = buildChain(jejunoColic);
    expect(chain.map((c) => c.kind)).toEqual(["stomach", "si", "si", "si", "colon", "colon", "colon"]);
    expect(chain.slice(4).map((c) => c.spans[0].segment)).toEqual(COLON.filter((s) => s !== "cecum"));
    const c = er(jejunoColic);
    expect(last(c.released)).toBeGreaterThan(0.8);
    expect(last(c.exposed)).toBeLessThan(last(er(baseline).exposed));
    expect(last(c.exposed)).toBeGreaterThan(last(er(endJejunostomy).exposed));
  });

  it("colostomy: full small bowel, shorter colon, close to baseline", () => {
    const chain = buildChain(colostomy);
    expect(chain.filter((c) => c.kind === "si")).toHaveLength(SI_COMPARTMENTS);
    expect(chain.filter((c) => c.kind === "colon").map((c) => c.spans[0].segment)).toEqual(["cecum", "ascending-colon", "transverse-colon"]);
    const c = er(colostomy);
    expect(last(c.released)).toBeLessThanOrEqual(last(er(baseline).released) + 1e-9);
    expect(Math.abs(last(ir(colostomy).exposed) - last(ir(baseline).exposed))).toBeLessThan(0.02);
  });

  it.each([
    ["baseline", baseline],
    ["end-jejunostomy", endJejunostomy],
    ["jejuno-colic", jejunoColic],
  ] as const)("tells the same story with particles as with curves (%s)", (_, d) => {
    const curves = er(d);
    const story = particleStory(d, "extended-release", "medium", 2000, 3);
    const released = story.particles.filter((p) => p.releaseT !== null).length / story.particles.length;
    expect(Math.abs(released - last(curves.released))).toBeLessThan(0.12);
  });
});

describe("captions", () => {
  const all: Formulation[] = ["immediate-release", "extended-release", "delayed-release"];

  it("never contain digits", () => {
    for (const c of Object.values(CAPTIONS)) expect(c).not.toMatch(/\d/);
    for (const c of MODEL_IGNORES) expect(c).not.toMatch(/\d|%/);
  });

  it("are chosen by rule from formulation and anatomy", () => {
    expect(captionFor("extended-release", endJejunostomy)).toBe(CAPTIONS["extended-release:no-colon"]);
    expect(captionFor("extended-release", jejunoColic)).toBe(CAPTIONS["extended-release:colon"]);
    expect(captionFor("delayed-release", endJejunostomy)).toBe(CAPTIONS["delayed-release"]);
    expect(captionFor("immediate-release", jejunoColic)).toBe(CAPTIONS["immediate-release"]);
    // Nothing to explain when no small bowel is lost and the colon is in the stream.
    for (const f of all) {
      expect(captionFor(f, baseline)).toBeNull();
      expect(captionFor(f, colostomy)).toBeNull();
    }
  });

  it("covers every permeability class without throwing", () => {
    for (const p of PERMEABILITY_CLASSES) expect(last(simulate(endJejunostomy, "extended-release", p).released)).toBeGreaterThan(0);
  });
});
