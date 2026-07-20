import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOST_GATED_EVENTS, TRUSTED_EVENTS } from './lib/trust.js';
import { SYNC_EVENTS } from './lib/sync-gate.js';

/**
 * DOCS-03/GOV-03 single-source drift guard.
 *
 * The trust doc renders the SETTLED model, so its correctness is only as good as
 * its agreement with the code it describes. Rather than a generic topic-token
 * check, this spec imports the authored write-gate and sync-gate allowlists
 * (TRUSTED_EVENTS + HOST_GATED_EVENTS from lib/trust.ts, SYNC_EVENTS from
 * lib/sync-gate.ts) and asserts every event string renders verbatim in
 * docs/trust-and-security.md. A future allowlist change (e.g. widening
 * HOST_GATED_EVENTS) therefore trips this guard until the doc is updated,
 * closing the doc-vs-code drift failure mode.
 *
 * Imports use './lib/...' (one level DOWN into lib/) because this spec lives
 * flat in src/ -- matching serve.ts's './lib/select-backend.js' convention.
 *
 * The docs live at the repo root (../../../ from src/), reached via
 * import.meta.url like ppe-action.spec.ts resolves the top-level ppe/ action.
 */
const trustDocUrl = new URL(
  '../../../docs/trust-and-security.md',
  import.meta.url,
);
const versioningDocUrl = new URL(
  '../../../docs/versioning.md',
  import.meta.url,
);

const trustDoc = existsSync(trustDocUrl)
  ? readFileSync(trustDocUrl, 'utf8')
  : '';
const versioningDoc = existsSync(versioningDocUrl)
  ? readFileSync(versioningDocUrl, 'utf8')
  : '';

describe('docs-trust single-source drift guard (DOCS-03/GOV-03)', () => {
  it('docs/trust-and-security.md exists', () => {
    expect(existsSync(trustDocUrl)).toBe(true);
  });

  it('docs/versioning.md exists', () => {
    expect(existsSync(versioningDocUrl)).toBe(true);
  });

  it('renders every write-gate and sync-gate event string verbatim', () => {
    const events = [...TRUSTED_EVENTS, ...HOST_GATED_EVENTS, ...SYNC_EVENTS];

    for (const event of events) {
      expect(trustDoc, `trust doc missing event "${event}"`).toContain(event);
    }
  });

  it('covers the required non-event trust topics (D-08)', () => {
    const topics = [
      'github.com',
      'GHES',
      'default-branch',
      'ephemeral',
      'CACHE_MIRROR_MAX_AGE_DAYS',
      'storage hygiene',
      'anonymously public',
      'freshness',
      'staleness',
    ];

    for (const topic of topics) {
      expect(trustDoc, `trust doc missing topic "${topic}"`).toContain(topic);
    }
  });

  it('forbids enabling fork-PR / sub-floor-GHES writes (do-not-enable guidance)', () => {
    expect(trustDoc).toMatch(/do not enable|never enable/i);
  });

  it('versioning.md defines breaking against the 0.x posture with a 1.0 freeze', () => {
    for (const token of ['0.x', 'breaking', '1.0', 'minor']) {
      expect(versioningDoc, `versioning doc missing "${token}"`).toContain(
        token,
      );
    }
  });
});
