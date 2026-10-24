# Roadmap: Villi

## Overview

Villi goes from an empty repo to a judge-ready, mobile-first web app in seven milestones that follow the brief's M1 to M7 order. Phase 1 lays down the data contract (schema, cited guideline corpus with embeddings, synthetic seed, stub profile, live deploy) so everything later builds on it. Phase 2 ships the core: photograph or type a pill and get a cited, reviewer-checked answer that ends in one question for a professional. If only that phase ships, Villi still demos. Phases 3 to 6 add the anatomy diagram and onboarding, drinks and logging with moderated community counts, swaps and care-team answers, and the "I saw something" flow plus the appointment sheet. Phase 7 adds multilingual answers, polish, tests, README, and DEMO.md. Each phase ends at a builder checkpoint: a phone smoke test, a show-and-tell, and a commit. If time runs out, cut from the bottom (see Cut Order). M8 stretch is v2 and has no phase here.

Binding inputs for every phase: `.planning/BRIEF.md` (product rules, data model, prompts) and `.planning/research/SUMMARY.md` Part A (clinical, stack, and embeddings corrections that override the brief where they conflict). Code under `convex/` follows the project's Convex skills (consult `convex-expert` first).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Next.js + Convex shell deployed to a phone, full schema, cited guideline corpus with embeddings, synthetic seed, stub profile
- [ ] **Phase 2: Pill Answers End to End** - Photo or typed pill to a cited, reviewer-checked answer with live tool trace and one question card (the shippable core)
- [ ] **Phase 3: Anatomy Onboarding & Answer Diagram** - Tap-to-mark GutDiagram onboarding, meds list, follow-up chat, and diagram highlight on answers
- [ ] **Phase 4: Drinks, Logging & Community Counts** - Drink/food answers with ORS swap, canonicalization, 5-second log, moderation, live stratified counts
- [ ] **Phase 5: Community Swaps & Care-Team Answers** - Guideline-checked safe-swaps board, care-team answers surfaced in answers, clinician endorse
- [ ] **Phase 6: "I Saw Something" & Appointment Sheet** - Chip-based tablet match with neutral cited explanation, one-page appointment sheet with export
- [ ] **Phase 7: Multilingual, Polish & Launch Docs** - Answers in profile language, empty/loading/error states, data controls, test suite, README and DEMO.md

## Phase Details

### Phase 1: Foundation
**Goal**: The app runs locally and on a real phone over HTTPS, with the complete schema, a cited guideline corpus that can be searched, a synthetic community seed, and a usable profile without onboarding
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, FND-07, SAFE-07
**Success Criteria** (what must be TRUE):
  1. Opening the deployed HTTPS URL on a real phone loads the Villi shell at phone width, and `npm run dev` serves the same shell locally
  2. `npm run seed` finishes in under 60 seconds, can be re-run without duplicating rows, and fills the database with ~60 synthetic profiles, ~1,500 logs, ~40 swaps, ~30 care-team answers, ~20 questions, 40+ guideline chunks, and the father demo profile with his five-item med list (ER, EC, sorbitol liquid, two plain IR); every seeded community record is marked `synthetic: true`
  3. A guideline search for a phrase like "extended release after resection" returns relevant chunks with stable `sourceId#locator` ids through vector search, and still returns results through the full-text fallback when the embedding call fails
  4. A visitor gets a working profile with no onboarding, either by picking role, coarse anatomy, and language from dropdowns or by opening `/demo?as=father` or `/demo?as=peer`, and the stored profile has no name, DOB, or free-text history field
  5. `.env.example` lists every key, secrets live only in Convex env (dev and prod), and no secret is committed
**Checkpoint**: Real phone opens the deployed URL, `/demo?as=father` shows his profile, seed counts shown in the Convex dashboard; commit
**Research flag**: Spike first: Voyage endpoint and account limits, Anthropic SDK in Convex default runtime vs `"use node"` (15-minute cap), Convex env wiring for dev and prod
**Plans**: TBD
**UI hint**: yes

### Phase 2: Pill Answers End to End
**Goal**: A user photographs or types a pill and gets a cited, reviewer-checked answer about whether it can work for their anatomy, ending in one question for a pharmacist or doctor
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PILL-01, PILL-02, PILL-03, PILL-04, PILL-05, PILL-06, PILL-07, PILL-08, PILL-09, SAFE-01, SAFE-02, SAFE-03, SAFE-05, SAFE-06
**Success Criteria** (what must be TRUE):
  1. On the father profile, a user types an extended-release drug name or photographs the bottle, confirms or corrects what Villi read ("I read: X. Correct?"), and watches the tool trace stream in step by step while the answer is prepared
  2. The answer flags ER/EC release form or sugar alcohols against the user's anatomy, shows exactly one of three states (flagged / "nothing in the sources I checked" with the sources listed / can't identify, asking for a name or clearer photo), every claim's citation opens its source with the sentence highlighted, and the answer ends with one question card whose "Add to appointment sheet" saves the question
  3. A draft that tells the user to stop, start, crush, split, or change a medication or dose, gives a quantity, or cites a source not retrieved in that run (including a wrong `[C:n/total]`) is edited or replaced with a safe fallback before the user sees it, and each reviewer decision is recorded
  4. If the agent or reviewer crashes or is killed mid-run, the user ends up looking at a safe fallback, never the draft, and nothing sent from the client can skip review
  5. From any screen the user can open a guideline-cited "when to get help now" panel and a note that Villi is not a drug-interaction checker, and an uploaded bottle photo is gone from storage once the item is identified
**Checkpoint**: Father profile + typed ER drug + bottle photo produce a validated, cited answer on a real phone with the photo deleted; builder confirms the cut order; commit
**Research flag**: Needs research: `tools` + `output_config.format` composition (fallback: second formatting call), action-retrier `onComplete` typing, openFDA ranking across the six demo meds, NDC dosage-form ER/EC flag coverage, sorbitol in `spl_product_data_elements`, iOS Safari camera
**Plans**: TBD
**UI hint**: yes

### Phase 3: Anatomy Onboarding & Answer Diagram
**Goal**: A new user describes their anatomy by tapping a friendly gut diagram, adds their meds, asks follow-ups on an answer, and sees their own diagram illustrate anatomy-dependent flags
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ONB-01, ONB-02, ONB-03, ONB-04, ONB-05, ANS-01, ANS-02
**Success Criteria** (what must be TRUE):
  1. A new user sets role, anatomy, and language in four taps or fewer, sees why the profile is anonymous, and marks removed segments and a stoma on the GutDiagram, with the app deriving colon-in-continuity, stoma type, and bowel-length band (contradictions prompt a question rather than a guess)
  2. A user who doesn't know segment names finishes onboarding through 2 to 3 guided prompts ("Did they remove your colon?") that pre-select segments, or through the "I'd rather describe it" dropdowns, and can add medications by photo or by typing
  3. The GutDiagram reads clearly at 320px in light and dark mode, stays still when reduced motion is on, and a screen reader announces a text description of the user's anatomy
  4. On the father's ER-tablet answer, the card shows his own diagram with the missing segments highlighted and a cited one-line label taken from the guideline chunk's fixed payload; an answer with no anatomy-dependent citation shows the plain diagram with no highlight
  5. Asking "can I crush it?" on that answer returns a cited, reviewer-checked reply that states what the label says and suggests asking, never instructing
**Checkpoint**: Fresh phone completes diagram onboarding in four taps or fewer; father's ER answer shows the highlighted diagram; crush follow-up stays within the rules; commit
**Research flag**: Standard patterns (SVG, forms); anatomy derivation is covered by unit tests
**Plans**: TBD
**UI hint**: yes

### Phase 4: Drinks, Logging & Community Counts
**Goal**: Users get cited answers for drinks and foods with an ORS swap to ask about, log how items went in seconds, and see moderated, anatomy-stratified community counts that update live
**Mode:** mvp
**Depends on**: Phase 3 (milestone order; uses Phase 2's agent, reviewer, and citation registry)
**Requirements**: DRNK-01, DRNK-02, LOG-01, LOG-02, SAFE-04, COMM-01, COMM-02
**Success Criteria** (what must be TRUE):
  1. A user scans or types a sports drink and gets a cited answer that applies fluid rules scoped to their anatomy and offers an ORS swap to ask about, with both ORS formulas labeled and the SBS-supported one identified
  2. Different wordings or languages for the same drink resolve to one item, while pills with different release forms (metoprolol tartrate vs succinate ER) stay separate items
  3. From an answer card or the "waiting to log" list, a user logs an item as helped / neutral / hurt with an optional note in under 5 seconds
  4. A new log stays invisible to other users until moderation passes; a log describing stopping a medication stays visible only to its author, who sees a gentle "please tell your care team" message, and the moderation decision is recorded
  5. Answers show anatomy-stratified counts with denominators, a "demo data" badge when seeded records are included, and "too few reports" below the minimum (counts never change a guideline flag); logging "hurt" on a second device (`/demo?as=peer`) updates the count on the first device live once moderation passes
**Checkpoint**: Sports-drink answer with ORS swap and counts on the phone; second device logs "hurt" and the first device's count updates live; commit
**Research flag**: Needs research: canonicalize similarity threshold calibration (~20 examples, start near 0.85), `pooled: null` watchdog timing
**Plans**: TBD
**UI hint**: yes

### Phase 5: Community Swaps & Care-Team Answers
**Goal**: Patients teach each other through guideline-checked swaps and care-team answers, and clinicians can endorse them, all through the same moderated pipeline
**Mode:** mvp
**Depends on**: Phase 4 (pooled moderation pipeline and counters)
**Requirements**: COMM-03, COMM-04, COMM-05, COMM-06, SHEET-03
**Success Criteria** (what must be TRUE):
  1. A user submits a swap and it is guideline-checked on submit: a soda swap is rejected with the conflicting guideline cited to the author, while a compliant swap appears on the board after moderation
  2. A user browses the safe-swaps board, upvotes a swap, and filters the board to their anatomy
  3. From their saved questions, a user logs what their pharmacist, dietitian, doctor, or nurse said; after moderation, another user with similar anatomy sees it in a relevant answer, cited `[T:]` and labeled "reported by another user from their own care team"
  4. A clinician-role user can endorse a swap or care-team answer, and the endorsement shows a "demo verification" badge
  5. Counts, swaps, and care-team answers each carry a small static anatomy badge so "people like you" is visible at a glance
**Checkpoint**: Soda swap rejected and ORS swap accepted live; a logged care-team answer appears in another profile's answer as `[T:]`; clinician endorse badge visible; commit
**Research flag**: Standard (reuses the Phase 4 pooled pipeline; moderation prompt branches by table)
**Plans**: TBD
**UI hint**: yes

### Phase 6: "I Saw Something" & Appointment Sheet
**Goal**: A user can check a tablet they saw against their own meds without alarm, and bring one clean appointment sheet of questions, patterns, and flagged meds to their care team
**Mode:** mvp
**Depends on**: Phase 5 (uses questions from Phase 2, meds from Phase 3, care-team logging from Phase 5)
**Requirements**: SAW-01, SAW-02, SHEET-01, SHEET-02
**Success Criteria** (what must be TRUE):
  1. A user describes a tablet with shape, color, and size chips (plus an optional imprint or photo) and sees possible matches drawn only from their own meds, with any photo deleted after use
  2. The result explains neutrally, with a citation, that an intact tablet or shell may or may not mean the drug wasn't absorbed, and ends in a question card; no stoma-bag imagery appears anywhere
  3. The appointment sheet shows open questions, the user's own patterns as hypotheses with counts ("my pattern, n=3, patient-reported"), and meds with their flags on one page
  4. The user can download the sheet as markdown and save or print it as PDF from the print route on a phone
**Checkpoint**: "I saw something" matches the father's ER tablet from chips; appointment sheet exports as markdown and PDF on the phone; commit
**Research flag**: Standard for the sheet; check `match_pill` scoring only if imprint matching is attempted
**Plans**: TBD
**UI hint**: yes

### Phase 7: Multilingual, Polish & Launch Docs
**Goal**: Villi is demo-ready and judge-ready: answers come in the user's language, every screen handles empty, loading, and error states accessibly, users control their data, tests pass, and the README and DEMO.md tell the story
**Mode:** mvp
**Depends on**: Phase 6 (all features in place)
**Requirements**: I18N-01, POL-01, POL-02, POL-03, DOC-01, DOC-02, TEST-01
**Success Criteria** (what must be TRUE):
  1. A user whose profile language is Spanish gets the answer in Spanish, with every citation token intact and re-checked after translation
  2. Every screen shows a helpful empty, loading, and error state, with 44px tap targets, AA contrast, and layouts that hold up with enlarged text
  3. A user can delete their data, and rapid repeated answer or log submissions from one anonymous id are rate-limited with a friendly message
  4. `npm test` passes fixtures showing the reviewer blocks dose-change and uncited claims, moderation classifies 10 fixture entries correctly, stratified counts are correct, and the swap check rejects a soda swap
  5. A judge reading the README finds the evidence base with citations, the exact Convex feature mapping, the three-tier policy, the community model (why no DMs or threads), failure modes with mitigations, the synthetic-data disclosure, and the path to production; DEMO.md gives the two-minute phone script with the corrected diagram narration
**Checkpoint**: Full DEMO.md run on a real phone and on a laptop at phone viewport; `npm test` green; README reviewed; commit
**Research flag**: Standard (README, DEMO, golden-set run); translation safety needs a fixture run, not research
**Plans**: TBD
**UI hint**: yes

## Cut Order

If time runs out, cut from the bottom (confirm at the Phase 2 checkpoint):
1. M8 stretch (v2, no phase).
2. Multilingual (I18N-01 in Phase 7); keep English only.
3. Care-team answers and clinician endorse (COMM-04, COMM-05, SHEET-03 in Phase 5).
4. "I saw something" imprint/photo path (keep chips and text in Phase 6).
5. Safe-swaps board (COMM-03 in Phase 5); keep logs and counts.

Never cut: Phase 1 safety contract, Phase 2 pill flow with reviewer and lint, Phase 3 anatomy profile (or dropdown fallback), Phase 4 pooled moderation and counts with demo badge, the help-now panel and scope note (SAFE-06), delete-my-data (POL-02), README and DEMO.md.

Tests for TEST-01 are written alongside their features (reviewer fixtures in Phase 2, moderation and count fixtures in Phase 4, soda-swap fixture in Phase 5) and verified together as one suite in Phase 7.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Pill Answers End to End | 0/TBD | Not started | - |
| 3. Anatomy Onboarding & Answer Diagram | 0/TBD | Not started | - |
| 4. Drinks, Logging & Community Counts | 0/TBD | Not started | - |
| 5. Community Swaps & Care-Team Answers | 0/TBD | Not started | - |
| 6. "I Saw Something" & Appointment Sheet | 0/TBD | Not started | - |
| 7. Multilingual, Polish & Launch Docs | 0/TBD | Not started | - |
