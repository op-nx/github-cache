import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * THE CLI CONTRACT OF `capture-hashes.mjs` (TEST-08, D-12, D-13).
 *
 * WHAT THIS COVERS AND WHAT IT DELIBERATELY DOES NOT. The instrument's four graph
 * ASSERTIONS are executed for real on every `hash-parity` leg in CI and by the
 * `assert:graph-premise` npm script, so they are live rather than inert (WR-05). What
 * nothing executed is the layer ABOVE them: the argument parsing and the mode exclusivity
 * that decide whether a record gets WRITTEN AT ALL and whether it may claim a provenance
 * it never measured. Those guards were added by the phase-11 review fix (IN-01, IN-02) and
 * hand-checked once at a terminal; no committed caller re-checks them.
 *
 * WHY THAT LAYER IS WORTH A GUARD. TEST-08 requires the assertion OUTPUT captured as
 * evidence, and `--out` is the ONLY channel that produces it. Before IN-02, `--out` with a
 * missing value fell back to stdout: the caller asked for a record, got no file, and the
 * process exited 0. In CI `if-no-files-found: error` would eventually catch the empty
 * upload; on the manual runs that produced this phase's committed evidence, nothing would.
 * A silently-passing evidence channel is the same defect class as a guard nothing runs.
 *
 * THE GRAPH IS NEVER BUILT BY ANY CASE BELOW, which is what makes this a unit spec rather
 * than a slow one. Every invocation here throws inside `parseArgs` or inside the dispatch
 * chain, both of which run before `createProjectGraphAsync` is reached -- measured at about
 * 0.33 s per spawn. The graph-resolution half is exercised where it belongs: on a real
 * runner, on both matrix legs.
 *
 * THE FIRST CASE IS THE POSITIVE CONTROL and it has to be, because all seven cases assert a
 * NON-ZERO exit. A wrong `SCRIPT` path or a load-time failure exits 1 as well, which would
 * make every case pass while testing nothing. The control asserts the instrument's OWN
 * usage text -- all three mode lines -- which no module-resolution error can produce, and
 * every other case additionally pins the specific message rather than the exit code alone.
 *
 * STALENESS CAVEAT, the same one `read-integration-hash.integration.spec.ts` records:
 * `capture-hashes.mjs` is a workspace-ROOT file and `nx.json` enumerates workspace-root
 * inputs as explicit paths, with no `{workspaceRoot}` `.mjs` glob, so editing the
 * instrument alone rotates no target hash and `nx test` may replay a cached PASS.
 * Registering the file in `targetDefaults.test.inputs` is the one-line fix, and it is the
 * same move PARITY-08 made for `ci.yml`.
 */
const SCRIPT = fileURLToPath(
  new URL('../../../capture-hashes.mjs', import.meta.url),
);

function capture(...args: string[]) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
  });

  return { status: result.status, stderr: result.stderr };
}

describe('capture-hashes.mjs rejects an invocation it cannot honour (TEST-08)', () => {
  it('prints its own three-mode usage on an unrecognised argument -- the control for every case below', () => {
    const result = capture('--nope');

    expect(
      result.status,
      'An unrecognised argument must exit non-zero. If this passes, the harness is not reaching the instrument at all.',
    ).not.toBe(0);

    // These three lines can only come from `parseArgs`'s own usage text, so together they
    // prove the real file loaded and the parser ran -- which a module-resolution error,
    // which also exits 1, could never do.
    expect(result.stderr).toContain(
      '--install-mode <ci|install> [--out <path>]',
    );
    expect(result.stderr).toContain('--diff <recordA.json> <recordB.json>');
    expect(result.stderr).toContain('--assert-graph-premise [--out <path>]');
  });

  it('refuses `--out` as the last argument instead of silently writing no record (IN-02)', () => {
    const result = capture('--assert-graph-premise', '--out');

    expect(
      result.status,
      'A missing --out value must be an ERROR, never a fallback to stdout. Both capture() and assertGraphPremise() treat a falsy `out` as "print to stdout", so the caller asked for a record and got none while the process exited 0 -- and TEST-08 requires the assertion OUTPUT captured as evidence.',
    ).not.toBe(0);
    expect(result.stderr).toContain('--out was given with no path');
    expect(result.stderr).toContain('it was the last argument');
  });

  it('refuses `--out` followed by another flag, naming the flag it swallowed (IN-02)', () => {
    const result = capture('--out', '--install-mode', 'ci');

    expect(result.status).not.toBe(0);
    expect(
      result.stderr,
      'The message must NAME the flag that was about to be consumed as a path. `--out --install-mode ci` is the shape a caller writes by accident, and reporting a bare "missing value" would leave them looking at the wrong flag.',
    ).toContain('the next argument is the flag `--install-mode`');
  });

  it('refuses --assert-graph-premise with --install-mode, so no record claims a provenance it never measured', () => {
    const result = capture('--assert-graph-premise', '--install-mode', 'ci');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('mutually exclusive');
    expect(result.stderr).toContain('--install-mode ci');
  });

  it('refuses --assert-graph-premise with --diff rather than running one and discarding the other (IN-01)', () => {
    const result = capture(
      '--assert-graph-premise',
      '--diff',
      'a.json',
      'b.json',
    );

    expect(
      result.status,
      'The dispatch is an if/else chain, so `--assert-graph-premise --diff a b` used to run the premise mode and DISCARD the diff silently -- a caller who asked for two things got one and no warning. The exclusivity check must cover --diff as well as --install-mode.',
    ).not.toBe(0);
    expect(result.stderr).toContain('--diff a.json b.json');
  });

  it('refuses --diff with --out, because diff mode measures nothing', () => {
    const result = capture('--diff', 'a.json', 'b.json', '--out', 'x.json');

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      '--diff is mutually exclusive with --install-mode and --out',
    );
  });

  it('refuses a capture with NO --install-mode rather than defaulting a GUESS into the record', () => {
    const result = capture();

    expect(
      result.status,
      '--install-mode has NO default by design (PARITY-06, Pitfall 6): `process.env.npm_config_*` is unavailable when the script is invoked directly, so a defaulted flag would record a GUESS as a measurement.',
    ).not.toBe(0);
    expect(result.stderr).toContain('is REQUIRED and has NO default');
    expect(result.stderr).toContain('it was missing');
  });
});
