// Illustrative compartmental absorption and transit (CAT) model, after Yu & Amidon
// (seven-compartment small-intestinal transit, mean 199 min: Yu, Crison & Amidon,
// Int J Pharm 1996; the absorption extension: Yu & Amidon, Int J Pharm 1999).
// It explains why a formulation is a concern for an anatomy; it never predicts.
// Nothing here is ever shown to the user as a number. Pure functions, shared by
// the safety lint (caption rule) and the client (animation).
import { COLON, SEGMENTS, type DiagramState, type SegmentId } from "./anatomy";

export const FORMULATIONS = ["immediate-release", "extended-release", "delayed-release"] as const;
export type Formulation = (typeof FORMULATIONS)[number];
export const PERMEABILITY_CLASSES = ["high", "medium", "low", "unknown"] as const;
export type PermeabilityClass = (typeof PERMEABILITY_CLASSES)[number];

// Nominal parameters (hours). Coarse on purpose.
export const SI_TRANSIT_H = 3.32;
export const SI_COMPARTMENTS = 7;
const GASTRIC_EMPTYING_H = 0.25;
const COLON_TRANSIT_H = 18;
const ER_RELEASE_H = 10; // zero-order over 8-12 h
const FAST_RELEASE_PER_H = 4; // immediate, and delayed once past the stomach
const KA_SI: Record<PermeabilityClass, number> = { high: 2, medium: 0.5, low: 0.1, unknown: 0.5 };
const COLON_KA_FACTOR = 0.2;
export const HORIZON_H = 24;

// Which drawn segment each small-intestine compartment sits in, and where along it
// (duodenum 1, jejunum 2, ileum 4, as in ACAT-style divisions of the seven).
const SI_SPANS: { segment: SegmentId; from: number; to: number }[] = [
  { segment: "duodenum", from: 0, to: 1 },
  { segment: "jejunum", from: 0, to: 0.5 },
  { segment: "jejunum", from: 0.5, to: 1 },
  { segment: "ileum", from: 0, to: 0.25 },
  { segment: "ileum", from: 0.25, to: 0.5 },
  { segment: "ileum", from: 0.5, to: 0.75 },
  { segment: "ileum", from: 0.75, to: 1 },
];

export type Span = { segment: SegmentId; from: number; to: number };
export type Compartment = {
  kind: "stomach" | "si" | "colon";
  spans: Span[]; // drawn path pieces, in flow order
  transitH: number; // mean residence
  absorptive: boolean;
};

// Anatomy onto the model: removed segments delete their compartments, a stoma
// truncates the chain after its segment, and losing colon shortens residence.
export function buildChain(d: DiagramState): Compartment[] {
  const stomaAt = d.stomaAfter ? SEGMENTS.indexOf(d.stomaAfter) : SEGMENTS.length - 1;
  const inStream = (s: SegmentId) => !d.removed.includes(s) && SEGMENTS.indexOf(s) <= stomaAt;
  const chain: Compartment[] = [];
  if (inStream("stomach")) {
    chain.push({ kind: "stomach", spans: [{ segment: "stomach", from: 0, to: 1 }], transitH: GASTRIC_EMPTYING_H, absorptive: false });
  }
  for (const span of SI_SPANS) {
    if (inStream(span.segment)) {
      chain.push({ kind: "si", spans: [span], transitH: SI_TRANSIT_H / SI_COMPARTMENTS, absorptive: true });
    }
  }
  // One compartment per colon segment still in the stream.
  for (const segment of COLON.filter(inStream)) {
    chain.push({ kind: "colon", spans: [{ segment, from: 0, to: 1 }], transitH: COLON_TRANSIT_H / COLON.length, absorptive: true });
  }
  return chain;
}

const uptakePerH = (c: Compartment, p: PermeabilityClass) =>
  !c.absorptive ? 0 : c.kind === "colon" ? KA_SI[p] * COLON_KA_FACTOR : KA_SI[p];

export type ModelOptions = { dtH?: number; horizonH?: number; fastReleasePerH?: number; colonUptake?: boolean };

export type Curves = {
  t: number[];
  released: number[]; // cumulative drug released inside the body, fraction of the dose
  exposed: number[]; // cumulative drug taken up in an absorptive compartment this anatomy has
  exitedUnreleased: number; // still in the tablet when it left the body (at the end)
  exitedReleased: number; // released but passed out before uptake (at the end)
};

// The two normalized curves. Forward Euler on the CAT equations: the tablet's
// unreleased drug S and released drug D move by first-order transit; D is taken
// up at a rate set by permeability where the compartment can absorb.
export function simulate(
  d: DiagramState,
  formulation: Formulation,
  permeability: PermeabilityClass,
  opts: ModelOptions = {},
): Curves {
  const chain = buildChain(d);
  const dt = opts.dtH ?? 0.005;
  const horizon = opts.horizonH ?? HORIZON_H;
  const kr = opts.fastReleasePerH ?? FAST_RELEASE_PER_H;
  const n = chain.length;
  const S = new Array<number>(n).fill(0);
  const D = new Array<number>(n).fill(0);
  if (n) S[0] = 1;
  const ka = chain.map((c) => (c.kind === "colon" && opts.colonUptake === false ? 0 : uptakePerH(c, permeability)));
  const kt = chain.map((c) => 1 / c.transitH);
  let released = 0;
  let exposed = 0;
  let exitedUnreleased = n ? 0 : 1;
  let exitedReleased = 0;
  const out: Curves = { t: [], released: [], exposed: [], exitedUnreleased: 0, exitedReleased: 0 };
  const every = Math.max(1, Math.round(0.1 / dt));
  const steps = Math.round(horizon / dt);
  for (let step = 0; step <= steps; step++) {
    const t = step * dt;
    if (step % every === 0) {
      out.t.push(t);
      out.released.push(released);
      out.exposed.push(exposed);
    }
    // Zero-order: the tablet's load runs down linearly while it is in the body,
    // so each step releases the same share of whatever is still in it.
    const load = Math.max(0, 1 - t / ER_RELEASE_H);
    const erShare = load > 0 ? Math.min(1, dt / ER_RELEASE_H / load) : 1;
    const dS = new Array<number>(n).fill(0);
    const dD = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      let rel: number;
      if (formulation === "extended-release") rel = S[i] * erShare;
      else if (formulation === "delayed-release" && chain[i].kind === "stomach") rel = 0;
      else rel = S[i] * kr * dt;
      // Transit acts on what is left after release and uptake, so nothing goes negative.
      const up = D[i] * ka[i] * dt;
      const sOut = (S[i] - rel) * kt[i] * dt;
      const dOut = (D[i] - up) * kt[i] * dt;
      dS[i] += -rel - sOut;
      dD[i] += rel - up - dOut;
      released += rel;
      exposed += up;
      if (i + 1 < n) {
        dS[i + 1] += sOut;
        dD[i + 1] += dOut;
      } else {
        exitedUnreleased += sOut;
        exitedReleased += dOut;
      }
    }
    for (let i = 0; i < n; i++) {
      S[i] += dS[i];
      D[i] += dD[i];
    }
  }
  out.exitedUnreleased = exitedUnreleased;
  out.exitedReleased = exitedReleased;
  return out;
}

// ---- Caption: fixed text chosen by rule. No digits, ever; the lint checks it too.

export function anatomyConcern(d: DiagramState): { smallBowelShortened: boolean; noColon: boolean } {
  const chain = buildChain(d);
  return {
    smallBowelShortened: chain.filter((c) => c.kind === "si").length < SI_COMPARTMENTS,
    noColon: !chain.some((c) => c.kind === "colon"),
  };
}

export const CAPTIONS = {
  "extended-release:no-colon":
    "Illustration: an extended-release tablet keeps releasing after it has passed the parts of the intestine that are left.",
  "extended-release:colon":
    "Illustration: an extended-release tablet does much of its releasing after it has passed the small intestine that is left.",
  "delayed-release":
    "Illustration: a delayed-release tablet does not start releasing until after the stomach, which leaves less of the remaining intestine for it to work in.",
  "immediate-release":
    "Illustration: an immediate-release tablet releases early, in the stomach and upper intestine, before it reaches the parts that were removed.",
} as const;

export const MODEL_LABEL = "Illustrative model (CAT framework, Yu & Amidon 1996), not a prediction of your absorption.";

export const MODEL_IGNORES = [
  "how the remaining bowel adapts and absorbs more over time",
  "medicines that slow the gut down, such as loperamide",
  "food, and what you eat or drink with the tablet",
  "disease activity, inflammation and infections",
  "how much one person's body differs from another's",
  "the exact length of bowel left; it only knows which parts you marked",
] as const;

// Null when the anatomy leaves nothing to explain (no small bowel lost and colon in the stream).
export function captionFor(formulation: Formulation, d: DiagramState): string | null {
  const { smallBowelShortened, noColon } = anatomyConcern(d);
  if (!smallBowelShortened && !noColon) return null;
  if (formulation === "extended-release") return CAPTIONS[noColon ? "extended-release:no-colon" : "extended-release:colon"];
  return CAPTIONS[formulation];
}

// ---- Particle story for the animation: the same chain and rates, told as one
// typical tablet moving at mean pace and a handful of drug particles leaving it.

export type Leg = { comp: number; tEnter: number; tExit: number; uStart: number };
export type Particle = {
  releaseT: number | null; // null: still in the tablet when it left the body
  legs: Leg[];
  fate: "absorbed" | "exited" | "unreleased" | "in-body";
  fateT: number;
  fateComp: number;
  fateU: number;
  jitter: number; // -1..1, spreads marks across the bowel's width
};
export type Story = {
  chain: Compartment[];
  tablet: Leg[];
  tabletExitT: number;
  particles: Particle[];
  endT: number;
};

// Small seeded PRNG so the same answer always animates the same way.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function particleStory(
  d: DiagramState,
  formulation: Formulation,
  permeability: PermeabilityClass,
  count = 48,
  seed = 7,
): Story {
  const chain = buildChain(d);
  const rand = mulberry32(seed);
  const exp = (mean: number) => -Math.log(1 - rand()) * mean;

  const tablet: Leg[] = [];
  let t = 0;
  chain.forEach((c, comp) => {
    tablet.push({ comp, tEnter: t, tExit: t + c.transitH, uStart: 0 });
    t += c.transitH;
  });
  const tabletExitT = t;
  const tabletAt = (time: number) => {
    const leg = tablet.find((l) => time < l.tExit) ?? tablet[tablet.length - 1];
    return { comp: leg.comp, u: (time - leg.tEnter) / (leg.tExit - leg.tEnter) };
  };
  const leftStomachT = chain[0]?.kind === "stomach" ? tablet[0].tExit : 0;

  const particles: Particle[] = [];
  for (let k = 0; k < count; k++) {
    const jitter = rand() * 2 - 1;
    // Zero-order release spreads release times evenly over the release window.
    const releaseT =
      formulation === "extended-release"
        ? ((k + rand()) / count) * ER_RELEASE_H
        : formulation === "delayed-release"
          ? leftStomachT + exp(1 / FAST_RELEASE_PER_H)
          : exp(1 / FAST_RELEASE_PER_H);
    if (!chain.length || releaseT >= tabletExitT || releaseT >= HORIZON_H) {
      const last = Math.max(0, chain.length - 1);
      particles.push({ releaseT: null, legs: [], fate: "unreleased", fateT: tabletExitT, fateComp: last, fateU: 1, jitter });
      continue;
    }
    const at = tabletAt(releaseT);
    const legs: Leg[] = [];
    let now = releaseT;
    let fate: Particle["fate"] = "exited";
    let fateComp = chain.length - 1;
    let fateU = 1;
    for (let comp = at.comp; comp < chain.length; comp++) {
      const uStart = comp === at.comp ? at.u : 0;
      const stay = exp(chain[comp].transitH) * (1 - uStart);
      const ka = uptakePerH(chain[comp], permeability);
      const uptake = ka > 0 ? exp(1 / ka) : Infinity;
      if (uptake < stay) {
        legs.push({ comp, tEnter: now, tExit: now + stay, uStart });
        fate = "absorbed";
        fateComp = comp;
        fateU = uStart + (1 - uStart) * (uptake / stay);
        now += uptake;
        break;
      }
      legs.push({ comp, tEnter: now, tExit: now + stay, uStart });
      now += stay;
    }
    if (now > HORIZON_H) {
      fate = "in-body";
      now = HORIZON_H;
    }
    particles.push({ releaseT, legs, fate, fateT: now, fateComp, fateU, jitter });
  }
  // The story ends once the tablet is empty or gone and every released particle has a fate.
  const tabletDone = particles.some((p) => p.releaseT === null)
    ? tabletExitT
    : Math.max(0, ...particles.map((p) => p.releaseT ?? 0));
  const endT = Math.min(HORIZON_H, Math.max(tabletDone, ...particles.map((p) => p.fateT)));
  return { chain, tablet, tabletExitT, particles, endT };
}
