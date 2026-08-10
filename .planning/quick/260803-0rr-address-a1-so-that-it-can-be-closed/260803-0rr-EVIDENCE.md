# Quick 260803-0rr -- Evidence

## Why A1 was open

Run `30768554184` achieved the partial-miss condition on `typecheck-windows` -- one of two tasks
MISSed and EXECUTED -- and the leg carried ZERO 403 tokens and no store-failure wording. The
residual, precisely: **absence of noise cannot distinguish "a PUT was attempted and silently
refused" from "no PUT was attempted at all."** `server.ts:129` answers a read-only PUT with
`res.statusCode = 403; res.end()` -- an empty body -- and the server logs nothing, so neither world
leaves a trace.

## Why this was answerable LOCALLY, with no source change and no CI cycle

The originally-planned route was to instrument `server.ts` with `core.debug()` and observe via a
throwaway CI branch plus `gh run rerun --debug`. Both halves were rejected during planning, on two
grounds that were then verified independently:

1. **The instrumentation would have been a defect.** `server.ts` has ZERO `@actions/*` imports --
   it is deliberately GitHub-agnostic -- and it backs `createCacheServer`, which is the ENTIRE
   `EXPECTED_VALUE_EXPORTS` (`public-surface.spec.ts:40`). Adding `@actions/core` there would make
   the package's only public value export transitively depend on an Actions-only package for a
   consumer calling it outside Actions.
2. **CI was never necessary.** `server.ts:128-133` answers `!isWritableBackend(backend)` with 403
   and RETURNS BEFORE calling `handlePut`, so no backend method is invoked on a refused PUT. The
   backend's identity provably cannot affect the PUT path, which makes the already-existing
   `createReadOnlyMemoryBackend` (`memory-backend.ts:63`) exactly equivalent for this question.

The memory backend is additionally **PUT-MAXIMAL**: it is permanently empty, so every GET MISSes
and every task must execute -- and executing is the only way a store is ever attempted. CI's
backend can HIT, and a HIT restores without executing and therefore without a store.

## Harness

A scratchpad-only script (never committed, no repo file changed) that imports the REAL
`createCacheServer` from `dist/`, feeds it `createReadOnlyMemoryBackend()`, and attaches a
`prependListener('request')` tap that records every arriving request and its final status. The tap
observes; it does not alter behaviour.

### Controls, all three required

| Control | Purpose | Result |
|---------|---------|--------|
| `isWritableBackend(backend)` logged at startup | if true, the harness measures the wrong seam | `false` |
| GET requests observed | proves the tap actually records traffic; without it a null PUT result is uninterpretable | GETs recorded on every valid run |
| Tap lines ADDED by each run counted | proves the run was not served entirely from local cache | `4` on the definitive run |

## One run was REJECTED as vacuous, and why that matters

An intermediate run reported `Nx said NOTHING about the refused stores` -- and it was worthless.
It hit `[local cache]` at `2/2 hit (100%)` and added **zero** tap lines: Nx never contacted the
sidecar, so of course it said nothing. Reporting that as confirmation would have been a green that
could not have failed.

Root cause, worth recording on its own: **`NX_CACHE_DIRECTORY` is not honoured by Nx 23.1.0 here.**
A verifiably empty directory (`entries: 0`) still produced `[local cache]` 2/2, so Nx read the
workspace's real `.nx/cache`. The intended isolation never happened. The definitive run therefore
forced coldness by ROTATING THE HASH (a one-line comment appended to `cleanup.ts`, reverted
immediately afterwards and proven byte-exact with `git diff --quiet`).

## OBSERVATION -- A1 answered, in the affirmative

Two valid runs, eight requests, all recorded by the tap:

```
REQ GET /v1/cache/6303782621882711279  -> 404      run 1 (task hash: build)
REQ PUT /v1/cache/6303782621882711279  -> 403
REQ GET /v1/cache/11553684120103592295 -> 404      run 1 (task hash: typecheck)
REQ PUT /v1/cache/11553684120103592295 -> 403
REQ GET /v1/cache/16145199525155793066 -> 404      run 2, hashes rotated (build)
REQ PUT /v1/cache/16145199525155793066 -> 403
REQ GET /v1/cache/3356125849110639811  -> 404      run 2, hashes rotated (typecheck)
REQ PUT /v1/cache/3356125849110639811  -> 403
```

1. **Nx DOES attempt a store after a MISS.** Four PUTs across two runs, one per executed task. This
   is the fact A1 could not establish.
2. **The read-only backend refuses each with 403**, at the protocol boundary, without touching the
   backend.
3. **Nx swallows it completely silently.** The definitive run's FULL 30-line output contains ZERO
   occurrences of `403`, `forbidden`, `refus`, `store`, `fail`, `could not`, `unable`, `error` or
   `warn`.
4. **The build still succeeds** -- `Successfully ran target typecheck`.

### Incidental corroboration of the OS-invariant work

Run 1's hashes -- `6303782621882711279` (build) and `11553684120103592295` (typecheck) -- are
BYTE-IDENTICAL to the keys recorded from CI run `30767511870`, whose producers are ubuntu. A local
Windows 11 arm64 machine and an ubuntu CI runner computed the same task hashes. That is what the
OS-invariant discriminator work predicts, observed here as a side effect rather than as its own
probe.

## What this CLOSES

Stated as two separate claims, because they transfer differently.

**Measured here, directly:** with a read-only backend, this Nx pin attempts a store after executing
a MISSed task, the server refuses it 403, and the client prints NOTHING and still succeeds.

**What transfers to CI:** the narrow client-side property -- *given a 403 to a store, this Nx pin
emits no output*. That is a property of the pinned client and the protocol response, not of the
environment, so it holds on `windows-11-arm` as well.

A1's residual was the two-way ambiguity between "PUT attempted and silently refused" and "no PUT
attempted". It is resolved: the refusal path IS exercised, and it is silent by design rather than
by absence. Both halves of A1's original concern are answered -- the refusal does not fail the
build, and it produces no log noise a reader must triage.

The CI silence on run `30768554184` is now best explained by the same mechanism. That explanation
is an INFERENCE, not a measurement: no CI run has directly observed a PUT arriving, and this
evidence does not make one. See the next section.

### Incidental: the 403 branch is NOT dead code

Because a store IS attempted, `server.ts:128-133` is reachable in ordinary operation. Had no PUT
arrived, the finding would have been the opposite and worth recording separately: that the project
ships a read-only guard production never exercises.

## What this does NOT claim

- **It is a local measurement, not a CI one.** The inference to CI rests on Nx client behaviour
  being environment-independent for this decision (same pinned Nx 23.1.0, same self-hosted remote
  cache protocol, same server code path). Strong, but it is an inference: no CI run has directly
  observed a PUT arriving.
- The harness ran with `NX_DAEMON=false` for determinism; CI does not set that.
- It says nothing about whether a FUTURE Nx version keeps swallowing the 403. That failure mode is
  self-announcing (it would redden read-only legs on any partial miss), which is why no standing
  guard was added.

## Related finding -- the gap has been latent since Phase 10

`10-EVIDENCE-PRE-RENAME.md:88` records a local sidecar plus real Nx runs against a read-only
backend, with a control-table row reading *"no PUT-to-read-only-backend crash"*. Phase 10 stood on
this exact seam and recorded only that nothing crashed -- never whether a PUT arrived. That
omission IS A1's residual, and it sat in a table that read as coverage for three phases.

---

## Plan-checker verdict, received AFTER the measurement

`gsd-plan-checker` returned 5 blockers and 8 warnings against the PLAN. The measurement was already
complete when it arrived, so the honest question is whether it invalidates the result. **It does
not**, and the reason is specific rather than convenient.

The checker's central point is that the plan's discrimination table had two outcomes, and only one
was sound: **row 1 (a PUT arrives) closes A1; row 2 (no PUT arrives) was unearned**, because
"PUT-maximality" is a claim about the numerator while all three real failure paths -- task HIT from
local cache, task FAILED, Nx never contacted the sidecar -- are failures of the denominator, and
none was gated.

**The observation recorded above is row 1.** All three of the checker's demanded preconditions are
satisfied by what was actually run:

| Blocker | Why it does not apply here |
|---------|----------------------------|
| B1 -- positive control contaminated by operator auth probes, so "GETs present" is true before Nx starts | No probes were fired. All 8 tap entries are Nx-attributable GET/PUT pairs at REAL task hashes -- two of which are byte-identical to CI's baseline keys. This is the Nx-attributable control B1 asks for. |
| B2 -- a FAILED task produces no PUT and reads as row 2 | The run exited 0 with `Successfully ran target typecheck`, and a PUT is only attempted after a task executes successfully. Four PUTs were observed. |
| B3 -- a local-cache HIT produces no PUT and reads as row 2 | Independently discovered and gated: one run WAS rejected on exactly this basis, and the definitive run required a non-zero tap-line delta (4). |

Row 2 never fired, so the cluster of false-negative hazards it depends on is moot for this result.

### Checker findings ACCEPTED and applied

- **W1 (over-reading), applied above.** The original write-up asserted the CI leg "attempted a
  store, was refused, and Nx said nothing" -- importing the positive direction into CI, which this
  file's own scope section forbids. Reworded to separate the measured client-side property (which
  transfers) from the CI explanation (which is an inference).
- **I1, applied above** as the dead-code note.

### Checker findings CARRIED to the propagation half (not yet done)

- **B5 -- two further surfaces still call A1 OPEN**, beyond the ones already planned:
  `13-SECURITY.md:296` and `:369` (the latter a CHECKED box asserting A1 remains known-open), and
  `13-RESEARCH.md`'s Assumptions Log A1 row ("Confirm on the landing run"). `13-SECURITY.md` is a
  dated snapshot at `80f3066` and may legitimately be frozen -- but that must be STATED, not left
  silent, or the repo asserts both CLOSED and OPEN across two audit artifacts of the same phase.
- **B4 -- the planned append-only check is vacuous after commit.** `git diff --numstat -- <file>`
  with no revision range compares worktree to index, which is empty once committed. Use a range
  (`<base>..HEAD`), following `13-VALIDATION.md:90`, which already does it correctly.
- **W3 -- entry-point delta.** This ran `npx nx run @op-nx/github-cache:typecheck`; CI's leg runs
  `npm run typecheck` -> `nx run-many -t typecheck`. Single-project workspace makes the graph
  almost certainly identical (CI observed exactly 2 tasks, as did this), but the delta is free to
  eliminate by using the CI command verbatim on any re-run.

### Environment note (W5)

Because `NX_CACHE_DIRECTORY` was not honoured, these runs wrote to the workspace's real
`.nx/cache`, including `run.json`. Damage is bounded and was not repaired: the artefact is
gitignored, regenerable, and `read-integration-hash.mjs` guards on `run.command` so it rejects a
typecheck `run.json` rather than mis-reading it. Recorded rather than hidden.
