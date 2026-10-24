# Morning handoff (overnight run, 2026-10-24)

Started 05:52 PDT (H0). Updated after every task. Broken things first.

## Broken or not verified

- **No live check on dev.** This worktree has no `.env.local`, so the Convex CLI has no deployment (`npx convex codegen` and `npx convex run` both stop at "No CONVEX_DEPLOYMENT set"). Per the brief I did not copy secrets. Everything below is verified by tests, tsc, eslint and `next build` only. Run C1 yourself before the demo (see the commands at the end).
- `npm run build` needs `NEXT_PUBLIC_CONVEX_URL` at build time. I built with a placeholder URL (`https://placeholder-overnight.convex.cloud`); your `.env.local` / Vercel env covers this normally.

## Tasks

| Task | Commit | Status |
|---|---|---|
| A1 pill-flow bugs | ad83cc8 | Done, tests only (`convex/pillflow.test.ts`) |
| A2 red-team fixes | (next commit) | Done, tests only (`convex/redteam.test.ts`, `convex/community.test.ts`) |

## Decisions to check

- A1: the no-concern repair prefixes "Nothing in the sources I checked raised a concern. " in English only. A dose question as a new check gets its own message ("Villi doesn't give doses or amounts…") instead of the generic one-item message. The label prefetch uses the canonical name plus any strength the user typed (strength only helps ranking; the cache key ignores it).

- A2 counts: `aggregates` counted **entries**. It now counts one pooled entry per profile and item, latest outcome wins (`applyPooledTransition` in `convex/community.ts`). Existing prod counters were built the old way; they are rebuilt correctly for synthetic rows on the next `seed:run` (it clears and re-inserts every synthetic log). Real rows on prod keep their old counts until you reseed; at hackathon scale real rows are your own test logs.
- A2 numerator: a `[C:n/total, anatomy]` claim is deleted unless n is one of that anatomy's retrieved counts (or the total), and every bare count number in the claim text also comes from that cell. Lengths ("100 cm"), percentages and mmol are ignored. Note: `[C:13/13, …]` itself is allowed by the brief's rule (n = total); the claim text's 5/5/3 must still match the cell.
- A2 new profiles: in its first 10 minutes a profile can share at most 3 note-free logs; later ones stay "Checking…" and a scheduled `moderation.recheckLog` re-runs moderation after the window. **Demo:** the laptop "second device" profile must be older than 10 minutes, or have fewer than 3 shared note-free logs, or the live count won't tick.
- A2 catalog: `canonicalize.run` no longer creates a pill that has no FDA label (returns `itemId: null`, path `unlisted`). Logs of such a name stay private ("could not identify the item"); the swaps form refuses it. **Prod cleanup:** the polluted item already on prod can be removed with `npx convex run --prod canonicalize:removeItem '{"canonicalName":"zorblatrin (immediate-release)"}'` (check the exact name in the dashboard first).
- A2 sports drinks: seeded and canonicalized as `isotonic` (+ `simpleSugar`, `lowSodium`); the canonicalizer prompt says so; `aga-sbs#fluids-hypertonic` lost its `sports-drink` tag and `pd-2017#sports-drinks` lost `hypertonic`. The swap check still treats any sugary drink as a conflict with `aga-sbs#fluids-hypertonic` ("a sugary drink").
- A2 swap source: a `community` swap with no retrieved swap group is relabeled `guideline` (and removed if it has no `[G:]` citation).

## Couldn't do

## Morning commands, in order

1. Review and merge this branch.
2. `npm run deploy:convex`
3. `npx convex run --prod seed:run`
4. `npx convex env list --prod`: confirm `ANTHROPIC_API_KEY`, `OPENFDA_API_KEY`, `VOYAGE_API_KEY`.
5. Redeploy Vercel.
6. Real iPhone: bottle photo, blurry photo, "Can I crush it?" follow-up, care-team link opened on a second phone.
