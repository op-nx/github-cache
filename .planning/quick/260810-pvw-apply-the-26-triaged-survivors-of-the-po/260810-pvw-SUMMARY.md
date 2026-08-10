---
quick_id: 260810-pvw
phase: quick-260810-pvw
plan: 01
subsystem: github-cache spec and log-rendering surface
status: complete
tags: [over-engineering, dedup, guard-discipline, mutation-testing]
requires: [260810-pvw-TRIAGE.md, 260810-pvw-RESEARCH.md, 260810-pvw-CONTEXT.md]
provides:
  - packages/github-cache/src/test/repo-file.ts nonSpecModules()
  - packages/github-cache/src/test/repo-file.ts forbiddenLeafImports()
  - packages/github-cache/src/lib/octokit-fault-reason.ts faultSuffix()
affects:
  - packages/github-cache/src (19 files)
tech-stack:
  added: []
  patterns:
    - shared test primitives return data and let the caller assert, because src/test/ may not import vitest
    - a deletion candidate is settled by running the mutation, never by a subsumption argument
key-files:
  created: []
  modified:
    - packages/github-cache/src/action/index.spec.ts
    - packages/github-cache/src/backend/actions-cache-backend.spec.ts
    - packages/github-cache/src/backend/types.ts
    - packages/github-cache/src/cleanup/cleanup.spec.ts
    - packages/github-cache/src/cleanup/cleanup.ts
    - packages/github-cache/src/hash-parity/compare.spec.ts
    - packages/github-cache/src/lib/cache-archive-path.spec.ts
    - packages/github-cache/src/lib/cache-key.spec.ts
    - packages/github-cache/src/lib/compression-method.spec.ts
    - packages/github-cache/src/lib/mirror-seed.spec.ts
    - packages/github-cache/src/lib/octokit-fault-reason.ts
    - packages/github-cache/src/lib/release-asset-name.spec.ts
    - packages/github-cache/src/lib/select-backend.spec.ts
    - packages/github-cache/src/public-surface.spec.ts
    - packages/github-cache/src/publish/publish-mirror.spec.ts
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/serve.spec.ts
    - packages/github-cache/src/test/consumer-contract.ts
    - packages/github-cache/src/test/repo-file.ts
decisions:
  - P18 was applied after measurement showed every conjunct mutation still caught by a surviving read-only test
  - P21 was NOT applied -- measurement showed both candidates are unique catchers
  - P5 retained two of its three targets under triage authority #3, applying only the :698 literal half
  - P3's follow-on export cleanup landed as a fifth commit rather than a history rewrite
metrics:
  duration: ~2h
  completed: 2026-08-10
---

# Quick Task 260810-pvw: Apply the triaged survivors of the /ponytail-review of PR #16 Summary

Applied the 22 in-scope survivors of the multi-agent over-engineering review of PR #16 as
mechanism-scoped commits, with both measurement-gated items settled by running the mutation
rather than by argument -- one cleared its gate and was applied, one did not and applied
nothing.

## Per-item disposition (all 22)

### Group A -- vacuous and suite-redundant assertions (commit e84ef5a)

| Item | Disposition | Reason |
|---|---|---|
| P1 | APPLIED | Final-path-segment clause dropped from `action/index.spec.ts`. The doc block now records the MEASURED rationale (suite-level redundancy against `mirror-seed.spec.ts`'s five hand-authored literals), not the falsified "can never fail". |
| P3 | APPLIED | Partial-target-rate `it` and its now-unused import dropped. The project's own VERIFICATION.md calls it a fixture-coupling lock, not a behaviour gate. See the deviation below for its export follow-on. |
| P4 | APPLIED | `expect('put' in backend)` dropped beside `isWritableBackend(backend)`, which is DEFINED as that membership check. Named site only. |
| P5 | REDUCED + RETAINED | Only the `:698` literal half applied. See below. |
| P6 | APPLIED | Aggregate both-true count dropped; the per-row `it.each` and the `toHaveLength(26)` lock survive and the comment now names both as the two halves of one guard. |

### Group B -- aliases and one-call-site indirection (commit 7a22b8d)

| Item | Disposition | Reason |
|---|---|---|
| P8 | APPLIED | `strippedSourceOf` alias removed; three call sites now call `stripLineComments`. Its docstring moved onto `strippedSubject`, which it actually describes. |
| P9 | APPLIED | `readSource` alias removed, three call sites renamed to `readRepoFile`, and the comment block that existed only to justify the alias deleted outright. |
| P10 | APPLIED | `widened()` inlined at its one call site in the ONLY non-vacuous form the comment above it permits: `expect(withKnob === 'writable' && withoutKnob !== 'writable').toBe(false)`. No `if` guard, no negated matcher. |
| P11 | APPLIED | `readonly` dropped from `put?: never` with the two lines explaining that it does nothing. |

### Group C -- real duplication (commit c05deb2)

| Item | Disposition | Reason |
|---|---|---|
| P12 | APPLIED | One `nonSpecModules()` in `test/repo-file.ts` returning BARE paths; `actions-cache-backend.spec.ts` re-prefixes at all three call sites. |
| P13 | APPLIED | One `faultSuffix(error, messageOverride?)` in the existing `octokit-fault-reason.ts`, used at all three rendering sites. |
| P14 | APPLIED | Clauses 2 and 3 of both scan triads dropped (32 generated cases, exactly the predicted arithmetic). Clause 1, the mandatory non-vacuity control, survives at both sites. |
| P15 | APPLIED (2 of 3 sites) | The two `not.toMatch` copies unified; `cache-archive-path.spec.ts` keeps its strictly stronger exact-import-list equality untouched. |
| P16 | APPLIED | The two group (c) inline export pins dropped; the env-knob pin (DOCS-10) and `MAX_CACHE_BODY_BYTES` kept. |
| P17 | APPLIED (after measurement) | Third miss-test copy dropped. See the measurement below. |
| P18 | APPLIED (gate cleared) | Writable throw pair dropped. See the transcripts below. |
| P19 | APPLIED | Census fixture generates 7 rows instead of 122; measured provenance kept in the comment; arithmetic lock re-pointed, not deleted. |
| P21 | **MEASURED-BLOCKED** | Both candidates are unique catchers. Nothing applied. See the transcript below. |
| P22 | APPLIED | All three sibling specs on `beforeAll(() => enterWorkspaceRootCwd());`. |

### Group D -- prose corrections (commit deea820)

| Item | Disposition | Reason |
|---|---|---|
| P24 | APPLIED | States the measured fact: a hardcoded 0/1/2 map passes 22 of 22, so the derived check's unique catch is the COMPOSITE (hardcode PLUS tuple reorder). Records why no stronger claim exists -- a map with identical output for every input is not an observable mutation. Test at `:66` kept. |
| P25 | APPLIED | States that typecheck sees both reachable shapes (TS2440, TS6133), so the clause is subsumed TODAY, and that it becomes the unique catcher on a second use site. The same false claim in the comment block above the assertion was corrected with it. |
| P26 | APPLIED | BOTH false clauses corrected, not only the ci.yml one. States the single cause (vitest per-file module registry isolation) and the memo's surviving within-file justification. |

Zero assertions changed in group D; the diff is comment lines and one failure-message string
literal, and the test count is identical before and after it.

## P5: the two retentions under triage authority #3

`:698`'s literal half was deleted, its title now describes the subset claim alone, and the
half of its comment that argued for the literal pin was corrected in the same commit. The
subset assertion and the comment arguing for it survive (`arrayContaining` still present).

`:662` and `:682` were **RETAINED**, and the measured reason is that each is the unique
catcher of a production-constant mutation -- these are hand-authored pins OF PRODUCTION
VALUES imported from `compare.ts`, not self-referential restatement:

- `:682` is the only assertion pinning `REQUIRED_META_KEYS` membership. The surviving subset
  assertion asserts only that it CONTAINS the three like-for-like keys, so dropping `os` /
  `nodeVersion` / `graphState`, or adding an eighth key, would go uncaught. The relational
  partition is about TARGETS and has no meta-key counterpart.
- `:662` is the only test catching a swap between the invariant set and the divergent target.
  Both surviving relational assertions stay green under `DIVERGENT_TARGET = 'test'` with
  `INVARIANT_TARGETS` gaining `integration`.

## P17 measurement

Not required by the plan, but the deletion removed the only read-only-factory miss test, which
is the "X subsumes this" shape the discipline exists for -- so it was measured rather than
argued.

**Mutation:** the `get` miss branch in `actions-cache-backend.ts` returns a hit instead of a
miss.

**Reddening set (5):** the ROBUST-03 writable-factory miss; the deletion candidate; the
same-hash get/put interleave test; and two `select-backend.spec.ts` TRUST-14 cases.

Four of the five SURVIVE the cut, so the mutation remains caught. Survivor of record, as the
plan names it: the shared-get-closure argument-array test, which asserts both factories produce
the same whole `restoreCache` argument array and equal results -- the claim that makes a
diverging `get` visible.

## P18 measurement -- gate CLEARED, writable pair cut

Criterion applied: **surviving coverage**, not a reddening count.

| Mutation | Reddening set | Survives the cut? |
|---|---|---|
| Conjunct 1 (`nx.json` existence check disabled) | `THROWS naming the workspace-root condition when the cwd has no nx.json (VER-04 conjunct 1)` [writable]; `THROWS from the READ-ONLY factory when the cwd has no nx.json (VER-04 conjunct 1, VER-08)` [read-only] | YES -- the read-only case survives |
| Conjunct 2 (`GITHUB_WORKSPACE` divergence check disabled) | `THROWS naming the divergence when GITHUB_WORKSPACE points at a sibling directory (VER-04 conjunct 2)` [writable]; `THROWS from the READ-ONLY factory when GITHUB_WORKSPACE points at a sibling directory (VER-04 conjunct 2, VER-08)` [read-only] | YES -- the read-only case survives |

Each mutation reddened exactly two tests, one per factory -- the composition premise
(`{...createReadOnlyActionsCacheBackend(), put}`) held, so step 5's abort condition was not
triggered. **Surviving-coverage argument:** deleting the WRITABLE pair leaves conjunct 1 caught
by the read-only conjunct-1 case and conjunct 2 caught by the read-only conjunct-2 case, so
every mutation is still caught by a test that survives the cut. The read-only pair was kept
rather than the arithmetically equivalent alternative, because two in-code blocks argue the
read-only path matters more. The happy-path and case-fold cases still construct the writable
factory, so the composition itself stays exercised. The case-fold comment, which cited "the
three cases above", was corrected in the same commit.

## P21 measurement -- MEASURED-BLOCKED, nothing applied

| Mutation | Reddening set | Verdict |
|---|---|---|
| `download` suspect removed from `compare.ts`'s wrong-record-count detail string | 1 test: `names the three suspects rather than only reporting the count` -- and it reddens because of the candidate `toContain('download')` | Candidate is the unique catcher |
| `upload` suspect removed from the same string | 1 test: the same one, reddening because of the candidate `toContain('upload')` | Candidate is the unique catcher |

Neither mutation is caught by any assertion that would survive the proposed cut. With `:194`
and `:195` deleted, the test would hold only `toContain('if-no-files-found')` and would stay
GREEN under both mutations. The ledger's rationale ("the reason-code enum is asserted
separately in the same tests") does not hold: these strings are asserted only here and they pin
production strings. **Nothing was deleted**, the test title stands, and the D-23 comment at
`:189-190` was left exactly as written -- it is not describing a deleted assertion.

Both mutation subjects (`compare.ts`, `actions-cache-backend.ts`) were reverted and verified
byte-clean with `git diff --stat` before any commit.

## check:action bundle verdict

`check:action` exits **0** in the MAIN TREE, run after the group-B commit (immediately after
the P11 edit) and again after group C's production-source edits. **Zero drift, nothing
regenerated.** The prediction held: `readonly` on an interface property is type-only, so the
generated `start-cache-server/index.js` is byte-unchanged. `start-cache-server/index.js` does
not appear in the diff.

Verifying rather than assuming was warranted -- `backend/types.ts` IS in the serve() import
graph, so the TRIAGE ledger's blanket "no P-item touches a serve()-reachable source" was false.

## Deviations from plan

**1. [Rule 3 - Blocking] `fallow:ci` reddened at HEAD on an export P3 orphaned.**

- **Found during:** the final six-gate battery, after the fourth commit.
- **Issue:** deleting the P3 value-pin test removed the only external consumer of
  `PARTIAL_READ_MISS_WARN_RATIO`, leaving it exported with no consumers.
  `fallow dead-code --fail-on-issues` reports it and exits 1.
- **Fix:** made the constant module-private and corrected its docstring, which had stated
  "EXPORTED SO A SPEC CAN PIN THE VALUE" -- the pin P3 removed.
- **No guard weakened:** no assertion was touched. The behaviour pair that actually guards the
  constant (the 9-miss / 8-miss boundary fixtures straddling the rate by 0.0098) is in-file,
  untouched, and reddens on a change in either direction. That pair is strictly stronger than
  the deleted value pin and never depended on the export.
- **Commit:** 8369bf5 (a FIFTH commit, see below).

**2. Five commits, not four.** The plan mandates four mechanism-scoped commits. Deviation 1
belongs topically inside group A (it is P3's tail), but group A was three commits back by the
time `fallow:ci` surfaced it. Folding it in would have meant rewriting three landed commits to
preserve a count; the fifth commit is labelled as P3's follow-on and carries its reasoning.
Groups A through D are unchanged and still one-per-mechanism.

**3. P17 was measured though the plan did not require it** (see above). The plan's own
instruction was to record a deviation if the file made a different reading obvious; it did not
-- assumption A1 held exactly -- but the deletion removed the only read-only-factory miss test,
so it was settled by mutation rather than by the composition argument.

**4. P25 corrected two passages, not one.** The comment block above the assertion carried the
same measured-false claim as the string literal named by the item. Correcting only the literal
would have shipped a corrected message beside a comment asserting the opposite.

## Flagged for the maintainer -- NOT swept

The P4 mechanism ("`isWritableBackend` is DEFINED as `'put' in backend`") applies identically
at three sibling sites the ledger never named. Scope was the named site only, and all three
were verified still carrying the pair after this task:

- `packages/github-cache/src/backend/memory-backend.spec.ts`
- `packages/github-cache/src/backend/releases-backend.spec.ts`
- `packages/github-cache/src/cleanup/cleanup.spec.ts`

## Out of scope, verified untouched

P2, P7, P20 and P23 appear nowhere in the diff, nor do `lint-rules.spec.ts`,
`octokit-fault-reason.spec.ts`, `read-integration-hash.integration.spec.ts`,
`docs-same-os-claims.spec.ts`, `capture-hashes-cli.spec.ts` or `repo-file.spec.ts`. No change
to `.planning/` (beyond this task's own artifacts), `package-lock.json`, `nx.json`, `.github/`
or `start-cache-server/index.js`.

## Final battery -- all six gates at HEAD

| Gate | Exit |
|---|---|
| `test` | 0 |
| `lint` | 0 |
| `typecheck` | 0 |
| `format:check` | 0 |
| `check:action` | 0 (zero bundle drift) |
| `fallow:ci` | 0 (no issues) |

**Per-commit gating, stated plainly:** every commit was gated on `test` + `typecheck` + `lint`
before it landed, and `format:check` before A, B, C and D. `check:action` was run before the
group-B and group-C commits (the two carrying production-source edits). `fallow:ci` was NOT run
per commit -- only at HEAD, which is how deviation 1 surfaced late. Full 6-gate-per-commit
gating was NOT performed.

## Test count

| | Tests |
|---|---|
| Before (HEAD b070b60) | 1182 |
| After group A | 1182 (2 `it`s removed; the file-level counts are `it.each`-expanded) |
| After P14 | 1150 (-32, exactly the predicted `(14 + 2) * 2`) |
| After (HEAD 8369bf5) | 1145 |

Net -37 cases. It DECREASED, and no test went from passing to failing at any point. The
baseline is the vitest total measured at the start of group A plus the two `it`s group A
removed; the 1182 figure was read from a green run of the modified tree, so the two removed
cases are added back to reach the pre-task total.

## Net line delta

**313 insertions, 351 deletions across 19 files -- net -38 lines.**

Stated as an outcome, not against a target. There was no line-reduction target. The reduction
is small because the gates worked: P5 was reduced to one half-deletion when its premise was
falsified, P21 applied nothing when measurement blocked it, and P15 left the third site alone
rather than consolidating a stronger guard onto a weaker shape. Much of the insertion count is
prose that was owed -- the P18 and P17 measurement records, the three P24/P25/P26 corrections,
and the docstrings for the two new shared primitives.

## Self-Check: PASSED

- All five commits verified present in `git log b070b60..HEAD`.
- All 19 modified files verified present and in the diff.
- `nonSpecModules` declared exactly once in the package (`test/repo-file.ts`).
- `faultSuffix` exported once from `octokit-fault-reason.ts`.
- `strippedSourceOf`, `readSource`, `function widened` and `restoreCwd` all return grep exit 1
  in their respective files.
- `cache-archive-path.spec.ts` still carries its exact-import-list equality.
- P5's two retentions, P21's three `toContain` assertions and P18's read-only pair all verified
  still present.
