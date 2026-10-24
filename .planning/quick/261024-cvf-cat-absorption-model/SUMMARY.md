---
quick_id: 261024-cvf
slug: cat-absorption-model
date: 2026-10-24
status: complete
---

# Illustrative CAT absorption model on the gut diagram

- `convex/lib/cat.ts`: stomach + 7 small-intestine compartments (duodenum 1, jejunum 2, ileum 4) + one compartment per colon segment. First-order transit (SI 3.32 h, gastric 0.25 h, colon 18 h), release by formulation (IR first-order; ER zero-order over 10 h; DR none in the stomach), uptake by permeability class (colon at 0.2x). Removed segments delete compartments; a stoma truncates the chain. `simulate()` returns normalized released/exposed curves; `particleStory()` drives the animation; `captionFor()` picks fixed, digit-free text (null when no small bowel is lost and the colon is in the stream).
- `convex/cat.test.ts` (19 tests): baseline matches the closed form Fa = 1-(1+ka*T/7)^-7 for high/medium/low; mass balance; end-jejunostomy, jejuno-colic, colostomy; particle story agrees with the curves; captions digit-free.
- Answer JSON: `simulation: { formulation, permeabilityClass, citation, caption? } | null`. Agent supplies formulation + [G:]/[L:] citation. Lint drops it on a bad citation, a release form that differs from fetch_label's, or a non-English profile; overwrites permeability (drug table, else unknown); fills the rule caption; blocks numeric language or any other caption. Reviewer prompt treats the caption as a cited claim.
- UI: `CatLayer` animates in 1.8 s (wall-clock, so frame drops cannot lengthen it), starts when on screen, end state only with reduced motion; legend, model label, "Play again", "Why this is only an illustration" expander.
- `eval/planted.eval.ts`: three planted numeric captions through saveDraft -> retrier -> reviewer.run, all blocked.

Not verified end to end: the Anthropic API key has no credit (400 "credit balance is too low"), so no live agent run produced a `simulation`. The animation was checked on a temporary preview page (removed) in light/dark and at phone width.
