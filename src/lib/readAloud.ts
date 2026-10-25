import { stripCitations } from "./citations";

type Speakable = {
  state: "flagged" | "nothing-found" | "cant-tell";
  verdict: string;
  why: { claim: string }[];
  swapToAskAbout: { text: string } | null;
  ask: string;
};

const STATE_SPOKEN: Record<Speakable["state"], string> = {
  flagged: "Flag to discuss.",
  "nothing-found": "Nothing found in the sources I checked.",
  "cant-tell": "Can't tell yet.",
};

// Speech engines read "ER" as "er" and "mg" as "m g". Spell out the few forms answers use.
const SPOKEN_WORDS: [RegExp, string][] = [
  // Only right after a drug word ("metoprolol ER"), so "go to the ER" stays the emergency room.
  [/(?<=[A-Za-z]\s)(?<!\b(?:[Tt]he|[Aa]n|[Tt]o|[Aa]t|[Ii]n)\s)ER\b/g, "extended-release"],
  [/(?<=[A-Za-z]\s)XL\b/g, "extended-release"],
  [/(?<=[A-Za-z]\s)SR\b/g, "sustained-release"],
  [/(?<=[A-Za-z]\s)DR\b/g, "delayed-release"],
  [/(?<=[A-Za-z]\s)EC\b/g, "enteric-coated"],
  [/\bORS\b/g, "oral rehydration solution"],
  [/(\d)\s?mg\b/g, "$1 milligrams"],
  [/(\d)\s?mmol\/L\b/g, "$1 millimoles per liter"],
];

export function forSpeech(text: string): string {
  return SPOKEN_WORDS.reduce((t, [re, word]) => t.replace(re, word), stripCitations(text)).replace(/\s+/g, " ").trim();
}

// The answer in its reading order, as plain sentences without citation tokens: the state,
// the verdict, why, the swap to ask about, then the one question. Nothing is added that the
// reviewed answer doesn't already say.
export function answerScript(answer: Speakable, itemName: string | null): string[] {
  const parts = [
    itemName ? `${forSpeech(itemName)}.` : "",
    STATE_SPOKEN[answer.state] ?? STATE_SPOKEN["cant-tell"],
    forSpeech(answer.verdict),
    answer.why.length > 0 ? "Why." : "",
    ...answer.why.map((w) => forSpeech(w.claim)),
    answer.swapToAskAbout ? `A swap to ask about. ${forSpeech(answer.swapToAskAbout.text)}` : "",
    `Ask your pharmacist or doctor. ${forSpeech(answer.ask.replace(/^ASK:\s*/, ""))}`,
  ];
  return parts.filter((p) => p.length > 0);
}
