import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isEntrypoint } from '../lib/is-entrypoint.js';
import { compareHashParity, EXPECTED_TARGETS } from './compare.js';

/**
 * The CI bin around `compareHashParity` (D-19). `ci.yml`'s `hash-parity-compare`
 * job downloads both legs' records into one directory and runs
 * `node packages/github-cache/dist/hash-parity/assert-parity.js <dir>`.
 *
 * D-19 keeps this small enough to review by eye, because it is the one part of
 * the gate with no unit test standing behind it. Everything that can be decided
 * by a pure function is decided in `compare.ts`, which is fixture-tested per
 * clause; this file only reads files and prints.
 *
 * SUCCESS_PREFIX IS A CONTRACT, not decoration. Plan 08-06's workflow step greps
 * stdout for that literal, the way `ci.yml:66-72` greps for Nx's success phrase
 * rather than trusting the exit code. D-23 forbids deriving a verdict from an
 * exit code alone, and Phase 7 measured `nx run-many -t <missing>` exiting 0 --
 * the same hazard applies here, where a records directory that never received an
 * artifact is the silent case. It carries no colour codes and nothing Nx formats,
 * so the grep cannot be broken by a reporter change.
 *
 * TWO DELIBERATE DIVERGENCES from `roundtrip/read-back.ts`, the repo's other
 * "CI runs a built bin and it must fail loud" entry:
 *   1. NONE in the direct-invocation guard -- `isEntrypoint(import.meta.url)` is
 *      used identically and is NOT hand-rolled. The naive form concatenates a URL
 *      scheme onto `process.argv[1]`, which is permanently false on Windows
 *      because a bare drive path is not a valid URL (Pitfall 6). That scheme
 *      literal is deliberately not written here, so a source scan for it over
 *      this file finds nothing to mistake for the defect it is warning about --
 *      08-01 recorded that exact inversion.
 *   2. `console.error` + `process.exitCode` instead of `@actions/core`'s failure
 *      helper. The compare job is a plain `run:` step, not a JS action, so the
 *      helper adds only an inline annotation over a non-zero exit, and setting
 *      `process.exitCode` lets stderr flush instead of truncating mid-detail --
 *      and the detail is the whole point of a named reason.
 *      ponytail: two node builtins and a console; no action runtime for a
 *      step that reads two files.
 */
const SUCCESS_PREFIX = 'hash-parity: PARITY OK';

/** Where `actions/download-artifact` puts both legs when the job passes no path. */
const DEFAULT_RECORDS_DIR = 'hash-parity-records';

/**
 * Every `.json` in `directory`, name-sorted so the reported record index is
 * reproducible. A parse failure becomes a named error rather than a raw
 * `SyntaxError` stack, because a truncated artifact is the likely cause and the
 * stack does not say so.
 */
function readRecords(directory: string): readonly unknown[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const file = join(directory, name);

      try {
        return JSON.parse(readFileSync(file, 'utf8')) as unknown;
      } catch (error) {
        throw new Error(
          `${file} is not parseable JSON (${error instanceof Error ? error.message : String(error)}). ` +
            'Suspect a truncated artifact upload, or a capture step that failed ' +
            'partway through writing the record.',
        );
      }
    });
}

function run(directory: string): void {
  const records = readRecords(directory);
  const verdict = compareHashParity(records);

  if (!verdict.ok) {
    console.error(
      `hash-parity: PARITY FAILED (${verdict.reason}) -- ${verdict.detail}`,
    );
    process.exitCode = 1;

    return;
  }

  // Taken FROM the verdict, not re-asserted about `records`. The comparator is the
  // only thing that narrows these two, and it now hands back what it validated --
  // so this reads checked values with no cast standing between them and the file.
  // That matters more here than anywhere else in the gate: this is the one file
  // with no unit test behind it, so an unchecked assertion here is the one nothing
  // would have caught.
  const [a, b] = verdict.records;
  const hashes = EXPECTED_TARGETS.map(
    (target) => `${target}=${a.targets[target].hash}/${b.targets[target].hash}`,
  ).join(' ');

  console.log(
    `${SUCCESS_PREFIX} ${verdict.platforms.join(' vs ')} -- ${hashes}`,
  );
}

if (isEntrypoint(import.meta.url)) {
  try {
    run(process.argv[2] ?? DEFAULT_RECORDS_DIR);
  } catch (error) {
    console.error(
      `hash-parity: PARITY FAILED -- ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
