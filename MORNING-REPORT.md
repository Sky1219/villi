# Morning report (overnight run, 2026-10-25)

(summary written at wrap-up)

**Try the branch locally:** `git fetch origin && git checkout overnight/2026-10-25 && npm ci && npx convex dev` (in one terminal, on your dev deployment) then `npm run dev`.

**How it was checked:** after every commit, `npm run typecheck`, `npx vitest run`, `npx eslint src convex` (0 errors) and `npx next build` (with a placeholder `NEXT_PUBLIC_CONVEX_URL`, since there is no `.env.local` here). Nothing was deployed, seeded or sent to a live API. A local Convex backend couldn't be started (the backend binary download is blocked from this container), so **no UI change was clicked through in a browser**: please look at each one once.

## Commits

### 1. Read the answer aloud
- **What:** a "Read this answer aloud" button under the answer title speaks the reviewed answer (state, verdict, why, swap, the one question) with the phone's built-in voice, citation tokens dropped and ER/DR/mg spelled out.
- **Why it matters for judging:** care for tired, older and low-vision users (criterion 1, and the polish bonus); no AI call and no audio leaves the phone.
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
