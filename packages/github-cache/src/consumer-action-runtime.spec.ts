import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * DOCS-06 architecture-invariant guard.
 *
 * The consumer sidecar action MUST be a JS action (`runs.using: node24`),
 * never composite: a composite action cannot declare `background:` internally
 * (research Pitfall 5), so a `uses: op-nx/github-cache/start-cache-server`
 * background step would silently stop working for every adopter if this ever
 * regressed to `using: composite`. No other spec in the suite asserts
 * `runs.using` or `runs.main` on start-cache-server/action.yml -- public-surface.spec.ts
 * only parses its `inputs:` keys -- so this invariant was previously
 * unguarded against a one-line YAML edit.
 */
const actionYaml = readFileSync(
  new URL('../../../start-cache-server/action.yml', import.meta.url),
  'utf8',
);

describe('consumer action runtime is a JS action, never composite (DOCS-06)', () => {
  it('declares runs.using as node24', () => {
    expect(actionYaml).toMatch(/using:\s*'?node24'?/);
  });

  it('does not declare a composite runtime', () => {
    expect(actionYaml).not.toMatch(/using:\s*'?composite'?/);
  });

  it('points main at the committed bundle (index.js), never gitignored dist/', () => {
    const mainField = /^\s*main:\s*'?([^'\n]+)'?\s*$/m.exec(actionYaml);

    expect(mainField?.[1]).toBe('index.js');
  });
});
