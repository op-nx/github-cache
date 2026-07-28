import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * VER-06's SAMPLING-RATE guard. A spec runs in one process on one OS and cannot
 * observe a two-OS property, so the load-bearing control for VER-06 is a CI job, not
 * a test. What a spec CAN do is pin the job's shape, and that shape is the whole
 * proof: one leg samples one OS and cannot detect an OS-partitioned cache store at
 * any rate. The Nyquist floor here is two legs.
 *
 * Two clauses, and the SECOND is the one that matters most:
 *
 *   1. `dogfood-verify` declares the two-leg matrix -- otherwise the Windows OS is
 *      never sampled and the cross-OS claim rests on nothing.
 *   2. `dogfood-seed` declares NO matrix. The seed key is
 *      `nx-cache-<GITHUB_RUN_ID>`: ONE key per RUN, not per OS. So a Windows seed leg
 *      makes the Windows verify job restore a WINDOWS-written entry and pass even
 *      with cross-OS restore completely dead. That is the vacuity trap, and this
 *      clause is what makes it structurally unreachable rather than merely
 *      documented. It is also the clause a future contributor is most likely to break
 *      while believing they are improving coverage, which is why its failure message
 *      spells out the reason.
 *
 * Path resolved via import.meta.url (the cleanup-workflow.spec.ts / pinned-deps
 * .spec.ts idiom), NOT __dirname and NOT process.cwd(). Placed at the package-source
 * root rather than in a subdirectory because its subject is a workspace-root workflow
 * file, not a cohesive module (.planning/codebase/TESTING.md spec placement).
 *
 * Only non-comment lines are matched: this file's own prose repeats `windows-11-arm`
 * and `fail-fast` verbatim while explaining the rationale, and `ci.yml`'s OWN comment
 * block above these jobs repeats the same strings, so a naive substring match against
 * the raw file would pass even after the real YAML had drifted. Stripping
 * '#'-prefixed lines first makes every assertion below non-vacuous against the actual
 * config.
 *
 * ASSERTIONS ARE SCOPED PER JOB BLOCK, deliberately. A bare
 * `expect(codeLines).toContain('windows-11-arm')` over all of `ci.yml` is already
 * satisfied by the `integration`, `hash-parity` and `publish` jobs, all of which name
 * that runner today -- so a whole-file match would pass unconditionally, whatever
 * `dogfood-verify` actually says. That is the exact non-vacuity failure this phase
 * keeps guarding against, so the extraction below is narrowed to each job's own block
 * and a positive control asserts the extraction is not empty.
 *
 * This spec depends on `{workspaceRoot}/.github/workflows/ci.yml` being in
 * `nx.json`'s `targetDefaults.test.inputs` (PARITY-08, plan 09-01, `nx.json:69`).
 * Without it, `ci.yml` is not a hashed input and this spec replays a cached PASS
 * computed before its subject existed.
 */
const codeLines = readFileSync(
  new URL('../../../.github/workflows/ci.yml', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'));

/**
 * One job's own block: from the `  <name>:` key (jobs are keyed at two spaces) up to
 * the next line at that same indent, exclusive. Throws rather than returning empty
 * when the job is absent, so a renamed or deleted job fails loud here instead of
 * silently satisfying the `not.toMatch` clause below.
 */
function jobBlock(name: string): string {
  const start = codeLines.findIndex((line) =>
    new RegExp(`^ {2}${name}:\\s*$`).test(line),
  );

  if (start < 0) {
    throw new Error(
      `ci.yml: no job keyed \`  ${name}:\` -- VER-06's guard cannot scope its assertions`,
    );
  }

  const rest = codeLines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));

  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

describe('ci.yml dogfood cross-OS sampling (VER-06)', () => {
  it('scopes to a real, non-empty job block -- the control that makes the no-matrix clause non-vacuous', () => {
    // A `not.toMatch` against an empty string passes trivially, so prove the
    // extraction actually captured each job before asserting on absence.
    expect(jobBlock('dogfood-seed')).toMatch(/operation:\s*seed/);
    expect(jobBlock('dogfood-verify')).toMatch(/operation:\s*verify/);
  });

  it('dogfood-verify samples BOTH OSes with fail-fast off, so a Windows-only failure never hides the ubuntu result', () => {
    const verify = jobBlock('dogfood-verify');

    expect(verify).toMatch(/strategy:\s*\n\s*fail-fast:\s*false/);
    expect(verify).toMatch(/matrix:\s*\n\s*os:\s*\[[^\]]*\]/);
    expect(verify).toMatch(/ubuntu-24\.04-arm/);
    expect(verify).toMatch(/windows-11-arm/);
    expect(verify).toMatch(/runs-on:\s*\$\{\{\s*matrix\.os\s*\}\}/);
  });

  it('dogfood-seed stays SINGLE-LEG -- a Windows seed leg would make the whole proof vacuous', () => {
    const seed = jobBlock('dogfood-seed');
    const reason =
      'dogfood-seed must stay single-leg (ubuntu-only). The seed key is ' +
      'nx-cache-<GITHUB_RUN_ID> -- ONE key per RUN, not per OS -- so a Windows seed leg ' +
      'makes the Windows dogfood-verify leg restore a WINDOWS-written entry and pass even ' +
      'if cross-OS restore is completely broken. That turns VER-06 into a presence check.';

    expect(seed, reason).not.toMatch(/strategy:/);
    expect(seed, reason).not.toMatch(/matrix/);
    expect(seed, reason).toMatch(/runs-on:\s*ubuntu-24\.04-arm/);
  });
});

/**
 * ROBUST-04's SAMPLING RATE, and it lives in VER-06's guard because it is the same fact
 * about which event samples what.
 *
 * A green `dogfood-verify` is NOT ROBUST-04 evidence: both dogfood jobs use
 * `./packages/github-cache`, whose `dist/action/index.js` is built from source IN-JOB, so
 * neither ever executes the committed `start-cache-server/index.js` that four of the five
 * sidecar `uses:` sites run. `action-bundle-drift` is the only control tying the two
 * together, and `09-RESEARCH.md`'s validation table states ROBUST-04's sampling rate as
 * "every PR and every push" on the strength of that job carrying NO `if:`.
 *
 * Nothing in the tree asserted that shape. Adding `if: github.event_name == 'push'` to it
 * -- the same gate that makes VER-06 and OBS-04 unobservable pre-merge, and therefore the
 * edit a reader is most likely to make while believing they are being consistent -- would
 * silently drop the committed bundle's only standing sampler to push-to-`main` only, while
 * every spec in this file and every other ci.yml guard stayed green.
 */
describe('ci.yml action-bundle-drift stays PR-eligible (ROBUST-04)', () => {
  // POSITIVE CONTROL, and it has to come first for the same reason the job-block control
  // above does: the clause below asserts an ABSENCE, which an empty or mis-extracted block
  // satisfies trivially.
  it('scopes to a real job block that runs the bundle diff', () => {
    expect(jobBlock('action-bundle-drift')).toMatch(
      /run:\s*npm run check:action/,
    );
  });

  it('declares NO job-level if:, so the committed bundle is diffed on pull requests too', () => {
    // Anchored at FOUR spaces -- a job's own keys sit one level under the two-space job
    // key, so this matches a job-level gate and deliberately not a step-level `if:`
    // (eight spaces, inside a `- ` item), which gates one step rather than the sampler.
    expect(
      jobBlock('action-bundle-drift'),
      'action-bundle-drift has acquired a job-level `if:`. That job is the ONLY standing ' +
        'control proving the committed start-cache-server/index.js matches a fresh build, ' +
        'and four of the five sidecar sites execute THAT file rather than the in-job build ' +
        'the dogfood jobs use. Gating it on an event drops ROBUST-04 from "every PR and ' +
        'every push" to push-only, which is exactly the gate that already makes VER-06 and ' +
        'OBS-04 unobservable before a merge.',
    ).not.toMatch(/^ {4}if:/m);
  });
});
