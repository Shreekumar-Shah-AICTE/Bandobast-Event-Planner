# Contributing

This repository is public for review, and the author makes the changes (see [LICENSE](LICENSE)). These are the rules every change follows. The quality gate enforces them, so none of them is optional.

## Getting started

Node 24 (see `.nvmrc`), then:

```bash
npm ci
npm run dev      # the app, with the built-in rules standing in for the AI
npx vercel dev   # the app and the AI function together (settings in .env.example)
```

## The quality gate

`npm run verify` must pass before a commit is pushed. CI runs it again, then `npm audit` and the browser journeys.

| Step | Command | Fails when |
| --- | --- | --- |
| Format | `npm run format:check` | Prettier would change a file |
| Lint | `npm run lint` | any ESLint error or warning (`--max-warnings 0`) |
| Types | `npm run typecheck` | any TypeScript error, for the app, the function and the tools |
| Tests | `npm run test:coverage` | a test fails or coverage drops below the thresholds in [docs/TESTING.md](docs/TESTING.md) |
| Build | `npm run build` | the production build fails |
| Journeys | `npm run e2e` | a journey, an axe-core check or a CSP check fails |

## Code rules

- **TypeScript is strict,** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`, and non-null assertions only in tests and data tables.
- **Small units.** Lint caps cyclomatic complexity at 8, nesting at 3 levels, functions at 50 lines, files at 250 lines and parameters at 4. Group related arguments into a typed object.
- **Named numbers.** Outside tests and data tables, literal numbers other than 0, 1, -1, 2 and 100 live in named constants ([`constants.ts`](src/domain/constants.ts), [`shared/limits.ts`](shared/limits.ts), [`server/config.ts`](server/config.ts)).
- **Layers stay apart.** Imports follow the table in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#layers), and lint rejects the rest.
- **Money and dates.** Amounts are integer paise and dates are UTC day numbers. Convert to ₹ text and calendar dates only for display.
- **Validate at the boundary.** Data from the network, storage, a plan file or a model passes a zod schema before use.
- **Expected failures are values.** Return a `Result` ([`result.ts`](src/domain/result.ts)) instead of throwing, and say whether the caller should fall back to the rules.
- **Comments explain why.** Exported functions, components and interfaces have a short doc comment, and related constants or inferred types share one. Engine functions note their complexity where it matters.

## AI and security rules

- Gemini never decides a number. A new AI task needs a contract, an output guard, a rule-based fallback and tests for each (see [Where new code goes](docs/ARCHITECTURE.md#where-new-code-goes)).
- User text reaches a prompt only fenced as data, with phone numbers and e-mails removed.
- Secrets live only in server environment variables, never with a `VITE_` prefix.
- No `dangerouslySetInnerHTML`, and links are built only from known URL formats.
- New dependencies need a reason, an exact version and a clean `npm audit`.

## Accessibility rules

- Use real `button` and `a` elements, visible labels and the existing focus and live-region patterns.
- Move focus on purpose after anything that replaces content, and announce results that appear elsewhere.
- Run the axe journey (`npm run e2e`) after any UI change. [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) lists what each screen already does.

## Commits

One logical change per commit. The message starts with the kind or the area, such as `fix:`, `docs:` or `budget:`, and says what changed.
