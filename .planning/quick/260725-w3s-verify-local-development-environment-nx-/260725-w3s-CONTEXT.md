# Quick Task 260725-w3s: Verify local development environment Nx cache HITs for all distinct Nx target names - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning
**Mode:** `--full` with `--auto` gray-area locking (discuss-phase `--auto` semantics)

<domain>
## Task Boundary

Verify whether a local development environment gets Nx remote cache HITs, for every
distinct Nx target name in the workspace, reading through the shipped v0.0.1 GitHub
Releases mirror + local client reader.

The premise under test: v0.0.1 shipped BOTH the Releases mirror (Phase 4 publish) and
the local client reader (Phase 3), so a local `nx <target>` should be able to hit
artifacts seeded by CI.

Distinct target names in the workspace (enumerated, not assumed --
`nx show project github-cache`):

| Target | `cache` | In scope |
|--------|---------|----------|
| `build` | true | YES |
| `typecheck` | true | YES |
| `test` | true | YES |
| `integration` | true | YES |
| `build-deps` | false | no -- uncacheable by definition |
| `watch-deps` | false | no -- uncacheable by definition |
| `nx-release-publish` | false | no -- uncacheable by definition |

`@op-nx/source` is the workspace-root shell project and owns no cacheable targets.

</domain>

<decisions>
## Implementation Decisions

All auto-locked per `--auto`, EXCEPT where recorded as UNRESOLVED below. Each is
rated for IMPACT (is it hard to reverse / does it freeze a contract?) and CONFIDENCE
(is the pick evidence-backed, or a bare default?), per the trap-quadrant rule:
HIGH impact + NOT-HIGH confidence is never auto-locked.

### Scope: which targets to verify
- **Locked:** all four cacheable targets (`build`, `typecheck`, `test`,
  `integration`). The three `cache: false` targets are excluded -- a non-cacheable
  target cannot produce a cache hit, so including them would only add noise.
- Impact LOW (a scoping choice, trivially reversible), confidence HIGH (derived from
  `nx show project`, not guessed).

### Acceptance signal: what counts as a HIT
- **Locked:** Nx's own end-of-run report is the ONLY full proof -- a non-zero
  `Cache: n/m hit` and/or the `[remote cache]` label on the task line. Corroborating
  signals (the reader returning 200, an asset existing in the shard) are supporting
  evidence, never the verdict.
- Impact LOW, confidence HIGH -- the maintainer stated this standard explicitly
  during quick 260725-rk4 ("the only acceptable full proof is Nx reporting a cache
  hit in CI"), and the same standard applies locally.
- Note the inverse trap, already burned once in 260725-rk4: `Cache: 0/1 hit (0%)`
  is NOT evidence of a remote consult. Nx prints that line for the local cache too,
  and a cold local cache always misses. Only a NON-ZERO hit or the explicit
  `[remote cache]` label carries information.

### Local wiring: how the local Nx reaches the reader
- **Locked:** drive it exactly as a real developer would, through the shipped
  surface -- run the loopback sidecar locally, point the two `NX_*` client vars at
  it, and let `selectBackend` pick the local read path on its own. Do NOT inject a
  backend, stub the client, or set an undocumented env var: a fake would verify the
  fake.
- Local read auth is available and needs no new setup: `gh auth status` reports a
  logged-in github.com account, and `resolveLocalReadToken`'s tier chain is
  env -> `gh auth token` -> git credential fill. `GH_TOKEN`/`GITHUB_TOKEN` are both
  unset in this shell, so tier 2 (`gh`) is the path that will be exercised.
- Repo identity resolves from the `origin` remote (`https://github.com/op-nx/github-cache.git`).
- Impact LOW, confidence HIGH (documented path; auth precondition checked, not assumed).

### Outcome handling: verify only, do not fix
- **Locked:** this task VERIFIES and REPORTS. It fixes nothing. Any gap found is
  recorded against the existing STATE.md Deferred Items row rather than patched here.
- Impact LOW, confidence HIGH -- the maintainer decided during 260725-rk4 that the
  cross-OS value gap is a later-milestone item, and TEST-05's acceptance ("a correct
  hit or a MISS -- never a wrong-OS artifact") means current behavior is v0.0.1-compliant.
  Turning this into a fix task would silently expand scope past that decision.

### Tree state to verify against
- **Locked:** the PR #4 branch (`gsd/quick-260725-rk4-dogfood-ci`), per the
  maintainer's explicit instruction to use that branch for any changes.
- Impact LOW **given the evidence below** -- normally this WOULD be a trap-quadrant
  candidate, because the branch's `vitest.config.mts` change (9f37739) alters the
  `test`/`integration`/`typecheck` task hashes relative to `main`, and the mirror was
  seeded from `main` pushes. It is downgraded to LOW only because the mirror provably
  contains ZERO assets the current reader could hit for ANY real task hash (see
  Specific Ideas), so no tree state can produce a hit and the choice cannot change the
  outcome. If that premise turns out wrong, this decision must be re-opened.

### Claude's Discretion
- Exact command sequence, how the sidecar is started and torn down locally, and how
  per-target results are tabulated.
- Whether to additionally record the local task hash per target (useful for the
  deferred parity item, but not required by the task).

</decisions>

<unresolved>
## UNRESOLVED / BLOCKER -- deliberately not auto-locked

### Whether an all-MISS result should be reported as PASS or FAIL
The task says "verify HITs". If the verification finds zero hits -- which the
evidence below strongly predicts -- it is genuinely ambiguous whether that is:

- **(a) a PASS**: the verification correctly established current behavior, and
  all-MISS is v0.0.1-compliant per TEST-05 ("a correct hit or a MISS"), OR
- **(b) a FAIL**: the premise in the task title ("verify HITs") is unmet, so the
  feature does not deliver its value and the task's goal was not achieved.

This is HIGH IMPACT (it decides whether a shipped, audit-passed milestone is recorded
as having a functional gap, which affects the milestone's standing and any release
messaging) and NOT-HIGH CONFIDENCE (the maintainer has, within the last hour, argued
BOTH that cross-OS local hits are the intended purpose AND that the gap is
later-milestone deferrable -- those are consistent as intent-vs-severity but they do
not settle how to LABEL this verification's outcome).

Per the trap-quadrant rule this is not auto-locked. The executor MUST report the
measured facts and present both readings WITHOUT choosing, and the verifier must not
convert an all-MISS into a `passed` or a `gaps_found` on its own initiative.

</unresolved>

<specifics>
## Specific Ideas

Evidence already gathered before planning (so the plan targets the real question
rather than re-discovering this):

**The mirror contains no asset the current reader can hit for a real task.** The
single live shard `cache-mirror-202607` holds 79 assets in TWO shapes:

| Shape | Count | Provenance | Reachable by today's reader? |
|-------|-------|-----------|------------------------------|
| `<hash>.tar.gz` | 50 | PoC-era (pre-greenfield-rebuild) real task hashes | NO -- wrong name shape |
| `<run_id>-<os>` | 29 | v0.0.1 publisher, `run_id`-keyed proof SEEDS | NO -- not a task hash |

`releaseAssetName` produces `<hash>-<os>` with no extension, so the 50 PoC-era
`.tar.gz` assets are unreachable by name. The 29 v0.0.1-shaped assets are real
publisher output -- proving the publisher works -- but they mirror only the
`run_id`-keyed seeds, because `main`'s CI never wrote a real `nx-cache-<taskhash>`
Actions entry. That is exactly what PR #4 changes, and PR #4 is not merged.

So there are THREE stacked reasons a local hit is expected to miss, and the
verification should attribute the failure precisely rather than stopping at the first:
1. **Nothing published**: no real task artifact exists in the current naming scheme.
2. **OS suffix**: even once published from ubuntu CI, a Windows reader asks for
   `<hash>-windows` while ubuntu publishes `<hash>-linux`.
3. **Hash parity**: `build` was measured computing different hashes per OS on the
   same commit (probe run 30173654069), so even an OS-agnostic name might not match.

Reason 1 dominates and makes 2 and 3 currently unobservable. Say so explicitly
instead of implying all three were tested.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/milestones/v0.0.1-ROADMAP.md:284` -- TEST-05 acceptance: "cross-OS
  lookup returns a correct hit or a MISS - never a wrong-OS artifact".
- `.planning/ARCHITECTURE-DECISION.md:77` -- CORR-01 rationale and the
  OS-namespace-by-default decision (with its documented-consumer-discrimination
  alternative).
- `.planning/STATE.md` Deferred Items -- the cross-OS value row this task reports into.
- `packages/github-cache/src/lib/release-asset-name.ts` -- `releaseAssetName`, the
  single comment-locked `<hash>-<os>` source used by BOTH publisher and reader.
- `packages/github-cache/src/lib/local-context.ts` (`resolveLocalReadToken`,
  `resolveRepoIdentity`) -- the three-tier local auth chain and repo identity.
- `docs/advanced.md` -- the documented local Releases-reader setup.

</canonical_refs>
