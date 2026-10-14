# CRAT – Cybersecurity Risk Assessment Tool

CRAT turns compliance checklists into conversations. It asks assessment questions,
follows up when answers are vague or incomplete, and scores each answer on a 1–5
maturity scale with notes on strengths and gaps.

> **Status:** early development. This is a rebuild of an earlier Python/Streamlit
> prototype as a Next.js web app.

## Planned features

- Chat-based assessments across categories such as access control, incident response
  and data protection
- Up to three follow-up questions per answer when information is missing
- Compliance score (1–5) and recommendations per question and category
- Pluggable LLM: local models (Ollama, LM Studio) or a cloud model
- User accounts and saved assessments (Supabase)
- English and German

## Tech stack

- [Next.js](https://nextjs.org) (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com)
- [Vitest](https://vitest.dev) + Testing Library for unit tests
- [Playwright](https://playwright.dev) for end-to-end tests

## Getting started

Requirements: Node.js 22.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. You are redirected to `/en` or `/de` based on your
browser language.

### Configuration

Copy `.env.example` to `.env.local` and adjust it. All variables are optional; the
defaults point to a local [Ollama](https://ollama.com) instance
(`http://localhost:11434/v1`, model `llama3.1:8b`). Variables are validated at startup
in `src/env.ts`.

Supported LLM providers:

| Provider | Settings |
| --- | --- |
| Ollama (default) | `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_MODEL=llama3.1:8b` |
| LM Studio | `LLM_BASE_URL=http://localhost:1234/v1`, `LLM_MODEL=<loaded model>` |
| OpenRouter | `LLM_BASE_URL=https://openrouter.ai/api/v1`, `LLM_MODEL=<model>`, `LLM_API_KEY=<key>` |
| Claude | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=<key>` (model defaults to `claude-opus-5-5`) |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Build and run the production version |
| `npm run check` | Lint, typecheck, unit tests and build (run before every PR) |
| `npm run test` | Unit tests |
| `npm run test:llm` | Check prompts against the configured real LLM (opt-in, not in CI) |
| `npx playwright test` | End-to-end tests (starts the dev server) |

## Contributing

`main` is protected. Work on a feature branch, run `npm run check`, and open a pull
request; it can be merged once the CI check passes. See [CLAUDE.md](CLAUDE.md) for
conventions.
