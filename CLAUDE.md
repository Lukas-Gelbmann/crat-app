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

## Workflow per feature
`main` is protected: changes go in via PR only, and the CI check `test` must pass before merging.

1. `git switch main && git pull`
2. `git switch -c feature/<name>`
3. Write code and tests, then run `npm run check`
4. `git push -u origin feature/<name>` and `gh pr create`
5. Merge once CI `test` is green, then delete the branch
