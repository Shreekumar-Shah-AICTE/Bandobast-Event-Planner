# Testing

`npm run verify` runs formatting, lint, types, the unit and component tests with coverage, and the build. `npm run e2e` builds the app and runs the browser journeys under the production headers. CI runs both on every push ([`ci.yml`](../.github/workflows/ci.yml)).

## What each layer tests

| Layer | Test files | What is tested |
| --- | --- | --- |
| Planning engine, `src/domain/` | 20 | Every module, plus fast-check property tests: the budget split sums exactly and stays within one unit of each exact share; planned lines plus the reserve equal the total; a delay never moves a task's predecessors; day numbers round-trip; the same inputs build the same plan, and a plan diffed with itself is empty. |
| State, `src/state/` | 2 | The version reducer (apply, restore, undo), saving with a backup, corrupt or newer saves set aside, and blocked storage |
| AI client and readers, `src/ai/` | 2 | Gemini first, then the rules; timeouts and cancelled requests; contact details removed before anything is sent |
| Screens, `src/ui/` | 13 | Each tab with Testing Library: elements found by role and name, focus moves, live announcements and the edits each tab offers |
| AI function, `server/` | 10 | Every status path with a fake model, limiter and cache (403, 405, 413, 415, 429, a fail-closed 503, timeouts, invalid model JSON, a poisoned cache), the output guards, the time budget, and the numbers quoted in these docs |
| Journeys, `e2e/` | 1 | Seven journeys, each on desktop and mobile: the Change Test with a reload, the Gemini path, quotes, a new plan, the keyboard, axe-core on every screen, and no CSP violations |

Tests never call the live Gemini API. A fake model returns fixed answers, including invalid and slow ones, and the browser journeys stub `/api/ai/*` the same way ([`e2e/helpers.ts`](../e2e/helpers.ts)).

## Coverage

Thresholds in [`vite.config.ts`](../vite.config.ts) fail the run if coverage drops:

| Scope                          | Lines | Statements | Functions | Branches |
| ------------------------------ | ----- | ---------- | --------- | -------- |
| Everything measured            | 95%   | 95%        | 95%       | 90%      |
| Planning engine, `src/domain/` | 100%  | 100%       | 100%      | 95%      |

Today: 377 unit and component tests, 99.7% of lines and 98% of branches, plus 14 browser runs.

## Shared test helpers

[`src/test/`](../src/test) holds the fixtures (a fixed today and sample profiles), a fake for the AI function, a `Storage` wrapper that fails on demand (quota, blocked storage), and helpers that render the app, a history or a plan. The server tests pass their fakes through `HandlerDeps`, the same object the function builds from its environment in production ([`server/deps.ts`](../server/deps.ts)).

## Adding a test

- Engine code needs a unit test, and a property test when a rule must hold for every input.
- A bug fix starts with a test that fails without it.
- UI tests query by role and accessible name wherever the element has one.
