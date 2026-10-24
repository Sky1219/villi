// match_pill: a closed-set match of what the user saw against their OWN meds,
// using each label's physical description. Reported as a "possible match", never an identification.

export type Saw = {
  shape: string | null; // round | oval | oblong | capsule | other
  color: string | null; // white | yellow | pink | orange | blue | green | brown | red | two-tone | other
  size: string | null; // small | medium | large
  imprint: string | null;
};

export type MedForMatch = { name: string; dosageForm: string | null; releaseForm: string; labelText: string };

export type PillMatch = {
  name: string;
  score: number;
  reasons: string[];
  releaseForm: string;
  evidence: string | null; // the label sentence that describes the product's appearance
};

const SHAPES: Record<string, RegExp> = {
  round: /\bround\b|\bcircular\b/i,
  oval: /\boval\b|\belliptical\b/i,
  oblong: /\boblong\b|\bcaplet\b|\bcapsule[- ]shaped\b|\belongated\b/i,
  capsule: /\bcapsules?\b|\bgelatin\b|\bsoftgel\b/i,
};

const COLORS: Record<string, RegExp> = {
  white: /\bwhite\b|\boff-white\b/i,
  yellow: /\byellow\b/i,
  pink: /\bpink\b/i,
  orange: /\borange\b|\bpeach\b/i,
  blue: /\bblue\b/i,
  green: /\bgreen\b/i,
  brown: /\bbrown\b|\btan\b/i,
  red: /\bred\b|\bmaroon\b/i,
};

// The sentence a label uses to describe what the product looks like.
export function appearanceSentence(text: string, name = ""): string | null {
  const sentences = text.replace(/\s+/g, " ").split(/(?<=[.;])\s+/);
  const strength = name.match(/\d+(?:\.\d+)?\s?mg/i)?.[0].replace(/\s/g, "").toLowerCase();
  const candidates = sentences.filter(
    (s) =>
      Object.values(COLORS).some((re) => re.test(s)) &&
      (Object.values(SHAPES).some((re) => re.test(s)) || /\btablets?\b|\bdebossed\b|\bimprinted\b/i.test(s)),
  );
  const looks = candidates.find((s) => strength && s.replace(/\s/g, "").toLowerCase().includes(strength)) ?? candidates[0];
  return looks ? looks.slice(0, 300) : null;
}

export function matchPills(saw: Saw, meds: MedForMatch[]): PillMatch[] {
  const out: PillMatch[] = [];
  for (const m of meds) {
    if (m.releaseForm === "liquid") continue; // a liquid can't be seen intact
    const looks = appearanceSentence(m.labelText, m.name);
    const text = `${looks ?? ""} ${m.dosageForm ?? ""}`;
    let score = 0;
    const reasons: string[] = [];
    const isCapsule = /CAPSULE/i.test(m.dosageForm ?? "");
    if (saw.shape === "capsule") {
      if (isCapsule) {
        score += 3;
        reasons.push("it is a capsule");
      } else score -= 2;
    } else if (saw.shape && saw.shape !== "other") {
      if (isCapsule) score -= 2;
      if (SHAPES[saw.shape]?.test(text)) {
        score += 2;
        reasons.push(`label describes it as ${saw.shape}`);
      }
    }
    if (saw.color && COLORS[saw.color]?.test(looks ?? "")) {
      score += 2;
      reasons.push(`label describes it as ${saw.color}`);
    }
    if (saw.imprint) {
      const imp = saw.imprint.trim().toLowerCase();
      if (imp.length >= 1 && m.labelText.toLowerCase().includes(imp)) {
        score += 4;
        reasons.push(`imprint "${saw.imprint}" appears on the label`);
      }
    }
    // Extended-release matrices and enteric coatings are the forms most often seen intact.
    if (m.releaseForm === "extended-release" || m.releaseForm === "delayed-release") {
      score += 1;
      reasons.push(`${m.releaseForm} form`);
    }
    out.push({ name: m.name, score, reasons, releaseForm: m.releaseForm, evidence: looks });
  }
  return out.filter((m) => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
}
