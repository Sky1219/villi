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
  if (!a.colonInContinuity) tags.push("no-colon");
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
  return `${ANATOMY_LABELS[anatomyKeyOf(a)]}, ${len}, colon ${
    a.colonInContinuity ? "in continuity" : "not in continuity"
  }`;
}
