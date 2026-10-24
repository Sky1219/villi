"use client";

import { ANATOMY_KEY_EXAMPLE, defaultDiagram, type AnatomyKey } from "@convex/lib/anatomy";
import { GutDiagram } from "@/components/GutDiagram";

// Small static gut drawing so "people like you" is visible at a glance.
export function AnatomyBadge({ anatomyKey }: { anatomyKey: string }) {
  const example = ANATOMY_KEY_EXAMPLE[anatomyKey as AnatomyKey];
  if (!example) return null;
  const d = defaultDiagram(example);
  return <GutDiagram size="badge" removed={d.removed} stoma={d.stomaAfter ? { afterSegment: d.stomaAfter } : null} />;
}
