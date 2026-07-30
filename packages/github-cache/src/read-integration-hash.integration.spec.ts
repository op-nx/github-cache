import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * BEHAVIOURAL COVERAGE FOR `read-integration-hash.mjs` (XOS-03, TEST-09, D-17b).
 *
 * WHY THIS FILE EXISTS. That instrument produces H_linux -- the value the whole O3
 * proof rests on, uploaded as an artifact, consumed one job later by `o3-witness`, and
 * composed into a cache key. Its three guards were authored and hand-checked against
 * ad-hoc fixtures during the phase-11 code-review fix (WR-01, WR-02, WR-03), but NOTHING
 * in the tree executed it: `git grep read-integration-hash -- packages/` returned one
 * PROSE mention and no assertion. A guard nothing runs is documentation, which is the
 * exact defect class phase 11 exists to eliminate -- the review found four such guards.
 * The DOWNSTREAM half of guard 3 is locked in `dogfood-cross-os.spec.ts` (the witness's
 * own `''|*[!0-9]*` shape check); this is the UPSTREAM half, which had nothing.
 *
 * WHY IT IS RUNNABLE AS A TEST AT ALL. The instrument takes TWO optional positionals --
 * `process.argv[2]` (the run.json path) and `process.argv[3]` (the output path) -- and
 * its own header records that "the overrides are what make the fixture cases runnable
 * with no `nx` invocation at all". This file is the caller that header was written for.
 * Every case drives the REAL file through a real `node` process; nothing is re-implemented
 * here, so these assertions cannot drift from the instrument the way a mock would. It
 * spawns `node` DIRECTLY and never `nx`, so it cannot overwrite `.nx/cache/run.json` --
 * which matters because the CI `integration` job's very next step reads that file.
 *
 * WHY `*.integration.spec.ts` AND NOT A UNIT SPEC, which is a CONSTRAINT rather than a
 * preference. The fixtures need a scratch directory, and `tmpdir` is on LINT-02's banned
 * `node:os` accessor list at every unit-spec path. The ban's own message offers two ways
 * out and this file takes the second: "move the assertion to an *.integration.spec.ts,
 * where these APIs are allowed". The first way out -- a described `eslint-disable` -- was
 * REJECTED, and not on taste: `lint-rules.spec.ts` asserts CORR-05 as a positive claim
 * (`CORR_05_SITES` is empty, "zero extant ambient-platform reads remain in unit specs"),
 * and the last site phase 9 removed to make that true was literally
 * `cache-archive-path.spec.ts`'s `import { tmpdir } from 'node:os'`. Re-introducing that
 * exact import behind a disable would reopen a closed requirement to add a guard, which is
 * a bad trade in both directions. Writing fixtures under `{projectRoot}` instead was
 * rejected too -- the whole project directory is inside the `default` named input, so every
 * run would dirty the tree the NEXT hash is computed over.
 *
 * The move is a net gain rather than a consolation: the `integration` target runs on BOTH
 * matrix legs in CI, so this instrument -- whose output becomes a cross-OS cache key -- is
 * now exercised on the Windows runner too. Its automated command is
 * `npx nx integration github-cache`, not `npx nx test github-cache`.
 *
 * THE POSITIVE CONTROL IS LOAD-BEARING, not decoration, and it is the first case for the
 * reason every control in this repo comes first. Eight of the eleven cases below assert a
 * NON-ZERO exit. A wrong `SCRIPT` path, a syntax error, or a missing `node` would make all
 * eight pass while testing nothing -- node exits 1 on a module it cannot resolve. So the
 * accepted fixture must be shown to exit 0 and write its file BEFORE any rejection is read
 * as evidence, and every rejection case additionally asserts on the guard's own message
 * rather than on the exit code alone.
 *
 * NO OUTPUT FILE ON ANY REJECTION PATH is asserted alongside each throw, and that is a
 * SEPARATE fact from the exit code. The instrument's contract is that absence must fail
 * the leg rather than default to an empty hash, because `if-no-files-found: error` on the
 * upload side only checks that a file EXISTS -- a zero-byte `integration-hash.txt` would
 * upload cleanly and surface one job later inside `o3-witness`, further from its cause.
 *
 * STALENESS CAVEAT, recorded rather than hidden, and it is the one weakness of this file.
 * `read-integration-hash.mjs` is a workspace-ROOT file, and `nx.json` enumerates every
 * workspace-root input as an explicit path -- there is no `{workspaceRoot}/*.mjs` glob
 * anywhere in it, which `capture-hashes.mjs`'s own header states as the reason those root
 * instruments are hash-neutral. So editing the instrument ALONE rotates no target hash, and
 * `nx integration` may replay a cached PASS over a weakened guard. The fix is one line --
 * add `{workspaceRoot}/read-integration-hash.mjs` to `targetDefaults.integration.inputs` --
 * and it is exactly the move PARITY-08 made in phase 9 for `ci.yml`, for exactly this
 * reason. Until it lands, this guard is PROBABILISTIC rather than deterministic: it still
 * reddens on any commit that also touches a registered input, which in practice is most of
 * them, but a lone edit to the instrument can slip past.
 *
 * Placed at the package-source root rather than in a subdirectory because its subject is a
 * workspace-root instrument, not a cohesive module (`.planning/codebase/TESTING.md` spec
 * placement) -- the same reason `dogfood-cross-os.spec.ts` sits here.
 */
const SCRIPT = fileURLToPath(
  new URL('../../../read-integration-hash.mjs', import.meta.url),
);

const WORKSPACE = mkdtempSync(join(tmpdir(), 'read-integration-hash-'));

afterAll(() => {
  rmSync(WORKSPACE, { recursive: true, force: true });
});

/** A run.json Nx would write for a real `nx run-many -t integration`. */
const ACCEPTED = {
  run: { command: 'nx run-many -t integration' },
  tasks: [
    {
      taskId: '@op-nx/github-cache:integration',
      target: 'integration',
      hash: '18442367512424001648',
      cacheStatus: 'remote-cache-hit',
      status: 'success',
    },
  ],
};

let caseIndex = 0;

/**
 * Drive the real instrument over a fixture. Both positionals are supplied, so nothing is
 * read from or written to the repository root -- which also keeps this file clear of the
 * three untracked root artifacts T-11-29 records.
 */
function read(runJson: unknown) {
  caseIndex += 1;
  const runPath = join(WORKSPACE, `run-${caseIndex}.json`);
  const outPath = join(WORKSPACE, `hash-${caseIndex}.txt`);

  writeFileSync(runPath, JSON.stringify(runJson));

  const result = spawnSync(process.execPath, [SCRIPT, runPath, outPath], {
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    wroteOutput: existsSync(outPath),
    output: existsSync(outPath) ? readFileSync(outPath, 'utf8') : undefined,
  };
}

describe('read-integration-hash.mjs accepts a real integration run (XOS-03, TEST-09)', () => {
  it('exits 0 and writes the BARE hash with no trailing newline -- the control for every rejection below', () => {
    const result = read(ACCEPTED);

    expect(
      result.status,
      `The accepted fixture must exit 0. It did not, so every rejection case in this file is testing a broken harness rather than a guard -- suspect the SCRIPT path or a load-time error in the instrument. stderr:\n${result.stderr}`,
    ).toBe(0);

    // BYTE-EXACT, not `toContain`: the consumer is `cat integration-hash.txt`
    // interpolated into a cache key, and a stray newline is a DIFFERENT key.
    expect(
      result.output,
      'The instrument must write the bare hash with no trailing newline. The value is interpolated into `nx-cache-<hash>`, so a newline silently composes a different key than the one the entry was saved under.',
    ).toBe('18442367512424001648');
  });

  it('prints the structured cacheStatus, which is the remote-vs-local discrimination `Cache: n/m hit` cannot make (D-24)', () => {
    expect(read(ACCEPTED).stdout).toContain(
      'integration hash=18442367512424001648 cacheStatus=remote-cache-hit',
    );
  });

  it('prints `<absent>` rather than `undefined` when cacheStatus is missing (IN-05b)', () => {
    const result = read({
      run: ACCEPTED.run,
      tasks: [{ ...ACCEPTED.tasks[0], cacheStatus: undefined }],
    });

    // The value is RECORDED and never GATED, so this line IS the record. `cacheStatus=undefined`
    // reads as a real observed value in evidence that O1/O2 cite as their structured
    // corroborator; `<absent>` cannot be mistaken for one.
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('cacheStatus=<absent>');
  });
});

describe('read-integration-hash.mjs GUARD 1 rejects a run.json from a different nx invocation (WR-03)', () => {
  it('rejects a command that merely CONTAINS the word -- the substring spoof', () => {
    const result = read({
      run: { command: 'nx run-many -t build --projects=integration-fixtures' },
      tasks: ACCEPTED.tasks,
    });

    expect(
      result.status,
      "GUARD 1 must match `integration` as a WHITESPACE-DELIMITED TOKEN, never as a substring. `--projects=integration-fixtures` is a different nx invocation, and every nx invocation overwrites run.json -- so accepting it uploads another command's hash as this leg's H_linux. Note `\\b` does NOT fix this: there is a word boundary between `n` and `-`.",
    ).not.toBe(0);
    expect(result.stderr).toContain('is from a different nx invocation');
    expect(result.stderr).toContain('whitespace-delimited token');
    expect(result.wroteOutput).toBe(false);
  });

  it('fails CLOSED on an absent run.command', () => {
    const result = read({ tasks: ACCEPTED.tasks });

    expect(
      result.status,
      'An absent run.command must fail closed. Optional chaining yields undefined and `??` substitutes the empty string, which the token pattern does not match -- if this ever passes, the guard has been rewritten to fail OPEN.',
    ).not.toBe(0);
    expect(result.wroteOutput).toBe(false);
  });
});

describe('read-integration-hash.mjs GUARD 2 demands EXACTLY ONE integration task (WR-02)', () => {
  it('rejects TWO matching tasks instead of silently uploading the first', () => {
    const result = read({
      run: ACCEPTED.run,
      tasks: [
        ACCEPTED.tasks[0],
        {
          taskId: '@op-nx/other:integration',
          target: 'integration',
          hash: '999',
          cacheStatus: 'cache-miss',
        },
      ],
    });

    expect(
      result.status,
      '`npm run integration` is `nx run-many -t integration`, which is INHERENTLY multi-project; the workspace holds one project by CIRCUMSTANCE, not by construction. A first-match (`.find()`) would let a second project make this leg upload an ARBITRARY hash as H_linux with nothing going red. The count must be asserted.',
    ).not.toBe(0);
    // Both taskIds must be ENUMERATED -- a bare count would not tell a maintainer which
    // projects collided.
    expect(result.stderr).toContain('@op-nx/github-cache:integration');
    expect(result.stderr).toContain('@op-nx/other:integration');
    expect(result.wroteOutput).toBe(false);
  });

  it('rejects ZERO matching tasks and enumerates what WAS observed', () => {
    const result = read({
      run: ACCEPTED.run,
      tasks: [
        { taskId: '@op-nx/github-cache:build', target: 'build', hash: '7' },
      ],
    });

    expect(
      result.status,
      'Zero means the target was renamed, deleted, or its run never reached the task graph. Nx writes run.json inside a try/catch that swallows every error unless NX_VERBOSE_LOGGING is set, so absence is otherwise SILENT.',
    ).not.toBe(0);
    expect(result.stderr).toContain('found 0');
    expect(result.stderr).toContain('Observed targets: build');
    expect(result.wroteOutput).toBe(false);
  });
});

describe('read-integration-hash.mjs GUARD 3 rejects an unusable hash VALUE (WR-01)', () => {
  // Guarding task ABSENCE is not the same as guarding the hash VALUE: a task record
  // carrying `hash: ''` passes an absence check, writes a zero-byte file, uploads cleanly
  // through `if-no-files-found: error`, and surfaces one job later inside o3-witness.
  it.each([
    ['an empty string', ''],
    ['a non-decimal string', 'abc'],
    ['a whitespace-separated pair', '123 456'],
    ['a number rather than a string', 42],
  ])('rejects %s', (_label, hash) => {
    const result = read({
      run: ACCEPTED.run,
      tasks: [{ ...ACCEPTED.tasks[0], hash }],
    });

    expect(
      result.status,
      `GUARD 3 must reject \`${String(hash)}\`. Nx renders a task hash as an ALL-DECIMAL string; anything else uploads cleanly and becomes a valid-looking cache key one job away from here.`,
    ).not.toBe(0);
    expect(result.stderr).toContain('carries no usable');
    expect(
      result.wroteOutput,
      'GUARD 3 must throw BEFORE the write. A zero-byte or malformed integration-hash.txt satisfies `if-no-files-found: error`, which only checks that a file EXISTS.',
    ).toBe(false);
  });
});
