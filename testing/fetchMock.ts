// Test-only fetch double for Anthropic, openFDA and Voyage. Each Anthropic call
// is answered by the next scripted reply; anything unscripted fails loudly.
import { vi } from "vitest";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

export type ClaudeReply = Block[] | ((body: { system?: unknown; messages: unknown[]; tools?: unknown[] }) => Block[] | Error);

export type FetchScript = {
  claude?: ClaudeReply[];
  // openFDA label/NDC responses by URL substring; unmatched openFDA calls return 404.
  fda?: { match: string; body: unknown }[];
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const text = (value: unknown): Block[] => [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }];
export const toolUse = (name: string, input: unknown, id = `toolu_${name}_${Math.random().toString(36).slice(2, 8)}`): Block => ({
  type: "tool_use",
  id,
  name,
  input,
});

export function installFetch(script: FetchScript) {
  const claude = [...(script.claude ?? [])];
  const calls: { url: string; body: unknown }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const raw = init?.body ?? (input instanceof Request ? await input.text() : undefined);
    const body = typeof raw === "string" && raw.startsWith("{") ? JSON.parse(raw) : raw;
    calls.push({ url, body });
    if (url.includes("api.anthropic.com")) {
      const next = claude.shift();
      if (!next) return json(500, { type: "error", error: { type: "api_error", message: "no scripted Claude reply" } });
      const content = typeof next === "function" ? next(body) : next;
      if (content instanceof Error) return json(400, { type: "error", error: { type: "invalid_request_error", message: content.message } });
      return json(200, {
        id: `msg_${calls.length}`,
        type: "message",
        role: "assistant",
        model: "claude-test",
        content,
        stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      });
    }
    if (url.includes("api.fda.gov")) {
      const hit = script.fda?.find((f) => url.includes(f.match));
      return hit ? json(200, hit.body) : json(404, { error: { code: "NOT_FOUND", message: "No matches found!" } });
    }
    if (url.includes("voyageai.com")) return json(500, { detail: "voyage disabled in tests" });
    return json(500, { error: `unexpected fetch ${url}` });
  });
  vi.stubGlobal("fetch", fn);
  return { calls, remainingClaude: () => claude.length };
}
