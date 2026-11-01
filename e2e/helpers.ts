/** Shared steps for the browser tests: a stubbed AI function and an accessibility check. */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Answers every AI request with 503, so the built-in rules do the reading. */
export async function aiUnavailable(page: Page): Promise<void> {
  await page.route('**/api/ai/**', (route) =>
    route.fulfill({ status: 503, json: { ok: false, error: 'unavailable', fallback: true } }),
  );
}

/** Answers one AI task with checked-looking data from "gemini-test". */
export async function aiAnswers(page: Page, task: string, data: unknown): Promise<void> {
  await page.route(`**/api/ai/${task}`, (route) =>
    route.fulfill({ json: { ok: true, data, model: 'gemini-test' } }),
  );
}

/** Fails with the list of WCAG 2.2 A/AA problems axe-core finds on the page. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map(({ id, nodes }) => `${id}: ${String(nodes.length)}`)).toEqual([]);
}

export async function openSample(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Try the sample/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: "Riya & Arjun's wedding" }),
  ).toBeFocused();
}

/** An ISO date `days` from today, so the form's "must be in the future" check never expires. */
export function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
