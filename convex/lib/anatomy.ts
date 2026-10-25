// Pure anatomy helpers, importable from both Convex runtimes and the client.

export type StomaType = "none" | "ileostomy" | "colostomy" | "jejunostomy";
export type BowelLengthBand = "unknown" | "<100cm" | "100-200cm" | ">200cm";

export type Anatomy = {
  colonInContinuity: boolean;
  stomaType: StomaType;
  bowelLengthBand: BowelLengthBand;
};

// Coarse groups used for community stratification and guideline scoping.
export const ANATOMY_KEYS = [
  "end-jejunostomy",
  "colon-in-continuity",
  "ileostomy",
  "colostomy",
] as const;
export type AnatomyKey = (typeof ANATOMY_KEYS)[number];

export const ANATOMY_LABELS: Record<AnatomyKey, string> = {
  "end-jejunostomy": "end-jejunostomy (no colon)",
  "colon-in-continuity": "small bowel joined to colon",
  ileostomy: "ileostomy",
  colostomy: "colostomy",
};

export function anatomyKeyOf(a: Anatomy): AnatomyKey {
  if (a.stomaType === "jejunostomy") return "end-jejunostomy";
  if (a.stomaType === "ileostomy") return "ileostomy";
  if (a.stomaType === "colostomy") return "colostomy";
  return "colon-in-continuity";
}

// Short bowel = known to be under 200 cm, or a jejunostomy (which implies it).
export function isShortBowel(a: Anatomy): boolean {
  return (
    a.stomaType === "jejunostomy" ||
    a.bowelLengthBand === "<100cm" ||
    a.bowelLengthBand === "100-200cm"
  );
}

// Guideline chunks are scoped with these tags in `anatomyScope`.
export function scopeTagsFor(a: Anatomy): string[] {
  const tags = ["all", anatomyKeyOf(a)];
  if (isShortBowel(a)) tags.push("short-bowel");
  // Unknown length fails to the cautious scope.
  if (a.bowelLengthBand === "unknown" && a.stomaType !== "colostomy") {
    tags.push("short-bowel");
  }
  if (!a.colonInContinuity && a.stomaType !== "colostomy") tags.push("no-colon");
  else tags.push("colon");
  return Array.from(new Set(tags));
}

export function describeAnatomy(a: Anatomy): string {
  const len = {
    unknown: "small-bowel length unknown",
    "<100cm": "under 100 cm of small bowel",
    "100-200cm": "100 to 200 cm of small bowel",
    ">200cm": "over 200 cm of small bowel",
  }[a.bowelLengthBand];
  const key = anatomyKeyOf(a);
  // The end-jejunostomy and colon-in-continuity labels already say where the colon is.
  const colon = key === "end-jejunostomy" || key === "colon-in-continuity" ? "" : `, colon ${a.colonInContinuity ? "in continuity" : "not in continuity"}`;
  return `${ANATOMY_LABELS[key]}, ${len}${colon}`;
}

// "an end-jejunostomy (no colon) and under 100 cm of small bowel", for a spoken question.
export function anatomyShort(a: Anatomy): string {
  const base = {
    "end-jejunostomy": "an end-jejunostomy (no colon)",
    "colon-in-continuity": "the small bowel joined to the colon",
    ileostomy: "an ileostomy",
    colostomy: "a colostomy",
  }[anatomyKeyOf(a)];
  const len = { unknown: "", "<100cm": " and under 100 cm of small bowel", "100-200cm": " and 100 to 200 cm of small bowel", ">200cm": "" }[a.bowelLengthBand];
  return base + len;
}

// ---- Gut diagram segments (shared by GutDiagram, onboarding and answers)

export const SEGMENTS = [
  "stomach",
  "duodenum",
  "jejunum",
  "ileum",
  "cecum",
  "ascending-colon",
  "transverse-colon",
  "descending-sigmoid",
] as const;
export type SegmentId = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<SegmentId, string> = {
  stomach: "stomach",
  duodenum: "duodenum",
  jejunum: "jejunum (upper small bowel)",
  ileum: "ileum (lower small bowel)",
  cecum: "cecum",
  "ascending-colon": "ascending colon",
  "transverse-colon": "transverse colon",
  "descending-sigmoid": "descending and sigmoid colon",
};

export const COLON: SegmentId[] = ["cecum", "ascending-colon", "transverse-colon", "descending-sigmoid"];

export type DiagramState = { removed: SegmentId[]; stomaAfter: SegmentId | null };

export function stomaTypeFor(after: SegmentId | null): StomaType {
  if (!after) return "none";
  if (after === "jejunum" || after === "duodenum") return "jejunostomy";
  if (after === "ileum") return "ileostomy";
  return COLON.includes(after) ? "colostomy" : "none";
}

// Coarse fields from the tapped diagram. Length can't be measured from taps, so
// "from-diagram" is the user's "I don't know, roughly this much".
export function deriveAnatomy(d: DiagramState, length: BowelLengthBand | "from-diagram"): Anatomy {
  const stomaType = stomaTypeFor(d.stomaAfter);
  const colonLeft = COLON.some((s) => !d.removed.includes(s));
  const colonInContinuity = colonLeft && (stomaType === "none" || stomaType === "colostomy");
  let bowelLengthBand: BowelLengthBand;
  if (length !== "from-diagram") bowelLengthBand = length;
  else if (d.removed.includes("jejunum")) bowelLengthBand = "<100cm";
  else if (d.removed.includes("ileum") || stomaType === "jejunostomy") bowelLengthBand = "<100cm";
  else bowelLengthBand = ">200cm";
  return { stomaType, colonInContinuity, bowelLengthBand };
}

// A plausible drawing for profiles created without the diagram (dropdown, demo).
export function defaultDiagram(a: Anatomy): DiagramState {
  switch (a.stomaType) {
    case "jejunostomy":
      return { removed: ["ileum", ...COLON], stomaAfter: "jejunum" };
    case "ileostomy":
      return { removed: [...COLON], stomaAfter: "ileum" };
    case "colostomy":
      return { removed: ["descending-sigmoid"], stomaAfter: "transverse-colon" };
    default:
      return a.colonInContinuity
        ? { removed: a.bowelLengthBand === "<100cm" || a.bowelLengthBand === "100-200cm" ? ["ileum", "cecum"] : [], stomaAfter: null }
        : { removed: [...COLON], stomaAfter: null };
  }
}

export function describeDiagram(d: DiagramState): string {
  const kept = SEGMENTS.filter((s) => !d.removed.includes(s)).map((s) => SEGMENT_LABELS[s]);
  const gone = d.removed.map((s) => SEGMENT_LABELS[s]);
  return [
    gone.length ? `Removed: ${gone.join(", ")}.` : "Nothing marked as removed.",
    `Still there: ${kept.join(", ") || "none"}.`,
    d.stomaAfter ? `Stoma at the end of the ${SEGMENT_LABELS[d.stomaAfter]}.` : "No stoma.",
  ].join(" ");
}

// A representative anatomy per stratification group, for small badges.
export const ANATOMY_KEY_EXAMPLE: Record<AnatomyKey, Anatomy> = {
  "end-jejunostomy": { stomaType: "jejunostomy", colonInContinuity: false, bowelLengthBand: "<100cm" },
  "colon-in-continuity": { stomaType: "none", colonInContinuity: true, bowelLengthBand: "100-200cm" },
  ileostomy: { stomaType: "ileostomy", colonInContinuity: false, bowelLengthBand: ">200cm" },
  colostomy: { stomaType: "colostomy", colonInContinuity: true, bowelLengthBand: ">200cm" },
};
