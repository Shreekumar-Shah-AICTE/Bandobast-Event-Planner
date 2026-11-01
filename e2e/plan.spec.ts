import { expect, test } from '@playwright/test';
import {
  aiAnswers,
  aiUnavailable,
  expectNoAxeViolations,
  isoDaysFromNow,
  openSample,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await aiUnavailable(page);
  await page.goto('/');
});

test('the sample plan takes the Change Test and survives a reload', async ({ page }) => {
  await openSample(page);
  await page
    .getByRole('button', { name: '50 more guests, budget down 10%, event 2 weeks earlier' })
    .click();
  await page.getByRole('button', { name: 'Check what this changes' }).click();
  await expect(page.getByRole('heading', { name: 'Check these changes' })).toBeFocused();
  await expect(page.getByText(/AI is not available/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply 3 changes' }).click();
  const report = page.getByRole('region', { name: 'What changed' });
  await expect(report.getByRole('heading', { name: 'What changed' })).toBeFocused();
  await expect(report.getByText('Guests: 200 → 250')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'History (2 saved)' })).toBeVisible();
});

test('a change read by Gemini says so and offers ways to rebalance', async ({ page }) => {
  await aiAnswers(page, 'change', {
    changes: [
      {
        kind: 'budget',
        mode: 'set',
        value: 700_000,
        date: null,
        taskId: null,
        evidence: 'budget is 7 lakh',
      },
    ],
    unparsed: [],
  });
  await openSample(page);
  await page.getByLabel('Tell the plan in your own words').fill('budget is 7 lakh');
  await page.getByRole('button', { name: 'Check what this changes' }).click();
  await expect(page.getByText(/Read by Gemini \(gemini-test\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply 1 change' }).click();
  await expect(page.getByRole('region', { name: 'Ways to rebalance' }).first()).toBeVisible();
});

test('a pasted quote is checked, saved and compared', async ({ page }) => {
  await openSample(page);
  await page.getByRole('tab', { name: /^Quotes/ }).click();
  for (const vendor of ['Shree Ganesh Caterers', 'Annapurna Caterers']) {
    await page.getByRole('button', { name: vendor }).click();
    await page.getByRole('button', { name: 'Read this quote' }).click();
    await expect(page.getByRole('heading', { name: /^Read: / })).toBeFocused();
    await page.getByRole('button', { name: 'Save this quote' }).click();
    await expect(page.getByLabel('Paste the quote')).toBeFocused();
  }
  await expect(
    page.getByRole('heading', { name: 'Food & catering: lowest worst case first' }),
  ).toBeVisible();
  await expect(page.getByText('Best value')).toHaveCount(1);
});

test('a new plan starts from the form', async ({ page }) => {
  await page.getByRole('button', { name: 'Start a new plan' }).click();
  await page.getByLabel('Birthday').check();
  await page.getByLabel('Name of the plan').fill("Meera's 30th");
  await page.getByLabel('City or town').fill('Indore');
  await page.getByLabel('Date of the event').fill(isoDaysFromNow(120));
  await page.getByLabel('Number of guests').fill('60');
  await page.getByLabel('Total budget').fill('2 lakh');
  await page.getByRole('button', { name: 'Make my plan' }).click();
  await expect(page.getByRole('heading', { level: 1, name: "Meera's 30th" })).toBeFocused();
});

test('the skip link comes first and the tabs work from the keyboard', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to the plan' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await openSample(page);
  await page.getByRole('tab', { name: 'Overview' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Budget' })).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Budget' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: /^History/ })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeFocused();
});

test('every screen passes an automated WCAG 2.2 AA check', async ({ page }) => {
  await expectNoAxeViolations(page);
  // The form, with its error summary showing.
  await page.getByRole('button', { name: 'Start a new plan' }).click();
  await page.getByRole('button', { name: 'Make my plan' }).click();
  await expect(page.getByRole('alert').getByRole('heading', { name: /^Please fix/ })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.goto('/');
  await openSample(page);
  await expectNoAxeViolations(page);
  // The Change Test: the preview, then the What changed report.
  await page
    .getByRole('button', { name: '50 more guests, budget down 10%, event 2 weeks earlier' })
    .click();
  await page.getByRole('button', { name: 'Check what this changes' }).click();
  await expect(page.getByRole('heading', { name: 'Check these changes' })).toBeFocused();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Apply 3 changes' }).click();
  await expect(page.getByRole('heading', { name: 'What changed' })).toBeFocused();
  await expectNoAxeViolations(page);
  for (const name of ['Budget', /^Timeline/, 'Vendors', /^Quotes/, 'Ideas', /^History/]) {
    await page.getByRole('tab', { name }).click();
    await expectNoAxeViolations(page);
  }
});

test('the app runs under the production security headers with no violations', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.text().startsWith('CSP ')) violations.push(message.text());
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`CSP ${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const response = await page.goto('/');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  await openSample(page);
  await page.getByLabel('Tell the plan in your own words').fill('budget 10% kam');
  await page.getByRole('button', { name: 'Check what this changes' }).click();
  await page.getByRole('button', { name: 'Apply 1 change' }).click();
  for (const name of ['Budget', /^Timeline/, 'Vendors', /^Quotes/, 'Ideas', /^History/]) {
    await page.getByRole('tab', { name }).click();
  }
  expect(violations).toEqual([]);
});
