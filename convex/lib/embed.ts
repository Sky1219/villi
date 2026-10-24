// Voyage embeddings via plain fetch. Callers must handle errors and fall back
// to full-text search; the demo has to work when Voyage is down or rate-limited.

export const VOYAGE_MODEL = "voyage-4-lite";
export const VOYAGE_DIMS = 1024;

export async function voyageEmbed(
  apiKey: string,
  texts: string[],
  inputType: "query" | "document",
): Promise<number[][]> {
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: texts,
        input_type: inputType,
        output_dimension: VOYAGE_DIMS,
      }),
    });
    if (res.ok) {
      const body = (await res.json()) as {
        data: { embedding: number[]; index: number }[];
      };
      const out: number[][] = new Array(texts.length);
      for (const d of body.data) out[d.index] = d.embedding;
      for (const e of out) {
        if (!e || e.length !== VOYAGE_DIMS) {
          throw new Error(`voyage returned wrong dimension`);
        }
      }
      return out;
    }
    lastErr = `voyage ${res.status}`;
    // Only retry rate limits and server errors.
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(lastErr);
}

// Small stable string hash (FNV-1a) so re-seeding skips unchanged chunks.
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
