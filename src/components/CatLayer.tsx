"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SEGMENTS, type DiagramState, type SegmentId } from "@convex/lib/anatomy";
import { particleStory, type Compartment, type Formulation, type PermeabilityClass } from "@convex/lib/cat";
import { PATHS } from "./gutPaths";

// The illustrative CAT model told on the gut diagram: one typical tablet moving at
// mean pace, drug particles leaving it, fading at removed gaps, taken up where the
// bowel can absorb, or leaving at the stoma. The whole story plays in under 2 s;
// with reduced motion it shows the end state only. No numbers are drawn.
const DURATION_MS = 1800;
const SAMPLES = 64;
const FADE = 0.25; // share of a compartment over which drug fades beside a removed gap
const CENTER: [number, number] = [160, 185];

type Pt = [number, number];
type Geometry = Record<SegmentId, { pts: Pt[]; len: number }>;

function pointOn(g: Geometry, seg: SegmentId, f: number): Pt {
  const pts = g[seg].pts;
  const x = Math.min(1, Math.max(0, f)) * SAMPLES;
  const i = Math.min(SAMPLES - 1, Math.floor(x));
  const k = x - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
}

function compPoint(g: Geometry, c: Compartment, u: number): Pt {
  const lens = c.spans.map((s) => g[s.segment].len * (s.to - s.from));
  let rest = Math.min(1, Math.max(0, u)) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < c.spans.length; i++) {
    const s = c.spans[i];
    if (rest <= lens[i] || i === c.spans.length - 1) {
      return pointOn(g, s.segment, s.from + (s.to - s.from) * (lens[i] ? rest / lens[i] : 1));
    }
    rest -= lens[i];
  }
  return [0, 0];
}

// Offset across the bowel's width so particles don't ride one line.
function across(g: Geometry, c: Compartment, u: number, jitter: number): Pt {
  const [x0, y0] = compPoint(g, c, u - 0.02);
  const [x1, y1] = compPoint(g, c, u + 0.02);
  const [x, y] = compPoint(g, c, u);
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const w = PATHS[c.spans[0].segment].w * 0.3 * jitter;
  return [x - ((y1 - y0) / len) * w, y + ((x1 - x0) / len) * w];
}

type Props = {
  diagram: DiagramState;
  formulation: Formulation;
  permeabilityClass: PermeabilityClass;
  playKey: number;
};

export function CatLayer({ diagram, formulation, permeabilityClass, playKey }: Props) {
  const story = useMemo(
    () => particleStory(diagram, formulation, permeabilityClass),
    [diagram, formulation, permeabilityClass],
  );
  const measureRefs = useRef<Partial<Record<SegmentId, SVGPathElement | null>>>({});
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const tabletRef = useRef<SVGCircleElement | null>(null);
  const groupRef = useRef<SVGGElement | null>(null);
  const geometryRef = useRef<Geometry | null>(null);
  const [inView, setInView] = useState(false);

  // Sampled once from the drawn paths, so each frame is cheap arithmetic.
  const measure = (): Geometry | null => {
    const g = {} as Geometry;
    for (const s of SEGMENTS) {
      const el = measureRefs.current[s];
      if (!el) return null;
      const len = el.getTotalLength();
      g[s] = {
        len,
        pts: Array.from({ length: SAMPLES + 1 }, (_, i) => {
          const p = el.getPointAtLength((len * i) / SAMPLES);
          return [p.x, p.y] as Pt;
        }),
      };
    }
    return g;
  };

  // Play when the diagram is actually on screen.
  useEffect(() => {
    const el = groupRef.current?.ownerSVGElement;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const { chain, tablet, tabletExitT, particles, endT } = story;
    geometryRef.current ??= measure();
    const g = geometryRef.current;
    if (!g || !chain.length) return;
    const idx = (c: Compartment, end: "first" | "last") =>
      SEGMENTS.indexOf(c.spans[end === "first" ? 0 : c.spans.length - 1].segment);
    const gapAfter = chain.map((c, i) => i + 1 < chain.length && idx(chain[i + 1], "first") - idx(c, "last") > 1);
    const gapBefore = chain.map((_, i) => i > 0 && gapAfter[i - 1]);
    const exit = compPoint(g, chain[chain.length - 1], 1);
    const out = [exit[0] - CENTER[0], exit[1] - CENTER[1]];
    const outLen = Math.hypot(out[0], out[1]) || 1;
    const pileC: Pt = [
      Math.min(300, Math.max(20, exit[0] + (out[0] / outLen) * 22)),
      Math.min(350, Math.max(20, exit[1] + (out[1] / outLen) * 22)),
    ];
    const pile = (k: number): Pt => [pileC[0] + 3.6 * Math.sqrt(k) * Math.cos(k * 2.4), pileC[1] + 3.6 * Math.sqrt(k) * Math.sin(k * 2.4)];
    const tail = Math.max(0.05 * endT, 0.05);
    const lerp = (a: Pt, b: Pt, k: number): Pt => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    let piled = 0;
    const pileSlot = particles.map((p) => (p.fate === "exited" || p.fate === "unreleased" ? piled++ : -1));

    const set = (el: SVGCircleElement | null, at: Pt, r: number, op: number, fill: string, stroke = "none") => {
      if (!el) return;
      el.setAttribute("cx", at[0].toFixed(1));
      el.setAttribute("cy", at[1].toFixed(1));
      el.setAttribute("r", String(r));
      el.setAttribute("opacity", op.toFixed(2));
      el.setAttribute("fill", fill);
      el.setAttribute("stroke", stroke);
    };
    const hide = (el: SVGCircleElement | null) => el?.setAttribute("opacity", "0");

    const draw = (t: number) => {
      particles.forEach((p, k) => {
        const el = dotRefs.current[k];
        const toPile = (from: number, fill: string, stroke: string) => {
          const f = Math.min(1, (t - from) / tail);
          set(el, lerp(exit, pile(pileSlot[k]), f), 2.6, 1 - 0.45 * f, fill, stroke);
        };
        if (p.releaseT === null) {
          // Still inside the tablet: it leaves with it.
          if (t < tabletExitT) hide(el);
          else toPile(tabletExitT, "var(--surface)", "var(--muted)");
          return;
        }
        if (t < p.releaseT) return hide(el);
        if (t >= p.fateT && p.fate === "absorbed") {
          return set(el, across(g, chain[p.fateComp], p.fateU, p.jitter), 2.8, 0.9, "var(--ok)", "var(--surface)");
        }
        if (t >= p.fateT && p.fate === "exited") return toPile(p.fateT, "var(--removed)", "none");
        const leg = p.legs.find((l) => t < l.tExit) ?? p.legs[p.legs.length - 1];
        if (!leg) return hide(el);
        const u = leg.uStart + (1 - leg.uStart) * Math.min(1, (t - leg.tEnter) / (leg.tExit - leg.tEnter));
        let op = 1;
        if (gapAfter[leg.comp] && u > 1 - FADE) op = 0.15 + 0.85 * ((1 - u) / FADE);
        if (gapBefore[leg.comp] && u < FADE) op = Math.min(op, 0.15 + 0.85 * (u / FADE));
        set(el, across(g, chain[leg.comp], u, p.jitter), 3, op, "var(--info)");
      });
      const load = particles.filter((p) => p.releaseT === null || p.releaseT > t).length / particles.length;
      const leg = tablet.find((l) => t < l.tExit);
      if (!leg || load === 0) return hide(tabletRef.current);
      const u = (t - leg.tEnter) / (leg.tExit - leg.tEnter);
      set(tabletRef.current, compPoint(g, chain[leg.comp], u), 3 + 5 * Math.sqrt(load), 1, "var(--foreground)", "var(--surface)");
    };

    // Run past the end by one tail so the last particles settle into the pile.
    const finalT = endT + tail;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(finalT);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      draw(finalT * p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, story, playKey]);

  return (
    <g ref={groupRef} aria-hidden pointerEvents="none">
      {SEGMENTS.map((s) => (
        <path
          key={s}
          ref={(el) => {
            measureRefs.current[s] = el;
          }}
          d={PATHS[s].d}
          fill="none"
          stroke="none"
        />
      ))}
      {story.particles.map((_, k) => (
        <circle
          key={k}
          ref={(el) => {
            dotRefs.current[k] = el;
          }}
          r={0}
          opacity={0}
          strokeWidth={1.5}
        />
      ))}
      <circle ref={tabletRef} r={0} opacity={0} strokeWidth={2} />
    </g>
  );
}
