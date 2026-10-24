import { v } from "convex/values";
import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env, internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { anthropicClient, fastModel, mainModel } from "./lib/llm";
import { AGENT_SYSTEM, VISION_SYSTEM } from "./lib/prompts";
import { AnswerSchema, answerJsonSchema, type Answer } from "./lib/answerSchema";
import { emptyRegistry, lintAnswer, type CitationRegistry } from "./lib/safety";
import { scopeTagsFor, type Anatomy } from "./lib/anatomy";
import { coreName, type LabelResult } from "./fda";
import type { ChunkView } from "./guidelines";
import type { StratifiedCounts } from "./community";

const MAX_TURNS = 8;
const DEADLINE_MS = 4 * 60_000;

type Profile = {
  role: string;
  anatomy: Anatomy;
  anatomyKey: string;
  anatomyText: string;
  language: string;
  meds: { name: string; dosageForm: string | null }[];
};

type Registry = CitationRegistry & { evidence: Record<string, string> };

const VisionSchema = z.object({
  kind: z.enum(["pill", "drink", "food", "unknown"]),
  name: z.string().nullable(),
  strength: z.string().nullable(),
  releaseText: z.string().nullable(),
  legible: z.boolean(),
});

const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_guidelines",
    description:
      "Search the clinical guideline corpus (AGA SBS update, Practical Gastroenterology, Remane 2025, Sood 2013, Hong 2021, WHO ORS). Results are already filtered to this user's anatomy. Returns chunkIds to cite as [G:<chunkId>].",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Plain-language terms, e.g. 'extended-release tablet absorption'" } },
      required: ["query"],
    },
  },
  {
    name: "fetch_label",
    description:
      "Fetch the FDA label for a medicine by name (brand or generic, optionally with ER/DR). Returns the NDC dosage form, label sections (cite as [L:<section_key>]), and which sections were absent.",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  {
    name: "query_community",
    description:
      "Tolerance counts other users logged for an item, stratified by anatomy. Evidence only, never a recommendation. Cite as [C:<n>/<total>, <anatomy>].",
    input_schema: { type: "object", properties: { item: { type: "string" } }, required: ["item"] },
  },
  {
    name: "query_my_log",
    description: "This user's own past log entries for an item (personal tolerance, soft evidence).",
    input_schema: { type: "object", properties: { item: { type: "string" } }, required: ["item"] },
  },
  {
    name: "submit_answer",
    description: "Submit the final answer. Call exactly once, after gathering evidence.",
    strict: true,
    input_schema: answerJsonSchema as unknown as Anthropic.Tool.InputSchema,
  },
];

const SearchArgs = z.object({ query: z.string().min(1).max(300) });
const NameArgs = z.object({ name: z.string().min(1).max(200) });
const ItemArgs = z.object({ item: z.string().min(1).max(200) });

function strengthsIn(text: string): string[] {
  return Array.from(text.matchAll(/\d+(?:\.\d+)?\s?(?:mg|mcg|g|ml|mL)\b/g), (m) => m[0]);
}

function labelForModel(l: LabelResult) {
  if (!l.found) {
    return { found: false, note: l.error ?? "No FDA label matched this name.", sectionsChecked: [] };
  }
  return {
    found: true,
    labelUsed: `${l.brandName ?? l.genericName} (${l.manufacturer ?? "unknown manufacturer"}, effective ${l.effectiveTime ?? "?"})`,
    dosageForm: l.dosageForms.join("; ") || "not listed in NDC",
    releaseForm: l.releaseForm,
    otherReleaseFormsOnMarket: l.otherReleaseFormsOnMarket,
    deterministicFlags: l.flags,
    sections: l.sections,
    absentSections: l.absentSections,
  };
}

function labelTrace(l: LabelResult): string {
  if (!l.found) return `no FDA label found${l.error ? ` (${l.error})` : ""}`;
  const flags = l.flags.map((f) => f.flag).join(", ") || "none";
  return `${l.brandName ?? l.genericName} by ${l.manufacturer ?? "?"}; form: ${l.dosageForms[0] ?? "unknown"}; flags: ${flags}; ${
    Object.keys(l.sections).length
  } sections, missing: ${l.absentSections.slice(0, 4).join(", ") || "none"}${l.fromCache ? " (cached)" : ""}`;
}

function registerLabel(reg: Registry, l: LabelResult) {
  if (!l.found) return;
  for (const [k, text] of Object.entries(l.sections)) {
    if (!reg.labelSections.includes(k)) reg.labelSections.push(k);
    reg.evidence[`L:${k}`] = text;
  }
}

class Agent {
  reg: Registry = { ...emptyRegistry(), evidence: {} };
  submitted: Answer | null = null;
  lintRetries = 0;

  constructor(
    private ctx: ActionCtx,
    private answerId: Id<"answers">,
    private profileId: Id<"profiles">,
    private profile: Profile,
  ) {}

  trace(tool: string, summary: string, ok = true) {
    return this.ctx.runMutation(internal.answers.appendTrace, { answerId: this.answerId, tool, summary, ok });
  }

  // [L:] citations name a section, not a product, so only the checked item's
  // own label may back them. Other products' labels are never citable.
  primaryCore: string | null = null;

  async fetchLabel(name: string): Promise<LabelResult> {
    const label: LabelResult = await this.ctx.runAction(internal.fda.fetchLabel, { name });
    const core = coreName(name);
    this.primaryCore ??= core;
    const sameItem = core.split(" ").some((w) => w.length > 3 && this.primaryCore!.includes(w));
    if (sameItem) registerLabel(this.reg, label);
    else if (label.found) {
      await this.trace("fetch_label", `${name}: a different product; not citable in this answer`, false);
      return { ...label, sections: {}, flags: [], absentSections: [], error: "Different product from the one being checked. Villi is not an interaction checker; do not use this." };
    }
    await this.trace("fetch_label", `${name}: ${labelTrace(label)}`, label.found);
    return label;
  }

  async exec(block: Anthropic.ToolUseBlock): Promise<Anthropic.ToolResultBlockParam> {
    const err = (content: string): Anthropic.ToolResultBlockParam => ({
      type: "tool_result",
      tool_use_id: block.id,
      content,
      is_error: true,
    });
    const ok = (data: unknown): Anthropic.ToolResultBlockParam => ({
      type: "tool_result",
      tool_use_id: block.id,
      content: JSON.stringify(data),
    });
    try {
      switch (block.name) {
        case "search_guidelines": {
          const a = SearchArgs.safeParse(block.input);
          if (!a.success) return err("query is required");
          const res: { path: string; note: string | null; chunks: ChunkView[] } = await this.ctx.runAction(
            internal.guidelines.search,
            { query: a.data.query, scopeTags: scopeTagsFor(this.profile.anatomy), limit: 6 },
          );
          for (const c of res.chunks) {
            if (!this.reg.guidelineIds.includes(c.chunkId)) this.reg.guidelineIds.push(c.chunkId);
            this.reg.evidence[`G:${c.chunkId}`] = c.text;
          }
          await this.trace(
            "search_guidelines",
            `"${a.data.query}" via ${res.path === "vector" ? "vector index" : "full-text index"}: ${res.chunks.length} chunks${
              res.chunks.length ? `, top G:${res.chunks[0].chunkId}` : ""
            }`,
          );
          return ok({
            chunks: res.chunks.map((c) => ({
              chunkId: c.chunkId,
              source: c.sourceTitle,
              text: c.text,
              appliesTo: c.appliesTo,
              diagram: c.diagram,
            })),
          });
        }
        case "fetch_label": {
          const a = NameArgs.safeParse(block.input);
          if (!a.success) return err("name is required");
          return ok(labelForModel(await this.fetchLabel(a.data.name)));
        }
        case "query_community": {
          const a = ItemArgs.safeParse(block.input);
          if (!a.success) return err("item is required");
          const res: { item: { canonicalName: string; category: string }; counts: StratifiedCounts } | null =
            await this.ctx.runQuery(internal.community.communityForItem, {
              name: a.data.item,
              anatomyKey: this.profile.anatomyKey,
            });
          if (!res) {
            await this.trace("query_community", `"${a.data.item}": no community logs yet`);
            return ok({ found: false, note: "No one has logged this item yet." });
          }
          const c = res.counts;
          for (const t of [c.matchingAnatomy.total, c.other.total, ...c.byAnatomy.map((b) => b.total)]) {
            if (t > 0 && !this.reg.communityTotals.includes(t)) this.reg.communityTotals.push(t);
          }
          this.reg.evidence[`C:${res.item.canonicalName}`] = JSON.stringify(c.byAnatomy);
          await this.trace(
            "query_community",
            `${res.item.canonicalName}: ${c.matchingAnatomy.hurt}/${c.matchingAnatomy.total} "hurt" with ${c.anatomyLabel}${
              c.includesSynthetic ? " (includes demo data)" : ""
            }`,
          );
          return ok({
            item: res.item.canonicalName,
            userAnatomy: c.anatomyLabel,
            matchingAnatomy: c.matchingAnatomy,
            otherAnatomies: c.other,
            byAnatomy: c.byAnatomy,
            includesSynthetic: c.includesSynthetic,
            note: "Self-reported, not a trial. Cite as [C:<n>/<total>, <anatomy label>].",
          });
        }
        case "query_my_log": {
          const a = ItemArgs.safeParse(block.input);
          if (!a.success) return err("item is required");
          const rows: { item: string; outcome: string; when: number }[] = await this.ctx.runQuery(
            internal.community.myLogForItem,
            { profileId: this.profileId, name: a.data.item },
          );
          await this.trace("query_my_log", `"${a.data.item}": ${rows.length} of your own entries`);
          return ok({ entries: rows.map((r) => ({ item: r.item, outcome: r.outcome, date: new Date(r.when).toISOString().slice(0, 10) })) });
        }
        case "submit_answer": {
          const parsed = AnswerSchema.safeParse(block.input);
          if (!parsed.success) return err(`Invalid answer JSON: ${parsed.error.message.slice(0, 500)}`);
          const lint = lintAnswer(parsed.data, this.reg);
          if (lint.blocking.length > 0 && this.lintRetries < 2) {
            this.lintRetries++;
            await this.trace("safety_lint", `sent back for fixes: ${lint.blocking.join("; ")}`, false);
            return err(`Fix these and call submit_answer again: ${lint.issues.join("; ")}`);
          }
          this.submitted = parsed.data;
          await this.trace("submit_answer", `draft ready (${parsed.data.why.length} cited claims, confidence ${parsed.data.confidence})`);
          return ok({ received: true });
        }
        default:
          return err(`unknown tool ${block.name}`);
      }
    } catch (e) {
      await this.trace(block.name, `error: ${(e as Error).message}`, false);
      return err(`tool failed: ${(e as Error).message}`);
    }
  }
}

async function readPhoto(url: string) {
  const client = anthropicClient(env);
  const res = await client.messages.parse({
    model: fastModel(env),
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

function unidentifiedDraft(reason: string): Answer {
  return {
    state: "cant-tell",
    verdict: `I couldn't identify this confidently (${reason}).`,
    why: [],
    swapToAskAbout: null,
    community: null,
    careTeamAnswers: [],
    personal: [],
    diagram: null,
    sourcesChecked: ["your photo"],
    ask: "ASK: Can you confirm the exact product name and release type printed on my medicine's label?",
    confidence: "low",
    unidentified: true,
  };
}

export const run = internalAction({
  args: { answerId: v.id("answers") },
  handler: async (ctx, args): Promise<null> => {
    const started = Date.now();
    const claimed: boolean = await ctx.runMutation(internal.answers.markRunning, { answerId: args.answerId });
    if (!claimed) return null;
    try {
      const data: {
        answer: Doc<"answers">;
        parent: { final: unknown; identified: string | null; inputText: string | null } | null;
      } | null = await ctx.runQuery(internal.answers.getForAgent, { answerId: args.answerId });
      if (!data) return null;
      const { answer, parent } = data;
      const profile: Profile | null = await ctx.runQuery(internal.profiles.getById, { profileId: answer.profileId });
      if (!profile) throw new Error("profile missing");

      const agent = new Agent(ctx, args.answerId, answer.profileId, profile);
      await agent.trace("get_profile", `${profile.anatomyText}; ${profile.meds.length} meds on file; language ${profile.language}`);

      // 1. Identify the item. Photos are read, then deleted.
      let itemName = answer.kind === "followup" ? (parent?.identified ?? parent?.inputText ?? "") : (answer.input.text ?? "");
      let category = answer.input.category ?? "pill";
      if (answer.kind === "scan" && answer.input.photoId) {
        const url = await ctx.storage.getUrl(answer.input.photoId);
        const seen = url ? await readPhoto(url) : null;
        if (seen?.legible && seen.name) {
          // The model often repeats release wording and strength inside the name.
          itemName = [seen.name, seen.releaseText, seen.strength].reduce<string>((acc, part) => {
            if (!part || acc.toLowerCase().replace(/\s+/g, "").includes(part.toLowerCase().replace(/\s+/g, ""))) return acc;
            return `${acc} ${part}`.trim();
          }, "");
          if (seen.kind !== "unknown") category = seen.kind;
          await agent.trace("read_photo", `read "${itemName}" (${seen.kind})`);
        } else {
          await agent.trace("read_photo", "could not read a product name", false);
        }
        await ctx.runMutation(internal.answers.setIdentified, {
          answerId: args.answerId,
          identified: itemName || "unreadable photo",
          clearPhoto: true,
        });
      } else if (answer.kind === "scan") {
        await ctx.runMutation(internal.answers.setIdentified, { answerId: args.answerId, identified: itemName, clearPhoto: false });
      }

      if (!itemName) {
        await ctx.runMutation(internal.answers.saveDraft, {
          answerId: args.answerId,
          draft: unidentifiedDraft("the name on the label wasn't readable; try a closer photo or type the name"),
          registry: agent.reg,
        });
        return null;
      }
      agent.reg.allowedStrengths.push(...strengthsIn(itemName));

      // 2. Prefetch the label server-side so the first model turn already has it.
      const label = category === "pill" ? await agent.fetchLabel(itemName) : null;

      const context = {
        profile: {
          role: profile.role,
          anatomy: profile.anatomyText,
          anatomyGroup: profile.anatomyKey,
          language: profile.language,
          medsOnFile: profile.meds,
        },
        item: { asEntered: itemName, category },
        fdaLabel: label ? labelForModel(label) : null,
        followUp:
          answer.kind === "followup"
            ? { question: answer.input.text, previousAnswer: parent?.final ?? null }
            : null,
      };
      const userText =
        answer.kind === "followup"
          ? `Follow-up question about ${itemName}: "${answer.input.text}". Answer it under the same rules, re-reading the label sections and guidelines.`
          : `Can a body like this one use ${itemName}?`;

      const client = anthropicClient(env);
      const messages: Anthropic.MessageParam[] = [
        {
          role: "user",
          content: [
            { type: "text", text: `<context>\n${JSON.stringify(context)}\n</context>` },
            { type: "text", text: userText },
          ],
        },
      ];

      // 3. Tool loop. Content is appended untouched so thinking blocks stay valid.
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        if (Date.now() - started > DEADLINE_MS) throw new Error("agent deadline exceeded");
        const res = await client.messages.create({
          model: mainModel(env),
          max_tokens: 16000,
          system: [{ type: "text", text: AGENT_SYSTEM, cache_control: { type: "ephemeral" } }],
          tools: TOOLS,
          output_config: { effort: "medium" },
          messages,
        });
        if (res.stop_reason === "refusal") {
          throw new Error("The model declined to answer this one. Try rephrasing, or ask your pharmacist directly.");
        }
        if (res.stop_reason === "max_tokens") throw new Error("answer ran too long");
        messages.push({ role: "assistant", content: res.content });
        const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        if (uses.length === 0) {
          messages.push({ role: "user", content: "Please finish by calling submit_answer." });
          continue;
        }
        const results = await Promise.all(uses.map((u) => agent.exec(u)));
        if (agent.submitted) {
          await ctx.runMutation(internal.answers.saveDraft, {
            answerId: args.answerId,
            draft: agent.submitted,
            registry: agent.reg,
          });
          await agent.trace("reviewer", "scheduled safety review");
          return null;
        }
        messages.push({ role: "user", content: results });
      }
      throw new Error("agent did not finish");
    } catch (e) {
      await ctx.runMutation(internal.answers.fail, {
        answerId: args.answerId,
        error: (e as Error).message,
      });
      return null;
    }
  },
});
