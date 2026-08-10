---
phase: 260809-uge
verified: 2026-08-10T03:20:00Z
status: passed
score: 44/44 findings closed; 9/9 plan must-have truths verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 44/44 findings closed; 9/9 plan must-have truths verified
  gaps_closed:
    - "release-asset-name.ts's cachePlatform annotation claimed FIVE call sites while enumerating six. Corrected to SIX in 2b570b3, and corrected at its origin in FINDINGS.md's D10 with the propagation recorded."
  gaps_remaining: []
  regressions: []
  notes:
    - "The prior run's behavior_unverified item (per-task mutation-redness) was re-adjudicated and WITHDRAWN, not carried forward. It is not one of the plan's nine must-have truths; the three runtime invariants behind it are exercised by passing added cases; the text-guard closures are decidable by inspection and were decided. Reasoning in section 9."
    - "ROBUST-04 re-checked at the new HEAD after 2b570b3 edited a bundled source. `npm run check:action` run by the verifier: exit 0, bundle not dirtied. Section 3(c)."
---

# Quick 260809-uge: PR #16 review survivors -- Verification Report

**Task goal:** Fix all 44 verified findings from the PR #16 review of milestone v0.0.2, in bisect-safe atomic commits.
**Range:** `c7793c4`..`2b570b3`, 31 commits, branch `gsd/v0.0.2-os-invariant-cross-os-sharing`
**Verified:** goal-backward, against the tree -- not against SUMMARY.md
**Status:** passed

> **Re-verification.** The first pass audited `c7793c4..e114676` (30 commits) and returned
> `human_needed` over one false count found in the tree. That item is fixed in a 31st commit,
> `2b570b3`, verified below. The second reason for `human_needed` -- an un-executed mutation
> battery -- was re-adjudicated and withdrawn as an over-classification; section 9 states why,
> so the reversal is auditable rather than merely announced.

---

## 1. Per-finding closure

Every one of the 44 IDs has a landed change, and in every case the landed change closes the
failure scenario FINDINGS.md describes. Verified by reading each commit's diff against the
finding text, and by re-checking the guard against the real file it reads.

### Group A -- guard strength (19/19 closed)

| ID | Closure evidence | Closes the scenario? |
| -- | ---------------- | -------------------- |
| A1 | `EXECUTABLE_MASK = /echo "::add-mask::/` plus `doc.search(...)` ordering against the interpolating `TOKEN=${` write | Yes. Deleting the only executable echo fails `toMatch` before the ordering is reached; the adjacent YAML comment no longer satisfies it. |
| A2 | Early `return` replaced by `expect(doc).toContain(TOKEN)` + `toContain('GITHUB_ENV')` | Yes. A doc that stops naming the token reddens instead of silently PASSing. |
| A3 | `/^\|[^\n]*writable[^\n]*Actions-cache backend/im` | Yes -- and stronger than prescribed. See deviation (a). |
| A4 | Two whole-document pairs replaced by `/GITHUB_REPOSITORY[^\n]*throws?/i` and `/memory backend[^\n]*permanent MISS/i` | Yes. Relation, not co-presence. |
| A5 | `wholeWord(knob)` word-boundary regex at both env-knob sites | Yes. IMPORTANT/SUPPORT/EXPORT no longer satisfy `PORT`. |
| A6 | Four member clauses replaced by one anchored whole-list pin | Yes. Empirically the pin matches `ci.yml:2348` exactly; a substring of `build-windows` cannot inhabit an exact list. |
| A7 | `ci.yml` read through the `#`-stripping filter before matching | Yes. The needle occurs once (confirmed); a comment copy can no longer satisfy it. |
| A8 | `effectiveInputsFor()` merging project over defaults via Nx's own pair, over the UNION of both layers' target names | Yes. A `project.json` `targets.test.inputs` now reaches the filter and breaks `toEqual(['integration'])`. |
| A9 | `hashedFilesFor` routed through `effectiveInputsFor`, asserting inputs are defined before splitting | Yes. Same wrong-layer read closed; the `undefined` pitfall the research named is guarded. |
| A10 | Positive `/^permissions:\n {2}contents: read$/m` plus unbounded line-anchored `not.toMatch(/^\s*[a-z-]+:\s*write$/m)` | Yes. Both directions. Positive confirmed matching `windows-regression-detector.yml:49-50`. |
| A11 | Per-fence counting: exactly 3 in the single ```json fence, plus at least one in a ```bash fence | Yes. The whole-document count of 4 can no longer be met by trading the verification fence for a fourth snippet target. |
| A12 | `commentBlockAbove(jobKey)` clause per job, kept ALONGSIDE the count | Yes. The count-of-2 attack (delete one block, duplicate inside the other) now reddens the per-block clause; the helper throws loud on a renamed job. |
| A13 | Needle extended to `'MEASURED on run 30400231720, which is why this widening is a fix'`, plus the false docstring corrected | Yes. The unique tail lives only in the justification paragraph. |
| A14 | Two new cases: pre-write the archive, restore resolves `undefined` / rejects, assert the file is gone | Yes. Covers the MISS and THROW exits the four existing assertions missed. |
| A15 | New case: `GITHUB_WORKSPACE` upper-cased against the same cwd, expects no throw | Yes. Exercises the `.toLowerCase()` fold, which nothing else did. |
| A16 | Two additional `indexOf` anchors (`isWriteTrusted(env).trusted`, `GITHUB_REPOSITORY_PATTERN.test`) with found-controls | Yes. All three earlier branches now anchored, in the existing style. |
| A17 | Hand map replaced by the `nonSpecModules()` tree walk with an explicit two-site allowlist; `exactly one` wording corrected | Yes. A third module inlining the literal now appears in `authored` and breaks `toEqual(ALLOWED)`. |
| A18 | New `dogfood-cross-os.spec.ts` clause `/grep -q 'Successfully ran target lint' \S+\.log$/m` | Yes. Confirmed matching `ci.yml:100`. `ci.yml` unchanged by that commit, as required. |
| A19 | Single ordered `toMatch(/only-in-A \(1\)[\s\S]*?targets\.typecheck\.outputs/)` | Yes. The count and the key can no longer come from different partitions. |

### Group B -- CI gates (3/3 closed)

| ID | Closure evidence | Closes the scenario? |
| -- | ---------------- | -------------------- |
| B1 | `ci.yml` typecheck-windows floor 1 -> 2; both step messages reworded; build/test legs untouched at 1 | Yes. Still a floor, never an exact pin. See section 2. |
| B2 | `grep -a -o -F` on the integration counter | Yes. All four counters now identical (lines 618, 731, 831, 1019). |
| B3 | consumer-smoke poll moved to the 404-or-200 + `--max-time 10` form | Yes. Only one poll idiom remains in the file; the `!= "000"` form survives only as retracted prose. |

### Group C -- code (6/6 closed)

| ID | Closure evidence | Closes the scenario? |
| -- | ---------------- | -------------------- |
| C1 | `await writeFile(path, bytes)` moved inside the existing `try`; `finally` comment corrected; new case injects an ENOSPC fault through a `node:fs/promises` seam and asserts no file survives and `saveCache` was never called | Yes. The write-fault exit now reaches the finally. Bundle regenerated and staged in the same commit. |
| C2 | `core.warning(...)` on the token-absent branch naming the cold-cache consequence; new case pins the LEVEL (warning called, info NOT called) and adds a non-vacuity half | Yes. The sibling's "every other" census restated as a sample, with a note not to restore a totalising claim. Bundle staged. |
| C3 | `shapeFault` returns a fault when `discriminator.stdout === ''`; stderr left type-only with the asymmetry argued | Yes. An empty-stdout leg now yields a shape fault instead of PARITY OK. |
| C4 | `if (hash === '') throw` at the action call site, before `mirrorSeedHash` and before the PUT | Yes. Confirmed the input is `core.getInput('hash', {required:true})`, whose required check runs on the UNTRIMMED value, so a whitespace-only input reaches the trim as `''`. New case asserts `fetch` was never called. |
| C5 | `ReadOnlyBackend extends ReadableBackend { readonly put?: never }` in `types.ts`, returned by all three read-only factories, selector widened | Yes. NOT exported from the barrel (`src/index.ts` and `public-surface.spec.ts` untouched in the whole range). The comment correctly declines to claim the laundering wrapper is unrepresentable and does not describe `readonly` as the mechanism. |
| C6 | `export type GitHubErrorCode` (six members) annotating `hasFaultCode`'s `code` | Yes. `faultMessageForField`'s `field` and `faultReason().code` correctly untouched. |

### Group D -- comments and docs (12/12 closed)

| ID | Closure evidence | Closes the scenario? |
| -- | ---------------- | -------------------- |
| D1 | Reserve-conflict comment rewritten; byte-identity reason and the retired CORR-01 citation gone; behaviour unchanged | Yes. |
| D2 | `producer attribution` -> `publisher attribution` at the OBS-03 topic sentence | Yes. |
| D3 | All FOUR wordings restated as defence-in-depth (helper header, helper's dead-weight variant, `cleanup.ts`, spec) in ONE commit; legacy branch KEPT | Yes. |
| D4 | Live-rotation-signal claim retracted at BOTH authored sites (`publish-mirror.ts` and `docs-same-os-claims.spec.ts`) in one commit; measured consequence and detectable window stated | Yes. Scoped grep clean. Firing condition untouched -- see section 4. |
| D5 | `docs/cross-os.md` section 1 item (c) now lists three checks including empty stderr | Yes. Section 3's same-bar cross-reference is true as written. |
| D6 | README precondition qualified: the match is required only when `GITHUB_WORKSPACE` is set | Yes. |
| D7 | Whole-file sweep of `ci.yml`; every internal numeric pointer replaced by a job/step/config-key NAME | Yes. Independently confirmed: exactly ONE numeric citation remains in the file, and it is external (see deviation (b)). Spot-checked the substitutions -- the permissions-trap paragraph really does live inside the `o3-witness` job. |
| D8 | Reproduction instruction qualified in place with a PRE-CORR-02 marker; the measurement preserved verbatim | Yes. |
| D9 | `cache-key.ts` header now names the deliberate `retention.ts` copy and the `ci.yml` shell copy; constants left unaliased | Yes. |
| D10 | Both survival annotations rewritten to enumerate consumers; headline count corrected to SIX in `2b570b3` | Yes -- see the resolved item below. |
| D11 | Seven-line annotation at `ci.yml`'s witness-job `key="nx-cache-${h_linux}"` naming it the shell copy | Yes. |
| D12 | PR-diff-scoped sweep, 14 files touched | Yes -- independently re-measured. See section 6. |

### Group E -- simplification (4/4 closed)

| ID | Closure evidence | Closes the scenario? |
| -- | ---------------- | -------------------- |
| E1 | One module-level `READ_MISS_CAUSES` (line 254) interpolated at both warning sites (493, 638) | Yes. `publish-mirror.spec.ts` untouched in the whole range -- the other half of the byte-identity proof. |
| E2 | `warnOnReadMisses(readMisses, scanned, mirrored)` extracted, module-private (no `export`), called on one line | Yes. Confirmed the helper is not exported and no other fallow entry was touched. |
| E3 | New `src/test/repo-file.ts`; `workspace-root-cwd.ts` imports the root rather than recomputing it | Yes. No vitest import. |
| E4 | `stripYamlComments` shared by all five sites, including the one task 04 created | Yes. Strip semantics byte-identical to the previous inline idiom. The dogfood injection scan still reads RAW. |

**Findings where the change landed but does not close the scenario: none.**

### RESOLVED -- the false count the first pass flagged

The first pass found that `packages/github-cache/src/lib/release-asset-name.ts`'s `cachePlatform`
survival annotation opened with `It has FIVE call sites across three modules` and then
enumerated `publish-mirror.ts` (1) + `action/index.ts` **FOUR** + `read-back.ts` (1) = **six**.

Fixed in `2b570b3`, verified independently rather than accepted:

- The commit is a one-line JSDoc change, `FIVE` -> `SIX`, and nothing else. `git show 2b570b3 --stat`:
  one file, one insertion, one deletion.
- A live grep at the new HEAD finds exactly six executable call sites across three modules:
  `action/index.ts:348/420/477/513`, `publish-mirror.ts:821`, `read-back.ts:373`. The headline
  now matches both its own enumeration and the tree.
- The miscount was also corrected at its ORIGIN. `260809-uge-FINDINGS.md`'s D10 now reads SIX
  and records that the original "five while listing six" propagated into the annotation, with a
  pointer to `2b570b3`. That matters more than the annotation fix itself: the authority file was
  the source, and leaving it uncorrected would let the same number be re-derived. The correction
  is additive and attributed, so it does not fall under the D12 prohibition on rewriting a
  recorded measurement -- FINDINGS.md is this task's live authority, not an archived capture,
  and the original claim is preserved in the correction rather than erased.

---

## 2. The stricter-guard rule held

**No guard anywhere in the range was weakened, scoped down, deleted, or skipped.**

Evidence, from the full-range diff rather than from the SUMMARY:

- **Removed test cases: 8. Added: 15.** Every removal is accounted for by a strengthening
  substitution -- A6's four member clauses collapsing into one exact list pin, A11's single
  whole-document count splitting into two per-fence clauses, and four retitles (A10, A17, B1,
  and A11's replacement). No case was deleted without a stronger replacement.
- **No `.skip`, `.todo`, or `.only` added anywhere.**
- **No threshold was loosened.** The only numeric assertion change in the range is B1's, and
  it is a raise. The other two windows legs still pin `-lt 1` exactly (`dogfood-cross-os.spec.ts:1425`
  and `:1697`); the typecheck leg pins `-lt 2` (`:1568`). The exact-pin form is preserved on
  all three; only the value became a per-leg parameter.
- **A10's bounded negative became UNBOUNDED** (`/permissions:[\s\S]{0,60}contents:\s*write/`
  -> `/^\s*[a-z-]+:\s*write$/m`) and gained a positive existence pin. Strictly stronger in both
  directions.
- **No gate tooling was touched.** The range changes no `package.json`, `nx.json`,
  `project.json`, tsconfig, vitest config, eslint config, or pack-check script. The only
  non-source files changed are `ci.yml`, `README.md`, `docs/cross-os.md`, the bundle, and
  `.planning/`. So neither `pack:check` nor `check:action` could have been relaxed at the
  configuration layer.

**B1, the one guard that reddened, was resolved by changing the code, not the guard.**
`ci.yml`'s typecheck-windows floor went 1 -> 2 (production), and the spec's floor became a
per-leg parameter of `windowsLegReasons` with the exact literal pin intact. The build and test
legs were re-passed `1` explicitly. This is a guard *specialisation*, not a relaxation: before
the change one shared literal asserted a house value across three legs with different task
counts; after it, each leg asserts its own exact value.

`2b570b3` adds no assertion change of any kind -- it touches one comment line -- so this
conclusion is undisturbed by the 31st commit.

---

## 3. The three self-reported deviations

### (a) A3's regex replacement -- SOUND, and genuinely stronger

Verified empirically against `docs/advanced.md`. `/Actions-cache backend/i` occurs on lines
11, 29, 30, 191 and 205. The prescribed `/writable[^\n]*Actions-cache backend/` matches **two**
of them: `:29` (the selection-table row) and `:205` (closing prose, `That token is what lets
the writable Actions-cache backend actually store and...`). So the prescribed fix would still
have left both table rows deletable with the clause green off `:205` -- the executor's account
is correct.

The replacement `/^\|[^\n]*writable[^\n]*Actions-cache backend/im` requires the line to START
with the table pipe. `:205` starts with two spaces, so it no longer matches; only `:29` does.
Deleting the writable selection-table row now reddens the clause. **Deviation accepted.**

### (b) `cacheUtils.js:162-163` left numeric -- SOUND

The exception is well-founded on the facts, though the SUMMARY understates the precedent:

- `@actions/cache` is exact-pinned (`packages/github-cache/package.json:42: "@actions/cache": "6.2.0"`),
  and `pinned-deps.spec.ts` gates that pin with an explicit bump note about re-reading
  `getCompressionMethod`. The cited lines therefore belong to a frozen artifact.
- The citation does not move when `ci.yml` is edited, which is precisely the rot D7 names.
- The house form is established: `cacheUtils.js:NNN` citations appear ~19 more times across
  seven TypeScript sources (`compression-method.spec.ts` alone carries 8). The SUMMARY says
  "nine sibling citations"; the real number is roughly twice that, which strengthens rather
  than weakens the consistency argument.

D7's stated defect is *internal* numeric cross-references. This one is external. **Exception
accepted.**

### (c) Rebuild accounting -- VERIFIED, and re-checked after the 31st commit

The bundle inlines 17 sources (derived from the bundle's own path comments at HEAD, not from a
hand list). Tasks 16 (C1) and 17 (C2) changed executable statements in inlined sources and both
staged a regenerated bundle. The commits that touched a bundled source WITHOUT a bundle diff:

| Commit | Inlined source touched | What changed | Erases under esbuild? |
| ------ | ---------------------- | ------------ | --------------------- |
| task 11 (A17/D9/D11) | `cache-key.ts` | 11 lines, entirely inside the file's `/** */` header block | Yes -- plain JSDoc, no `@license`/`@preserve` |
| task 20 (C5) | `types.ts`, `actions-cache-backend.ts`, `memory-backend.ts`, `releases-backend.ts`, `select-backend.ts` | a new `interface`, `import type` renames, return-type annotations, one JSDoc block | Yes -- types and comments both erase |
| task 22 (D1) | `actions-cache-backend.ts` | 22 comment lines | Yes |
| task 24 (D3/D10) | `release-asset-name.ts` | comment lines only (filtered diff shows zero non-comment `+`/`-` lines across all three files) | Yes |
| **`2b570b3`** | `release-asset-name.ts` | **one word inside a JSDoc block** | **Yes** |

**The mechanical proof extends cleanly to `2b570b3`, and I re-ran it rather than reasoning about
it.** The bundle's last write in the range is task 17 (`d9435f0`); `git log --name-only` over the
range confirms only `712e4f9` and `d9435f0` touch `start-cache-server/index.js`. Every later
commit -- tasks 20, 22, 24 and now `2b570b3` -- therefore owes no bundle bytes only if a fresh
build reproduces the committed bundle. At the new HEAD:

```
npm run check:action        ->  exit 0
git status --porcelain      ->  start-cache-server/index.js NOT dirtied
```

`check:action` is `build:action && git diff --exit-code -- start-cache-server/index.js`, so an
exit 0 with a clean bundle after a real rebuild is a direct byte-level proof, not an inference.
`2b570b3` being the last commit in the range makes this stronger than before, not weaker: the
one commit whose no-diff claim previously rested on inspection alone (task 11, which lands
*before* the two rebuilds) is unaffected, and every commit after `d9435f0` is now covered by a
rebuild I performed myself.

Separately confirmed that the two publish-mirror refactors (tasks 27, 28) correctly needed no
rebuild: `publish-mirror.ts` is **not** in the bundle's inlined set, and neither is
`octokit-fault-reason.ts` (task 21), `compare.ts` (task 18), `cleanup.ts` (task 24) or
`action/index.ts` (task 19). **No missing rebuild. No ROBUST-04 violation anywhere in the 31
commits.**

---

## 4. Both rejected sub-items stayed rejected

- **A18's secondary anchoring clause: NOT implemented.** `ci.yml:100`'s grep is still
  unanchored (`grep -q 'Successfully ran target lint' lint.log`), and the reason is recorded in
  full at the new guard so a future reader does not re-derive the anchor as an improvement. The
  commit `e6efeac` touches only `dogfood-cross-os.spec.ts`.
- **D4's optional tripwire change: NOT implemented.** Mechanically confirmed:
  - `PARTIAL_READ_MISS_WARN_RATIO = 0.5` at base and at HEAD -- byte-identical.
  - Total gate: base `if (hashes.length > 0 && readMisses === hashes.length && mirrored === 0)`;
    HEAD `if (scanned > 0 && readMisses === scanned && mirrored === 0)`.
  - Partial gate: base `wilsonLowerBound(readMisses, hashes.length) >= PARTIAL_READ_MISS_WARN_RATIO`;
    HEAD `wilsonLowerBound(readMisses, scanned) >= PARTIAL_READ_MISS_WARN_RATIO`.
  - The only change is the E2 parameter rename, and it is provably byte-equivalent: the single
    call site is `warnOnReadMisses(readMisses, hashes.length, mirrored)`, so `scanned` IS
    `hashes.length`. No denominator switched, no `alreadyPresent` folded in, no threshold moved.

Nothing else from the two out-of-scope lists appears in the diff. Every named file is untouched
across the full range:

`src/index.ts` (no new barrel export, so no `Hash` and no `ReadOnlyBackend`),
`public-surface.spec.ts`, `lint-rules.spec.ts` (the `CORR_05_SITES` placeholder),
`lint-scope-drift.spec.ts` (no `/* */` strip), `lib/sync-gate.ts`, `lib/mirror-seed.ts`,
`lib/is-entrypoint.ts`, `publish/publish-mirror.spec.ts`, `.gitignore`.
`compare.ts`'s pair check is still `if (a.meta.os === b.meta.os)` -- the recorded-not-fixed
linux+darwin gap was left alone. The legacy accept branch, `CACHE_OS_VALUES` and `cachePlatform`
all still exist.

---

## 5. E1/E2 byte-identity -- proven mechanically

Ran the emit oracle myself over `publish-mirror.ts` at base `c7793c4` and at HEAD (a wider span
than the executor's per-task before/after, since it also covers task 23's comment edits):

```
node emit-warnings.mjs <base copy> | sort  >  base-msgs.txt
node emit-warnings.mjs <HEAD file>  | sort  >  head-msgs.txt
diff base-msgs.txt head-msgs.txt   ->  EMPTY
```

Both read-miss warnings -- the total-gate `all N server-produced cache entries restored as a
MISS...` and the partial `3 of 7 ... (27%)...` -- fold to byte-identical strings before and
after. So E1's extraction and E2's relocation changed zero emitted bytes on the two messages
they touch.

**Two caveats, stated rather than papered over:**

1. Three of the five `core.warning` calls in the file reference loop locals (`name`, `tag`) and
   fold to a stable `<<UNFOLDABLE>>` marker at both ends. The oracle proves nothing about those
   three -- but they sit in the enumeration loop, outside both E1's shared span and E2's
   extracted tail, and neither commit touches them.
2. The oracle binds `hashes.length` and `scanned` to the SAME placeholder value, so it is
   structurally blind to that specific substitution. I closed that gap separately by reading
   the call site (section 4): `scanned` is bound to `hashes.length`, so the two are the same
   value at runtime and the fold is sound.

A source-literal diff was also run and, as expected, shows the concatenation boundaries moving
(that is what E1 does) while the folded results stay identical -- which is the correct
signature for a rewrap that preserves emitted bytes.

`publish-mirror.spec.ts` is untouched in the whole range, which is the independent half of the
byte-identity proof: not one of the seven pinned substrings needed editing. `2b570b3` does not
touch `publish-mirror.ts`, so nothing here is re-opened.

---

## 6. D12 sweep -- independently re-measured

Rebuilt the PR-diff file list from scratch (`git diff --name-only origin/main...HEAD -- .planning`
= 286 files) and ran my own fence-and-backtick classifier over it, before and after the sweep
commit:

| | prose-class | leave-class |
| - | ----------- | ----------- |
| before `e114676` | **374** | 17 |
| at HEAD | **0** | 17 |

The 374 figure matches FINDINGS.md's prose count exactly, and the 17 leave-class characters
(5 fenced vitest output + 12 backtick-quoted assertion text) are unchanged in count, file and
codepoint. The one apparent leave-class difference is a `THREAT-MODEL.md` table row where a
prose em dash on the same line was converted while the backticked rightwards-arrow (U+2192) in
that row's `{hash}` mapping expression was correctly preserved -- the leave character itself
survived. (Named by codepoint rather than reproduced here: this artifact is committed, and the
ASCII-only rule binds it too. Reproducing a preserved character to describe it would put the
very class of character the sweep removes back into a file the sweep just cleaned.)

The sweep touched 14 files, all inside the 286-file list. `.planning/todos/pending/` is
untouched, so the open todo whose subject is the retracted claim was not rewritten to clear a
grep -- which is the exact prohibition CONTEXT.md locks.

**On the rephrasing of the paragraph above.** It was edited by the coordinator after the first
pass, to name U+2192 by codepoint instead of reproducing the glyph. Checked, and it does not
change the finding: the substance was and remains that the prose em dash on that row was
converted, the backticked arrow was preserved, and the leave-class character survived -- which
is the classifier behaving correctly. The edit is also self-consistent with this section's own
result, since a literal glyph here would have been a fresh prose-class character in a
freshly-swept tree. Re-scanned to confirm: this artifact and all five sibling task artifacts are
now ASCII-clean (zero non-ASCII characters in each).

---

## 7. Commit-level integrity

- 31 commits in `c7793c4..2b570b3`: the plan's 30 tasks 1:1, plus the correction commit.
- Bundle staged in exactly two commits (`712e4f9`, `d9435f0`); no other commit touches
  `start-cache-server/index.js`, `2b570b3` included. Correct -- see deviation (c).
- All 44 finding IDs map to exactly one commit in the SUMMARY table, and the mapping is
  complete: A1-A19 across tasks 01-13, B1-B3 across 14-15, C1-C6 across 16-21, D1-D12 across
  11/22-26/30, E1-E4 across 27-29. `2b570b3` introduces no new ID -- it repairs D10's fix in
  place.
- Ordering constraints from the plan's `key_links` all held: task 01 before 02 (same file),
  task 23 before 27/28 (the D4 retraction was in place before E2 moved its span), task 27
  before 28, and A17/D9/D11 in one commit.
- `2b570b3` is authored by the approved public identity and carries no AI-attribution trailer,
  matching the 30 commits before it.

---

## 8. Noted premise -- the one non-reproducible test failure

For the record, because "all five gates green" is a premise several conclusions lean on: a
`test` run failed once at 1081/1090 during the coordinator's verification and was not
reproducible in five consecutive serial runs at the same HEAD. The disclosed cause is
operator-induced -- `test` and `lint` run concurrently, racing Vitest's `node_modules/.vite`
cacheDir, which AGENTS.md names as the main collision point for exactly this repo.

Recorded rather than waved through, and it does not disturb any conclusion here:

- The attribution is consistent with documented repo behaviour, so AGENTS.md's capture rule --
  which exists for an *unattributed* flake whose evidence a re-run would destroy -- is not
  triggered.
- Of the nine must-have truths, only "each commit passes the five gates" leans on those runs,
  and five serial 1090/1090 runs carry it.
- Every other conclusion in this report rests on evidence I produced myself: the commit diffs,
  the greps, the emit oracle, the non-ASCII classifier, and the `check:action` rebuild in
  section 3(c).

---

## 9. Withdrawn: the mutation-redness item

The first pass listed a second reason for `human_needed` -- that the per-task "deleting X
reddens the guard" claims were not executed. On re-adjudication that was an over-classification,
and it is withdrawn rather than quietly dropped:

1. **It is not one of the plan's nine must-have truths.** Mutation-redness is the executor's
   per-task `<done>` criterion, a stricter bar than the contract this verification is against.
   All nine must-haves are verified.
2. **The text-guard closures are decidable, and were decided.** "Does this regex still match
   after the attack" is a total function over static file content I can read, not a runtime
   state transition. I evaluated each predicate against the actual file, and for A3 ran the
   competing regexes against `docs/advanced.md` to get the discriminating result empirically.
   A6, A7, A10 and A18 were confirmed matching live content.
3. **The three genuinely runtime invariants ARE exercised by passing tests.** A14's MISS and
   THROW cleanup cases, A15's case-fold case, and C1's write-fault case each drive the invariant
   and assert on its outcome, and each is non-vacuous by construction (C1 and A14 pre-write a
   leftover precisely so the assertion cannot pass against an empty directory). Those cases pass
   -- the suite went 1076 -> 1090 consistent with the 15 added cases. A passing test that
   exercises a cleanup invariant is the behavioural evidence the protocol asks for.

What remains genuinely un-executed is the *sensitivity* direction: that each new case would fail
if its fix were reverted. That is a property of the tests, not of the production invariant; the
executor performed it per task and I confirmed the structural basis for it in each case. Holding
a verdict open for a battery that duplicates evidence already in hand, is outside the contract,
and requires mutating tracked source would be manufacturing an open item rather than reporting
one.

---

## 10. Verdict: PASSED

The phase goal is achieved. All 44 findings close. No guard was weakened anywhere in the 31
commits. All three self-reported deviations are sound. Both rejected sub-items stayed rejected
and the tripwire firing condition is provably untouched. E1/E2 byte identity is mechanically
proven. The D12 sweep is independently re-measured at 374 prose-class characters converted, zero
remaining, and 17 leave-class characters preserved intact.

The single item the first pass held the verdict open for -- a false count in a comment -- is
fixed in `2b570b3` and, more importantly, fixed at its origin in FINDINGS.md so it cannot be
re-derived. `2b570b3` edits a bundled source and is now the last commit in the range, so
ROBUST-04 was re-checked with a real rebuild at the new HEAD: `check:action` exit 0, bundle not
dirtied.

**No gaps. No human verification items outstanding.**

---

_Verified: 2026-08-10 (re-verification after `2b570b3`)_
_Verifier: Claude (gsd-verifier)_
