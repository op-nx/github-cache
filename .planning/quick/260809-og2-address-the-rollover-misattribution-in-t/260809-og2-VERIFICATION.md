---
phase: quick-260809-og2
verified: 2026-08-09T19:00:00Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260809-og2: The rollover misattribution in the publish mirror warning -- Verification Report

**Task goal:** Stop both `publish-mirror.ts` read-miss warnings asserting a closed set of causes,
add a consumer-general version-skew cause to both, and a month-shard-rollover cause to the PARTIAL
branch only -- so the warning no longer fires naming a cause that did not occur while never naming
the one that did.
**Verified:** 2026-08-09
**Status:** passed
**Method:** Independent re-derivation from source, plus reproduced mutation testing (RED then
restore-to-GREEN) on the two claims the SUMMARY leans on hardest (BL-01's guard, and both halves
of the asymmetry pin). Not a re-reading of the SUMMARY's narrative.

## Goal Achievement

### Observable Truths (from PLAN.md frontmatter `must_haves.truths`)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Neither message asserts a closed enumeration; both state the list is not exhaustive | VERIFIED | Both `core.warning` bodies at `publish-mirror.ts:811`, `:940` read `'worth checking, and this list is not exhaustive: (1) ...'`. Reproduced RED: deleting the clause from both bodies drops exactly 2 of 1079 tests, one per fixture, both failing on the `this list is not exhaustive` needle (transcript below). Restored and re-confirmed green (1079/1079). |
| 2 | Both messages name a consumer-general artifact version skew, naming no artifact of this repo | VERIFIED | Both bodies carry `'the sidecar that wrote these entries and this publish step running at different versions of this action, so two cache versions exist in one repository'` (`:813-814`, `:942-943`). No repo artifact name in either message string (checked below). |
| 3 | The partial branch additionally names the month-shard rollover cause | VERIFIED | `publish-mirror.ts:945`: `'(4) the first publish run against a new month shard, ...'`. Note: the PLAN's own truth text called this "a one-time expected rise", which is RESEARCH's original (and, per REVIEW's WR-03, factually wrong) wording -- an entry that misses can never re-enter the shard, so the elevated rate persists for the rest of the month, not a one-time spike. The executor corrected this per REVIEW and the message now reads "...become visible at once and stay counted until they evict," which is the accurate statement of the same underlying claim (the rollover cause is named on the partial branch). This is a correctly-applied fix to a flawed sub-clause inherited from RESEARCH, not a deviation from the goal. |
| 4 | The total gate does NOT gain the rollover cause; nothing claims this repo's bundle drift can trip it | VERIFIED | `publish-mirror.ts:804-819` (the total-gate message) has no rollover mention. Reproduced RED: injecting `'and the first publish run against a new month shard'` into the total-gate message reddens exactly the total-gate fixture's negative pin. No claim in either emitted message that this repo's bundle drift trips the total gate (blocklist item 4, checked below). |
| 5 | A guard fails if the closed-enumeration phrase returns, asserted via `publishMirror` over `mock.calls.flat()`, never a file read | VERIFIED | `spec.ts:1470-1472` and `:1602-1604`: `expect(recorded).not.toContainEqual(expect.stringMatching(/Two candidate cause[s]/))` where `recorded = vi.mocked(core.warning).mock.calls.flat()`. No `readFileSync` assertion anywhere in the spec. |
| 6 | A guard fails if either message loses the skew cause | VERIFIED | `spec.ts:1475` (partial) and `:1593` (total): `expect(warned).toContain('different versions of this action')`. |
| 7 | Asymmetry enforced from both sides, not narrated | VERIFIED | Reproduced RED independently on both halves (see BL-01/asymmetry section below): removing the rollover clause from the partial message reddens the positive pin (`spec.ts:1480`); injecting it into the total-gate message reddens the negative pin (`spec.ts:1614-1616`). Both are runtime assertions through `publishMirror`, not comments. |
| 8 | `docs/advanced.md` no longer asserts a cardinality the messages don't carry | VERIFIED | `docs/advanced.md:98` now reads "...and the causes worth checking." (was "...and two candidate causes."). `:105` now reads "...the same causes worth checking, apart from the month-shard one. That cause cannot apply here..." (was "...the same two causes worth checking."), which additionally corrects a further false-identity claim REVIEW caught (WR-02) after the initial two-word edit. |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/github-cache/src/publish/publish-mirror.ts` | Both `core.warning` bodies + comments above them corrected | VERIFIED | Read in full at `:600-950`; both messages and the three comments REVIEW flagged (BL-02, WR-03, IN-04) are corrected in the final state. |
| `packages/github-cache/src/publish/publish-mirror.spec.ts` | Absence + presence pins on BOTH branch fixtures | VERIFIED | Both `runWithMisses(10, 9)` case (`:1441-1483`) and the total-gate case (`:1563-1622`) carry the full pin set: retraction presence, closed-enumeration absence, skew presence, rollover presence/absence (asymmetric), and `FORBIDDEN_ARTIFACTS` absence. |
| `docs/advanced.md` | Two cardinality sites edited | VERIFIED | `:98`, `:105` per truth #8 above. Diff is scoped to exactly those two sentences; no new section added. |
| `packages/github-cache/src/docs-same-os-claims.spec.ts` | OBS-04 row docstring records why the cardinality left | VERIFIED | Docstring extension at `:139-160` (net diff `ded3ddf..HEAD`) describes the change BY CONCEPT (no verbatim retired phrase), records the count is deliberately not re-pinned, and does not add a new row or `required` entry. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Absence assertion | BOTH fixtures | `runWithMisses(10,9)` and the all-MISS fixture | VERIFIED | `/Two candidate cause[s]/` pinned in both cases (`:1470-1472`, `:1602-1604`). |
| Docs cardinality sentences | OBS-04 guard row | Same-commit discipline | VERIFIED | `docs-same-os-claims.spec.ts` docstring extended in the same net diff as the docs edit; no row added. |
| OBS-04 required/forbidden phrases | Post-edit `docs/advanced.md` | `npx nx test github-cache` | VERIFIED | Full suite green at HEAD (1079/1079), which includes `docs-same-os-claims.spec.ts`'s assertions on these exact phrases. |

### Behavioral Spot-Checks (reproduced independently, not taken from SUMMARY)

| Behavior | Command | Result | Status |
|---|---|---|---|
| Baseline green at HEAD | `npx nx test github-cache --skip-nx-cache --output-style=stream` | 43 files, 1079 tests, exit 0 | PASS |
| BL-01 RED reproduction: delete `'and this list is not exhaustive'` from both message bodies | same test command | exit 1; exactly 2 of 1079 failed, one per fixture, both on the `this list is not exhaustive` needle | PASS (matches SUMMARY's claimed transcript verbatim) |
| Restore + re-confirm green | `git checkout --` then re-run | tree clean, exit 0, 1079/1079 | PASS |
| Asymmetry positive-half RED: delete the rollover clause `(4) ...` from the partial message only | same test command | exit 1; exactly 1 of 1079 failed (`warns ONCE just ABOVE the target rate`) | PASS |
| Restore + asymmetry negative-half RED: inject `', and the first publish run against a new month shard'` into the total-gate message | same test command | exit 1; exactly 1 of 1079 failed (`fires the TOTAL-case branch...`) | PASS |
| Restore + final green re-confirm | `git checkout --` then re-run | tree clean, exit 0, 1079/1079 | PASS |
| Typecheck | `npx nx run github-cache:typecheck` | exit 0 | PASS |
| Lint | `npx nx run github-cache:lint` | exit 0 | PASS |
| Bundle drift check | `npm run check:action` (builds + `git diff --exit-code -- start-cache-server/index.js`) | exit 0, no drift | PASS |
| `candidate causes` gate | `rg -c -F 'candidate causes' publish-mirror.ts` | exit 1 (was 3 pre-change) | PASS |
| Positive control | `rg -c -F 'restored as a MISS'` / `'not exhaustive'` | 3, exit 0 each | PASS |

### RESEARCH's 9-item MUST NOT blocklist (checked individually)

| # | Claim forbidden | Command | Result | Verdict |
|---|---|---|---|---|
| 1 | "Bundle drift is unreachable for consumers" restated | Manual read of both message bodies | Not present -- messages state the consumer-general skew form instead | ABSENT |
| 2 | "`!dist/action` keeps the publish engine out of the package" | Manual read | Not present | ABSENT |
| 3 | `action-bundle drift`, `start-cache-server/index.js`, `dist/action/index.js`, `.planning/` -- in either MESSAGE | `git grep -n -F <term> -- publish-mirror.ts` per term | All 4 occurrences found are on comment lines only (`:884`, `:885`, `:796`); `dist/action/index.js` has 0 occurrences anywhere in the file (exit 1) | ABSENT from messages (comments permitted and used) |
| 4 | Any claim total gate fires under THIS repo's bundle drift | Manual read of total-gate branch comments (`:862-871`) | States the opposite: "A cache-VERSION rotation therefore leaves `mirrored >= 1` and the gate above SILENT" | ABSENT |
| 5 | "enumeration is now complete", restored cardinality | `git grep -n -i -F 'candidate cause'` -> exit 1; `git grep -n -i -E 'three.{0,10}caus|enumeration is now complete|is exhaustive'` -> exit 1 | Both zero-hit, exit-code confirmed (not a tooling false-zero) | ABSENT |
| 6 | Ordinary eviction or branch/ref scoping as causes | Manual read of both messages | Neither present | ABSENT |
| 7 | Any figure not carrying run id `31305961054` | Manual read; `${percent}%` in the partial message is runtime-computed, not a hardcoded baseline figure | The hardcoded baseline figures (43/112, 38.4%, 0.299) are all in comments and all carry the run id | ABSENT from messages |
| 8 | "Silent mid-month" as a guarantee | Manual read of comments (`:632-634`) | States the opposite caveat ("Measured on run 31281406708 the reclassification is currently nil...") | Not claimed as guarantee |
| 9 | That `260809-2s6` deliberately dropped the cohort cause | Manual read (`:926-929`) | "That commit removed a sentence... and the cohort went with it. Read that as what the diff shows -- the commit message never mentions dropping a cause, so intent is not established either way." | Correctly stated as collateral, not intent |

All 9 items independently confirmed absent from the emitted warning MESSAGES; where the underlying artifact/run-id content is named at all, it is confined to source comments, which RESEARCH and the plan both explicitly permit.

### Hard Constraints

| Constraint | Check | Result |
|---|---|---|
| `.planning/REQUIREMENTS.md` untouched | `git diff ded3ddf..HEAD -- .planning/REQUIREMENTS.md` | Empty diff |
| Exactly 4 files changed | `git diff --name-only ded3ddf..HEAD` | `docs/advanced.md`, `docs-same-os-claims.spec.ts`, `publish-mirror.spec.ts`, `publish-mirror.ts` -- exactly the plan's `files_modified` |
| No red signal added; `setFailed` untouched | `git diff ded3ddf..HEAD -- publish-mirror.ts \| rg setFailed` | No diff lines touch `setFailed` |
| ASCII-only, no emoji | Per-file non-ASCII char scan (charCode > 126) on all 4 changed files | All 4 report `ascii-clean` |
| No AI-attribution trailer | `git log ded3ddf..HEAD --format='%B' \| rg -i 'co-authored-by\|generated with\|claude'` | exit 1 (no match) |

### Two High findings (BL-01, BL-02) -- reproduced, not re-narrated

**BL-01 (guard for the headline claim had no committed pin):** Reproduced independently. Deleting
`and this list is not exhaustive` from both message bodies, then running
`npx nx test github-cache --skip-nx-cache --output-style=stream`, exits 1 with exactly 2 of 1079
failing -- `warns ONCE just ABOVE the target rate` and `fires the TOTAL-case branch, not the partial
one` -- both failing on `expect(warned).toContain('this list is not exhaustive')`, printing the full
current message body (which now lacks the retraction) as the received value. This is exactly the
SUMMARY's claimed transcript. File restored via `git checkout --` and suite re-confirmed green
(1079/1079).

**BL-02 (comment described a condition routing to the sibling branch):** The corrected text at
`publish-mirror.ts:873-888` now says "every entry written by the OTHER artifact misses" (not "every
enumerated entry misses"), and explicitly notes "A skew under which EVERY enumerated entry missed
would reach the gate above instead, and this `else if` would be unreachable." This is the corrected,
self-consistent statement -- it no longer contradicts the neighboring rotation-signal paragraph.

### Medium and Low findings

| ID | Verdict (independently checked) |
|---|---|
| WR-01 | Fixed. The false premise ("`mirrored === 0`, so the shard never resolves") is corrected to the true one ("`readMisses === hashes.length`: every hash took the miss branch, so none reached the lazy shard resolve") at `spec.ts:1605-1613`. Confirmed the source comment at `publish-mirror.ts:623-630` already states the correct premise and was not touched -- the executor's claim that it corrected one site and the source was already right is accurate. |
| WR-02 | Fixed, with a further correction beyond the plan's literal two-word instruction: `docs/advanced.md:105` now states the difference ("apart from the month-shard one... nothing restored on such a run, so no month shard was ever opened") rather than a bare "same" claim. |
| WR-03 | Fixed. "a one-time rise" replaced with "become visible at once and stay counted until they evict" -- matches the code's actual behavior (an entry that misses can never re-enter the shard, so the elevated rate persists for the rest of the month). Pinned needle `the first publish run against a new month shard` survives unchanged. |
| WR-04 | Fixed. The OBS-04 docstring describes the retired phrases BY CONCEPT ("Both sentences counted the causes -- one in the partial paragraph, one in the all-MISS paragraph") rather than quoting them verbatim. `git grep -i 'candidate cause'` now returns only the two live regex patterns in the spec, not the docstring. |
| IN-01 | Fixed with one sub-item reasonably declined and honestly recorded. `FORBIDDEN_ARTIFACTS` hoisted to a module-level constant, referenced from both fixtures (confirmed live at `spec.ts:1518` and `:1620` -- not dead code). Run-id coverage (blocklist item 7) declined with the stated reason ("a digit-shaped needle would match the entry counts the messages legitimately carry") recorded in the constant's docstring. This is a defensible technical judgment: the messages legitimately carry digit sequences (counts, percentages) that a naive numeric-pattern gate would false-positive on. |
| IN-02 | Fixed. Docstring no longer claims "no count at all" -- corrected to "What left the messages is the COMPLETENESS CLAIM, not the enumeration; they still number their causes." |
| IN-03 | Fixed. The retitled case (`spec.ts:1254`) now pins the skew cause its new title names (`:1292-1294`). |
| IN-04 | Fixed. "which computes two cache versions" (ambiguous antecedent) replaced with "so two cache versions exist in one repository" in both messages. Confirmed `git grep -n -F 'which computes'` returns exit 1 (fully gone). |

### Guard non-vacuity (independently reproduced, per instruction item 7)

- **Negated-quantifier convention held.** All newly added negative assertions use
  `vi.mocked(core.warning).mock.calls.flat()` + `.not.toContainEqual(expect.stringMatching(...))`.
  The one pre-existing `.not.toHaveBeenCalledWith(...)` in the file (`spec.ts:1249`) is untouched by
  this change's diff (predates it, outside the diff hunks) and is not one of the new assertions this
  task added.
- **Asymmetry pins, both halves, independently reproduced as RED** (see Behavioral Spot-Checks table
  above) -- not merely re-derived from the code, but mutation-tested against the actual test suite.
- **`FORBIDDEN_ARTIFACTS` is declared once and referenced live from both fixtures** -- confirmed via
  `git grep`, both reference sites are inside active `expect(...)` calls, not dead code or comments.

## Gaps Summary

None found. Every must-have truth, artifact, and key link in the PLAN frontmatter is verified against
the actual codebase, not just the SUMMARY's account of it. Both High findings from REVIEW.md are
genuinely closed (reproduced, not re-read). All 8 Medium/Low findings are fixed in source, with one
sub-item of IN-01 reasonably declined and honestly recorded rather than silently dropped. All 9 items
of RESEARCH's blocklist are independently confirmed absent from the emitted warning messages. Hard
constraints (REQUIREMENTS.md untouched, exactly 4 files changed, ASCII-clean, no AI attribution, no
new red signal) all hold. The one place PLAN.md's own must-have text turned out to be imprecise (the
"one-time rise" framing of the rollover cause, truth #3) was a flaw inherited from RESEARCH's initial
wording that REVIEW caught and the executor correctly fixed -- the underlying goal (name the rollover
cause on the partial branch alone) is fully achieved by the corrected wording.

---

_Verified: 2026-08-09_
_Verifier: Claude (gsd-verifier)_
