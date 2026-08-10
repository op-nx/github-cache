---
phase: 13-read-only-actions-cache-backend
plan: 04
subsystem: docs
tags:
  [
    consumer-contract,
    env-knob,
    docs-adoption,
    mutation-proof,
    explicit-assertion-list,
  ]

# Dependency graph
requires:
  - phase: 13-read-only-actions-cache-backend
    provides: '13-03 put CACHE_READ_ONLY inline in ./lib/select-backend.ts, which public-surface.spec.ts already lists in KNOB_SOURCE_FILES -- so the source-scan half of the contract was satisfied before this plan started'
  - phase: 13-read-only-actions-cache-backend
    provides: '13-03 corrected memory-backend.ts to five outcomes, leaving docs/advanced.md as the last code-adjacent four-outcome claim'
provides:
  - 'CACHE_READ_ONLY as the ninth EXPECTED_ENV_KNOBS entry -- the single source both contract guards and both doc guards read'
  - 'a documented fifth backend-selection outcome on all three doc surfaces, with the table row in branch order'
  - 'a line-scoped fifth-outcome clause that the writable-Actions row cannot satisfy, plus the first assertion in this repo that pins a documented COUNT rather than content'
affects:
  [
    13-05 the three Windows leg gates that set the knob,
    13-06 evidence,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'count-pinning: assert the prose number a reader reads, never a tally re-derived from the same table -- a tally agrees with itself while the sentence above it lies'
    - 'line-scoped disambiguation: when an existing clause`s regex also matches a NEW row, scope the new clause to one line and require a token only the new row carries'
    - 'RED-as-artifact: let the contract guard fail first, then hand-edit the literal, so the diff a reviewer reads is the contract change itself'

key-files:
  created: []
  modified:
    - packages/github-cache/src/test/consumer-contract.ts
    - packages/github-cache/src/public-surface.spec.ts
    - packages/github-cache/src/docs-adoption.spec.ts
    - docs/configuration.md
    - docs/versioning.md
    - docs/advanced.md

key-decisions:
  - 'The intended RED was landed, not pre-empted: consumer-contract.ts was edited first, public-surface.spec.ts observed failing with exactly one failure, and only then was the inline literal hand-edited -- which is the whole point of the explicit-assertion-list idiom over a snapshot'
  - 'The advanced.md table row LINKS the knob to its configuration.md anchor, matching the file`s existing cross-link convention at the CACHE_MIRROR_MAX_AGE_DAYS cleanup bullet, so the fifth outcome is one click from how to set it'
  - 'The fifth-outcome spec clause is line-scoped and names the knob, because /Actions-cache backend/i (the pre-existing writable clause) matches the new row too -- a clause both rows satisfy is a second reading of the fourth outcome, not coverage of the fifth'
  - 'The count clause asserts the PROSE sentence, never a row tally, per RESEARCH open question 2 -- a tally re-derives the number from the table it checks and cannot detect a lying sentence'
  - 'EXPECTED_ACTION_INPUTS left at [`port`]: adding an action input would have silently taken rejected option (c), a strict superset of the env knob`s cost'

patterns-established:
  - 'When a new row makes an existing clause`s regex ambiguous, disambiguate the NEW clause rather than tightening the old one -- the old clause`s looseness is still correct for the outcome it names'
  - 'Record a mutation measurement as the observed pass/fail split (`1 failed | 42 passed`), not as a claim that the clause "is non-vacuous"'

requirements-completed: [DOCS-10]

coverage:
  - id: D1
    description: 'CACHE_READ_ONLY is the ninth EXPECTED_ENV_KNOBS entry, and the change landed as a hand-edited reviewable diff in the inline sorted literal rather than a regenerated snapshot'
    requirement: DOCS-10
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/public-surface.spec.ts#the documented env-knob set is exactly the D-04 group-a contract list'
        status: pass
      - kind: other
        ref: 'observed RED before the literal edit: 1 failed | 13 passed, the failure being exactly the literal clause; git diff HEAD~1 HEAD --numstat on public-surface.spec.ts shows 1 insertion 0 deletions'
        status: pass
      - kind: other
        ref: 'zero toMatchSnapshot CALL SITES in public-surface.spec.ts (the one textual match is the header prose that documents the ban)'
        status: pass
    human_judgment: false
  - id: D2
    description: 'The knob is documented on all three consumer doc surfaces, each guarded by an it.each over the same EXPECTED_ENV_KNOBS source'
    requirement: DOCS-10
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/docs-adoption.spec.ts#documents env knob CACHE_READ_ONLY (configuration.md)'
        status: pass
      - kind: unit
        ref: 'packages/github-cache/src/docs-adoption.spec.ts#lists env knob CACHE_READ_ONLY (versioning.md)'
        status: pass
      - kind: other
        ref: 'git grep -c "### `CACHE_READ_ONLY`" -- docs/configuration.md -> 1 (the resolution section, not only the table row)'
        status: pass
    human_judgment: false
  - id: D3
    description: 'advanced.md documents FIVE outcomes in prose and as a fifth table row placed after the writable Actions-cache row, mirroring branch order'
    requirement: DOCS-10
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/docs-adoption.spec.ts#names the CACHE_READ_ONLY read-only Actions-cache outcome (TRUST-14)'
        status: pass
      - kind: other
        ref: 'the selection table has 5 body rows and the knob row is last; select-backend.ts puts the knob branch immediately before `return createActionsCacheBackend()`, so table order matches branch order'
        status: pass
    human_judgment: false
  - id: D4
    description: 'No "four backend-selection outcomes" or "has FOUR outcomes" text survives anywhere in docs/, packages/ or README.md'
    requirement: DOCS-10
    verification:
      - kind: other
        ref: 'git grep -c -i -e "four .*backend-selection outcomes" -e "has FOUR outcomes" -- docs packages README.md -> no matches (exit 1); three sites closed: docs/advanced.md:21, docs/configuration.md:92, docs-adoption.spec.ts:117'
        status: pass
      - kind: other
        ref: 'git grep -c -i "all four selectBackend outcomes" -- packages/github-cache/src -> no matches (exit 1)'
        status: pass
    human_judgment: false
  - id: D5
    description: 'The fifth outcome and the documented count are both spec-pinned and both mutation-proven, so a five-outcome selector cannot be documented as four again'
    requirement: DOCS-10
    verification:
      - kind: other
        ref: 'mutation: delete the read-only table row -> 1 failed | 42 passed, the failure being the fifth-outcome clause; the writable-Actions clause stayed GREEN under the same mutation'
        status: pass
      - kind: other
        ref: 'mutation: revert the advanced.md prose count to the previous value -> 1 failed | 42 passed, the failure being the count clause; every content clause stayed GREEN'
        status: pass
    human_judgment: false
  - id: D6
    description: 'EXPECTED_ACTION_INPUTS is untouched, so rejected option (c) was not silently taken'
    requirement: DOCS-10
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/public-surface.spec.ts#consumer action inputs are exactly the enumerated set (D-04 group b) -- still [`port`], untouched and green'
        status: pass
      - kind: other
        ref: 'git diff over this plan touches no line of EXPECTED_ACTION_INPUTS and no line of start-cache-server/action.yml'
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-02
status: complete
---

# Phase 13 Plan 04: The Public-API Cost of the Knob Summary

**`CACHE_READ_ONLY` is now the ninth entry in a single-sourced consumer contract that fires four guards at once, documented on all three surfaces, and the backend-selection outcome count is the first number in this repo that a spec clause holds honest.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-02T01:07:03Z
- **Completed:** 2026-08-02T01:14:56Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- **The RED was landed rather than pre-empted, and it was exactly the right size.** Adding the
  contract entry alone produced `1 failed | 13 passed` -- the single failure being the inline
  literal clause. Every other clause, including the brand-new
  `env knob CACHE_READ_ONLY still appears in the package source` scan, was already green, which
  confirms 13-03's handoff claim from the guard rather than from the prose: the knob lives inline in
  `./lib/select-backend.ts`, already in `KNOB_SOURCE_FILES`, so no file had to be added to that list.
- **The literal grew by exactly one line.** `git diff HEAD~1 HEAD --numstat` on
  `public-surface.spec.ts` reads `1 0`. The contract change is the diff a reviewer sees, which is
  the entire reason this repo runs an explicit-assertion-list instead of a snapshot whose `-u`
  regeneration is easy to rubber-stamp.
- **The fifth-outcome clause is line-scoped because the fourth one is not.** The pre-existing
  writable clause matches `/Actions-cache backend/i`, and the new row contains that same phrase --
  so the obvious new clause would have been satisfiable by the row it was not describing. Measured:
  deleting the read-only row leaves the writable clause GREEN. The new clause requires the knob name
  and `read-only` and `Actions-cache backend` on the SAME line, so only the row itself satisfies it.
- **The count is pinned against prose, not a row tally.** A tally counts the rows of the very table
  it is checking, so it agrees with itself no matter what the sentence above the table claims. The
  clause asserts the sentence a reader actually reads. Both mutations were run before the commit and
  both landed at `1 failed | 42 passed`, each reddening one clause and nothing else.
- **Three stale four-outcome sites closed, and the two the plan flagged as "unnamed by the research
  enumeration" were real.** `docs/advanced.md:21` (prose), `docs/configuration.md:92` (a sentence in
  the token section, not a heading or table), and `docs-adoption.spec.ts:117` (the guard's own
  rationale comment, which is the same stale-comment defect class the count clause now guards
  against). The repo-wide count is zero.
- **No bundle drift, as predicted.** `npm run check:action` exits 0 -- no file this plan touched is
  `serve()`-reachable.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enumerate the ninth knob and review it into the inline literal** -- `9906de8` (feat)
2. **Task 2: Document the knob and the fifth outcome across three surfaces** -- `d2f7dd9` (docs)
3. **Task 3: Pin the fifth outcome and its documented count** -- `5f7f2cd` (test)

## Files Created/Modified

- `packages/github-cache/src/test/consumer-contract.ts` - `CACHE_READ_ONLY` appended next to the
  other `CACHE_`-prefixed knobs, preserving the array's deliberate by-concern grouping (Nx client
  vars, port, cache knobs, tokens, identity) rather than sorting it.
- `packages/github-cache/src/public-surface.spec.ts` - one line added to the inline sorted literal,
  between `CACHE_MIRROR_MAX_AGE_DAYS` and `GH_TOKEN`. Nothing else touched.
- `packages/github-cache/src/docs-adoption.spec.ts` - describe renamed to five outcomes, rationale
  comment rewritten, two clauses added (fifth outcome, prose count), each carrying its measured
  mutation result.
- `docs/configuration.md` - a `CACHE_READ_ONLY` table row and a `### CACHE_READ_ONLY` resolution
  section naming `selectBackend`, the LAST-branch read and why it can only narrow, the unset
  default, and the restore-only consumer posture; plus the `:92` count correction.
- `docs/versioning.md` - the knob appended to consumer env-knob group 3.
- `docs/advanced.md` - prose count corrected, and a fifth table row after the writable row, linking
  the knob to its configuration.md anchor.

## Decisions Made

- **The advanced.md row links the knob to `configuration.md#cache_read_only`.** The file already
  cross-links `CACHE_MIRROR_MAX_AGE_DAYS` to its anchor in the cleanup bullet, so this is the
  existing convention rather than a new one -- and the threat register's stated risk for this plan
  is precisely an undiscoverable capability.
- **"There is nothing to enable in code (D-01/TRUST-05)" was left standing above the new row.** The
  knob does not enable anything: it declines a capability the context had already earned. The
  narrowing explanation lives in `configuration.md`'s resolution section, where a reader who wants
  to set the knob will be, rather than as a caveat bolted onto a sentence about code-level mode
  flags.
- **The old writable-Actions clause was NOT tightened.** Its looseness is still correct for the
  outcome it names; the ambiguity was introduced by the new row, so the new clause carries the
  disambiguation. Tightening the old one would have churned a clause that was never wrong.
- **The mutation measurements are recorded as observed splits, not as adjectives.** `1 failed | 42
  passed` is checkable by re-running the mutation; "this clause is non-vacuous" is not.

## Deviations from Plan

### Acceptance Criterion Not Literally Satisfiable

**1. The `toMatchSnapshot` zero-count criterion is unsatisfiable without deleting a correct comment**

- **Found during:** Task 1 (running the acceptance criteria)
- **Criterion:** `git grep -c "toMatchSnapshot" -- packages/github-cache/src/public-surface.spec.ts`
  prints `0`.
- **Observed:** prints `1`. The single match is `public-surface.spec.ts:18`, the header prose
  `Style: explicit-assertion-list, NOT toMatchSnapshot() (the pinned-deps.spec.ts / ppe-action.spec.ts
  precedent, D-05)` -- pre-existing, predating this plan, and the documentation of the very idiom the
  criterion is trying to protect.
- **Resolution:** criterion INTENT verified instead -- zero `toMatchSnapshot` CALL SITES (the match
  is a comment line; filtering comment lines yields 0). The comment was NOT deleted. Deleting an
  accurate explanation of why snapshots are banned, in order to satisfy a grep that checks snapshots
  are banned, would trade the documentation for the check that documents it.
- **This is the fourth occurrence on this branch of the same defect class** (13-02 once, 13-03
  twice): a mechanical criterion that scans a file treats PROSE IN THAT FILE as input. The three
  prior cases were self-inflicted by comments written in the same plan; this one is a criterion
  authored against a file whose pre-existing comment already trips it. For a future planner: a
  zero-count grep for a banned token is only sound when the ban is not also explained in the scanned
  file -- prefer scoping the grep to call-site syntax (`.toMatchSnapshot(`) or excluding comment
  lines.
- **No code change.**

### Auto-fixed Issues

None. All three tasks executed as written.

---

**Total deviations:** 1 criterion-vs-prose finding, 0 code deviations
**Impact on plan:** None on outcome. Every other criterion passed literally.

## Deferred Items

- **`docs/versioning.md:15-17` lists only four of the six package type exports.** It names
  `CacheBackend`, `GetHit`, `GetResult` and `PutResult`, while
  `public-surface.spec.ts`'s `EXPECTED_TYPE_EXPORTS` carries six -- `ReadableBackend` and
  `WritableBackend` are missing from the prose. Pre-existing, unrelated to this plan's changes, and
  not covered by any guard (`docs-adoption.spec.ts` pins versioning.md's env-knob group only, which
  is why the drift survived). Out of scope per the plan's file list; logged rather than fixed.

## Issues Encountered

- **`nx test <project> -- <pattern> --skip-nx-cache` passes `--skip-nx-cache` through to vitest**,
  which rejects it and fails the run with a Node error rather than an argument error. The flag must
  precede the `--`: `nx test github-cache --skip-nx-cache -- docs-adoption`. Cost one confusing red
  run; worth knowing before reading such a failure as a real one.
- **`git grep -c` prints NOTHING and exits 1 when the count is zero** -- it does not print `0`. Any
  criterion phrased as "prints `0`" is satisfied by empty output plus exit 1, which reads as a
  failure to a careless check. Both zero-count criteria in this plan are in that shape.

## User Setup Required

None - documentation and contract enumeration only. The knob is documented but still not SET
anywhere; 13-05 wires it into the three Windows legs.

## Next Phase Readiness

- **13-05 can wire the knob into the three Windows legs.** The consumer contract, all three doc
  surfaces and both spec guards are in place, so a leg that sets `CACHE_READ_ONLY` is setting a
  documented, enumerated knob rather than an undeclared one.
- **The `ci.yml` legs, the leg gates, and the "RECORDED, never gated" stale sites are untouched** --
  explicitly 13-05's scope, and left alone.
- **No bundle coupling was created.** `check:action` exits 0; nothing this plan touched is
  `serve()`-reachable.
- Pre-existing untracked
  `.planning/phases/13-read-only-actions-cache-backend/.gitkeep` is still present and still out of
  scope; left untouched for the fourth consecutive plan.
- No blockers.

## Self-Check: PASSED

Files verified present:

- `packages/github-cache/src/test/consumer-contract.ts` (9 knob entries)
- `packages/github-cache/src/public-surface.spec.ts`
- `packages/github-cache/src/docs-adoption.spec.ts`
- `docs/configuration.md`
- `docs/versioning.md`
- `docs/advanced.md`

Commits verified in history: `9906de8`, `d2f7dd9`, `5f7f2cd`

Battery (all from the MAIN tree): `npm run test` green (969 passed, 42 files -- up from 964),
`npx nx run-many -t typecheck lint --projects=github-cache --skip-nx-cache` printed
`Successfully ran targets typecheck, lint`, `npm run check:action` exit 0 with no diff,
`npx prettier --check` clean on all six files, `git status --porcelain` clean apart from the
pre-existing untracked `.gitkeep`.

---

_Phase: 13-read-only-actions-cache-backend_
_Completed: 2026-08-02_
