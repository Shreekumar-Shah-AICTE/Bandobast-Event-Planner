import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

interface HeaderRule {
  readonly source: string;
  readonly headers: readonly { readonly key: string; readonly value: string }[];
}

/** The production headers from vercel.json, so `vite preview` and the browser tests run under the same CSP. */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(new URL('vercel.json', import.meta.url), 'utf8')) as {
    readonly headers: readonly HeaderRule[];
  };
  const rule = config.headers.find(({ source }) => source === '/(.*)');
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));
}

export default defineConfig({
  plugins: [react()],
  preview: { headers: productionHeaders() },
  build: {
    target: 'es2022',
    sourcemap: false,
    // Fail loudly if the main bundle grows past what a planning app needs.
    chunkSizeWarningLimit: 250,
    rolldownOptions: {
      output: {
        // Libraries change less often than the app, so they get their own long-cached files.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'zod', test: /node_modules[\\/]zod[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/domain/**/*.test.ts',
            'src/*.test.ts',
            'server/**/*.test.ts',
            'shared/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: [
            'src/**/*.test.tsx',
            'src/ai/**/*.test.ts',
            'src/state/**/*.test.ts',
            'src/ui/**/*.test.ts',
          ],
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary'],
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts', 'shared/**/*.ts', 'api/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
        'src/domain/**/*.ts': { lines: 100, statements: 100, functions: 100, branches: 95 },
      },
    },
  },
});
