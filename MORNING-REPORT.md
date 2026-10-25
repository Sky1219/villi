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
