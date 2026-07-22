import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * RETAIN-03 is a workflow-config requirement, not runtime logic: there is no
 * injected-client seam over YAML, so 04-VALIDATION.md classified it manual-review
 * only. This pins the SECURITY-load-bearing structure directly from disk instead --
 * the same contents:write GITHUB_TOKEN with no PAT and no wider scope, and a
 * queue-don't-cancel concurrency group -- so a regression (a widened scope, a
 * flipped cancel-in-progress, a swapped-in PAT) fails the automated suite rather
 * than surviving until the next manual re-review.
 *
 * Path resolved via import.meta.url (the pinned-deps.spec.ts / release-asset-name
 * .spec.ts idiom), NOT __dirname and NOT process.cwd().
 *
 * Only non-comment lines are matched: this file's own prose comments repeat
 * "contents: write" and "cancel-in-progress" verbatim while explaining the
 * rationale, so a naive substring match against the raw file would pass even if
 * the REAL YAML directive had drifted. Stripping '#'-prefixed lines first makes
 * every assertion below non-vacuous against the actual config.
 */
const workflowSource = readFileSync(
  new URL('../../../../.github/workflows/cleanup.yml', import.meta.url),
  'utf8',
);

const codeLines = workflowSource
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

describe('cleanup.yml workflow config (RETAIN-03)', () => {
  it('grants ONLY contents: write -- no actions:read, no packages scope', () => {
    expect(codeLines).toMatch(/permissions:\s*\n\s*contents:\s*write\s*\n/);
    expect(codeLines).not.toMatch(/actions:\s*(read|write)/);
    expect(codeLines).not.toMatch(/packages:\s*(read|write)/);
  });

  it('serializes concurrent runs with cancel-in-progress: false (queue, never cancel mid-delete)', () => {
    expect(codeLines).toMatch(
      /concurrency:\s*\n\s*group:\s*\S+\s*\n\s*cancel-in-progress:\s*false/,
    );
  });

  it('authenticates with the inherited GITHUB_TOKEN, never a PAT or a custom secret', () => {
    expect(codeLines).toMatch(
      /GITHUB_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/,
    );
    expect(codeLines).not.toMatch(
      /delete:packages|personal-access|PAT\b|ACTIONS_STEP/,
    );
  });

  it('runs on a schedule trigger, never on push or pull_request', () => {
    expect(codeLines).toMatch(/^on:\s*\n\s*schedule:/m);
    expect(codeLines).not.toMatch(/^\s*(push|pull_request):/m);
  });
});
