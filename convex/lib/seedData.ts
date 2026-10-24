// Synthetic demo data. Every record created from this file is `synthetic: true`.
import type { Anatomy, AnatomyKey } from "./anatomy";

type Attr = Record<string, string | number | boolean | string[]>;
export type SeedItem = {
  canonicalName: string;
  category: "pill" | "drink" | "food" | "action";
  aliases: string[];
  attributes: Attr;
};

export const SEED_ITEMS: SeedItem[] = [
  // Drinks
  { canonicalName: "water", category: "drink", aliases: ["plain water", "tap water", "agua"], attributes: { tonicity: "hypotonic" } },
  { canonicalName: "tea", category: "drink", aliases: ["black tea", "green tea", "chai"], attributes: { tonicity: "hypotonic", caffeine: true } },
  { canonicalName: "coffee", category: "drink", aliases: ["espresso", "latte"], attributes: { tonicity: "hypotonic", caffeine: true } },
  { canonicalName: "apple juice", category: "drink", aliases: ["juice", "fruit juice"], attributes: { tonicity: "hypertonic", simpleSugar: true } },
  { canonicalName: "orange juice", category: "drink", aliases: ["oj"], attributes: { tonicity: "hypertonic", simpleSugar: true } },
  { canonicalName: "cola", category: "drink", aliases: ["soda", "coke", "pop", "soft drink"], attributes: { tonicity: "hypertonic", simpleSugar: true, caffeine: true } },
  { canonicalName: "sports drink", category: "drink", aliases: ["gatorade", "powerade", "electrolyte drink"], attributes: { tonicity: "hypertonic", simpleSugar: true, lowSodium: true } },
  { canonicalName: "oral rehydration solution", category: "drink", aliases: ["ors", "rehydration salts", "st mark's solution", "electrolyte solution"], attributes: { tonicity: "ors", sodiumBand: "sbs-range" } },
  { canonicalName: "broth", category: "drink", aliases: ["bouillon", "chicken broth", "soup broth"], attributes: { tonicity: "salty" } },
  { canonicalName: "milk", category: "drink", aliases: ["dairy milk"], attributes: { lactose: true } },
  // Foods
  { canonicalName: "banana", category: "food", aliases: ["ripe banana"], attributes: { thickening: true, sweet: true } },
  { canonicalName: "white rice", category: "food", aliases: ["rice", "steamed rice"], attributes: { thickening: true } },
  { canonicalName: "salted crackers", category: "food", aliases: ["saltines", "crackers"], attributes: { thickening: true, salty: true } },
  { canonicalName: "mashed potato", category: "food", aliases: ["potato", "potatoes"], attributes: { thickening: true } },
  { canonicalName: "pasta", category: "food", aliases: ["noodles", "spaghetti"], attributes: { thickening: true } },
  { canonicalName: "yogurt", category: "food", aliases: ["plain yogurt", "curd"], attributes: { lactose: true, sweet: true } },
  { canonicalName: "sugar-free gum", category: "food", aliases: ["gum", "chewing gum"], attributes: { sugarAlcohol: "sorbitol" } },
  { canonicalName: "sugar-free candy", category: "food", aliases: ["sugar free sweets", "diabetic candy"], attributes: { sugarAlcohol: "sorbitol, xylitol", sweet: true } },
  { canonicalName: "ice cream", category: "food", aliases: ["gelato"], attributes: { simpleSugar: true, sweet: true, lactose: true } },
  { canonicalName: "cookies", category: "food", aliases: ["biscuits", "cake"], attributes: { simpleSugar: true, sweet: true } },
  { canonicalName: "spinach", category: "food", aliases: ["palak"], attributes: { oxalate: "high" } },
  { canonicalName: "peanut butter", category: "food", aliases: ["nut butter"], attributes: { fat: true } },
  // Pills
  { canonicalName: "metoprolol succinate er", category: "pill", aliases: ["toprol xl", "metoprolol er", "metoprolol extended release"], attributes: { releaseForm: "extended-release" } },
  { canonicalName: "metoprolol tartrate", category: "pill", aliases: ["lopressor", "metoprolol ir"], attributes: { releaseForm: "immediate-release" } },
  { canonicalName: "pantoprazole dr", category: "pill", aliases: ["protonix", "pantoprazole delayed release"], attributes: { releaseForm: "delayed-release" } },
  { canonicalName: "omeprazole dr", category: "pill", aliases: ["prilosec", "omeprazole"], attributes: { releaseForm: "delayed-release" } },
  { canonicalName: "acetaminophen oral solution", category: "pill", aliases: ["liquid tylenol", "tylenol extra strength liquid", "acetaminophen liquid", "paracetamol syrup"], attributes: { releaseForm: "liquid", sugarAlcohol: "sorbitol" } },
  { canonicalName: "loperamide", category: "pill", aliases: ["imodium"], attributes: { releaseForm: "immediate-release" } },
  { canonicalName: "ondansetron", category: "pill", aliases: ["zofran"], attributes: { releaseForm: "immediate-release" } },
  { canonicalName: "potassium chloride er", category: "pill", aliases: ["klor-con", "k-dur"], attributes: { releaseForm: "extended-release" } },
];

// Father demo profile: anatomy only, no identity.
export const FATHER: { anatomy: Anatomy; meds: { name: string; genericName: string; dosageForm: string }[] } = {
  anatomy: { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" },
  meds: [
    { name: "Metoprolol succinate ER 50 mg", genericName: "metoprolol succinate", dosageForm: "TABLET, FILM COATED, EXTENDED RELEASE" },
    { name: "Pantoprazole sodium DR 40 mg", genericName: "pantoprazole sodium", dosageForm: "TABLET, DELAYED RELEASE" },
    { name: "Tylenol Extra Strength liquid", genericName: "acetaminophen", dosageForm: "SOLUTION" },
    { name: "Loperamide 2 mg", genericName: "loperamide hydrochloride", dosageForm: "CAPSULE" },
    { name: "Ondansetron 4 mg", genericName: "ondansetron hydrochloride", dosageForm: "TABLET, FILM COATED" },
  ],
};

export const PEER: { anatomy: Anatomy; meds: { name: string; genericName: string; dosageForm: string }[] } = {
  anatomy: { colonInContinuity: true, stomaType: "none", bowelLengthBand: "100-200cm" },
  meds: [
    { name: "Loperamide 2 mg", genericName: "loperamide hydrochloride", dosageForm: "CAPSULE" },
    { name: "Omeprazole DR 20 mg", genericName: "omeprazole", dosageForm: "CAPSULE, DELAYED RELEASE" },
  ],
};

export const SYNTHETIC_GROUPS: { key: AnatomyKey; count: number; anatomies: Anatomy[] }[] = [
  {
    key: "end-jejunostomy",
    count: 16,
    anatomies: [{ colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "<100cm" }, { colonInContinuity: false, stomaType: "jejunostomy", bowelLengthBand: "100-200cm" }],
  },
  {
    key: "colon-in-continuity",
    count: 16,
    anatomies: [{ colonInContinuity: true, stomaType: "none", bowelLengthBand: "<100cm" }, { colonInContinuity: true, stomaType: "none", bowelLengthBand: "100-200cm" }],
  },
  {
    key: "ileostomy",
    count: 16,
    anatomies: [{ colonInContinuity: false, stomaType: "ileostomy", bowelLengthBand: ">200cm" }, { colonInContinuity: false, stomaType: "ileostomy", bowelLengthBand: "100-200cm" }, { colonInContinuity: false, stomaType: "ileostomy", bowelLengthBand: "unknown" }],
  },
  {
    key: "colostomy",
    count: 12,
    anatomies: [{ colonInContinuity: false, stomaType: "colostomy", bowelLengthBand: ">200cm" }, { colonInContinuity: false, stomaType: "colostomy", bowelLengthBand: "unknown" }],
  },
];

// Probability of [helped, neutral, hurt] for an item in an anatomy group.
// Patterns follow the corpus, with noise so nothing is 100%.
export function outcomeOdds(item: SeedItem, key: AnatomyKey): [number, number, number] {
  const a = item.attributes;
  const jej = key === "end-jejunostomy";
  const ile = key === "ileostomy";
  const colo = key === "colostomy";
  if (a.tonicity === "ors") return jej ? [0.8, 0.14, 0.06] : colo ? [0.45, 0.45, 0.1] : [0.7, 0.22, 0.08];
  if (a.tonicity === "hypotonic") {
    const hurt = jej ? 0.66 : ile ? 0.35 : colo ? 0.1 : 0.15;
    return [0.2, 0.8 - hurt, hurt];
  }
  if (a.tonicity === "hypertonic") {
    const hurt = jej ? 0.72 : ile ? 0.55 : colo ? 0.22 : 0.45;
    return [0.1, 0.9 - hurt, hurt];
  }
  if (a.sugarAlcohol) {
    const hurt = colo ? 0.35 : jej ? 0.68 : 0.58;
    return [0.08, 0.92 - hurt, hurt];
  }
  if (a.releaseForm === "extended-release") {
    const hurt = jej ? 0.62 : ile ? 0.4 : colo ? 0.12 : 0.35;
    return [0.2, 0.8 - hurt, hurt];
  }
  if (a.releaseForm === "delayed-release") {
    const hurt = jej ? 0.45 : ile ? 0.3 : colo ? 0.1 : 0.25;
    return [0.3, 0.7 - hurt, hurt];
  }
  if (a.thickening) return [0.7, 0.24, 0.06];
  if (a.simpleSugar) return jej || ile ? [0.12, 0.3, 0.58] : [0.25, 0.4, 0.35];
  if (a.tonicity === "salty") return jej ? [0.65, 0.28, 0.07] : [0.5, 0.42, 0.08];
  if (a.oxalate && key === "colon-in-continuity") return [0.15, 0.45, 0.4];
  return [0.4, 0.42, 0.18];
}

export function noteFor(item: SeedItem, outcome: "helped" | "neutral" | "hurt", r: number): string | undefined {
  if (r > 0.18) return undefined;
  const a = item.attributes;
  if (outcome === "hurt" && a.releaseForm === "extended-release") return "didn't seem to work";
  if (outcome === "hurt" && a.releaseForm === "delayed-release") return "saw what looked like the tablet in my bag";
  if (outcome === "hurt" && a.sugarAlcohol) return "output went way up that afternoon";
  if (outcome === "hurt" && a.tonicity) return "output went up, felt drained";
  if (outcome === "helped" && a.thickening) return "thickened things up";
  if (outcome === "helped" && a.tonicity === "ors") return "felt less thirsty";
  return undefined;
}

export type SeedSwap = { insteadOf: string; use: string; note: string; anatomy: AnatomyKey; citations: string[]; endorsed?: boolean };

export const SEED_SWAPS: SeedSwap[] = [
  { insteadOf: "sports drink", use: "oral rehydration solution", note: "Switched my afternoon sports drink for ORS; much less thirsty.", anatomy: "end-jejunostomy", citations: ["G:pd-2017#sports-drinks", "G:aga-sbs#fluids-ors"], endorsed: true },
  { insteadOf: "sports drink", use: "oral rehydration solution", note: "ORS instead of the blue sports drink after walks.", anatomy: "ileostomy", citations: ["G:pd-2017#sports-drinks"], endorsed: true },
  { insteadOf: "sports drink", use: "oral rehydration solution", note: "Keep ORS sachets in my bag now.", anatomy: "end-jejunostomy", citations: ["G:pd-2017#sports-drinks"] },
  { insteadOf: "sports drink", use: "broth", note: "Warm broth when I want something savory.", anatomy: "end-jejunostomy", citations: ["G:pd-2017#salt"] },
  { insteadOf: "cola", use: "oral rehydration solution", note: "Chilled ORS with a squeeze of lemon instead of soda.", anatomy: "end-jejunostomy", citations: ["G:aga-sbs#fluids-hypertonic", "G:aga-sbs#fluids-ors"], endorsed: true },
  { insteadOf: "cola", use: "oral rehydration solution", note: "Fizzy craving is real. ORS over ice helped.", anatomy: "ileostomy", citations: ["G:aga-sbs#fluids-hypertonic"] },
  { insteadOf: "cola", use: "broth", note: "Broth in a mug when everyone else has soda.", anatomy: "colon-in-continuity", citations: ["G:aga-sbs#fluids-hypertonic"] },
  { insteadOf: "apple juice", use: "oral rehydration solution", note: "ORS instead of juice with breakfast.", anatomy: "end-jejunostomy", citations: ["G:aga-sbs#fluids-hypertonic"] },
  { insteadOf: "apple juice", use: "oral rehydration solution", note: "Juice was the worst for me. ORS is fine.", anatomy: "ileostomy", citations: ["G:aga-sbs#fluids-hypertonic"] },
  { insteadOf: "orange juice", use: "oral rehydration solution", note: "Citrus ORS flavor scratches the itch.", anatomy: "colon-in-continuity", citations: ["G:aga-sbs#fluids-hypertonic"] },
  { insteadOf: "water", use: "oral rehydration solution", note: "Sipping ORS instead of big glasses of water.", anatomy: "end-jejunostomy", citations: ["G:pd-2017#hypotonic-jejunostomy"], endorsed: true },
  { insteadOf: "water", use: "oral rehydration solution", note: "ORS on hot days instead of plain water.", anatomy: "end-jejunostomy", citations: ["G:pd-2017#hypotonic-jejunostomy"] },
  { insteadOf: "water", use: "broth", note: "Salty broth instead of water at night.", anatomy: "end-jejunostomy", citations: ["G:pd-2017#hypotonic-jejunostomy", "G:pd-2017#salt"] },
  { insteadOf: "tea", use: "oral rehydration solution", note: "Fewer cups of tea, more ORS.", anatomy: "end-jejunostomy", citations: ["G:pd-2017#hypotonic-jejunostomy"] },
  { insteadOf: "coffee", use: "broth", note: "Morning broth instead of the second coffee.", anatomy: "ileostomy", citations: ["G:pd-2017#caffeine-alcohol"] },
  { insteadOf: "sugar-free gum", use: "salted crackers", note: "Crackers when I want something to chew on.", anatomy: "end-jejunostomy", citations: ["G:pg139#sugar-alcohols"] },
  { insteadOf: "sugar-free gum", use: "salted crackers", note: "Gum was secretly the problem for me.", anatomy: "ileostomy", citations: ["G:pg139#sugar-alcohols"] },
  { insteadOf: "sugar-free candy", use: "banana", note: "Ripe banana for something sweet.", anatomy: "end-jejunostomy", citations: ["G:pg139#sugar-alcohols", "G:pd-2017#thickening-foods"], endorsed: true },
  { insteadOf: "sugar-free candy", use: "banana", note: "Banana with a bit of peanut butter.", anatomy: "ileostomy", citations: ["G:pg139#sugar-alcohols", "G:pd-2017#thickening-foods"] },
  { insteadOf: "sugar-free candy", use: "yogurt", note: "Small bowl of yogurt for dessert.", anatomy: "colon-in-continuity", citations: ["G:pg139#sugar-alcohols", "G:pd-2017#lactose"] },
  { insteadOf: "ice cream", use: "yogurt", note: "Frozen yogurt bites instead of ice cream.", anatomy: "end-jejunostomy", citations: ["G:aga-sbs#diet-simple-sugars", "G:pd-2017#lactose"] },
  { insteadOf: "ice cream", use: "banana", note: "Frozen banana, blended. Tastes like soft-serve.", anatomy: "ileostomy", citations: ["G:aga-sbs#diet-simple-sugars"], endorsed: true },
  { insteadOf: "ice cream", use: "banana", note: "Banana 'nice cream' is my go-to now.", anatomy: "end-jejunostomy", citations: ["G:aga-sbs#diet-simple-sugars"] },
  { insteadOf: "cookies", use: "salted crackers", note: "Salty crackers over cookies in the afternoon.", anatomy: "end-jejunostomy", citations: ["G:aga-sbs#diet-simple-sugars"] },
  { insteadOf: "cookies", use: "banana", note: "Banana when the sweet tooth hits.", anatomy: "colon-in-continuity", citations: ["G:aga-sbs#diet-simple-sugars"] },
  { insteadOf: "cookies", use: "yogurt", note: "Yogurt with a little cinnamon.", anatomy: "ileostomy", citations: ["G:aga-sbs#diet-simple-sugars", "G:pd-2017#lactose"] },
  { insteadOf: "spinach", use: "mashed potato", note: "Asked about oxalate and swapped my spinach side.", anatomy: "colon-in-continuity", citations: ["G:aga-sbs#diet-colon-oxalate"] },
  { insteadOf: "spinach", use: "white rice", note: "Rice side instead of spinach.", anatomy: "colon-in-continuity", citations: ["G:aga-sbs#diet-colon-oxalate"] },
  { insteadOf: "metoprolol succinate er", use: "metoprolol tartrate", note: "Asked my pharmacist about the immediate-release version; they changed it after checking with my cardiologist.", anatomy: "end-jejunostomy", citations: ["G:aga-sbs#medications-release-forms", "G:pg139#extended-release-avoid"], endorsed: true },
  { insteadOf: "metoprolol succinate er", use: "metoprolol tartrate", note: "Raised the ER question at clinic; my team made the switch.", anatomy: "end-jejunostomy", citations: ["G:pg139#time-release"] },
  { insteadOf: "metoprolol succinate er", use: "metoprolol tartrate", note: "Pharmacist suggested asking the prescriber about IR. Worth asking.", anatomy: "ileostomy", citations: ["G:pg139#time-release"] },
  { insteadOf: "pantoprazole dr", use: "omeprazole dr", note: "Asked about a form that opens and mixes; my GI decided.", anatomy: "end-jejunostomy", citations: ["G:pg139#enteric-coating"] },
  { insteadOf: "sports drink", use: "oral rehydration solution", note: "Our whole family keeps ORS in the fridge now.", anatomy: "colon-in-continuity", citations: ["G:pd-2017#sports-drinks"] },
  { insteadOf: "cola", use: "oral rehydration solution", note: "ORS ice pops in summer.", anatomy: "end-jejunostomy", citations: ["G:aga-sbs#fluids-hypertonic"] },
  { insteadOf: "orange juice", use: "banana", note: "Banana instead of juice at breakfast.", anatomy: "end-jejunostomy", citations: ["G:aga-sbs#fluids-hypertonic"] },
  { insteadOf: "milk", use: "yogurt", note: "Yogurt sits better than a glass of milk.", anatomy: "ileostomy", citations: ["G:pd-2017#lactose"] },
  { insteadOf: "coffee", use: "oral rehydration solution", note: "Half my coffees became ORS.", anatomy: "end-jejunostomy", citations: ["G:pd-2017#caffeine-alcohol"] },
  { insteadOf: "apple juice", use: "broth", note: "Broth with lunch instead of juice.", anatomy: "colon-in-continuity", citations: ["G:aga-sbs#fluids-hypertonic"] },
  { insteadOf: "sugar-free gum", use: "banana", note: "Dropped the gum habit.", anatomy: "colostomy", citations: ["G:pg139#sugar-alcohols"] },
];

export type SeedCareTeam = {
  item?: string;
  question: string;
  professional: "pharmacist" | "dietitian" | "doctor" | "nurse";
  answer: string;
  anatomy: AnatomyKey;
  endorsed?: boolean;
};

export const SEED_CARE_TEAM: SeedCareTeam[] = [
  { item: "metoprolol succinate er", question: "Is my extended-release metoprolol being absorbed with my short bowel?", professional: "pharmacist", answer: "My pharmacist said extended-release tablets may not release fully with a short gut and asked my cardiologist to review the form.", anatomy: "end-jejunostomy", endorsed: true },
  { item: "metoprolol succinate er", question: "Should my heart medicine be a different form?", professional: "doctor", answer: "My cardiologist checked my heart rate and blood pressure readings to see whether it was working before deciding.", anatomy: "end-jejunostomy" },
  { item: "metoprolol succinate er", question: "Can ER tablets work with an ileostomy?", professional: "pharmacist", answer: "Mine said it depends on how much small bowel is left and to watch whether the medicine seems to be working.", anatomy: "ileostomy" },
  { item: "pantoprazole dr", question: "I think I saw my pantoprazole in the bag. Is it working?", professional: "pharmacist", answer: "They said a shell can be empty or the tablet may not have dissolved, and suggested asking my GI about other forms.", anatomy: "end-jejunostomy", endorsed: true },
  { item: "pantoprazole dr", question: "Is there a form of my acid medicine that absorbs better?", professional: "doctor", answer: "My GI talked through granule and IV options for my situation.", anatomy: "end-jejunostomy" },
  { item: "omeprazole dr", question: "Does my colon change how omeprazole works?", professional: "pharmacist", answer: "Mine said most of it is absorbed higher up, so my colon was not the main issue.", anatomy: "colon-in-continuity" },
  { item: "acetaminophen oral solution", question: "Does liquid acetaminophen have sorbitol?", professional: "pharmacist", answer: "My pharmacist checked the brand and found sorbitol in the inactive ingredients, and offered to look for a different product.", anatomy: "end-jejunostomy", endorsed: true },
  { item: "acetaminophen oral solution", question: "Why does my output go up after liquid medicine?", professional: "nurse", answer: "My ostomy nurse said sugar alcohols in liquid medicines are a common cause and to ask the pharmacist to check labels.", anatomy: "ileostomy" },
  { item: "sports drink", question: "Is a sports drink as good as ORS?", professional: "dietitian", answer: "My dietitian said sports drinks are too low in salt and too high in sugar to replace ORS for me.", anatomy: "end-jejunostomy", endorsed: true },
  { item: "sports drink", question: "Can I have a sports drink after exercise?", professional: "dietitian", answer: "Mine said ORS is the better choice for my anatomy, and to talk to them before changing my fluids.", anatomy: "ileostomy" },
  { item: "water", question: "Why am I told to limit plain water?", professional: "dietitian", answer: "My dietitian explained that without a colon, plain water can pull salt out and make output worse.", anatomy: "end-jejunostomy", endorsed: true },
  { item: "water", question: "Do I need to limit water with my colon still connected?", professional: "dietitian", answer: "Mine said people with a colon usually handle water better, and set my fluid plan individually.", anatomy: "colon-in-continuity" },
  { item: "oral rehydration solution", question: "Which ORS is right for me?", professional: "dietitian", answer: "My dietitian said many store-bought ORS products are lower in sodium than what is used for short bowel, and gave me a recipe she approved.", anatomy: "end-jejunostomy", endorsed: true },
  { item: "oral rehydration solution", question: "Can I flavor my ORS?", professional: "dietitian", answer: "Mine said a little lemon or sugar-free flavoring is usually fine but to avoid sorbitol-based flavorings.", anatomy: "end-jejunostomy" },
  { item: "oral rehydration solution", question: "Is WHO ORS the same as what I should drink?", professional: "doctor", answer: "My doctor said the WHO formula was designed for acute diarrhea and mine needs more salt.", anatomy: "ileostomy" },
  { item: "cola", question: "Is diet soda better than regular soda?", professional: "dietitian", answer: "My dietitian said diet sodas avoid the sugar but some sweeteners and the fizz can still bother people; she suggested ORS instead.", anatomy: "end-jejunostomy" },
  { item: "sugar-free gum", question: "Could chewing gum be raising my output?", professional: "nurse", answer: "My stoma nurse said sugar-free gum often has sorbitol or xylitol and is a common hidden cause.", anatomy: "ileostomy", endorsed: true },
  { item: "sugar-free candy", question: "Is sugar-free candy better for me?", professional: "dietitian", answer: "Mine said sugar-free candies often use sugar alcohols that can make things worse, not better.", anatomy: "end-jejunostomy" },
  { item: "banana", question: "What sweet foods are easiest on my output?", professional: "dietitian", answer: "My dietitian suggested ripe bananas and starchy desserts like rice pudding in small portions.", anatomy: "end-jejunostomy", endorsed: true },
  { item: "white rice", question: "Which foods thicken output?", professional: "nurse", answer: "My ostomy nurse listed rice, bananas, potatoes, pasta and crackers as foods many people find thickening.", anatomy: "ileostomy" },
  { item: "spinach", question: "Should I worry about oxalate?", professional: "dietitian", answer: "My dietitian said because my colon is connected I should limit high-oxalate foods like spinach and nuts.", anatomy: "colon-in-continuity", endorsed: true },
  { item: "spinach", question: "Does oxalate matter with an end-jejunostomy?", professional: "dietitian", answer: "Mine said oxalate stones are mainly a concern when the colon is still connected.", anatomy: "end-jejunostomy" },
  { item: "peanut butter", question: "Should I cut fat?", professional: "dietitian", answer: "My dietitian said with no colon I should not cut fat because I need the energy.", anatomy: "end-jejunostomy" },
  { item: "milk", question: "Do I have to avoid dairy?", professional: "dietitian", answer: "Mine said most people with short bowel tolerate some dairy, especially yogurt and cheese.", anatomy: "colon-in-continuity" },
  { item: "loperamide", question: "When should I take loperamide relative to meals?", professional: "pharmacist", answer: "My pharmacist set the timing with me; it's individual, so ask yours.", anatomy: "end-jejunostomy" },
  { item: "loperamide", question: "Can loperamide capsules pass through without working?", professional: "pharmacist", answer: "Mine said plain capsules usually dissolve high up, but to tell them if I ever saw them intact.", anatomy: "ileostomy" },
  { item: "potassium chloride er", question: "Is my potassium tablet absorbed?", professional: "pharmacist", answer: "My pharmacist said extended-release potassium can be a problem with short bowel and asked my doctor about a liquid form.", anatomy: "end-jejunostomy" },
  { item: "coffee", question: "Do I have to give up coffee?", professional: "dietitian", answer: "Mine said caffeine can raise output and suggested cutting back rather than quitting, and to track how I feel.", anatomy: "ileostomy" },
  { item: "tea", question: "Is tea as bad as water for me?", professional: "dietitian", answer: "My dietitian said tea counts as a low-salt drink for me without a colon.", anatomy: "end-jejunostomy" },
  { item: "ondansetron", question: "Will my nausea tablet absorb?", professional: "pharmacist", answer: "My pharmacist said it is an immediate-release tablet absorbed high up, and there is also a dissolving form if needed.", anatomy: "end-jejunostomy" },
];

export const SEED_QUESTIONS: string[] = [
  "Is my extended-release tablet being absorbed with how much bowel I have left?",
  "Does my liquid medicine contain sorbitol?",
  "Which ORS recipe matches what my team wants for me?",
  "Is there an immediate-release version of my blood pressure medicine?",
  "Could my enteric-coated tablet be passing through intact?",
  "Should my drug levels be checked after my surgery?",
  "Is sugar-free gum part of why my output is high?",
  "Do I need to limit plain water with my anatomy?",
  "Are sports drinks OK after exercise for me?",
  "Which sweet foods are least likely to raise my output?",
  "Should I worry about oxalate and kidney stones?",
  "Is there a liquid form of my potassium?",
  "Can my acid medicine come in a form that absorbs better?",
  "Is my loperamide timing right relative to meals?",
  "Do I need to cut fat from my diet?",
  "Can I keep drinking coffee?",
  "What signs of dehydration should make me call you?",
  "Is dairy OK for me?",
  "Could any of my medicines be adding to dehydration?",
  "Should a pharmacist review all my medicines' forms?",
];
