# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-10-24
**Files analyzed:** 38 new/modified
**Analogs found:** 4 in-repo (scaffold only) / 38. Everything else uses authoritative external sources (guidelines.md, 01-RESEARCH.md snippets).

Repo state: near-fresh scaffold. App code is only `src/app/{layout,page,globals.css}`, `next.config.ts`, `convex/_generated/*`. There is no in-repo Convex function, schema, or test to copy. All paths named are untracked-but-real source (not gitignored mirrors). `git ls-files` is empty for `src/` and `convex/` because nothing is committed yet; the first task must make the initial scaffold commit.

## File Classification

| File | Role | Data Flow | Analog / Pattern source | Match |
|------|------|-----------|-------------------------|-------|
| `package.json` (pins, scripts) | config | n/a | existing `package.json`; scripts block in RESEARCH "Package scripts" | modify |
| `.gitignore` (add `!.env.example`) | config | n/a | existing `.gitignore:33-34` | modify |
| `.env.example`, `vitest.config.mts`, `README.md` | config/docs | n/a | RESEARCH "Verified config", "convex.config.ts" | research-only |
| `src/app/layout.tsx` | layout | request-response | itself (replace Geist with Atkinson) | exact (modify) |
| `src/app/globals.css` | config (tokens) | n/a | itself (keep `:root` + `prefers-color-scheme` + `@theme inline`) | exact (modify) |
| `src/app/providers.tsx` | provider | pub-sub | Convex quickstart; no analog | none |
| `src/app/page.tsx` | component (page) | CRUD read | itself (replace placeholder) | modify |
| `src/app/demo/page.tsx` | component (page) | request-response | RESEARCH "Home/profile skeleton" | none |
| `src/components/{DemoButtons,QuickProfileForm,ProfileSummary}.tsx` | component | CRUD | none in repo | none |
| `src/lib/anonId.ts` | utility | client storage | RESEARCH Pattern 5 | none |
| `convex/convex.config.ts` | config | n/a | guidelines.md:255-263 + RESEARCH snippet | research |
| `convex/schema.ts`, `convex/lib/validators.ts`, `lib/constants.ts` | model | CRUD | RESEARCH "Schema draft" + guidelines.md:231-243 | research |
| `convex/lib/{anatomy,embed,prng}.ts` | utility | transform | RESEARCH snippets | research |
| `convex/profiles.ts`, `convex/demo.ts` | service (public API) | request-response | guidelines.md function syntax | none in repo |
| `convex/guidelines.ts`, `convex/embed.ts` | service (internal) | request-response / external HTTP | guidelines.md:245-253 | none in repo |
| `convex/seed.ts`, `convex/seed/*.ts`, `convex/aggregates.ts` | service (internal) | batch | RESEARCH Pattern 2 | none in repo |
| `data/guidelines.json` | data | static | RESEARCH "JSON shape" + claim bank | none |
| `convex/*.test.ts`, `convex/lib/anatomy.test.ts` | test | n/a | guidelines.md:273-280 | research |
| `tests/corpus.test.ts`, `tests/env.test.ts` | test | file-I/O | RESEARCH vitest config | research |

## Pattern Assignments

### `src/app/layout.tsx` (modify; analog: itself)

**Keep** the `LayoutProps<"/">` typing and `<html lang className>` / `<body className="min-h-full flex flex-col">` shape (lines 20-28). **Replace** lines 2-13 and 17-18:
```tsx
// current (lines 2-13): Geist + Geist_Mono via next/font/google, variable: "--font-geist-sans"
import { Atkinson_Hyperlegible } from "next/font/google";
const atk = Atkinson_Hyperlegible({ variable: "--font-atkinson", subsets: ["latin"], weight: ["400","700"] });
```
Update `metadata` (currently "Create Next App"), swap the class variables, and wrap `{children}` in the new `Providers`. Keep a phone-width centered container (~375 px, D-04).

### `src/app/globals.css` (modify; analog: itself)

Keep this structure (lines 1-20) and change values only:
```css
@import "tailwindcss";
:root { --background: #ffffff; --foreground: #171717; }
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);   /* -> var(--font-atkinson), system-ui, sans-serif */
}
@media (prefers-color-scheme: dark) { :root { --background: #0a0a0a; --foreground: #ededed; } }
```
Add the palette tokens from RESEARCH "Palette candidates" (bg `#FBF6EE`/`#1C1612`, card, ink, muted, accent `#B5472B`/`#E58A66`, accent-soft) as `--*` vars in both `:root` and the dark block, and mirror each in `@theme inline` as `--color-*`. Remove `font-family: Arial` on `body` (line 25) so `--font-sans` applies. Drop `--font-mono` Geist reference.

### `next.config.ts` (do not change)
Already has `cacheComponents: true`, `partialPrefetching: true`, and the `@tailwindcss/turbopack` loader rule (lines 5-14). Consequences for new pages: any client page using `useSearchParams` must sit inside `<Suspense>` or `next build` fails; `NEXT_PUBLIC_CONVEX_URL` must exist at build time.

### `src/app/providers.tsx` + `src/app/demo/page.tsx` (no in-repo analog)
Source: RESEARCH Pattern 6 / "Home/profile skeleton":
```tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
function Inner() { const as = useSearchParams().get("as"); /* validate father|peer; demo.startAs; redirect "/" */ return null; }
export default function DemoPage() { return <Suspense fallback={<p>Loading</p>}><Inner /></Suspense>; }
```
Providers: standard `ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)` + `ConvexProvider` in a `"use client"` file (Convex Next quickstart). Read anonId with `useSyncExternalStore` (server snapshot `undefined`), pass `"skip"` to `useQuery` until defined.

### `src/lib/anonId.ts` (no analog)
Source: RESEARCH Pattern 5. Build v4 UUID with `crypto.getRandomValues` (not `randomUUID`, fails on non-secure LAN HTTP); wrap localStorage in try/catch with in-memory fallback.

### `convex/convex.config.ts` (no analog)
Source: RESEARCH "convex.config.ts" (all `env` vars `v.optional(v.string())`; `app.use(actionRetrier)`), pattern per `convex/_generated/ai/guidelines.md:255-263`. Read env in functions via `import { env } from "./_generated/server"` (not `process.env`; `_generated/server.js:101` exports it).

### `convex/schema.ts` and `convex/lib/validators.ts` (no analog)
Source: RESEARCH "Schema draft" verbatim (all 14 tables). Index names include all fields (`by_pooled_and_anatomyKey`). Vector index template, `guidelines.md:231-243`:
```ts
.vectorIndex("by_embedding", { vectorField: "embedding", dimensions: EMBED_DIM, filterFields: ["sourceId"] })
```
SAFE-07: `profiles` has only enums/booleans/ids/synthetic keys, no free text.

### `convex/profiles.ts`, `convex/demo.ts` (public API)
No in-repo analog. Rules from `guidelines.md` (lines 21, 34, 89): object-form `query`/`mutation` with `args` validators; `withIndex("by_anonId", q => q.eq("anonId", ...))`, never `.filter`. `profiles.create` accepts only `{role, anatomyChoice, bowelLength?, language, anonId}` and derives `anatomy` + `anatomyKey` via `convex/lib/anatomy.ts`. `profiles.me` returns an explicit projection (never `anonId`). `demo.startAs` gated by `env.DEMO_MODE === "true"`, idempotent per `clonedFrom`.

### `convex/guidelines.ts`, `convex/embed.ts` (internal; search/embedding)
No in-repo analog. Use `internalAction`/`internalQuery`. Vector call, `guidelines.md:248-252`:
```ts
const results = await ctx.vectorSearch("documents", "by_embedding", { vector, limit: 10, filter: (q) => q.eq("category", c) });
```
Results are `{_id,_score}`; hydrate in one `internalQuery`, post-filter `anatomyScope`, then on any error or 0 hits use the `search_text` index. Return `{ path: "vector" | "text", results }`. Voyage call: RESEARCH `convex/lib/embed.ts` snippet (3 s timeout, no retry at query time; backoff only in `embed:run`).

### `convex/seed.ts`, `convex/seed/*.ts`, `convex/aggregates.ts`
No analog. `seed:run` = `internalAction` looping batched `internalMutation`s (~200-300 rows); deterministic `mulberry32` PRNG; `seed_meta.hash` gate; upsert reference tables (items, chunks, templates), replace-all synthetic rows; all synthetic rows `synthetic:true, pooled:true`. Never call Voyage in seed. No unbounded `.collect()` (use `.take()`).

### `data/guidelines.json`
Shape and claim bank: RESEARCH "Corpus Research" (JSON shape, source bank, 45-55 chunks). `chunkId === sourceId#locator`; `aga-sbs#*` all `verified:false` with topical locators; hypotonic rule scoped to `end-jejunostomy`/`ileostomy`; no "indicates impaired absorption"; crush statements IR-only.

### Tests (no analog)
Convex tests, `guidelines.md:273-280` plus RESEARCH vitest config:
```ts
/// <reference types="vite/client" />
const modules = import.meta.glob("./**/*.ts");
const t = convexTest(schema, modules);
```
`vitest.config.mts` with two projects (`convex` edge-runtime on `convex/**/*.test.ts`, `node` on `tests/**/*.test.ts`). Pitfall 5: vector-path test must embed every chunk with real 1024-length arrays. `*.test.ts` files under `convex/` are skipped by the bundler (multi-dot names).

## Shared Patterns

- **Function registration (all `convex/*.ts`):** `query/mutation/action` public only for `profiles.*`, `demo.startAs`; everything else `internal*`. Add a test that seed/embed/guidelines are absent from public `api`. Source: `guidelines.md:21,34`.
- **Validators:** every function has `args`; reuse unions from `convex/lib/validators.ts`; never accept `anatomy`, `anatomyKey`, `pooled`, `synthetic`, `profileId` from the client.
- **Env access:** `env` from `./_generated/server` only; all vars optional; missing key means text-only search and DEMO off.
- **Pure shared libs:** `convex/lib/*.ts` export no Convex functions; client may import `anatomy.ts` for labels.
- **Theme tokens:** one set of CSS vars in `:root` + `prefers-color-scheme` block, mapped via `@theme inline` (existing `globals.css` pattern).
- **Client hooks under Suspense:** `useSearchParams` always inside `<Suspense>` (cacheComponents).
- **No-arg CLI entry points:** `seed:run`, `embed:run`, `guidelines:smoke`, `seed:report` (Windows quoting).

## No Analog Found

Everything except the three `src/app` scaffold files and `.gitignore`/`package.json`/`next.config.ts`. Planner should use `convex/_generated/ai/guidelines.md`, `.claude/skills/convex-*/SKILL.md`, and the verified snippets in 01-RESEARCH.md (convex.config.ts, schema draft, anatomy mapping, Voyage embed, palette, vitest config, scripts).

## Metadata

**Analog search scope:** `src/`, `convex/`, repo root configs.
**Files scanned:** ~10 (all existing app/config files).
**Pattern extraction date:** 2026-10-24
