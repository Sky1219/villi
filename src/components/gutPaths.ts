import type { SegmentId } from "@convex/lib/anatomy";

// Flat, friendly, not anatomically exact. Each path runs in the direction of flow.
export const PATHS: Record<SegmentId, { d: string; w: number; end: [number, number] }> = {
  "ascending-colon": { d: "M288 322 L288 146", w: 20, end: [288, 146] },
  "transverse-colon": { d: "M288 146 C288 138 282 134 272 134 L50 134 C40 134 34 140 34 148", w: 20, end: [34, 148] },
  "descending-sigmoid": { d: "M34 148 L34 300 C34 330 70 344 110 336 C128 332 140 338 146 352", w: 20, end: [146, 352] },
  cecum: { d: "M258 322 C266 336 284 338 288 322", w: 20, end: [288, 322] },
  stomach: { d: "M96 34 C70 34 58 70 76 94 C92 114 132 114 156 102 C174 92 184 78 196 70", w: 28, end: [196, 70] },
  duodenum: { d: "M196 70 C214 78 220 100 208 118 C198 132 184 138 178 154", w: 14, end: [178, 154] },
  jejunum: { d: "M178 154 C210 152 240 160 234 178 C228 196 112 188 106 206 C100 224 214 216 222 234", w: 16, end: [222, 234] },
  ileum: { d: "M222 234 C230 254 110 248 108 266 C106 286 214 280 226 298 C234 310 246 318 258 322", w: 16, end: [258, 322] },
};
