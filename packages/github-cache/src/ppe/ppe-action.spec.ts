import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * TRUST-06 config-assertion for the shipped PPE-hygiene COMPOSITE action.
 *
 * The tool versions are self-installed at consumer runtime (D-11), not npm
 * deps, so pinned-deps.spec.ts cannot guard them. This pins the load-bearing
 * structure directly from disk instead -- the composite form, both exact
 * version pins, and the advisory (--no-exit-codes / not-containment) posture
 * -- so a regression (a pin drift, a dropped advisory switch, or the gate
 * silently re-cast as a containment control) fails the automated suite rather
 * than surviving until the next manual re-review. The D-11 exact-pin analog of
 * pinned-deps.spec.ts + the D-12 advisory-posture lock.
 *
 * Path resolved via import.meta.url (the cleanup-workflow.spec.ts /
 * pinned-deps.spec.ts idiom), NOT __dirname and NOT process.cwd(). Four dirs up
 * from src/ppe/ reaches the repo root where the top-level ppe/ action lives.
 *
 * Only non-comment lines are matched: this file's own prose comments repeat
 * "advisory", "composite", and the version strings verbatim, and action.yml
 * carries its own '#' rationale header, so a naive raw-file substring match
 * would pass even if the REAL directive had drifted. Stripping '#'-prefixed
 * lines first makes every assertion below non-vacuous against the actual config
 * (changing 1.27.0 -> any other version, or dropping --no-exit-codes, fails).
 */
const actionSource = readFileSync(
  new URL('../../../../ppe/action.yml', import.meta.url),
  'utf8',
);

const codeLines = actionSource
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

describe('ppe/action.yml composite PPE-hygiene gate (TRUST-06)', () => {
  it('is a composite action an adopter consumes as a step (D-10)', () => {
    expect(codeLines).toMatch(/using:\s*['"]?composite/);
  });

  it('self-installs zizmor exact-pinned to 1.27.0 -- no range (D-11)', () => {
    expect(codeLines).toMatch(/zizmor==1\.27\.0/);
  });

  it('self-installs actionlint exact-pinned to 1.7.12 via the official download script (D-11)', () => {
    expect(codeLines).toMatch(/download-actionlint\.bash\D+1\.7\.12/);
  });

  it('runs zizmor advisory with --no-exit-codes so a finding never fails the consumer job (D-12)', () => {
    expect(codeLines).toMatch(/--no-exit-codes/);
  });

  it('positions the gate as advisory, never the containment control (D-12)', () => {
    expect(codeLines).toMatch(/advisory/i);
    expect(codeLines).toMatch(/not\s+(?:a|the)?\s*containment/i);
  });

  // The advisory contract ("a finding never fails your job") must hold for the tool
  // INSTALL steps too, not only the audit flags: a composite run step executes under
  // `bash -eo pipefail`, so a bare install failure would propagate and fail the
  // consumer's job. These pin the non-fatal installs + the audit binary-guard so that
  // contract cannot silently regress.
  it('makes the zizmor install non-fatal so an install failure never fails the consumer job (advisory contract)', () => {
    expect(codeLines).toMatch(/pipx install zizmor==1\.27\.0 \|\|/);
  });

  it('makes the actionlint install non-fatal so an install failure never fails the consumer job (advisory contract)', () => {
    expect(codeLines).toMatch(/actionlint install failed/);
  });

  it('skips the zizmor audit when the binary is absent so a failed install never hard-fails (advisory contract)', () => {
    expect(codeLines).toMatch(/command -v zizmor/);
  });

  it('declares a shell for every run step (composite requirement) and no top-level env', () => {
    const runSteps = codeLines.match(/^\s+run:/gm) ?? [];
    const shellDecls = codeLines.match(/^\s+shell:\s*bash\b/gm) ?? [];

    expect(runSteps.length).toBeGreaterThan(0);
    expect(shellDecls.length).toBe(runSteps.length);
    expect(codeLines).not.toMatch(/^env:/m);
  });
});
