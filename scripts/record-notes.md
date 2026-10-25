# Backup video: what to record, click by click

Record on the phone (screen recording on, Do Not Disturb on, brightness up, portrait). Talk over it in your own words; the lines in quotes are prompts, not a script to read.

## Before you press record

1. **Model credits.** Live checks need Anthropic credits on the deployment you record. As of 2026-10-24 10:00 the key returned "credit balance too low" on dev. Until that's fixed, record **Part A only**.
2. **Which deployment.** Prod (the villi.tech URL on your phone) after `npm run deploy:convex` and `npx convex run --prod seed:run`, or dev (`npm run dev` on the laptop, phone on the same network). Seed once, ahead of time, never while recording.
3. **Demo profile.** Open the app → **Demo: the builder's dad**. Wait 1 minute so each medicine's label lookup finishes (rows stop saying "Label not checked yet").
4. **Second device** (laptop): open the app → **Demo: the builder's dad**, at least 10 minutes before recording. Leave it on the home screen.

## Part A: works now, no model call (about 70 seconds)

| # | Clicks | Say |
|---|---|---|
| A1 | Home screen, top | "My dad lost his entire large intestine and most of his small intestine. Guidelines say extended-release pills may not work in a gut that short. Nobody told us. Villi is for people who've had most of their intestine removed, and the family members who manage their medications." |
| A2 | Scroll to **Medicine list review** | "Every medicine on his list, checked instantly against the FDA label and the guidelines for his anatomy." |
| A3 | Tap the chip on the **Metoprolol succinate ER 50 mg** row (the `FDA label: dosage form` chip, then an `AGA 2022` chip) | "Every flag has two sources: the label sentence and the guideline. This one is extended release, and the guidelines say to avoid that after a major resection." Close the sheet. |
| A4 | Pantoprazole row | "Acid medicine reads differently: it's commonly used after resection, so the question is the form, not whether." |
| A5 | **Add a question to the sheet** on the metoprolol row | "It doesn't decide. It writes the question for the pharmacist." |
| A6 | **Log how something went** → type `sports drink` → **Worse** → note `dizzy when I stand up` → **Save** | Warning card appears: "If a note sounds like dehydration, Villi says to contact the care team today, and nothing else." Tap **Got it**. |
| A7 | **Your sheet** → on the metoprolol question tap **I asked this** | "This is what we bring to the pharmacist: his questions, his medicines with what the labels say, warning signs he logged." |
| A8 | **Share with the care team** → copy the link → open it on the laptop → on the metoprolol question choose **Reviewed: form changed** → **Save** | On the phone the sheet shows "Recorded through the care-team link". "The pharmacist closes the loop. Villi says plainly it can't verify who holds the link." |
| A9 | Home → **Is Villi working?** | "Flags raised, questions asked, answers logged, formulation changes, by anatomy. Real use and demo data are counted separately." Then revoke the link on the sheet after you stop recording. |

## Part B: record once credits are back (about 60 seconds, splice after A2)

Pre-run these on the phone before recording and wait for each to finish (20-60 s each): `Metoprolol succinate ER 50 mg`, then the follow-up `Can I crush it?` on that answer (keep it open in a second tab), then `Gatorade`. If an answer reads weak or says the safety check stopped it, run it again.

| # | Clicks | Say |
|---|---|---|
| B1 | Type `Metoprolol succinate ER 50 mg` → **Check** (live) | Over the trace: "His anatomy, then the FDA label: the NDC dosage form says extended release. Then the guidelines, and what people with his anatomy logged. Code checks the draft, then a second Claude reviews it. He sees nothing until both pass." |
| B2 | Answer lands: **Flag to discuss**; tap one chip; point at the diagram; point at the question card | "Every claim carries a source. This is his gut; the dashed parts are gone. It ends with one question for the pharmacist." |
| B3 | Second tab: **Can I crush it?** | "It repeats the label: don't crush or chew. The decision goes to the pharmacist." |
| B4 | Home → Recent checks → **Gatorade** | "Drinks too. Sports drinks have less salt and more sugar than an oral rehydration solution, so it asks about that instead. Counts from people with his anatomy, marked demo data." |
| B5 | Laptop: **Log how something went** → `sports drink` → **Worse** | Phone count ticks: "That entry was screened before it counted." |
| B6 | Close on **Is Villi working?** | "We'll know it works when questions turn into logged answers from pharmacists." |

## If something goes wrong while recording

- Count doesn't tick in B5: moderation takes a few seconds; keep talking, or cut it.
- "The safety check stopped this answer": run the check again before recording; don't record a block.
- Anything else: stop, fix, re-record that part only. Splice A and B in the phone's editor.
