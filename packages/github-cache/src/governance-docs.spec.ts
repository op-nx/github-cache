import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * GOV-01/GOV-02 persistent content guard.
 *
 * Plan 06-03's acceptance criteria for SECURITY.md and LICENSE content (GitHub
 * private vulnerability reporting as the primary channel, a 0.x supported-
 * versions table, a coordinated-disclosure window, and the correct MIT
 * copyright holder) were only checked ONCE, at plan-execution time, via a
 * one-off shell `<verify><automated>` command in 06-03-PLAN.md -- never as a
 * spec inside the ongoing `nx test github-cache` battery. governance-email.spec.ts
 * scans the SAME files but only for email-shaped tokens; it says nothing about
 * whether the disclosure policy itself still reads correctly.
 *
 * This closes that gap: a future edit that silently drops the private-
 * vulnerability-reporting section, the supported-versions table, the
 * disclosure window, or the LICENSE holder now fails the persistent suite
 * instead of only having been checked once and never again.
 */
const securityDoc = readFileSync(
  new URL('../../../SECURITY.md', import.meta.url),
  'utf8',
);
const licenseDoc = readFileSync(
  new URL('../../../LICENSE', import.meta.url),
  'utf8',
);

describe('SECURITY.md disclosure policy content stays intact (GOV-01)', () => {
  it('routes disclosure through GitHub private vulnerability reporting, not a maintainer inbox', () => {
    expect(securityDoc).toMatch(/private vulnerability|security advisor/i);
  });

  it('documents a pre-1.0 (0.x) supported-versions table', () => {
    expect(securityDoc).toMatch(/supported versions/i);
    expect(securityDoc).toContain('0.x');
  });

  it('states the concrete coordinated-disclosure windows (triage + backstop)', () => {
    expect(securityDoc).toMatch(/coordinated disclosure/i);
    // Concrete documented windows, not any "N days" substring anywhere in the file:
    // the 7-day triage response target and the 90-day backstop disclosure deadline.
    // Dropping the section or changing either window now fails here, unlike the old
    // loose /\d+\s*days?/ that any "N days" line in the doc satisfied.
    expect(securityDoc).toMatch(/within\s*7\s*days/i);
    expect(securityDoc).toMatch(/90\s*days/i);
  });
});

describe('root LICENSE content stays intact (GOV-02)', () => {
  it('is the MIT license with the correct copyright holder', () => {
    expect(licenseDoc).toMatch(/MIT License/);
    expect(licenseDoc).toContain('Lars Gyrup Brink Nielsen');
  });
});
