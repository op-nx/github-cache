import { describe, expect, it } from 'vitest';
import { BRANCH_NAME_PATTERN } from './publish-mirror.js';

describe('BRANCH_NAME_PATTERN (DEFAULT_BRANCH validation)', () => {
  it.each(['main', 'release/2026.07', 'feature-branch', 'v1.2.3'])(
    'accepts plausible branch name "%s"',
    (name) => {
      expect(BRANCH_NAME_PATTERN.test(name)).toBe(true);
    },
  );

  it.each(['main\ninjected', 'has space', '\t', ''])('rejects "%s"', (name) => {
    expect(BRANCH_NAME_PATTERN.test(name)).toBe(false);
  });
});
