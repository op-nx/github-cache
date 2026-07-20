import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * TRUST-04 regression guard for the selfcheck.cjs CLI DRIFT-DETECTION path
 * itself. 05-03-SUMMARY.md records "exits 1 on drift" as a one-time MANUAL
 * proof (append a stray char -> observe exit 1 -> git checkout to restore) --
 * there was no repeatable automated test locking that behavior in place, so a
 * future refactor of selfcheck.cjs's byte-compare could silently regress to
 * "always exit 0" with nothing in the suite to catch it.
 *
 * This spec drives the REAL selfcheck.cjs as a child process against an
 * ISOLATED TEMP COPY of the three files it reads (selfcheck.cjs, trust.ts,
 * trust.generated.cjs) -- never the tracked repo files -- so it proves the
 * exit-0/exit-1/--write CLI contract without ever touching implementation
 * files on disk.
 */
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

let workDir: string;

function generatedCjsPath(): string {
  return join(workDir, 'src', 'action', 'trust.generated.cjs');
}

function runSelfcheck(args: string[] = []): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  return spawnSync(
    process.execPath,
    [join(workDir, 'selfcheck.cjs'), ...args],
    {
      encoding: 'utf8',
    },
  );
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'selfcheck-drift-'));
  mkdirSync(join(workDir, 'src', 'lib'), { recursive: true });
  mkdirSync(join(workDir, 'src', 'action'), { recursive: true });
  cpSync(join(packageRoot, 'selfcheck.cjs'), join(workDir, 'selfcheck.cjs'));
  cpSync(
    join(packageRoot, 'src', 'lib', 'trust.ts'),
    join(workDir, 'src', 'lib', 'trust.ts'),
  );
  cpSync(
    join(packageRoot, 'src', 'action', 'trust.generated.cjs'),
    generatedCjsPath(),
  );
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe('selfcheck.cjs CLI drift detection (TRUST-04)', () => {
  it('exits 0 when the copy is byte-identical to a fresh regeneration', () => {
    const result = runSelfcheck();

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/in sync/);
  });

  it('exits 1 with a stderr drift message when the committed .cjs has drifted', () => {
    appendFileSync(generatedCjsPath(), '\n// stray drift char\n');

    const result = runSelfcheck();

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/DRIFT/);
  });

  it('exits 1 with a drift message when the committed .cjs is missing entirely', () => {
    rmSync(generatedCjsPath());

    const result = runSelfcheck();

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/DRIFT/);
  });

  it('--write regenerates a drifted copy back into sync (idempotent round-trip)', () => {
    appendFileSync(generatedCjsPath(), '\n// stray drift char\n');

    const write = runSelfcheck(['--write']);

    expect(write.status).toBe(0);

    const recheck = runSelfcheck();

    expect(recheck.status).toBe(0);
    expect(recheck.stdout).toMatch(/in sync/);
  });
});
