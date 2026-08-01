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
// Root-level is what let this file land BEFORE the perishable O1/O2 window: `nx.json`
// enumerates every workspace-root input as an explicit path and there is no
// `{workspaceRoot}/*.mjs` glob anywhere in it, so at the time it was written this file
// matched no input and rotated NOTHING (D-10 row 4). Root `nx.includedScripts` is an
// empty array, so it cannot become an Nx target either -- structurally, not by
// discipline.
//
// THAT IS NO LONGER TRUE OF THE HASH, and the sentence is corrected rather than deleted
// because the window it explains is why the file exists where it does. Once the O1/O2
// evidence was captured, `{workspaceRoot}/read-integration-hash.mjs` was registered in
// `targetDefaults.integration.inputs` -- deliberately, to close the stale-cached-PASS
// hole its own integration spec had recorded against itself. So editing THIS FILE now
// ROTATES THE `integration` HASH: the very hash the O3 proof measures. It is hash-neutral
// no longer, and a reader reaching for this file mid-proof needs to know that before
// touching it.
//
// EVERY GUARD BELOW THROWS, and that is the whole point of the file. Nx writes
// `run.json` inside a try/catch that swallows every error unless
// `NX_VERBOSE_LOGGING` is set, so a missing file or a missing task is otherwise
// SILENT -- and an empty hash would upload cleanly through
// `if-no-files-found: error`, which only checks that a file EXISTS. Absence must
// fail the leg, never default to an empty hash. Same posture as
// `capture-hashes.mjs`'s missing-task throw, which likewise enumerates what WAS
// observed rather than reporting a bare absence.
//
// GUARD 3 IS WHY THAT PROMISE IS KEPT RATHER THAN MERELY STATED. Guarding task
// ABSENCE is not the same as guarding the hash VALUE: a task record carrying
// `hash: ''` passes an absence check, writes a zero-byte file, uploads cleanly,
// and surfaces one job later inside o3-witness -- the "one job further from its
// cause" outcome this design exists to avoid.
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
//
// MATCHED AS A WHITESPACE-DELIMITED TOKEN, never as a SUBSTRING, and that is a
// TIGHTENING rather than a rewrite: every command the token pattern accepts was
// already accepted by the substring test, and the ones it now rejects are the
// spoofs the guard was written to catch. A substring test on a free-form command
// string matches the literal anywhere in it, so
// `nx run-many -t build --projects=integration-fixtures`, or an `nx reset` invoked
// from a path containing the word, all satisfied a guard whose whole job is to
// reject a record left by a DIFFERENT command. `\b` would NOT fix it -- there is a
// word boundary between `n` and `-`, so `\bintegration\b` still matches
// `integration-fixtures`.
//
// An ABSENT `run.command` still fails closed, which is the pre-existing and correct
// behaviour: optional chaining yields `undefined`, and `??` substitutes the empty
// string, which the pattern does not match.
if (!/(^|\s)integration(\s|$)/.test(run.run?.command ?? '')) {
  throw new Error(
    `read-integration-hash: ${runJsonPath} is from a different nx invocation -- its ` +
      `run.command is \`${run.run?.command}\`, which does not name \`${TARGET}\` as a ` +
      'whitespace-delimited token. A command that merely CONTAINS the word (for example ' +
      '`--projects=integration-fixtures`) is a different invocation, not this one. Every nx ' +
      'invocation overwrites run.json, so read it as the IMMEDIATELY NEXT step after the ' +
      'integration run with no nx call in between.',
  );
}

const matches = (run.tasks ?? []).filter((entry) => entry.target === TARGET);

// GUARD 2 (repudiation). Enumerate what WAS observed; never write an empty hash.
//
// EXACTLY ONE, never a first-match, and the difference is not defensive
// programming. `npm run integration` is `nx run-many -t integration`, which is
// INHERENTLY multi-project; the workspace holds one project TODAY, so the set is a
// singleton by circumstance rather than by construction. A first-match would let a
// second project with an `integration` target silently make this leg upload an
// ARBITRARY project's hash -- and that hash then becomes the H_linux the whole O3
// proof rests on, with nothing going red. Same class as `capture-hashes.mjs`'s
// single-project premise: a guard that silently NARROWS rather than breaking. The
// count is asserted so a second project fails loud here instead.
if (matches.length !== 1) {
  throw new Error(
    `read-integration-hash: expected exactly ONE \`${TARGET}\` task in ${runJsonPath}, found ` +
      `${matches.length} (${matches.map((entry) => entry.taskId).join(', ') || '<none>'}). ` +
      'Zero means the target was renamed, deleted, or its run did not reach the task graph; ' +
      "more than one means a first-match would upload an arbitrary project's hash as this " +
      "leg's H_linux. Observed targets: " +
      `${(run.tasks ?? []).map((entry) => entry.target).join(', ') || '<none>'}`,
  );
}

const task = matches[0];

// GUARD 3 (empty/malformed hash). `if-no-files-found: error` only checks that a
// file EXISTS, so an empty or malformed hash uploads cleanly and becomes a
// valid-looking cache key one job away from here. This is the UPSTREAM half of
// the shape check `ci.yml`'s o3-witness step performs on the downloaded record;
// both exist because the failure must be attributable to the leg that produced
// it. Nx renders a task hash as an all-decimal string.
if (typeof task.hash !== 'string' || !/^[0-9]+$/.test(task.hash)) {
  throw new Error(
    `read-integration-hash: the \`${TARGET}\` task in ${runJsonPath} carries no usable ` +
      `hash (got \`${task.hash}\`). Nx renders a task hash as an all-decimal string; an ` +
      'empty or malformed value would upload cleanly through if-no-files-found: error ' +
      'and become a valid-looking cache key.',
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
//
// AN ABSENT FIELD PRINTS `<absent>`, NOT `undefined`, and the distinction is worth
// the four characters BECAUSE the value is never gated: nothing downstream would
// reject a bad one, so this line IS the record. `cacheStatus=undefined` reads as a
// real observed value in evidence that O1/O2 cite as their structured
// corroborator, whereas `<absent>` cannot be mistaken for one. Deliberately still
// NOT a throw -- gating a recorded-only observation is the tripwire-on-correct-work
// failure this job's own comments forbid.
console.log(
  `${TARGET} hash=${task.hash} cacheStatus=${task.cacheStatus ?? '<absent>'} ` +
    `status=${task.status ?? '<absent>'} -> ${outPath}`,
);
