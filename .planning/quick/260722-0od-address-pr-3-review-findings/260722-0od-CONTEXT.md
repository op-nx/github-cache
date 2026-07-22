# Quick Task 260722-0od: Address PR #3 review findings - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Task Boundary

Address the findings that survived triage from the 7-component multi-agent review of
PR #3 (`gsd/v0.0.1-greenfield-rebuild`), using bisect-safe atomic commits on the
current branch. Then get CI green and update the PR body.

Source of findings: a 7-agent `/lz-advisor:lz-review` fan-out (backends, server/serve,
cleanup, trust, publish-mirror, packaging, docs), each finding independently
re-verified against source by the orchestrator. 46 raw findings triaged to 27 upheld,
4 disproven, 1 downgraded. Two further findings were overturned during THIS discussion
phase by consulting `.planning/` artifacts (see Decisions below).

**Explicitly OUT of scope this pass:**
- The "deleted rationale" sweep (diffing deleted comment blocks in `origin/main`
  against the rewrite to find further dropped invariants). Deferred to a later
  milestone by user instruction. Capture as a backlog item, do not execute.
- Creating/pushing the `v0` git tag. Outward-facing and hard to retract; left as a
  release-checklist item for the maintainer to cut at publish time.

</domain>

<decisions>
## Implementation Decisions

### Fork-PR hard 500 on cache write (blocker #1)

**LOCKED: map the ambiguous denial to `'conflict'` (409). Do NOT add fork detection
to `trust.ts`.**

`ARCHITECTURE-DECISION.md:30` (control C1) states verbatim: *"PR scope is
activity-type-dependent -- `[closed]` runs base-scope RO; **a blocked PR write is a
benign 409/no-op**."* The ADR therefore already prescribes 409 as the intended
semantics for a denied PR write. `actions-cache-backend.ts:88-90` currently throws,
which `server.ts:247` maps to 500 -- contradicting the ADR and the "never a broken
build" Core Value.

The predecessor did exactly this: `cacheId === -1 ? 'conflict' : 'stored'`.

409 is NOT a fail-closed hole. Per the ADR's Nx-contract section, the Nx client treats
`409`/`403` as graceful no-ops, so a 409 neither breaks the build nor reports a false
`200` for a write that did not land. That preserves SRV-05/D-06's actual requirement
("no silent 200"), which the throw over-enforced.

**Rejected alternative -- fork detection in the trust gate.** The ADR keeps
`isWriteTrusted` a pure function of runner-injected env with "no caller/mode flag",
and states the in-code allowlist "stays fork-spoofable defense-in-depth" while
GitHub's server-side guard + scope isolation are load-bearing. Reading
`pull_request.head.repo` from the event payload to detect forks would fight that
design directly. Rejected on ADR grounds.

**Reviewer premise corrected.** The review claimed GitHub returns a read-only token on
`pull_request` runs generally. Per `research/FEATURES.md:158` the read-only token is
issued only when the event is untrusted AND the scope resolves to the shared
default-branch SHA; `phases/05-trust-widening-ppe-gate/05-RESEARCH.md:502` confirms
`pull_request`/`release` "keep read-write because they write a non-default-branch
scope". So an ordinary fork PR writes its own isolated scope and succeeds. The 500
fires on the base-scope-RO activity types (e.g. `[closed]`) -- real, but narrower than
reported. Fix is unchanged; the scoping is recorded so the test targets the right case.

Add a `core.warning` on the ambiguous branch for observability (the denial and a
genuine cache-service outage remain indistinguishable at this layer by design --
@actions/cache collapses both to -1).

### merge_group / workflow_dispatch omission (was blocker #3)

**LOCKED: NOT a defect. Do not re-add. Add a rationale comment only.**

`phases/05-trust-widening-ppe-gate/05-02-PLAN.md:103` lists `merge_group` (and
`workflow_dispatch`) among events that must be "false on EVERY host
(dangerous/unlisted, always refused)". Line 110 keeps both in `REFUSED_EVENTS` and
pins `TRUSTED_EVENTS` to deep-equal `['push','schedule']`, with a test asserting they
stay refused regardless of `GITHUB_SERVER_URL`. `REQUIREMENTS.md:49` (TRUST-02)
reinforces the same rejection for the sync gate.

The omission is therefore deliberate, planned, and already test-locked -- not an
accidental deletion. The ADR's Framing section ("Sunk cost is zero", known PoC hazards
"are to be fixed at the root in the rebuild, **not parity-patched**") explicitly
rejects predecessor parity as a justification, which was the review's only argument.

**Action reduced to:** one comment in `trust.ts` recording WHY `merge_group` is
refused, so a future reviewer does not re-flag it. No behavior change, no allowlist
change, no test change.

### Cleanup deletion-volume guard (worth-fixing #9)

**LOCKED: retention policy floor + explicit opt-in override. NOT a ratio circuit
breaker.**

Prior art (researched this phase) converges on guarding the POLICY and the SCOPE, not
the outcome volume:
- **restic** refuses to act on an "empty" policy that would remove everything;
  bypassing requires an explicit `--unsafe-allow-remove-all`; `--dry-run` to preview.
- **borg** requires explicit scope (prefix), else "*all* archives are candidates for
  deletion", and requires at least one `--keep-X` rule.

Neither uses an outcome-volume/percentage threshold.

The scope guard already exists here and is strong (exact `isShardTag` tag match +
exact `^[a-f0-9]{1,512}-(windows|macos|linux)$` asset-name pattern) -- borg's prefix
requirement, already satisfied. What is missing is restic's empty-policy refusal. Our
analog of "keeps nothing" is a retention of 1 day, which `resolveMaxAgeDays` currently
accepts as valid (it clamps to `[1,365]`, guarding absurd values but not
valid-but-catastrophic ones).

Shape:
```
const MIN_AGE_DAYS = 7
if (raw < MIN_AGE_DAYS && !env.CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION) -> fail loud
```

**Why not the ratio breaker** (the orchestrator's original suggestion, rejected): a
breaker that aborts the run is itself a mechanism by which retention can silently stop
running indefinitely -- the exact hazard recorded in `memory/cleanup-in-code-trust-gate-deferred`
and flagged independently as finding #7 (gate-skip is invisible in a green job). The
policy floor cannot misfire that way: it only ever rejects a bad CONFIG, never a run
that has a valid policy. Steady-state cleanup is never blocked.

### Scope of this pass

**LOCKED: all upheld findings except the `v0` tag.** 6 blockers + 10 worth-fixing +
11 minor. The `v0` tag is left for the maintainer.

### Claude's Discretion

- Commit sequencing and granularity, subject to the bisect-safety constraint below.
- Exact wording of doc corrections and rationale comments.
- Whether the cross-process temp-path leg (blocker #2) is closed with a lockfile
  primitive or a documented invariant -- note that changing `publish-mirror`'s temp
  path is NOT an option: `cache-archive-path.ts:11-17` is comment-locked because
  @actions/cache version-hashes the literal path string, so a different path silently
  MISSes every restore.

</decisions>

<specifics>
## Specific Ideas

**Bisect-safety constraint (load-bearing, applies to EVERY commit).**
`start-cache-server/index.js` is a generated esbuild bundle that inlines every
`serve()`-reachable source. Any commit touching a reachable source (`serve.ts`,
`actions-cache-backend.ts`, `select-backend.ts`, `trust.ts`, `sync-gate.ts`,
`server.ts`, `entry.ts`, ...) MUST regenerate the bundle via `npm run build:action`
and stage `start-cache-server/index.js` in the SAME commit. Otherwise the
`action-bundle-drift` CI job fails at that commit and the history is not bisectable.
Verified in sync at HEAD (`npm run check:action`, exit 0).

**Blocker #2 remediation shape.** Restore `withHashLock` INSIDE
`actions-cache-backend.ts` around both `get` and `put` (predecessor prior art), and
then REMOVE the wrapper at `serve.ts:102` -- nesting the same-hash lock self-deadlocks
(the inner call sees the outer's tail as `prior`, which cannot settle until the inner
resolves). Keep `inFlightPuts` drain tracking in `serve.ts`; only the lock moves.

**Do not weaken these while fixing:**
- `server.ts` read-fault-to-404 degradation is deliberate (SRV-05) -- not a bug.
- `isTrustedSyncEvent` must NOT be replaced with `isSyncTrusted`; its docstring
  correctly explains that would fail-closed on `schedule` and silently disable
  cleanup. Narrow it to the literal `'schedule'` instead.
- `cache-archive-path.ts` path string is comment-locked (Pitfall 7).

**TDD:** `workflow.tdd_mode` is `true` for this project. Each behavioral fix should
land with a test that fails before the fix.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/ARCHITECTURE-DECISION.md` -- Decision 2 + control C1 (benign 409/no-op,
  in-code gate is spoofable defense-in-depth, no caller/mode flag); Framing (sunk cost
  is zero, no parity-patching); Decision 5 (retention, one coupled setting).
- `.planning/REQUIREMENTS.md:49` -- TRUST-02 sync-gate rejection list.
- `.planning/phases/05-trust-widening-ppe-gate/05-02-PLAN.md:103,110` -- `merge_group`
  and `workflow_dispatch` refused on every host; `TRUSTED_EVENTS` content-pin.
- `.planning/phases/05-trust-widening-ppe-gate/05-RESEARCH.md:502` -- `pull_request`
  keeps read-write (non-default-branch scope).
- `.planning/research/FEATURES.md:158` -- read-only token requires untrusted event AND
  default-branch scope.
- restic forget/prune docs (empty-policy refusal, `--unsafe-allow-remove-all`).
- borg prune docs (mandatory scope prefix, mandatory `--keep-X`, dry-run).

</canonical_refs>
