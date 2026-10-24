import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { anthropicClient, fastModel, type LlmEnv } from "./llm";
import { VISION_SYSTEM } from "./prompts";

export const VisionSchema = z.object({
  kind: z.enum(["pill", "drink", "food", "unknown"]),
  name: z.string().nullable(),
  strength: z.string().nullable(),
  releaseText: z.string().nullable(),
  legible: z.boolean(),
});
export type VisionRead = z.infer<typeof VisionSchema>;

// Reads printed product fields only; never patient details. Callers delete the photo after.
export async function readPhoto(e: LlmEnv, url: string): Promise<VisionRead | null> {
  const client = anthropicClient(e);
  const res = await client.messages.parse({
    model: fastModel(e),
    max_tokens: 2000,
    system: VISION_SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(VisionSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url } },
          {
            type: "text",
            text: "What product is this? Give the printed product name (brand or generic), the printed strength, and any printed release wording (ER, XL, SR, DR, EC, extended-release, delayed-release, oral solution). Set legible=false if you cannot read a product name.",
          },
        ],
      },
    ],
  });
  return res.parsed_output;
}

const RELEASE_WORDS =
  /\b(extended[- ]release|delayed[- ]release|sustained[- ]release|controlled[- ]release|enteric[- ]coated|oral solution|oral suspension|ER|XL|XR|SR|CR|DR|EC|LA)\b/i;

// The model often repeats release wording and strength inside the name, and
// sometimes copies label instructions into releaseText; keep only the release term.
export function joinPhotoName(seen: VisionRead): string {
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, "");
  const release = seen.releaseText?.match(RELEASE_WORDS)?.[0] ?? null;
  return [seen.name, release, seen.strength].reduce<string>((acc, part) => {
    if (!part || norm(acc).includes(norm(part))) return acc;
    return `${acc} ${part}`.trim();
  }, "");
}

export const TabletSchema = z.object({
  shape: z.enum(["round", "oval", "oblong", "capsule", "other"]).nullable(),
  color: z.enum(["white", "yellow", "pink", "orange", "blue", "green", "brown", "red", "two-tone", "other"]).nullable(),
  imprint: z.string().nullable(),
  isTabletOrCapsule: z.boolean(),
});
export type TabletRead = z.infer<typeof TabletSchema>;

// "I saw something": a tablet or shell photographed on a clean surface.
export async function readTablet(e: LlmEnv, url: string): Promise<TabletRead | null> {
  const client = anthropicClient(e);
  const res = await client.messages.parse({
    model: fastModel(e),
    max_tokens: 1000,
    system:
      "You describe a single tablet, capsule or tablet shell photographed on a plain surface. Report only shape, color and any printed or debossed imprint you can actually read. Never guess a drug name. If the photo is not of a tablet or capsule, set isTabletOrCapsule=false and the other fields null.",
    output_config: { effort: "low", format: zodOutputFormat(TabletSchema) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url } },
          { type: "text", text: "Describe this tablet's shape, color and imprint." },
        ],
      },
    ],
  });
  return res.parsed_output;
}
