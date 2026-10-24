# Villi — build prompt for Claude Code

Paste everything below the divider into Claude Code as the opening message.

---

You are building **Villi**, a Cal Hacks 13.0 project. I am a **solo hacker**, so you are the whole engineering team: plan, build, test, and keep going without waiting on me except at milestone checkpoints or for decisions that are genuinely mine. Prefer boring, working choices over clever ones. Hacking ends Sunday morning.

## What Villi is

A mobile-first web app for **people living with short bowel syndrome (SBS) or an ileostomy/colostomy, and their family caregivers**. Villi is named for the intestinal villi that do the absorbing. Users photograph or describe a pill, a drink, or a food, and Villi answers one question: *can a body with this much intestine actually use this?*

Clinical guidelines (AGA practice update and others) say to avoid extended-release and enteric-coated medications after major bowel resection, to avoid hypotonic drinks (water, tea) and hypertonic drinks (juice, soda) in favor of oral rehydration solution, and to watch sorbitol and simple sugars. Patients are almost never told any of this. Villi puts the guidelines, the FDA drug label, and a community tolerance pool behind a camera, and the community teaches itself what bodies like theirs tolerate, with clinicians able to check it and Claude keeping it honest.

Origin: my father lost his entire large intestine and most of his small intestine and spent years in and out of hospitals. This is for families like mine.

## Tracks this must serve (affects design)

- **Anthropic**: named community, lived problem, one thing done well and usable Monday, thoughtful Claude use with known failure modes.
- **Best People-First Hack** and **Best Solo Hack**.
- **Microsoft "Built for the Real World"**: responsible design, end-to-end functionality, measurable usefulness, path to production. The reviewer/moderation passes and the appointment sheet are the evidence.
- **Convex**: Convex must be load-bearing (see Architecture), and the README must list exactly which Convex features do what.
- **Meta "Bringing People Closer Together with AI"**: the community features are patients teaching each other, clinicians checking it, Claude mediating. Build those features so this story is true.
- MLH Gen AI, Hacker's Choice, Commit Fellowship, .Tech domain (villi.tech): no design impact.

## Non-negotiable product rules

Build these into prompts, code, and UI. They are the design, not disclaimers.

1. **Three tiers of evidence, strict priority.**
   - **Tier 1, guidelines: hard constraints.** Nothing in community or personal data can unlock what guidelines say to avoid.
   - **Tier 2, community pool: evidence about tolerance**, always stratified by anatomy, always with counts ("14 of 19 people with an end-jejunostomy logged this as tolerated"). Never a recommendation by itself.
   - **Tier 3, the user's own log: strongest signal about this person**, still soft.
   The answer to "what can I have?" is *the safest version of what you want*.
2. **Villi never decides.** It flags, cites, suggests a swap *to ask about*, and writes the question. It never tells anyone to stop, start, crush, split, or change a medication or dose. No gram/mL/calorie quantities, no meal plans.
3. **Every answer ends with one question for a human professional**, rendered as a card with "Add to appointment sheet."
4. **Every factual claim carries a citation**: `[G:<chunkId>]` for a guideline chunk or `[L:<section>]` for an FDA label section. Community evidence is cited as `[C:<n>/<total>, <anatomy>]`. Care-team answers logged by other users are cited as `[T:<id>]` and labeled "reported by another user from their own care team."
5. **Uncertainty is explicit.** Unidentified item → say so, ask for name or clearer photo. "No concern found" is worded "nothing in the sources I checked" and lists them.
6. **Reviewer pass.** Every user-facing answer goes through a second Claude call enforcing rules 2–5; it edits or blocks. Decisions are logged.
7. **Moderation before anything is shared.** Every community artifact (log entry, swap, care-team answer, question) is screened by Claude before it becomes visible to others. Entries describing stopping/changing medication, dangerous practices, or dosing advice are stored for the author only (`pooled: false`) and the author sees a gentle "please tell your care team." No DMs, no comment threads, no public profiles.
8. **Anatomy stays coarse and records stay anonymous.** No names, DOB, or free-text medical history. Coarse anatomy is what makes stratification meaningful and keeps records non-identifying.
9. **Seed data is synthetic and labeled.** `synthetic: true` on every seed record, a "demo data" badge wherever synthetic records are included in a count, and a plain README disclosure. Clinician verification is honor-system in the hackathon build and badged "demo verification."

## Stack

- Next.js (App Router) + TypeScript + Tailwind. Mobile-first; demo on a phone-sized viewport.
- **Convex** for database, server functions, scheduler, vector search, and file storage. Set it up in the first 20 minutes; if it is still fighting you at 30 minutes, tell me and fall back to SQLite + Prisma with a simple job queue, keeping the same module boundaries.
- Anthropic SDK with **tool use** and **vision**. `ANTHROPIC_MODEL_MAIN` (strongest available) for the agent and reviewer; `ANTHROPIC_MODEL_FAST` for canonicalization, moderation, and translation.
- openFDA drug label API: `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"NAME"` (fallback `openfda.generic_name`). Fields: `openfda.dosage_form`, `openfda.route`, `dosage_and_administration`, `how_supplied`, `clinical_pharmacology`, `inactive_ingredient`, `description`, `warnings`. Cache in Convex.
- Optional late add: ElevenLabs text-to-speech "read aloud" on answers for low-vision users. Only after milestone 6.
- `.env.example` with all keys. No secrets committed.

## Architecture: make Convex load-bearing

- **Agent tools are Convex functions.** `get_profile`, `fetch_label`, `search_guidelines`, `canonicalize_item`, `query_community`, `query_my_log`, `query_care_team_answers`, `query_swaps`, `lookup_ors`, `match_pill`, `add_question` are Convex queries/actions. The main agent runs in a Convex action: calls Claude, executes tool calls as internal functions, and **appends each tool step to the `answers` row as it happens**. The UI subscribes to the row so the trace streams in live.
- **Safety passes run on the scheduler.** Any shared write lands with `pooled: null` and schedules the moderation action. The reviewer pass is a scheduled step after the draft. Retries on failure. The user never waits on safety, and safety cannot be skipped from the client.
- **Realtime community.** Tolerance counts, the swaps board, and the care-team-answers list are live queries.
- **Vector search.** Guideline chunks and canonical items have embeddings in Convex vector indexes; `search_guidelines` filters by anatomy scope; `canonicalize_item` checks nearest neighbors before creating a new item.
- **File storage** for photos; actions pass the URL to Claude vision.
- **Aggregates**: maintain item × anatomy × outcome counts on write (or use Convex's aggregate component) so `query_community` is O(1).
- Use Convex's agent/workflow components only if they save time; plain actions + scheduler are fine.

## Data model

```
profiles          id, anonId, role: 'patient'|'caregiver'|'clinician', anatomy: { colonInContinuity: bool, stomaType: 'none'|'ileostomy'|'colostomy'|'jejunostomy', bowelLengthBand: 'unknown'|'<100cm'|'100-200cm'|'>200cm' }, language: string, clinicianDemoVerified: bool, createdAt
meds              id, profileId, name, genericName, dosageForm, fdaLabelCache (json), imprint?, color?, shape?, addedAt
items             id, canonicalName, category: 'pill'|'drink'|'food'|'action', attributes (json), aliases[], embedding
log_entries       id, profileId, anatomySnapshot, itemId, outcome: 'helped'|'neutral'|'hurt', note?, photoUrl?, pooled: bool|null, moderationReason?, synthetic: bool, createdAt
swaps             id, profileId, anatomySnapshot, insteadOfItemId, useItemId, note, pooled: bool|null, guidelineCheck (json: passed, citations), upvotes, clinicianEndorsements[], synthetic: bool, createdAt
care_team_answers id, profileId, anatomySnapshot, questionId, questionText, professionalType: 'pharmacist'|'dietitian'|'doctor'|'nurse', answerText, pooled: bool|null, clinicianEndorsements[], synthetic: bool, createdAt
questions         id, profileId, text, context (json), resolved: bool, createdAt
guideline_chunks  id, sourceId, sourceTitle, sourceUrl, locator, text, tags[], anatomyScope[], embedding
answers           id, profileId, input (json), toolTrace (json[]), draft, reviewerDecision (json), final (json), createdAt
aggregates        itemId, anatomyKey, helped, neutral, hurt, syntheticCount
```

## Guideline corpus

Create `data/guidelines.json` with ≥40 chunks. Each chunk is a rule-level statement in our own words plus at most one short quoted phrase, with a precise citation and `anatomyScope`. Do not paste full articles into the repo. Encode:

- **AGA Clinical Practice Update on SBS** (Iyer, DiBaise, Rubio-Tapia; Clin Gastroenterol Hepatol): avoid sustained- and delayed-release medications; consider liquids/topicals and drug-level monitoring; limit hypotonic (water, tea, coffee) and hypertonic (juice, soda) fluids; use glucose–electrolyte ORS; 5–6 small meals; intake ~50% above estimated needs; anatomy groups end-jejunostomy / jejuno-colic / jejuno-ileo-colic and how advice differs.
- **Practical Gastroenterology #139, SBS Part 4A** (Parrish, 2015): time-release formulations rely on small-bowel transit; extended-release generally avoided after extensive resection; liquids or crushed tablets may improve absorption; watch sorbitol/xylitol in liquids; suspect malabsorption when the expected clinical response isn't attained.
- **Int J Colorectal Dis 2025, drug dissolution problems in ostomy patients** (Leipzig): noncritical / potentially critical / critical formulation classes; a whole tablet visible in the pouch indicates impaired absorption; patients need education.
- **Australian Prescriber 2013** (Sood & Tanner): colostomy usually fine; absorption tracks remaining small-bowel length; large intestine mainly matters for slow-release products; antimotility drugs as a strategy; consult a pharmacist before altering a dose form.
- **Eur J Drug Metab Pharmacokinet 2021 systematic review**: decreased absorption in 29 of 37 drugs, 6 lost effect; drug-specific.
- **ORS composition reference** (WHO ORS or a standard commercial ORS).

## Flows

1. **Onboarding** (≤4 taps): role, anatomy, language. Add meds by photo (vision → name → `fetch_label`) or typing. Explain anonymity.
2. **Scan**: photo or text → classify pill / drink / food / action → agent with tools → draft → reviewer → final. UI: identified item (correctable), live tool trace, cited flags with source sentence highlighted, swap-to-ask-about (community swaps for this anatomy first, then guideline-derived), community counts with demo badge, relevant care-team answers, question card.
3. **Follow-up chat** on an answer ("can I crush it?") → agent re-reads label sections + guidance → cited answer, same rules.
4. **"I saw something"**: chips for shape, color, size; optional imprint; optional photo of a tablet on a clean surface. `match_pill` against the user's meds → cited explanation that an intact tablet passing through indicates impaired absorption → question card. No stoma-bag imagery anywhere.
5. **Log**: item (or scan) + outcome + optional note, under 5 seconds. Moderation scheduled.
6. **Community**: per item, stratified tolerance counts; **safe-swaps board** (submit, guideline-checked on submit, upvote, filter by anatomy); **care-team answers** (log what your pharmacist/dietitian said to a question from your sheet; others with your anatomy see it, labeled). Clinicians can endorse swaps and answers (badge "demo verification").
7. **Appointment sheet**: open questions, personal patterns as hypotheses with counts, meds with flags, export to markdown/PDF. After the appointment, "log the answer" feeds flow 6.
8. **Multilingual**: entries in any language are canonicalized to the same items; answers rendered in the user's language. One instruction in the canonicalization and agent prompts.

## The gut diagram (one SVG component, reused in three places)

Build a single React component `GutDiagram` from a hand-authored, flat, friendly SVG (no 3D, no anatomical realism, no gore). Eight tappable segments as `<path>` elements with ids: `stomach`, `duodenum`, `jejunum`, `ileum`, `cecum`, `ascending-colon`, `transverse-colon`, `descending-sigmoid`. Props: `removed: SegmentId[]`, `stoma?: {type, afterSegment}`, `highlight?: {segmentIds, label, mode: 'absorbs-here' | 'releases-here' | 'missing'}`, `interactive: boolean`, `onToggle(segmentId)`. Removed segments render dashed/grey; a stoma renders as a small marker at the segment end; highlights render as a soft pulse with a one-line label. Must read well at 320px wide, support light/dark, and respect `prefers-reduced-motion`.

Three uses:
1. **Onboarding (flow 1).** Instead of dropdowns, the user taps the segments that were removed and places the stoma. Derive the coarse anatomy fields (`colonInContinuity`, `stomaType`, `bowelLengthBand` when the user chooses "I don't know, roughly this much") from the tapped segments. Keep the dropdown fallback behind a "I'd rather describe it" link. Add 2–3 guided prompts ("Did they remove your colon?") that pre-select segments for people who don't know the names.
2. **Answer card (flow 2).** When a pill flag depends on anatomy, the agent's JSON includes `diagram: {segmentIds, mode, label}` (added to the output schema; the agent fills it from the label's absorption statement or the guideline chunk, with the citation). Render the user's own diagram with that highlight: e.g., extended-release tablet → `releases-here` on `ileum` + `ascending-colon`, drawn over the user's removed segments, label "Designed to release in a part of the intestine you no longer have [L:clinical_pharmacology]". Drinks: `absorbs-here` on `jejunum`/`ileum` with the fluid-balance label. This is the hero visual of the demo.
3. **Community (flow 6).** A small static version as the anatomy badge on counts, swaps, and care-team answers, so "people like you" is visible at a glance.

Rules: the diagram illustrates the agent's cited claim; it never adds a claim of its own. If the agent returns no `diagram`, render the plain anatomy with no highlight. The reviewer treats a `diagram.label` as a factual claim requiring a citation.

Build the SVG by hand in milestone 3 (onboarding) and wire the highlight into the answer card as part of milestone 3; do not block milestone 2 on it.

## Prompts

### Main agent (adapt wording; keep every rule)

```
You help people with short bowel syndrome or an ostomy, and their caregivers, understand whether a pill, drink, or food is likely to work for their body. Reason from three sources in strict priority: (1) clinical guidelines — hard constraints, cite [G:id]; (2) community tolerance logs stratified by anatomy — evidence, never a recommendation alone, always counts and anatomy, cite [C:n/total, anatomy]; answers other users logged from their own care teams are evidence of the same tier, cite [T:id] and label them as another user's report; (3) this user's own logs — personal tolerance, soft.
Always call get_profile first. For pills: fetch_label; read dosage form, how supplied, clinical pharmacology, inactive ingredients; look for extended/delayed/sustained release, enteric coating, sorbitol or other sugar alcohols, and any statement about where or how the drug is absorbed; then search_guidelines with relevant terms and the user's anatomy. For drinks/foods: canonicalize_item, read attributes, search_guidelines, query_swaps, query_community, query_care_team_answers, query_my_log.
Never: tell the user to stop, start, crush, split, or change a medication or dose (you may state what the label says about crushing and suggest they ask); give quantities, doses, or meal plans; make a factual claim without a citation.
When logs conflict with guidelines, the guideline wins; say the user's experience differs and is worth raising with their team.
If you cannot identify the item confidently, say so and ask for the name or a clearer photo.
Respond in the user's language. End with exactly one question for a pharmacist, dietitian, or doctor on a line starting "ASK:".
Tone: plain, warm, specific. Verdict in one sentence, then why, then the swap to ask about, then community and personal evidence, then ASK.
Output JSON: { verdict, why: [{claim, citation}], swapToAskAbout: {text, source: 'community'|'guideline', citation}, community: {matchingAnatomy: {helped, neutral, hurt}, other: {...}, includesSynthetic}, careTeamAnswers: [{id, professionalType, summary}], personal: [...], diagram: {segmentIds: string[], mode: 'absorbs-here'|'releases-here'|'missing', label, citation} | null, ask, confidence: 'high'|'medium'|'low', unidentified: bool }
Set diagram only when a claim depends on anatomy and you can cite where the drug releases/absorbs or which fluid principle applies; otherwise null. Segment ids: stomach, duodenum, jejunum, ileum, cecum, ascending-colon, transverse-colon, descending-sigmoid.
```

### Reviewer

```
Review a draft answer for a medical-adjacent consumer app. Return JSON { approved: bool, edits: string|null, blockedReasons: string[] }. Block or edit if the draft: tells the user to stop/start/crush/split/change a medication or dose; gives any quantity, dose, or meal plan; makes a factual claim without a [G:], [L:], [C:], or [T:] citation; presents community or personal data as a recommendation rather than evidence with counts; presents a [T:] care-team report as if it were the user's own clinician's advice; lacks a final ASK line; expresses more certainty than the sources support. Preserve meaning and citations; keep edits short. Never add medical facts of your own.
```

### Moderation (fast model; applies to logs, swaps, care-team answers, questions)

```
Classify this item for a shared database for ostomy/SBS patients. Return { pooled: bool, reason: string|null, nudgeUser: string|null }. Set pooled=false if it describes stopping, skipping, or changing a prescribed medication; a dangerous practice; dosing or quantity advice; identifying personal details; or anything a care team should hear first. For swaps, also return { guidelineConflict: bool, citations: string[] } after checking against the provided guideline chunks; a swap that conflicts with guidelines is pooled=false with the conflict explained to the author. Ordinary tolerance reports and compliant swaps are pooled=true.
```

## Synthetic seed data

`scripts/seed.ts`: ~60 anonymous profiles across the four anatomy types (a few flagged clinician role), ~1,500 log entries with anatomy-dependent patterns from the corpus (end-jejunostomy logs hypotonic and hypertonic drinks as "hurt" far more than colon-in-continuity; sorbitol items skew "hurt"; ORS, bananas, white rice, salted crackers skew "helped"; ER formulations skew "hurt" with "didn't seem to work" notes for short-bowel profiles), with noise so nothing is 100%. ~40 swaps (a few clinician-endorsed), ~30 care-team answers across professional types, ~20 open questions. Everything `synthetic: true`. One demo profile modeled on my father (anatomy only) with a realistic med list including at least one extended-release tablet, one enteric-coated tablet, one sorbitol-containing liquid, and two plain immediate-release tablets.

## Milestones (build in order; stop and show me after each; cut from the bottom if time runs out)

1. Scaffold, Convex schema and indexes, env, `guidelines.json` ≥40 chunks with embeddings, seed script. Deliver: `npm run dev` shell, `npm run seed` populates.
2. **Pill flow end to end** with live tool trace, citations, scheduled reviewer, question card. Deliver: photograph a bottle or type a name → cited answer. *If only this ships, Villi still demos.*
3. Onboarding with the `GutDiagram` SVG (tap-to-mark anatomy, dropdown fallback), meds list, follow-up chat, and the diagram highlight wired into the answer card.
4. Drink flow + `canonicalize_item` + log entry + scheduled moderation + stratified community counts (with demo badge) in answers.
5. Community: safe-swaps board (guideline-checked, upvotes, anatomy filter) and care-team answers (log from the appointment sheet; surface in answers). Clinician endorse button + demo-verification badge.
6. "I saw something" flow; appointment sheet export.
7. Multilingual (prompt lines + language in profile), mobile polish, empty/error/loading states, README and DEMO.md.
8. Stretch: packaged-food labels; ElevenLabs read-aloud; a "first 90 days" guide assembled per anatomy from guidelines + top-confidence community data.

Tests (minimal): reviewer blocks dose-change and uncited claims on fixtures; moderation classifies 10 fixture entries correctly; stratified counts correct; swap guideline check rejects a soda swap. Commit after each milestone.

## README must include

Evidence base with citations; architecture with the Convex feature list ("agent tools are Convex functions, safety passes are scheduled functions, community is live queries, guidelines are a vector index, photos are Convex storage"); the three-tier policy; the community model and why there are no DMs or threads; failure modes with mitigations (false reassurance, label misreads, small-n and self-selected community data, bad advice entering the pool, stale corpus, overconfidence, honor-system clinician verification); synthetic data disclosure; path to production (clinician review of the corpus, pilot with an intestinal-rehabilitation clinic, privacy posture).

## DEMO.md (two minutes, phone viewport)

1. One sentence on my father. 2. Father's profile → photograph the ER tablet → trace streams → flag citing label + AGA chunk → his gut diagram highlights where the tablet is designed to release, drawn over the segments he no longer has → ASK card. 3. "Can I crush it?" → cited label answer. 4. Photograph a sports drink → flag, ORS swap from the community board (clinician-endorsed), stratified counts. 5. "What can I have that's sweet?" → safest version of what you want, from community + personal logs + a care-team answer. 6. Log "hurt" from a second device → community counts update live on the first. 7. "I saw something" → chips → match. 8. Export the appointment sheet.
