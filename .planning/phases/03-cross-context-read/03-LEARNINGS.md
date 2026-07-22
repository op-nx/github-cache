---
phase: 3
phase_name: "Cross-Context Read"
project: "@op-nx/github-cache"
generated: "2026-07-19"
counts:
  decisions: 6
  lessons: 5
  patterns: 5
  surprises: 5
missing_artifacts:
  - "03-UAT.md"
---

# Phase 3 Learnings: Cross-Context Read

## Decisions

### Keep selectBackend synchronous; defer async resolution into the client
`selectBackend` stays synchronous and zero-arity (`selectBackend.length === 0`); the async token
and repo-identity resolution runs at get-time inside the default client's `fetchAsset`, never
awaited at construction.

**Rationale:** `serve.ts` calls `selectBackend` inline and `select-backend.spec.ts` pins
`length === 0` as the TRUST-05 no-mode-surface guard. Making it async would break both. This was
the single highest rework risk flagged before planning.
**Source:** 03-PATTERNS.md, 03-03-SUMMARY.md

### OS-namespace ALL entries by default (not selective)
Every Releases asset is keyed `<hash>-<platform>` via one helper; a wrong-OS lookup always MISSes.
No per-target portable/non-portable classification was built.

**Rationale:** ARCHITECTURE-DECISION Decision 6 locks "OS-namespaced by default"; no portability
signal exists in the codebase to classify against, so selective namespacing would be speculative
dead flexibility. The hit-rate cost (OS-invariant outputs not shared cross-OS) is reversible later.
**Source:** 03-CONTEXT.md D-05

### Full three-tier auth as a NEW resolver, not by extending resolveGitHubToken
`resolveLocalReadToken` = env (`GH_TOKEN||GITHUB_TOKEN`, delegating to the UNCHANGED
`resolveGitHubToken`) -> `gh auth token` -> `git credential fill`.

**Rationale:** `resolveGitHubToken` is env-only by design, shared with the CI write path, and its
fallthrough is pinned by TEST-01; adding subprocess tiers in place would break TEST-01 and pollute
the write path. FOUND-02 names all three tiers as the requirement.
**Source:** 03-CONTEXT.md D-08, 03-02-SUMMARY.md

### Native fetch, zero new dependency (Octokit stays Phase 4)
The reader talks to the GitHub REST API over native global `fetch` (Node 24): GET release by tag ->
paginated asset list -> GET asset by id with `Accept: application/octet-stream` + bearer.

**Rationale:** D-01 zero-dep-lean mandate; spikes 001/005 already proved dependency-free fetch.
A read-only reader discriminates faults structurally on `res.status`, satisfying the same
"no stderr matching" rule Octokit would, without the dep.
**Source:** 03-CONTEXT.md D-03, 03-03-SUMMARY.md

### TEST-05 satisfied by an injected fake; live CI round-trip deferred to Phase 4
Phase 3's cross-OS round-trip is an injected-fake-client test (seed per-OS entries in a Map, assert
correct-hit / MISS / never-wrong-OS). The live-GitHub CI matrix round-trip is deferred to Phase 4.

**Rationale:** the real publisher-to-Releases does not exist until Phase 4, so a live round-trip is
structurally impossible in Phase 3; the injected-client pattern matches TEST-01/02/03 and is
deterministic. Spike 005 already proved the live matrix on paper (run 29613149528).
**Source:** 03-CONTEXT.md D-12, 03-VALIDATION.md

### Run execution sequential-on-main (worktrees disabled) for this phase
Executors ran as sequential `gsd-executor` agents on the main working tree, not in parallel
worktrees, despite `parallelization: true`.

**Rationale:** HEAD was 141 commits ahead of `origin/main` and `worktree.baseRef` was unset
(default: branch from `origin/HEAD`). `packages/github-cache/src` does not exist at `origin/main`,
so worktree executors would have checked out a tree missing the entire package. Sequential-on-main
is the AGENTS.md-endorsed safe fallback; the cost (losing wave-1 parallelism) is negligible for a
3-plan phase.
**Source:** execution orchestration (STATE.md), CLAUDE.md worktree rules

---

## Lessons

### Plan-time threat mitigations can be contradicted by the shipped code
Two HIGH threats whose PLAN `<threat_model>` claimed a mitigation were NOT actually satisfied by the
first implementation: T-03-11 (repo-identity regex was end-anchored, not host-anchored) and T-03-16
(GitHub REST fetches had no timeout). Both were caught by code review (HI-01, HI-02), fixed, and
independently re-verified by the security audit.

**Context:** the review -> fix -> verify -> secure chain is load-bearing, not ceremony. A threat
register authored at plan time is a claim to be checked against code, not evidence the code is safe.
**Source:** 03-REVIEW.md, 03-REVIEW-FIX.md, 03-SECURITY.md

### Subprocess stderr is localized -- "never match stderr text" is correctness, not style
`git credential fill`'s failure stderr came back in Danish on this machine. Any English sentinel
string match would silently misfire for every non-English developer.

**Context:** discriminate subprocess outcomes on exit code + stdout only. `GIT_TERMINAL_PROMPT=0`,
neutralized askpass, AND a bounded timeout are all three needed to stop a modal/askpass wedging the
build.
**Source:** 03-RESEARCH.md, 03-02-SUMMARY.md

### Native fetch drops Authorization on a cross-origin redirect -- lean on it, do not fight it
The asset download 302-redirects to third-party storage; native fetch auto-follows and drops the
`Authorization` header cross-origin (spec-compliant). Setting `redirect:'manual'` and re-attaching
the header would both break a working path AND leak the token to the storage origin.

**Context:** the correct implementation is no redirect handling at all. This was written up as an
anti-pattern and guarded by a test asserting `redirect:'manual'` is never set.
**Source:** 03-RESEARCH.md, 03-03-SUMMARY.md

### The subprocess error `code` field is overloaded (number vs string)
A non-zero `gh`/`git` exit yields `err.code === 1` (a number); a missing binary yields
`err.code === 'ENOENT'` (a string). A catch that switches on `code` alone conflates them.

**Context:** the fault handling checks the failure structurally rather than on `code` type, so both
"logged-out" and "not-installed" correctly fall through to the next auth tier.
**Source:** 03-RESEARCH.md

### The fault matrix collapses when every fault maps to MISS
GitHub documents 403-vs-429 as non-deterministic and 404-absent as deliberately indistinguishable
from hidden-private. Because D-11 maps every fault to MISS, one `try/catch` + one `res.ok` check is
the complete correct implementation -- a fault-taxonomy would be wasted code.

**Context:** the research explicitly told the planner NOT to commission a fault-classification task.
**Source:** 03-RESEARCH.md

---

## Patterns

### Injected client seam at the OS-namespaced asset-name boundary
A one-method injected client (`ReleaseReadClient.fetchAsset(assetName)`) places the test seam exactly
at the OS-namespaced asset NAME -- the boundary CORR-01 must prove -- so the cross-OS fake is a plain
`Map` and needs no mocking framework, while the REST sequence stays separately testable by mocking
`fetch`.

**When to use:** any backend that talks to an external store and must prove a key/namespace property.
**Source:** 03-01-SUMMARY.md, 03-PATTERNS.md

### Degrade-to-MISS try/catch at the port boundary, not in the HTTP client
The `get() -> MISS-on-fault` guard lives in the backend's `get`, so the never-throw guarantee holds
for an injected fake that throws as well as for the real client. One auditable location.

**When to use:** any best-effort read where a fault must never break the caller.
**Source:** 03-01-SUMMARY.md, 03-03-SUMMARY.md

### Single-source comment-locked helper for anything a later phase will share
`releaseAssetName` follows the 7-slot comment idiom of `cache-archive-path.ts` (single-source claim,
req ID, both call sites, LOAD-BEARING marker, silent-drift mechanism, forbidden edits, pinning spec)
because Phase 4's publisher will import the exact same helper -- drift is a silent cross-OS MISS.

**When to use:** any derivation (path, key, name) two phases/sides must agree on byte-for-byte.
**Source:** 03-PATTERNS.md, 03-01-SUMMARY.md

### Non-vacuous negative test with a `// Non-vacuous:` comment
The never-wrong-OS guarantee is proven by the NEGATIVE case (a hash seeded only under the other
platform returns MISS). A positive-only hit test passes even if OS-namespacing is deleted entirely.
The `// Non-vacuous:` comment names what a weaker assertion would still pass.

**When to use:** any safety/correctness property where the dangerous outcome is a wrong result, not a
crash -- assert the absence of the wrong result, not just the presence of the right one.
**Source:** 03-VALIDATION.md, 03-VERIFICATION.md

### Sync composition root + deferred async resolution
Keep a synchronous, zero-arity composition root by pushing any async resolution (subprocess auth,
network identity) into the lazily-called method, memoized once per instance.

**When to use:** when a construction-time API contract (here, the TRUST-05 `length === 0` guard) must
stay sync but the work it wires up is async.
**Source:** 03-PATTERNS.md, 03-03-SUMMARY.md, 03-REVIEW-FIX.md (ME-01 memoization)

---

## Surprises

### The first two plans deferred the integration core to a plan that did not exist
Plans 01 and 02 both deferred the real client (D-03) and the `selectBackend` wiring (D-01) to
"Plan 03" -- which the initial planner run had not written. The resumed source-coverage audit caught
it and added 03-03.

**Impact:** without the coverage audit, the phase would have shipped the pieces but never wired them
together (the goal is unreachable without 03-03). The audit-on-resume, not a no-op confirmation, is
what closed the gap.
**Source:** plan-phase source-coverage audit

### `git commit -m` intermittently fails on this Dev Drive; `-F` works
`git commit -m "..."` failed repeatedly with `fatal: could not open '.git/COMMIT_EDITMSG': Invalid
argument` on the D: Dev Drive (ReFS). Writing the message to a temp file and using
`git commit -F <file>` succeeded every time.

**Impact:** environment-specific; every orchestrator/executor commit in this phase used the `-F`
workaround. Worth pre-empting in future phases on this machine.
**Source:** execution orchestration

### VALIDATION prose said "27 behaviors" but the table always had 26
An off-by-one in the strategy-time prose (carried from RESEARCH.md's Validation Architecture intro);
the verification map table had 26 rows in both documents. Caught and corrected by the Nyquist audit.

**Impact:** cosmetic; no behavior missing. Illustrates that a hand-written count in prose drifts from
the table it summarizes.
**Source:** 03-VALIDATION.md

### `nx format:check --projects` is an unsupported flag combination
The executor's attempt to scope Prettier via `nx format:check --projects` was rejected; it fell back
to `prettier --check <files>` directly.

**Impact:** minor; the static format gate still ran. Note for future phases: scope Prettier with the
direct CLI, not the nx target's `--projects` flag.
**Source:** 03-02-SUMMARY.md

### A benign circular import is safe only because it is call-time-only
Wiring the reader into `selectBackend` created a cycle:
`select-backend -> releases-backend -> local-context -> select-backend`. It compiles, builds, and
runs clean because every edge is resolved lazily inside `fetchAsset`, never at module-init.

**Impact:** required a hand-trace through the ECMAScript module linking/evaluation algorithm (by both
the reviewer and the fixer) to confirm safety; the safety argument was then written into the source
(LO-01) so it is not only in a planning doc. An init-time reference on any of those edges would break
it.
**Source:** 03-REVIEW.md, 03-REVIEW-FIX.md, 03-03-SUMMARY.md
