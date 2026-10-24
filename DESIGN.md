---
name: Villi
description: Cited, anatomy-specific answers for people with short bowel syndrome or an ostomy, ending in one question for a professional.
colors:
  warm-rust: "#ac4126"
  warm-rust-ink: "#ffffff"
  rust-wash: "#f6dfd6"
  oat-paper: "#fbf6ef"
  card-white: "#ffffff"
  linen: "#f4ece1"
  roasted-ink: "#2b2420"
  driftwood: "#6e625a"
  sandstone-line: "#e6dacb"
  flag-red: "#b4321f"
  flag-wash: "#fbe3dd"
  sage-ok: "#2f6b3a"
  sage-wash: "#e4efe3"
  harbor-blue: "#2c5a85"
  harbor-wash: "#e3ebf3"
  removed-gray: "#8f8275"
  living-segment: "#c8704f"
  control-line: "#9a8c7e"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  verdict:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.375
  title:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.55
  body:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Atkinson Hyperlegible, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.33
    letterSpacing: "0.025em"
rounded:
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.warm-rust}"
    textColor: "{colors.warm-rust-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "56px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.warm-rust}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  button-nav:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.roasted-ink}"
    rounded: "{rounded.md}"
    height: "48px"
  hero-entry:
    backgroundColor: "{colors.warm-rust}"
    textColor: "{colors.warm-rust-ink}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
    height: "64px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.roasted-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.roasted-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "48px"
  chip-selected:
    backgroundColor: "{colors.rust-wash}"
    textColor: "{colors.roasted-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "48px"
  citation-pill:
    backgroundColor: "{colors.harbor-wash}"
    textColor: "{colors.harbor-blue}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    height: "32px"
  input:
    backgroundColor: "{colors.oat-paper}"
    textColor: "{colors.roasted-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "48px"
  ask-card:
    backgroundColor: "{colors.rust-wash}"
    textColor: "{colors.roasted-ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Villi

## Overview

**Creative North Star: "The Honest Pharmacist"**

Villi looks like the best pharmacist you've ever had, leaning over the counter with the label in hand. It's clear and calm, warm without being cute, and it never sounds more sure than the evidence. Everything on screen is there to help someone who is tired, maybe dehydrated, maybe reading in their second language, understand one verdict and walk away with one question. The warmth is in the materials (oat paper, linen, a single warm rust accent). The honesty is in the structure: every answer opens with a state tag, a plain verdict, and its sources, and none of those states is ever painted as "safe".

It's a single phone-width column with big, forgiving controls, the kind you can hit with a shaky thumb. Surfaces are layered like paper on a counter: an oat-colored page, white cards on top, linen panels for context and state. A gentle shadow lifts only the few entry points that start something. The one illustration is the hand-drawn flat gut diagram, and it only ever shows what a citation says.

**Key Characteristics:**
- One warm rust accent for action and for the question to bring to a professional; everything else is paper and ink.
- Atkinson Hyperlegible everywhere, regular and bold only, sized for low vision.
- Three answer states told apart by surface and border, never by a green "all clear".
- Tap targets of 44px at minimum, and usually 48 to 64px.
- Flat 2D SVG only: no photos of bodies, no 3D anatomy, no stoma-bag imagery.
- Light and dark modes are both first-class, with every token defined twice.

## Colors

A warm, low-saturation palette of paper and roasted ink, with one rust accent and three quiet signal hues that each have a pale wash for surfaces. Every token has a dark-mode counterpart in `src/app/globals.css` (for example, warm rust becomes `#e07a5f` on a `#1b1714` page).

### Primary
- **Warm Rust** (`warm-rust`): the only action color. It fills the primary "Take a photo" button, the "See it as my dad" entry, the "Add to appointment sheet" button and the stoma marker on the gut diagram, and outlines secondary actions and chips. **Warm Rust Ink** (`warm-rust-ink`) is the text color on top of it.
- **Rust Wash** (`rust-wash`): the background of the ASK card and of selected chips. It marks "this is yours to bring forward."

### Neutral
- **Oat Paper** (`oat-paper`): the page background and the inside of text inputs. Also the light `theme-color`.
- **Card White** (`card-white`): cards, nav buttons, unselected chips.
- **Linen** (`linen`): context panels (the anatomy summary at the top of home), the "Can't tell yet" state, error panels, demo-data pills.
- **Roasted Ink** (`roasted-ink`): body text and headings. 14.2:1 on Oat Paper.
- **Driftwood** (`driftwood`): secondary text, captions, privacy and disclaimer copy. 5.5:1 on Oat Paper.
- **Sandstone Line** (`sandstone-line`): hairline borders on cards and panels, which are decorative and need no contrast minimum.
- **Control Line** (`control-line`): borders on inputs, selects, text areas and unselected toggle chips. 3:1 or better against the page and cards (WCAG 1.4.11), applied by an unlayered rule in `globals.css`.

### Signal (semantic, never decorative)
- **Flag Red** (`flag-red`) / **Flag Wash** (`flag-wash`): the "Flag to discuss" state, the "Get help now if" panel, error text, the "hurt" share of community bars, and "missing" diagram highlights.
- **Sage** (`sage-ok`) / **Sage Wash** (`sage-wash`): "helped" counts, the "absorbs here" diagram highlight, the background of the swap-to-ask-about card, and successful tool-trace ticks. Never used for a verdict.
- **Harbor Blue** (`harbor-blue`) / **Harbor Wash** (`harbor-wash`): citations and source quotes, the "releases here" diagram highlight, and focus.
- **Removed Gray** (`removed-gray`) and **Living Segment** (`living-segment`): gut diagram strokes for removed bowel (dashed) and remaining bowel. Both are tuned to 3:1 or better on Card White and Linen in both modes, so the anatomy reads at badge size.

### Named Rules
**The No Green Light Rule.** No answer state uses Sage. "Nothing found in the sources I checked" is a plain white card with a Sandstone border, and "Can't tell yet" is Linen. Green appears only on evidence (the counts of people it helped, where the gut absorbs), never on a verdict.

**The One Voice Rule.** Warm Rust is the only accent. If a screen has two rust-filled elements competing, one of them should become an outline.

**The Wash-and-Ink Rule.** Each signal hue is used either as a pale wash behind roasted-ink text or as text and border on a neutral surface, never as a large saturated fill.

## Typography

**Body Font:** Atkinson Hyperlegible (via `next/font/google`, weights 400 and 700, exposed as `--font-sans`)

**Character:** a typeface designed by the Braille Institute for low-vision readers, with letterforms that can't be confused for one another (l/1/I, 0/O). It reads plainly, like a pharmacist's printed note. There's one family, two weights, and no display face.

### Hierarchy
- **Display** (700, 1.875rem, tight tracking): the "Villi" wordmark in the home header only.
- **Headline** (700, 1.5rem): the item name at the top of an answer, page titles.
- **Verdict** (700, 1.25rem, 1.375 line-height): the one-sentence verdict in the state card. The most important line on any screen.
- **Title** (700, 1.125rem): card headings for primary actions, the ASK question text, primary button labels.
- **Body** (400, 1rem): default copy and input text. Section headings inside cards use body size in bold.
- **Body Small** (400, 0.875rem): supporting lines, trace steps, help-now text.
- **Label** (700, 0.75rem, uppercase, 0.025em tracking): state tags ("FLAG TO DISCUSS"), the "ASK YOUR PHARMACIST OR DOCTOR" eyebrow, professional-type labels, demo badges. Captions and disclaimers use 0.75rem regular in Driftwood.

### Named Rules
**The Bold Means Something Rule.** There are only two weights. Bold marks a heading, a verdict, an action or a selected chip. It's never used for emphasis inside a sentence.

**The Plain Print Rule.** No italics, no light weights, no decorative faces. Every word should be readable by someone who is exhausted and has their phone's text size turned up.

## Layout

A single centered column, at most 448px wide (`max-w-md`), with 16px side gutters, `min-h-dvh`, and 40px of bottom padding. The layout is the same on a laptop: the demo fallback is a phone-width column in a browser, not a desktop layout. Sections stack with 16 to 24px gaps (20px on home, 16px on answers). Inside cards, items are 8 to 12px apart. The only multi-column arrangement is the two-up nav grid (Community / Your sheet) and chip grids.

Answer pages run in a fixed reading order: the state card with the verdict, then the gut diagram, Why, a swap to ask about, community counts, care-team answers, your own log, and sources checked. The ASK card and follow-up come last. Arabic answers flip the whole answer container to `dir="rtl"`.

Print (`/sheet/print`) drops all chrome marked `.no-print`, forces white paper and black ink, and sets 12pt type.

### Named Rules
**The One Thumb Rule.** Every interactive element is at least 44px tall (`min-h-11`). Primary rows are 48px, the main camera action is 56px, and home entry cards are 64px.

## Elevation & Depth

The depth is warm and tactile, built from layered paper more than shadow. Depth comes from the step between Oat Paper (the page), Card White (cards) and Linen (context panels), with a 1px Sandstone border on every card. A single soft shadow lifts only the surfaces that *start* something: the scan box and the two demo entry cards on home.

### Shadow Vocabulary
- **Counter lift** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): the scan box and the home entry cards. Nowhere else.

### Named Rules
**The Paper-on-Counter Rule.** Use a tonal layer and a hairline border before reaching for a shadow. The counter lift is reserved for entry points, so it stays meaningful.

**The Thick Border Means State Rule.** A 2px border marks the answer state card, the ASK card, the help-now panel and the "Set up your own" outline. A 1px border is everything else.

## Shapes

Gently rounded and soft. Controls, inputs and chips use 12px corners (`rounded-xl`). Cards and panels use 16px (`rounded-2xl`). Pills, the citation chips, status dots and community bars are fully round. Quoted evidence (source text, care-team answers) is marked by a 4px left rule instead of a box. The gut diagram uses round line caps for living bowel and square-cut dashed strokes for removed bowel.

## Components

### Buttons
Big, warm, and impossible to miss.
- **Shape:** gently rounded (12px).
- **Primary:** Warm Rust fill with white bold text, 48 to 56px tall, full width in cards. The camera button carries a 22px inline camera icon.
- **Outline:** a 1px (or 2px for "Set up your own") Warm Rust border with rust bold text on the surface. Used for "Check", "Ask", "Try again".
- **Nav:** a Card White button with a Sandstone border, bold Roasted Ink text, 48px, centered.
- **Text link:** bold, underlined Warm Rust (for "Change", "Not right? Type the name instead"), with a 44px tap height.
- **Disabled:** opacity drops to 50 to 70 percent. The color doesn't change.

### Chips
- **Style:** 48px rows with 12px corners. Unselected chips are Card White with a Sandstone border.
- **Selected:** a Warm Rust border on Rust Wash, with the label turning bold. State is exposed with `aria-pressed`. Color chips on `/saw` lead with a 20px round swatch.

### Citation pills
- Small fully-round Harbor Wash pills with bold Harbor Blue label text (`G`, `L`, `C`, `T` sources). Tapping one opens a Harbor-ruled quote panel below with the source text and title. Community quotes add "Self-reported by other users, not a trial."

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Card White by default, Linen for context and errors, Sage Wash for the swap card.
- **Border:** 1px Sandstone; 2px for state cards.
- **Internal Padding:** 16px.

### Answer state card (signature)
- The answer state is shown by its surface, not its color temperature. **Flag to discuss** is Flag Wash with a 2px Flag Red border and a red label tag. **Nothing found in the sources I checked** is Card White with a Sandstone border and a Driftwood tag. **Can't tell yet** is Linen with a Sandstone border and a Driftwood tag. The verdict always follows in Verdict type.

### ASK card (signature)
- Rust Wash with a 2px Warm Rust border, an uppercase rust eyebrow, the question in Title type, and a full-width primary "Add to appointment sheet" button. Every answer ends with exactly one.

### Live tool trace
- A Card White card announced with `aria-live="polite"`. While the agent works, an 8px Warm Rust dot pulses (`villi-pulse`, 1.2s, motion-safe only). Steps are an ordered list of Body Small lines: a Sage or Flag tick, the bold tool label, and a Driftwood summary.

### Inputs / Fields
- **Style:** 48px, Oat Paper fill (one step darker than the card around it), 1px Sandstone border, 12px corners, 16px text (so iOS doesn't zoom).
- **Labels:** visible bold labels, or `sr-only` when the card heading already labels the field.
- **Error:** Body Small Flag Red text below the field, in plain language.

### Gut diagram (signature)
- A hand-authored SVG at a 320px maximum width, plus a 48×56px badge used on the home anatomy panel. Living bowel is drawn in Living Segment with round caps. Removed bowel is a dashed Removed Gray stroke. Highlights are a wider stroke in Sage (absorbs here), Harbor Blue (releases here) or Flag Red (missing), pulsing gently (1.8s, motion-safe only). Segments in interactive mode have 30px-wide invisible hit strokes and turn the Harbor focus color on `focus-visible`. A caption always names the cited claim.

### Community bar
- A 12px fully-round track in Linen, split into Sage (helped), Removed Gray (no change) and Flag Red (hurt), followed by the counts in text with "(of n)" in Driftwood. A "demo data" pill (Linen, Driftwood, Label type) appears whenever synthetic rows are counted.

## Do's and Don'ts

### Do:
- **Do** keep every interactive element at least 44px tall, and 48px for rows in lists and forms. A smaller visual mark, like a 32px citation pill, sits inside a 44px button.
- **Do** rely on the global `:focus-visible` ring (3px Harbor Blue, 2px offset). Never remove it on HTML controls; the SVG diagram uses its own stroke focus.
- **Do** pair every signal color with a word: the state tag, the count, the legend. Color is never the only carrier.
- **Do** define every new token in both the light `:root` block and the `prefers-color-scheme: dark` block of `globals.css`, then map it through `@theme inline`.
- **Do** wrap all looping motion in `motion-safe:` and keep it to opacity pulses.
- **Do** set `lang` and `dir` on any container that renders answer text in the profile language.
- **Do** check any new Warm Rust text against the surface under it. Warm Rust is tuned to clear WCAG 2.2 AA at every size on the surfaces it sits on today: 4.65:1 on Rust Wash, 5.1:1 on Linen, 5.5:1 on Oat Paper, 5.9:1 on Card White. In dark mode it is 4.55:1 on Rust Wash.

### Don't:
- **Don't** paint any answer state, verdict or "nothing found" result green, and don't use a check mark next to a verdict.
- **Don't** add photographs of bodies, 3D or realistic anatomy, or stoma-bag imagery. The flat gut diagram is the only anatomical illustration.
- **Don't** introduce a second accent hue, a second typeface, or a light or italic weight.
- **Don't** use shadows beyond the counter lift, and don't lift anything that isn't an entry point.
- **Don't** lighten Warm Rust or put rust text on any surface lighter in tone than Rust Wash. It has no contrast headroom left below 4.5:1 on the ASK card.
- **Don't** shrink body copy below 0.875rem except for captions and disclaimers, which stay 0.75rem in Driftwood.
