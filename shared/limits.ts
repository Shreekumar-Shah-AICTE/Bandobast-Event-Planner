/**
 * Input limits shared by the browser, the API and the persisted state.
 * They bound memory, prompt size and storage; none of them is a product promise.
 */
export const LIMITS = {
  /** Largest guest count we plan for (big community events). */
  maxGuests: 5000,
  /** ₹1,000 — anything smaller is not a planning budget. */
  minBudgetRupees: 1000,
  /** ₹10 crore — keeps every paise value far below Number.MAX_SAFE_INTEGER. */
  maxBudgetRupees: 100_000_000,
  maxTitleLength: 80,
  /** Ids of tasks, quotes and format options. */
  maxIdLength: 40,
  maxCityLength: 40,
  maxPriorities: 3,
  maxChangeTextLength: 300,
  maxIntakeAnswerLength: 600,
  maxQuoteTextLength: 4000,
  maxQuoteItems: 20,
  maxQuotes: 20,
  maxVersions: 30,
  maxChanges: 6,
  maxShiftDays: 365,
  maxDelayDays: 120,
  maxIdeas: 6,
  maxBriefItems: 8,
  maxShortText: 160,
  /** Highest GST slab in India (28%). */
  maxGstRatePct: 28,
  maxExplainLength: 600,
  /** Rebalance options shown at once. */
  maxScenarios: 3,
  maxPlaceholders: 60,
} as const;
