# Security

## Reporting a problem

Please report it privately with **Report a vulnerability** on this repository's Security tab, and please don't open a public issue. Include the steps to reproduce it.

## What is protected, and how

| Asset | Threat | Control | Where |
| --- | --- | --- | --- |
| Gemini API key | Leaking to the browser | Server-only environment variable, never `VITE_`-prefixed. The browser talks only to its own origin (CSP `connect-src 'self'`). | `server/env.ts`, `vercel.json` |
| Gemini quota and cost | Abuse, scripted floods | 12 requests per 60 s and 200 a day per client, and 3,000 a day for the app, all in Upstash Redis. If the store fails, requests are refused (fail closed). Store calls time out after 1.5 s. | `server/store.ts`, `server/config.ts` |
| The function | Oversized or hostile requests | POST only, JSON only, a same-site `Origin`, and a 16 KB body cap enforced while the body streams in. Then a zod schema for each task. | `server/request.ts`, `shared/aiContracts.ts` |
| Users' text | Exposure in logs or caches | Phone numbers and e-mails are removed from every text sent to the AI, in the browser and again on the server. Logs keep only the task, status, models tried and timing. The cache key is a one-way hash of the request. | `src/domain/grounding.ts`, `server/log.ts`, `server/handler.ts` |
| Client identity | Tracking | The limiter keys on a salted SHA-256 hash of the platform-set IP, never the raw address. | `server/request.ts` |
| The page | XSS, clickjacking, injection through AI output | React escapes all text, and there is no `dangerouslySetInnerHTML`. Strict CSP with `script-src 'self'` and `frame-ancestors 'none'`, plus `X-Frame-Options: DENY`. AI output is checked data, never markup or links. | `vercel.json`, `src/ui/` |
| Plan accuracy | Prompt injection, invented numbers | User text is fenced as data. Each answer must pass its output schema and code checks: evidence quoted from the request, amounts present in the quote, no digits in explanations. A failed check means the rules take over. | `server/tasks.ts`, `src/domain/grounding.ts`, `src/domain/explain.ts` |
| Opened plan files | Damaged or crafted files | A 2 MB cap, then the same zod schema and version check as a saved plan. Nothing changes until the file passes, and replacing a plan asks first. | `src/domain/storage.ts`, `src/ui/common/PlanFile.tsx` |
| Dependencies | Supply-chain attacks | Exact versions with a lockfile, `npm audit` in CI, GitHub Actions pinned to commit SHAs, and Dependabot. | `package.json`, `.github/` |

## Out of scope

There are no accounts, no server-side storage of plans and no payments. A plan lives in the user's own browser (`localStorage`), so whoever uses that browser profile can see it.
