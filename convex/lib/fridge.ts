// The fridge sheet: "Drinks that work for my anatomy". Guideline lines are fixed per
// section and filtered to the anatomy; community drinks pass the same guideline check
// as a swap. No quantities: a line with an amount in it is never printed.
import corpus from "../../data/guidelines.json";
import { checkSwap, type SwapItem } from "./swapCheck";
import { scopeTagsFor, type Anatomy } from "./anatomy";

type Chunk = { sourceId: string; locator: string; text: string; anatomyScope: string[]; section?: string };
const CHUNKS = new Map((corpus.chunks as Chunk[]).map((c) => [`${c.sourceId}#${c.locator}`, c]));
const SOURCES = corpus.sources as Record<string, { title: string }>;

const SECTIONS = [
  { key: "ask", title: "Ask the care team about first", chunkIds: ["aga-sbs#fluids-ors", "who-ors#purpose"] },
  { key: "usually", title: "Usually tolerated with this anatomy", chunkIds: ["pd-2017#hypotonic-colon"] },
  {
    key: "limit",
    title: "Guidelines say to limit",
    chunkIds: ["aga-sbs#fluids-hypotonic", "pd-2017#hypotonic-jejunostomy", "aga-sbs#fluids-hypertonic", "aga-sbs#fluids-sports-drinks", "pd-2017#simple-sugars"],
  },
] as const;

// Digits next to a unit, or any digit at all in a guideline line: amounts never go on the fridge.
export const AMOUNT_RE = /\d+(?:\.\d+)?\s*(?:mmol|mEq|mg|g|ml|mL|l|L|oz|ounces?|cups?|glass(?:es)?|liters?|litres?|%)\b/i;

export type FridgeDrink = { name: string; tolerated: number; total: number; synthetic: boolean };

export const FRIDGE_ASK = "ASK: Which oral rehydration solution suits this anatomy, and how should it fit into the day?";

export function fridgeSheet(anatomy: Anatomy, drinks: (FridgeDrink & { item: SwapItem })[]) {
  const tags = scopeTagsFor(anatomy);
  const sections = SECTIONS.map((s) => ({
    key: s.key,
    title: s.title,
    lines: s.chunkIds
      .map((id) => ({ id, c: CHUNKS.get(id) }))
      .filter((x): x is { id: (typeof s.chunkIds)[number]; c: Chunk } => !!x.c && x.c.anatomyScope.some((t) => tags.includes(t)) && !/\d/.test(x.c.text))
      .map(({ id, c }) => ({ chunkId: id, text: c.text, source: SOURCES[c.sourceId]?.title ?? c.sourceId, section: c.section ?? null })),
  })).filter((s) => s.lines.length > 0);

  const none: SwapItem = { canonicalName: "", category: "drink", attributes: {} };
  const community = drinks
    .filter((d) => d.total >= 5 && d.tolerated * 2 > d.total && checkSwap(none, d.item, anatomy).passed)
    .sort((a, b) => b.tolerated / b.total - a.tolerated / a.total || b.total - a.total)
    .slice(0, 8)
    .map(({ item: _item, ...d }) => d);

  return { sections, community, synthetic: community.some((d) => d.synthetic), ask: FRIDGE_ASK };
}
