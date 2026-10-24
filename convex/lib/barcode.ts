// Barcode and typed-NDC parsing. Pure, importable from both Convex runtimes and the client.
//
// US drug barcodes carry the 10-digit NDC: UPC-A is "3" + NDC10 + check digit, and the
// GS1 GTIN-14 (DataMatrix on newer packs, AI "01") is "003" + NDC10 + check digit. The
// 10 digits don't say where the hyphens go (4-4-2, 5-3-2 or 5-4-1), so every split is
// tried against openFDA's NDC directory. OTC boxes without an NDC barcode carry a plain
// UPC, which openFDA lists on the label as openfda.upc.

export type ParsedCode =
  | { kind: "ndc"; ndc10: string; packageNdcs: string[] }
  | { kind: "upc"; upc: string }
  | { kind: "none" };

const SPLITS: [number, number, number][] = [
  [4, 4, 2],
  [5, 3, 2],
  [5, 4, 1],
];

export function packageNdcsFor(ndc10: string): string[] {
  return SPLITS.map(([a, b]) => `${ndc10.slice(0, a)}-${ndc10.slice(a, a + b)}-${ndc10.slice(a + b)}`);
}

// An 11-digit NDC (5-4-2, padded with one zero) back to the 10-digit candidates.
function from11(d: string): string[] {
  const out: string[] = [];
  if (d[0] === "0") out.push(d.slice(1));
  if (d[5] === "0") out.push(d.slice(0, 5) + d.slice(6));
  if (d[9] === "0") out.push(d.slice(0, 9) + d.slice(10));
  return out;
}

export function parseCode(raw: string): ParsedCode {
  const text = raw.trim();
  // A hyphenated NDC as printed on the label: use its own split.
  const hy = text.match(/^(\d{4,5})-(\d{3,4})-(\d{1,2})$/);
  if (hy && hy[1].length + hy[2].length + hy[3].length === 10) {
    return { kind: "ndc", ndc10: hy.slice(1).join(""), packageNdcs: [text] };
  }
  // GS1 element strings: "(01)00371610035459(17)..." or "01" + 14 digits at the start.
  const gs1 = text.match(/\(01\)(\d{14})/) ?? text.replace(/[\x1d\s]/g, "").match(/^01(\d{14})/);
  const d = gs1 ? gs1[1] : text.replace(/\D/g, "");
  if (d.length === 14 && d.startsWith("003")) {
    const ndc10 = d.slice(3, 13);
    return { kind: "ndc", ndc10, packageNdcs: packageNdcsFor(ndc10) };
  }
  if (d.length === 12 && d.startsWith("3")) {
    const ndc10 = d.slice(1, 11);
    return { kind: "ndc", ndc10, packageNdcs: packageNdcsFor(ndc10) };
  }
  if (d.length === 10 && !gs1) return { kind: "ndc", ndc10: d, packageNdcs: packageNdcsFor(d) };
  if (d.length === 11 && !gs1) {
    const cands = from11(d);
    return cands.length ? { kind: "ndc", ndc10: cands[0], packageNdcs: cands.flatMap(packageNdcsFor) } : { kind: "none" };
  }
  if (d.length === 12 || d.length === 13) return { kind: "upc", upc: d };
  return { kind: "none" };
}

// Typed text that is an NDC (with hyphens, or 10-11 digits), so the item box can take one.
export function looksLikeNdc(text: string): boolean {
  return /^\d{4,5}-\d{3,4}-\d{1,2}$/.test(text.trim()) || /^\d{10,11}$/.test(text.trim());
}

// "50 mg/1" -> "50 mg"; "METOPROLOL SUCCINATE" -> "Metoprolol Succinate".
export function productName(p: { brandName?: string | null; genericName?: string | null; strength?: string | null; dosageForm?: string | null }): string {
  // Short all-caps words are release or brand suffixes ("XL", "ER", "HCT"); keep them.
  const title = (s: string) =>
    s
      .split(/\s+/)
      .map((w) =>
        /^(AND|OF|IN|WITH)$/.test(w) ? w.toLowerCase() : w.length <= 3 && /^[A-Z]+$/.test(w) ? w : w.charAt(0) + w.slice(1).toLowerCase(),
      )
      .join(" ");
  const name = p.brandName ? title(p.brandName) : p.genericName ? title(p.genericName) : "";
  const strength = (p.strength ?? "").replace(/\/1$/, "").replace(/\s*\/\s*1\b/, "").trim();
  const form = (p.dosageForm ?? "").toLowerCase();
  return [name, strength, form].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
