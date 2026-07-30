import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * XOS-05's SHAPE guard for the scheduled Windows regression detector, authored RED -- it lands
 * BEFORE the workflow file it asserts on (plan 12-03). Do not soften these assertions and do
 * not stub a placeholder workflow to make the suite green.
 *
 * WHY THE DETECTOR EXISTS, in one sentence, because the guard is unreadable without it: the
 * success signal for O4 -- every target reporting `[remote cache]`, wall time collapsing to
 * sidecar overhead -- is the IDENTICAL observation to a Windows-only regression being invisible
 * forever. A green O4 leg IS a Windows leg that did not run the code. The scheduled
 * `--skip-nx-cache` run is the only thing that separates those two readings.
 *
 * TWO STANDING REASONS THIS FILE'S ASSERTIONS ARE NON-VACUOUS, and both have to hold or the
 * guard is decoration.
 *
 *   1. ONLY NON-COMMENT LINES ARE MATCHED. The workflow's own prose comments will repeat
 *      `--skip-nx-cache` and the success-line needle VERBATIM while explaining the rationale --
 *      that is the house convention this repo applies to every workflow -- so a naive substring
 *      match against the raw file would pass even after the REAL directive had drifted.
 *      Stripping '#'-prefixed lines first is what makes each clause read the actual config.
 *      This is `cleanup-workflow.spec.ts`'s stated reason, and it applies here more strongly,
 *      not less.
 *   2. THE WORKFLOW FILE IS AN `nx.json` `test` INPUT, REGISTERED IN THIS SAME COMMIT
 *      (D-09 / PARITY-08). Its subject lives outside `{projectRoot}`, so without that
 *      registration an edit to the workflow would not rotate the `test` hash and Nx would serve
 *      the verdict computed BEFORE the assertion's subject existed. PARITY-08 is this repo's
 *      own recorded instance of exactly that defect: `test.inputs` listed `cleanup.yml` and NOT
 *      `ci.yml`, so every spec asserting on `ci.yml` content replayed a stale PASS. A brand-new
 *      workflow file starts out unregistered and repeats it identically. The entry is effective
 *      on its OWN commit because `{workspaceRoot}/nx.json` is itself a `test` input, so there
 *      is no window and no ordering instruction for anyone to remember.
 *
 * Path resolved via import.meta.url (the `cleanup-workflow.spec.ts` / `docs-trust.spec.ts`
 * idiom), NOT __dirname and NOT process.cwd(). THREE `../` and not four: this spec lives flat
 * in `src/`, whereas `cleanup-workflow.spec.ts` lives one level deeper in `src/cleanup/`.
 *
 * The read is `existsSync`-guarded so an absent file yields `''` rather than a module-load
 * ENOENT. That is deliberate and it is what makes the RED a NAMED assertion failure -- the
 * existence `it` below -- rather than a crash that takes the whole file's other clauses with it
 * and reports nothing about what is missing.
 */
const detectorUrl = new URL(
  '../../../.github/workflows/windows-regression-detector.yml',
  import.meta.url,
);

const codeLines = (
  existsSync(detectorUrl) ? readFileSync(detectorUrl, 'utf8') : ''
)
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');

/**
 * The success line Nx prints for a THREE-target run, naming all three in `-t` argument order.
 *
 * The short form -- the bare `Successfully ran target` prefix -- is VACUOUS here and is
 * deliberately not used. Source-traced to
 * `node_modules/nx/dist/src/tasks-runner/life-cycles/formatting-utils.js:37`, Nx FILTERS the
 * printed target list down to targets that actually resolved a task, so if `typecheck` silently
 * stopped resolving, the line becomes `Successfully ran targets build, test for project ...`
 * and the short needle still matches a two-of-three run. The `lint` job's needle works only
 * because it names its one target.
 */
const MULTI_TARGET_SUCCESS_LINE =
  'Successfully ran targets build, typecheck, test for project';

const RESTORE_NOTE =
  'If the workflow was legitimately reworked, update this describe in the SAME commit; do not ' +
  'delete the assertion to make the suite green.';

describe('windows-regression-detector.yml workflow config -- the XOS-05 detector', () => {
  // POSITIVE CONTROL / EXISTENCE, and it is asserted FIRST because every clause below is a
  // `toMatch`, `toContain` or `not.toMatch` against `codeLines` -- and `codeLines` is `''` when
  // the file is absent. The two ABSENCE clauses at the end would therefore pass trivially. This
  // is the single `it` that makes them mean anything.
  it('the detector workflow file exists at all', () => {
    expect(
      existsSync(detectorUrl),
      'There is no .github/workflows/windows-regression-detector.yml. XOS-05 makes this ' +
        'workflow REQUIRED, not optional: without it a Windows-only regression is invisible ' +
        'forever, because a fully-cached Windows CI leg going green is the SAME observation ' +
        'as a Windows leg that never ran the code. The correct response to a red here is to ' +
        `RESTORE THE WORKFLOW. ${RESTORE_NOTE}`,
    ).toBe(true);
  });

  it('runs on a schedule plus workflow_dispatch, and never on push or pull_request', () => {
    const reason =
      'The detector must trigger on `schedule:` and on `workflow_dispatch:` and on nothing ' +
      'else. workflow_dispatch is REQUIRED (D-08) -- but note what it is FOR: it is how the ' +
      'detector gets re-run ON DEMAND AFTER merge. GitHub only dispatches a workflow whose ' +
      'file exists on the DEFAULT branch, so it cannot close this question before a merge and ' +
      'must never be documented as if it could. push and pull_request are forbidden because a ' +
      'cache-bypassing three-target Windows run on every PR is a cost this phase is not ' +
      `paying, and ci.yml already covers those events. ${RESTORE_NOTE}`;

    expect(codeLines, reason).toMatch(/^on:\s*\n\s*schedule:/m);
    expect(codeLines, reason).toMatch(/^\s*workflow_dispatch:/m);
    expect(codeLines, reason).not.toMatch(/^\s*(push|pull_request):/m);
  });

  it('schedules itself OFF the top of the hour', () => {
    expect(
      codeLines,
      'The detector cron must not sit on minute 0. GitHub delays scheduled runs under ' +
        'top-of-hour load and this job has no deadline, so an off-peak minute is free ' +
        'reliability -- the same reason cleanup.yml records for its own 17-past cron. ' +
        `${RESTORE_NOTE}`,
    ).toMatch(/^\s*- cron: '(?!0 )\d{1,2} \d{1,2} \* \* \*'$/m);
  });

  it('declares exactly ONE job, and it runs on the windows-11-arm runner', () => {
    const reason =
      'The detector must be ONE job on windows-11-arm. Windows is the whole point -- a leg ' +
      'that moved to ubuntu detects nothing this repo does not already detect on every push ' +
      '-- and a second job would be an unrequested mechanism on a workflow whose entire ' +
      `purpose is one cache-bypassing run. ${RESTORE_NOTE}`;

    const runsOnLines = codeLines
      .split('\n')
      .filter((line) => /^ {4}runs-on: /.test(line));

    expect(codeLines, reason).toMatch(/^ {4}runs-on: windows-11-arm$/m);
    expect(runsOnLines, reason).toHaveLength(1);
  });

  it('bypasses the Nx cache, which is the only thing that makes it a detector', () => {
    expect(
      codeLines,
      'The detector must pass --skip-nx-cache. At Nx 23.1.0 that skips the cache READ and ' +
        'the cache WRITE, so the run genuinely executes the three targets on Windows instead ' +
        'of replaying Linux-produced artifacts. Without it this workflow is a slower copy of ' +
        `the ci.yml Windows legs and detects nothing at all. ${RESTORE_NOTE}`,
    ).toContain('--skip-nx-cache');
  });

  it('proves the run happened, rather than inferring it from an exit code', () => {
    const reason =
      'The detector must demand the multi-target success LINE as a second signal after the ' +
      'exit code, with NO_COLOR set. Exit 0 is not sufficient: `nx run-many` with no matching ' +
      'target anywhere prints "NX No tasks were run" and exits 0, which this repo has already ' +
      'measured. NO_COLOR is load-bearing rather than tidiness -- Nx bolds each target name ' +
      'INDIVIDUALLY, so with colour on the plain-text match never fires and the gate fails on ' +
      'every run including the good ones. The needle also pins the -t ARGUMENT ORDER: ' +
      'reordering the flags in the workflow reddens a CORRECT run, and the fix for that is to ' +
      `update this constant in the same commit, never to shorten the needle. ${RESTORE_NOTE}`;

    expect(codeLines, reason).toContain('NO_COLOR');
    expect(codeLines, reason).toContain(MULTI_TARGET_SUCCESS_LINE);
  });

  it('declares NO sidecar and no remote cache tier (D-08)', () => {
    const reason =
      'The detector must not start the loopback cache sidecar and must not name a remote ' +
      'cache tier. --skip-nx-cache bypasses read AND write, so a cache server here would be ' +
      'dead weight -- and worse, another cache PRODUCER, which is exactly the second-writer ' +
      `count this milestone is trying to keep down. ${RESTORE_NOTE}`;

    expect(codeLines, reason).not.toMatch(/start-cache-server/);
    expect(codeLines, reason).not.toMatch(/NX_SELF_HOSTED_REMOTE_CACHE/);
  });

  it('requests no write permission and no Actions-cache scope', () => {
    const reason =
      'The detector reads nothing privileged and writes nothing at all, so it must not ' +
      'request contents: write and must not request an actions: scope. cleanup.yml needs ' +
      'contents: write because it DELETES release assets; copying that block across would ' +
      'hand a scheduled job a write credential it has no use for. Least privilege here is ' +
      `free. ${RESTORE_NOTE}`;

    expect(codeLines, reason).not.toMatch(
      /permissions:[\s\S]{0,60}contents:\s*write/,
    );
    expect(codeLines, reason).not.toMatch(/actions:\s*(read|write)/);
  });
});
