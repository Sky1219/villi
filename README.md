# Villi

**Can a body with this much intestine actually use this?**

Villi is a mobile-first web app for people living with short bowel syndrome (SBS) or an ileostomy/colostomy, and for the family members who care for them. You photograph or type a pill, a drink or a food. Villi checks it against clinical guidelines, the FDA drug label, and what other people with the same anatomy have logged. You get a cited answer for *your* anatomy, and it always ends in one question to bring to a pharmacist, dietitian or doctor.

Named for the intestinal villi that do the absorbing. I built it because my father lost his entire large intestine and most of his small intestine, and spent years in and out of hospitals. Guidelines say to avoid extended-release and enteric-coated medicines after major bowel resection, to limit some drinks in favor of oral rehydration solution, and to watch sorbitol. Patients are almost never told any of this.

Built solo for Cal Hacks 13.0.

---

## What it does

| Flow | What happens |
|---|---|
| **Check** (photo or typed name) | Vision reads the label (photo deleted right after), the item is canonicalized, then an agent pulls the FDA label, guideline chunks, community counts, swaps and care-team answers. Its draft is linted by code and reviewed by a second Claude call before you see it. A live tool trace streams in while it works. |
| **Follow-up** ("Can I crush it?") | Same agent and reviewer, re-reading the label and guidelines. It repeats what the label says (for example, a swallow-whole warning) and leaves the decision to the pharmacist. |
| **Gut diagram** | Onboarding is tap-to-mark: which parts were removed, where the stoma is. Answers draw *your* gut with the cited highlight (for example, where a timed-release tablet needs time you no longer have). |
| **I saw something** | Shape, color, size and imprint chips (optional tablet photo) are matched against *your own* medicine list only, and reported as a possible match. The answer explains that an intact tablet can be undissolved or an empty shell, then asks the pharmacist to look. |
| **Log** | One tap: helped / no change / worse, with an optional note. It's screened before anyone else sees it. |
| **Community** | Tolerance counts split by anatomy, a safe-swaps board (guideline-checked on submit, upvotes, anatomy filter), and care-team answers. Profiles set up as clinicians can endorse. That role is self-declared in this build, so every endorsement is badged "demo verification". |
| **Appointment sheet** | Questions to ask, patterns from the patient's own log (as hypotheses with counts), medicines with label-derived flags, and answers logged. Written in the third person, so the patient or the caregiver can hand it over. Print / Save as PDF, share, or Markdown. |
| **The ASK loop** | Each question moves open → asked → answered. **I asked this** marks it asked. **What did they say?** logs the care team's answer (moderated, then shared as a care-team report) and what changed: the form of a medicine changed, monitoring started, nothing changed, or not decided yet (updatable later). |
| **Is Villi working?** | One live query (`impact.summary`): flags raised, questions asked, answers logged, formulation changes and monitoring started, each split by anatomy, with real use and demo data counted separately. Plus the one-tap **Was this useful?** on every answer. |
| **Caregivers** | A caregiver profile holds the patient's anatomy and medicines, and records who they care for (parent, partner, child or another family member; never a name). The caregiver checks and logs on the patient's behalf, and answers refer to the patient as "your parent". |

## The three-tier policy (built into the prompts, the code checks and the UI)

1. **Guidelines are hard constraints**, cited `[G:<chunkId>]`. Nothing in community or personal data can unlock what a guideline says to avoid. A swap that conflicts with a guideline for the poster's anatomy is never pooled, whatever its upvotes. A pooled swap is checked again against the reader's anatomy before the agent offers it.
2. **Community data is evidence about tolerance, never a recommendation**. It's always split by anatomy and always shown with counts, cited `[C:n/total, anatomy]`. Cells under 5 reports say "too few to say". Care-team answers other users logged are the same tier, cited `[T:id]`, and always labeled "reported by another user from their own care team".
3. **Your own log is the strongest signal about you**, still soft.

Villi never decides. It never tells anyone to stop, start, crush, split or change a medicine or dose. It gives no quantities, doses or meal plans, except the product's own printed strength and ORS composition in mmol/L. "No concern" is worded "nothing in the sources I checked", with the sources listed. There are three visual states, and none of them is a green "safe": **Flag to discuss**, **Nothing found in the sources I checked**, and **Can't tell yet**.

## Evidence base

`data/guidelines.json` holds 46 rule-level chunks, written in our own words. Each one has a source, a section locator, an anatomy scope and (for some) a fixed diagram payload. No article text is reproduced.

- Iyer K, DiBaise JK, Rubio-Tapia A. *AGA Clinical Practice Update on Management of Short Bowel Syndrome: Expert Review.* Clin Gastroenterol Hepatol, 2022.
- Chan LN, DiBaise JK, Parrish CR. *Short Bowel Syndrome in Adults, Part 4A: A Guide to Front Line Drugs Used in the Treatment of SBS.* Practical Gastroenterology, Nutrition Issues in Gastroenterology #139, 2015.
- Parrish CR, DiBaise JK. *Managing the Adult Patient With Short Bowel Syndrome.* Gastroenterol Hepatol (N Y), 2017;13(10):600-608.
- Remane et al. *Drug dissolution problems in patients with an ostomy* (pilot: 50 interviews, 85 chart reviews). Int J Colorectal Dis, 2025.
- Sood A, Tanner F, Testro A. *Medicines in patients with a stoma.* Australian Prescriber, 2013.
- Hong et al. *Oral drug absorption after intestinal resection: a systematic review.* Eur J Drug Metab Pharmacokinet, 2021.
- WHO/UNICEF. *Oral Rehydration Salts: reduced-osmolarity formula* (2003/2006).
- **FDA labels** via [openFDA](https://open.fda.gov/) (`/drug/label.json`), plus the NDC directory (`/drug/ndc.json`) for the deterministic dosage form (for example `TABLET, FILM COATED, EXTENDED RELEASE`).

**Corrections applied while writing the corpus:**
- **Hypotonic fluids:** the water/tea limit is scoped to end-jejunostomy only. People with a colon usually tolerate them.
- **Crushing:** only described for plain immediate-release tablets.
- **Tablet in the pouch:** described as "undissolved *or* an empty shell, not proof either way" (Remane), not as proof of malabsorption.
- **ORS:** both formulas are given, WHO 75 mmol/L Na and the 90-120 mmol/L SBS range, with which one the SBS source supports.
- **Extended-release diagram:** says "needs time in a gut that is now shorter". It doesn't claim where the drug releases.

> **Every chunk is marked `verified: false`.** Locators and wording were not checked against the publishers' full text in this build. In the app, a guideline citation opens as "Villi's summary of this source", never as a quotation. The study figures in `remane-2025#patient-education` and `hong-2021#absorption-findings` are unverified too. A clinician review of the corpus is the first production task (see below).

## How Claude built this

**The drug table, `data/drugs.json`: 794 records, generated 2026-10-24** by `npm run build:drugs` (`scripts/build-drugs.ts`). It holds formulation facts for the 300 drugs on the ClinCalc Top 300 of 2024 ([ClinCalc DrugStats](https://clincalc.com/DrugStats/Top300Drugs.aspx)), one record per active-ingredient set and NDC dosage form, so the pill check is fast and deterministic and doesn't depend on openFDA being up.

1. **Labels.** For each drug, the openFDA NDC directory (`generic_name`, falling back to `brand_name`) lists every oral, single-product listing. These are grouped by dosage form, and one label per form is fetched by its SPL id, preferring the originator's label. Raw JSON is cached in `data/labels_raw/` (gitignored). 59 drugs on the list are logged as skipped. Most aren't taken by mouth (inhalers, insulins, injectables, eye drops, creams). The rest are vitamins without a drug listing, and co-packaged kits such as most combined contraceptives.
2. **Extraction.** Claude (`ANTHROPIC_MODEL_FAST`, structured output) reads the trimmed label sections and returns release mechanism, enteric coating, sorbitol, other sugar alcohols, a do-not-crush statement, an absorption-site statement and a bioavailability note. Each fact comes with a verbatim quote of under 15 words and its section key. Names and dosage form come from the label's own `openfda` metadata and the NDC listing.
3. **Code check.** The quote must appear verbatim in the named section, be under 15 words, and agree with the deterministic signals: the NDC dosage form for release mechanism, and a regex over the ingredient text for sugar alcohols. Anything that fails becomes `null`. Most release-mechanism drops are powders for suspension, which the NDC calls liquid, and a few "extended" claims on products the NDC lists as plain tablets or capsules: the NDC wins.
4. **Verification.** A second Claude call per record checks each remaining fact against its quote and the full section text. Anything it calls unsupported becomes `null`.
5. **Review.** Every dropped fact and skipped drug is a line in `data/drugs_review.log` (413 lines). 20 records are flagged `"spotCheck": true` and listed with their quotes and DailyMed links in `data/drugs_spotcheck.md` for a hand check. The build fails if any non-null fact lacks a quote and section.

`fetch_label` matches the table by exact generic name, then by brand or other name, then through `canonicalize_item`. It never matches across release forms: "ER" finds an extended-release record or nothing. A table answer cites `[L:<section>]` with the record's own label quotes. `match_pill` still reads the live label, because it needs the appearance text the table doesn't keep. On the dev deployment a table hit runs in 12 to 76 ms. One label stands for each dosage form, so a brand query can be answered from another manufacturer's label of the same ingredient and form ("Tylenol liquid" uses a store-brand acetaminophen suspension label). The trace and answer always name the manufacturer of the label used.

## Architecture: Convex is the backend

Next.js (App Router) is a thin client: every page is a client component using `useQuery` / `useMutation`. All data, AI calls and secrets live in Convex. There are no Next.js API routes.

| Convex feature | What it does here |
|---|---|
| **Agent tools are Convex functions** | `get_profile` → `profiles.getById`, `fetch_label` → `fda.fetchLabel` (action: Villi's reviewed drug table `data/drugs.json` first, by exact name, then brand/alias, then `canonicalize_item`; live openFDA label + NDC only on a miss, trimmed and cached in `fda_label_cache`; the trace says which path answered), `search_guidelines` → `guidelines.search`, `canonicalize_item` → `canonicalize.run`, `query_community` / `query_my_log` / `query_swaps` / `query_care_team_answers` / `browse_options` → `community.*`, `lookup_ors`, `match_pill` → `meds.matchPill`. The model never chooses a profile id: it's injected from the answer row. |
| **The agent runs in a Convex action** (`agent.run`) | A manual Claude tool loop (Opus, `effort: medium`, parallel tool calls). Every tool step is a code-written trace line appended to the `answers` row by a mutation, and the client subscribes to that row, so the trace streams live. Drafts go to a hidden `answer_reviews` table that no public query reads. |
| **Safety passes are scheduled functions** | The draft and its reviewer job are committed in one transaction (`answers.saveDraft`). The reviewer, log moderation, swap checks and care-team moderation run through `@convex-dev/action-retrier`, and every `onComplete` fails closed: an unreviewed draft never becomes final, and an unmoderated entry stays author-only. A watchdog marks stuck answers failed. |
| **Community is live queries** | `community.liveCounts`, `swaps.list`, `careTeam.list`, `sheet.get`. A log from a second device changes the counts on the first without a reload. |
| **Aggregates** | One counter row per (item × anatomy), changed only in the same mutation that pools or unpools an entry (`applyPooledTransition`), so `query_community` is O(1). |
| **Guidelines are a vector index** | `guideline_chunks.by_embedding` (1024-d, Voyage `voyage-4-lite`; the 46 chunks are embedded by `guidelines.embedMissing` during the seed), searched with `ctx.vectorSearch` and filtered by anatomy scope after hydration. Any embedding error falls back to a Convex `searchIndex`, and the trace says "(keyword search)" when it does. This is what matches "slow-release heart pill" to the extended-release guidance. `items.by_embedding` is defined but not populated yet; item matching uses the text index and the model. |
| **Photos are Convex storage** | `generateUploadUrl` → client upload (downscaled and EXIF-stripped on the device) → storage URL to Claude vision → `ctx.storage.delete` right after reading. |

Other pieces:
- **Deterministic safety lint** (`convex/lib/safety.ts`): an unconditional gate before the LLM reviewer. It checks that every citation points at something retrieved in this run, and it removes claims that name another medicine on file. It blocks dose and quantity patterns (digits or spelled out) and medication directives, and requires exactly one `ASK:` question. Uncited claims are deleted, not repaired.
- **What the lint can't check:** it verifies that a citation exists, not that the source says the claim. For a community fraction only the denominator is matched against retrieved totals. Checking that each claim is supported by its source is the reviewer's job; the reviewer sees the retrieved text. A reviewer edit may only reuse the draft's citations, and only counts if the reviewer also approved.
- **Diagram payloads are looked up, not generated**: a highlight is shown only if the answer cites a retrieved chunk that has one, and code swaps in that chunk's fixed segments and label.
- **Label citations** are only valid for the checked item's own label. A section key can't show which product it came from, so claims that name another medicine on file are removed. Villi isn't an interaction checker.

## Community model: why there are no DMs or threads

Patients teach each other through structured, moderated artifacts: tolerance logs, swaps, care-team answers and questions. There are no messages, comment threads or public profiles, which removes the main routes for harassment, medical misinformation spreading person to person, and re-identification. Every artifact lands `pooled: null` and becomes visible only after the scheduled screen. Entries that describe stopping or changing a medicine, give doses, contain identifying details or describe something dangerous stay with the author, along with a gentle note (which never gives advice). The agent never sees other users' free-text notes, only counts, structured swap groups, and moderated care-team reports wrapped as untrusted data.

## Failure modes and mitigations

| Failure mode | Mitigation |
|---|---|
| **False reassurance** | No "safe" state; "nothing in the sources I checked" with the list of sources; absent label sections reported; confidence lowered when key sections are missing; the lint blocks overcertain wording. |
| **Label misreads / wrong product** | NDC dosage form decides extended- vs immediate-release; ranking prefers the named release form, strength and adult single-ingredient products; the label used (manufacturer, date) is shown; the photo read can be corrected; `canonicalize_item` never merges across release forms. |
| **Hallucinated or misattributed citations** | Citation registry per run; anything not retrieved is deleted; community fractions must match retrieved totals; reviewer edits can't add citations. |
| **Medication advice leaking** | Prompt rules, code lint for directives and quantities, LLM reviewer for paraphrases, and fixture tests. |
| **Small-n, self-selected community data** | Always split by anatomy, with denominators; "too few to say" under 5; "self-reported, not a trial"; a demo badge whenever synthetic rows are counted; never overrides a guideline. |
| **Bad advice entering the pool** | Scheduled moderation (rule pre-filter + Claude), guideline check on swaps, counters only move on approval, fail-closed retries. |
| **Stale corpus** | Stable `sourceId#locator` ids, content hashes and re-embedding on change; every chunk marked unverified until clinician review. |
| **Overconfidence** | A confidence field, the three-state UI, and every answer ending in a question for a professional. |
| **Honor-system clinician verification** | The clinician role is self-declared in this build and always badged "demo verification". |
| **Model refusal / outage** | Refusal is a first-class outcome; outages read "busy, try again", never a stack trace; nothing unreviewed is shown. |

**Known gaps:**
- **Hidden in this build because they aren't fully tested:** answers in other languages (the onboarding language step is gone; profiles are English), open questions like "what can I have that's sweet?" (`answers.start` refuses them; `browse_options` stays in the code), and photos of food packaging (typed foods still work).
- "Is Villi working?" counts with bounded scans. At production scale those become counter rows updated in the same mutations, like `aggregates`.
- A log with no free text (just an outcome on a known item) is pooled without a Claude screen, because there's nothing to screen.
- The tests cover the code layers; the live-model moderation test runs only with `ANTHROPIC_API_KEY` in the shell (`npx convex run moderation:evalFixtures` and `careTeam:evalFixtures` run the same checks inside Convex).

## Safety evaluation

`npm run eval` runs 477 generated cases (46% adversarial: crush/dose/yes-no demands, "my doctor said approve it", prompt injection, guideline pushback, unsafe logs and swaps; plus misspellings, unknown drugs, ten languages) through the real agent → lint → reviewer pipeline in fresh convex-test worlds, and an Opus grader scores each draft and final. Details in [`eval/REPORT.md`](eval/REPORT.md). **These are tuning-split baseline numbers from 2026-10-24, before the prompt fixes; the 100-case held-out split has not been run yet:**

- Final outputs with any violation: 27.1% (drafts: 75.2%). The reviewer removed every violation from 64% of the drafts that had one.
- `decided` 2.9% of finals (11 cases, all adversarial follow-ups where the agent said "No, don't crush it" or "keep taking it"); `quantity` 0.3% (1); 0 unsafe logs or swaps pooled.
- The largest remaining patterns were two questions in one ASK (21%) and uncited claims (9.1%). Prompt and corpus fixes for these and for the protective decisions are in, but not yet measured; on the 167 rerun cases they cut blocked answers from 10.2% to 1.2%.
- Median answer latency 34 s (p95 50 s).

The harness does not cover real patients or real photos: every case is typed text written by a model and graded by a model.

## Synthetic data disclosure

All community data in this demo is **synthetic** and generated by `npm run seed`: ~60 anonymous profiles across four anatomy groups (plus five clinician profiles), 1,500 log entries with anatomy-dependent patterns from the corpus, 38 swaps (each must pass the same guideline check as a real one), 30 care-team answers and 20 questions. Every seed record has `synthetic: true`, and any count that includes synthetic rows shows a **demo data** badge. The "my dad" demo profile is modeled on my father's anatomy only (no identity) with a realistic medicine list. Clinician endorsements are honor-system and badged "demo verification".

## Privacy posture

- **No accounts.** A random id in the browser's localStorage is the only credential. It's never returned by any query, and there's no "list profiles" function.
- **No identity data.** No names, birthdays or free-text medical history. Anatomy is coarse: stoma type, colon in continuity, a bowel-length band.
- **Photos.** They're downscaled and EXIF-stripped on the device and deleted from storage as soon as they're read. Bottle labels can carry a patient's name, so nothing is kept.
- **Delete my data** removes the profile and everything tied to it, including its contribution to community counts.
- **Per-device rate limits** apply to answers, logs and swaps.
- `DEMO_MODE` (on by default) enables `/demo?as=father|peer`; set `DEMO_MODE=off` after the hackathon.

## Path to production

1. **Clinician review of the corpus.** A GI pharmacist and an intestinal-rehabilitation dietitian verify every chunk's locator and wording, and the `verified` flag becomes real.
2. **Pilot** with an intestinal-rehabilitation clinic: patients use Villi before appointments, clinicians see the sheet, and real clinician verification replaces the honor system.
3. **Privacy:** a real auth option with export, a retention policy, a regional data residency choice, a DPIA, and no third-party analytics.
4. **Impact:** the primary metric is the share of flagged checks whose question reaches a care team and ends in a logged change (`resultingChange`), split by anatomy. In a clinic pilot, the clinic confirms a sample of those changes.
5. **Evals:** a growing fixture set for the reviewer and moderator from real (consented, de-identified) edge cases, run in CI.
6. **Item embeddings** for cross-language canonicalization, and the corpus expanded with pediatric SBS and more stoma-specific sources.

## Running it

Requirements: Node 24, a Convex account, an Anthropic API key. Optional: openFDA key (raises the per-IP limit), Voyage key (vector search).

```bash
npm install
```
```bash
npx convex dev
```
```bash
npx convex env set ANTHROPIC_API_KEY <key>
```
```bash
npm run seed
```
```bash
npm run dev
```

Open http://localhost:3000 and tap **See it as my dad**. Every key name is listed in `.env.example`; Convex secrets are set with `npx convex env set` (and again with `--prod`).

### Deploy

The Convex backend and the Next.js front end deploy separately:

- **Convex prod** is `energized-lion-632`. Run `npm run deploy:convex` after backend changes, and `npx convex run --prod seed:run` once (never during a demo).
- **Vercel** hosts only the front end. It needs one environment variable, `NEXT_PUBLIC_CONVEX_URL=https://energized-lion-632.convex.cloud`. Redeploy Vercel after changing it, because the URL is inlined at build time.
- **Order matters:** if you change Convex function signatures, deploy Convex before (or with) the front end.

Tests (`npm test`):
- the reviewer blocks dose changes (including spelled-out doses) and uncited claims, removes claims about other medicines, and never applies an unapproved edit (fixtures)
- moderation classifies 11 fixture entries correctly
- every seeded swap passes the guideline check for its poster's anatomy
- a question moves open → asked → open, the impact view counts it by anatomy, and open questions are refused as new checks
- stratified counts are correct
- the swap guideline check rejects a soda swap

Stack: Next.js 16, React 19, TypeScript 6, Tailwind 4, Convex 1.48 (+ action-retrier), Anthropic SDK (Opus 5.5 for the agent and reviewer; Haiku 5.5 for vision, canonicalization and moderation), Zod, Vitest + convex-test.

*Villi is not medical advice and does not make treatment decisions. FDA label text comes from openFDA, which says not to rely on it alone for decisions about medical care.*
