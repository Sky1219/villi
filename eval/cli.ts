// Model calls through the local Claude Code CLI (`claude -p`) instead of the
// Anthropic API, billed to the logged-in claude.ai account. Used by the grader
// and, with EVAL_TRANSPORT=cli, by the pipeline runner's fetch shim.
import { spawn } from "node:child_process";

export type CliUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };
export class CliLimitError extends Error {}

const MAX_PROCS = Number(process.env.EVAL_CLI_PROCS ?? "8");
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(f: () => Promise<T>): Promise<T> {
  if (running >= MAX_PROCS) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await f();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

export async function claudeCli(opts: {
  system: string;
  prompt: string;
  schema: unknown;
  model: string;
  effort?: string;
}): Promise<{ output: unknown; usage: CliUsage }> {
  return slot(
    () =>
      new Promise((resolve, reject) => {
        const args = [
          "-p",
          "--model", opts.model,
          "--effort", opts.effort ?? "medium",
          "--system-prompt", opts.system,
          "--tools", "",
          "--strict-mcp-config",
          "--setting-sources", "",
          "--no-session-persistence",
          "--output-format", "json",
          "--json-schema", JSON.stringify(opts.schema),
        ];
        // No shell: arguments go to the process as-is. Run outside the repo so no
        // project CLAUDE.md or hooks leak into the call.
        const child = spawn("claude", args, {
          cwd: process.env.TEMP ?? process.env.TMPDIR ?? "/tmp",
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d));
        child.stderr.on("data", (d) => (err += d));
        child.on("error", reject);
        child.on("close", () => {
          let j: {
            is_error?: boolean;
            result?: string;
            structured_output?: unknown;
            api_error_status?: number | null;
            usage?: Record<string, number>;
          };
          try {
            j = JSON.parse(out);
          } catch {
            return reject(new Error(`claude -p returned no JSON: ${(err || out).slice(0, 300)}`));
          }
          if (j.is_error || j.structured_output === undefined) {
            const msg = `${j.result ?? ""} ${err}`.slice(0, 400);
            if (/limit|quota|usage/i.test(msg) && !/schema/i.test(msg)) return reject(new CliLimitError(msg));
            return reject(new Error(`claude -p error (${j.api_error_status ?? "?"}): ${msg}`));
          }
          resolve({
            output: j.structured_output,
            usage: {
              input: j.usage?.input_tokens ?? 0,
              output: j.usage?.output_tokens ?? 0,
              cacheRead: j.usage?.cache_read_input_tokens ?? 0,
              cacheWrite: j.usage?.cache_creation_input_tokens ?? 0,
            },
          });
        });
        child.stdin.end(opts.prompt);
      }),
  );
}

// ---- Messages API emulation for the pipeline runner

type Block = { type: string; [k: string]: unknown };
type Msg = { role: "user" | "assistant"; content: string | Block[] };
type Tool = { name: string; description?: string; input_schema: Record<string, unknown> };
type Req = {
  model: string;
  system?: string | { type: "text"; text: string }[];
  messages: Msg[];
  tools?: Tool[];
  output_config?: { effort?: string; format?: { type: string; schema: unknown } };
};

const systemText = (s: Req["system"]) => (typeof s === "string" ? s : (s ?? []).map((b) => b.text).join("\n"));

function renderBlock(b: Block): string {
  if (b.type === "text") return String(b.text);
  if (b.type === "tool_use") return `<tool_call id="${b.id}" name="${b.name}">${JSON.stringify(b.input)}</tool_call>`;
  if (b.type === "tool_result") {
    const c = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
    return `<tool_result for="${b.tool_use_id}"${b.is_error ? ' is_error="true"' : ""}>${c}</tool_result>`;
  }
  return `[${b.type} omitted]`;
}

function renderConversation(messages: Msg[]): string {
  if (messages.length === 1 && messages[0].role === "user") {
    const c = messages[0].content;
    return typeof c === "string" ? c : c.map(renderBlock).join("\n\n");
  }
  return messages
    .map((m) => `<${m.role}>\n${typeof m.content === "string" ? m.content : m.content.map(renderBlock).join("\n\n")}\n</${m.role}>`)
    .join("\n\n");
}

const TOOL_PROTOCOL = (tools: Tool[]) => `

## Tool calling
You are in a tool-use loop. The conversation so far is given as <user> and <assistant> turns; your earlier tool calls appear as <tool_call> and their results as <tool_result>. Reply with the JSON object {"calls": [...]}: one or more tool calls to run now (independent calls together, in parallel). Each call is {"name": <tool>, "input": <arguments matching that tool's schema>}. Results come back in the next turn. Calling submit_answer ends the task.
Available tools:
${tools.map((t) => `- ${t.name}: ${t.description ?? ""}\n  input schema: ${JSON.stringify(t.input_schema)}`).join("\n")}`;

function callsSchema(tools: Tool[]) {
  return {
    type: "object",
    properties: {
      calls: {
        type: "array",
        items: {
          anyOf: tools.map((t) => ({
            type: "object",
            properties: { name: { type: "string", enum: [t.name] }, input: t.input_schema },
            required: ["name", "input"],
            additionalProperties: false,
          })),
        },
      },
    },
    required: ["calls"],
    additionalProperties: false,
  };
}

let idSeq = 0;

// Returns a body shaped like a Messages API response.
export async function emulateMessages(req: Req): Promise<{ body: Record<string, unknown>; usage: CliUsage }> {
  const effort = req.output_config?.effort ?? "medium";
  const usageOut = (u: CliUsage) => ({
    input_tokens: u.input,
    output_tokens: u.output,
    cache_read_input_tokens: u.cacheRead,
    cache_creation_input_tokens: u.cacheWrite,
  });
  const base = { id: `msg_cli_${Date.now()}_${idSeq++}`, type: "message", role: "assistant", model: req.model, stop_sequence: null };

  if (req.tools?.length) {
    const { output, usage } = await claudeCli({
      system: systemText(req.system) + TOOL_PROTOCOL(req.tools),
      prompt: renderConversation(req.messages),
      schema: callsSchema(req.tools),
      model: req.model,
      effort,
    });
    const calls = (output as { calls: { name: string; input: unknown }[] }).calls ?? [];
    const content = calls.map((c) => ({ type: "tool_use", id: `toolu_cli_${Date.now()}_${idSeq++}`, name: c.name, input: c.input }));
    return {
      body: { ...base, content: content.length ? content : [{ type: "text", text: "" }], stop_reason: content.length ? "tool_use" : "end_turn", usage: usageOut(usage) },
      usage,
    };
  }
  const schema = req.output_config?.format?.schema;
  if (!schema) throw new Error("cli transport only emulates tool calls and structured outputs");
  const { output, usage } = await claudeCli({ system: systemText(req.system), prompt: renderConversation(req.messages), schema, model: req.model, effort });
  return { body: { ...base, content: [{ type: "text", text: JSON.stringify(output) }], stop_reason: "end_turn", usage: usageOut(usage) }, usage };
}
