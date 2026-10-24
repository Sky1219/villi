# Overnight run: make Villi judge-proof and genuinely more useful

You are working alone on Villi while the builder sleeps. Read `README.md`, `DEMO.md`, `.claude/CLAUDE.md`, `CLAUDE.md`, and `convex/_generated/ai/guidelines.md` before touching code, then skim `convex/schema.ts`, `convex/agent.ts`, `convex/lib/safety.ts`, `convex/sheet.ts`, `convex/careTeam.ts`, `convex/questions.ts`, `convex/impact.ts`, `convex/community.ts`.

Villi is a solo Cal Hacks 13.0 entry for the Anthropic "Claude for Public Benefit" track: a mobile-first app for people with short bowel syndrome or an ostomy and their family caregivers. You photograph or type a pill, drink or food; it answers whether a body with this much intestine can use it, from guidelines (hard limits), an anatomy-stratified community pool (evidence), and the user's own log (soft), and ends every answer with one question for a professional. A second Claude reviews every answer; moderation screens every shared entry. The builder's father lost his large intestine and most of his small intestine; the demo profile is modeled on his anatomy.

**Timeline.** Call your start time H0. The builder wakes around H+6 and needs merge-ready code by **H+10** at the latest to deploy and rehearse; submission is around H+17. So: **stop starting new features at H+9, and have everything finished, committed and written up by H+10.** Because the builder may merge partway, each task is its own commit and `MORNING.md` is updated after every task, not at the end.

The builder is asleep: don't ask questions. Make the conservative call, write it down in `MORNING.md`, and move on.

**What the judges reward, in order:** (1) a narrow named community, (2) a lived problem, (3) **a fully working product with impact measurement visible in the product**, (4) thoughtful use of Claude in development and in the product. Secondary: People-First, Solo, Microsoft "responsible design / path to production", Convex (load-bearing use), Hacker's Choice. A clinical pharmacist may be judging. **Overstatement is a loss, and a half-working feature is a liability.** Every feature below exists because it makes Villi more useful to a family on Monday morning *and* makes the impact or safety story true in the product. If a feature can't be finished to that standard inside its budget, revert it cleanly and log it.

## Ground rules (hard)

- **Branch:** work on `overnight/judging-prep` from the current `main`. One commit per task, message `type(scope): ...` like the existing history, ending with the attribution line from your system context. Never commit to `main`, never force-push, never rewrite history. Push only if a remote exists.
- **The builder explicitly authorizes direct edits for this run without a GSD command.** Write `.planning/quick/261025-overnight/SUMMARY.md` at the end.
- **Never touch production.** No `--prod` flags, no `npm run deploy:convex`, no Vercel deploys, no prod seed, no env changes.
- **Dev deployment:** if one is reachable (`npx convex run profiles:me '{"anonId":"x"}'` succeeds), you may push to **dev** with `npx convex dev --once`, re-seed dev, and run live checks, **at most 50 agent checks in total** (each costs real Opus money). Test profiles use anonIds starting `overnight-` and get deleted with `profiles:deleteMine` when you're done, so they never count as real use. If dev isn't reachable, verify with tests only and say so.
- **Never read `.env.local` or print secrets.**
- **Schema:** additive only (new tables, optional fields, new indexes). No renames, no new required fields on existing tables, no removals. Existing rows must keep validating.
- **No restyling.** New UI reuses existing components, tokens, spacing and copy voice: plain, warm, short sentences; third person on the sheet; caregiver-aware wording ("your parent"); never "safe", never green. Mobile-first, works at 320px, 44px tap targets, visible focus, labels on every control.
- **The three-tier policy applies to every new feature.** Guidelines are hard limits. Community data is evidence with counts, stratified by anatomy, "too few to say" under 5, demo badge when synthetic rows are counted. Personal data is soft. Nothing new may decide, dose, or tell anyone to stop, start, crush, split, skip or change a medicine. Any new user-facing medical sentence either comes verbatim from a guideline chunk (cited) or from a fixed template you write that contains no medical claim of its own.
- **Clinical text:** never add a medical fact that isn't stated by a source you actually opened. No invented citations, page numbers or locators. When unsure, soften or delete.
- **Privacy:** no names, no free-text medical history, no new identifiers. Any shareable link is an unguessable capability token with an expiry and a revoke button.
- **After every task:** `npx tsc --noEmit -p .`, `npx tsc --noEmit -p convex`, `npx eslint .`, `npx vitest run`, and `npm run build` must pass. If you add a file under `convex/`, run `npx convex codegen`; if codegen can't run in your environment, put new functions in existing convex files.
- **Time-boxes:** each task has a budget. If you go 50% over, revert that task, log why, and move on. Do the tasks in order: the order is the priority.

---

## Part A: make what exists trustworthy (must-do)

### A1. Pill-flow bugs (45 min)
Found in a live red-team on 2026-10-24:
1. `convex/lib/safety.ts` (~line 191): a `nothing-found` verdict missing "nothing in the sources I checked" **blocks** the answer after a reviewer edit (seen live on "loperamide, what dose should I take"). Replace the block with a deterministic repair: in English, prefix the verdict with "Nothing in the sources I checked raised a concern. "; keep the reviewer check for other languages. Add a fixture proving the repair, and that a `flagged` verdict is untouched.
2. `convex/agent.ts`: the label prefetch calls `fetch_label` with the raw user sentence. Use the canonical name, falling back to the raw text only if canonicalization failed.
3. `OPEN_QUESTION_RE` (`convex/lib/answerSchema.ts`): also refuse new checks that ask for an amount anywhere ("what dose", "how much", "how many", "how often"). Follow-ups keep their current behavior. Tests must include "loperamide, what dose should I take" (refused) and "Medrol Dosepak" (allowed).

### A2. Red-team fixes (75 min)
1. **Fraction numerator:** the lint checks only the denominator of `[C:n/total, anatomy]`. A live answer cited `[C:13/13, …]` while saying 5/5/3. Require `n` to match a retrieved outcome count (or the total) for that item and anatomy, else delete the claim. Test it.
2. **People vs reports:** find out whether `aggregates` counts entries or distinct profiles; the UI and the agent say "people". If it counts entries, count one pooled entry per profile × item (the latest outcome wins) inside `applyPooledTransition`, with a test that 5 logs from one profile count once. If that doesn't fit the budget, change every user-facing "people" to "reports" and log it.
3. **Unscreened note-free logs:** a note-free "regular soda → helped" log was shared instantly. A profile younger than 10 minutes may pool at most 3 note-free entries; the rest stay `pooled: null` until a scheduled re-check after the window. Test it.
4. **Catalog pollution:** `canonicalize_item` created "zorblatrin (immediate-release)" for a name with no FDA label. For pills with no label match, assign no release form, and don't persist the item (or mark it unverified and keep it out of autocomplete, community lists and swaps). Test it.
5. **Sports-drink tonicity:** sports drinks are seeded or canonicalized as "hypertonic", so the Gatorade answer cites both the hypertonic and the hypotonic chunk. They're roughly isotonic; the concern is low sodium plus sugar. Fix the attributes in `convex/lib/seedData.ts` and in canonicalization.
6. **Swap source mismatch:** `swapToAskAbout.source: "community"` turned up with a `[G:]` citation. In the lint, `community` requires a retrieved swap group; otherwise set the source to `guideline`.

### A3. Corpus: verify, locate, correct (110 min; needs web access)
`data/guidelines.json` has 46 chunks, all `verified: false`. A pharmacist judge will ask "where does it say that?".
1. **Confirm every source exists** (PubMed, publisher or journal site): Iyer 2022 AGA Clinical Practice Update (Clin Gastroenterol Hepatol); Chan/DiBaise/Parrish, Practical Gastroenterology #139 (2015); Parrish & DiBaise 2017, Gastroenterol Hepatol 13(10):600-608; **Remane 2025, Int J Colorectal Dis**; **Sood/Tanner/Testro 2013, Australian Prescriber**; **Hong 2021, Eur J Drug Metab Pharmacokinet**; WHO/UNICEF reduced-osmolarity ORS. Record the real title, authors, year and DOI/URL. **If a source can't be found, delete its chunks** and every reference to them (code, seed, tests, README), and put that first in `MORNING.md`. Correct any mismatched author, title or year.
2. **Real locators:** keep chunk ids stable (they're citation keys). Add a `section` field holding the real place in the source (Best Practice Advice number, heading, table, page), only from text you actually read; use `"abstract"` when only the abstract supports it, otherwise leave it out. Show it in the guideline citation sheet ("Villi's summary of: <source>, <section>"). Do the demo's chunks first: `aga-sbs#medications-release-forms`, `pg139#time-release`, `pg139#extended-release-avoid`, `pg139#enteric-coating`, `sood-2013#colon-slow-release`, `pd-2017#sports-drinks`, `pd-2017#hypotonic-jejunostomy`, `pd-2017#ors-sodium`, `aga-sbs#fluids-hypertonic`, `aga-sbs#fluids-ors`, `remane-2025#tablet-in-pouch`, `aga-sbs#dehydration-signs`.
3. **`verified: true`** goes only on a chunk whose wording you checked against text you read, with `verifiedAgainst: "abstract" | "full text"`. The README must say this was checked by Claude against openly available text, not by a clinician.
4. **Corrections** (apply unless the source you read says otherwise):
   - `aga-sbs#fluids-hypertonic`: delete "regardless of anatomy"; drop plain ileostomy from its scope unless the source covers it.
   - `pg139#crushing-immediate-release`: remove "may improve absorption". Say the pharmacist may consider it for plain immediate-release tablets, and that crushing extended-release or enteric-coated products defeats their design.
   - `aga-sbs#medications-proximal-absorption`: remove "the first part of the jejunum".
   - `pd-2017#ors-sodium`: use the source's figure (commonly "at least 90 mmol/L"); scope it to jejunostomy or high output.
   - **PPIs:** delayed-release PPIs are routine in SBS. Add or extend a chunk, only from a source that says so, so that a pantoprazole or omeprazole answer says acid suppression is commonly used and the team may choose the form, instead of reading as "generally avoided".
   - `hong-2021#absorption-findings`, `remane-2025#patient-education`, `remane-2025#formulation-classes`: verify every number and the attribution; remove what you can't confirm.
   - `pd-2017#hypotonic-colon`: make its scope match its text.
5. Confirm that changed text re-embeds on the next seed (content hash → `guidelines.embedMissing`).

### A4. Remove cut features from the agent (15 min)
Remove `browse_options` from `TOOLS`, and the open-question and multilingual paragraphs from `AGENT_SYSTEM`. Keep the caregiver wording, the tone line, and the server-side refusals. No UI route may reach a cut feature.

### A5. End-to-end test of the answer pipeline (60 min)
Use `convex-test` with mocked `fetch` for Anthropic, openFDA and Voyage. Drive `answers.start` → `agent.run` → `saveDraft` → `reviewer.run` → `finalize` and assert:
- `answers.get` never exposes a draft;
- every citation in the final is in the registry, and there's exactly one ASK;
- a reviewer that always throws ends `blocked` with "reviewer unavailable";
- a reviewer returning `approved:false` ends `blocked`.

If retrier component registration fights you past 30 minutes, test the handlers directly and say so.

---

## Part B: meaningful features (in priority order; stop starting new ones at H+9)

Each feature extends something Villi already has. For each one: a short "why" line in the commit body, tests for its logic, a 320px browser check if you can run the dev server, and a row in `STATUS.md`.

### B1. Medicine list review: the whole list, instantly (120 min)
**Why:** the real Monday task is "go through all of Dad's medicines", not one pill. Today each med needs a 30-60 second agent run. A deterministic review gives an instant, cited first pass over the whole list, and it can't fail on stage.
- Build a pure function in `convex/lib/` (shared with `convex/sheet.ts`, which already computes label-derived flags: reuse it, don't duplicate it). Inputs: one med on file (NDC dosage form, cached label sections) plus the profile's anatomy. Output: zero or more flags, each with a guideline chunk id chosen by a fixed mapping filtered by anatomy scope, and a fixed template sentence that contains no medical claim of its own (the claim is the chunk's text). Flags:
  - extended / sustained release, from the NDC dosage form;
  - delayed release / enteric coated, from the NDC dosage form;
  - sugar alcohols (sorbitol, mannitol, xylitol, maltitol, isomalt), from `spl_product_data_elements` or `inactive_ingredient`, especially in liquids;
  - "swallow whole" or "do not crush" statements in `dosage_and_administration`, quoted as label text `[L:dosage_and_administration]`;
  - label not cached yet → "Label not checked yet". Never "nothing found" unless the label sections were actually read, and then list which ones.
- On the home screen and the meds page: "Medicine list review", one row per med, using the three existing visual states (Flag to discuss / Nothing found in the sections checked / Can't tell yet), each flag with tappable citation chips like the answer page. Each row has **Run full check** (the existing agent, with the med name) and **Add a question to the sheet** (fixed template: "ASK: With <anatomy text>, is <med name> the best form for absorption, or is there another form we should discuss?", with no dose).
- When a med is added (typed or from a photo), make sure its label and NDC lookup is scheduled so the review is ready by the time the list renders. Check `convex/meds.ts` first; it may already do this.
- Caregiver wording throughout.
- Tests: a fixture list (ER metoprolol, DR pantoprazole, a sorbitol-containing liquid, a plain IR tablet, a med with no label) across end-jejunostomy and colostomy profiles gives the expected flags and chunk ids, and anatomy scope removes flags that don't apply.
- Pantoprazole must read with the PPI nuance from A3, not as "avoid".

### B2. Warning-sign escalation in the log (45 min)
**Why:** dehydration is the most common reason people with a jejunostomy end up back in hospital. A tolerance log that ignores "I've been dizzy and peeing less" is irresponsible. This is the responsible-design feature a Microsoft or People-First judge will look for, and it adds no advice.
- A pure function in `convex/lib/` scanning a log note for warning-sign phrases from `aga-sbs#dehydration-signs` (thirst, dark or little urine, dizziness or lightheadedness on standing, output much higher than usual) and for emergency phrases (fainting or passing out, confusion, chest pain, blood). Accept false positives: telling someone to contact their care team is harmless.
- On saving such a log (client-side, immediately, before moderation), show a card that sticks until it's acknowledged. Dehydration signs: "These can be warning signs of dehydration. Contact <his/your> care team today." cited `[G:aga-sbs#dehydration-signs]`. Emergency phrases: "If <he is / you are> fainting, confused, or has chest pain or bleeding, call emergency services now." No other advice, no fluids guidance, no quantities.
- Also show the dehydration card, softer and without urgency wording, after any **Worse** log on a drink.
- On the appointment sheet, add a "Warning signs logged" section (date + which signs, no free text) so it reaches the clinician.
- Moderation still runs as now; a note with warning signs is never pooled verbatim (check the existing moderation rules cover this).
- Tests: phrase fixtures, including negations, which you may treat as matches; emergency outranks dehydration.

### B3. Care-team link: let the pharmacist close the loop (120 min)
**Why:** today every impact number is self-reported. A link the patient hands to their pharmacist, where the pharmacist marks what happened to each question, makes the outcome data **care-team confirmed**. That's the difference between "a metric" and "a measurable pilot" for criterion 3, and it's how a clinic pilot would really run.
- On the sheet: **Share with the care team** creates a capability link `/team/<token>` (≥128-bit random token, expires in 14 days, revocable from the sheet, at most 3 active per profile, rate-limited). New table, e.g. `team_links { profileId, token, createdAt, expiresAt, revokedAt? }` with an index on `token`.
- The `/team/<token>` page is read-only: the sheet's content (anatomy, medicines with flags, open questions, warning signs, patterns as hypotheses) written in the third person, a clear "Shared by the patient's family through Villi. Not a medical record." header, and the openFDA disclaimer. It never shows the anonId or any other profile's data. An expired or revoked token shows "This link has expired".
- For each question the person with the link can choose **Reviewed: form changed / Monitoring started / No change needed / Will discuss at a visit**, plus an optional short note (≤280 chars). This writes the same care-team answer and `resultingChange` as the patient's "What did they say?" flow, with an additive field `source: "team_link" | "self"`. The note goes to the patient privately and goes through the existing care-team moderation before it can ever be pooled.
- Be honest about identity: the link holder isn't verified. Label these "recorded through the care-team link", never "verified clinician".
- The patient's sheet shows which answers came through the link.
- Tests: an expired token, a revoked token, and a token for profile A can't read or write profile B; a link response marks the question answered with `source: "team_link"`; the rate limit holds.

### B4. After a change: check the new form, then ask how it went (90 min)
**Why:** the loop currently ends at "the form was changed". Whether the change *helped* is the outcome that matters, to the family and to the impact story.
- When an answer is logged with `resultingChange: "formulation_changed"` (self or team link), offer an optional "What's the new form called?" field (text, ≤80 chars) and a **Check the new form** button that runs the normal agent check on it, linked to the question (additive `followsQuestionId` on `answers`).
- A follow-up becomes due 14 days after the change. Follow the Convex guidelines on time: don't rely on `Date.now()` inside a query; schedule a mutation at change time that sets `followUpDue: true`. When it's due, the home screen shows "It's been two weeks since <his/your> <medicine> was changed. How is it going?" with the existing one-tap Helped / No change / Worse, saved as a normal log linked to the question (`afterChangeOutcome` on the question). Worse triggers the B2 soft card plus "Worth telling the care team."
- Demo honesty: no "fast-forward" button in the product. The seed may include synthetic questions with follow-ups already due (badged demo data) so the card can be shown; real rows only appear from real use.
- Tests: the scheduling sets due; the outcome links to the question; nothing shows before it's due.

### B5. "What care teams changed for people like you" (90 min)
**Why:** this turns the ASK loop into community knowledge, the "patients teach each other" promise built from structured outcomes rather than opinions. "4 of 9 people with an end-jejunostomy who asked about extended-release metoprolol reported that their team changed the form" is exactly the evidence a family wants before an appointment, and it stays evidence, not advice.
- Counter rows per (item × anatomyKey × resultingChange), updated **in the same mutation** that pools or unpools a moderated care-team answer, like `aggregates`. Only pooled answers count; synthetic rows set a demo flag.
- Show on the answer page (with the community card) and the community page: counts with denominators, stratified, "too few to say" under 5, demo badge, and the line "Reported by other families from their own care teams. What a care team decides depends on the person."
- Add an agent tool `query_care_outcomes(item)` returning those counts. The model cites them as `[C:n/total, anatomy]`, numbers exactly as returned. Register them in the citation registry so the A2 numerator lint covers them. The prompt rule: evidence about what care teams did, never a recommendation, never a reason to change anything without asking.
- Update the seed so synthetic care-team answers produce plausible counts for metoprolol ER, pantoprazole, sports drink and loperamide across anatomies (still marked synthetic).
- Tests: stratification, the threshold, pool → unpool moving the counters, synthetic flagging.

### B6. Impact view: the full funnel and the safety record (60 min)
**Why:** this is where criterion 3 is judged. After B3-B5 the funnel can show outcomes, not just activity.
- Headline funnel at the top of `/impact`, **real use only**, split by anatomy: flagged checks → question saved → asked → answer logged (self / care-team link shown separately) → something changed → two-week outcome (helped / no change / worse). Counts plus percentage of the previous step. Honest zero states ("No real answers logged yet. This weekend, real use is the builder's own checks."). Demo data below, clearly labeled.
- Add the medicine list review: medicines reviewed, and medicines flagged, by anatomy.
- **Safety record**, from real writes only: answers approved as-is / edited by the reviewer / blocked / failed; code-lint removals; logs and swaps shared vs kept private; warning-sign cards shown (count only); "Something's wrong" reports (see B7). Real and demo separate; bounded scans like the existing summary.
- Tests in `impact.test.ts` for the funnel steps and the safety tallies.

### B7. "Something's wrong with this answer" (30 min)
Next to "Was this useful?": one-tap chips (wrong medicine identified / a claim isn't supported by its source / confusing / other). The user's own final answers only, rate-limited, additive optional field on `answers`, no free text. Counted in the B6 safety record, and listed in the README's evals plan as the source of new reviewer fixtures.

### B8. "How Villi decides", in the app (30 min)
A short `/how` page in the existing visual language, linked from the answer footer and the home footer. It covers:
- the three tiers;
- what Villi never does;
- the code check and the second Claude review before anything is shown, and moderation before anything is shared;
- warning-sign cards;
- the care-team link and its honest identity limits;
- that community data in this build is synthetic and badged;
- that the guideline text is Villi's summaries, with how many chunks were checked against source text;
- the openFDA disclaimer and Delete my data.

Check every sentence against the code.

### B9. Optional, only if it's before H+8: link a second phone to the same profile (60 min)
**Why:** a parent and an adult child both manage the medicines; today they'd have two profiles and two logs.
- **Use Villi on another phone** generates a 6-digit code valid for 10 minutes, single use, rate-limited on attempts. The other device enters it and gets its own anonId linked to the same profile (new table `device_links { anonId, profileId, createdAt }`). `requireProfile` resolves either. A device list on the profile screen allows revoking. Delete my data removes the links.
- Tests: an expired or used code fails; brute-force attempts are throttled; a revoked device loses access; one profile's devices can't reach another's data.
- If this touches `requireProfile` in a way that risks the existing flows, skip it and log it.

---

## Part C: verify and hand over (finish by H+10)

### C1. Live verification on dev (60 min, only if dev is reachable)
Push to dev, re-seed **dev**, and clone the demo father (`profiles:cloneDemo`, anonId `overnight-…`). Confirm `caresFor` is "parent" and answers say "your parent". Run each three times:
- "Metoprolol succinate ER 50 mg", then the follow-up "Can I crush it?";
- "Gatorade";
- "Pantoprazole 40 mg";
- "Zorblatrin 20 mg";
- "loperamide, what dose should I take";
- the "I saw something" yellow-oval flow.

Then exercise once each: the medicine list review, a warning-sign log, a care-team link response (open the link in a second browser context), the two-week follow-up card (on a seeded synthetic row), and `/impact`. Record the state, seconds, reviewer outcome and any wording problem in `STATUS.md`. Fix real bugs within budget and log the rest. Delete the test profiles.

### C2. Documents (60 min)
1. **README:**
   - Update "What it does" for B1-B9 as actually shipped.
   - Add **"How Claude built this"**:
     - development: a spec-driven build with Claude Code (research → roadmap → quick tasks in `.planning/`); a Claude-generated synthetic seed shaped by the corpus; a corpus drafted by Claude, source-checked by Claude in this run, and still awaiting clinician review; critique, accessibility and red-team passes;
     - the product: an Opus agent with Convex-function tools, an Opus reviewer that can't add citations, Haiku for vision, canonicalization and moderation, and the deterministic lint and deterministic medicine review that sit around the models;
     - one honest line about what Claude got wrong: its first spec assumed openFDA labels carry `dosage_form`, `inactive_ingredient` and `warnings`; live calls showed modern labels don't, so the dosage form comes from the NDC endpoint. Add any real mistake you found tonight.
   - Expand **"Measuring impact"**:
     - primary metric: the share of flagged checks whose question gets a logged care-team answer with a real change within 30 days, split by anatomy, with care-team-link answers reported separately from self-reported ones;
     - outcome metric: two-week "helped" rate after a change;
     - secondary: asked rate, useful rate, time from flag to answer, medicines reviewed per profile;
     - safety: reviewer edit and block rate, moderation private rate, warning-sign cards, "Something's wrong" reports;
     - pilot: 8-12 weeks, 30-50 adults at one intestinal-rehabilitation clinic, where pharmacists receive care-team links; baseline is the share of patients with extended-release or enteric-coated medicines on file whose form was reviewed;
     - partners to approach (never claim a partnership): an intestinal-rehab program, the Oley Foundation, United Ostomy Associations of America.
   - Update the corpus section, the test list, the failure modes (add warning signs and the link-holder identity limit), the privacy posture (care-team links, device links) and the known gaps, all to match the code exactly.
2. **`STATUS.md`** (new): one row per feature with Works / Partial / Broken / Cut, how it was verified (live on dev, test name, or code read only) and the file. Include the C1 table.
3. **`PITCH.md`** (new): a 2-minute script that follows `DEMO.md`. The opening 30 seconds names the narrow community and the lived problem, and ends on the metric. Include the one honest limitation to say unprompted. Every claim must be true of the code.
4. **`DEMO.md`:** don't rewrite the flow. Add a short "Optional swaps" section proposing where the medicine list review (instant, no wait) and the care-team link could replace a step, and the pre-demo setup they need. The builder decides.
5. **`MORNING.md`** (repo root, updated after every task): broken things first, then one line per task with its commit hash and status, every decision for the builder to check (corpus deletions and wording changes first), what you couldn't do and why, and the morning commands in order: review and merge the branch, `npm run deploy:convex`, `npx convex run --prod seed:run`, confirm prod env keys, redeploy Vercel, then the real-iPhone tests (bottle photo, blurry photo, crush follow-up, care-team link opened on a second phone).

## What not to do
No features beyond the list. No restyling or polish passes. No multilingual, item embeddings, vector-search tuning, jsPDF, auth, rate-limiter component, push notifications, or extra seed volume beyond what B4-B5 need. No edits to `.planning/STATE.md` beyond the summary file. No production deploys. Don't soften `MORNING.md`: if something is broken, it goes first.
