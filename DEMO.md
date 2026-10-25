# Villi: two-minute demo (phone viewport)

One check runs live. Everything else was run beforehand on the same profile and is opened from **Recent checks**, because a real check takes 20 to 55 seconds (agent plus reviewer) and five of them would not fit in two minutes.

**Setup, the morning of judging (on the deployment you will demo):**
- After deploying and seeding (next bullet), run `npm run preflight -- --prod --model`. It checks on prod that `ANTHROPIC_API_KEY`, `OPENFDA_API_KEY` and `VOYAGE_API_KEY` are set, that the Anthropic key has credit (one 1-token call), that openFDA and Voyage answer, and that the guidelines, embeddings, demo templates and demo community are seeded. Fix every FAIL before you leave. On Oct 24 it caught that dev had no `OPENFDA_API_KEY`. Without the Voyage key, guideline search quietly falls back to keywords and the trace says "(keyword search)". An openFDA rate limit looks like "I couldn't identify this", not an error.
- Deploy the backend (`npm run deploy:convex`), then seed with `npx convex run --prod seed:run`. Re-seeding replaces the old synthetic rows, which removes the swap that failed the guideline check. Never seed during the demo: it competes with live traffic for scheduled jobs.
- **Phone: your dad's real profile, not the demo.** Profiles made with **Demo: the builder's dad** are demo profiles and never count as real use on "Is Villi working?", even after edits. So on the phone:
  - If it already has a profile, tap **Delete my data** at the bottom of home first. A profile that started as a demo stays a demo.
  - Tap **Set up your own** → **Someone I care for** → **My parent**, and answer for his real anatomy (no colon, under 100 cm of small bowel, end-jejunostomy).
  - Under **Medicines on file**, add his medicines by name as printed: Metoprolol succinate ER 50 mg, Pantoprazole sodium DR 40 mg, Tylenol Extra Strength liquid, Loperamide 2 mg, Ondansetron 4 mg. Add only what he really takes. Wait about a minute for each **Medicine list review** row to read its label.
  - The home screen says "Checking for your parent". This profile has no seeded two-week card; that card is only on demo profiles (see Optional swaps).

  Then run these checks and wait for each to finish:
  1. Type **Metoprolol succinate ER 50 mg** (its label facts come from Villi's checked drug table, so the live run works even if openFDA is down).
  2. On that answer, ask the follow-up **Can I crush it?** Leave this answer open in a **second browser tab**: follow-ups don't appear in Recent checks.
  3. Type **Gatorade**.
  4. **I saw something** → yellow, oval.
  5. Tap **Add to appointment sheet** on the metoprolol answer, and on the Gatorade answer.
     On each flagged answer, answer **Did you or your parent know this already?** truthfully. That fills the "Was the flag news?" card on "Is Villi working?".
  6. On **Your sheet**, leave both questions open. You'll tap **I asked this** on stage.
  7. Only if it's true: on a question your dad really asked, tap **What did they say?** and log what his pharmacist or doctor said and what changed. That becomes one real row on "Is Villi working?". Never make one up.
- Read each answer once. If one came out weak, run it again and keep the better one. Answers can differ from run to run.
- **Laptop (the "second device"):** open the app and tap **Demo: the builder's dad**. It's a separate anonymous demo profile with the same anatomy, so it can't open the phone's answers, and its log in step 6 counts as demo data. Leave it on the home screen.
- Open **Is Villi working?** once on the phone. The big numbers are real use: the phone's checks and questions on your dad's real profile. Judges who tap **Demo: the builder's dad** on their own phones show up only as demo data. Say so if asked.
- Use a personal hotspot, not venue Wi-Fi, and keep a screen recording of the full run as a fallback.

| # | Time | Do | Say |
|---|---|---|---|
| 1 | 0:00 | Home screen | "My dad lost his entire large intestine and most of his small intestine. Guidelines say pills like his extended-release heart medicine may not release in a gut that short. Nobody told us." |
| 2 | 0:10 | **Live:** type **Metoprolol succinate ER 50 mg** and tap **Check** | "Watch the trace. His anatomy, then the FDA label, where the NDC dosage form says extended release. Then the guidelines, and what people with his anatomy logged. Code checks the draft, and then a second Claude reviews it. He doesn't see anything until both pass." Keep talking over the trace; it takes about 30 seconds. |
| 3 | 0:45 | Answer lands: **Flag to discuss** | "Every claim carries a source. Tap a chip and you see the label text, or our summary of the guideline." Point at the diagram: "This is his gut. The dashed parts are gone." Point at the question card: "It doesn't decide. It writes the one question to take to the pharmacist." |
| 4 | 1:00 | Switch to the second tab: **Can I crush it?** | "It repeats the label's warning about extended-release tablets and sends the decision to the pharmacist." |
| 5 | 1:10 | Home → Recent checks → **Gatorade** | "Drinks too. For an end-jejunostomy, sports drinks are low in salt and high in sugar, so it asks about an oral rehydration solution instead." Point at the community card: "Counts from people with his anatomy, split from everyone else, and marked demo data." |
| 6 | 1:25 | On the **laptop**: Log how something went → type **sports drink** → **Worse** | On the phone, the end-jejunostomy count ticks up. "Live Convex query. That entry was screened before it counted, by a rule filter and then Claude." |
| 7 | 1:35 | Recent checks → **Something seen: yellow oval** | "Matched only against his own medicines. Pantoprazole is a *possible* match. A tablet in the pouch can be undissolved or an empty shell, so show the pharmacist." |
| 8 | 1:45 | **Your sheet** → tap **I asked this** on the metoprolol question | "This is what we bring Monday: his questions, his own patterns as hypotheses, his medicines with what the labels say. Either of us can hand it over. When the pharmacist answers, I log what they said and what changed." Don't open the print dialog on stage. |
| 9 | 1:55 | Home → footer → **Is Villi working?** | "First, was the flag news to him? Every flag asks. Then the question has to reach a care team and change something. This counts that, live and by anatomy: flags, questions asked, answers logged, formulation changes. Real use and demo data are counted separately." |

**Leave something on the table.** Print the review request beforehand (**Your sheet** → **Review request (PDF)** → print, from your dad's real profile), and hand it to the judges at the end: "This is the page we take to his pharmacist." It's the product's real output, on paper. Optionally print the **wallet card** too (**Your sheet** → **Wallet card: medicines and anatomy**): "This is what he carries to the ER, where nobody knows his anatomy."

**Say this unprompted, once:** "A citation proves Villi retrieved a source. It doesn't prove the source says the claim. The code checks and the reviewer catch most of that, not all of it. That's why every answer ends in a question, not an instruction."

**If something breaks:**
- The live check is slow: keep talking about the trace, since that's the point. Past 60 seconds, open the pre-run metoprolol answer from Recent checks.
- "AI service is busy" or "didn't pass the safety check": open the pre-run answer, or switch to the screen recording.
- The laptop count doesn't tick: the log is still being screened (a few seconds). Move on, and come back to it.

## Optional swaps (proposed overnight; you decide)

Two new pieces can stand in for a step without slowing the run. Neither needs a live model call.

- **Medicine list review instead of step 7 (I saw something), or right after step 3.** On home, tap the **Review of your parent's 5 medicines** line under Recent checks. It opens the sheet's **Medicine list review**: every medicine on your dad's list already has its row (Flag to discuss / Nothing found in the sections checked / Can't tell yet), with citation chips. Say: "That was one pill in 30 seconds. This is his whole list, instantly, from the labels and the guidelines. Pantoprazole reads differently: acid medicine is commonly used after resection, so the flag is about which form, not whether." Setup: add the medicines at least a minute before (each medicine's label lookup runs on its own after it's added; until then a row says "Label not checked yet"), and tap a chip once to make sure it opens.
- **Care-team link instead of step 8's last sentence.** On **Your sheet**, tap **Share with the care team**, open the link on the laptop, choose **Reviewed: form changed** on the metoprolol question, and the phone's sheet shows "Recorded through the care-team link" live; **Is Villi working?** then shows it in the funnel as a care-team-link answer. Say: "The pharmacist closes the loop, and Villi says plainly it can't verify who holds the link." Setup: one open question on the sheet (tap **Add a question to the sheet** on the metoprolol review row, or the answer's question card), and no more than 2 active links already (the limit is 3). Revoke the demo link afterwards.
- **Show this to the pharmacist (5 seconds, after step 3).** Under the question card, tap **Show this to the pharmacist** and turn the phone to the judges: the question fills the screen in large type. Say: "At the counter, this is what he shows. Villi asks; the pharmacist decides." Tap **Done**. Also on **Your sheet** for every open question at once. No model call.
- **Read aloud and text size (for the accessibility question).** **Read this answer aloud** on any answer uses the phone's built-in voice; the three **A** buttons on home make every screen larger. Turn the volume up first if you show it; tap **Stop reading** to end.
- **During the live check (step 2).** The panel under the trace counts the seconds and marks the three steps: Claude gathers sources, code checks, a second Claude reviews. You can point at step 3 when it goes bold instead of narrating it.
- **Two-week follow-up card.** Only on the laptop's demo profile, not the phone's real one. After a reseed, a freshly cloned "my dad" profile shows one "It's been two weeks since your parent's Metoprolol succinate ER was changed" card, badged **demo data**. Use it only if you want to show the outcome step; tapping it records a demo (synthetic) log, never real use.

**New pre-demo note:** the laptop "second device" in step 6 must be a profile older than 10 minutes, or one that has shared fewer than 3 note-free logs. A brand-new profile's 4th note-free log waits for a re-check after its first 10 minutes, so the phone's count would not tick on stage. Clone the laptop profile during setup, not right before.
