"use client";

import { useState, type ReactNode } from "react";
import { SEGMENT_LABELS, SEGMENTS, describeDiagram, type SegmentId } from "@convex/lib/anatomy";
import { MODEL_IGNORES, MODEL_LABEL, type Formulation, type PermeabilityClass } from "@convex/lib/cat";
import { CatLayer } from "./CatLayer";
import { PATHS } from "./gutPaths";

export type HighlightMode = "absorbs-here" | "releases-here" | "missing";

type Props = {
  removed: SegmentId[];
  stoma?: { afterSegment: SegmentId } | null;
  highlight?: { segmentIds: SegmentId[]; label: string; mode: HighlightMode } | null;
  interactive?: boolean;
  onToggle?: (id: SegmentId) => void;
  size?: "full" | "badge";
  className?: string;
  // Illustrative CAT animation (full size only). `citations` renders under its caption.
  simulation?: { formulation: Formulation; permeabilityClass: PermeabilityClass; caption: string } | null;
  citations?: ReactNode;
};

// Order matters: colon first so the small bowel and stomach draw on top where they cross.

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

export function GutDiagram({
  removed,
  stoma,
  highlight,
  interactive = false,
  onToggle,
  size = "full",
  className = "",
  simulation,
  citations,
}: Props) {
  const [playKey, setPlayKey] = useState(0);
  const isRemoved = (s: SegmentId) => removed.includes(s);
  const lit = new Set(highlight?.segmentIds ?? []);
  const summary = describeDiagram({ removed, stomaAfter: stoma?.afterSegment ?? null });
  const badge = size === "badge";
  const sim = badge ? null : (simulation ?? null);

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
        {sim && (
          <CatLayer
            diagram={{ removed, stomaAfter: stoma?.afterSegment ?? null }}
            formulation={sim.formulation}
            permeabilityClass={sim.permeabilityClass}
            playKey={playKey}
          />
        )}
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
      {sim && (
        <div className="mt-3 space-y-2 text-sm">
          <p>{sim.caption}</p>
          {citations}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <li className="flex items-center gap-1.5">
              <svg aria-hidden width="10" height="10"><circle cx="5" cy="5" r="4" fill="var(--info)" /></svg>
              drug released from the tablet
            </li>
            <li className="flex items-center gap-1.5">
              <svg aria-hidden width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="var(--ok)" /></svg>
              reached bowel that can absorb it
            </li>
            <li className="flex items-center gap-1.5">
              <svg aria-hidden width="10" height="10"><circle cx="5" cy="5" r="3.5" fill="var(--surface)" stroke="var(--muted)" strokeWidth="1.5" /></svg>
              left the body still in the tablet
            </li>
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">{MODEL_LABEL}</p>
            <button
              type="button"
              onClick={() => setPlayKey((k) => k + 1)}
              className="min-h-11 rounded-full px-3 text-xs font-bold text-info motion-reduce:hidden"
            >
              Play again
            </button>
          </div>
          <details className="rounded-xl bg-surface-2 px-3 text-xs">
            <summary className="flex min-h-11 cursor-pointer items-center font-bold">Why this is only an illustration</summary>
            <div className="space-y-1 pb-3">
              <p>This drawing follows a simple textbook model of how a tablet moves through the gut and releases its medicine. It leaves out:</p>
              <ul className="list-disc space-y-1 pl-5">
                {MODEL_IGNORES.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p>It shows why the release form matters for this anatomy. It cannot say how much of a medicine your body takes in.</p>
            </div>
          </details>
        </div>
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
