# Morning report (overnight run, 2026-10-25)

**Summary.** 11 small, front-end-only improvements (plus their fixes and docs) for tired and low-vision users, for the pharmacy counter, and for showing judges what Claude does: read aloud, text size, a large-type "Show this to the pharmacist" view, the three answers on the welcome screen, a wait panel during the live check, pilot targets on "Is Villi working?", a connection banner, a wallet card and the check time in the receipt.
Two independent code reviews ran on the diff; their real findings are fixed in their own commits. Nothing touches the agent, the prompts, the lint or the reviewer. Only one optional commit (d6553f2) changes Convex code.
Every commit passed typecheck, tests, lint and `next build`. The recommended set below cherry-picks cleanly onto `main` and passes all four there (151 tests). Nothing was deployed, seeded or sent to a live API.

**To try it the fast way** (from your main checkout, which has `.env.local`): `git fetch origin && git checkout overnight/2026-10-25 && npm ci && npm run dev`. This runs against your dev deployment. None of the recommended commits need a Convex deploy.

**How it was checked:** after every commit, `npm run typecheck`, `npx vitest run`, `npx eslint src convex` (0 errors) and `npx next build` (with a placeholder `NEXT_PUBLIC_CONVEX_URL`, since there is no `.env.local` here). Nothing was deployed, seeded or sent to a live API. A local Convex backend couldn't be started (the backend binary download is blocked from this container). Instead, I rendered the real pages in Chromium at 320 to 360 px with a throwaway fake Convex client and fixture data (see "Browser checks" under entry 12, and the screenshots in `docs/overnight-2026-10-25/`). **Nothing was clicked through against a real backend or with a real model answer arriving live**, so look at each change once on your dev deployment.

## Commits

### 1. Read the answer aloud
- **What:** a "Read this answer aloud" button under the answer title speaks the reviewed answer (state, verdict, why, swap, the one question) with the phone's built-in voice, citation tokens dropped and ER/DR/mg spelled out.
- **Why it matters for judging:** care for tired, older and low-vision users (criterion 1, and the polish bonus); no AI call; it prefers an on-device voice.
- **Risk to the demo:** low. It's one extra button on a finished answer; it renders nothing where the browser can't speak, and leaving the page stops the voice.
- **Verify:** open any finished answer (e.g. metoprolol from Recent checks), tap **Read this answer aloud**, hear it, tap **Stop reading**.
- **Commit:** 7c0a5d3

### 2. Show the question to the pharmacist
- **What:** a "Show this to the pharmacist" button on the ASK card opens a full-screen, large-type view of the item, the one question and the verdict, to turn the phone around at the counter.
- **Why it matters for judging:** a memorable live moment that makes the product's point (Villi asks, the professional decides) physical; also helps older and low-vision users (criteria 3 and 1).
- **Risk to the demo:** low. A second, outline button under "Add to appointment sheet"; the dialog shows only text already on the answer and closes with **Done** or Escape. Screenshotted at 320 px in light and dark mode with fixture text.
- **Verify:** open the metoprolol answer, tap **Show this to the pharmacist**, then **Done**.
- **Commit:** ecdfc8e

### 3. Text size picker
- **What:** three "A" buttons in the home header (standard, large, largest: 100%, 112.5%, 125%) scale the whole app, remembered on the device; print always uses the standard size.
- **Why it matters for judging:** care for older and low-vision users, who are a large part of this community (criterion 1, polish).
- **Risk to the demo:** low. Off by default, so the demo looks exactly as before unless someone taps it. It adds a small inline script in `<head>` that only reads one localStorage key inside try/catch. Screenshotted at 320 px at "largest": no horizontal scroll on the home header, anatomy panel and nav.
- **Verify:** on home, tap the largest **A**; every screen grows. Reload: it stays. Tap the smallest **A** to go back.
- **Commit:** df03494

### 4. The three answers, on the welcome screen
- **What:** the welcome screen (what a judge sees on their own phone) now shows the three answer states styled like the real cards, under "Three possible answers, and none of them is 'safe'", below **Set up your own**.
- **Why it matters for judging:** shows the honesty design (no "safe" state) before anyone types anything (criterion 4, honesty).
- **Risk to the demo:** low. Static text on the welcome screen only; the phone's home with a profile is unchanged.
- **Verify:** open villi in a private window (no profile); scroll below the demo buttons.
- **Commit:** 0f307aa

### 5. Show the sheet's open questions to the pharmacist
- **What:** on **Your sheet**, "Show these questions to the pharmacist" opens every open question in the same large-type view, numbered with its item; the view now has a **Close** link at the top so it opens at the top, not scrolled to **Done**.
- **Why it matters for judging:** the sheet is the "bring it Monday" step of the demo; this makes it usable at the counter on a phone, not only on paper (criteria 3 and 1).
- **Risk to the demo:** low. One outline button above the question cards, shown only when there are open questions; step 8's **I asked this** sits one row lower. Depends on commit 2 (same component).
- **Verify:** **Your sheet** → **Show these questions to the pharmacist** → read → **Close**.
- **Commit:** 9316308

### 6. Elapsed time and the three steps during a live check
- **What:** while a check runs, a panel under the live trace shows a ticking clock ("0:14 · usually 20 to 55 seconds"; past a minute: "taking longer than usual. It keeps going if you leave") and the three steps (Claude gathers sources → code checks every citation, count and dose → a second Claude reviews), marked from the answer's status.
- **Why it matters for judging:** this is on screen during the one live moment of the demo (step 2); it makes Claude's two roles and the code gate visible without narration (criterion 4), and tells a tired user how long to wait.
- **Risk to the demo:** low. Display only, no backend change; it disappears when the answer lands. The "20 to 55 seconds" range is the one `DEMO.md` already states.
- **Verify:** type a new check (any drink); watch the clock tick and step 3 go bold when the trace says "Safety review in progress…".
- **Commit:** 244a610

### 7. Pilot targets beside the live numbers on "Is Villi working?"
- **What:** each funnel step that has a README pilot threshold now says it, with the live real-use value and its count, e.g. "Pilot target: at least 40% of saved questions get asked. Now: 50% (1 of 2)."; "Not enough answers yet" when there is no denominator; one line says the targets are our own, set before any data.
- **Why it matters for judging:** turns the metric page into a test against stated thresholds, which is what "a clear way to measure impact" asks for (criterion 3); demo step 9 lands on it.
- **Risk to the demo:** low. Text only, computed in the browser from the existing `impact.summary` query; no backend change. With this weekend's tiny real numbers it will show small counts, honestly.
- **Verify:** open **Is Villi working?**; look under "Was the flag news?", "Asked", "Something changed" and "Two-week outcome".
- **Commit:** d67b320

### 8. Docs for the new pieces
- **What:** README "What it does" gets rows for the accessibility pieces and the wait panel; DEMO.md's optional swaps say where "Show this to the pharmacist", read aloud and the wait panel fit; QA.md answers "What about older or low-vision users?".
- **Why it matters for judging:** keeps the docs judges read true to the code, and gives you a ready answer for the accessibility question (honesty, criterion 1).
- **Risk to the demo:** none. Docs only. Describes commits 1, 2, 3, 5 and 6: if you skip any of those, drop its sentence (or skip this commit).
- **Verify:** read the three added README/DEMO/QA paragraphs.
- **Commit:** 561f167

### 9. Connection banner
- **What:** if the Convex connection drops for more than 4 seconds, every screen shows "No connection. Reconnecting…" (a started check keeps going on the server; the page updates when it's back); if it never opens within 10 seconds, "Can't reach Villi yet. Still trying…".
- **Why it matters for judging:** on a venue hotspot, a frozen-looking page is the worst live failure; this tells you (and a tired user at home) what's happening (polish, criterion 3).
- **Risk to the demo:** low. Read-only use of `useConvexConnectionState`; debounced so a blip shows nothing. If the banner appears on stage, the network really is down: switch to the screen recording. Checked in a browser against an unreachable backend: nothing at 3 s, the banner at 12 s.
- **Verify:** on the laptop, open DevTools → Network → Offline for 5 seconds; the banner appears, then goes when you go back online.
- **Commit:** 7d43f9b

### 10. Read-aloud fixes from a review
- **What:** an independent review of tonight's diff found read-aloud could stick on "Stop reading" on Chrome Android and keep talking when the app goes to the background, and that "go to the ER" would be read as "go to the extended-release". Fixed: utterances are kept referenced, a fallback resets the button, the voice stops when the page is hidden, and ER/XL/SR/DR/EC are expanded only after a drug word.
- **Why it matters for judging:** polish and care for the users read-aloud is for (criterion 1).
- **Risk to the demo:** low. Only changes commit 1's button; needs commit 1.
- **Verify:** read an answer aloud, switch apps: it stops, and the button says "Read this answer aloud" again.
- **Commit:** 750169f

### 11. Pharmacist-view fixes from the same review
- **What:** the dialog's title id is unique (`useId`), the page behind it no longer scrolls on iOS while it's open, and sheet questions have any citation tokens stripped before they're shown large.
- **Why it matters for judging:** polish and accessibility (criterion 1).
- **Risk to the demo:** low. Needs commits 2 and 5. Checked in a browser: overflow is reset after **Done** and after Escape.
- **Verify:** open the view, try to scroll the page behind, tap **Done**, scroll the page normally.
- **Commit:** ea0c0c8

**Review findings not acted on:** React 19 may log a dev-only console warning about the `<script>` in `<head>` (none seen in this dev server's log; prod is unaffected). Questions already marked "asked" still appear in the pharmacist view, on purpose: an asked question can still be waiting for its answer.

### 12. "Made for tired eyes" on How Villi decides
- **What:** a short section at the end of `/how` listing the accessibility pieces (Atkinson Hyperlegible, 44 px targets, text size, read aloud, the pharmacist view). A follow-up commit swaps two bold phrases for quotes, per DESIGN.md's Bold Means Something rule.
- **Why it matters for judging:** `/how` is linked from every answer; this states the care for low-vision users where judges look (criterion 1).
- **Risk to the demo:** none. Static text. Mentions commits 1, 2 and 3: skip it if you skip those.
- **Verify:** open **How Villi decides**, scroll to the end.
- **Commits:** 5d5eacd and 83c7906 (take both)

**Browser checks done tonight (no commit):** with a throwaway fake Convex client (kept out of the repo) I rendered the real home, welcome, answer (finished, using a real Gatorade answer from `eval/runs/demo-live-2`, and in progress) and sheet pages at 320 px. axe-core 4.10 found **no WCAG 2.2 A/AA violations** on any of them, or on `/how`, in light and dark mode; none of them scroll sideways at the largest text size.

### 13. Wallet card for the next prescriber
- **What:** `/card`, linked from **Your sheet** as "Wallet card: medicines and anatomy", prints a dashed cut-out card (4 in wide): the anatomy, each medicine on file with the medicine list review's own flag text (flagged first; "Nothing found in the label sections checked" / "Label not checked yet" otherwise), and one question for any prescriber or pharmacist: "Is the form of any new or changed medicine (extended-release, delayed-release, enteric-coated, or a liquid with sorbitol) suited to this anatomy?"
- **Why it matters for judging:** it's the origin story's gap (nobody prescribing knew the anatomy) turned into something to carry to an ER or a new specialist (criteria 2 and 3).
- **Risk to the demo:** low. A new route and one more link on the sheet, below the fridge sheet; reads the existing `sheet.get` query only. Tests check it repeats only the review's text, has one question, no digits and no directive. Rendered with fixture medicines on screen and in print emulation; axe clean.
- **Verify:** **Your sheet** → **Wallet card: medicines and anatomy** → look at the card → **Print or save as PDF** (preview only).
- **Commits:** 17af40e and d335726 (take both; the second rewords the question, since sorbitol is about tolerance, not absorption)

### 14. Wallet card in the docs
- **What:** README's "Appointment sheet" row mentions the wallet card; DEMO.md's "Leave something on the table" suggests printing it too.
- **Why it matters for judging:** keeps docs true to the code (honesty).
- **Risk to the demo:** none. Docs only; take it only with commit 13.
- **Verify:** read the two sentences.
- **Commit:** 50c45d5

**Investigated, not changed: stricter directive lint.** I tested candidate patterns ("please don't…", "you shouldn't…", "don't change…", "I'd recommend stopping…") against every stored answer in `eval/runs/*` (about 900 drafts and finals). On today's setup (patched, holdout-current, demo runs) no shown answer matches any of them; in the old baseline run the matches were mostly deferrals the grader judged fine ("Please don't change anything on your own"). Adding them would block more good answers than bad ones, so `convex/lib/safety.ts` is untouched. (The old `demo-live` blocks were all the simulation caption, which the lint now removes.)

### 15. How long the check took, in the receipt
- **What:** the collapsed receipt line on every finished answer now ends with the time it took, e.g. "How Villi checked this (8 steps, 6 sources, 34 seconds)", from when the check was asked to the reviewer's verdict.
- **Why it matters for judging:** a per-answer, measured latency next to the steps, honest about the wait (criterion 3, honesty); useful if a judge asks "how long does a check take?".
- **Risk to the demo:** low. Text only; hidden when timestamps are missing, backwards or over 15 minutes (cloned demo answers may hide it, which is fine).
- **Verify:** open a finished answer and read the "How Villi checked this" line.
- **Commit:** 9db9bb3

### 16. Fixes from a second review (scroll lock, voice, card)
A second independent review of the later commits found these; each is its own commit.
- **88c9141, scroll lock:** if the pharmacist view unmounted while open (a back gesture, or the last open question answered live through the care-team link), the page stayed unscrollable. Now released on unmount. Risk: low; needs commits 2, 5 and 11.
- **afb698f, read-aloud voice:** some browsers offer network voices (Chrome's "Google …"), which send the text off the phone. It now prefers an on-device voice for the answer's language, and `/how`, README and QA say "prefers an on-device voice" instead of "no audio leaves the phone". Risk: low; needs commits 1, 8 and 12.
- **891cedb, card wording:** a medicine whose label was looked up and *not found* also reads "Can't tell yet"; the card printed "Label not checked yet" for it, which is untrue. It now prints the list review's own summary. **Back** links to the sheet. Risk: low; needs commit 13.
- **d6553f2, demo badge on the card:** `sheet.get` returns a new boolean `demo` (additive), and a demo profile's card shows a "demo data" pill. **This is the only commit tonight that changes Convex code**, so it needs `npm run deploy:convex` to take effect; without the deploy the field is just absent and no pill shows (nothing breaks). Test: `convex/sheetDemo.test.ts`. Risk: low.
- **Verify:** open and close the pharmacist view, then scroll home; read an answer aloud; open the card for a profile with a misspelled medicine.


## Recommended for this morning

These are all low risk and front-end only, so they ship with your normal Vercel deploy and need no Convex deploy. Cherry-pick them in this order; they apply cleanly to `main`, and `next build`, typecheck, lint and the tests pass on the result:

```bash
git checkout main && git pull
git cherry-pick 7c0a5d3 ecdfc8e df03494 0f307aa 9316308 244a610 d67b320 561f167 7d43f9b 750169f ea0c0c8 5d5eacd 83c7906 17af40e d335726 50c45d5 9db9bb3 88c9141 afb698f 891cedb
```

If you only have time for a few, these are the most visible on stage. Each line needs the commits listed with it:
- **Show this to the pharmacist** (2): ecdfc8e, plus 9316308 → ea0c0c8 → 88c9141 for the sheet version and its fixes.
- **Wait panel during the live check** (6): 244a610, on its own.
- **Pilot targets on "Is Villi working?"** (7): d67b320, on its own.
- **Three answers on the welcome screen** (4): 0f307aa, on its own.
- **Read aloud** (1): 7c0a5d3 → 750169f → afb698f. afb698f also edits text from 561f167 and 5d5eacd, so take those too, or skip afb698f. Without it, the README and `/how` say "no audio leaves the phone", which is not strictly true on Chrome.

After cherry-picking, run DEMO.md's checks on dev once. Look at the metoprolol answer (read aloud, the pharmacist view), the sheet, the wallet card and "Is Villi working?".

## Leave for after judging

- **d6553f2** ("demo data" pill on the wallet card): it changes `convex/sheet.ts`, so it needs a Convex deploy on judging morning. That deploy is the riskiest step for a small gain. The card works without it.
- **6afc64b** (screenshots) and the `docs(morning-report)` commits: useful on the branch, not needed on `main`.
- **Not done, on purpose:** stricter directive patterns in the safety lint. They would block more good answers than bad ones (see "Investigated, not changed" above).

## Where I stopped

I stopped adding features at about 01:40, well before 06:40. Every idea left failed the cut. Some need live data or a deploy to be seen. Some (a "what changed since your last visit" label note) would never show in a two-minute demo. The rest were more surface area for you to review before 08:45 than they were worth. The two independent reviews and the clean cherry-pick check seemed like a better use of the night than more features.

## Added after the overnight run (on request)

### 17. "Are you sure?" for a good outcome on a flagged item, kept private
- **What:** logging "Helped" or "No change" for something Villi flagged for this anatomy asks first ("Villi flagged Gatorade for your parent's anatomy … Are you sure it helped? If you save it, it stays in your parent's own log only"). Saved, it is never pooled and never moves the shared counts. "Worse" and unflagged items work as before. "Flagged" means the person's latest finished check of that item was "Flag to discuss", or it's a flagged medicine in their list review.
- **How it's enforced:** on the server. `logs.create` records the conflict, and `moderation.applyLog` checks again once a typed name gets its catalog item, so it holds even if the app skips the question. Schema change is additive (`log_entries.againstGuidance`, optional).
- **Risk to the demo:** medium-low. **It changes Convex code, so it needs `npm run deploy:convex`.** Demo step 6 logs "Worse", which is unaffected. If you log "Helped" on a flagged item during the demo, the confirm card appears. Tests: `convex/againstGuidance.test.ts` and `convex/lib/guidance.test.ts`. Confirm card checked in a browser with fixture data; axe clean.
- **Verify:** on dev, open the Gatorade answer → **Had it? How did it go?** → **Helped** → the card appears → **Save privately** → "Kept in your own log only…". On home, type "gatorade" in **Log how something went** → **No change** → same card.
- **Commits:** 6d51517 (code) and d534a71 (README)
