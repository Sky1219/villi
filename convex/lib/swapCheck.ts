// Deterministic guideline check for a submitted swap. A swap whose "use" item
// conflicts with a guideline in the author's anatomy scope is never pooled,
// whatever the model or the upvotes say. Pure: unit-testable without a key.
import corpus from "../../data/guidelines.json";
import { scopeTagsFor, type Anatomy } from "./anatomy";

type Attrs = Record<string, string | number | boolean | string[]>;
export type SwapItem = { canonicalName: string; category: "pill" | "drink" | "food" | "action"; attributes: Attrs };

export type SwapCheck = {
  passed: boolean;
  conflicts: { reason: string; citation: string }[];
  citations: string[]; // supporting chunks, as "G:<chunkId>"
};

const SCOPES: Record<string, string[]> = Object.fromEntries(
  corpus.chunks.map((c) => [`${c.sourceId}#${c.locator}`, c.anatomyScope]),
);

type Rule = { when: (use: SwapItem) => boolean; chunkId: string; reason: (use: SwapItem) => string };

const CONFLICTS: Rule[] = [
  {
    when: (u) => u.category === "drink" && (u.attributes.tonicity === "hypertonic" || u.attributes.simpleSugar === true),
    chunkId: "aga-sbs#fluids-hypertonic",
    reason: (u) => `${u.canonicalName} is a sugary, hypertonic drink, which guidelines say to limit`,
  },
  {
    when: (u) => u.category !== "drink" && u.attributes.simpleSugar === true,
    chunkId: "aga-sbs#diet-simple-sugars",
    reason: (u) => `${u.canonicalName} is high in simple sugars, which guidelines say to limit`,
  },
  {
    when: (u) => !!u.attributes.sugarAlcohol,
    chunkId: "pg139#sugar-alcohols",
    reason: (u) => `${u.canonicalName} contains sugar alcohols (${u.attributes.sugarAlcohol}), which can raise output`,
  },
  {
    when: (u) => u.attributes.tonicity === "hypotonic",
    chunkId: "pd-2017#hypotonic-jejunostomy",
    reason: (u) => `${u.canonicalName} is a low-sodium drink, which is usually limited with an end-jejunostomy`,
  },
  {
    when: (u) => u.attributes.caffeine === true,
    chunkId: "pd-2017#caffeine-alcohol",
    reason: (u) => `${u.canonicalName} contains caffeine, which can raise output`,
  },
  {
    when: (u) => u.attributes.releaseForm === "extended-release" || u.attributes.releaseForm === "delayed-release",
    chunkId: "aga-sbs#medications-release-forms",
    reason: (u) => `${u.canonicalName} is a ${u.attributes.releaseForm} product, which guidelines generally avoid after major resection`,
  },
  {
    when: (u) => u.attributes.oxalate === "high",
    chunkId: "aga-sbs#diet-colon-oxalate",
    reason: (u) => `${u.canonicalName} is high in oxalate, which matters with the colon in continuity`,
  },
];

const SUPPORT: Rule[] = [
  { when: (u) => u.attributes.tonicity === "ors", chunkId: "aga-sbs#fluids-ors", reason: () => "ORS is the preferred drink" },
  { when: (u) => u.attributes.tonicity === "ors", chunkId: "pd-2017#ors-sodium", reason: () => "SBS ORS sodium range" },
  { when: (u) => u.attributes.thickening === true, chunkId: "pd-2017#thickening-foods", reason: () => "thickening food" },
  { when: (u) => u.attributes.tonicity === "salty" || u.attributes.salty === true, chunkId: "pd-2017#salt", reason: () => "salty" },
  { when: (u) => u.attributes.lactose === true && u.canonicalName !== "milk", chunkId: "pd-2017#lactose", reason: () => "dairy often tolerated" },
  {
    when: (u) => u.attributes.releaseForm === "immediate-release" || u.attributes.releaseForm === "liquid",
    chunkId: "pg139#extended-release-avoid",
    reason: () => "immediate-release form to ask about",
  },
];

export function checkSwap(insteadOf: SwapItem, use: SwapItem, anatomy: Anatomy): SwapCheck {
  const tags = scopeTagsFor(anatomy);
  const inScope = (chunkId: string) => (SCOPES[chunkId] ?? []).some((s) => tags.includes(s));

  const conflicts = CONFLICTS.filter((r) => r.when(use) && inScope(r.chunkId)).map((r) => ({
    reason: r.reason(use),
    citation: `G:${r.chunkId}`,
  }));
  // Why the original was worth swapping out also supports the swap.
  const against = CONFLICTS.filter((r) => r.when(insteadOf) && inScope(r.chunkId)).map((r) => `G:${r.chunkId}`);
  const support = SUPPORT.filter((r) => r.when(use) && inScope(r.chunkId)).map((r) => `G:${r.chunkId}`);

  return {
    passed: conflicts.length === 0,
    conflicts,
    citations: conflicts.length ? conflicts.map((c) => c.citation) : Array.from(new Set([...against, ...support])),
  };
}
