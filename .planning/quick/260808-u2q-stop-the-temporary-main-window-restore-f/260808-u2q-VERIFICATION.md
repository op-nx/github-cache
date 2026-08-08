---
phase: quick-260808-u2q
verified: 2026-08-08T23:05:00Z
status: human_needed
score: 4/6 must-haves verified
behavior_unverified: 2
overrides_applied: 0
behavior_unverified_items:
  - truth: "A restore force-push to main (a rewind to fe25a3f) does NOT run the publish job, so it attempts no production Release write."
    test: "During operator-plan item 3's temporary main window, perform the RESTORE force-push (rewind main back to fe25a3f) and read the resulting workflow run."
    expected: "The `publish` job shows `skipped`, and `publish-verify` shows `skipped` by cascade. No POST to /repos/op-nx/github-cache/releases appears in any leg."
    why_human: "The gate is a job-level `if:` evaluated by GitHub against a push webhook payload. The `forced` field does not exist on a workstation, so no local check can distinguish forced:true from forced:false. The spec asserts the clause as TEXT only. actionlint does not resolve locally and is CI-advisory-only in this repo."
  - truth: "A window-open push (a fast-forward from fe25a3f to the feature tip) DOES still run publish and publish-verify, so item 3's measurement is preserved."
    test: "During the same window, perform the OPEN push (`git push origin HEAD:main`, a fast-forward) and read the resulting run."
    expected: "`publish` RUNS and `publish-verify` RUNS. This is the direction the window exists to measure; if it skips, the gate is over-broad and item 3 loses its instrument."
    why_human: "Same reason. The negative direction alone is not proof -- a clause that skips everything would satisfy the restore direction and silently destroy the measurement. Only the two-direction observation discriminates."
human_verification:
  - test: "Operator-plan item 3 window, RESTORE push (rewind to fe25a3f)"
    expected: "publish SKIPPED, publish-verify SKIPPED, no production Release write attempted"
    why_human: "Requires a real push webhook; forced is server-computed and cannot be simulated locally"
  - test: "Operator-plan item 3 window, OPEN push (fast-forward to the feature tip)"
    expected: "publish RUNNING, publish-verify RUNNING"
    why_human: "Requires a real push webhook; proves the gate is not over-broad"
---

# Quick Task 260808-u2q Verification Report

**Goal:** A force-push restoring `main` after a temporary observation window must NOT fire the
production `publish` legs -- while a window-OPEN push still must. Plus a triage half: capture the
next occurrence of an unattributed test failure rather than investigate an unreproducible one.

**Verified:** 2026-08-08T23:05:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification
**Scope audited:** `71773ee..HEAD` (`0cd43b4`), independently, against the tree

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A restore force-push to `main` does NOT run `publish`, so it attempts no production Release write | WARN PRESENT_BEHAVIOR_UNVERIFIED | Clause present and exact at `ci.yml:2255`, scoped to `publish` by adjacency to `^  publish:$`. Runtime gating by GitHub is unexercised and unexercisable locally -- routed to human verification. |
| 2 | A window-open push DOES still run `publish` and `publish-verify` | WARN PRESENT_BEHAVIOR_UNVERIFIED | Static argument holds and was re-derived (see Shape Re-derivation below): fast-forward pushes yield `forced: false`. Not behaviourally exercised. |
| 3 | The forced clause is asserted by a live spec, so deleting it reddens the suite rather than passing silently | VERIFIED | `mutation.log` shows the dedicated test failing BY NAME on a genuinely mutated tree; reciprocal green run; suite currently 1059/1059 green. Detail below. |
| 4 | No job other than `publish` carries the forced clause | VERIFIED | Exactly one `if:` line file-wide carries it (`rg -c -e '^ {4}if:.*!github\.event\.forced'` -> 1, rc=0), and the full `ci.yml` diff contains exactly ONE non-comment changed line. |
| 5 | The rationale is written where an operator diagnosing a skipped publish will find it, naming all eight turns | VERIFIED | All 8 labelled claims present inside the extracted publish block, each with region count == file-wide count. Prose read in full and checked against my own measurement. |
| 6 | The next local test-battery run captures its own output | VERIFIED | `AGENTS.md:80-102`, level-1 heading, `tee` + `${PIPESTATUS[0]}` idiom, the reason, the `69bd1b7` citation, the second habit. Enforcement is by INSTRUCTION, not mechanism -- deliberate; a retry harness was explicitly locked out. |

**Score:** 4/6 truths verified (2 present, behavior-unverified)

The two unverified truths are the two directions of the same runtime behaviour. This is not a
defect in the work: the PLAN declares them unprovable locally and assigns the proof to
operator-plan item 3's window, and the SUMMARY repeats that without softening. They are recorded
here as human-verification items so the obligation survives.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | publish `if:` extended, rationale extended in the existing block | VERIFIED | 49 insertions, 1 deletion. The single non-comment change is the `if:` line. Rationale inserted inside the pre-existing publish block (region control `BOUNDED FAILURE MODE:` present). |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` | positive control tightened + one new dedicated assertion | VERIFIED | Control regex now REQUIRES `&&\s*!github\.event\.forced\s*\}\}` -- strictly stricter than the base form. New `it()` at :291-303 with its own reason literal. |
| `AGENTS.md` | capture rule, `tee` + PIPESTATUS | VERIFIED | Level-1 `# Capturing test-battery output` at :80. File convention confirmed: level 1 at :4 and :27, level 2 for subsections. Prettier-ignored (`.prettierignore:21`), so it cannot perturb `format:check`. |
| `.planning/HANDOFF.json` | item 3 detail carries the window procedure | VERIFIED | Parses. Only the `detail` string of item 3 changed. Pre-existing text (`30947535877`, `AFTER item 2`, `publish-verify`) intact; new text APPENDED. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `publish` | `publish-verify` | `needs: publish` + implicit `success()` | WIRED | `publish-verify:2475` carries `if: github.event_name == 'push'` (pre-existing, unchanged) and `needs: publish` at :2477. Its `if:` contains no status-check function, so the implicit needs-success requirement applies and a skipped `publish` cascades. It does NOT carry a duplicate forced clause -- matching the design intent and the `RESTATEMENT DECLINED:` note. |
| spec assertion | `ci.yml` publish block | `jobBlock('publish')` | WIRED | `jobBlock` (spec :62-77) strips comments, locates `^  <name>:$`, slices to the next 2-space key, and THROWS on a missing job. Genuinely localized -- the assertion cannot match another job's `if:`. |
| `ci.yml` | `test` task hash | `nx.json` `targetDefaults.test.inputs` | WIRED | `nx.json:70` -> `"{workspaceRoot}/.github/workflows/ci.yml"`. Confirmed present, so no test run in this task could be a stale replay across the edit. The SUMMARY's claim here is correct, and nothing written asserts the opposite. |
| `ci.yml` gate | operator at point of use | `HANDOFF.json` item 3 detail | WIRED | Item 3 detail points at the `WINDOW PROCEDURE:` note in `ci.yml`'s publish block and states the two directions to record. Deliberate second copy, documented as such. |

## Requested Checks (1-6)

| # | Check | Result | Command |
|---|-------|--------|---------|
| 1 | Gate expression exact, and the only `if:` carrying the forced clause | PASS | `awk '/^  publish:$/{getline; print; exit}' .github/workflows/ci.yml` -> `    if: ${{ !cancelled() && github.event_name == 'push' && !github.event.forced }}`. `rg -c -e '^ {4}if:.*!github\.event\.forced'` -> 1 (rc=0). Positive control `rg -c -e '^ {4}if:'` -> 7, so the pattern class is non-empty. The only other occurrence of `github.event.forced` in the file is the comment at :2174. |
| 2 | `publish-verify` cascades, no duplicate gate | PASS | `rg -n -e '^  [a-z][a-z0-9-]*:$' -e '^    if:' -e '^    needs:' .github/workflows/ci.yml` (rc=0). publish-verify:2475, if:2476 (`github.event_name == 'push'`, unchanged), needs:2477 (`publish`). |
| 3 | `dogfood-seed` and `consumer-smoke` UNCHANGED | PASS | `git diff 71773ee..HEAD -- .github/workflows/ci.yml \| rg -n '^[+-][^+-]'` returns exactly two lines: the removed and added `publish` `if:`. No scope breach. dogfood-seed:1947/if:1950 and consumer-smoke:2071/if:2072 are untouched. |
| 4 | Spec guard: dedicated assertion once, own reason, control TIGHTENED not loosened | PASS | Title count 1 (rc=0), reason literal count 1 (rc=0). Diff shows the control regex gained `\s*&&\s*!github\.event\.forced\s*` before `\}\}$` -- strictly narrower than the base. |
| 5 | `AGENTS.md` section at the file's own heading level, with `tee`, the reason, the `69bd1b7` citation | PASS | `rg -n -e '^#+ ' AGENTS.md` -> level-1 headings at :4, :27, :80; level-2 elsewhere. All four gated literals present (counts 1/2/1/1). |
| 6 | Scope, hygiene, `origin/main`, backup refs | PASS | 2 commits; 4 files exactly; author AND committer `larsbrinknielsen@gmail.com` on both; zero non-ASCII in messages or diff (rc=1 both); zero email-shaped tokens in content (rc=1); zero BRACKETED CI-skip tokens (rc=1); `origin/main` still `fe25a3f865...`; all five `refs/backups/*` present at `fe25a3f`. |

Note on check 6: an unbracketed scan flagged the prose "no CI run ever existed" in `0cd43b4`.
GitHub matches only the BRACKETED forms (`[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`,
`[actions skip]`) plus a `skip-checks:` trailer. A bracket-anchored re-scan is clean (rc=1), so no
push headed by these commits will be skipped. A `claude` hit in the same scan is the filename
`CLAUDE.md` inside a sentence about `@AGENTS.md`, not an attribution trailer.

## Re-derivation of the Executor's Claims

All four plan-discrepancy claims and the one incident were re-derived independently, not accepted.

### Claim A -- "22 of 22" vs 23: CONFIRMED, and the executor is right

I re-ran the measurement myself rather than reading the SUMMARY's table:

```
gh api repos/op-nx/github-cache/events --paginate \
  -q '.[] | select(.type=="PushEvent" and .payload.ref=="refs/heads/main") | .payload.before[0:7] + " -> " + .payload.head[0:7]'
```
rc=0, non-empty. TOTAL = **70**. Right side `fe25a3f`: **12**. Left side `fe25a3f`: **11**.
`e56e5d2 -> fe25a3f` (the PR #7 merge push): **1**.

So restores = 12 - 1 = **11**, opens = **11**, merge = **1**, fe25a3f era = **23**, older = **47**.
My numbers match the executor's exactly. `11 + 11 + 1 = 23`, so RESEARCH.md's "22 of 22" is
arithmetically wrong and the correction to 23 is correct.

I also verified the SHAPE classification is real, not asserted, using git ancestry:

| Push | Ancestry check | Shape |
|------|----------------|-------|
| `e56e5d2 -> fe25a3f` | e56e5d2 IS ancestor of fe25a3f | fast-forward -- publishes, correctly |
| `d043eec -> fe25a3f` | d043eec NOT ancestor of fe25a3f | rewind -- forced, skips |
| `fe25a3f -> d043eec` | fe25a3f IS ancestor of d043eec | fast-forward -- publishes |
| `ce19770 -> fe25a3f` | ce19770 NOT ancestor of fe25a3f | rewind -- forced, skips |
| `fe25a3f -> ce19770` | fe25a3f IS ancestor of ce19770 | fast-forward -- publishes |

The `23/23 separates with zero misclassification` claim in `ci.yml:2191` is sound.

**No wrong figure reached any file the executor touched:** `git diff 71773ee..HEAD | rg -n '^\+.*\b22\b'`
-> rc=1 (genuine no-match). `ci.yml:2187` carries `MEASURED PUSH SHAPES: 70 pushes to
refs/heads/main`, anchored `observed 2026-08-08 while origin/main == fe25a3f`, matching G5.

### Claim B -- pre-flight probe 2 cannot find what it describes: CONFIRMED

Run against the BASE tree so the result is not contaminated by the edit:

```
git grep -n -F -e "github.event_name == 'push'" 71773ee -- packages/github-cache/src/dogfood-cross-os.spec.ts
```
rc=0, hits at **:115 and :343 only** -- never :282. Reading `git show 71773ee:...` at :278-286
shows line 282 held `github\.event_name == 'push'` inside a regex with an ESCAPED dot, which a
`-F` literal cannot match. The claim the probe exists to establish is nonetheless TRUE: the
positive control sits at :280-284 and did pin the `if:` line. Only the probe command was wrong.

### Claim C -- prettier reformat, mutation proof re-run against committed bytes: CONFIRMED

This one mattered most, and it holds under a byte-level check rather than a timestamp argument.
`mutation.log`'s source frame quotes the failing assertion at **line 302**:

```
    301|         "publish block's comment in ci.yml; read it before changing th...
    302|     ).toMatch(/^ {4}if:.*&&\s*!github\.event\.forced\s*\}\}$/m);
```

The COMMITTED spec's line 302 is exactly that `.toMatch(...)` line, and its line 301 is the
DOUBLE-quoted fragment -- i.e. the post-prettier quoting. So the mutation log corresponds to the
final committed byte layout, not to a pre-format tree. Test totals corroborate: `red.log` 1058
tests (pre-assertion), `mutation.log` 1059, `final.log` 1059 -- the same spec file in both the
mutated and the green run.

### Claim D -- the self-inflicted incident, and whether the gate went vacuous: CONFIRMED RECOVERED

The risk named in the brief is real and I checked it directly rather than trusting the narrative.
The final `mutation.log` genuinely reflects a MUTATED tree, proven by the RECEIVED value printed
in both failures:

```
"    if: ${{ !cancelled() && github.event_name == 'push' }}
```

That is the clause REMOVED. A stale or wrong-tree log could not print it. Two independent
corroborations:

- `Failed Tests 2` / `Tests 2 failed | 1057 passed (1059)`. The tightened positive control
  CO-FAILED. That control only fails when the clause is absent from `ci.yml`, so the file was
  demonstrably mutated at run time. A green-clobbered log would show 0 failures (the incident's
  signature was `1059 passed`, rc=0) and could not show a co-failure.
- G6c discriminated for real: `rg -c -F -e '> skips publish on a FORCED push' mutation.log` -> 1
  (rc=0), and the `> ` prefix appears only on the FAIL line at :194.
- G6d discriminated for real: the same failing form is ABSENT from `final.log` (rc=1, genuine
  no-match, with a positive control on the same file returning 46 hits, so the file is readable
  and the zero is absence, not a read failure). `final.log` is `43 passed / 1059 passed`, so the
  assertion demonstrably PASSED on the correct tree.

The gate is a discriminator, not always-red and not decorative.

## Behavioural Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Suite green at the final tree | `npx nx test github-cache` | `Test Files 43 passed (43)`, `Tests 1059 passed (1059)`, rc=0 | PASS |
| Formatting clean | `npm run format:check` | rc=0 | PASS |
| Action bundle not drifted | `npm run check:action` | rc=0, `git diff --exit-code -- start-cache-server/index.js` clean | PASS |
| The forced clause is load-bearing | read `mutation.log` (not re-run) | dedicated test failed BY NAME on a mutated tree; absent from the green log | PASS |
| Runtime gating by GitHub | -- | no local mechanism exists; webhook payload absent | SKIP -> human (items above) |

The `nx test` run was a 1/1 cache hit. That is legitimate rather than a stale replay: `ci.yml` is
a declared `test` input at `nx.json:70`, so the cached entry belongs to the current tree state and
could not have been computed before the edit.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| -- | -- | none | -- | Added lines scanned for `TBD\|FIXME\|XXX` (rc=1) and `TODO\|HACK\|PLACEHOLDER` (rc=1), each with a positive control proving the regex matches when the marker is present. |

## What Must NOT Be Claimed -- checked

The SUMMARY does NOT overclaim. The only occurrence of the forbidden terms is their negation, at
line 72: *"It is not proven, not verified in CI, and not confirmed working."* It names the future
window run as the first two-direction proof (lines 65-72), reproduces the plan's
`WHAT THIS DOES NOT PROVE` framing verbatim, and records that `actionlint` does not resolve
locally. The commit message of `92998de` carries the same disclaimer. No finding.

## Observations (not gaps)

1. **`RESEARCH.md` still carries the wrong "22" figure in four places** (:21, :102, :164, :341),
   now contradicted by `ci.yml:2191`'s corrected 23. This is a plan-time artifact committed at
   `71773ee`, OUTSIDE the executor's four-file scope, and the executor documented the discrepancy
   rather than propagating it. Flagged only because it is a tracked, durable record that a future
   reader may cite against the committed comment. No action required of this task.

2. **The `RESTATEMENT DECLINED:` note cites run 30825636788 where publish FAILED and
   publish-verify showed `skipped`.** That is evidence for the FAILED-dependency cascade; the gate
   now relies on the SKIPPED-dependency cascade. Both hold under GitHub's default needs semantics
   given publish-verify's `if:` carries no status-check function, but the observed evidence is for
   the adjacent case. Item 3's window covers this directly (it must show publish-verify SKIPPED,
   not merely publish skipped), and the human-verification items above are worded to capture it.

## Gaps Summary

No gaps. Every artifact exists, is substantive, is wired, and every static claim I could
re-derive independently held -- including the three the brief flagged as most likely to be
soft (the arithmetic correction, the post-format mutation evidence, and the green-clobbered log).

The phase goal is achieved to the limit that a workstation can establish it. What remains is not
missing work but missing OBSERVATION: the two runtime directions of the gate. Those are assigned
to operator-plan item 3, which is the next thing to run, and which must record BOTH directions --
the restore push showing publish and publish-verify SKIPPED, and the open push showing them
RUNNING. Recording only the restore direction would leave an over-broad gate undetected.

---

_Verified: 2026-08-08T23:05:00Z_
_Verifier: Claude (gsd-verifier), independent fresh-context audit_
