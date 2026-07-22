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

// entry.ts lives outside this package's tsconfig rootDir, so it cannot be
// behaviorally imported from a spec here (TS6059) -- source-level assertion is the
// documented fallback (Task 5). Comment-strip so the guard shape, not prose, is
// what the patterns match.
const entrySource = readFileSync(
  new URL('../../../start-cache-server/entry.ts', import.meta.url),
  'utf8',
)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

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

describe('consumer sidecar fails loud when the port input is omitted (F06)', () => {
  // The defect was `if (portInput) { ...validate... }`, which skipped validation
  // entirely when the input was absent -- so serve() fell back to an OS-assigned
  // ephemeral port the Nx client can never reach (silent all-MISS). The guard now
  // treats an empty/absent input as a failure.
  it('refuses an absent port input via a `!portInput` guard, not a skip-on-omit branch', () => {
    // Mutation-proof: the exact skip-on-omit shape must be gone...
    expect(entrySource).not.toMatch(/if\s*\(\s*portInput\s*\)/);
    // ...and replaced by the fail-fast negation.
    expect(entrySource).toMatch(/if\s*\(\s*!\s*portInput\s*\)/);
  });

  it('calls core.setFailed on the absent-port branch and never reaches serve()', () => {
    // The `!portInput` guard block must setFailed then early-return before serve().
    const guard =
      /if\s*\(\s*!\s*portInput\s*\)\s*\{[\s\S]*?core\.setFailed\([\s\S]*?return;[\s\S]*?\}/.exec(
        entrySource,
      );

    expect(guard).not.toBeNull();

    const serveIndex = entrySource.indexOf('serve(');

    expect(serveIndex).toBeGreaterThan(guard!.index + guard![0].length);
  });

  it('still validates a supplied port against the 1-65535 integer range', () => {
    expect(entrySource).toMatch(/Number\.isInteger\(parsed\)/);
    expect(entrySource).toMatch(/parsed\s*<\s*1\s*\|\|\s*parsed\s*>\s*65535/);
  });
});
