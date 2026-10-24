# Phase 1 API Coverage Matrix

External API surfaces used or reachable in Phase 1 (Foundation). Default is INTEGRATE; every OPT-OUT carries its reason.

| capability | decision | reason |
|------------|----------|--------|
| Voyage embeddings (POST /v1/embeddings, voyage-4-lite, 1024 dims) | INTEGRATE | FND-04 vector path: embed:run uses input_type document, guidelines.search uses input_type query (01-05) |
| Voyage alternate host via optional VOYAGE_BASE_URL | INTEGRATE | MongoDB Atlas ai.mongodb.com/v1 or api.voyageai.com; key origin decides the host (both answered 401 without a key) |
| Voyage reranker (/v1/rerank) | OPT-OUT | 51-chunk corpus with anatomy post-filter and mandatory-tag inclusion is enough; an extra call would add latency to every search in the live demo |
| Voyage multimodal and contextualized-chunk embeddings | OPT-OUT | No image retrieval in this phase, and chunks are already standalone rule-level statements |
| Voyage tokenization / usage endpoints | OPT-OUT | Corpus is tiny (about 6K tokens); batching by count (128) stays far under the request limits |
| Convex database, queries, mutations, internal actions | INTEGRATE | Schema, profiles, demo clone, seed, aggregates (01-01 to 01-06) |
| Convex vector search (ctx.vectorSearch, 1024-dim by_embedding indexes) | INTEGRATE | Guideline search vector path (01-05); items index defined for Phase 4 |
| Convex full-text search (searchIndex search_text) | INTEGRATE | Automatic fallback path for guideline search (01-05) |
| Convex typed app env (defineApp env, npx convex env set / list --names-only) | INTEGRATE | All keys optional; DEMO_MODE gate; check-env script (01-01, 01-07) |
| Convex CLI deploy and run (dev --once, deploy --cmd, run) | INTEGRATE | Dev pushes in 01-01/01-06/01-07; prod via the Vercel build command; seed, embed, and smoke via convex run (01-07) |
| Convex codegen (npx convex codegen) | INTEGRATE | Wave 2 plans regenerate types without touching the shared dev deployment |
| Convex component @convex-dev/action-retrier | INTEGRATE | Mounted in convex.config.ts now so Phase 2 can use it; no calls in Phase 1 |
| Convex file storage | OPT-OUT | No photos until Phase 2 (pill photo identification) |
| Convex scheduler / crons | OPT-OUT | No asynchronous safety passes in Phase 1; reviewer is Phase 2, moderation is Phase 4 |
| Vercel hosting (Git import, build command override, env vars) | INTEGRATE | FND-07 *.vercel.app deploy (D-14), done by the builder in 01-07 |
| Vercel CLI deploy | OPT-OUT | The builder links the Git repo once in the dashboard (D-15, D-17); Git-push deploys need no CLI |
| Anthropic Messages API (messages.create) | INTEGRATE | Only the conditional 15-minute default-runtime spike in 01-07 Task 3; the agent and reviewer are Phase 2 |
| Anthropic tool use, vision, structured outputs, batches | OPT-OUT | Deferred to Phase 2 (pill flow); nothing in Phase 1 calls them |
| openFDA drug label and NDC endpoints | OPT-OUT | Deferred to Phase 2 (fetch_label); the seed hard-codes the dosage forms research verified live on 2026-10-24 |
| ElevenLabs text-to-speech | OPT-OUT | Stretch (v2, STR-02); not in any v1 phase |
