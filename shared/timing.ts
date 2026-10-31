/**
 * Time budget for one AI request, shared by browser and server so the layers
 * give up in order: model attempts → server answer → browser → platform.
 * `server/timing.test.ts` checks these numbers against each other and vercel.json.
 */
export const AI_TIMING = {
  /** The server answers, or tells the browser to fall back, within this time. */
  serverBudgetMs: 20_000,
  /** The browser waits a little longer, so it normally hears the server's answer. */
  clientTimeoutMs: 23_000,
  /** Vercel's limit for the function (`vercel.json` → functions → maxDuration). */
  functionMaxDurationS: 25,
} as const;
