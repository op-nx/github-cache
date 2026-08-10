---
quick_id: 260810-pvw
phase: quick-260810-pvw
verified: 2026-08-10T20:05:00Z
status: human_needed
score: 4/6 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "No guard is weakened. Every deletion either removes a provably redundant assertion, or preserves the relational/subset half of the test it edits."
    test: "Re-run the P17 and P18 mutations against the tree at HEAD 8369bf5: (a) make the shared get closure return a hit on the restoreCache-undefined branch; (b) disable the nx.json conjunct, then the GITHUB_WORKSPACE conjunct, in actions-cache-backend.ts. Additionally mutate createActionsCacheBackend to build its object WITHOUT spreading createReadOnlyActionsCacheBackend()."
    expected: "(a) and (b) still redden a surviving test. The composition mutation is the open question -- after P18 no throw test constructs the WRITABLE factory, so a writable factory that stops delegating to the guarded read-only factory may now pass."
    why_human: "Reproducing requires mutating production source and running the suite -- a state change the verifier must not make. The reverted mutations left no artifact in the repo, so the SUMMARY's reddening SETS cannot be checked against anything."
human_verification:
  - test: "Read packages/github-cache/src/lib/release-asset-name.ts:189-192 and decide whether the prose still describes an assertion that exists."
    expected: "The comment says the disjointness is 'asserted directly in release-asset-name.spec.ts with the both-true count pinned to 0'. P6 deleted the test that pinned that count. The substance survives (the surviving union-cardinality assertion is algebraically the same claim), but the named mechanism is gone."
    why_human: "Judgement call on the standing rule 'no comment describes an assertion that no longer exists'. The file is production source and was NOT modified by this task, so correcting it is a scope decision."
  - test: "Confirm the P18 cut is acceptable: no test now asserts that createActionsCacheBackend() THROWS on either VER-04 conjunct."
    expected: "Only the READ-ONLY factory carries throw coverage; the writable factory has only two not.toThrow() cases. The plan explicitly authorised this (Task 3, P18 step 4), and the composition is structurally asserted by the shared-get-closure and ADDS-put tests."
    why_human: "This is a real reduction in what a single mutation can be caught by, authorised by the plan but not covered by the plan's own surviving-coverage criterion, which enumerated only the two conjunct mutations."
---

# Quick Task 260810-pvw Verification Report

**Task goal:** Apply the 22 in-scope triaged survivors (P1..P26 minus P2/P7/P20/P23) of the
/ponytail-review of PR #16, without weakening any guard.
**Range verified:** `b070b60..HEAD` (e84ef5a, 7a22b8d, c05deb2, deea820, 8369bf5)
**Verified:** 2026-08-10
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 22 in-scope items dispositioned at the anchor; P2/P7/P20/P23 untouched; P5 reduced; P18/P21 measurement-gated | VERIFIED | Every disposition confirmed in the diff -- item-by-item table below |
| 2 | No guard is weakened | PRESENT_BEHAVIOR_UNVERIFIED | Structurally consistent everywhere I could check. Two of the three claimed measurements (P17, P18) cannot be reproduced from the codebase, and P18 leaves the writable factory with no throw coverage |
| 3 | No comment describes an assertion that no longer exists; no obituary comments | UNCERTAIN | Clean inside the 19 changed files. ONE residue found OUTSIDE them: `release-asset-name.ts:192` |
| 4 | check:action reports zero drift in the MAIN TREE after the group-B commit | VERIFIED | `start-cache-server/index.js` absent from `git diff --name-only b070b60..HEAD`; orchestrator measured `check:action` exit 0 at HEAD |
| 5 | Full acceptance battery green at HEAD | VERIFIED | Orchestrator-measured, uncached, at 8369bf5: test/lint/typecheck/format:check/check:action/fallow:ci all exit 0 |
| 6 | Commits are one-per-mechanism-group, in order, each individually green | VERIFIED (with disclosed deviation) | A-D land in group order; a FIFTH commit (8369bf5) is a documented gate-driven follow-on. Six-gate-per-commit gating was NOT run and the SUMMARY says so plainly, which is what the plan required |

**Score:** 4/6 truths verified (1 present but behavior-unverified, 1 uncertain)

### Per-item disposition, checked against the diff

| Item | Claimed | Found in diff | Verdict |
|---|---|---|---|
| P1 | APPLIED | `.split('/').at(-1)).not.toBe(RUN_ID)` deleted; doc block rewritten to the MEASURED rationale and no longer claims two assertions | MATCHES |
| P3 | APPLIED | `the partial TARGET RATE is one half` it deleted with its import | MATCHES |
| P4 | APPLIED | `expect('put' in backend).toBe(false)` deleted; `isWritableBackend` kept. `types.ts:83` is literally `return 'put' in backend` -- a true tautology, no unique mutation lost | MATCHES |
| P5 | REDUCED + 2 RETAINED | Only the `LIKE_FOR_LIKE_META_KEYS` literal-pin half deleted; title renamed to the subset claim; `arrayContaining` survives. `INVARIANT_TARGETS deep-equals the four` and `REQUIRED_META_KEYS deep-equals the seven` both PRESENT | MATCHES |
| P6 | APPLIED | Aggregate both-true `it` deleted; `toHaveLength(26)` lock and per-row `it.each` survive; the count comment now names both halves | MATCHES |
| P8 | APPLIED | `const strippedSourceOf = stripLineComments` gone from compression-method.spec.ts; call sites on `stripLineComments` | MATCHES |
| P9 | APPLIED | `readSource` gone; three call sites on `readRepoFile`; the alias-justifying comment block deleted outright, not reworded | MATCHES |
| P10 | APPLIED | `function widened` gone; inline is exactly `expect(withKnob === 'writable' && withoutKnob !== 'writable').toBe(false)` -- boolean-identical, no `if` guard, no negated matcher. The `:537` prose renamed to "the widening condition" | MATCHES |
| P11 | APPLIED | `readonly` dropped from `put?: never`; the two explanation lines gone; the internal-type note kept | MATCHES |
| P12 | APPLIED | `function nonSpecModules` declared exactly ONCE in the package (`test/repo-file.ts:167`), returns bare paths; actions-cache-backend re-prefixes at all THREE call sites | MATCHES |
| P13 | APPLIED | `faultSuffix(error, messageOverride?)` exported from the existing `octokit-fault-reason.ts`; used at exactly the three named sites, one with the burned-tag override; `publish-mirror.ts:360` status-only site left alone. Rendered strings are byte-identical | MATCHES |
| P14 | APPLIED | Clauses 2 and 3 deleted at both scan sites; clause 1 survives at both. `repo-file.spec.ts:45-73` genuinely owns the two stripper properties under the same names | MATCHES |
| P15 | APPLIED (2 of 3) | `forbiddenLeafImports(source, prefixes)` shared by cache-key and mirror-seed only; `cache-archive-path.spec.ts:154` still carries its exact-import-list equality | MATCHES |
| P16 | APPLIED | Both group (c) inline pins deleted; barrel equality survives for BOTH value and type exports; env-knob pin and `MAX_CACHE_BODY_BYTES` kept; `consumer-contract.ts` docstring corrected in the same commit | MATCHES |
| P17 | APPLIED after measurement | Third miss-test copy deleted; ROBUST-03 writable miss and the arg-array test survive | APPLIED as claimed; measurement not reproducible (see below) |
| P18 | APPLIED, gate cleared | Writable throw pair deleted; read-only pair present with BOTH conjuncts; the case-fold comment corrected in the same commit | APPLIED as claimed; measurement not reproducible (see below) |
| P19 | APPLIED | Constants renamed CENSUS_* -> FIXTURE_*, 122 -> 7 (3/2/2); measured provenance and release id kept in the comment; arithmetic lock RE-POINTED, not deleted | MATCHES |
| P21 | MEASURED-BLOCKED | Nothing applied -- see the dedicated section | MATCHES |
| P22 | APPLIED | All three siblings on `beforeAll(() => enterWorkspaceRootCwd())`; `restoreCwd` gone from all three; `afterAll` import dropped in exactly two | MATCHES |
| P24 | APPLIED | Prose only; states the 22/22 measured fact and the composite the derived check uniquely catches; test at `:66` kept | MATCHES |
| P25 | APPLIED | Prose + the assertion's failure-MESSAGE string; the `.not.toMatch(...)` matcher untouched | MATCHES |
| P26 | APPLIED | Both false clauses corrected (module loop AND ci.yml), single cause named | MATCHES |

### P21 -- confirmed MEASURED-BLOCKED, nothing applied

The three hunks in `compare.spec.ts` across the whole range are at `@@ -695`, `@@ -812` and
`@@ -835` -- P5 and P25. The D-23 region is outside all three.

At HEAD: `compare.spec.ts:188` still reads `it('names the three suspects rather than only
reporting the count')`, `:189-190` still carries the D-23 comment verbatim, and `:193`, `:194`,
`:195` still assert `if-no-files-found`, `upload` and `download`. Title, comment and both
candidate assertions are UNTOUCHED, exactly as required.

### The fifth commit, 8369bf5

Confirmed as described. It touches ONE file (`publish-mirror.ts`), changes the docstring and
`export const PARTIAL_READ_MISS_WARN_RATIO` -> `const PARTIAL_READ_MISS_WARN_RATIO`. No
assertion anywhere in the commit. The constant still has two in-module readers
(`publish-mirror.ts:505`, `:514`), and the boundary fixtures that guard it are present and
untouched: `publish-mirror.spec.ts:1497` (10 entries, 9 misses -- bound 0.5958) and `:1578`
(10 entries, 8 misses -- bound 0.4902). Two further silent-case fixtures at `:1591` and `:1604`
also survive.

### Group D is prose only

`git show deea820 -U0` removing every comment-shaped deleted line leaves exactly four lines --
all of them continuation lines of the P25 vitest failure-MESSAGE string literal. The matcher
`.not.toMatch(/(?:function|const|let|var|class)\s+collapseToOneLine\b/)` is unchanged. Zero
assertions deleted; exactly the three planned files.

### Out-of-scope sites -- confirmed untouched

None of `lint-rules.spec.ts` (P2), `octokit-fault-reason.spec.ts` (P7), any
`*.integration.spec.ts` (P20), `docs-same-os-claims.spec.ts` (P23) appears in
`git diff --name-only b070b60..HEAD`. `CORR_05_SITES` still has 5 occurrences in
`lint-rules.spec.ts`. The three unnamed P4 sibling sites
(`memory-backend.spec.ts`, `releases-backend.spec.ts`, `cleanup.spec.ts`) were not swept and
are flagged in the SUMMARY. `capture-hashes-cli.spec.ts` still carries its own `restoreCwd`,
as CONTEXT.md fixed the P22 sweep at three files. Nothing outside
`packages/github-cache/src/` is in the diff -- no `.planning/`, no `package-lock.json`, no
`nx.json`, no `.github/`, no `start-cache-server/index.js`.

## What I could NOT verify

Stated plainly rather than padded.

**1. The P17 and P18 mutation transcripts are not reproducible from the repository.** Both
mutations were reverted (correctly), so nothing in the tree records that they were run. The
SUMMARY's reddening SETS are the only evidence, and this verification exists specifically to
not take the SUMMARY's word. What I CAN confirm is that the OUTCOMES are consistent with the
claims: the tests the SUMMARY names as survivors all exist at HEAD, the read-only pair carries
both conjuncts, and `createActionsCacheBackend` really is
`{...createReadOnlyActionsCacheBackend(), put}` at `actions-cache-backend.ts:284-286`, so the
composition premise the argument rests on is true in the source. Reproducing the measurement
requires mutating production source and running the suite, which the verifier must not do.

**2. P18 leaves the writable factory with no throw coverage.** After the cut, the only
`toThrow` assertions on construction are on `createReadOnlyActionsCacheBackend` (`:987`,
`:994`); the writable factory has only `not.toThrow()` at `:935` and `:956`. The plan's
surviving-coverage criterion enumerated exactly two mutations (break conjunct 1, break
conjunct 2) and both are still caught. A THIRD mutation class -- the writable factory ceasing
to delegate to the guarded read-only factory -- is not covered by that criterion and would now
have to be caught indirectly, by the shared-get-closure argument-array test and the
"composition ADDS put" test rather than by a throw test. The plan explicitly authorised this
cut (Task 3, P18 step 4) and preferred it over deleting the read-only pair, so this is
plan-conformant, not a deviation. It is flagged because guard preservation is this task's
entire purpose.

**3. One orphaned-prose residue, outside the changed files.**
`packages/github-cache/src/lib/release-asset-name.ts:189-192` still reads: "Both reasons and
the table are asserted directly in `release-asset-name.spec.ts` with the both-true count
pinned to 0." P6 deleted the `it` that pinned that count. The SUBSTANCE survives -- the
surviving union test asserts `union.toHaveLength(currentOnly.length + legacyOnly.length)`,
which holds if and only if the intersection is empty, so the both-true count is still pinned
to zero, just by a different assertion. The named mechanism is nevertheless gone. The file is
production source and is not one of the 19 the task touched, so correcting it is a scope
decision for the maintainer.

## Guard-property findings, by deletion

Every assertion deleted in the range, and what mutation it uniquely caught:

| Deletion | Unique catch lost? | Basis |
|---|---|---|
| P1 final-path-segment clause | No | The whole-URL equality above it is derived from the function under test and does not catch identity -- but neither did the deleted clause uniquely: `mirror-seed.spec.ts` catches it off hand-authored literals at `:59`, `:66`, `:82`, `:101`. The doc block now records this instead of the falsified "can never fail" |
| P3 value pin | No | A literal restatement of a production constant with two behaviour fixtures straddling it by 0.0098, both intact |
| P4 `'put' in backend` | No | `isWritableBackend` is textually `return 'put' in backend` |
| P5 literal half of the subset test | No | The subset relation is the claim that cannot be read off either constant alone; the two membership pins that CAN be uniquely lost were RETAINED |
| P6 aggregate both-true count | No | Three surviving guards: per-row `it.each`, `toHaveLength(26)` table lock, and the union-cardinality identity |
| P14 clauses 2 and 3, both sites | No | They re-proved the SHARED stripper, which `repo-file.spec.ts:45-73` owns under the same test names; clause 1 (the needle's own probe) survives at both sites |
| P16 two group (c) inline pins | No | The barrel EXACT-equality survives for both value and type exports (`public-surface.spec.ts:137`, `:143`); the group (a) pin, which has no barrel counterpart, was kept |
| P17 third miss-test copy | Not for the measured mutation | Writable-factory miss survives at `:160`; both-factory equality survives on the hit path. See caveat 1 |
| P18 writable throw pair | Not for the two enumerated mutations | See caveat 2 |
| P22 `afterAll` teardown x3 | No | `enterWorkspaceRootCwd()` returns its teardown and vitest runs a hook's returned function as teardown; behaviour-preserving |
| P15 regex -> substring | No | `/from '\.\.\/backend/` and `source.includes("from '../backend")` have identical matching power -- the regexes carried no metacharacters beyond the escaped dots |
| P10 helper inline | No | `withKnob === 'writable' && withoutKnob !== 'writable'` is the helper's body verbatim; the quantifier is still the thing negated |

## Anti-patterns

None found in the 19 changed files. No `TODO`, `FIXME`, `TBD`, `XXX` or `HACK` introduced. No
obituary comments -- every deletion either corrected the prose that argued for the deleted
assertion or deleted that prose outright (P9's alias-justification block).

## Gaps Summary

No blocking gap. The task's stated purpose -- apply the cleanups without repeating A12 -- holds
up under the diff: the two measurement-gated items were genuinely gated (P21 applied nothing
and its site is byte-untouched), P5 was reduced rather than executed as filed, P15 refused to
consolidate a stronger guard onto a weaker shape, and no deletion I could evaluate removed a
unique catcher.

Two items need a human before this is signed off: the unreproducible P17/P18 mutation
transcripts combined with P18 leaving the writable factory throw-uncovered, and the one prose
residue in `release-asset-name.ts` that names a deleted assertion.

---

_Verified: 2026-08-10_
_Verifier: Claude (gsd-verifier)_

---

## ORCHESTRATOR RESOLUTION of the two `human_needed` items

Appended after the verifier's report, not merged into it -- the verdict above is the auditor's own
and stands as written. Both items it routed to a human are resolved BY MEASUREMENT below.

### Item 1 -- the P18 composition question: CLOSED, no gap

The verifier flagged that after P18 no test asserts the WRITABLE factory throws, so a writable
factory that stopped delegating to the guarded read-only factory might now pass uncaught. It could
not test this itself, correctly, because doing so means mutating production source.

MEASURED. `createActionsCacheBackend` was mutated to stop spreading
`createReadOnlyActionsCacheBackend()` and to supply its own inert `get` / `listCacheEntries`:

    Test Files  1 failed | 1 passed (2)
    Tests       12 failed | 66 passed (78)

TWELVE assertions redden, at `actions-cache-backend.spec.ts` lines 143, 157, 166, 188, 200, 402,
485, 516, 549, 588, 633 and 1014. Two are worth naming:

- **`:402`** is the shared-get-closure argument-array test -- P17's survivor-of-record, which the
  plan named in the threat register. It does the job it was credited with.
- **`:1014`** is a read-only-factory throw test, which reddens because the mutation severs the
  delegation the read-only guards reach through.

So the composition is caught twelve ways over. The reduction P18 made is in WHICH test carries the
throw assertion, not in whether the delegation is guarded. The verifier's concern was well-posed and
the answer is that no guard was lost.

### Item 2 -- the orphaned disjointness comment: FIXED, not waived

`release-asset-name.ts:189-192` did describe an assertion P6 deleted, which the standing rule
forbids. Corrected in commit `4664855`. The comment now names the surviving pair -- the per-row
`it.each` and the `toHaveLength(26)` size lock -- and states why neither half suffices alone, plus
which task deleted the aggregate count and why. The property is unchanged; only the clause carrying
it moved. Corrected in place rather than deleted, per the practice of keeping a superseded claim's
history intact.

The verifier was right to call this a scope decision rather than decide it: the file is production
source the task had not otherwise touched. Taken IN scope because the task itself created the
inaccuracy.

### Battery after both resolutions

Re-run uncached at `4664855`, all six gates: `test` 0, `lint` 0, `typecheck` 0, `format:check` 0,
`check:action` 0 (zero bundle drift), `fallow:ci` 0.

Note on invocation, since it cost one false alarm during this run: `format:check`, `check:action`
and `fallow:ci` are ROOT NPM SCRIPTS. `nx run github-cache:format:check` fails with "Cannot find
configuration for task" -- an exit 1 that looks exactly like a gate failure and is not one.

_Resolution measured and recorded by the orchestrator, 2026-08-10._
