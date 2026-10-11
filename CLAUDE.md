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
