import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Public-repo email-hygiene guard (allowlist-inversion, GOV-01).
 *
 * This is a MAINTAINER-CONTENT-scoped guard: it checks a fixed set of
 * maintainer-authored governance and package files, NOT outside-contributor
 * commit identities. Contributors' own emails are theirs to choose and are out
 * of scope by design.
 *
 * The check is by ALLOWLIST INVERSION: the ONLY email-shaped token allowed to
 * appear in these files is the approved public contact address; ANY other
 * email-shaped token fails the build. The forbidden value is never written
 * here -- encoding a work email or its bare domain as a search needle would
 * itself be the leak this guard exists to prevent -- so the guard flags
 * "anything that is not the approved address" instead of matching a blocklist.
 *
 * Absence is allowed: a file with zero email-shaped tokens passes. SECURITY.md
 * routes disclosure through GitHub private vulnerability reporting and so needs
 * no contact email at all.
 */
describe('governance email hygiene (allowlist-inversion, GOV-01)', () => {
  // The single approved public contact address. This IS the allowlist -- the
  // only email permitted in the scanned maintainer-authored files.
  const APPROVED_EMAIL = 'larsbrinknielsen@gmail.com';

  // Maintainer-authored files, resolved relative to this spec
  // (packages/github-cache/src/): the root SECURITY.md + LICENSE, the root
  // workspace package.json, and this package's package.json.
  const SCANNED_FILES = [
    '../../../SECURITY.md',
    '../../../LICENSE',
    '../../../package.json',
    // This package's manifest is one level up from src/ (packages/github-cache/).
    // The previous '../../package.json' resolved to packages/package.json, which
    // does not exist, so the old silent-skip meant this file (which carries the
    // maintainer author email) was NEVER actually scanned -- the existence
    // assertion below now makes that class of miss fail loudly.
    '../package.json',
  ];

  // General email-shaped token: local-part @ domain with a TLD. Deliberately
  // broad so it catches any address, then allowlist-inverted against the one
  // approved value below.
  const EMAIL_TOKEN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

  for (const relativePath of SCANNED_FILES) {
    it(`only the approved public email may appear in ${relativePath}`, () => {
      const fileUrl = new URL(relativePath, import.meta.url);

      // A scanned maintainer file must EXIST: a rename/move that drops it has to
      // fail loudly, not silently skip its email-hygiene coverage. All four scanned
      // files are committed, so absence is a real regression, never the normal path.
      expect(existsSync(fileUrl)).toBe(true);

      const content = readFileSync(fileUrl, 'utf8');
      const tokens = content.match(EMAIL_TOKEN) ?? [];
      const disallowed = tokens.filter((token) => token !== APPROVED_EMAIL);

      expect(disallowed).toEqual([]);
    });
  }
});
