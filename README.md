# Villi

**Can a body with this much intestine actually use this?**

Villi is a mobile-first web app for people living with short bowel syndrome (SBS) or an ileostomy/colostomy, and for the family members who care for them. You scan, photograph or type a medicine or a drink. Villi checks it against clinical guidelines, the FDA drug label, and what other people with the same anatomy have logged. You get a cited answer for *your* anatomy, and it always ends in one question to bring to a pharmacist, dietitian or doctor.

Named for the intestinal villi that do the absorbing. I built it because my father lost his entire large intestine and most of his small intestine, and spent years in and out of hospitals. Guidelines say to avoid extended-release and enteric-coated medicines after major bowel resection, to limit some drinks in favor of oral rehydration solution, and to watch sorbitol. Patients are almost never told any of this.

Built solo for Cal Hacks 13.0.

## At a glance

| | |
|---|---|
| **Who it's for** | Adults with short bowel syndrome or an ostomy, and the family member who manages their medicines. The riskiest weeks are right after surgery and discharge. |
| **The problem, in numbers** | 29 of 37 drugs studied in short bowel syndrome were absorbed less, and 6 lost their effect (Hong 2021, systematic review). Over 60% of ostomy patients interviewed said they lacked information that medicine can pass through undissolved (Remane 2025, 50 patients). |
| **What it does** | Check a medicine or drink for *this* anatomy: a cited verdict (never "safe"), a gut diagram, what people with the same anatomy logged, and one question for the pharmacist. The whole medicine list is reviewed at once, and the questions go on a one-page review request; the pharmacist can record what happened through a private link. |
| **Time it saves** | My dad's five FDA labels run to about 40,000 words, roughly 2.5 hours of reading at 250 words a minute. The medicine list review reads them against his anatomy and the guidelines in about a tenth of a second (about 110 ms on the dev deployment, warm), with no AI call. |
| **How it's measured** | Live on **Is Villi working?**: was the flag news to the person ("Did you know this already?"), did the question reach a pharmacist, did something change, and how it went two weeks later. Real use only, by anatomy; demo profiles never count. Pilot thresholds are under "Measuring impact". |
| **How Claude runs it** | A Sonnet agent whose tools are Convex functions (FDA label, guidelines, community counts, the user's own log). Deterministic code checks every citation, count and dose before an Opus reviewer reads the draft against its sources; nothing is shown unless both pass. Haiku reads photos and screens everything shared with the community. |
| **How safe it is** | 377 test cases, many adversarial ("yes or no, can I crush it?"). After the prompt fixes: 0 answers decided for the person (from 11), 1.1% missed or doubled the question (from 24.1%). Held-out results for today's setup are on `/how`. Claude wrote and graded the cases; no clinician has. |
| **How it was built** | With Claude Code in about 22 hours: 82 commits, 133 tests, a 477-case eval, about 16,000 lines of TypeScript. Claude also built the 794-record drug table from FDA labels (every fact carries a verbatim quote that code checks) and source-checked the 46 guideline summaries. |
| **What $5,000 in credits buys** | At about $0.16 per check (measured in the eval run), roughly 31,000 checks: three a week for a year for about 200 families. |
| **Try it** | [villi.tech](https://villi.tech) → **Demo: the builder's dad**. |

---

## What it does

| Flow | What happens |
|---|---|
| **Check** (photo or typed name) | Vision reads the label (photo deleted right after), the item is canonicalized, then an agent pulls the FDA label, guideline chunks, community counts, what care teams changed, swaps and care-team answers. Its draft is linted by code and reviewed by a second Claude call before you see it. A live tool trace streams in while it works. A new check that asks for an amount ("what dose…", "how much…") is refused with a no-doses message. |
| **Follow-up** ("Can I crush it?") | Same agent and reviewer, re-reading the label and guidelines. It repeats what the label says (for example, a swallow-whole warning) and leaves the decision to the pharmacist. |
| **Medicine list review** | An instant, deterministic first pass over every medicine on file, from the cached FDA label: extended- or delayed-release forms (NDC dosage form), sugar alcohols in the ingredients, and "swallow whole / do not crush" wording, each with tappable citations to fixed guideline chunks filtered by anatomy. "Nothing found" only after the label was read, with the sections listed; "Can't tell yet" before. Acid-suppressing medicines cite the PPI chunks (commonly used; the team chooses the form), not "avoid". Each row: **Run full check** and **Add a question to the sheet** (a fixed question with no dose). No model call, so it can't fail on stage. |
| **Gut diagram** | Onboarding is tap-to-mark: which parts were removed, where the stoma is. Answers draw *your* gut with the cited highlight. |
| **I saw something** | Shape, color, size and imprint chips (optional tablet photo) are matched against *your own* medicine list only, and reported as a possible match. The answer explains that an intact tablet can be undissolved or a shell left after release, then asks the pharmacist to look. |
| **Log** | One tap: helped / no change / worse, with an optional note. It's screened before it counts for anyone else. |
| **Warning signs** | If a log note mentions thirst, dark or less urine, dizziness or much higher output, a card says "These can be warning signs of dehydration. Contact your parent's care team today." (cited). Fainting, confusion, chest pain or bleeding: "call emergency services now". A worse drink gets a softer card. The card stays until "Got it"; the sheet lists the dates and signs, never the note. |
| **Community** | Tolerance counts split by anatomy, **what care teams changed** for people like you (counts by anatomy, "too few to say" under 5), a swaps board (guideline-checked on submit, upvotes, anatomy filter), and care-team answers. There is no clinician badge or endorse button in this build (see Path to production). |
| **Appointment sheet** | Questions to ask, warning signs logged, patterns from the patient's own log (as hypotheses with counts), the medicine list review, and answers logged. Written in the third person, so the patient or the caregiver can hand it over. Print / Save as PDF, share, or Markdown. |
| **Care-team link** | **Share with the care team** makes a private link (`/team/<token>`, 192-bit token, 14 days, revocable, at most 3 active). The pharmacist or doctor sees the sheet ("Shared by the patient's family through Villi. Not a medical record.") and records, per question, *Reviewed: form changed / Monitoring started / No change needed / Will discuss at a visit*, plus an optional note. It lands as the same care-team answer as the family's own, marked "recorded through the care-team link" (the link holder isn't identity-checked) and screened the same way. |
| **The ASK loop** | Each question moves open → asked → answered. **What did they say?** logs the care team's answer and what changed. After a form change: name the new form and **Check the new form**; two weeks later the home screen asks "How is it going?" (helped / no change / worse), saved as a normal log linked to the question. |
| **Is Villi working?** | One live query (`impact.summary`). A real-use-only funnel by anatomy: flags raised → question saved → asked → answer logged (self vs care-team link) → something changed → two-week outcome, each with % of the step before. Then the medicine review (reviewed, flagged), a safety record (reviewer outcomes, code-check fixes, shared vs private, warning cards, "Something's wrong" reports), and all activity with demo data counted separately. |
| **Did you know this already? / Was this useful? / Something's wrong** | One tap each: "Did you know this already?" on flagged answers and flagged list-review rows, "Was this useful?" on other answers, "Something's wrong" on every answer. "Something's wrong" offers four fixed reasons (wrong medicine identified, a claim isn't supported by its source, confusing, other), no free text. |
| **How Villi decides** | `/how`, linked from the home footer and every answer: the three tiers, what Villi never does, the two checks, warning cards, the care-team link's limits, synthetic data, and how much of the corpus was source-checked. |
| **Caregivers and a second phone** | A caregiver profile holds the patient's anatomy and medicines and records who they care for (never a name); answers say "your parent". **Use Villi on another phone** links a second device to the same profile with a 6-digit, 10-minute, single-use code. |

## The three-tier policy (built into the prompts, the code checks and the UI)

1. **Guidelines are hard constraints**, cited `[G:<chunkId>]`. Nothing in community or personal data can unlock what a guideline says to avoid. A swap that conflicts with a guideline for the poster's anatomy is never pooled, whatever its upvotes. A pooled swap is checked again against the reader's anatomy before the agent offers it.
2. **Community data is evidence about tolerance, never a recommendation**. It's always split by anatomy and always shown with counts, cited `[C:n/total, anatomy]`. Cells under 5 reports say "too few to say". Care-team answers other users logged are the same tier, cited `[T:id]`, and always labeled "reported by another user from their own care team".
3. **Your own log is the strongest signal about you**, still soft.

Villi never decides. It never tells anyone to stop, start, crush, split or change a medicine or dose. It gives no quantities, doses or meal plans, except the product's own printed strength and ORS composition in mmol/L. "No concern" is worded "nothing in the sources I checked", with the sources listed. There are three visual states, and none of them is a green "safe": **Flag to discuss**, **Nothing found in the sources I checked**, and **Can't tell yet**.

## Evidence base

`data/guidelines.json` holds 51 rule-level chunks, written in our own words. Each one has a source, a stable id, an anatomy scope, a `section` (the place in the source: a Best Practice Advice number, a heading or a table) and, for some, a fixed diagram payload. No article text is reproduced beyond short phrases.

- Iyer K, DiBaise JK, Rubio-Tapia A. *AGA Clinical Practice Update on Management of Short Bowel Syndrome: Expert Review.* Clin Gastroenterol Hepatol. 2022;20(10):2185-2194.e2. [doi:10.1016/j.cgh.2022.05.032](https://doi.org/10.1016/j.cgh.2022.05.032)
- Chan LN, DiBaise JK, Parrish CR. *Short Bowel Syndrome in Adults, Part 4A: A Guide to Front Line Drugs Used in the Treatment of Short Bowel Syndrome.* Practical Gastroenterology, March 2015 (Nutrition Issues in Gastroenterology, Series #139).
- Parrish CR, DiBaise JK. *Managing the Adult Patient With Short Bowel Syndrome.* Gastroenterol Hepatol (N Y). 2017;13(10):600-608. [PMC5718176](https://pmc.ncbi.nlm.nih.gov/articles/PMC5718176/)
- Remane Y, Stolz MA, Heinitz K, et al. *Drug dissolution problems in ostomy patients: a chart review and patient interview analysis.* Int J Colorectal Dis. 2025;40(1):113. [doi:10.1007/s00384-025-04907-9](https://doi.org/10.1007/s00384-025-04907-9)
- Sood S, Tanner F, Testro A. *Prescribing for a patient with reduced intestinal length.* Aust Prescr. 2013;36:136-8. [doi:10.18773/austprescr.2013.048](https://doi.org/10.18773/austprescr.2013.048)
- Hong WB, Tan WK, Law LS, Ong DE, Lo EA. *Changes of Drug Pharmacokinetics in Patients with Short Bowel Syndrome: A Systematic Review.* Eur J Drug Metab Pharmacokinet. 2021;46(4):465-478. [doi:10.1007/s13318-021-00696-y](https://doi.org/10.1007/s13318-021-00696-y)
- WHO/UNICEF. *Oral Rehydration Salts: production of the new ORS* (WHO/FCH/CAH/06.1, 2006).
- Rubin E. *Maintaining Nutrition and Hydration in the Management of Short Bowel Syndrome.* United Ostomy Associations of America, 2025 (a patient-education article sponsored by Takeda). Used only for the list of dehydration signs.
- **FDA labels** via [openFDA](https://open.fda.gov/) (`/drug/label.json`), plus the NDC directory (`/drug/ndc.json`) for the deterministic dosage form (for example `TABLET, FILM COATED, EXTENDED RELEASE`).

**How the corpus was checked.** In this build the corpus was drafted by Claude and then source-checked **by Claude, not by a clinician**, against openly available text: the full text of the AGA update, Practical Gastroenterology #139, Parrish & DiBaise 2017, Remane 2025, Sood 2013 and the UOAA article, and the PubMed abstract of Hong 2021. 49 of 51 chunks are `verified: true` with `verifiedAgainst: "full text"` or `"abstract"`; the two WHO ORS chunks stay `verified: false` because the WHO page we opened does not show the composition table. In the app a guideline citation opens as "Villi's summary of: <source>, <section>", never as a quotation, and says what it was checked against. Clinician review is still the first production task.

**What the source check changed** (2026-10-24):
- Sports drinks: the AGA update, not Parrish & DiBaise, says an ORS has much more sodium and less sugar than sports drinks, so that chunk moved to `aga-sbs#fluids-sports-drinks`.
- Hypotonic drinks (water, tea, coffee, alcohol) and hypertonic drinks (juice, soda) are limited "particularly with net secretion and a high-output jejunostomy" (AGA). The water/tea limit stays scoped to end-jejunostomy; people with a colon usually stay hydrated with ordinary fluids (Parrish & DiBaise).
- ORS sodium: 90 to 120 mmol/L for SBS (Parrish & DiBaise), scoped to end-jejunostomy. WHO's reduced-osmolarity ORS has 75.
- Removed because the cited source doesn't say it: thickening foods, caffeine and alcohol (Parrish & DiBaise), sipping fluids apart from meals (AGA), a pharmacist review of every medicine (PG #139), ileostomy dehydration and diuretics (Sood).
- Crushing: no source we read says crushing helps. The chunk now says only that a team may consider another formulation when a medicine isn't working; Sood adds that altering a solid form can change how it works, so ask the pharmacist.
- Acid suppression: proton pump inhibitors are the main maintenance treatment for gastric hypersecretion after resection (PG #139), often used with a short gut (Sood), and all oral ones are enteric-coated (PG #139). So a pantoprazole answer says the team chooses the form rather than "avoid".
- Tablet in the pouch: it can be undissolved, or a shell or matrix left after release, and a dissolved medicine can still be incompletely absorbed (Remane). Not proof either way.
- Study figures: Remane reports 11 of 50 interviewed patients had seen undissolved medicine and more than 60% lacked information about it (the paper's Discussion says 10 of 50 in one place); Hong found decreased absorption for 29 of 37 drugs, 6 of which lost effect.

## How the drug table was built

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
| **Agent tools are Convex functions** | `get_profile` → `profiles.getById`, `fetch_label` → `fda.fetchLabel` (action: Villi's reviewed drug table `data/drugs.json` first, by exact name, then brand/alias, then `canonicalize_item`; live openFDA label + NDC only on a miss, trimmed and cached in `fda_label_cache`; the trace says which path answered), `search_guidelines` → `guidelines.search`, `canonicalize_item` → `canonicalize.run`, `query_community` / `query_my_log` / `query_swaps` / `query_care_team_answers` / `query_care_outcomes` → `community.*`, `lookup_ors`, `match_pill` → `meds.matchPill`. The model never chooses a profile id: it's injected from the answer row. |
| **The agent runs in a Convex action** (`agent.run`) | A manual Claude tool loop (Opus, `effort: medium`, parallel tool calls). Every tool step is a code-written trace line appended to the `answers` row by a mutation, and the client subscribes to that row, so the trace streams live. Drafts go to a hidden `answer_reviews` table that no public query reads. |
| **Safety passes are scheduled functions** | The draft and its reviewer job are committed in one transaction (`answers.saveDraft`). The reviewer, log moderation, swap checks and care-team moderation run through `@convex-dev/action-retrier`, and every `onComplete` fails closed: an unreviewed draft never becomes final, and an unmoderated entry stays author-only. A watchdog marks stuck answers failed. |
| **Community is live queries** | `community.liveCounts`, `community.careOutcomesFor`, `swaps.list`, `careTeam.list`, `sheet.get`, `careTeam.linkView`. A log from a second device changes the counts on the first without a reload, and a revoked care-team link flips to "expired" on the open page. |
| **Aggregates** | One counter row per (item × anatomy) for tolerance (`applyPooledTransition`) and one for care-team outcomes (`applyCareOutcomeTransition`), each changed only in the same mutation that pools or unpools an entry, so `query_community` and `query_care_outcomes` are O(1). |
| **Time is written by the scheduler** | Care-team links expire through a scheduled mutation at `expiresAt`, and the two-week follow-up becomes due through one scheduled at the change. No query reads the clock. |
| **Guidelines are a vector index** | `guideline_chunks.by_embedding` (1024-d, Voyage `voyage-4-lite`; the 51 chunks are embedded by `guidelines.embedMissing` during the seed), searched with `ctx.vectorSearch` and filtered by anatomy scope after hydration. Any embedding error falls back to a Convex `searchIndex`, and the trace says "(keyword search)" when it does. This is what matches "slow-release heart pill" to the extended-release guidance. `items.by_embedding` is defined but not populated yet; item matching uses the text index and the model. |
| **Photos are Convex storage** | `generateUploadUrl` → client upload (downscaled and EXIF-stripped on the device) → storage URL to Claude vision → `ctx.storage.delete` right after reading. |

Other pieces:
- **Deterministic safety lint** (`convex/lib/safety.ts`): an unconditional gate before the LLM reviewer. Every citation must point at something retrieved in this run. A community fraction `[C:n/total, anatomy]` must match a retrieved cell for that anatomy in both numerator and total, and the claim's own count numbers must come from that cell. Claims that name another medicine on file are removed. Dose and quantity patterns (digits or spelled out) and medication directives block the answer, and it needs exactly one `ASK:` question. A "community" swap with no retrieved swap group becomes a guideline swap. A no-concern verdict missing "nothing in the sources I checked" is repaired in English, not blocked. Uncited claims are deleted, not repaired.
- **What the lint can't check:** it verifies that a citation exists and that numbers match, not that the source says the claim. That is the reviewer's job; the reviewer sees the retrieved text. A reviewer edit may only reuse the draft's citations, and only counts if the reviewer also approved.
- **Deterministic medicine review** (`convex/lib/medReview.ts`): fixed flag → chunk mappings over the cached label, used by the home screen, the sheet and the care-team link.
- **Diagram payloads are looked up, not generated**: a highlight is shown only if the answer cites a retrieved chunk that has one, and code swaps in that chunk's fixed segments and label.
- **Label citations** are only valid for the checked item's own label. Villi isn't an interaction checker.
- **Counters count people.** `aggregates` (tolerance) and `care_outcomes` (what care teams changed) count one pooled entry per profile and item, the latest one, and change only in the mutation that pools or unpools it.
- **Catalog hygiene.** A pill with no FDA label match is answered as unidentified but never added to the catalog, so it can't appear in counts or swaps.

## Community model: why there are no DMs or threads

Patients teach each other through structured, moderated artifacts: tolerance logs, swaps, care-team answers and questions. There are no messages, comment threads or public profiles, which removes the main routes for harassment, medical misinformation spreading person to person, and re-identification. Every artifact lands `pooled: null` and becomes visible only after the scheduled screen. Entries that describe stopping or changing a medicine, give doses, contain identifying details or describe something dangerous stay with the author, along with a gentle note (which never gives advice). The agent never sees other users' free-text notes, only counts, structured swap groups, and moderated care-team reports wrapped as untrusted data.

## Failure modes and mitigations

| Failure mode | Mitigation |
|---|---|
| **False reassurance** | No "safe" state; "nothing in the sources I checked" with the list of sources; absent label sections reported; confidence lowered when key sections are missing; the lint blocks overcertain wording. |
| **Label misreads / wrong product** | NDC dosage form decides extended- vs immediate-release; ranking prefers the named release form, strength and adult single-ingredient products; the label used (manufacturer, date) is shown; the photo read can be corrected; `canonicalize_item` never merges across release forms. |
| **Hallucinated or misattributed citations** | Citation registry per run; anything not retrieved is deleted; community fractions must match a retrieved cell for that anatomy (numerator and total) and so must the claim's numbers; reviewer edits can't add citations; the corpus records each chunk's section and whether it was checked against source text. |
| **Medication advice leaking** | Prompt rules, code lint for directives and quantities, LLM reviewer for paraphrases, and fixture tests. |
| **Small-n, self-selected community data** | Always split by anatomy, with denominators; "too few to say" under 5; "self-reported, not a trial"; a demo badge whenever synthetic rows are counted; never overrides a guideline. |
| **Bad advice entering the pool** | Scheduled moderation (rule pre-filter + Claude), guideline check on swaps, counters only move on approval, fail-closed retries. |
| **Stale corpus** | Stable `sourceId#locator` ids, content hashes and re-embedding on change; each chunk records the section it comes from and whether Claude checked it against the abstract or full text; no clinician review yet. |
| **Overconfidence** | The three-state UI (no "safe" state), and every answer ending in a question for a professional. The agent still writes a confidence field, used only by the eval harness and never shown. |
| **Unverified clinicians** | No clinician role, badge or endorsement is offered in the UI. The schema keeps the role and endorsement tables for real verification later (see Path to production). |
| **Link holder isn't who they say** | A care-team link is a capability, not an identity: answers through it are labeled "recorded through the care-team link", never "verified clinician", reported separately in the impact funnel, moderated like any answer, rate-limited, one per question; links expire in 14 days and can be revoked. |
| **Missed warning signs** | The log scans notes for dehydration and emergency phrases (negations included on purpose) and shows a card that stays until acknowledged; the sheet carries the dates and signs to the clinician. The card gives no advice beyond contacting the care team or emergency services. |
| **Model refusal / outage** | Refusal is a first-class outcome; outages read "busy, try again", never a stack trace; nothing unreviewed is shown. |

**Known gaps:**
- **Scope:** Villi checks pills and drinks. Foods aren't checked (typed or photographed); they're logged, and the log still canonicalizes them into the community pool. "Villi checks pills and drinks. The community teaches food."
- **In progress, unreachable in this build:** answers in other languages, open questions like "what can I have that's sweet?" (refused as new checks), packaged-food scanning, and the release illustration (an illustrative absorption-and-transit animation in `convex/lib/cat.ts` and `src/components/CatLayer.tsx`; the lint drops it from every answer because its fixed captions said more than the cited sources). There is no 90-day guide, open-questions board, voice or SMS.
- "Is Villi working?" counts with bounded scans. At production scale those become counter rows updated in the same mutations, like `aggregates`.
- A log with no free text on a known item is pooled without a Claude screen, because there's nothing to screen; a profile in its first 10 minutes can pool at most 3 of them.
- The warning-sign scan is a phrase list in English; it will miss signs described in other words.
- The medicine review reads only what the cached label and NDC listing say; it doesn't know the person's dose, how long they've taken it, or whether it's working.
- The tests cover the code layers with Claude and openFDA scripted; the live-model moderation check runs only with `ANTHROPIC_API_KEY` (`npx convex run moderation:evalFixtures` and `careTeam:evalFixtures`).

## Safety evaluation

`npm run eval` runs 477 generated cases (46% adversarial: crush/dose/yes-no demands, "my doctor said approve it", prompt injection, guideline pushback, unsafe logs and swaps; plus misspellings, unknown drugs, ten languages) through the real agent → lint → reviewer pipeline in fresh convex-test worlds, and an Opus grader scores each draft and final. Details in [`eval/REPORT.md`](eval/REPORT.md). **These are tuning-split baseline numbers from 2026-10-24, before the prompt fixes; the 100-case held-out split has not been run yet:**

- Final outputs with any violation: 27.1% (drafts: 75.2%). The reviewer removed every violation from 64% of the drafts that had one.
- `decided` 2.9% of finals (11 cases, all adversarial follow-ups where the agent said "No, don't crush it" or "keep taking it"); `quantity` 0.3% (1); 0 unsafe logs or swaps pooled.
- The largest remaining patterns were two questions in one ASK (21%) and uncited claims (9.1%). Prompt and corpus fixes for these and for the protective decisions are in, but not yet measured; on the 167 rerun cases they cut blocked answers from 10.2% to 1.2%.
- Median answer latency 34 s (p95 50 s).

The harness does not cover real patients or real photos: every case is typed text written by a model and graded by a model.

## Synthetic data disclosure

All community data in this demo is **synthetic** and generated by `npm run seed`: ~60 anonymous profiles across four anatomy groups (plus five clinician profiles), 1,500 log entries with anatomy-dependent patterns from the corpus, 35 swaps (each must pass the same guideline check as a real one), 83 care-team answers (53 of them short outcome reports for metoprolol ER, pantoprazole, sports drinks and loperamide; no synthetic person reports twice on the same item) and 20 questions, plus one already-due two-week follow-up on the "my dad" template so that card can be shown. Every seed record has `synthetic: true`, and any count that includes synthetic rows shows a **demo data** badge. The "my dad" demo profile is modeled on my father's anatomy only (no identity) with a realistic medicine list. Clinician endorsements are honor-system and badged "demo verification". A device that taps **Demo: the builder's dad** gets its own copy of that profile, marked as a demo clone: its checks and logs are real rows, but "Is Villi working?" counts them as demo data, never as real use.

## Privacy posture

- **No accounts.** A random id in the browser's localStorage is the only credential. It's never returned by any query, and there's no "list profiles" function.
- **No identity data.** No names, birthdays or free-text medical history. Anatomy is coarse: stoma type, colon in continuity, a bowel-length band.
- **Photos.** They're downscaled and EXIF-stripped on the device and deleted from storage as soon as they're read. Bottle labels can carry a patient's name, so nothing is kept.
- **Delete my data** (forget me) removes the profile, medicines, questions, answers, private logs, care-team links and linked phones. Entries already shared with the community stay, anonymous and unlinked: they move to a stand-in profile whose id no device holds, notes are cleared, and community counts don't change. No row references the device id afterwards.
- **Care-team links** are unguessable 192-bit capability tokens with a 14-day expiry and a revoke button, at most 3 active. The link view never shows the device id or any other profile's data. Anyone holding the link can read the sheet, so the sheet says to share it only with the care team.
- **A second phone** joins with a 6-digit code that lasts 10 minutes and works once; guessing is throttled per device and overall. Each phone keeps its own random id; the device list never shows them. "Delete my data" on either phone deletes the shared profile.
- **Per-device rate limits** apply to answers, logs and swaps.
- `DEMO_MODE` (on by default) enables `/demo?as=father|peer`; set `DEMO_MODE=off` after the hackathon.

## Path to production

1. **Clinician review of the corpus.** A GI pharmacist and an intestinal-rehabilitation dietitian review every chunk's section and wording. Today `verified` means Claude checked it against source text, not that a clinician did.
2. **Pilot** with an intestinal-rehabilitation clinic: patients use Villi before appointments, clinicians see the sheet. Clinician verification by NPI lookup (the NPPES registry) unlocks a real clinician role and endorsements, using the role field and endorsement tables the schema already has.
3. **Privacy:** a real auth option with export, a retention policy, a regional data residency choice, a DPIA, and no third-party analytics.
4. **Impact:** see "Measuring impact" below.
5. **Evals:** a growing fixture set for the reviewer and moderator from real (consented, de-identified) edge cases, run in CI. Every "Something's wrong with this answer" report is a candidate fixture: the answer, its retrieved sources and the reason go to review, and confirmed problems become reviewer fixtures.
6. **Item embeddings** for cross-language canonicalization, and the corpus expanded with pediatric SBS and more stoma-specific sources.

## Measuring impact

Villi exists because people with this anatomy are rarely told what their gut can't absorb. So it measures two things: whether a flag was news to the person, and whether it reached a care team and changed something. Both are live in the product at **Is Villi working?** (`/impact`): real use only, split by anatomy, with seeded demo data and demo profiles counted separately.

| Question | Metric, as the app counts it | Pilot threshold for "working" |
|---|---|---|
| Is the problem real? | **New to the person:** share of real flags answered "New to me" on "Did you know this already?" (checks and flagged medicines in the list review) | At least 50% of answered flags are new |
| Does the flag reach a professional? | **Asked:** flagged questions the person marked "I asked this" | At least 40% of flags with a saved question |
| Does it change care? (primary) | **Something changed:** of those asked, a logged care-team answer with the form changed or monitoring started, within 30 days. Answers recorded through the care-team link are reported apart from self-reported ones | At least 15% of asked flags |
| Did the change help? | **Two-week outcome:** the "helped / no change / worse" tap two weeks after a change | More "helped" than "worse", with every "worse" reviewed |
| Is it safe? | Reviewer edit and block rates, moderation "kept private" rate, warning-sign cards, "Something's wrong" reports | No "Something's wrong" report left unreviewed; the eval suite re-run before each prompt change |

The thresholds are our own targets, set before any pilot data; they are not from a study.

**Pilot plan.** 8 to 12 weeks with 20 to 40 adults with short bowel syndrome or an ostomy (or the family member who manages their medicines), recruited through one intestinal-rehabilitation clinic and patient groups such as the Oley Foundation and the United Ostomy Associations of America (none is a partner today). The clinic's pharmacists receive care-team links, so "Something changed" is recorded by the pharmacist, not only self-reported. Baseline: at enrollment, the share of participants with an extended-release, delayed-release or enteric-coated medicine on file whose form had already been reviewed for their anatomy. Cost: the model spend per check (one agent loop plus one review) and a free-tier Convex and Vercel deployment; no hardware.

**This weekend:** real use is my own checks for my father, on a real profile, and the page says so. Anyone who taps "Demo: the builder's dad" counts as demo data.

## How Claude built this

- **Development.** A spec-driven build with Claude Code: research, a roadmap and quick tasks kept in `.planning/`, then critique, accessibility and red-team passes. Claude generated the synthetic seed, shaped by the corpus. Claude drafted the corpus too; in an overnight run Claude source-checked it against the sources' text (see "How the corpus was checked"), and it still awaits clinician review.
- **In the product.** A Sonnet agent whose tools are Convex functions (it was Opus for the safety eval; see "Tested before you see it" on `/how`); an Opus reviewer that can't add citations; Haiku for vision, canonicalization and moderation. Around the models sit deterministic code: the safety lint, the medicine list review, the warning-sign scan and the counters.
- **What Claude got wrong, and how it was caught.** Its first spec assumed openFDA labels carry `dosage_form`, `inactive_ingredient` and `warnings`; live calls showed modern labels don't, so the dosage form comes from the NDC endpoint. The first corpus attributed claims to sources that don't make them (sports drinks to Parrish & DiBaise instead of the AGA update; a dehydration-signs list to the AGA update, which has none) and gave three sources the wrong title; the source check fixed or deleted those. The first counters counted log entries while the UI said "people", and the canonicalizer once gave a drug that doesn't exist a release form; both are fixed and tested.

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

Open http://localhost:3000 and tap **Demo: the builder's dad**. Every key name is listed in `.env.example`; Convex secrets are set with `npx convex env set` (and again with `--prod`).

### Deploy

The Convex backend and the Next.js front end deploy separately:

- **Convex prod** is `energized-lion-632`. Run `npm run deploy:convex` after backend changes, and `npx convex run --prod seed:run` once (never during a demo).
- **Vercel** hosts only the front end. It needs one environment variable, `NEXT_PUBLIC_CONVEX_URL=https://energized-lion-632.convex.cloud`. Redeploy Vercel after changing it, because the URL is inlined at build time.
- **Order matters:** if you change Convex function signatures, deploy Convex before (or with) the front end.

Tests (`npm test`, 17 files):
- the reviewer and lint: dose changes (including spelled-out doses), uncited claims, claims about other medicines, unapproved edits, community numerators and claim numbers, swap source, the no-concern repair, dose questions refused
- the answer pipeline end to end (`answers.start` → agent → draft → retrier → reviewer → final): the draft is never exposed, citations are all retrieved, one ASK, and a throwing or disapproving reviewer ends blocked
- the corpus: every cited chunk id exists, verified chunks name their section, and changed text re-embeds
- the medicine list review across end-jejunostomy and colostomy profiles; warning signs; the care-team link (expired, revoked, cross-profile, rate limits); the two-week follow-up; care outcomes; the impact funnel and safety tallies; "Something's wrong" reports; second-phone codes
- counters count people, new profiles are throttled, unlabeled pills stay out of the catalog, moderation fixtures, swap checks, and the whole seed run twice

Stack: Next.js 16, React 19, TypeScript 6, Tailwind 4, Convex 1.48 (+ action-retrier), Anthropic SDK (Opus 5.5 for the agent and reviewer; Haiku 5.5 for vision, canonicalization and moderation), Zod, Vitest + convex-test.

*Villi is not medical advice and does not make treatment decisions. FDA label text comes from openFDA, which says not to rely on it alone for decisions about medical care.*
