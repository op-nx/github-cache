// Lifts the `integration` task's HASH and `cacheStatus` out of
// `.nx/cache/run.json` (D-17 step b). Run it as the IMMEDIATELY NEXT step after
// `npm run integration`, with no other `nx` invocation in between: every `nx`
// invocation overwrites `run.json` (Pitfall 5).
//
// WHY A ROOT-LEVEL DEV-ONLY SCRIPT RATHER THAN A MODULE OF THE PUBLISHED PACKAGE.
// `capture-hashes.mjs`'s header states reason (b) and it applies here verbatim:
// an Nx-CACHED instrument would REPLAY a stale record instead of measuring, and a
// cached read is not a read. Reason (a) becomes "this is measurement plumbing,
// not consumer surface" -- PROJECT.md requires that changes made for this repo's
// own CI/hashing never leak into the consumer contract.
//
// Root-level is ALSO what keeps this file hash-neutral (D-10 row 4), which is why
// it may land before the perishable O1/O2 window: `nx.json` enumerates every
// workspace-root input as an explicit path and there is no `{workspaceRoot}/*.mjs`
// glob anywhere in it, so this file matches no input and rotates NOTHING. Root
// `nx.includedScripts` is an empty array, so it cannot become an Nx target either
// -- structurally, not by discipline.
//
// BOTH GUARDS BELOW THROW, and that is the whole point of the file. Nx writes
// `run.json` inside a try/catch that swallows every error unless
// `NX_VERBOSE_LOGGING` is set, so a missing file or a missing task is otherwise
// SILENT -- and an empty hash would upload cleanly through
// `if-no-files-found: error`, which only checks that a file EXISTS. Absence must
// fail the leg, never default to an empty hash. Same posture as
// `capture-hashes.mjs`'s missing-task throw, which likewise enumerates what WAS
// observed rather than reporting a bare absence.
import { readFileSync, writeFileSync } from 'node:fs';

/** The target whose hash this reader exists to lift. */
const TARGET = 'integration';

// Two optional positionals, no flags, no arg library. The DEFAULTS are what the
// ci.yml steps rely on; the overrides are what make the fixture cases runnable
// with no `nx` invocation at all.
const runJsonPath = process.argv[2] ?? '.nx/cache/run.json';
const outPath = process.argv[3] ?? 'integration-hash.txt';

const run = JSON.parse(readFileSync(runJsonPath, 'utf8'));

// GUARD 1 (spoofing). `run.json` self-documents the command that produced it, and
// every `nx` invocation overwrites the file -- so a record left behind by a
// DIFFERENT command must never be uploaded as this leg's integration hash.
if (!run.run?.command?.includes(TARGET)) {
  throw new Error(
    `read-integration-hash: ${runJsonPath} is from a different nx invocation -- its ` +
      `run.command is \`${run.run?.command}\`, which does not mention \`${TARGET}\`. ` +
      'Every nx invocation overwrites run.json, so read it as the IMMEDIATELY NEXT step ' +
      'after the integration run with no nx call in between.',
  );
}

const task = run.tasks?.find((entry) => entry.target === TARGET);

// GUARD 2 (repudiation). Enumerate what WAS observed; never write an empty hash.
if (!task) {
  throw new Error(
    `read-integration-hash: no \`${TARGET}\` task in ${runJsonPath} -- the target was renamed, ` +
      'deleted, or its run did not reach the task graph. Observed targets: ' +
      `${(run.tasks ?? []).map((entry) => entry.target).join(', ') || '<none>'}`,
  );
}

// The BARE hash, no trailing newline: the consumer is `cat integration-hash.txt`
// interpolated into a cache key, and a stray newline is a different key.
writeFileSync(outPath, task.hash);

// `cacheStatus` is one of exactly three values -- `remote-cache-hit`,
// `local-cache-hit` or `cache-miss` -- so printing it here feeds D-17 step (a)'s
// RECORDED observation and O1/O2's structured corroborator in the same line at no
// extra cost. It is the remote-vs-local discrimination `Cache: n/m hit` cannot
// make (D-24), and it is RECORDED, never GATED.
console.log(
  `${TARGET} hash=${task.hash} cacheStatus=${task.cacheStatus} status=${task.status} -> ${outPath}`,
);
