import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EXPECTED_ENV_KNOBS } from './test/consumer-contract.js';

/**
 * DOCS-01/02/04/06 adoption-docs content guard.
 *
 * A lightweight presence / required-topic guard over the adoption docs. It fails
 * `nx test github-cache` when a required doc goes missing, a documented env knob
 * or a required note disappears from the config reference, the README or the
 * minimal example stops showing the background-step lifecycle, or the minimal
 * example drifts into this repo's dogfood-only shape. It asserts stable topic
 * TOKENS (presence), never full prose, so ordinary doc edits do not churn it.
 *
 * The docs live at the repo root (../../../ from src/), reached via
 * import.meta.url -- the docs-trust.spec.ts / ppe-action.spec.ts idiom. Because
 * these files live OUTSIDE this project's graph, they are wired into the `test`
 * target inputs in nx.json (the 06-02/06-03 stale-cache precedent) so an edit to
 * any of them busts the Nx cache and re-runs this guard instead of replaying a
 * stale pass.
 */
const repoRoot = new URL('../../../', import.meta.url);

function docUrl(relativePath: string): URL {
  return new URL(relativePath, repoRoot);
}

function read(relativePath: string): string {
  return readFileSync(docUrl(relativePath), 'utf8');
}

const REQUIRED_DOCS = [
  'README.md',
  'docs/configuration.md',
  'docs/advanced.md',
  'docs/examples/minimal-ci.yml',
  'docs/examples/README.md',
];

/** The background-step lifecycle tokens both the README and the example must show. */
const LIFECYCLE_TOKENS = ['start-cache-server', 'background:', 'cancel:'];

describe('adoption docs exist (DOCS-01/02/04)', () => {
  it.each(REQUIRED_DOCS)('%s exists', (path) => {
    expect(existsSync(docUrl(path))).toBe(true);
  });
});

describe('configuration.md documents the consumer contract (DOCS-02)', () => {
  const config = read('docs/configuration.md');

  it.each(EXPECTED_ENV_KNOBS)('documents env knob %s', (knob) => {
    expect(config).toContain(knob);
  });

  it('documents MAX_CACHE_BODY_BYTES as a fixed contract limit', () => {
    expect(config).toContain('MAX_CACHE_BODY_BYTES');
    expect(config).toMatch(/fixed/i);
  });

  it('documents the Actions-cache 10 GB per-repo limit', () => {
    expect(config).toContain('10 GB');
  });

  it('documents the no-default-local-read note', () => {
    expect(config).toMatch(/no anonymous default local-read/i);
  });
});

describe('README + minimal example show the background-step lifecycle (DOCS-06)', () => {
  const readme = read('README.md');
  const example = read('docs/examples/minimal-ci.yml');

  it.each(LIFECYCLE_TOKENS)('README references %s', (token) => {
    expect(readme).toContain(token);
  });

  it.each(LIFECYCLE_TOKENS)('minimal example references %s', (token) => {
    expect(example).toContain(token);
  });
});

describe('minimal example is distinct from the dogfood config (DOCS-04)', () => {
  const example = read('docs/examples/minimal-ci.yml');

  it('does not include dogfood-only action operations', () => {
    expect(example).not.toContain('operation:');
  });

  it('does not include a dogfood-only OS matrix', () => {
    expect(example).not.toMatch(/matrix:/);
  });
});
