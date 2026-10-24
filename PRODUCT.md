# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first web app (Next.js App Router + Convex), used on a real phone via the deployed URL (villi.tech) and on a laptop at phone viewport as a fallback. No native apps.

## Users

**Primary: the patient.** An adult living with short bowel syndrome (SBS) or an ileostomy/colostomy, holding their own phone, often at home or in a pharmacy, wondering whether a pill, drink, or food will actually work in a body with this much intestine. They may be tired, dehydrated, recovering from surgery, older, or reading in a language other than English.

**Secondary: family caregivers**, who check on the patient's behalf using the same profile (the origin case is the builder's father). **Clinicians** appear only as honor-system endorsers on community artifacts, badged "demo verification".

Job: photograph or type an item, get a cited answer for *their* anatomy, and leave with one question to bring to a pharmacist, dietitian, or doctor.

## Product Purpose

Villi answers one question: *can a body with this much intestine actually use this?* It puts clinical guidelines, the FDA drug label, and an anatomy-stratified community tolerance pool behind a camera. Guidelines say to avoid extended-release and enteric-coated medicines after major bowel resection, to favor oral rehydration solution over hypotonic and hypertonic drinks, and to watch sorbitol; patients are almost never told any of this.

Success for this build: the judged Cal Hacks 13.0 demo on Sunday 2026-10-25 (script in `DEMO.md`). If only the pill flow works, Villi still demos. This record optimizes for the hackathon only.

## Positioning

Anatomy-specific, cited, and reviewer-checked. Every answer is grounded in what *this user's* remaining gut can do, carries a citation for each claim (`[G:]` guideline, `[L:]` label, `[C:n/total, anatomy]` community, `[T:]` care-team), passes a deterministic safety lint and a second Claude review before it is shown, and ends in exactly one question for a professional. Villi never decides.

## Operating Context

- **Flows:** Check (photo or typed name, live tool trace while it works), Follow-up ("Can I crush it?"), Gut diagram (tap-to-mark onboarding, cited highlight in answers), I saw something (shape/color/size/imprint chips matched against the user's own meds only), one-tap Log, Community (anatomy-split counts, safe-swaps board, care-team answers), Appointment sheet (Print / Save as PDF, share, Markdown).
- **Routes:** `/`, `/onboarding`, `/answer/[id]`, `/community`, `/saw`, `/sheet`, `/sheet/print`, `/demo?as=father|peer`.
- **The wait is part of the experience:** the user waits on the reviewer before seeing an answer; the streaming tool trace covers that wait.
- **Appointment ritual:** questions collected in answers flow to the appointment sheet the patient brings to their care team.

## Capabilities and Constraints

- **Three answer states, never a green "safe":** Flag to discuss · Nothing found in the sources I checked · Can't tell yet.
- **Evidence tiers in strict priority:** guidelines are hard constraints; community data is tolerance evidence, always split by anatomy with counts, "too few to say" under 5; the user's own log is the strongest soft signal.
- **Never:** tell anyone to stop, start, crush, split, or change a medicine or dose; give quantities, doses, or meal plans (except printed strength and ORS composition in mmol/L).
- **Community is structured artifacts only:** no DMs, comment threads, or public profiles. Everything is moderated before it's pooled; unsafe entries stay author-only with a gentle note.
- **Privacy:** no accounts (random localStorage id), no names/DOB/free-text history, coarse anatomy only, photos downscaled, EXIF-stripped, and deleted right after reading. Delete-my-data exists.
- **Imagery:** flat, friendly 2D SVG only (the hand-authored `GutDiagram`). No 3D anatomy, no anatomical realism, no stoma-bag imagery. Diagram highlights only illustrate cited claims and come from fixed chunk payloads.
- **Language:** UI chrome is English; answers are written in the profile's language, Arabic right-to-left.
- **Disclaimers that must stay:** "Villi is not medical advice"; openFDA's disclaimer on label-derived claims.
- **Terminology:** "Flag to discuss", "Nothing in the sources I checked", "Can't tell yet", "ASK" question card, "Add to appointment sheet", "demo data", "demo verification", "reported by another user from their own care team".

## Brand Commitments

- Name: **Villi**, after the intestinal villi that do the absorbing. Domain villi.tech.
- Origin: built by a family caregiver whose father lost his entire large intestine and most of his small intestine. The "my dad" demo profile uses anatomy only, no identity.
- Voice: **plain, warm, specific.** Verdict in one sentence, then why, then the swap to ask about, then community and personal evidence, then ASK. Honest about uncertainty; never reassuring beyond the evidence.

## Evidence on Hand

- `data/guidelines.json`: 46 rule-level chunks in our own words from AGA 2022, Practical Gastroenterology #139, Parrish & DiBaise 2017, Remane 2025, Australian Prescriber 2013, Hong 2021, WHO/UNICEF ORS. **Every chunk is `verified: false`.**
- Synthetic community seed (`npm run seed`): ~60 profiles, 1,500 logs, 39 swaps, 30 care-team answers, 20 questions, all `synthetic: true` and badged "demo data".
- `DEMO.md`: the two-minute demo script; `README.md`: architecture and failure modes.
- **Absent, must not be fabricated:** real users, testimonials, clinician endorsements or partnerships, clinical validation, outcome data, usage numbers.

## Product Principles

1. **Never decide; always cite.** Every claim points at a source; the product hands the decision to a professional via one question.
2. **No false reassurance.** Absence of evidence is stated as "nothing in the sources I checked", with the sources listed. Nothing ever reads as "safe".
3. **This body, not bodies in general.** Answers, counts, and diagrams are always stratified by the user's anatomy.
4. **Honesty over polish.** Synthetic data, unverified corpus, and honor-system verification are always labeled where they appear.
5. **Safety can't be skipped.** Lint, reviewer, and moderation sit between every draft and every viewer, and fail closed.

## Accessibility & Inclusion

- **Standard:** WCAG 2.2 AA across the whole UI.
- **Older or tired users:** large tap targets, low reading load, one decision per screen where possible; users may be fatigued, dehydrated, or post-surgery.
- **Low vision:** supports large text and strong contrast in light and dark modes.
- **Multilingual + RTL:** answers render correctly in any profile language, including Arabic right-to-left.
- Content avoids distressing imagery (see Imagery constraint).
