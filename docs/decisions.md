# Design decisions

Short records of the choices that shape the code. Each one says what was decided, why, and what it costs.

## 1. One pure function makes the plan

`buildPlan(input, today)` derives the budget, scenarios, schedule, vendor cards and quote analyses from the user's
inputs. Only inputs are stored, so a version is just its inputs, and undo, restore and the impact report are exact.
**Cost:** the plan is rebuilt on every change. That takes well under a millisecond for this data, and the result is
memoised.

## 2. Code calculates, Gemini reads and writes

Gemini handles the language work: change requests, quotes, free-text intake, ideas and explanations. Every number
on screen comes from the engine. AI answers are validated with schemas and then checked by code against the user's
own text. **Cost:** the checks reject some correct answers, and the rules then take over. We accept that in exchange
for never showing an invented price.

## 3. Every AI task has a rule-based fallback

The app is complete without the AI: the change reader, quote parser, intake reader, idea library and template
explanation all work offline. The UI always says which one read the text. **Cost:** two readers per task, and both
are tested.

## 4. Money in integer paise, dates as UTC day numbers

This avoids floating-point drift in budgets and time-zone bugs in schedules. The budget split uses
largest-remainder rounding in ₹100 steps, and the reserve absorbs the difference, so the lines always add up to the
total.

## 5. Safeguards use a shared store, or they don't exist

Serverless instances don't share memory, so an in-memory rate limiter would only look like protection. Limits and
the answer cache live in Upstash Redis. If the store is unreachable, AI requests are refused (fail closed), and the
app keeps working with its rules.

## 6. One time budget per AI request

The server answers within 20 s, the browser waits 23 s, and Vercel stops the function at 25 s. Model attempts,
store calls and the cache all fit inside that budget, so the layers give up in a fixed order and the user always
gets an answer or a fallback. The numbers live in `shared/timing.ts`, and a test checks them against `vercel.json`.

## 7. Plans stay in the browser

There are no accounts and no server database, so there are no personal data to breach. Saves are validated on load,
an unreadable save is set aside rather than overwritten, and if `localStorage` is blocked the app says so and keeps
the plan in memory. **Cost:** there is no sync across devices.

## 8. A small dependency set

The app uses React, zod, the Gemini SDK and the Upstash clients, with no UI framework or state library. The
production JavaScript is about 131 kB gzipped.
