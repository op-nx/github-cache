---
phase: 09-os-invariant-actions-cache-version
verified: 2026-07-28T23:55:00Z
reverified: 2026-07-29T00:50:00Z
status: passed
score: >-
  11/11 requirements code-verified. The one phase-level gap found on the first pass
  (`publish-verify` regression, outside the 11-ID list) is now CLOSED at the code/fixture/
  mutation level. One standard live-CI confirmation remains open, same class as VER-06's and
  OBS-04's own live closures -- not a new gap.
verified_at_commit: f77f7e7b648eb6c20a2bc046b788b56949298dc8
reverified_at_commit: 3d127b2d46432af8791ec61c64dbe3c754cd23f5
verification_method: >-
  Independent re-derivation, not a replay of the phase's own SUMMARY claims. Every
  requirement's implementation was read directly from the working tree (not quoted from a
  plan/SUMMARY), the full test suite and both typecheck targets were re-run at HEAD, the
  action bundle was rebuilt and diffed against the committed copy, and the corrected
  11-requirement list (not the 9-ID tooling truncation) was cross-referenced against
  REQUIREMENTS.md's own text. The two `human_needed` live-CI items were checked against the
  temporary-main-push evidence in `09-EVIDENCE.md`'s ADDENDUM, which is itself a real,
  maintainer-authorised run (`30400231720`), not a projection.
reverification_method: >-
  Re-ran independently at `3d127b2`, not taken on the team lead's word: full test suite
  (671/671, 38 files) and all nine battery commands re-executed by me in this session,
  `read-back.ts`'s fix and `read-back.spec.ts` read in full, the specific measured-failure
  scenario (Windows leg receiving a linux-produced payload) traced by hand through the new
  code to confirm it now resolves on a passing branch naming `'linux'` as producer,
  `dogfood-cross-os.spec.ts` confirmed absent from the `376dbff..HEAD` diff by direct
  `git diff --stat`, the two `docs-same-os-claims.spec.ts` `ci.yml` rows read to confirm
  neither keys on `publish-verify`, both reworded grep criteria
  (`process.platform|process.arch` in the spec, `cachePlatform` in the bin) independently
  re-run with `rg` and confirmed zero matches, and `09-CONTEXT.md:794` read to confirm it was
  left unedited (the override lives in the code comment lock and the SUMMARY, per house
  style, not by rewriting the original deferral).
human_verification:
  - test: >-
      Merge this branch to `main` for real and observe the FIRST post-merge push's
      `publish-verify (windows-11-arm)` job.
    expected: >-
      GREEN, with a log line matching `github-cache round-trip read-back: cache HIT for
      <run_id> on win32 with bytes matching a '<producerOs>'-produced payload`. A `'linux'`
      producer named on the Windows leg is the POSITIVE observation -- it is the exact
      cross-OS mirror that produced the originally-measured failure (run `30400231720`), now
      correctly accepted and recorded instead of rejected.
    why_human: >-
      The standard "Live-CI first-push close" pattern already established elsewhere in this
      phase (VER-06's `dogfood-verify`, OBS-04's rotation signal) -- `publish-verify` is
      push-gated to `main` (`ci.yml:3-7`, job `if: github.event_name == 'push'`), so no
      pre-merge run can produce it. This is NOT a new gap and NOT a decision point: the fix
      is code-verified, fixture-tested (RED -> GREEN, 8 tests), and mutation-tested (4/4
      predictions held exactly, re-traced below). It is the same category of open item VER-06
      and OBS-04 already carried before their own live closure, and unlike OBS-04's one-shot
      signal it is re-samplable on every push.
---

# Phase 9: OS-Invariant Actions-Cache Version Verification Report

**Phase Goal:** The `@actions/cache` version stops depending on which OS computed it -- one
hardcoded forward-slash path literal and `enableCrossOsArchive: true` at every call site --
proven by a Windows runner reading back an entry a Linux runner wrote.

**Verified:** 2026-07-28T23:55:00Z (initial pass); **re-verified:** 2026-07-29T00:50:00Z (after
gap-closure plan 09-08)
**Status:** passed -- **the stated phase goal IS achieved and IS proven live** (see VER-06
below), and the one gap found on the initial pass is now closed. See
`## The one gap -- CLOSED by plan 09-08` below for the full re-verification.
**Re-verification:** Yes. First pass (2026-07-28) found `gaps_found`: this phase's own
changes provably broke an existing CI guard (`publish-verify` on `windows-11-arm`), observed
failing on a real temporary sample push, with nothing in the original seven plans fixing it.
Plan 09-08 (gap closure) landed three commits (`acd37d0` test, `fc37f0f` fix, `11a1e4c` docs)
that fix it. I re-verified the fix independently rather than taking the team lead's summary
of it on faith -- see `reverification_method` above and `## The one gap -- CLOSED by plan
09-08` below.
**HEAD at initial verification:** `f77f7e7`.
**HEAD at re-verification:** `3d127b2`, working tree has only a pre-existing unrelated
modification to `.planning/config.json` (present before this phase's work began); nothing
from this phase's scope is uncommitted.

---

## Requirement list used (the corrected 11, not the tooling's 9)

Per the dispatch and independently confirmed against `REQUIREMENTS.md`'s own text
(`:246-338`, `:461-469`) and `ROADMAP.md:245-256` (whose `**Requirements**:` line wraps and
silently drops the last two IDs from any tool that stops at the newline): **PARITY-08, VER-01,
VER-02, VER-03, VER-04, VER-05, VER-06, VER-07, ROBUST-04, OBS-04, DOCS-08.**

---

## Per-requirement verification

Each row was checked against the LIVE working tree at `f77f7e7`, not against the plan or
SUMMARY text. File/line citations are what I read this session.

### PARITY-08 -- `ci.yml` as a `test` input

**VERIFIED.** `nx.json` (root) contains `{workspaceRoot}/.github/workflows/ci.yml` in
`targetDefaults.test.inputs`, confirmed by direct read. `packages/github-cache/src/nx-target-inputs.spec.ts` carries a three-clause guard (literal pin, merged-configuration read via Nx's own `readTargetDefaultsForTarget`/`mergeTargetConfigurations`, negative vacuity control) and all its tests pass in the 663-test run below. `packages/github-cache/project.json` exists (confirmed) and does not override `test.inputs`, so the merge is non-trivial and the guard is meaningful, not vacuous.

### VER-01 -- byte-identical, hardcoded, forward-slash path literal

**VERIFIED.** `packages/github-cache/src/lib/cache-archive-path.ts:72-76`:
```ts
export const CACHE_ARCHIVE_DIR = '.nx/cache';
export function cacheArchivePath(hash: Hash): string {
  return `${CACHE_ARCHIVE_DIR}/nx-github-cache-${hash}.tar`;
}
```
The file's only import is `import type { Hash } from './cache-key.js'` (line 1) -- no
`node:path`, no `node:os`, confirmed by direct read of the whole 77-line file. The literal
uses a hardcoded `/`, never `join`/`resolve`/`sep`, and derives from neither `os.tmpdir()`
nor `RUNNER_TEMP` nor `~`.

### VER-02 -- the two version-determining inputs pinned by spec

**VERIFIED.** `cache-archive-path.spec.ts` pins the full literal as a hand-authored string
(not reconstructed from the implementation's template -- confirmed by direct read of the
file's opening comment and assertion) and additionally runs a comment-stripped source scan
of the subject file for banned builder names plus an exact-equality import-list assertion.
Both clauses are present and both are exercised by the 663-test run.

### VER-03 -- `enableCrossOsArchive: true` at all three call sites, correct position

**VERIFIED**, read directly from `actions-cache-backend.ts`:
- `restoreCache([path], cacheKeyFor(hash), undefined, undefined, true)` -- `:141-147`, flag at
  the 5th positional.
- `saveCache([path], cacheKeyFor(hash), undefined, true)` -- `:215-220`, flag at the 4th
  positional (not the 5th -- the JSDoc-inversion trap the code comments this exactly).
- `restoreCache([path], cacheKeyFor(hash), [], { lookupOnly: true }, true)` -- `:236-244`,
  flag at the 5th positional.

`actions-cache-backend.spec.ts` mocks `@actions/cache` and asserts whole-argument-array
equality plus call counts (confirmed present, `restoreCache`/`saveCache` mocked at `:43-44`).

### VER-04 -- construction-time cwd/`GITHUB_WORKSPACE` conjunction guard

**VERIFIED.** `actions-cache-backend.ts:86-109`: `existsSync(join(cwd, 'nx.json'))` throws
first; then `resolve(githubWorkspace).toLowerCase() !== resolve(cwd).toLowerCase()` throws
second; `mkdirSync` runs only after both pass (`:121`). Assert-then-mkdir order confirmed by
direct read -- exactly the order VER-07's sequencing note requires (mkdir must not create a
`.nx/cache` in the wrong tree before the identity is confirmed).

### VER-05 -- resolved compression method surfaced, never gated

**VERIFIED**, both the re-derivation and its surfacing:
- `packages/github-cache/src/lib/compression-method.ts:96-122` --
  `spawnSync('zstd', ['--quiet', '--version'], { shell: false, windowsHide: true, encoding:
  'utf8' })`, both streams concatenated, exit code never read (field never named in the
  file, confirmed by reading the whole 122-line file), `.trim()`, branch on
  `versionOutput === '' ? 'gzip' : 'zstd-without-long'`.
- Surfaced at `action/index.ts:184` (`resolveCompressionMethod()` called), `:187` (log line),
  `:207` (summary line) -- confirmed by direct grep of the file.
- **Live-CI confirmation, not just fixture-level:** both `publish` legs of the temporary
  sample push printed `compression method (@actions/cache): zstd-without-long`
  (`09-EVIDENCE.md` ADDENDUM). The re-derivation agrees with the library on real runners.

### VER-06 -- cross-OS behavioural close (the phase's headline claim)

**VERIFIED, and CLOSED LIVE -- this is the strongest evidence in the phase.**
`dogfoodBody(hash: string, producerOs: CacheOs)` (`dogfood-body.ts:40-42`) has no default
(confirmed: two required params, no `=` in the signature) and the byte-identical template
folds `producerOs` into the payload. `action/index.ts` calls it at `:286` (seed branch,
`cachePlatform()`) and `:329` (verify branch, a literal producer-OS expectation) -- two
physically separate call sites, confirmed by direct grep, so the "compare against my own OS"
vacuity trap cannot reach the verify branch.

`ci.yml`: `dogfood-seed` (`:799-816`) is single-leg `ubuntu-24.04-arm`, `if:
github.event_name == 'push'`, no matrix -- confirmed by direct read. `dogfood-verify`
(`:822-...`) is a two-leg matrix `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`,
also `if: push` -- confirmed by direct read, including the vacuity-condition comment block.

**Live proof:** the maintainer-authorised temporary push to `main` (`9ec4739`, run
`30400231720`, later reverted) produced `dogfood-verify (windows-11-arm)` job `90413113797`
**success**, with the exact confirming log line: `github-cache dogfood verify: cache HIT for
30400231720 on windows with bytes matching a 'linux'-produced payload.` `dogfood-seed` ran
single-leg on ubuntu as required. This is independently corroborated by `publish
(windows-11-arm)` restoring the same four task hashes `publish (ubuntu-24.04-arm)` did in the
same run. **A Windows runner reading back an entry a Linux runner wrote is now a measured
fact, not a projection.** This is exactly the phase's stated goal, proven the way the goal
demands (a real runner, not a unit spec).

### VER-07 -- archive directory created before first write, stays gitignored

**VERIFIED.** `mkdirSync(CACHE_ARCHIVE_DIR, { recursive: true })` at `actions-cache-backend.ts:121`,
after both guard conjuncts. `.nx/cache` is covered by `.gitignore:41` (per the CONTEXT record;
not independently re-checked this session, but the comment lock at `cache-archive-path.ts:38-42`
states it and nothing in this phase's diff touches `.gitignore`).

### ROBUST-04 -- committed bundle rebuilt in the same commit as any `serve()`-reachable edit

**VERIFIED, and independently re-run, not merely trusted.** I ran `npm run check:action`
myself at HEAD (`f77f7e7`) in the main tree (not a junctioned worktree, so the artefact class
documented in 09-01's SUMMARY does not apply): **exit 0, empty diff.** The committed
`start-cache-server/index.js` matches a fresh `npm run build:action` byte-for-byte.
Independently confirmed the guard code is actually IN the bundle: `rg -c "must be the Nx
workspace root" start-cache-server/index.js` returns 1, and `.nx/cache` appears in the bundle
text.

The sidecar job count: `git grep -n "uses: ./start-cache-server" -- .github/workflows/ci.yml`
returns **five** sites (`:236, :310, :357, :437, :935`), confirming the phase's own A3
correction (REQUIREMENTS.md and ROADMAP both still say "four" and are wrong; the code and the
guard are right). `action-bundle-drift` (`ci.yml:99-114`) has **no `if:` gate**, confirmed by
direct read of the whole job body, so it runs on pull requests as well as pushes --
independently confirming the phase's correction to its own requirement text ("catches it, but
only on push" is false).

**Live-CI confirmation:** `action-bundle-drift` was green on the temporary sample push.

### OBS-04 -- reworded warning, axis-named, tripwire gated correctly

**VERIFIED as written; SAMPLED live with an honestly-recorded partial mismatch that does not
undermine the mechanism.** `publish-mirror.ts:296-320`: the warning no longer contains
"different OS" (confirmed: `rg -n "differen[t] OS"` over the file returns nothing), and names
the axis explicitly -- "The axis here is the @actions/cache cache VERSION -- a SEPARATE
mechanism from the Nx TASK hash and from the Release ASSET NAME" -- with both candidate
causes and the two-consecutive-pushes gate, all confirmed by direct read of the emitted
string. It remains a `core.warning`, never a `setFailed` (confirmed: no new failure branch
introduced).

The rotation was recorded in advance at `09-ROTATION-SIGNAL.md`, committed at `e7018d0`, an
ancestor of the version-rotating commit `47597a6` (git ancestry, not merely claimed).

**Live sampling result (from the temporary push):** the exact predicted row values
(`mirrored == 0`, `restore-MISS == scanned`) were **NOT met** -- `publish` enumerates the
CURRENT cache list late in the run, which by then included 6-7 fresh entries the same run's
earlier jobs had already written at the new version, so `scanned` (47/48) exceeded the 41
genuinely-rotated entries. **What WAS confirmed, and is the load-bearing half:** the
`restore-MISS` count was **symmetric across both legs (41 == 41)**, which is precisely the
fingerprint the phase's own pre-registered record says distinguishes a PATH-caused rotation
(both legs) from a flag-only rotation (Windows-only asymmetry). The mechanism and its
attribution are therefore confirmed; only the strict all-or-nothing framing of the advance
prediction was too tight for a run whose own earlier jobs repopulate the cache before publish
reads it. This is recorded honestly in `09-EVIDENCE.md` as a correction for future such
records, not hidden or reframed as a full match. I accept this as satisfying OBS-04's actual
requirement text (the warning wording and the tripwire gating condition), independent of
whether one sampled run matched the naive prediction to the value.

### DOCS-08 -- same-OS-restore claims corrected

**VERIFIED**, all six sites (three corrections, three additive) read directly, not
paraphrased:
- `docs/advanced.md:60` -- "**Restore is not same-OS.**" (correction, confirmed).
- `ci.yml:983-1002` (publish-matrix comment) -- corrected to justify the two-leg matrix on
  the Nx-hash axis ("the ONLY leg that produces Windows-hash entries"), confirmed by direct
  read; no remaining same-OS-storage claim.
- `ci.yml:384-406` (`integration` comment) -- two sentences corrected narrowly: "that Nx hash
  is the ONLY thing separating them" and the CORR-01-namespacing clause replaced with the
  hash-based explanation, confirmed by direct read.
- `docs/advanced.md:45`, `README.md:124-125`, `docs/trust-and-security.md:184-185` -- all
  three retain their fault-degradation sentence byte-for-byte and add a platform-agnosticism
  precondition, confirmed by direct read of all three files. None assert the retracted
  "whose bytes did the developer get" claim (confirmed: no such phrase found in any of the
  four edited doc files).

---

## The one gap -- CLOSED by plan 09-08 (re-verified 2026-07-29)

**Original finding (2026-07-28), preserved verbatim below for the record, followed by the
closure verification.**

### Original finding: `publish-verify (windows-11-arm)` is a known, measured, unfixed regression

This is **not** one of the 11 requirement IDs, and I want to be explicit that its existence
does not mean any of the 11 failed -- every one of them is verified above, several with live
proof. It is nonetheless the reason this report is `gaps_found` rather than `passed`, because
it is a real defect this phase's own changes caused, it has already been OBSERVED (not
projected) on a real run, and nothing in this phase's seven plans touches the file that would
fix it.

**Mechanism.** `roundtrip/read-back.ts:63-68` still asserts (confirmed by direct read, code
UNCHANGED by this phase):
```ts
// cachePlatform() is the correct producer argument here, NOT the literal the dogfood
// verify leg uses: the asset this leg reads is its OWN-OS asset, written by the same
// leg's publish seed, so producer and reader are the same OS by construction.
if (!result.bytes.equals(dogfoodBody(hash, cachePlatform()))) { ... }
```
That comment's premise -- "producer and reader are the same OS by construction" -- is exactly
what VER-01/VER-03 falsify. Once cross-OS restore works, `publish (windows-11-arm)` can (and,
on the sampled run, did) restore the run-scoped dogfood key and receive the
**linux**-produced payload, then mirror those bytes under the **windows** asset name. The
Windows `publish-verify` leg then reads its own-OS asset, gets linux-produced bytes, compares
against `dogfoodBody(hash, cachePlatform())` (windows bytes), and fails.

**This already happened, on the temporary sample push:**
```
##[error]github-cache round-trip read-back: cache HIT for 30400231720 on win32 but the
returned bytes are not what the publisher wrote -- suspect the asset-name discriminator
colliding across runs, or a partial upload.
```
job `publish-verify (windows-11-arm)`, run `30400231720`, conclusion **failure**.

**Why this is a Phase 9 concern and not simply "wait for Phase 10 as planned."**
`ROADMAP.md` Phase 10 item 4 does anticipate this in general terms ("Phase 9 is precisely
what breaks the publisher-equals-producer identity"), and item 3 schedules the actual fix
(OBS-05, leg-distinguishable seed hashes) for Phase 10. That forward plan is sound. But
`09-EVIDENCE.md`'s own ADDENDUM records the maintainer's decision on the SAMPLED, REAL
failure as: **"Routed to Phase 9 gap closure by maintainer decision."** That is a decision
already on record in this phase's own artifacts, not something I am inferring -- and it means
the deferral-to-Phase-10 plan was supplanted for this specific measured instance. As things
stand at `f77f7e7`, merging this branch to `main` for real will turn `publish-verify
(windows-11-arm)` red on the very first push and it will stay red until either this gap is
closed or Phase 10's OBS-05 lands.

**DOCS-08 is not the place this should have been caught, and the phase's own EVIDENCE.md says
so.** DOCS-08 enumerated four DOCUMENTATION sites asserting same-OS restore.
`read-back.ts:63-67` is a fifth site, in EXECUTABLE LOGIC, and no requirement in this phase's
eleven names it. The phase did not miss a check it owned; it surfaced a check nobody in this
milestone's requirement list owned, and recorded that fact plainly rather than papering over
it. That intellectual honesty is exactly why I can classify this confidently as a real,
already-measured gap rather than a speculative one.

**What I did not find (at the time of the first pass):** no plan, no commit, and no `09-08`
artifact addressing it. The maintainer decision to route it to "Phase 9 gap closure" was
recorded but not yet acted on in code.

### Closure verification (2026-07-29), independently re-derived

Plan 09-08 landed three commits (`acd37d0` test-RED, `fc37f0f` fix-GREEN, `11a1e4c` docs) on
top of `f77f7e7`, merged to this branch at `3d127b2`. I did not take the SUMMARY's word for
any of the following -- each line below is something I read or ran myself this session.

**1. The fix, read directly.** `roundtrip/read-back.ts:138-140` now reads:
```ts
const producerOs = CACHE_OS_VALUES.find((os) =>
  result.bytes.equals(dogfoodBody(hash, os)),
);
```
replacing the old `result.bytes.equals(dogfoodBody(hash, cachePlatform()))`. `cachePlatform`
no longer appears anywhere in the file (confirmed: `rg -n "cachePlatform"` over
`read-back.ts` returns zero matches). `CACHE_OS_VALUES` is `['windows', 'macos', 'linux']`
(`release-asset-name.ts:8`) -- the SAME single-source enum the rest of the phase already
uses, not a new vocabulary.

**2. Non-vacuity -- confirmed, this is the check that matters most.** I read
`read-back.spec.ts` in full and re-ran the whole suite myself (below). Four rejection cases
still throw, unchanged in effect: garbage bytes (`'not a dogfood payload at all'`), a
truncated/partial upload (`dogfoodBody(HASH, 'linux').subarray(0, 12)` -- `Buffer.equals`
compares length first, so a byte-shorter prefix cannot match any of the three candidates), an
asset for a DIFFERENT hash (a same-length neighbouring run id, so the fixture cannot be
satisfied by a length-only comparator either), and a cache MISS. All four are asserted with
`.rejects.toThrow(...)`, and all four passed in my own test run. **The relaxation is exactly
what the SUMMARY claims: two additional accepted byte strings per hash** (the delta between
1 producer -- the reader's own OS, previously the only accepted value -- and 3 -- the full
`CACHE_OS_VALUES` set now accepted), nothing looser: no presence check, no length check, no
HIT-only check anywhere in the replacement. I additionally hand-traced the mutation table in
the SUMMARY (M1-M4) against the actual code and found no discrepancy between the claimed and
the structurally-implied behaviour of each mutation.

**3. Would the originally measured failure now pass? Yes, traced by hand.** On the sampled
run, `publish (windows-11-arm)` restored the shared run-scoped dogfood key and received the
linux-produced payload (`dogfoodBody(hash, 'linux')`), then mirrored those bytes under its
own (`windows`) asset name. Feeding those exact bytes through the NEW comparison:
`CACHE_OS_VALUES.find((os) => bytes.equals(dogfoodBody(hash, os)))` finds a match at
`os === 'linux'` (the second candidate in `['windows', 'macos', 'linux']` order is checked
after `windows` fails, `macos` fails, `linux` matches). `producerOs` is defined, so the
`throw` branch is skipped and the success line at `:152-155` renders
`` `github-cache round-trip read-back: cache HIT for ${hash} on ${process.platform} with bytes
matching a '${producerOs}'-produced payload; ...` `` -- i.e. it names **`linux`** as the
producer on the Windows leg. This exactly matches `read-back.spec.ts`'s
`it.each(CACHE_OS_VALUES)('accepts a mirrored payload produced on %s and names that producer
in the log', ...)` case for `os = 'linux'`, which I confirmed passes in my own test run.

**4. 09-05 not contradicted -- confirmed by diff, not by claim.**
`git diff --stat 376dbff..HEAD -- packages/github-cache/src/dogfood-cross-os.spec.ts`
(`376dbff` is plan 09-08's own base commit) returns **empty** -- the file is byte-unchanged
by the gap-closure plan. `git diff --stat f77f7e7..HEAD` (the full gap-closure diff) touches
exactly two source files (`read-back.ts`, `read-back.spec.ts`, new) plus planning/tracking
docs -- confirmed by direct read of the diffstat. The `dogfood-verify` two-leg matrix in
`ci.yml` is untouched (also absent from the diffstat). The comment lock in `read-back.ts`
(`:110-120`) explains the asymmetry in both directions: `dogfood-verify`'s
`expectedProducerOs` stays a hard-coded single value because `dogfood-seed` is single-leg
ubuntu BY CONSTRUCTION (pinned by `dogfood-cross-os.spec.ts`'s no-matrix clause, unchanged),
so unifying downward (asserting one producer in `read-back.ts` too) would reintroduce this
exact regression the moment the ubuntu publish leg loses its `max-parallel: 1` race; unifying
upward (letting `dogfood-verify` accept any producer) would destroy VER-06's provenance
proof, the phase's own headline live closure. I find this reasoning sound and specific to the
two guards' actually-different preconditions (one leg's producer is fixed by design, the
other's is genuinely variable), not a hand-wave.

**5. Two executor deviations, assessed rather than assumed fine.**
   - *The module doc block correction.* The SUMMARY reports the executor also corrected a
     SECOND same-OS claim in the file's top-of-file doc comment
     ("`producer and reader are the same OS by construction`" and a same-OS "publish->reader
     contract" claim), beyond the plan's scoped correction at the comparison site. I read the
     current doc block (`read-back.ts:11-39`) and it is accurate: it now says the asset
     **NAME** is same-OS while the **PAYLOAD** behind it is not, and points at the
     comparison-site comment for the full reasoning. I agree with the executor's stated
     rationale (a header that contradicts the code it heads is exactly the same defect class
     this plan exists to fix) -- correcting it was the right call, not scope creep.
   - *The two reworded grep criteria.* I independently re-ran both: `rg -n
     "process\.platform|process\.arch"` over `read-back.spec.ts` and `rg -n "cachePlatform"`
     over `read-back.ts` -- **both return zero matches.** The SUMMARY's account (both
     criteria initially matched once each, in explanatory prose inside a comment rather than
     as a code read, and were reworded to convey the same fact without the literal token) is
     consistent with what I see in the current files: the surviving prose describes "an
     ambient platform read" and "the ambient platform-mapping helper in
     `release-asset-name.ts`" without ever spelling the banned identifiers. No assertion was
     weakened -- the criteria are satisfied literally, and lint's own no-restricted-syntax
     ban is what actually enforces the underlying rule, which is unchanged.

**6. The deliberate, known inconsistency -- `ci.yml`'s `publish-verify` job comment.** I read
the job comment at `ci.yml:1100-1110` directly: it still says "Each OS leg reads back ONLY
its own-OS asset ... so this proves the same-OS publisher->reader contract" -- **flatly false**
about what `read-back.ts` now asserts. This is deliberate and contained, not an oversight:
`docs-same-os-claims.spec.ts`'s two `ci.yml` rows key on the `publish` job's matrix comment
(required phrases: "the ONLY leg that produces Windows-hash entries", "keep BOTH legs") and
the `integration` job's comment (required phrase: "that Nx hash is the ONLY thing separating
them") -- I read both rows directly and **neither keys on `publish-verify`**, so nothing
reddens. The code comment lock in `read-back.ts` (`:128-137`) names the `publish-verify` job
comment BY JOB NAME and states plainly that Phase 10's TRUST-11 must not be closed on the
strength of `read-back.ts` having already changed. **I judge this containment adequate as
is.** A test pin now would only assert that a known-stale sentence is known-stale, which adds
no safety beyond what the comment lock already documents more precisely (it explains WHY the
sentence is wrong and WHAT still needs to happen); pinning it would just be a second place for
the same fact to rot. Phase 10 is the right place to either correct the prose or fold a docs
guard over it, once OBS-05 gives the fix somewhere real to land.

**7. The `09-CONTEXT.md:794` override -- recorded in both required places, not silently
reversed.** I read `09-CONTEXT.md:794-795` directly: the original deferral text ("Phase 10
(TRUST-11 / OBS-05), explicitly NOT this phase's DOCS-08 work") is **UNCHANGED** -- the
override was not applied by silently rewriting the prior decision record, which is the
correct house pattern (record corrections, don't retroactively edit prior artifacts). The
override is instead recorded in two places I independently confirmed: the code comment lock
in `read-back.ts` (`:129-137`, naming `09-CONTEXT.md` and `09-EVIDENCE.md`'s ADDENDUM as the
basis) and `09-08-SUMMARY.md`'s `## The CONTEXT override` section (quoting the deferral
verbatim and stating the override rests on the maintainer's routing decision after the
failure was measured, not on a re-reading of the context). This is exactly the traceable
record a later reader needs and cannot mistake for undocumented drift.

**8. Regression check, re-run myself at `3d127b2`, not taken on faith:**

| Command | Result (independently re-run) |
|---|---|
| `npm run format:check` | exit 0 |
| `npm run build` | exit 0 (Nx cache hit) |
| `npm run typecheck` | exit 0 (Nx cache hit) |
| `npm run typecheck:action` | exit 0 |
| `npm run test` | **671 passed, 38 files** (cache-bypassed run) |
| `npm run lint` | exit 0 (Nx cache hit) |
| `npm run fallow:ci` | exit 0, "No issues found", 57 entry points |
| `npm run check:action` | exit 0, **empty diff** -- `read-back.ts` is not `serve()`-reachable (the bundle's one entry is `start-cache-server/entry.ts`), so `start-cache-server/index.js` is untouched, confirmed |
| `npm run pack:check` | exit 0, 55 files, no internals leaked |

`git status --short` after all of the above shows only the pre-existing unrelated
`.planning/config.json` modification -- nothing from this run's `check:action` rebuild
persisted, confirming the empty-diff claim rather than merely printing it.

**Verdict on the gap: CLOSED.** The fix is narrowly scoped (exactly the comparison site plus
its own doc block), preserves every existing rejection path, is proven by a real fixture
RED->GREEN transition and four independently-verified mutations, and correctly resolves the
exact byte sequence that produced the original measured failure. The only thing left is
observing it green on a real push to `main`, which is the same kind of standing item VER-06
and OBS-04 already carried (and already had closed once, via the temporary sample push) --
not a new decision point.

---

## Cross-reference against REQUIREMENTS.md (all 11, explicit)

| ID | Verdict | Evidence |
|---|---|---|
| PARITY-08 | Verified | `nx.json` entry + three-clause guard, all green |
| VER-01 | Verified | `cache-archive-path.ts:72-76`, no `node:path`/`node:os` import |
| VER-02 | Verified | `cache-archive-path.spec.ts` literal pin + source scan |
| VER-03 | Verified | three call sites, correct positional index each, read directly |
| VER-04 | Verified | assert-then-mkdir order, both conjuncts, read directly |
| VER-05 | Verified | fixture-level AND live-CI value observed on both legs |
| VER-06 | **Verified, closed live** | real Windows runner read-back, log line captured |
| VER-07 | Verified | `mkdirSync` after guard, gitignored directory |
| ROBUST-04 | Verified | `check:action` re-run by me, exit 0, empty diff; live-CI green |
| OBS-04 | Verified (mechanism); sampled with an honestly-recorded partial mismatch | symmetric 41==41 restore-MISS confirms PATH attribution |
| DOCS-08 | Verified | all six sites (3 correction + 3 additive) read directly |

**All 11 requirement IDs: verified.** The gap that drove the initial `gaps_found` verdict
sat entirely outside this list (`publish-verify`'s same-OS assumption in `read-back.ts`, not
one of the 11) and is now closed by plan 09-08 -- see `## The one gap -- CLOSED by plan
09-08` above.

---

## Regression check against prior phases

**Initial pass (2026-07-28):** ran the full suite at HEAD (`f77f7e7`) myself: **663 passed,
37 files**, matching every plan's claimed count. `npm run typecheck` and
`npm run typecheck:action` both exit 0. No LSP-only findings were treated as authoritative,
per this project's own standing instruction -- the compiler and test runner are the gate.

No sign of regression in Phase 7 or Phase 8's guards: `lint-scope-drift.spec.ts`,
`lint-rules.spec.ts`, and `nx-target-inputs.spec.ts`'s Phase 7/8 clauses all pass in the same
663-test run.

**Re-verification (2026-07-29):** ran the full suite again at `3d127b2` myself: **671
passed, 38 files** (+8 tests, +1 file -- exactly `read-back.spec.ts`'s new coverage, no
regressions elsewhere). All nine battery commands re-run and re-confirmed exit 0 (see the
table in `## The one gap -- CLOSED by plan 09-08` above). `git status --short` shows nothing
uncommitted from this phase's scope.

---

## On the three plan-imposed one-commit TDD exceptions (09-03, 09-05, 09-06)

Reviewed and accepted, consistent with the phase's own recorded rationale. All three achieved
assertion-level RED (named tests failing on their own merits, suite completing) rather than an
import-level failure, and each carries a substantive, non-convenience reason (avoiding a
fourth cache-version rotation window; a RED-only commit that would not typecheck; a guard
whose required phrases only exist after six simultaneous doc edits). This is not treated as a
gap.

---

## Recommendation

1. **This phase's stated goal is achieved and proven.** VER-06's live closure is unambiguous
   and is the strongest possible evidence for the phase's headline claim.
2. **The gap that blocked a `passed` verdict on the first pass is now closed.** Plan 09-08
   fixed `read-back.ts`'s producer assumption in Phase 9 itself (the maintainer's own routing
   decision on the measured failure), and I independently re-verified the fix at the code,
   fixture, and mutation-test level -- see `## The one gap -- CLOSED by plan 09-08` above.
3. **Proceed to `/gsd:extract-learnings` / milestone close.** The one remaining open item
   (observing `publish-verify` green with a `'linux'` producer line on the first real push to
   `main`) is a standard live-CI confirmation, not a decision point or a rework item -- it is
   the same category VER-06 and OBS-04 already carried before their own live closure. It is
   named in this report's frontmatter `human_verification` for the record, and it does not
   block calling the phase `passed`.
4. Nothing else in the phase needs rework.
