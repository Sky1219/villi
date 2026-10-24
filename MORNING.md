# Morning handoff (overnight run, 2026-10-24)

Started 05:52 PDT (H0). Updated after every task. Broken things first.

## Broken or not verified

- **No live check on dev.** This worktree has no `.env.local`, so the Convex CLI has no deployment (`npx convex codegen` and `npx convex run` both stop at "No CONVEX_DEPLOYMENT set"). Per the brief I did not copy secrets. Everything below is verified by tests, tsc, eslint and `next build` only. Run C1 yourself before the demo (see the commands at the end).
- `npm run build` needs `NEXT_PUBLIC_CONVEX_URL` at build time. I built with a placeholder URL (`https://placeholder-overnight.convex.cloud`); your `.env.local` / Vercel env covers this normally.

## Tasks

| Task | Commit | Status |
|---|---|---|
| A1 pill-flow bugs | (pending) | Done, tests only |

## Decisions to check

- A1: the no-concern repair prefixes "Nothing in the sources I checked raised a concern. " in English only. A dose question as a new check gets its own message ("Villi doesn't give doses or amounts…") instead of the generic one-item message. The label prefetch uses the canonical name plus any strength the user typed (strength only helps ranking; the cache key ignores it).

## Couldn't do

## Morning commands, in order

1. Review and merge this branch.
2. `npm run deploy:convex`
3. `npx convex run --prod seed:run`
4. `npx convex env list --prod`: confirm `ANTHROPIC_API_KEY`, `OPENFDA_API_KEY`, `VOYAGE_API_KEY`.
5. Redeploy Vercel.
6. Real iPhone: bottle photo, blurry photo, "Can I crush it?" follow-up, care-team link opened on a second phone.
