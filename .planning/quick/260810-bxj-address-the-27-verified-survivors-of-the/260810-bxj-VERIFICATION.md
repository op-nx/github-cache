---
phase: 260810-bxj
verified: 2026-08-10T14:40:00Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 9/11
  scope: >-
    Delta re-check of the three gaps plus two extra items, per the coordinator.
    Deliberately NOT re-verified (proved in the first pass, untouched since except
    as described): DEC-1, the ban family, the clock pin, the knob partition's
    correctness, the mask localization, the ignores set equality, the compression
    scan, the bundle coupling, and the 1090 -> 1169 attribution.
  range_rechecked: 906a98d~1..83fd9e3
  gaps_closed:
    - "T4-7 drift guard blind to a removal from test (gap 1, fixed in 906a98d)"
    - "T4-6 docstring exception list wrong in both directions (gap 2, fixed in e4f7237)"
    - "Fifth stripper copy not routed, silently (gap 3, fixed in 2cacaf0)"
  gaps_remaining: []
  regressions: []
  extra_items_checked:
    - "Extra A: the vacuous nx.json byte gate -- now runs from the repo root, proven non-vacuous"
    - "Extra B: 83fd9e3 IN-05 portable predicate and IN-02 message -- both correct, no classification moved"
  residual_observations:
    - >-
      SUMMARY.md's D8 still reads "The docstring ... names the six exceptions".
      That is now stale: the gap-2 fix removed the enumeration from the docstring
      entirely and moved it to a derived, set-asserted constant in the spec. Not a
      code defect and not a must-have failure -- REVIEW-FIX.md carries the
      authoritative post-fix record and D11 corrects the section header. Flagged as
      a one-line editorial cleanup for the coordinator, not a gap.
gaps: []
deferred: []
---

# Quick Task 260810-bxj Verification Report

**Task Goal:** Address the 27 verified survivors of the thermos multi-agent review of PR #16
(milestone v0.0.2), while deferring 7 structural items and changing zero `nx.json` bytes.
**Original diff range:** `29c05eb..ffa6b62` (26 commits)
**Re-check range:** `906a98d~1..83fd9e3` (9 commits: 8 fixer, 1 maintainer)
**HEAD at final verification:** `83fd9e3`
**Verified:** 2026-08-10
**Status:** passed
**Re-verification:** Yes -- delta re-check after gap closure

## Verdict

All three gaps are closed and each closure is mutation-proven, not merely present. The two extra
items check out. Every one of the eleven must-have truths is now verified, and nothing I proved
in the first pass regressed. `nx.json` is still byte-identical to the original baseline across
the entire task, all six gates are green in the main tree at 1174 passed, and the new `+5` test
delta is fully attributed with no file losing a case.

## Observable Truths -- final state

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 27 enumerated items have a landed change | VERIFIED | Unchanged from the first pass; T4-7's item is now fully effective rather than half-effective. |
| 2 | Zero of the seven deferred items implemented, each recorded | VERIFIED | Unchanged. `nx.json` still byte-unchanged, so T4-7a remains unimplemented. |
| 3 | A 422 upload body with a benign entry beside a non-benign sibling is FATAL | VERIFIED | First pass; not touched by the re-check range. |
| 4 | The whole `node:process` ban family plus the widened env keys fire against the REAL root config | VERIFIED | First pass, behaviorally probed. |
| 5 | `read-back.spec.ts` passes on every calendar day | VERIFIED | First pass, mutation-proven. |
| 6 | The knob guard is a PARTITION over a DERIVED set, three modes separately attributable | VERIFIED | First pass, four mutations. Re-confirmed unaffected by the IN-05 predicate change (below). |
| 7 | No replacement guard is a byte-pin | VERIFIED | First pass. The fixer additionally de-anchored the indentation-anchored NEGATIVE assertions, which is the direction that goes vacuous rather than loud. |
| 8 | No new hand-authored count appears in any comment | **VERIFIED** (was FAILED) | The T4-6 docstring's hand-authored count and list are gone, replaced by a derived, set-asserted constant. The docstring now states why no count is spelled out. IN-02 additionally removed a hand-authored count from an operator-facing failure message, which now interpolates the programmatically-asserted constant. |
| 9 | `nx.json` byte-unchanged; the ESLint `externalDependencies` drift is closed | **VERIFIED** (was FAILED) | Union form. All four drift directions mutation-proven RED, including the two removals that were GREEN before. Correct tree GREEN. No element count. |
| 10 | Every bundled-source commit stages its regenerated bundle; `check:action` clean in the MAIN tree | VERIFIED | First pass, all three commits replayed. `check:action` green at the new HEAD. |
| 11 | No guard was relaxed, scoped down, skipped or deleted to reach green | VERIFIED | No file lost a case in the re-check either; every gap closure ADDED coverage. |

**Score:** 11/11 truths verified (was 9/11)

## Gap Closures

### Gap 1 -- T4-7 drift guard blind to a removal (`906a98d`) -- CLOSED

The subtraction form was replaced with the union form: `lint` set-equals the four ESLint
packages, and `test` set-equals that list UNION the runner, with the second expectation derived
from the first so the two cannot drift from each other. No element count on either side.

Mutation battery, run independently against the real `nx.json`, restoring and checksumming
after each:

| Mutation | Before the fix | Now |
|----------|----------------|-----|
| Correct tree | GREEN | GREEN (30 passed) |
| ESLint plugin on `lint` only | RED (2 failed) | RED (2 failed) |
| New entry on `test` only | RED (1 failed) | RED (1 failed) |
| ONE ESLint package removed from `test` | **GREEN** | **RED (1 failed)** |
| ALL FOUR removed from `test` | **GREEN** | **RED (1 failed)** |

The two removal rows are the fix, and both flipped. The addition directions did not regress.
`nx.json` byte-restored after every mutation.

Both failure messages were checked against what the assertions actually enforce. The first no
longer ends with the unsupported "A removal is the same hazard mirrored" and instead routes the
reader correctly ("a removal from `lint` reddens this same clause; a removal from `test` reddens
the one below"). The second names three directions and all three are genuinely covered. No
message claims a direction its assertion does not catch.

### Gap 2 -- T4-6 exception list wrong in both directions (`e4f7237`) -- CLOSED

The hand-authored count and list are gone from the docstring, which now says explicitly that
the set is not spelled out there and points at the derived assertion. The set is derived from
the tree per file, comment-stripped, with its own non-vacuity control.

The fixer's report of a THIRD wrong entry is correct, and it is a real catch against my own
first pass. `docs-trust.spec.ts` authors a genuine workspace-root walk whose path literal sits
on a CONTINUATION LINE. My original needle was single-line, so it returned a false zero -- the
exact line-oriented failure mode my own constraints warn about. My first-pass baseline census of
twelve files was therefore itself an undercount.

I re-derived the set with a multiline-safe search. The asserted constant matches my independent
measurement exactly: `capture-hashes-cli`, `consumer-action-runtime`, `docs-trust`,
`governance-docs`, `hash-parity/compare`, `read-integration-hash.integration`. Both of the
errors I originally found are resolved -- `docs-cross-os.spec.ts` is correctly absent (its only
occurrence is prose, and the derivation strips comments), and `lib/release-asset-name.spec.ts`
was ROUTED through `readRepoFile` rather than merely listed.

Mutation-proven both ways: dropping an entry from the list reddens, and giving a routed spec a
WRAPPED walk in code reddens naming that file -- so the derivation catches the very
continuation-line shape that defeated my search.

### Gap 3 -- fifth stripper copy not routed (`2cacaf0`) -- CLOSED

Both sites in `actions-cache-backend.spec.ts` now call the shared `stripLineComments`;
`BACKEND_COMMENT_MARKERS` is gone; no local line-leading stripper re-implementation survives
anywhere in the package. The "DUPLICATED here rather than extracted, and that is deliberate"
justification is gone, and its replacement states plainly that the old argument was about the
wrong thing and that the peer citation it rested on had been falsified by the same pass.

D11 is documented in SUMMARY.md, and the section header is corrected honestly -- it now states
that it previously said "None is silent" and that there were eleven, not ten.

The shared docstring's "five copies" framing, which I flagged as a residual, was also resolved
in the better direction: rather than restating a number, the count was deleted with the reason
given ("the first version of this docstring said five, the consolidation then turned out to have
missed one, and the number answers no reader's question").

## Extra Items

### Extra A -- the vacuous `nx.json` byte gate -- CLOSED

The gate is now wrapped in a subshell that cds to `git rev-parse --show-toplevel`, so shell
state cannot make it vacuous, and the hazard is recorded in both the task's `<done>` and the
plan's verification list. Proven non-vacuous by direct A/B from the package directory, which is
where the old form failed:

| Form | Clean tree | `nx.json` mutated |
|------|-----------|-------------------|
| New (subshell to repo root) | exit 0 | **exit 1 -- real gate** |
| Old (bare pathspec) | exit 0 | **exit 0 -- vacuous** |

### Extra B -- `83fd9e3`, judged on its own merits

**IN-05, the `portable` predicate.** The finding is real and the fix is right. Keying `portable`
to three literal target names meant a conforming future Windows sidecar consumer on another
portable target fell OUT of the partition and reddened the out-of-set clause over its own
CORRECT knob write. `portable` now derives from the single OS-sensitive target instead, which
restates the milestone's own discriminator rather than re-enumerating it.

I checked the maintainer's work rather than taking it on trust, specifically for moved
classifications, since `ci.yml` also runs `lint`, `pack:check`, `fallow:ci` and `check:action`
in other jobs. I recomputed the full 21-job census under BOTH predicates against the same real
`ci.yml` and diffed:

- **Zero partition-membership changes.** The derived set is `build-windows`, `test-windows`,
  `typecheck-windows` under both.
- Three jobs' `portable` FLAG flips (`lint`, `fallow`, `action-bundle-drift`), and all three are
  inert: none is a Windows leg, none has a sidecar, and all three carry zero knob sites, so the
  three-way conjunction excludes them and the out-of-set clause stays satisfied.
- The `integration` leg -- the mirror case, Windows plus sidecar -- correctly stays OUT under
  both, because its only target IS the OS-sensitive one.

The behavioural claim also holds. With a synthetic conforming `lint-windows` leg appended to the
real `ci.yml`, the in-set knob clause PASSES and the misleading out-of-set producer message no
longer fires; under the old three-literal predicate that same leg landed in the out-of-set
clause and drew the "it has just stopped writing" text over a correct knob write. The residual
red is the non-vacuity set-equality control, which is deliberate and whose message already tells
the author to widen the expected list in the same commit.

One methodological caveat on my own harness, stated because it affects how much weight the
counter-factual carries: when I reverted the predicate to compare, my revert mangled the `$`
anchor in the old regex, so the old form matched nothing and over-reddened the three real
consumers as well. The `lint-windows` result stands (it appears in the out-of-set clause under a
literal-name predicate, with the misleading message), and the forward direction -- the new
predicate placing it in-set with the in-set clause passing -- was verified cleanly with no
harness bug.

One forward-looking observation, not a defect: the new predicate makes `integration` portable
the moment that job runs any second target. Today it runs only `integration`, so the mirror case
holds. The old predicate had the symmetric fragility, and the new form is tied to the declared
decision rather than to a name list, so this is a note for a future reader rather than a gap.

**IN-02.** The circular operator-facing message is reworded to state the actual reason, and the
hand-authored "a floor of 2" is gone from it -- the message now interpolates
`RECORD_ONLY_SURVIVOR_SITES`, which is itself asserted programmatically via `toHaveLength`. The
surviving mentions of a floor of two are a test title describing the `ci.yml` gate's real floor
and a docstring explaining why an exact pin beats a floor for the constant three lines below it.
Neither is a count that can rot.

## Battery and Delta (re-run independently in the main tree)

| Gate | Result |
|------|--------|
| `npm run test` | exit 0 -- **1174 passed**, 44 files |
| `npm run lint` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run check:action` | exit 0, MAIN TREE |
| `npm run fallow:ci` | exit 0 |
| `nx.json` vs the original baseline | byte-unchanged across the whole task |

Test delta `1169 -> 1174`, attributed per file against my own recorded first-pass run:

| File | Before | After | Delta | Attributed to |
|------|--------|-------|-------|---------------|
| `test/repo-file.spec.ts` | 13 | 17 | +4 | two trailing-marker direction controls (WR-08) plus gap 2's derived-set clause and its non-vacuity control |
| `dogfood-cross-os.spec.ts` | 107 | 108 | +1 | WR-01's token-write under-sweep coverage |
| **Total** | **1169** | **1174** | **+5** | Fully accounted |

**No file lost a case**, 44 files in both runs. This independently reproduces the attribution
recorded in `REVIEW-FIX.md`.

The working tree matches `HEAD` exactly; every verification mutation was reverted and `nx.json`'s
checksum is unchanged.

## Residual

One editorial item, not a gap and not a must-have failure. SUMMARY.md's D8 still says the
docstring "names the six exceptions". The gap-2 fix removed that enumeration from the docstring
entirely, so the sentence describes a state that no longer exists. The code is correct and
self-documenting, the derived assertion is the enforcement, `REVIEW-FIX.md` carries the
authoritative post-fix record, and D11 corrects the section header. A one-line edit if the
coordinator wants the artifact fully consistent.

---

_Verified: 2026-08-10_
_Verifier: Claude (gsd-verifier)_
