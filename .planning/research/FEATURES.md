# Feature Research

**Domain:** Consumer health app for people with short bowel syndrome (SBS) or an ostomy, and their caregivers: medication/food/drink suitability checking, tolerance logging, anatomy-stratified peer evidence, appointment preparation
**Researched:** 2026-10-23
**Confidence:** MEDIUM. The clinical claims behind the core flow are HIGH confidence (peer-reviewed or society guidance). The competitor feature inventory is MEDIUM to LOW, because most of it comes from app-store listings and developer descriptions, with few independent reviews. Research used the built-in WebSearch/WebFetch tools. It did not use the research-plan seam, so nothing was written to the research cache.

## Positioning Finding (read first)

No product found combines the three things Villi combines. Existing products fall into separate buckets, and none answers "can a body with this much intestine use this?":

| Bucket | Examples | What they do | What they do not do |
|--------|----------|--------------|---------------------|
| Ostomy self-management apps | OstoBuddy, My Ostomy Journey (ConvaTec), MyOstomyLife (Coloplast), Ostomy 101 | Pouch-change reminders, supply inventory, output/consistency and fluid logs (OstoBuddy), food log (My Ostomy Journey), stoma photo tracking and care checklists (MyOstomyLife), clinician reports, manufacturer advisor lines | Medication absorption, drink suitability, any anatomy-stratified evidence. The Mayo Clinic Connect thread asking for the best ostomy tracking app notes that My Ostomy Journey logs food and appliance changes but not output. |
| GI symptom/food trackers | Cara Care (IBS/IBD) | Food diary, symptom diary, stool tracker, correlation of food to symptoms, shareable reports | Anything specific to resection or stomas. It is IBS/FODMAP-centered. |
| Food scanners | Spoonful, Fig (FODMAP/diet) | Barcode scan returns green/yellow/red, dietitian-written reason, substitute finder, handling for missing products | Medications. Not anatomy-aware. |
| Medication utility apps | Pill-identifier apps (imprint/photo ID), interaction checkers (data from NLM RxNav, pill images from the NLM database), reminder apps | Pill ID, drug-drug interaction, reminders | Absorption-by-anatomy. A generic interaction checker is silent on "this tablet releases in a segment you no longer have." |
| Patient communities | PatientsLikeMe, Oley, UOAA, Facebook groups | Peer support, patient-reported outcomes | Structured, stratified, guideline-gated evidence. PatientsLikeMe's trust problems were privacy and data sales: a 2010 scraping incident, de-identified data sold to partners, and a 2019 UnitedHealth acquisition that prompted account-deletion threats. |
| Appointment prep tools | AHRQ Question Builder, COPD Foundation Pocket Consultant Guide, paper one-pagers | Suggested questions, user-added questions, symptom-change flags | Evidence-attached questions. No source confirmed that any of them exports a PDF. |

**Implication:** Villi's white space is "anatomy-aware suitability of what goes in the mouth, with a pharmacist question attached." Do not try to be an ostomy diary. The brief's focus is correct.

## Feature Landscape

### Table Stakes (Users Expect These)

"Expected" here means users of adjacent apps assume it, or a safety product is broken without it. The first block is in the brief. The second block is gaps the brief misses.

#### In the brief and confirmed as expected

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Scan a pill (bottle-label photo or typed name) and get an anatomy-aware verdict | Core promise. Pill-ID apps set the "photograph it" expectation. | HIGH | Photographing the Rx bottle label for name/strength is far more reliable than recognizing the tablet face. Make bottle-label photo and typed name the primary paths. Imprint/shape matching is secondary. This is already the M2 "if only this ships" flow. |
| Clear verdict first, plain-language reason second | Spoonful and Fig set the expectation of an at-a-glance traffic light plus a dietitian-written reason. | LOW | Brief's "verdict in one sentence, then why" is right. Add a visual state (flag / nothing found in sources checked / can't identify). It must never be green for "safe." |
| Correctable identification ("Is this X?") | Scanners miss products. Spoonful has a fast path for items missing from its database. | LOW | In the brief (identified item correctable). Also needed: "I can't identify this" is a first-class outcome. |
| Drink and food check | Drinks are the second-biggest hidden harm. An ostomy-focused dietitian's guidance is to limit hypotonic and hypertonic fluids and prefer ORS. | MEDIUM | Brief M4. Shares the agent and canonicalization with pills. |
| Log how something went, fast | Cara Care and ostomy food logs set the expectation. Friction kills logging. | LOW | Do it as one tap from the answer card ("I had this: helped / neutral / hurt"). Add a recent-items list. See "log later" under the gaps. |
| Citations and "why" visible | Spoonful's selling point is a dietitian-written reason. Clinician-adjacent users distrust uncited AI. | MEDIUM | Brief's `[G:] [L:] [C:] [T:]` scheme is stronger than any competitor. |
| Appointment sheet that exports | Cara Care shares reports with doctors. MyOstomyLife has a clinician-report diary. AHRQ Question Builder is built around questions for the visit. | MEDIUM | Brief M6 (markdown/PDF). Keep it to one page. See the dependency and pitfall notes. |
| Onboarding that takes seconds, with no account wall | Ostomy and SBS users are often unwell, tired, or older. The caregiver is often the one at the phone. | MEDIUM | Brief says 4 taps. Anonymous profile with no email is correct. See the gap on recovery. |
| Mobile-first, installable web app | The audience scans in the kitchen or pharmacy. "Usable Monday" implies a phone. | LOW | Add a PWA manifest and "add to home screen." Cheap. |

#### Table stakes the brief misses or under-specifies

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Static "when to get help now" panel (red flags) | Every health-adjacent product that touches dehydration needs an escape hatch. High-output stomas (more than about 2 L/day) risk dehydration and sodium/magnesium loss. | LOW | Hard-coded, guideline-cited text, not model-generated. It does not give advice beyond "contact your care team or emergency services." It protects the safety story. Put it in the footer and on any answer that touches fluids. |
| Accessibility baseline | A mHealth study of dexterity-impaired users found a lower error rate once text size, contrast, and large targets were configurable. SBS/ostomy users skew older, and carers are often stressed. | MEDIUM | Large tap targets (44 px minimum), text scaling that does not break layout, AA contrast, and light/dark. Add `aria-label`s and a text alternative for `GutDiagram` ("Missing: ileum, ascending colon. Tablet releases in: ileum"). Reduced motion is in the brief. ElevenLabs read-aloud stays a stretch item. |
| Caregiver framing, with no separate caregiver mode | Caregivers are in the product name. The data model already has `role`, but the UI wording is "you" and "your anatomy". | LOW | Use "the person you're checking for" wording when role = caregiver. One profile per device. Do not build multi-profile switching or shared access for v1. Defer both to v1.x. |
| "Log later" for outcomes | A drink's effect shows up hours later, and the web cannot do iOS push reliably. | LOW | A "Waiting to log" list of recent items on the home screen. Do not build notifications. |
| Cold-start empty states that still answer | On Monday the community pool is mostly synthetic. Real users must still get value. | LOW | The guideline plus label answer must stand alone. Counts show "No reports from people with your anatomy yet. Be the first." The demo-data badge is already in the brief. |
| Profile recovery and data deletion without email | Anonymous IDs in localStorage vanish on a phone swap or cache clear. Privacy trust is the lesson of PatientsLikeMe. | LOW-MED | A "recovery code" shown once, plus a "delete my data" button. Without these, users lose their gut diagram, or distrust it. |
| Plain-language privacy statement and "we don't sell data" | PatientsLikeMe's trust damage came from data sales and scraping. | LOW | One screen at onboarding. The brief's anonymity explanation covers part of it. |
| Rate limiting and cost guard per anonymous profile | A public URL with an Anthropic key can be drained. "Usable Monday" requires it to stay up. | LOW-MED | An ops need, not a user-facing feature. Put it in the M7 hardening list. |
| Explicit scope disclosure: "not a drug-interaction checker" | Medication apps normally have an interaction checker, and users will assume Villi does too. A silence could read as "no interactions." | LOW | A single line on the pill result and in the onboarding. See anti-features. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Anatomy-aware pill check against the FDA label and guidelines | Nothing found does this. Peer-reviewed evidence shows it matters: a 2025 Int J Colorectal Dis study (Remane et al.) found 11 of 50 ostomy patients saw undissolved drugs in their output, and over 60% had not been told that could happen. | HIGH | The hero feature. It depends on `fetch_label`, `search_guidelines`, and `canonicalize_item`. |
| `GutDiagram` highlight on the answer | Makes "this tablet releases where you have no intestine" understood in one second. No competitor has anything like it. | MEDIUM | Brief M3. The diagram illustrates a cited claim and never adds one. The label is a factual claim, so the reviewer must check it. A text alternative is required (see table stakes). |
| Tap-to-mark anatomy onboarding, with dropdown fallback and guided prompts | Patients and carers often do not know the surgical terms. Tapping a picture beats a dropdown. | MEDIUM | Brief M3. The guided prompts ("Did they remove your colon?") do most of the work. Keep the fallback. |
| Stratified community counts ("14 of 19 with an end-jejunostomy") | PatientsLikeMe pools by condition. Stratifying by anatomy is what makes "people like you" mean something. | MEDIUM | Needs the aggregates table and a demo-data badge. The brief's design is right. |
| Reviewer pass plus a visible tool trace | Trust. A 2025 BMJ Quality & Safety study of Bing Copilot found that 66% of the 20 answers experts examined were potentially harmful, despite high median accuracy. A visible second check is the answer to that. | MEDIUM | M2. The live trace is also the Convex demo moment. Log reviewer decisions. |
| Every answer ends in one pharmacist/dietitian question, with "Add to appointment sheet" | Turns a risky AI answer into a prepared visit. Existing question tools offer generic suggestions. Villi's are evidence-specific. | LOW | Core to the Anthropic and Microsoft tracks. |
| Safe-swaps board, checked against guidelines on submit | Spoonful's "substitute finder" is among its best-liked features. A board checked on submit means a soda swap cannot enter. | MEDIUM | M5. Depends on moderation and the guideline check. |
| Care-team answers (`[T:]`) from other users | A pharmacist's reply one user got is useful to others with the same anatomy. Nothing found offers this. | MEDIUM | M5. Label it "reported by another user from their own care team." The reviewer must never present it as the user's own clinician's advice. |
| "I saw something" intact-tablet flow | Directly matches the Remane finding. Most patients do not know what an intact tablet means. | MEDIUM | M6. Chips first, then an optional imprint or tablet photo. No stoma-bag imagery. Matching is against the user's own meds. |
| Clinician endorse button ("demo verification") | Meta track story: patients teach, clinicians check. | LOW | Honor-system and badged. |
| Multilingual in, multilingual out | Most ostomy apps are single-language. Families often are not. | MEDIUM | M7. Cheap to build with an LLM, but the reviewer and citation checks must work on the final language. See dependencies. |
| Appointment sheet with personal patterns as hypotheses plus counts | Clinicians doubt patient-generated data on quality and format. The Southampton workflow study lists data judgment, utility, and reformatting into clinical form as barriers. | MEDIUM | Keep it one page: meds with flags, open questions, "my pattern, n=3" labeled patient-reported. Do not dump a raw log. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| DMs and private messaging | Peer apps have them, and patients want to talk to "someone like me" | Removes moderation. The brief's design relies on screening every artifact before others see it. | Stratified counts, the swaps board, and care-team answers. These carry the signal without a channel. |
| Comment threads and a free-form feed | Standard in communities | A content analysis of two peer-led Facebook mental-health groups found 26.1% of comments medically inaccurate and about 60% of threads with uncorrected misinformation. Misinformation was more likely in treatment discussions, including side effects and stopping treatment. (Small study, different condition, so treat it as directional.) | Structured submissions only: outcome chips, a swap pair, a care-team answer. |
| Public profiles, usernames, avatars | Identity and social proof | Identifiability. PatientsLikeMe's scraping and data-sale controversies show the cost. | Anonymous IDs and coarse anatomy only. |
| Dosing, quantity, calorie or meal-plan output | "How much ORS should I drink?" is the obvious next question | Crosses from information into medical decision-making. The reviewer would have to block it anyway. | Say "ask your dietitian" and write the question. |
| Telling users to stop, start, crush, or split a medication | The most natural follow-up ("can I crush it?") | Liability and real harm. Crushing an ER tablet can cause dose dumping. | State what the label says and turn it into an ASK. The brief already does this. |
| A drug-drug interaction checker | Pill apps all have one | A different, larger problem. A gap there reads as "no interactions," which is false reassurance. | Say plainly that Villi does not check interactions. Point to the pharmacist. |
| Medication reminders and adherence tracking | Medisafe-style apps are popular | Implies a dosing schedule, needs notifications that the web does poorly, and moves Villi into a crowded space. | Out of scope. Leave it to the existing reminder apps. |
| Output and fluid-volume tracker (mL in/out) | OstoBuddy tracks output and hydration. My Ostomy Journey tracks daily fluid intake. | Volumes breach the "no quantities" rule. A generic water counter could even push users toward hypotonic plain water, the wrong fluid for high-output SBS. It is also a different product with different data-quality expectations. | Do not build. Note in the README that Villi complements diary apps. A counts-only "bag emptied N times today" chip is a possible v2, because that is how clinicians estimate output. |
| Pouch-change reminders and supply inventory | Table stakes in ostomy apps | Solved by manufacturer apps with distribution deals. Zero connection to the core value. | Out of scope. |
| Stoma and skin photo tracking | MyOstomyLife offers photo-tracking of stoma and skin | Sensitive images, a retention problem, distress risk, and nothing to do with suitability. The brief already bans stoma-bag imagery. | Photos are for pills, drinks, and food only. Delete or expire photos after processing, as a stated policy. |
| Free-text medical history | Richer personalization | Identifiability, and it breaks stratification and the "coarse anatomy" rule. | Coarse anatomy fields and structured chips. |
| "Safe" or "green" verdicts | Spoonful-style traffic lights are popular | "Safe" is a claim Villi cannot support. The brief words it "nothing in the sources I checked" and lists them. | Three states: flagged, nothing found in sources checked, can't identify. Never a bare green. |
| 3D anatomy, anatomical realism | Looks impressive | Costs solo-build hours, reads as a gimmick next to a safety product, can distress users. | Flat friendly SVG, as in the brief. |
| Automatic cross-user recommendation ("people like you should take X") | The obvious payoff of a community pool | Self-selected, small-n, and synthetic at launch. Community data is evidence, never a recommendation. | Counts with anatomy and n. Guidelines win when they conflict. |

## Feature Dependencies

```
Anatomy profile (onboarding + GutDiagram)
    |--required by--> every answer (get_profile is the first tool call)
    |--required by--> community stratification (anatomySnapshot on every write)
    |--enhances-----> GutDiagram answer highlight

Guideline corpus + embeddings (M1)
    |--required by--> search_guidelines --> pill flow, drink flow, swap guideline check, moderation of swaps
    `--required by--> static red-flag panel (cited text)

canonicalize_item + items table
    |--required by--> drink/food flow
    |--required by--> log entries (itemId)
    |--required by--> aggregates --> stratified counts --> community evidence in answers
    `--required by--> multilingual entries mapping to the same items

fetch_label (openFDA cache)
    `--required by--> pill flow --> match_pill --> "I saw something"

Answer + question card
    `--required by--> appointment sheet --> care-team answers (logged after the visit) --> shown in answers [T:]

Moderation (scheduled) --required by--> log pooling, swaps board, care-team answers, questions
Reviewer (scheduled)   --required by--> every user-facing answer (nothing is shown unreviewed)

Clinician endorse --enhances--> swaps board, care-team answers
Multilingual answer --requires--> reviewer that runs on the final language (or runs before translation, with citation tags preserved)

Dropped features: DMs, threads, profiles --conflicts--> moderation-before-sharing model
Output/volume tracker --conflicts--> "no quantities" rule
```

### Dependency Notes

- **Every answer requires the profile.** The tap-to-mark onboarding therefore cannot be cut from the first usable build. The dropdown fallback must exist from the pill flow's first demo, as the brief notes that M2 must not block on the diagram.
- **Stratified counts require canonicalization.** If "Gatorade" and "gatorade zero" are different items, every count is too small to show. Canonicalization is the quiet dependency of the whole community layer.
- **Care-team answers require the appointment sheet.** Answers are logged from questions on the sheet, so build the sheet's question store (M2 `add_question`) before M5.
- **The swaps board requires moderation and the guideline check.** Do not ship the submit form without both.
- **Multilingual requires care with the reviewer.** The reviewer's citation checks must handle translated text. Keep citation tags (`[G:...]`) untranslated and run the reviewer on the English draft, then translate, then re-check tags programmatically.
- **"I saw something" requires `match_pill` and the user's meds list.** Without a med list, it degrades to a generic explanation, which is still cited and valid.
- **Pill flow is independent of everything except the profile and corpus.** This is why "if only the pill flow ships, Villi still demos" holds.

## MVP Definition

Two audiences: the two-minute demo and "usable Monday." They are mostly the same list, except the Monday list adds trust and resilience items.

### Launch With (v1)

- [ ] Anatomy onboarding with `GutDiagram` and dropdown fallback — every answer depends on it
- [ ] Pill flow: bottle-label photo or typed name, cited verdict, reviewer, tool trace, ASK card — the core value
- [ ] Follow-up chat ("can I crush it?") — the most natural next question, and the one the reviewer most needs to catch
- [ ] Drink and food flow with ORS swap — the second hidden harm, and it carries the community story
- [ ] One-tap log from the answer card and the "waiting to log" list — fuels the community layer
- [ ] Stratified counts with demo badge and empty states — "people like you"
- [ ] Safe-swaps board and care-team answers (surfaced in answers) — Meta track and community payoff
- [ ] Appointment sheet with export — Microsoft track evidence, and what the user takes away
- [ ] "I saw something" flow — backed by the Remane finding
- [ ] Static red-flag panel, scope disclosure, privacy statement, recovery code, delete-my-data, rate limit — what makes it safe to leave on a public URL
- [ ] Accessibility baseline (targets, contrast, text scaling, diagram text alternative, reduced motion) — table stakes for this audience
- [ ] Multilingual — cheap with an LLM, and a clear differentiator, but cut it before cutting anything above

### Add After Validation (v1.x)

- [ ] ElevenLabs read-aloud — trigger: low-vision feedback
- [ ] Packaged-food barcode/label scanning — trigger: users photograph food labels in feedback (Fig and Spoonful show this is expected for food, but it is a data-sourcing problem)
- [ ] Multiple profiles for caregivers who manage more than one person — trigger: caregiver requests
- [ ] "First 90 days" guide per anatomy — trigger: new-resection users show up
- [ ] Counts-only output chip ("emptied N times") — trigger: clinicians ask for it on the sheet

### Future Consideration (v2+)

- [ ] Real clinician verification and clinician review of the corpus — requires a pilot partner (an intestinal-rehabilitation clinic, per the brief)
- [ ] Integration with a pharmacy or portal — requires privacy and regulatory work
- [ ] Notifications for outcome logging — requires native or a PWA with reliable push

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Pill flow (cited verdict, reviewer, ASK card) | HIGH | HIGH | P1 |
| Anatomy onboarding + `GutDiagram` | HIGH | MEDIUM | P1 |
| Follow-up chat | HIGH | LOW | P1 |
| Static red-flag panel + scope disclosure | HIGH | LOW | P1 |
| Drink/food flow + `canonicalize_item` | HIGH | MEDIUM | P1 |
| One-tap log + "waiting to log" | HIGH | LOW | P1 |
| Stratified counts + demo badge + empty states | HIGH | MEDIUM | P1 |
| Appointment sheet + export | HIGH | MEDIUM | P1 |
| Moderation pipeline | HIGH | MEDIUM | P1 |
| Accessibility baseline | HIGH | MEDIUM | P1 |
| Recovery code + delete data + rate limit | MEDIUM | LOW | P1 for Monday |
| Safe-swaps board | MEDIUM | MEDIUM | P2 |
| Care-team answers | MEDIUM | MEDIUM | P2 |
| "I saw something" | MEDIUM | MEDIUM | P2 |
| Clinician endorse | LOW | LOW | P2 |
| Multilingual | MEDIUM | MEDIUM | P2 |
| Caregiver wording | MEDIUM | LOW | P2 |
| ElevenLabs read-aloud | LOW | LOW | P3 |
| Packaged-food label scan | MEDIUM | HIGH | P3 |
| "First 90 days" guide | LOW | MEDIUM | P3 |
| Output/volume tracker, med reminders, interaction checker, stoma photos | n/a | n/a | Do not build |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Ostomy apps (OstoBuddy, My Ostomy Journey, MyOstomyLife) | Cara Care / Spoonful / Fig | Pill-ID / interaction apps | PatientsLikeMe / forums | Our Approach |
|---------|------|------|------|------|------|
| Pouch change reminders, supply inventory | Yes | No | No | No | Do not build |
| Output and fluid logs | OstoBuddy: output, consistency, hydration. My Ostomy Journey: fluid intake. | Cara Care: stool tracker | No | No | Do not build volumes. Log outcome chips only. |
| Food tolerance log | My Ostomy Journey | Cara Care: food and symptom diary with correlation | No | Partial | One-tap outcome log, stratified by anatomy |
| Scan and judge a food | No | Spoonful, Fig: barcode, traffic light, reason, substitutes | No | No | Photo or text for food and drinks, cited reason, swap to ask about. Barcode is v1.x. |
| Pill identification | No | No | Yes: photo/imprint | No | Bottle label first. Imprint secondary. |
| Anatomy-aware drug absorption | No | No | No | No | Core differentiator |
| Interaction checker | No | No | Yes | No | Explicitly not built |
| Peer evidence | Ostomy 101 has support groups | No | No | Yes: unstructured, by condition | Structured, stratified by anatomy, moderated, no threads |
| Share with clinician | MyOstomyLife: clinician reports | Cara Care: shareable reports | No | Partial | Appointment sheet with questions and evidence |
| Multilingual | Limited | Limited | Varies | Limited | Any-language entries and answers |
| Accessibility | Not documented | Not documented | Not documented | Not documented | Explicit baseline |

## Sources

- Remane et al., "Drug dissolution problems in ostomy patients: a chart review and patient interview analysis," Int J Colorectal Dis, May 2025: https://link.springer.com/article/10.1007/s00384-025-04907-9 and https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12065682/ (HIGH; 11 of 50 saw undissolved drugs, over 60% lacked the information)
- AGA expert review summary on avoiding sustained- and delayed-release medications: https://blogs.the-hospitalist.org/content/aga-clinical-practice-update-expert-review-managing-short-bowel-syndrome (MEDIUM, secondary summary)
- Drug absorption from oral formulations in SBS, 2023 literature update: https://pubmed.ncbi.nlm.nih.gov/37668362/ (HIGH)
- Practical Gastroenterology, hydrating the adult SBS patient: https://practicalgastro.com/2019/02/05/hydrating-adult-patient-with-short-bowel-syndrome/ (MEDIUM-HIGH, clinician source)
- Ostomy app comparison, United Ostomy Associations of America: https://ostomy.org/apps-for-ostomates (MEDIUM)
- OstoBuddy review: https://www.veganostomy.ca/ostobuddy-2015-review-w-video/ (LOW-MEDIUM, single reviewer)
- MyOstomyLife / Coloplast Care: https://prod-professional-us.coloplast.com/ostomy/resources/myostomylife-supporting-telehealth (MEDIUM, vendor)
- Cara Care listing: https://apps.apple.com/app/id1133687886 (LOW-MEDIUM, vendor)
- Spoonful listing: https://apps.apple.com/app/id1481914232, Fig overview: https://www.mactrast.com/?p=159845 (LOW-MEDIUM, vendor/marketing)
- Pill-identifier app listings (appfollow): https://apps.appfollow.io/ios/pill-identifier-med-scanner/1641094179?country=ro (LOW, vendor)
- PatientsLikeMe privacy history: https://www.wbur.org/news/2010/10/12/wsj-firms-reap-profits-secretly-scraping-patients-personal-data and https://www.mobihealthnews.com/news/mixed-reactions-users-following-unitedhealth-groups-acquisition-patientslikeme (MEDIUM)
- Misinformation in peer-led health groups (content analysis, small): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10546261/ and https://www.jmir.org/2025/1/e71140/PDF (MEDIUM, directional only)
- Bing Copilot medication answers, BMJ Quality & Safety 2025: https://qualitysafety.bmj.com/content/34/2/100 (HIGH)
- Dexterity-impaired mHealth accessibility study: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6329431/ (MEDIUM, small n)
- Barriers to clinician use of patient-generated data: https://eprints.soton.ac.uk/419930/1/Common_barriers_to_the_use_of_patient_generated_data.pdf and https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8663681/ (MEDIUM)
- Appointment prep tools: https://www.mobihealthnews.com/content/ahrq-launches-app-help-patients-preplan-questions-doctors and https://www.copdfoundation.org/COPD360social/Community/Questions-and-Answers/Preparing-for-Dr-Visits-with-the-PCG-Mobile-App.aspx (MEDIUM)

**Gaps / not verified:**
- I did not find independent user reviews of the ostomy apps' reliability or how often they are abandoned.
- Whether any appointment-prep or ostomy app exports a PDF is unconfirmed. Do not claim "first to export."
- No dedicated SBS consumer app was found, but absence in search is not proof of absence. Check the app stores directly before stating "first" in the README or pitch.
- I found no evidence on stoma-photo distress. The brief's ban on stoma-bag imagery rests on design judgment, not a source.
- The Oley Foundation and SBS Foundation community materials were not reviewed. A caregiver-needs interview would be better evidence than anything here.

---
*Feature research for: SBS/ostomy medication, food, and drink suitability app*
*Researched: 2026-10-23*
