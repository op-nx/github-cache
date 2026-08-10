# /ponytail-review PR #16 -- triage ledger

6 review agents, each `/ponytail full` then `/ponytail-review`, over 6 components of the
non-`.planning/` diff (77 files, ~24.5k insertions). 46 findings. Deduped by MECHANISM.

Scope excluded `.planning/`, `package-lock.json`, and the generated `start-cache-server/index.js`
(agent confirmed the 603-line bundle diff is vendored undici churn from a dep bump, not drift).

Triage authorities, in precedence order (inherited from `260810-kuo-TRIAGE.md`):
1. A satisfied requirement in `REQUIREMENTS.md`.
2. DEC-2 / `260810-bxj-deferred-items.md` (T4-1..T4-8) and `260810-kuo-deferred-items.md` (U1..U9).
3. A recorded in-code decision (an argued retention is not dead code).
4. `260810-bxj` precedent: no guard is weakened; a guard that reddens gets the CODE changed.
5. Top Lesson #1: local gates cannot prove GitHub Actions runtime behaviour.

**Standing hazard this pass was run against: A12.** In `260810-kuo`, an ACCEPTED item deleted an
assertion on "typecheck subsumes it" reasoning, weakened the single-choke-point guard, and had to be
reversed. Three findings in this pass had the same shape. All three were settled by MUTATION, not by
argument -- results below.

---

## MEASURED -- three contested findings settled by running the mutation

**M1. `action/index.spec.ts:610` -- verdict RIGHT, stated reason WRONG.**
Agent claimed the assertion "can never fail". Mutating `mirrorSeedHash` to identity reddens 13 tests
INCLUDING :610, so the claim is false. What is true: :607 (the whole-URL equality) does NOT redden,
because it derives its expected value from the same function under test -- the A12 shape exactly.
:610 is nonetheless redundant at SUITE level: `mirror-seed.spec.ts` catches the same mutation five
ways off hand-authored literals (`:59` x3, `:66` x3, `:82`, `:101`). ACCEPT, with the measured
rationale recorded, not the agent's.

**M2. `mirror-seed.spec.ts:33-36` -- comment measurably FALSE, guard load-bearing.**
The doc block claims "a hardcoded 0/1/2 mapping satisfies every literal in this file and fails only
there [:66]". Mutating the implementation to a hardcoded `{windows:0,macos:1,linux:2}` map passes
**22/22**. The claim is false. But a map returning identical output for every input is not an
observable mutation, so no test can catch it. `:66` uniquely catches the COMPOSITE -- hardcode PLUS
a tuple reorder: reorder to `[linux,macos,windows]` and the pinned literals at `:59` still pass
while `:66` reddens. ACTION IS THE OPPOSITE OF THE PROPOSAL: fix the prose, KEEP the test.

**M3. `compare.spec.ts:842` ("must not DECLARE `collapseToOneLine`") -- comment measurably FALSE,
clause kept anyway.**
Agent proposed deletion as subsumed by the import clause. The clause's own comment says a second
authored copy "is invisible to every other gate in the battery -- it typechecks, it lints".
MEASURED, that is false in both reachable states:
  - top-level re-declaration + import kept -> `error TS2440: Import declaration conflicts with
    local declaration of 'collapseToOneLine'`
  - function-scoped shadowing of the only use site + import kept -> `error TS6133: 'collapseToOneLine'
    is declared but its value is never read`, AND `:842` fails (the single failing test of 46)
So typecheck sees both of today's states and the clause is subsumed TODAY. It stops being subsumed
the moment a SECOND use site is added, at which point shadowing one site no longer trips TS6133 and
`:842` becomes the unique catcher. Six lines of insurance against a live future state, against the
A12 precedent for exactly this reasoning class. REJECT the deletion; CORRECT the comment.

---

## ACCEPT -- 26 survivors

Local, behaviour-preserving, no guard weakened, no requirement contradicted.

### Vacuous or self-conceded-redundant assertions (7)
| # | Site | Change |
|---|------|--------|
| P1 | `action/index.spec.ts:610` | delete (M1) |
| P2 | `lint-rules.spec.ts:899` | delete `expect(CORR_05_SITES).toEqual([])` where `CORR_05_SITES = [] as const` -- literally `expect([]).toEqual([])`; its own comment concedes it cannot catch a reintroduced violation |
| P3 | `publish-mirror.spec.ts` | delete `expect(PARTIAL_READ_MISS_WARN_RATIO).toBe(0.5)` -- the project's OWN `VERIFICATION.md` calls it "a fixture-coupling lock, not a behaviour gate" |
| P4 | `actions-cache-backend.spec.ts` | delete `expect('put' in backend)` beside `expect(isWritableBackend(backend))` -- the latter is DEFINED as the former |
| P5 | `compare.spec.ts` | delete 3 constant-pin tests restating literals from the same file -- the describe's own header condemns this and it was already fixed for `EXPECTED_TARGETS` |
| P6 | `release-asset-name.spec.ts` | delete the redundant aggregate both-true count |
| P7 | `octokit-fault-reason.spec.ts` | delete the `no timeout` test whose own comment concedes subsumption |

### Pure aliases and one-call-site indirection (4)
| # | Site | Change |
|---|------|--------|
| P8 | `compression-method.spec.ts` | delete `const strippedSourceOf = stripLineComments` (1 line) -- third of the class `260810-kuo` A11 already cut two of |
| P9 | `docs-*.spec.ts` | delete `readSource`, a pure alias for `readRepoFile` |
| P10 | `actions-cache-backend.spec.ts` | inline `widened()` -- one call site |
| P11 | `backend/types.ts` | drop `readonly` on `put?: never` -- a modifier kept alive by two lines explaining it does nothing |

### Real duplication (11)
| # | Site | Change |
|---|------|--------|
| P12 | `actions-cache-backend.spec.ts` | `nonSpecModules()` is byte-identical to `cache-key.spec.ts`'s -- move to `test/repo-file.ts`, the same shape `260810-kuo` A6 already applied to the sibling walk |
| P13 | `cleanup.ts`, `publish-mirror.ts` | `faultReason`'s `status/code/message` rendering with three `?? 'unknown'` fallbacks is authored 3x -- one `faultSuffix(error): string`. `faultReason` has ZERO branching callers (all 3 build a log string) |
| P14 | `cache-archive-path.spec.ts`, `compression-method.spec.ts` | scan-site non-vacuity control triads re-prove `stripLineComments`'s two properties once per needle (32 generated cases); `repo-file.spec.ts:45-73` already owns both under the same names |
| P15 | 3 specs | the "true leaf" import scan authored three different ways |
| P16 | `test/consumer-contract.ts` consumers | drop the literal self-checks that re-duplicate the centralized constants -- EXCEPT the env-knob one, which DOCS-10 mandates |
| P17 | `actions-cache-backend.spec.ts` | drop the third copy of the miss test; the sibling arg-array test is the real "one get closure" claim |
| P18 | `actions-cache-backend.spec.ts` | VER-04's four throw tests exercise one code path -- the writable factory IS `{...readOnlyFactory(), put}` |
| P19 | `cleanup.spec.ts` | 122-asset census fixture -> 7 rows; identical branch coverage for a stateless per-asset predicate |
| P20 | `compare.spec.ts` | drop the lazy memo (mutable module-level `let` + 12 lines of rationale) saving one 0.33 s subprocess in a suite that pays it eleven other times silently |
| P21 | `compare.spec.ts` | drop `toContain('upload')`/`toContain('download')` prose substrings -- near-vacuous yet redden on any reword; the reason-code enum is asserted separately in the same tests |
| P22 | `serve.spec.ts` + 2 siblings | `beforeAll`/`afterAll` + module-level `let restoreCwd` -> `beforeAll(() => enterWorkspaceRootCwd())`; vitest 4.1.10 confirmed installed, returned function is teardown. 8 lines -> 1, x3 files |

### Docs gate (1)
| # | Site | Change |
|---|------|--------|
| P23 | `docs-same-os-claims.spec.ts` | Row A is asserted three times over -- a table row, a bespoke comment-block parser, AND a whole-file occurrence count. The file states at `:783` that the clauses "subsume the containment" and keeps all three anyway. Keep one |

### Prose corrections -- measured-false claims (3)
This repo's discipline is to correct a measured-false claim IN PLACE, never to delete it.
| # | Site | Correction |
|---|------|--------|
| P24 | `mirror-seed.spec.ts:33-36` | M2: the hardcoded-map claim is false (22/22 pass). State what `:66` actually catches -- hardcode PLUS tuple reorder |
| P25 | `compare.spec.ts:837-841` | M3: "invisible to every other gate ... it typechecks" is false (TS2440 and TS6133). State that the clause is subsumed TODAY and becomes unique on a second use site |
| P26 | `test/repo-file.ts:52-55` | the memo's rationale claims ci.yml "is read at four sites across four files"; vitest isolates per file by default, so each spec gets its own module registry and the memo CANNOT dedupe across files. The memo still earns its keep WITHIN one file; half the stated rationale is false |

---

## REVISION AFTER RESEARCH -- 26 ACCEPT becomes 22

`260810-pvw-RESEARCH.md` re-located every P-item against the live tree and falsified three premises
of the list above. Recorded here rather than silently edited, because the original counts are facts
about what the six review agents filed.

**Cause, stated so it is not repeated:** this ledger was written from the agents' RETURNED SUMMARIES
after their detail files had been deleted from the repo root. Removing them was correct (an
untracked workspace-root artifact pegs `capture-hashes.mjs`'s `workingTreeClean` to false) but they
should have been copied out first. The ledger inherited the summaries' imprecision with nothing to
check it against.

### Four items MOVED OUT of ACCEPT

| Item | Finding | New verdict |
|---|---|---|
| **P2** `lint-rules.spec.ts:899` | The assertion's own comment states the job it does -- converting a silent zero-test cliff into a checkable fact. Deleting it removes an entire `describe` and orphans its constant | **REJECT** -- authority #3, an argued retention is not dead code |
| **P7** "no timeout" test | NOT-FOUND at the named site. The only such test in the repo carries a comment arguing its own retention -- the A12 shape verbatim | **REJECT** -- authority #3. NOT substituted for a similar-looking site |
| **P20** lazy memo | The real site is an `*.integration.spec.ts`, so the edit rotates the `integration` task hash -- the milestone's SOLE OS discriminator under D2-01, and the exact ground on which this ledger already rejected a sibling item | **DEFER -- new item N3** |
| **P23** Row A triple assertion | Sits in `docs-same-os-claims.spec.ts`, the file THIS LEDGER defers as N1 for high blast radius. Its own prose argues to keep all three, and removing the table row forces a header-arithmetic rewrite | **DEFER -- folded into N1** |

### Three premises corrected, items RETAINED with revised scope

- **P11 -- the execution note's serve() claim is FALSE.** `backend/types.ts` IS `serve()`-reachable
  (imported by `serve.ts` and `server/server.ts`, present in the generated bundle). The edit is a
  `readonly` modifier on an interface property so no emitted JS should change -- but `check:action`
  in the MAIN TREE is now a load-bearing gate for this task, not a formality. P13's three targets
  are confirmed absent from the bundle.
- **P12 -- "byte-identical" is FALSE.** The two `nonSpecModules` copies differ by a path-prefixing
  `.map()`. Extract as "one walk primitive plus a per-caller path shape" -- the same correction
  `260810-kuo` A6 recorded for the sibling walk.
- **P13 -- "authored 3x" is FALSE.** One of the three carries an extra `burnedTagMessage ??`
  fallback, so a zero-arg shared renderer covers TWO sites, not three.

### Items to gate rather than execute mechanically

- **P10** -- the single call site sits directly under a comment warning against exactly the vacuous
  inline forms this edit could produce.

**Revised in-scope set: 22 items.** P1, P3, P4, P5, P6, P8, P9, P10, P11, P12, P13, P14, P15, P16,
P17, P18, P19, P21, P22, P24, P25, P26.

---

## REJECT -- 9 (7 original + P2 + P7)

| Finding | Authority |
|---|---|
| Drop one of the two compression-method surfacing channels | **VER-05** requires it "surfaced in the publish summary"; the proposal keeps the log and cuts the summary |
| Delete the empty-run-id guard | Input validation at a TRUST BOUNDARY -- Ponytail's own stated exclusion |
| Delete `release-asset-name.integration.spec.ts` + its matrix leg | The `integration` target is this milestone's SOLE OS discriminator (D2-01); touching it has task-hash consequences |
| Collapse the byte-identical `releaseAssetName`/`cacheKeyFor` and `isCurrentAssetName`/`isServerProducedKey` pairs | Deliberately comment-locked under D2-03; the reporting agent did not recommend it either |
| Delete the burned-tag skip machinery | Implements quick `260803-fcd`'s LOUD non-fatal skip for standing exposure 1 (immutable releases vs the monthly-shard mirror) |
| Delete `compare.spec.ts:842` | **M3** -- A12 precedent; measured. Comment corrected instead (P25) |
| Collapse `hasFaultCode` into `hasOnlyFaultCode` | **DEC-1** is a stated PR #16 decision on the fail-closed upload classifier; this is a behaviour change on that path |
| Delete `T-13-02-R1`'s package-wide walk | Removes a guard, and the walk relocation is already **T4-5** |

---

## DEFER -- already recorded in the v0.0.3 lane

| Finding cluster | Existing item |
|---|---|
| Comment archaeology: `action/index.ts` (~130 lines), backends (395 of 482 added lines are comment) + 31 lines of obituaries for deleted code, `publish-mirror.ts` (787 comment / 263 code, ~400 lines), `cleanup.ts` (20 lines) | **U6** (2.2:1 ratio, ~21 comment-about-a-comment sites; maintainer call, no defect) |
| `read-back.ts` re-implements `releases-backend.ts`'s shard walk; `MAX_ASSET_PAGES` exists in one copy only | **U5** -- now flagged by **4 agents across 2 independent reviews**. Already the highest-value item in the record |
| Wilson score interval + `WILSON_Z` gating a log warning | **U2** |
| Collapse the 3 triplicated `*-windows` describes (~390 lines, `describe.each`) | **T4-3**, which names this exact collapse |
| `not-like-for-like` clause guards a state CI cannot produce (~90 lines) | Instrument provenance -- `compare.ts` is the Phase 8/11 comparator; **U8**'s reason applies |

### NEW v0.0.3 items -- recorded, NOT auto-decided (`--auto` trap quadrant)

- **N1. `docs-same-os-claims.spec.ts` prose-freeze overflow.** The file locks ~59 verbatim phrases
  where **DOCS-08 names four sites**. The overflow freezes measured run IDs, arithmetic narration and
  correction-history paragraphs against hard-wrapped YAML comments, so any rewrap reddens the build.
  HIGH blast radius (deleting the wrong half deletes DOCS-08 coverage -- `260810-kuo` already
  REJECTED one attempt at this file for that reason). Needs a deliberate owner.
- **N2. `windows-regression-detector.spec.ts` cron-minute clause.** Pins a latency preference no
  requirement rides on and freezes the schedule to daily. Minor, but it touches the XOS-05 gate that
  has NEVER EXECUTED (`workflow_dispatch` requires the file on the default branch), so there is no
  runtime evidence to check a change against. Top Lesson #1.
- **N3. The `*.integration.spec.ts` lazy memo (ex-P20).** Dropping the memo saves one 0.33 s
  subprocess, but the file feeds the `integration` target, so ANY edit to it rotates that task hash
  -- the milestone's sole OS discriminator under D2-01, and the value Phase 11's records pin. This
  is the T4-7a class of cost: semantically neutral, gating nothing, but paid in EVIDENCE PROVENANCE.
  Same ordering constraint as T4-7a -- if taken, land it EARLY in v0.0.3, before any new hash record
  is captured, and carry a provenance note for Phase 11.

---

## Note for execution

`start-cache-server/index.js` is generated. No P-item touches a `serve()`-reachable source, so no
bundle rebuild is expected -- but `check:action` MUST confirm no drift before the final commit, and
that verdict is only trustworthy in the MAIN TREE (a junctioned `node_modules` in a worktree makes
esbuild rewrite ~689 module paths with no source edit).

**Expected net: about -450 lines**, almost all spec and prose. Every large deletion is already
deferred by DEC-2, so this pass is deliberately small -- the same outcome `260810-kuo` reached.
