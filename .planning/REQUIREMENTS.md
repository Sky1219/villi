# Requirements: Villi

**Defined:** 2026-10-23
**Core Value:** Photograph or type a pill and get a cited, reviewer-checked answer about whether it can work for *this user's anatomy*, ending in one question to bring to a pharmacist or doctor.

Binding inputs: `.planning/BRIEF.md` (product rules, data model, prompts) and `.planning/research/SUMMARY.md` Part A (clinical, stack, and embeddings corrections that override the brief where they conflict).

## v1 Requirements

### Foundation

- [ ] **FND-01**: Developer can run `npm run dev` to get a Next.js (App Router, TS, Tailwind) + Convex app shell on a phone-sized viewport
- [ ] **FND-02**: Convex schema defines every table in the brief's data model plus `answer_reviews` (hidden drafts), `fda_label_cache`, and `aggregates` (real/synthetic split), with `pooled: boolean | null`
- [ ] **FND-03**: `data/guidelines.json` holds 40+ rule-level chunks in our own words, each with a stable `sourceId#locator` id, precise citation, `anatomyScope`, `appliesTo`, and an optional fixed `diagram` payload, with the research corrections applied (Remane wording, anatomy-scoped hypotonic rule, IR-only crushing, both ORS formulas, corrected attributions)
- [ ] **FND-04**: Guideline chunks have Voyage embeddings (1024d) in a Convex vector index, with a Convex full-text search index as automatic fallback
- [ ] **FND-05**: `npm run seed` populates ~60 synthetic profiles, ~1,500 log entries with anatomy-dependent patterns, ~40 swaps, ~30 care-team answers, ~20 questions, all `synthetic: true`, idempotent and under 60 s, plus the father demo profile and a med list with ER, EC, sorbitol-liquid, and two plain IR items
- [ ] **FND-06**: User can get a working profile without onboarding via a dropdown profile form or `/demo?as=father|peer` (clone of a template profile into a fresh anonymous id)
- [ ] **FND-07**: App is deployed to Vercel + Convex prod and loads on a real phone over HTTPS; `.env.example` lists every key; no secrets committed

### Pill Answers

- [ ] **PILL-01**: User can type a medication name or photograph a bottle/pill and start an answer
- [ ] **PILL-02**: User sees what Villi read from the photo and can confirm or correct the identified item before the label is fetched
- [ ] **PILL-03**: User sees a live tool trace stream in while the agent works (each tool step appended to the answer row and pushed by subscription)
- [ ] **PILL-04**: Agent determines release form (ER/EC/IR) from the openFDA NDC dosage form and label sections, and flags ER/EC and sugar alcohols against guideline chunks for the user's anatomy
- [ ] **PILL-05**: Every claim in the answer carries a `[G:]`, `[L:]`, `[C:]`, or `[T:]` citation that resolves to a source the user can open, with the source sentence highlighted
- [ ] **PILL-06**: Answer shows one of three states only: flagged / "nothing in the sources I checked" (listing the sources) / can't identify (asks for a name or clearer photo)
- [ ] **PILL-07**: Every answer ends with exactly one question for a professional, rendered as a card with "Add to appointment sheet"
- [ ] **PILL-08**: User sees an answer only after the reviewer pass (deterministic lint plus a Claude review) approves or edits it; blocked or failed answers show a safe fallback and never the draft
- [ ] **PILL-09**: Uploaded photos are deleted after identification

### Safety

- [ ] **SAFE-01**: Reviewer blocks or edits any answer that tells the user to stop, start, crush, split, or change a medication or dose, or that gives quantities, doses, or meal plans (with an allow-list for product strengths and ORS composition)
- [ ] **SAFE-02**: Code validates every citation against what was retrieved in that answer's run, including that `[C:n/total]` matches the aggregate returned, before an answer becomes final
- [ ] **SAFE-03**: Answer lifecycle is a server-side state machine with retries and a watchdog, so a crashed agent or reviewer fails closed and the client can never skip the safety passes
- [ ] **SAFE-04**: Every community artifact (log, swap, care-team answer, question) is saved with `pooled: null` and becomes visible to others only after moderation; unsafe entries stay author-only with a gentle "please tell your care team" message
- [ ] **SAFE-05**: Reviewer and moderation decisions are logged
- [ ] **SAFE-06**: User can always reach a static, guideline-cited "when to get help now" panel and a scope note that Villi is not a drug-interaction checker
- [ ] **SAFE-07**: Profiles store only coarse anatomy, role, and language — no names, DOB, or free-text medical history

### Onboarding

- [ ] **ONB-01**: User can set role (patient, caregiver, clinician), anatomy, and language in 4 taps or fewer, with an explanation of anonymity
- [ ] **ONB-02**: User can mark removed segments and place a stoma by tapping the `GutDiagram` SVG, and the app derives `colonInContinuity`, `stomaType`, and `bowelLengthBand`
- [ ] **ONB-03**: User who doesn't know segment names can answer 2–3 guided prompts that pre-select segments, or use the "I'd rather describe it" dropdown fallback
- [ ] **ONB-04**: `GutDiagram` reads well at 320px, supports light/dark, respects reduced motion, and has a text alternative
- [ ] **ONB-05**: User can add medications by photo or by typing

### Answer Experience

- [ ] **ANS-01**: User can ask a follow-up on an answer (e.g. "can I crush it?") and get a cited, reviewer-checked reply that states what the label says and suggests asking, never instructs
- [ ] **ANS-02**: When a flag depends on anatomy, the answer card shows the user's own `GutDiagram` with a highlight resolved from the cited guideline chunk's fixed diagram payload (never chosen by the model); no citation means no highlight

### Drinks, Foods & Logging

- [ ] **DRNK-01**: User can scan or type a drink or food and get a cited answer with an ORS swap to ask about, using anatomy-scoped fluid rules
- [ ] **DRNK-02**: Items entered in any wording or language are canonicalized to one item, and pills never merge across release form
- [ ] **LOG-01**: User can log an item (or a scan) as helped / neutral / hurt with an optional note in under 5 seconds
- [ ] **LOG-02**: User can see a "waiting to log" list of recent items they haven't logged yet

### Community

- [ ] **COMM-01**: Answers show anatomy-stratified tolerance counts with denominators, a "demo data" badge when synthetic records are included, and a "too few reports" state below a minimum count
- [ ] **COMM-02**: Community counts update live on other devices once a new log passes moderation
- [ ] **COMM-03**: User can submit a safe swap, which is guideline-checked on submit (a soda swap is rejected), and can browse, upvote, and filter swaps by anatomy
- [ ] **COMM-04**: User can log what their pharmacist/dietitian/doctor said to a question from their appointment sheet, and others with similar anatomy see it in answers, labeled "reported by another user from their own care team"
- [ ] **COMM-05**: Clinician-role user can endorse swaps and care-team answers, shown with a "demo verification" badge
- [ ] **COMM-06**: Small static anatomy badges appear on counts, swaps, and care-team answers

### "I Saw Something"

- [ ] **SAW-01**: User can describe a tablet they saw with shape/color/size chips, optional imprint, and optional photo, and get possible matches against their own meds
- [ ] **SAW-02**: User gets a neutral cited explanation (an intact tablet or shell may or may not mean the drug wasn't absorbed) ending in a question card; no stoma-bag imagery anywhere

### Appointment Sheet

- [ ] **SHEET-01**: User sees an appointment sheet with open questions, personal patterns as hypotheses with counts, and meds with their flags
- [ ] **SHEET-02**: User can export the sheet as markdown and as PDF (print route)
- [ ] **SHEET-03**: After an appointment, user can log the answer to a question, which feeds care-team answers

### Multilingual & Polish

- [ ] **I18N-01**: Answers render in the user's profile language, with citation tokens preserved and re-checked after translation
- [ ] **POL-01**: Every screen has empty, loading, and error states; accessibility baseline (44px targets, AA contrast, text scaling)
- [ ] **POL-02**: User can delete their data
- [ ] **POL-03**: Answer and log submissions are rate-limited per anonymous id

### Docs & Tests

- [ ] **DOC-01**: README covers the evidence base with citations, architecture with the exact Convex feature list, the three-tier policy, the community model (why no DMs or threads), failure modes with mitigations, synthetic-data disclosure, and path to production
- [ ] **DOC-02**: DEMO.md gives the two-minute phone demo script, with the corrected diagram narration
- [ ] **TEST-01**: Tests show the reviewer blocks dose-change and uncited claims on fixtures, moderation classifies 10 fixture entries correctly, stratified counts are correct, and the swap check rejects a soda swap

## v2 Requirements

Deferred. Tracked but not in the current roadmap (M8 stretch if time allows).

### Stretch

- **STR-01**: Packaged-food label scanning
- **STR-02**: ElevenLabs "read aloud" on answers for low-vision users
- **STR-03**: "First 90 days" guide assembled per anatomy from guidelines and top-confidence community data
- **STR-04**: Recovery code to move an anonymous profile to a new device
- **STR-05**: Multiple profiles per caregiver
- **STR-06**: Counts-only output chip (number of bag empties, no volumes)

## Out of Scope

| Feature | Reason |
|---------|--------|
| DMs, comment threads, public profiles | Main channels for bad advice and re-identification; community is evidence, not a social network |
| Dosing, quantities, meal plans, medication-change instructions | Villi never decides; that's the care team's job |
| Drug-interaction checker | Different product; silence would read as "no interactions" |
| Output / fluid volume tracking | Breaks the no-quantities rule and could push high-output users toward plain water |
| Medication reminders, pouch/supply inventory | Ostomy diary apps already do this; dilutes focus |
| Stoma photos and stoma-bag imagery | Distressing and identifying |
| Free-text medical history, names, DOB | Keeps records anonymous and stratification coarse |
| 3D anatomy | Hours of work, reads as a gimmick, poor on phones |
| Real clinician credential verification | Honor-system for the hackathon, badged "demo verification" |
| Native mobile apps | Mobile-first web is enough for demo and Monday use |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Pending |
| FND-02 | Phase 1 | Pending |
| FND-03 | Phase 1 | Pending |
| FND-04 | Phase 1 | Pending |
| FND-05 | Phase 1 | Pending |
| FND-06 | Phase 1 | Pending |
| FND-07 | Phase 1 | Pending |
| SAFE-07 | Phase 1 | Pending |
| PILL-01 | Phase 2 | Pending |
| PILL-02 | Phase 2 | Pending |
| PILL-03 | Phase 2 | Pending |
| PILL-04 | Phase 2 | Pending |
| PILL-05 | Phase 2 | Pending |
| PILL-06 | Phase 2 | Pending |
| PILL-07 | Phase 2 | Pending |
| PILL-08 | Phase 2 | Pending |
| PILL-09 | Phase 2 | Pending |
| SAFE-01 | Phase 2 | Pending |
| SAFE-02 | Phase 2 | Pending |
| SAFE-03 | Phase 2 | Pending |
| SAFE-05 | Phase 2 | Pending |
| SAFE-06 | Phase 2 | Pending |
| ONB-01 | Phase 3 | Pending |
| ONB-02 | Phase 3 | Pending |
| ONB-03 | Phase 3 | Pending |
| ONB-04 | Phase 3 | Pending |
| ONB-05 | Phase 3 | Pending |
| ANS-01 | Phase 3 | Pending |
| ANS-02 | Phase 3 | Pending |
| DRNK-01 | Phase 4 | Pending |
| DRNK-02 | Phase 4 | Pending |
| LOG-01 | Phase 4 | Pending |
| LOG-02 | Phase 4 | Pending |
| SAFE-04 | Phase 4 | Pending |
| COMM-01 | Phase 4 | Pending |
| COMM-02 | Phase 4 | Pending |
| COMM-03 | Phase 5 | Pending |
| COMM-04 | Phase 5 | Pending |
| COMM-05 | Phase 5 | Pending |
| COMM-06 | Phase 5 | Pending |
| SHEET-03 | Phase 5 | Pending |
| SAW-01 | Phase 6 | Pending |
| SAW-02 | Phase 6 | Pending |
| SHEET-01 | Phase 6 | Pending |
| SHEET-02 | Phase 6 | Pending |
| I18N-01 | Phase 7 | Pending |
| POL-01 | Phase 7 | Pending |
| POL-02 | Phase 7 | Pending |
| POL-03 | Phase 7 | Pending |
| DOC-01 | Phase 7 | Pending |
| DOC-02 | Phase 7 | Pending |
| TEST-01 | Phase 7 | Pending |

Mapping notes:
- SAFE-05 lands with the reviewer in Phase 2; Phase 4 moderation writes to the same decision log.
- SHEET-03 ships with COMM-04 in Phase 5 (log the answer from saved questions); Phase 6 grows that list into the full sheet.
- TEST-01 fixtures are written alongside their features (Phases 2, 4, 5) and verified together as one suite in Phase 7.

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 52
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-23*
*Last updated: 2026-10-23 after roadmap creation (traceability mapped)*
