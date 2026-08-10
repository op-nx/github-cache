---
slug: vitest-worker-crash-serve-spec
status: open
trigger: "A `test` run fails with no assertion error: a vitest worker fork exits unexpectedly, one spec file never reports, and the run exits non-zero."
goal: find_root_cause_only
verdict: unknown
created: 2026-08-11
updated: 2026-08-11
occurrences: 2
first_occurrence_evidence: none (destroyed by re-run)
second_occurrence_evidence: captured below
---

# Vitest worker crash -- `src/serve.spec.ts` never reports

## Why this file exists

`AGENTS.md` `## Capturing test-battery output` was written for exactly one prior event: an
unattributed `test` failure at commit `69bd1b7`, not reproducible in seven attempts, with
**nothing recoverable afterwards** because Nx caches terminal output for SUCCESSFUL runs only, so
the failing run's output never reached `.nx/cache/terminalOutputs` and the re-run destroyed it.
That section states the condition under which the event becomes actionable:

> Actionable only on a SECOND occurrence WITH output captured.

**This is that second occurrence, and the output IS captured.** Recorded here rather than
investigated, because it surfaced during `/gsd:complete-milestone v0.0.2` and a debug session is
not that command's job. It is filed so the evidence survives the session.

## Occurrence 2 -- 2026-08-11

**Environment.** Node v24.13.0, Nx 23.1.0 (local), vitest 4.1.10, native Windows arm64
workstation. HEAD `a53ae3f`.

**Working tree at the time.** Milestone-close edits only, and none of them touch `serve.spec.ts`
or anything it imports: comment-only path repoints in `actions-cache-backend.ts`,
`publish-mirror.ts`, `capture-hashes.mjs` and `ci.yml`; a markdown table in
`docs/trust-and-security.md`; and `.planning/` archival moves. `npm run check:action` reported
zero bundle drift across the same edits, confirming they are non-semantic.

**Symptom.** `npm test` exited 1 with **no failing assertion**:

```
 Test Files  43 passed (44)
      Tests  1134 passed (1145)
     Errors  1 error
```

`src/serve.spec.ts` (11 tests) produced no line at all -- neither pass nor fail. It was identified
by set difference against the 44 non-integration spec files, not by reading the log.

**The captured error, in full:**

```
Vitest caught 1 unhandled error during the test run.
This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.

Error: [vitest-pool]: Worker forks emitted error.
 at EventEmitter.onTaskError (vitest/dist/chunks/cli-api.BK8pd4xc.js:3459:21)
 at EventEmitter.emit (node:events:508:28)
 at ChildProcess.emitUnexpectedExit (vitest/dist/chunks/cli-api.BK8pd4xc.js:3025:22)
 at ChildProcess.emit (node:events:508:28)
 at Process.ChildProcess._handle.onexit (node:internal/child_process:294:12)

Caused by: Error: Worker exited unexpectedly
 at ChildProcess.emitUnexpectedExit (vitest/dist/chunks/cli-api.BK8pd4xc.js:3023:33)
 at ChildProcess.emit (node:events:508:28)
 at Process.ChildProcess._handle.onexit (node:internal/child_process:294:12)
```

The worker exited without an exit code or signal reaching the reporter, so vitest has nothing to
attribute. There is no stack inside project code.

**Immediately after, one uncached streamed run** (`npx nx test @op-nx/github-cache
--skip-nx-cache --output-style=stream`, the procedure `AGENTS.md` prescribes) was **fully green**:

```
 ✓ |@op-nx/github-cache| src/serve.spec.ts (11 tests) 233ms
 Test Files  44 passed (44)
      Tests  1145 passed (1145)
```

Exit 0. So the failure did not reproduce, matching occurrence 1's behaviour.

## What is now known that was not after occurrence 1

1. **The crash has a file.** Occurrence 1 was entirely unattributed. This one localises to
   `src/serve.spec.ts` -- and that is the one spec in the `test` target that binds a real TCP
   socket through `serve()`, mints a token and drains on SIGTERM. Every other socket-binding spec
   is an `*.integration.spec.ts` and runs under a different target.
2. **It is a WORKER-level exit, not a test failure.** No assertion ran and failed; the fork died.
   That rules out a flaky expectation and points at process/port/handle teardown.
3. **It is not caused by the tree under test.** The concurrent edits were provably non-semantic.

## What is still NOT known -- do not guess at it

- Whether the worker died from a port collision, a leaked handle, an OOM, or a Node/vitest pool
  bug. Nothing in the capture discriminates these.
- Whether occurrence 1 (`69bd1b7`) was the same file. That evidence is gone permanently.
- The base rate. Two occurrences across two milestones is all that is established.

## Next action, if a third occurrence arrives

Do NOT re-run first -- capture, per `AGENTS.md`. Then the cheapest discriminating step is to run
`serve.spec.ts` alone in a loop with `--pool=forks --poolOptions.forks.singleFork` and with the
port resolver's chosen port logged per iteration, which separates the port-collision hypothesis
from the teardown hypothesis. Not worth doing speculatively at two occurrences.

## Standing

Not a v0.0.2 gap. The milestone's own gates were green: the full battery passed at close, and
the failure did not reproduce. This is a flake in the local test harness, tracked so a third
occurrence has two prior data points instead of zero.
