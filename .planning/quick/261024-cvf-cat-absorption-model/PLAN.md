---
quick_id: 261024-cvf
slug: cat-absorption-model
date: 2026-10-24
---

# Illustrative CAT absorption model on the gut diagram

An illustration of why a formulation is a concern for this anatomy. It explains; it never predicts.

1. `convex/lib/cat.ts` (pure, shared by server and client): compartmental absorption and transit after
   Yu & Amidon 1996. Stomach + 7 equal small-intestine compartments (duodenum 1, jejunum 2, ileum 4) + colon.
   First-order transit (SI ~3.3 h), release by formulation (IR first-order fast; ER zero-order over 10 h;
   DR none until past the stomach), per-compartment uptake scaled by permeability class (high/medium/low/unknown).
   Anatomy: removed segments delete compartments, a stoma truncates the chain, no colon = shorter residence.
   Outputs normalized `released(t)` and `exposed(t)` curves plus per-frame positions for animation.
   `captionFor()` picks fixed, digit-free caption text by rule (or null: no illustration).
   Tests (`convex/lib/cat.test.ts`): baseline vs analytic Fa = 1-(1+ka*T/7)^-7, mass balance, and
   end-jejunostomy, jejuno-colic, colostomy cases; every caption digit-free.
2. Answer JSON gets `simulation: { formulation, permeabilityClass, citation, caption? } | null`.
   Agent fills formulation + [G:]/[L:] citation; code owns permeabilityClass (drug table, else unknown) and
   the caption. Lint: non-G/L or unretrieved citation drops it; formulation must match fetch_label's release
   form; a caption with digits or not equal to the rule's caption blocks. Reviewer prompt treats the caption
   as a cited factual claim and blocks numeric language.
3. `GutDiagram` animation (runs < 2 s, reduced-motion shows the end state): released drug dots move along the
   chain, fade over removed parts, exit at the stoma. Fixed caption, the one-line model label, and a
   "Why this is only an illustration" expander. No numbers anywhere.
4. Eval: `eval/planted.eval.ts` plants a numeric caption into a draft and asserts the review pipeline blocks it.
