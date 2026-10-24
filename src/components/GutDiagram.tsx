"use client";

import { SEGMENT_LABELS, SEGMENTS, describeDiagram, type SegmentId } from "@convex/lib/anatomy";

export type HighlightMode = "absorbs-here" | "releases-here" | "missing";

type Props = {
  removed: SegmentId[];
  stoma?: { afterSegment: SegmentId } | null;
  highlight?: { segmentIds: SegmentId[]; label: string; mode: HighlightMode } | null;
  interactive?: boolean;
  onToggle?: (id: SegmentId) => void;
  size?: "full" | "badge";
  className?: string;
};

// Flat, friendly, not anatomically exact. Order matters: colon first so the
// small bowel and stomach draw on top where they cross.
const PATHS: Record<SegmentId, { d: string; w: number; end: [number, number] }> = {
  "ascending-colon": { d: "M288 322 L288 146", w: 20, end: [288, 146] },
  "transverse-colon": { d: "M288 146 C288 138 282 134 272 134 L50 134 C40 134 34 140 34 148", w: 20, end: [34, 148] },
  "descending-sigmoid": { d: "M34 148 L34 300 C34 330 70 344 110 336 C128 332 140 338 146 352", w: 20, end: [146, 352] },
  cecum: { d: "M258 322 C266 336 284 338 288 322", w: 20, end: [288, 322] },
  stomach: { d: "M96 34 C70 34 58 70 76 94 C92 114 132 114 156 102 C174 92 184 78 196 70", w: 28, end: [196, 70] },
  duodenum: { d: "M196 70 C214 78 220 100 208 118 C198 132 184 138 178 154", w: 14, end: [178, 154] },
  jejunum: { d: "M178 154 C210 152 240 160 234 178 C228 196 112 188 106 206 C100 224 214 216 222 234", w: 16, end: [222, 234] },
  ileum: { d: "M222 234 C230 254 110 248 108 266 C106 286 214 280 226 298 C234 310 246 318 258 322", w: 16, end: [258, 322] },
};

const DRAW_ORDER: SegmentId[] = [
  "ascending-colon",
  "transverse-colon",
  "descending-sigmoid",
  "cecum",
  "ileum",
  "jejunum",
  "duodenum",
  "stomach",
];

const MODE_COLOR: Record<HighlightMode, string> = {
  "absorbs-here": "var(--ok)",
  "releases-here": "var(--info)",
  missing: "var(--flag)",
};

export function GutDiagram({ removed, stoma, highlight, interactive = false, onToggle, size = "full", className = "" }: Props) {
  const isRemoved = (s: SegmentId) => removed.includes(s);
  const lit = new Set(highlight?.segmentIds ?? []);
  const summary = describeDiagram({ removed, stomaAfter: stoma?.afterSegment ?? null });
  const badge = size === "badge";

  return (
    <figure className={className}>
      <svg
        viewBox="0 0 320 370"
        className={badge ? "h-14 w-12" : "mx-auto block w-full max-w-[320px]"}
        role={interactive ? "group" : "img"}
        aria-label={`Diagram of the digestive tract. ${summary}${highlight ? ` Highlighted: ${highlight.label}` : ""}`}
      >
        {DRAW_ORDER.map((id) => {
          const p = PATHS[id];
          const gone = isRemoved(id);
          return (
            <g key={id}>
              <path
                id={id}
                d={p.d}
                fill="none"
                stroke={gone ? "var(--removed)" : "var(--segment)"}
                strokeWidth={gone ? 4 : p.w}
                strokeLinecap={gone ? "butt" : "round"}
                strokeLinejoin="round"
                strokeDasharray={gone ? "9 7" : undefined}
              />
              {lit.has(id) && highlight && (
                <path
                  d={p.d}
                  fill="none"
                  stroke={MODE_COLOR[highlight.mode]}
                  // Over a removed part, a dashed line says "where it would be", never a solid organ.
                  strokeWidth={gone ? 7 : p.w + 8}
                  strokeLinecap={gone ? "butt" : "round"}
                  strokeDasharray={gone ? "10 6" : undefined}
                  opacity={gone ? 1 : 0.55}
                  className="motion-safe:animate-[villi-pulse_1.8s_ease-in-out_infinite]"
                />
              )}
              {interactive && (
                <path
                  d={p.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(30, p.w + 14)}
                  strokeLinecap="round"
                  role="button"
                  tabIndex={0}
                  aria-pressed={gone}
                  aria-label={`${SEGMENT_LABELS[id]}: ${gone ? "marked removed" : "still there"}. Tap to change.`}
                  className="cursor-pointer outline-none focus-visible:stroke-[var(--focus)]"
                  onClick={() => onToggle?.(id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggle?.(id);
                    }
                  }}
                />
              )}
            </g>
          );
        })}
        {stoma && (
          <g aria-hidden>
            <circle cx={PATHS[stoma.afterSegment].end[0]} cy={PATHS[stoma.afterSegment].end[1]} r={badge ? 16 : 11} fill="var(--accent)" stroke="var(--surface)" strokeWidth={4} />
            {!badge && (
              <text
                x={PATHS[stoma.afterSegment].end[0] + (PATHS[stoma.afterSegment].end[0] > 160 ? -16 : 16)}
                y={PATHS[stoma.afterSegment].end[1] + 4}
                textAnchor={PATHS[stoma.afterSegment].end[0] > 160 ? "end" : "start"}
                fontSize="15"
                fontWeight="700"
                fill="var(--foreground)"
                paintOrder="stroke"
                stroke="var(--surface)"
                strokeWidth={4}
              >
                stoma
              </text>
            )}
          </g>
        )}
      </svg>
      {!badge && highlight && (
        <figcaption className="mt-2 flex items-start gap-2 text-sm">
          <span aria-hidden className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: MODE_COLOR[highlight.mode] }} />
          <span>{highlight.label}</span>
        </figcaption>
      )}
      {!badge && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted">
          <svg aria-hidden width="28" height="8">
            <line x1="0" y1="4" x2="28" y2="4" stroke="var(--removed)" strokeWidth="3" strokeDasharray="6 4" />
          </svg>
          dashed = removed
        </p>
      )}
    </figure>
  );
}

export { SEGMENTS };
