/** The numbers the docs quote about limits, timing and the AI must match the code. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../shared/limits.js';
import { AI_TIMING } from '../shared/timing.js';
import { templateFor } from '../src/domain/templates/index.js';
import { SERVER_CONFIG } from './config.js';

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\s+/gu, ' ');

const readme = read('README.md');
const security = read('SECURITY.md');
const decisions = read('docs/decisions.md');
const footer = read('src/ui/common/Footer.tsx');
const seconds = (ms: number): string => `${String(ms / 1000)} s`;

describe('numbers quoted in the docs', () => {
  it('match the rate limits', () => {
    const { rateLimit, clientDailyLimit, dailyLimit } = SERVER_CONFIG;
    const perClient = `${String(rateLimit.requests)} requests per ${rateLimit.window}`;
    const clientDaily = `${String(clientDailyLimit.requests)} a day per client`;
    const daily = `${dailyLimit.requests.toLocaleString('en-US')} a day`;
    for (const doc of [readme, security]) {
      expect(doc).toContain(perClient);
      expect(doc).toContain(clientDaily);
      expect(doc).toContain(daily);
    }
    expect(security).toContain(`after ${seconds(SERVER_CONFIG.limiterTimeoutMs)}`);
  });

  it('match the time budget', () => {
    for (const doc of [readme, decisions]) {
      expect(doc).toContain(`server answers within ${seconds(AI_TIMING.serverBudgetMs)}`);
      expect(doc).toContain(`browser waits ${seconds(AI_TIMING.clientTimeoutMs)}`);
      expect(doc).toContain(`function at ${String(AI_TIMING.functionMaxDurationS)} s`);
    }
    expect(readme).toContain(`at most ${seconds(SERVER_CONFIG.timing.modelTimeoutMs)}`);
  });

  it('match the body cap, the answer cache and the kept versions', () => {
    const cap = `${String(SERVER_CONFIG.maxBodyBytes / 1024)} KB body cap`;
    expect(readme).toContain(cap);
    expect(security).toContain(cap);
    const hours = `${String(SERVER_CONFIG.cacheTtlSeconds / 3600)} hours`;
    expect(readme).toContain(hours);
    expect(footer).toContain(hours);
    expect(readme).toContain(`the last ${String(LIMITS.maxVersions)}`);
  });

  it('match the models, the temperature and the wedding reserve', () => {
    for (const model of SERVER_CONFIG.defaultModels) expect(readme).toContain(`\`${model}\``);
    expect(readme).toContain(`temperature ${String(SERVER_CONFIG.temperature)}`);
    expect(readme).toContain(`(${String(templateFor('wedding').contingencyPct)}% for weddings)`);
  });
});
