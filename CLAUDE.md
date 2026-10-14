# CLAUDE.md

## Stack
- Next.js (App Router, TypeScript, `src/`)
- Vitest + Testing Library (unit tests)
- Playwright (E2E, local only)

## Commands
- `npm run check`: lint, typecheck, tests and build; run before every PR
- `npm run test`: unit tests
- `npx playwright test`: E2E tests

## Conventions
- New logic needs tests.
- Small PRs: one feature per branch.
- No secrets in code, use environment variables only.
- Read env vars through `getServerEnv()` (`src/env.ts`), never `process.env` directly.
  New variables go into the zod schema and `.env.example`.
- No hard-coded UI text: add strings to both `src/i18n/dictionaries/en.json` and
  `de.json`. Server Components use `getCurrentDictionary()` from `src/i18n/server.ts`;
  Client Components receive strings as props.
- All pages live under `src/app/[lang]/`.

## Domain (`src/domain/`)
- Pure TypeScript: no React, Next.js, database or LLM imports. All interview rules
  live here and are unit-tested; UI, persistence and LLM code call into it.
- `catalog.ts`: bilingual question catalog; its order is the interview order.
- Each category is one shared chat room: everyone responsible for it works through
  its questions strictly in order. Skipped questions come back after the open ones.
- `thread.ts`: one state machine per question (open → active → completed, plus
  skipped / not applicable). A question completes when the completeness check
  accepts the answer. Follow-ups are capped at `MAX_FOLLOW_UPS` in code, not by the LLM.
- `assessment.ts`: selected categories with one thread per question. Change state
  only via its commands (`answerQuestion`, `skipQuestion`, ...); they reject any
  question that isn't the category's `currentQuestion`.
- Scoring happens per category, only after all its questions are done
  (`recordCategoryResults`). Reopening a question discards its category's scores.
- `scoring.ts`: `toScore` for untrusted (LLM) scores; averages exclude not-applicable
  questions, categories weigh equally overall.

## Workflow per feature
`main` is protected: changes go in via PR only, and the CI check `test` must pass before merging.

1. `git switch main && git pull`
2. `git switch -c feature/<name>`
3. Write code and tests, then run `npm run check`
4. `git push -u origin feature/<name>` and `gh pr create`
5. Merge once CI `test` is green, then delete the branch
