// Warning signs in a log note. Pure and importable from the client, so the card
// shows the moment the entry is saved. False positives are accepted on purpose
// ("not dizzy" still matches): telling someone to contact their care team is
// harmless; missing a real sign is not.

export type WarningLevel = "emergency" | "dehydration";
export type WarningScan = { level: WarningLevel | null; signs: string[] };

// Dehydration signs from uoaa-2025#dehydration-signs.
const DEHYDRATION: [string, RegExp][] = [
  ["thirst", /\bthirst(?:y|ier)?\b|\bparched\b/i],
  ["dark or less urine", /\b(?:dark|darker|brown|concentrated)\s+(?:urine|pee|wee)\b|\b(?:urine|pee|peeing|urinating|wee)\b[^.]{0,20}\b(?:dark|less|little|not much|hardly)\b|\b(?:less|little|no|hardly any|not much)\s+(?:urine|pee|peeing|urinating)\b|\b(?:haven'?t|hasn'?t|not|barely)\s+(?:peed|urinated|been peeing)\b/i],
  ["dizziness or lightheadedness", /\bdizz(?:y|iness)\b|\blight[- ]?headed(?:ness)?\b|\bwoozy\b/i],
  ["much higher output", /\b(?:output|bag|pouch)\b[^.]{0,30}\b(?:way up|much higher|very high|doubled|really high|filling (?:fast|quickly)|non-?stop)\b|\bhigh output\b/i],
  ["dry mouth", /\bdry mouth\b/i],
];

// Emergency phrases: fainting, confusion, chest pain, blood.
const EMERGENCY: [string, RegExp][] = [
  ["fainting", /\bfaint(?:ed|ing|s)?\b|\bpass(?:ed|ing)? out\b|\bblack(?:ed)? out\b|\bcollapsed?\b/i],
  ["confusion", /\bconfus(?:ed|ion)\b|\bdisoriented\b/i],
  ["chest pain", /\bchest (?:pain|pains|tight(?:ness)?|hurts?)\b/i],
  ["blood", /\bblood(?!\s*(?:pressure|sugar|glucose|tests?|work|levels?|draw|count))\b|\bbloody\b|\bbleed(?:ing|s)?\b/i],
];

export function scanWarningSigns(note: string | null | undefined): WarningScan {
  const text = note ?? "";
  const emergency = EMERGENCY.filter(([, re]) => re.test(text)).map(([s]) => s);
  if (emergency.length) return { level: "emergency", signs: emergency };
  const dehydration = DEHYDRATION.filter(([, re]) => re.test(text)).map(([s]) => s);
  return dehydration.length ? { level: "dehydration", signs: dehydration } : { level: null, signs: [] };
}

// Which card a saved log shows. A "worse" drink with no signs gets the softer
// dehydration card, without urgency wording.
export type WarningCard = "emergency" | "dehydration" | "drink-worse" | null;

export function cardFor(scan: WarningScan, outcome: string, category: string | null): WarningCard {
  if (scan.level) return scan.level;
  return outcome === "hurt" && category === "drink" ? "drink-worse" : null;
}

export const DEHYDRATION_CHUNK = "uoaa-2025#dehydration-signs";

// Fixed card wording. The only medical claim, that these can be signs of
// dehydration, is the cited chunk's; there is no other advice, no fluids guidance and no amounts.
export function cardText(card: Exclude<WarningCard, null>, person: string): string {
  const you = person === "you";
  const team = you ? "your care team" : `${person}'s care team`;
  if (card === "emergency") {
    return you
      ? "If you are fainting, confused, or have chest pain or bleeding, call emergency services now."
      : `If ${person} is fainting, confused, or has chest pain or bleeding, call emergency services now.`;
  }
  if (card === "dehydration") return `These can be warning signs of dehydration. Contact ${team} today.`;
  return `If this comes with thirst, darker or less urine, or dizziness, those can be signs of dehydration worth telling ${team} about.`;
}
