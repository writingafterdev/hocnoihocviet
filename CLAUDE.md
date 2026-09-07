# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Reader & Writer — a language-learning app for non-native English speakers (IELTS/GRE prep) built around curated
journalism (The Economist, The New Yorker, New Scientist). Three loops: reading curated articles, building a
spaced-repetition Vocab Bank, and practicing IELTS Writing Task 1/2 essays graded by an LLM assessment pipeline.

Read `PRODUCT.md` (target users, product purpose) and `DESIGN.md` (full design system: colors, type, shadows,
component rules, explicit do/don't list) before making product or UI decisions — they are authoritative and
detailed, not boilerplate. Notably `DESIGN.md` bans left-border color stripes, gradients, drop shadows heavier than
the two-layer ambient formula, and any second typeface — these are called out as "AI-UI tells" to avoid.

## Commands

```bash
npm run dev              # Next.js dev server (Turbopack), http://localhost:3000
npm run build             # production build
npm run start              # serve a production build
npm run lint               # eslint (eslint-config-next core-web-vitals + typescript)
```

There is no project-wide test runner script. Tests are individual files under `src/lib/**/*.test.ts` using Node's
native test runner via `tsx`, run one at a time:

```bash
tsx --test src/lib/assessment-cost-budget.test.ts
tsx --test src/lib/claim-strength-audit.test.ts
# etc — see `ls src/lib/*.test.ts` for the full set
```

`npm run test:assessment-cost` wraps the one test file that has a package.json script; the rest are invoked
directly with `tsx --test <path>`.

Benchmark/eval scripts (for tuning the writing-assessment LLM pipeline, not part of normal dev):

```bash
npm run benchmark:deepseek   # scripts/benchmark-deepseek.ts --provider deepseek
npm run benchmark:assessment # same script, default provider
npm run benchmark:worker     # scripts/process-benchmark-reference-assessments.ts
```

`typecheck`: no dedicated script; run `npx tsc --noEmit` directly.

## Environment

The app is unusable without a `.env.local` (gitignored, never committed — `.gitignore` has `.env*`). It needs, at
minimum, Appwrite endpoint/project/database IDs, an `APPWRITE_API_KEY`, and one ID per collection/bucket used
(see `src/lib/appwrite.ts` `COLLECTIONS`/`BUCKETS` maps for the full set of env var names). Writing-assessment
features additionally need at least one of `DEEPSEEK_API_KEY`, `GROK_API_KEY`, or `MIMO_API_KEY` depending on
`ASSESSMENT_LLM_PROVIDER`. There is no `.env.example` in the repo — the env var names must be read out of the
source (`grep -rhoE "process\.env\.[A-Z_0-9]+" src`).

## Architecture

### Appwrite: two clients, one schema map

- `src/lib/appwrite.ts` — browser SDK client (`account`, `databases`, `storage`), plus `COLLECTIONS` and `BUCKETS`
  maps that are the single source of truth for every collection/bucket ID used anywhere in the app. Start here
  when tracing what data entities exist.
- `src/lib/appwrite-server.ts` — server SDK client authenticated with `APPWRITE_API_KEY`, for Server Components
  and API routes. Both clients import from the `appwrite` npm package (not `node-appwrite`) — the server client is
  just the universal SDK constructed with a key instead of a browser session.

**Gotcha:** documents returned by the Appwrite SDK (`listDocuments`/`getDocument`) have a **null prototype**, not a
plain-object prototype. Passing one directly as a prop from a Server Component into a `'use client'` component
throws ("Only plain objects... can be passed to Client Components") under Next.js's RSC serialization. `src/lib/
articles.ts` handles this with a `toPlain()` JSON round-trip at every function that returns documents to a page
component — follow that pattern for any new server-side Appwrite fetch that feeds a client component. Purely
client-side Appwrite usage (e.g. `src/lib/vocab.ts`) doesn't need this since there's no RSC boundary involved.

### Writing assessment pipeline (the architectural core)

This is where most of the code's complexity lives — `src/lib/writing-assessment-pipeline-v2.ts` is ~5,450 lines
despite the filename, because it contains **every** pipeline version from V2 through V8 in one file
(`runWritingAssessmentPipelineV2` ... `V8`), each an iteration on essay-grading logic. `writing-assessment-
pipeline-core.ts` holds the shared primitives (`runPass`, `ensureBandScores`, `normalizeDecomposition`, etc.) that
all versions build on.

**The version actually running is not "v2".** `src/app/api/writing/analyze/route.ts` picks the pipeline function
at request time from `ASSESSMENT_PIPELINE_VERSION` (defaults to `v8` when unset). Check that env var / the route's
dispatch logic before assuming which function is live.

Supporting modules feeding the pipeline, each independently unit-tested:
- `assessment-llm.ts` — provider-agnostic LLM call wrapper (`generateAssessmentJSON`) with cost budgeting
  (`assessment-cost-budget.ts`, hard USD preflight cap) across DeepSeek/Grok/Mimo
- `assessment-evidence-resolver.ts` — resolves quoted evidence spans back into the essay text
- `claim-strength-audit.ts` / `claim-strength-omission-scan.ts` — checks the model's claims against the essay
- `examiner-finding-alignment.ts` / `examiner-miss-cleanup.ts` — reconciles/cleans findings against IELTS examiner
  conventions
- `benchmark-*.ts` — the eval harness (`benchmark-reference-jobs.ts`, `benchmark-postgen-filter.ts`,
  `benchmark-finding-validator.ts`) that runs pipeline output against reference assessments and external audits,
  surfaced through `/benchmark` and `/api/benchmark/*` for tuning prompts/models, not an end-user feature.

### Route map

Route groups worth knowing: `(main)/session` is a placeholder that redirects to `/exercise` — its own comment
notes it's mid-refactor toward a "new reading engine session flow," so don't assume it's the real session UI.
There's also a bare `/login` page alongside `/auth/login` — check both before assuming which is current when
touching auth UI.

- Reading: `/`, `/articles`, `/articles/[slug]`, `/categories/[slug]`, `/sources/[source]`, `/bookmarks`, `/reading`
- Vocab/SRS: `/library`, `/api/exercise/session` (SM-2-style mastery fields: `interval`, `ease_factor`,
  `repetitions` — see `vocab.ts` `calculateNextReview`)
- Writing: `/writing` (Task 1/2 hub), `/writing/task1/[id]`, `/writing/task2/[id]`, `/api/writing/analyze`,
  `/api/writing/assessments/[taskId]`
- Admin/internal: `/admin`, `/admin/articles/[id]`, `/admin/import`, `/benchmark`

### Repo hygiene note

The repo root has many one-off scratch scripts (`scratch_*.js`, `seed_*.js`, `setup_*.js`, `dump_*.js`, etc.) from
prior iterative sessions — these are not part of the app's runtime and aren't wired into any npm script. Don't
assume a root-level `.js`/`.ts` file is load-bearing just because it exists; check for an npm script or import
reference first.
