const SOURCE_SHORT: Record<string, string> = {
  "aga-sbs": "AGA 2022",
  pg139: "Pract Gastro 2015",
  "pd-2017": "Parrish & DiBaise 2017",
  "remane-2025": "Remane 2025",
  "sood-2013": "Aust Prescr 2013",
  "hong-2021": "Hong 2021",
  "who-ors": "WHO ORS",
};

export function citationLabel(kind: string, ref: string): string {
  if (kind === "G") return SOURCE_SHORT[ref.split("#")[0]] ?? ref.split("#")[0];
  if (kind === "L") return `FDA label: ${ref.replace(/_/g, " ")}`;
  if (kind === "C") return `Community ${ref}`;
  return "Another user's care team";
}

// Turn "[G:aga-sbs#fluids-hypertonic]" inside a sentence into "(AGA 2022)".
export function humanizeCitations(text: string): string {
  return text.replace(/\[(G|L|C|T):([^\]]+)\]/g, (_, k: string, r: string) => `(${citationLabel(k, r.trim())})`);
}

// Drop citation tokens entirely, for previews where the sources can't be opened.
export function stripCitations(text: string): string {
  return text.replace(/\s*\[(G|L|C|T):[^\]]+\]/g, "").trim();
}

export function sectionOf(ref: string): string {
  return ref.split("#")[1]?.replace(/-/g, " ") ?? "";
}
