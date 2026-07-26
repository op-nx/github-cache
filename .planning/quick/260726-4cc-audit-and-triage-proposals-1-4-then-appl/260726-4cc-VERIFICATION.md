---
context: quick
quick_id: 260726-4cc
slug: audit-and-triage-proposals-1-4-then-appl
verified: 2026-07-26
verifier: independent audit (fresh context)
base: b32b5c8
head: cf91b42
branch: gsd/debug-windows-publish-one-asset
status: passed
blocking_gaps: 0
advisory_findings: 3
---

# Quick Task 260726-4cc: Apply Proposals 1-4 - Independent Verification

**Status: `passed`.** All eight plan `must_haves` truths MET, all seven `artifacts` MET. No blocking
gap. Three advisory findings, all cosmetic or reporting-accuracy; none weakens an invariant, none
requires a follow-up commit on this branch.

Every load-bearing fact below was re-derived from the repository. Where the executor's SUMMARY
asserts a measurement, I re-ran it rather than reading the claim. In two places I found the SUMMARY
**under**-reported (both in its own disfavour) and in one place it presents a replayed nx cache
result as a fresh run; details in "What the SUMMARY over- or under-reported".

---

## Verdicts on the five items flagged for specific judgement

### 1. BISECT-SAFETY -- CONFIRMED (checked wider than asked)

I checked out every commit detached and ran with `--skip-nx-cache`, capturing exact counts:

| commit | `nx test github-cache --skip-nx-cache` | `npm run typecheck -- --skip-nx-cache` |
|---|---|---|
| `b32b5c8` (base) | 30 files, **430 passed (430)** | exit 0 |
| `0b05d1e` | 30 files, **431 passed (431)** | exit 0 |
| `55dfb87` | 30 files, **433 passed (433)** | exit 0 |
| `98c13b9` | 30 files, **433 passed (433)** | exit 0 |
| `cf91b42` | 30 files, **433 passed (433)** | exit 0 |

Matches the SUMMARY's per-commit table exactly, including the 430 -> 431 -> 433 progression.

On the two SOURCE commits I additionally ran five more of the eight battery commands from scratch:

| command | `0b05d1e` | `55dfb87` |
|---|---|---|
| `npm run format:check` | exit 0 | exit 0 |
| `npm run build` | exit 0 | exit 0 |
| `npm run typecheck:action` | exit 0 | exit 0 |
| `npm run fallow:ci` | exit 0 | exit 0 |
| `npm run pack:check` | exit 0 | exit 0 |

That is **7 of 8** battery commands independently green at both source commits. The eighth,
`check:action`, is tree-mutating (it regenerates `start-cache-server/index.js`), so I proved it
structurally instead of running it -- which is a stronger argument than a single green run:

- `git diff --name-only b32b5c8..cf91b42` lists exactly six files; `start-cache-server/index.js` is
  NOT among them, and neither is anything under `start-cache-server/`.
- `rg -c -F "server-produced cache" start-cache-server/index.js` and
  `rg -c -F "restore-MISS" start-cache-server/index.js` both return no match -- the committed bundle
  contains no `publish-mirror` marker, so `publish/publish-mirror.ts` and `action/index.ts` are
  genuinely unreachable from the `entry.ts` -> `serve()` bundle graph.

Therefore no commit in this range can drift the action bundle, and `check:action`'s pass is
guaranteed at every commit rather than merely observed. The plan's prediction (and the
`action-bundle-inlines-serve-deps` hazard) is satisfied.

Branch restored to `gsd/debug-windows-publish-one-asset` at `cf91b42` after every run; working tree
clean apart from the intentionally-uncommitted `260726-4cc-SUMMARY.md` and this file.

**Additionally re-confirmed at HEAD** after all my transient checkouts: 433/433, and
`typecheck` / `format:check` / `typecheck:action` / `fallow:ci` / `pack:check` all exit 0.

### 2. DEVIATION D4 (the out-of-scope `PITFALLS.md:208` edit) -- CORRECT, minimal, weakened nothing

Two plan clauses genuinely conflict: Task 4's scope says "all inside `### Pitfall 7`", while its own
`verify` demands `git grep -n "uploadHash" -- .planning/research/PITFALLS.md packages/` return
nothing. Pitfall 9's eviction bullet named the same dead symbol, so a Pitfall-7-only edit could not
satisfy the outcome check.

**Resolving toward the outcome check was correct.** The scope clause is a description of where the
plan's author expected the symbol to be; the verify clause is the plan's statement of *intent*
("this pitfall's job is to not point the next reader at a dead symbol"). Leaving one dead
`uploadHash` citation in the same document while removing the other would have shipped exactly the
staleness this task exists to remove, and the next reader grepping the symbol would land on the
surviving one. The outcome check is the load-bearing clause.

**The edit is genuinely minimal.** The whole change to that bullet, verified from
`git show cf91b42`:

- removed: `` (`uploadHash`'s no-hit `return` silently skips it) ``
- added: `` (the engine's `restored.kind === 'miss'` skip branch in `publish/publish-mirror.ts` silently skips it) ``

Nothing else on the line changed. File + branch predicate, no line range -- same citation style as
the Pitfall 7 edit, so it cannot go stale when the branch moves again.

**Pitfall 9's verdict still stands.** Line 208 still ends `Accepted -- mirror is best-effort.`
verbatim, and the bullet's LRU / 10 GB cap / 7-day-disuse mechanism sentences are untouched. The
following bullet ("Mid-session mirror staleness") and the closing "Both are fine *as extra MISSes*"
framing are unchanged. Nothing weakened.

`git grep -n "uploadHash"` over the whole repo now returns hits ONLY in planning artifacts
(`HANDOFF.json`, the debug report, this task's CONTEXT / PLAN / RESEARCH / `.continue-here.md`) --
i.e. records that the symbol WAS removed. Zero hits in `PITFALLS.md` or `packages/`, which is the
plan's actual scope. MET.

### 3. DEVIATION D3 (the `docs/advanced.md` rewrap) -- CONFIRMED reflow-only, proved harder than asked

`git show 98c13b9 --word-diff=porcelain -- docs/advanced.md` shows **no `-` token anywhere** -- only
the added sentences. But a word-diff alone leaves room for doubt about how git normalized the moved
newlines, so I proved it independently and more strictly: collapse ALL whitespace runs in the entire
file at `98c13b9^` and at `98c13b9`, then locate the longest common prefix and suffix.

Result -- over the **whole file**, not just the bullet:

```
normalized length before: 7429
normalized length after : 7772
REMOVED (normalized): ""            <- nothing removed, anywhere in the file
INSERTED (normalized): "Restore is same-OS -- an entry saved on one runner OS cannot be
  restored on another -- so each leg can only mirror the tasks that actually **ran** on
  that OS. An asymmetry between the legs' mirrored task-hash asset counts is therefore
  the expected shape, not a bug; the per-leg totals also include seed assets, which do
  not follow that split. "
prefix ends with: "...can restore, and uploads them to the current month's `cache-mirror-YYYYMM` Release. "
suffix begins with: "It is gated by a **separate** sync allowlist (`isSyncTrusted`: `push` / ..."
```

This is decisive on three points at once:

- **The executor's claim is exactly true**: not one word of pre-existing prose was altered; only line
  breaks moved. `removed == ""` over the normalized whole file.
- **No other bullet or section changed.** A single contiguous insertion in the whole-file normalized
  stream means every other byte of the document is word-for-word identical. This is stronger than
  "no other bullet changed" -- it is "nothing else in the file changed".
- **The placement is exactly what the plan specified**: immediately after
  "...`cache-mirror-YYYYMM` Release." and before "It is gated by a **separate** sync allowlist".

Supporting: `git show 98c13b9 --numstat` = `16 11 docs/advanced.md`, matching D3's stated
16 insertions / 11 deletions, and `git show 98c13b9 -U0` yields exactly **one** hunk.

The inserted text is word-identical to the plan's authored wording. It carries no count and no run
id (verified from the extracted insertion above). I also checked the substantive claim against the
debug report rather than taking it on trust: the seed assets are per-run-id and each leg produces
its own (`30181729913-linux` and `30181729913-windows`, debug report E-section), so they are 1-to-1
symmetric while task-hash assets are asymmetric -- the sentence "the per-leg totals also include
seed assets, which do not follow that split" is accurate, and it does NOT make the forbidden claim
that a leg's mirrored count equals its cacheable-task count.

### 4. Task 4 weakened NOTHING -- CONFIRMED

`git show cf91b42` touches `.planning/research/PITFALLS.md` only, in **three** hunks
(`159-160`, `172`, `208`), 4 insertions / 4 deletions. I read the surrounding region directly:

| must survive | state |
|---|---|
| `MUST-NOT-REOPEN` heading (`:153`) | unchanged, outside every hunk |
| Item 1, CRLF hash divergence (`:158`) | unchanged, a context line in hunk 1 |
| Item 3's `Fix:` per-OS matrix statement (`:160`) | present verbatim: ``Fix: `publish-mirror` is a **per-OS matrix** (`ubuntu-24.04-arm` + `windows-11-arm`); each leg mirrors only its own OS's entries.`` |
| "All three failure modes are silent" framing (`:163`) | unchanged, context line |
| **How to avoid** block (`:165-168`), every sentence | unchanged -- lines 164-168 fall between hunk 1 (ends 163) and hunk 2 (starts 169), so they are not in the diff at all. `.gitattributes` (`eol=lf`), `cacheArchivePath()` as sole path source, and the per-OS publish-mirror matrix all still named as **load-bearing, comment-locked**; the `test:act` canary sentence and the matrix-simplification guard bullet both intact |
| First warning-sign bullet (`:171`) | unchanged, context line |
| Line ~361 carry-forward mention | unchanged -- still reads "Pitfall 7's cross-OS `@actions/cache` version hashing incl. zstd-vs-gzip ... `enableCrossOsArchive` does NOT rescue a compression-method mismatch (actions/cache#1622)". Correctly left alone per the plan |

**The critical check -- the corrected zstd clause must not read as "cross-OS is fine now."** It does
not. `PITFALLS.md:159` now says, in one sentence, both halves:

> ...compression is no longer what distinguishes the two legs' version hashes -- but the version is
> still OS-distinct through the OS temp path inside the literal archive path and the windows-only
> salt, **so a cross-OS restore still MISSes.**

The MISS conclusion is stated outright, in the same sentence as the correction, so a skimming reader
cannot pick up the correction without the conclusion. It also adds a forward-looking warning ("A
future runner-image change to either leg's compression method would silently invalidate that leg's
existing entries again"), which makes the item *stronger* than before, not weaker. The generalized
warning sign (`:172`) keeps the useful guidance verbatim: "transient, self-heals; know the symptom so
it is not misdiagnosed as a regression".

No line number appears anywhere in the new prose (both citations use file + branch predicate).

### 5. `readMisses`-as-subset semantics hold in code -- CONFIRMED, and I extended the check

Read from `packages/github-cache/src/publish/publish-mirror.ts` at HEAD:

- **The miss branch increments BOTH** (`:218-223`): `if (restored.kind === 'miss') { skipped++;
  readMisses++; continue; }`. `readMisses` is incremented nowhere else in the file. Strict subset by
  construction.
- **The summary row sits immediately after `skipped`** (`action/index.ts:162-168`): the five rows are
  `scanned`, `mirrored`, `skipped`, `restore-MISS (of skipped)`, `failed`, in that order.
- **`mirrored + skipped + failed === scanned`** holds exactly. I enumerated every exit path of the
  `for (const hash of hashes)` loop; each iteration increments exactly one of the three, then either
  `continue`s or ends:

  | path | increments |
  |---|---|
  | `restored.kind === 'miss'` (`:218`) | `skipped` (+ `readMisses`) |
  | over `RELEASE_ASSET_MAX_BYTES` (`:236`) | `failed` |
  | at the 1000-asset cap (`:251`) | `skipped` |
  | name already present (`:262`) | `skipped` |
  | upload succeeds (`:269-271`) | `mirrored` |
  | upload 422 (`:273`) | `skipped` |
  | upload other fault (`:285`) | `failed` |

  No path increments two of the three, and no path falls through without incrementing one. With
  `return { scanned: hashes.length, ... }` (`:319`), the identity is exact for any returned result.
  `readMisses` is never an addend.

- **The `action/index.spec.ts` fixture is self-consistent** (`:104-110`): `scanned: 25, mirrored: 2,
  skipped: 23, readMisses: 12, failed: 0`. `2 + 23 + 0 = 25` closes, and `12 <= 23` puts the misses
  inside `skipped`. Its comment states both properties. I also checked all nine other fixtures in
  `publish-mirror.spec.ts` close the same way: `1+0+0=1`, `0+1+0=1` (x4), `1+0+1=2`, `1+0+0=1`,
  `0+1+0=1`, and the dedup spec's `1+0+0=1`. Every one closes; `readMisses <= skipped` in all.

**Beyond the ask -- I checked whether the dedup changes ANY gate, not just the all-miss one.** The
plan and research only prove the all-miss predicate invariant. Two others exist in the function:

- `mirrored` is dedup-invariant: pre-dedup, a duplicate's second iteration always hits the
  already-present branch (`shard.names.add(name)` ran on the first), so it never double-counted
  `mirrored`. Research asserts this; the code confirms it.
- `failed > 0` -> `core.setFailed` (`:315`) is also multiplicity-invariant: a duplicate oversized or
  faulting hash contributed `m_h` to `failed` before and `1` after, and since `m_h >= 1`, `failed > 0`
  is unchanged in both directions. The absolute count can decrease, which is a strict improvement.

So no gate in the function changes meaning under the dedup -- a slightly broader result than the
must_have required. `Hash` is `string & { readonly __hash: unique symbol }`
(`lib/cache-key.ts:30`), a branded **string**, so `new Set(...)` deduplicates by value correctly;
had it been an object type the dedup would have been a silent no-op. Verified.

---

## Plan `must_haves` -- per-item verdict

### truths

| # | truth | verdict | evidence I derived |
|---|---|---|---|
| 1 | `readMisses` is a strict SUBSET of `skipped`; label carries the relation | **MET** | Item 5 above. Miss branch `:219-220` increments both; `readMisses` incremented nowhere else; row order `skipped` then `restore-MISS (of skipped)`; both the interface doc comment (`publish-mirror.ts:78-85`) and the call-site comment (`action/index.ts:155-162`) state it |
| 2 | P1 lands FIRST, P2 SECOND; `scanned` exists and is tested before its denominator moves | **MET** | `git log b32b5c8..HEAD` = `0b05d1e` (scanned/readMisses) then `55dfb87` (dedup). At `0b05d1e`, 9 `scanned` assertions exist and pass (431/431 verified fresh) with `scanned = hashes.length` still meaning rows; `55dfb87` then moves the denominator with the doc comment updated in the same commit |
| 3 | The all-miss gate predicate stays BYTE-IDENTICAL | **MET** | Verified at **all five** commits, not just base vs HEAD. Every one yields the identical text `if (hashes.length > 0 && readMisses === hashes.length && mirrored === 0) {`; shell string comparison of the extracted base and HEAD lines returned equal. Only the line number moved (264 -> 300). The gate's *comment* gained one clause (`:297-299`) recording that "entr(y\|ies)" now counts DISTINCT keys -- exactly plan step 2d |
| 4 | No test or doc line hardcodes `scanned = 37` | **MET** | `git diff b32b5c8..cf91b42 \| rg "^\+" \| rg "\b37\b"` returns nothing (exit 1). No added line in any of the four commits contains the token |
| 5 | Never copy E4's / CONTEXT's non-closing figures | **MET** | I located the forbidden figures and confirmed they were NOT copied. `CONTEXT.md:155` and the debug report both give `scanned 37 / mirrored 2 / restore-MISS 12 / skipped 12 / failed 0` (`2+12+0 = 14 != 37`, and it presents restore-MISS as a sibling of skipped); the debug report's E-section pairs are ubuntu `mirrored 6 / skipped 32` (= 38 vs 37 rows) and windows `mirrored 2 / skipped 24` (= 26 vs 37). **None appears in any added line.** The summary-row fixture instead uses a freshly derived, arithmetically closing shape built on the trustworthy 25-distinct-hash figure |
| 6 | Proposal 4 is a staleness fix, never a relaxation; every MUST-NOT sentence and both invariants survive verbatim | **MET** | Item 4 above |
| 7 | Full local battery passes at EVERY commit, not just the last | **MET** | Item 1 above. `test` + `typecheck` re-run fresh at all four commits plus base; five more commands re-run fresh at both source commits; `check:action` proven structurally unable to drift in this range |
| 8 | `tdd_mode`: tasks 1 and 2 each observe a real RED before GREEN | **MET** | Re-observed independently -- see the next section. This is the only must_have not derivable from git alone, so I reconstructed both intermediate trees and ran them |

#### The TDD REDs, independently reconstructed and re-observed

A post-hoc auditor cannot see a historical test run, so I rebuilt both intermediate states
(spec files from commit N, source files from commit N-1) and ran them myself.

**Task 1 RED** -- `b32b5c8` source tree + `0b05d1e`'s two spec files:

```
Test Files  2 failed | 28 passed (30)
     Tests  10 failed | 421 passed (431)
```

All ten named failures reproduced, matching the SUMMARY's list one-for-one: the new
`runPublish OBS-01 summary rows (D-17)` spec, plus nine `publish-mirror.spec.ts` cases covering all
eight plan-listed assertion sites. **Deviation D1's explanation is exactly right** and I can confirm
its mechanism directly: the 1000-asset-cap block is an `it.each` with three rows, and the failing
cases are `with 999 existing assets` (site `:312`), `with 1000 existing assets` and
`with 1001 existing assets` (both site `:316`) -- so 8 sites yield 9 failing cases, + 1 new spec = 10.
The plan's "9" counted sites, not cases. Prediction artifact, not a defect.

The typecheck RED also reproduced, verbatim to the SUMMARY's claim, by running the target's exact
command outside nx:

```
src/action/index.spec.ts(105,7): error TS2353: Object literal may only specify known
properties, and 'scanned' does not exist in type 'PublishResult'.
TSC_EXIT=2
```

`git grep "as PublishResult" -- packages/` finds nothing, confirming no cast was used to paper over
it.

**Task 2 RED** -- `0b05d1e` source tree + `55dfb87`'s `publish-mirror.spec.ts`:

```
     x restores a hash enumerated twice (two archive versions of one key) exactly once
     v still warns on a genuine total regression when the enumeration contains duplicates
Test Files  1 failed | 29 passed (30)
     Tests  1 failed | 432 passed (433)
```

Exactly one failure, the dedup spec -- and the gate-invariance spec **passed pre-dedup** (it also
passes post-dedup, inside the verified 433/433). That is the empirical confirmation of research's
multiplicity-invariance proof, independently reproduced: `2 === 2` before, `1 === 1` after, warning
fires either way. Both REDs were real.

### artifacts

| artifact | verdict | evidence |
|---|---|---|
| `publish-mirror.ts` -- `PublishResult` gains `scanned` + `readMisses`; enumeration deduped with a WHY comment | **MET** | Both fields `readonly`, ordered `scanned` first / `readMisses` next to `skipped` (`:71-89`). Dedup at `:190-200` via `new Set` over the existing filter/map/filter chain, with the 12-line WHY comment (`:178-189`) carrying the pure-function argument. `scanned`'s doc comment updated to DISTINCT in commit 2, as step 2e requires |
| `action/index.ts` -- five summary rows, miss row labelled as a subset | **MET** | `:162-168`, five rows in the specified order; D-17 comment extended with the denominator + breakdown reasoning and the explicit note that the shared renderer is NOT widened |
| `publish-mirror.spec.ts` -- 8 `toEqual` literals extended; two new duplicate-key specs | **MET** | All 8 sites extended in place with the plan's exact values (`scanned` = 1,1,1,1,2,1,1,1; `readMisses` nonzero only at the two MISS sites) -- I checked each against the plan's table, all match. Two new specs at `:442-490`. `git grep -c "toMatchObject"` on this file returns no match: nothing relaxed |
| `action/index.spec.ts` -- first assertion on the publish summary's row set | **MET** | `:96-123`. Asserts `addTable` called once, then `toContainEqual(['scanned', '25'])` and `toContainEqual(['restore-MISS (of skipped)', '12'])`, plus `summary.write` called once. Non-vacuous: both label AND value, so a mis-wired field fails it |
| `docs/advanced.md` -- per-OS publish asymmetry, scoped to task-hash assets | **MET** | Item 3 above. Two sentences, correct placement, insert-only at word level, no count, no run id, no over-claim; `nx.json` unchanged (the file was already `targetDefaults.test.inputs` line 54) |
| `PITFALLS.md` -- Pitfall 7 items 2 and 3 plus its zstd warning sign, corrected | **MET** | Item 4 above (plus the D4 Pitfall 9 edit, judged correct in item 2) |
| Four atomic commits, each independently green on the full battery | **MET** | Item 1 above. Four commits, one per task, in plan order; each touches only its task's named files; `git status` clean after each |

### key_links

All three consulted. RESEARCH's Q1 proof was checked against the shipped code: the WHY comment at
`publish-mirror.ts:178-189` records the same argument the research proves (outcome is a pure function
of the hash because `actionsCache.get(hash)` derives both the archive path and the cache key from
`hash` alone, and `listCacheEntries` discards `version`), and I confirmed the research's own
statement of that mechanism against `backend/actions-cache-backend.ts`'s call shape as quoted. The
research's data-quality warning (`:122-124`, `:288-290`) is the source of truth 5 above, and was
honoured. CONTEXT's superseded numbers were correctly not used.

---

## Also assessed: the nx `typecheck` stale-cache false-pass (report only, not fixed)

**CONFIRMED, and the evidence is stronger than the executor reported.** I confirmed both halves of
the mechanism from configuration, then reproduced the false pass live.

Configuration (mechanism):

- `nx.json:117-118` -- `targetDefaults.typecheck.inputs` starts from the `production` named input.
- `nx.json:5-9` -- `production` = `default` minus `!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)`
  and minus `!{projectRoot}/tsconfig.spec.json`. **Spec files are excluded from the hash. So is
  `tsconfig.spec.json` itself**, which the executor did not note -- editing the spec tsconfig would
  not bust the hash either.
- The target's actual command, from `nx show project github-cache --json`:
  `tsc --build tsconfig.json --emitDeclarationOnly`, cwd `packages/github-cache`.
- `packages/github-cache/tsconfig.json` references BOTH `./tsconfig.lib.json` AND
  `./tsconfig.spec.json`; `tsconfig.spec.json` includes `src/**/*.spec.ts`. **So the command does
  compile specs.**

Inputs exclude specs; the command compiles specs. The hazard is real.

Live reproduction, on the reconstructed Task 1 RED tree (a genuine `TS2353` present in a spec):

```
### A) npm run typecheck                     -> EXIT 0,  Cache: 2/2 hit (100%)
        "Successfully ran target typecheck"
        (replayed output itself contains "Found 1 error." and
         "command ... exited with non-zero status code")
        NX also flags: "Nx detected a flaky task: @op-nx/github-cache:typecheck"
### B) npm run typecheck -- --skip-nx-cache  -> EXIT 1,  "Running target typecheck ... failed"
```

Same tree, same command, opposite exit codes. **Exit 0 is what any script, `&&` chain, or CI gate
reads**, so this is a genuine false pass -- confirming the T-06-03-02 class. Two details the
SUMMARY did not capture: nx replays the cached entry while printing "Successfully ran", and nx's own
flaky-task detector fires because one hash produced both outcomes -- the detector is the symptom, the
input set is the cause.

**Does it undermine any battery claim in THIS task? No.** Three independent reasons:

1. Commits 1 and 2 changed `publish-mirror.ts` / `action/index.ts`, which ARE in `production`, so the
   `typecheck` hash busts regardless of the spec exclusion.
2. Commits 3 and 4 changed only `docs/advanced.md` and `PITFALLS.md`. Neither is a `typecheck` input
   (both live at workspace root, outside `{projectRoot}/**/*`), so `typecheck` served a HIT -- but the
   TypeScript-relevant tree at those commits is **byte-identical** to commit 2's, whose typecheck was
   genuinely verified. A HIT there is a correct replay, not a false pass.
3. Every claim in this audit rests on my own `--skip-nx-cache` runs at all four commits, which bypass
   the cache entirely.

The executor's mitigation was sound and its scope call (record, do not fix) was correct -- the defect
is pre-existing and unrelated to the four proposals. **I did not fix it.** A follow-up should add the
spec fileset to `targetDefaults.typecheck.inputs` (and drop the `!tsconfig.spec.json` exclusion for
that target), or stop the `typecheck` target from building the spec project. Note that `build`
(`tsc --build tsconfig.lib.json`) does NOT compile specs, so it is not affected.

One side effect of my reproduction to be aware of: the local nx cache now holds a failed
`typecheck` entry at `b32b5c8`'s production-input hash. HEAD's hash differs (source changed), so HEAD
is unaffected -- verified by the clean HEAD re-run above. It is a local, self-healing artifact;
`npx nx reset` clears it if it ever surfaces.

---

## Advisory findings (non-blocking, 3)

**A1 -- `PITFALLS.md:160` now begins a sentence with a lowercase letter.** The replacement citation
was pasted verbatim from the plan's blockquote, which was written as a fragment. The line reads:
"...each leg mirrors only its own OS's entries. **the** engine's `restored.kind === 'miss'` skip
branch in `publish/publish-mirror.ts` treats an unrestorable entry as...". Purely cosmetic; no
invariant affected, and the same fragment reads correctly at `:208` where it sits mid-sentence inside
parentheses. Fix by capitalising the one word whenever this file is next touched -- not worth a
commit of its own.

**A2 -- the summary row ORDER is comment-locked but not test-pinned.** `action/index.spec.ts` asserts
row membership via `toContainEqual`, so a future edit could reorder the five rows -- moving
`restore-MISS (of skipped)` away from `skipped` -- without failing a test. The load-bearing half IS
pinned: the label string `restore-MISS (of skipped)` is asserted exactly, and that label, not the
position, is what stops a reader double-counting. Ordering drift would be cosmetic only. I do not
recommend adding an assertion; the plan chose this shape deliberately and an exhaustive row-array
assertion would add churn for no invariant.

**A3 -- reporting accuracy in the SUMMARY.** See the next section. No contract impact.

---

## What the SUMMARY over- or under-reported

**Under-reported (1) -- the looser `restore-MISS` token has 7 hits, not 6.** The SUMMARY's Task 1
verify row says "6 hits, the other 4 being prose". `git grep -n "restore-MISS" -- packages/` returns
**7**: the 2 exact-label sites plus **5** prose sites. The SUMMARY's list of four omits
`publish-mirror.ts:182` ("Safe for the all-restore-MISS gate below..."), which commit 2's own WHY
comment added -- the count was presumably taken after commit 1 and not refreshed. The plan's actual
check ("the label in exactly two places") is unaffected and MET: `git grep -F "restore-MISS (of
skipped)"` returns exactly `action/index.ts:166` and `action/index.spec.ts:122`.

**Under-reported (2) -- the stale-cache observation is worse than described.** The SUMMARY reports
`Cache 2/2 hit (100%)` + exit 0. It omits that the replayed output *contains the error text*
("Found 1 error.", "exited with non-zero status code") while nx prints "Successfully ran", and that
nx's flaky-task detector fires. Both make the hazard easier for a future reader to recognise. This
under-reporting is in the executor's own disfavour.

**Imprecise (1) -- the per-commit battery table presents replayed cache results as runs.** For
commits `98c13b9` and `cf91b42`, `typecheck` could only have been an nx cache HIT (neither file is a
`typecheck` input), and for `cf91b42` `test` could only have been a HIT too (`PITFALLS.md` is in no
input at all -- `git grep PITFALLS -- packages/github-cache/ nx.json` returns nothing, confirming the
plan's claim). So "exit 0, 433/433" at `cf91b42` is a replayed number, not a fresh run. This is
sound in substance -- a HIT on an identical relevant tree is a correct replay -- but the table reads
as four fresh runs. My independent `--skip-nx-cache` runs at all four commits close the gap, so the
underlying bisect-safety claim stands on its own evidence.

**No over-reporting found on any load-bearing claim.** Everything I re-derived matched or exceeded
the SUMMARY: the gate predicate, the absence of `37`, the label sites, the `toMatchObject` absence,
the `uploadHash` absence, the 8 extended literals and their exact values, the reflow-only rewrap, the
`writeCountSummary` non-widening (`packages/github-cache/src/lib/summary.ts` does not appear in
`git diff --name-only b32b5c8..cf91b42`), the four out-of-scope confirmations, and both TDD REDs
including D1's off-by-one explanation. Deviations D1-D4 and D4a are all accurately characterised.

---

## Out-of-scope items -- independently confirmed untouched

`git diff --name-only b32b5c8..cf91b42` lists exactly six files:
`.planning/research/PITFALLS.md`, `docs/advanced.md`,
`packages/github-cache/src/action/index.spec.ts`, `packages/github-cache/src/action/index.ts`,
`packages/github-cache/src/publish/publish-mirror.spec.ts`,
`packages/github-cache/src/publish/publish-mirror.ts`. That single fact closes most of the
out-of-scope list by construction:

- No `enableCrossOsArchive` change, and nothing that makes a leg mirror another OS's entries -- no
  workflow, backend, or `cache-key.ts` file is in the range.
- U2 (`nx-cache-cafe<runid>`) untouched.
- `writeCountSummary` NOT widened -- `lib/summary.ts` is not in the range.
- The all-miss gate predicate byte-identical at all five commits (truth 3).
- No `toMatchObject` relaxation (artifact 3).
- No network call was needed or made by this audit; no live mirror asset in release 354838660 /
  shard `cache-mirror-202607` was read, modified, or deleted.
- Branch NOT pushed. `gsd/debug-windows-publish-one-asset` is at `cf91b42`, 6 commits ahead of
  `origin/main`, 0 behind, unpushed. No PR.

I modified no source, doc, or test, and committed nothing. My transient reconstructions used detached
checkouts with an unconditional restore trap; the working tree is clean at `cf91b42` apart from the
uncommitted `260726-4cc-SUMMARY.md` and this file, both left uncommitted as instructed.

---

## Verdict

**`passed`.** The task delivered all four proposals, in the required order, with the invariants that
made the ordering necessary provably intact. The two deviations that expanded on the plan (D3's
rewrap, D4's Pitfall 9 edit) were both judged and both hold up: D3 is provably reflow-only over the
whole file, and D4 resolved a genuine internal contradiction in the plan toward the clause that
carries the intent, with a minimal edit that weakens nothing. The two claims that could not be taken
on faith -- per-commit bisect safety and the TDD REDs -- were re-derived from scratch and both
reproduce exactly, including the failure counts and the verbatim `TS2353` text. The out-of-scope
`typecheck` cache hazard is real, is reproducible, and does not touch any conclusion in this task.

No blocking gap. Nothing requires `human_needed`. The three advisory items are cosmetic or
reporting-accuracy and can ride along with unrelated future work.
