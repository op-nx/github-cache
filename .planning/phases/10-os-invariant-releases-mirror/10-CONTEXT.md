# Phase 10: OS-Invariant Releases Mirror - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (trade-off tables recorded in
`10-DISCUSSION-LOG.md`; recommended option auto-selected per area; one
HIGH-impact / NOT-HIGH-confidence item withheld from auto-lock and recorded as
UNRESOLVED for `gsd-phase-researcher`)

<domain>
## Phase Boundary

The Releases mirror stops carrying an OS in its lookup name. One asset per hash --
`nx-cache-<hash>` -- still prunable, still attributable, with the trust consequences
classified by an independent auditor rather than assumed away.

Six things:

1. **The name.** `releaseAssetName(hash)` returns `nx-cache-<hash>` -- a distinguishing
   prefix single-sourced from `CACHE_KEY_PREFIX`, no OS component -- and both the reader
   and the publisher derive it from that one helper.
2. **The filter.** The cleanup accept-list admits BOTH the new name and the legacy
   `<hash>-<os>` names, in the SAME COMMIT as the rename, with the two branches asserted
   mutually exclusive DIRECTLY. `CACHE_KEY_PREFIX` is pinned by spec and comment-locked as
   governing FOUR things.
3. **The attribution.** Every mirrored asset carries `mirrored-by: <os>` in the free-form
   Release asset `label` -- metadata OUTSIDE the lookup name -- so collapsing the namespace
   does not also destroy incident-response attribution.
4. **The publish wiring.** Each `publish` leg seeds a leg-DISTINGUISHABLE hash, each
   `publish-verify` leg reads back its OWN leg's asset, and `publish` waits on every job
   that produces a mirrored entry rather than on `build` alone.
5. **The last ambient-platform reads.** CORR-05 becomes TRUE: sites 2 and 3 leave with the
   rename, and site 4 -- which nothing in this milestone removes -- gets an explicit call.
   The non-vacuity proof CORR-02 destroys on purpose gets a named replacement in the same
   commit.
6. **The trust classification.** `max-parallel: 1` retained and comment-locked as NOT a
   correctness control; C1/C2/C16 verified unchanged; `listCacheEntries`' `ref` scoping
   pinned as the now-sole control; and SECURITY.md carries `gsd-security-auditor`'s
   classification of TRUST-11/TRUST-12 -- authored by the auditor, never self-certified.

**Not in this phase:** any live O1/O2/O3 proof (Phase 11), the Windows
`build`/`typecheck`/`test` legs and the O4 write decision (Phase 12), the DOCS-07
portability recipe (Phase 12), read-fallback across old and new asset names (out of scope
-- our own mirror repopulates on the next default-branch push), collapsing the publish
matrix to one leg (out of scope until XOS-05 is proven), and any adopter-migration
signalling (out of scope -- zero adopters).

</domain>

<decisions>
## Implementation Decisions

### BLOCKING PRE-FLIGHT: what the tooling and the ROADMAP get wrong for this phase

- **D-00:** `gsd-tools query init.plan-phase 10` now returns all **TWELVE** IDs -- the
  ROADMAP unwrap fix at `ff21b5f` works and the Phase 8 / Phase 9 truncation defect does
  NOT recur here. MEASURED this session. Two residual traps:

  1. The last ID comes back as **`TRUST-13.`** with a trailing period (the parser takes
     the line to its end, sentence punctuation included). Do not `rg` for the literal
     `TRUST-13.` and do not write it into an artifact that way.
  2. **ROADMAP.md is internally inconsistent about the count.** Its `**Requirements**:`
     line (`:351`) lists TWELVE. Its Coverage Validation (`:591`) says "Phase 10: 11" and
     its traceability table (`:560-570`) OMITS `RETAIN-05` entirely. REQUIREMENTS.md is
     self-consistent at TWELVE (`:639-650` and the `:663-665` distribution row).

  **The authoritative list is TWELVE: CORR-02, CORR-05, RETAIN-04, RETAIN-05, OBS-03,
  OBS-05, XOS-06, XOS-07, TRUST-10, TRUST-11, TRUST-12, TRUST-13.** Pass it EXPLICITLY to
  the researcher, the planner, the plan-checker, the coverage gate, the security auditor
  and the verifier. Surfaced, NOT silently fixed in ROADMAP.md.

- **D-01:** Audit coverage against **REQUIREMENTS.md's own words, never ROADMAP.md's table
  or paraphrase.** Phase 8 caught ROADMAP's stale PARITY numbering exactly this way and
  Phase 9 caught three missing traceability rows; this phase's ROADMAP table is missing one
  requirement outright. Where the two disagree on substance, REQUIREMENTS.md wins.

- **D-02:** Two ROADMAP success-criteria claims are **already partly satisfied by Phase 9**
  and must not be read as gaps. (a) SC6 says the "~5 assets per push" estimate in `ci.yml`
  "reads about double" -- Phase 9 already corrected that comment upward to ~10, because
  each leg mirrored every restorable hash under its own suffix. CORR-02 collapses it back,
  so this phase corrects the SAME comment a THIRD time, downward. (b) SC2's "FOUR violation
  sites" list includes `cache-archive-path.spec.ts`, which left in Phase 9 with VER-02.

### The asset name and its single source (CORR-02, RETAIN-05c)

- **D-03:** `releaseAssetName(hash: Hash): string` returns
  `` `${CACHE_KEY_PREFIX}${hash}` `` -- it imports the prefix from `cache-key.ts` and
  composes it locally. It does **NOT** alias to `cacheKeyFor(hash)`, even though the two
  strings are byte-identical today. D2-03 requires the PREFIX single-sourced, and
  RETAIN-05(c) names four *distinct consumers* of that one prefix (the Actions-cache key,
  `isServerProducedKey`, the asset name, the cleanup filter) -- not two aliases of one
  builder. Aliasing would silently couple the Actions-cache key namespace to the Release
  asset namespace, so a later change to either would move both. Comment-lock the
  deliberate separation, because "these two functions return the same string, tidy them
  together" is exactly what a future reader will propose.

- **D-04:** `releaseAssetName`'s `platform` parameter is **DELETED, not defaulted away.**
  That deletion is what removes CORR-05 sites 2 and 3. `cachePlatform` and
  `CACHE_OS_VALUES` **SURVIVE** and are annotated as intentionally-kept so `fallow`
  dead-code analysis does not prune them: OBS-03 needs `cachePlatform` for the label, and
  RETAIN-04's legacy branch needs `CACHE_OS_VALUES`. RETAIN-04 names only
  `CACHE_OS_VALUES`; `cachePlatform` needs the same annotation for the same reason, and
  nothing in the requirements says so.

- **D-05:** `CACHE_KEY_PREFIX` is pinned by **extending the existing guard**
  (`cache-key.spec.ts:93` and `:128` already count authored occurrences), not by a new
  one, and its comment lock in `cache-key.ts:18-19` is widened to name all FOUR governed
  things plus the consequence: changing it orphans the entire mirror, and RETAIN-04's
  legacy branch does NOT cover the orphans because it only knows `<hash>-<os>`.

### The cleanup filter (RETAIN-04, RETAIN-05b)

- **D-06:** `isServerProducedAssetName` admits both families through **two separately
  named predicates** composed in one exported function -- a new-name branch (prefix +
  `HASH_PATTERN`) and a legacy branch (`HASH_PATTERN` + `-` + a `CACHE_OS_VALUES` member).
  Named separately because RETAIN-05(b) requires asserting them mutually exclusive
  *directly*, which needs two things to assert about. Lands in the SAME COMMIT as CORR-02
  (REQUIREMENTS' `Before/After` table, and RETAIN-04's own words): a publisher writing the
  new name against an unextended filter silently stops pruning.

- **D-07:** Mutual exclusivity is asserted **directly, over an adversarial table**, never
  inferred from the last-`-` split. The table must include the hybrids a reader will worry
  about -- `nx-cache-<hash>-linux`, `nx-cache-<hash>`, `<hash>-linux`, `nx-cache-` bare,
  `<hash>` bare -- and assert no name satisfies both branches. Disjointness is structural
  today (`HASH_PATTERN` forbids `-`, so a new-form name can never end in an OS token), but
  RETAIN-05(b)'s whole point is that this is currently "a property of the last-`-` split,
  not of the design".

- **D-08 (RETAIN-05a -- the explicit call):** The PoC-era `<hash>.tar.gz` assets are
  **RECORDED AS ACCEPTED DEAD WEIGHT WITH A MEASURED COUNT.** No third accept branch, no
  code change. MEASURED live 2026-07-29 via `gh api` -- and the requirement's "~50" is
  exact:

  | Family | Count | Matched by |
  |---|---|---|
  | `<hash>.tar.gz` (PoC-era) | **50** | NO filter, before or after RETAIN-04 |
  | `<hash>-linux` | 46 | RETAIN-04's legacy branch |
  | `<hash>-windows` | 26 | RETAIN-04's legacy branch |
  | `<hash>-macos` | 0 | - |
  | anything else | 0 | - |
  | **total in `cache-mirror-202607`** | **122** | of a 1000-asset cap |

  Rationale, in the order it decides: (1) a third accept branch WIDENS a DELETE filter that
  quick `260721-vdn` deliberately narrowed on security grounds, and `<hash>.tar.gz` is
  indistinguishable in shape from a foreign asset dropped into a genuine shard -- so it is
  the worst of the three sanctioned options, not merely the most work; (2) the month-shard
  scheme already bounds the exposure -- 122 of 1000 in a shard that rolls over on
  2026-08-01, so that shard's cap is now unreachable and the 50 are permanent occupants of
  a cap nothing will approach; (3) a one-off manual prune remains available to the
  maintainer and is explicitly NOT code and NOT this phase's work. Write the count and the
  bounding argument down so v0.0.3 does not re-derive them.

### The `mirrored-by` label (OBS-03)

- **D-09:** `uploadReleaseAsset` gains a **fourth positional `label: string`** parameter --
  `PublishClient` interface, the real Octokit adapter at `action/index.ts:89-104` (passing
  `label` straight into `octokit.rest.repos.uploadReleaseAsset`), and every fake in
  `publish-mirror.spec.ts`. Positional rather than an options object: there is exactly one
  call site and one implementation, and an options object for one field is the shape this
  repo's conventions reject.

- **D-10:** The value is `mirrored-by: <os>`, with `<os>` from **`cachePlatform()` called
  ONCE per `publishMirror` run, hoisted above the loop** -- not per iteration, and not
  injected through `PublishOptions` (which stays `{ now }`). The spec mocks
  `release-asset-name.js`'s `cachePlatform`, the precedent already shipped at
  `action/index.spec.ts:87`. Comment-lock OBS-03's **retraction** at the construction site:
  the label is the **PUBLISHING** leg's OS, NOT the producing OS. `listCacheEntries` returns
  `{ key }` only, and Phase 9 is precisely what broke the publisher-equals-producer
  identity -- so a "producing OS" claim would be WRONG in exactly the cross-OS case the
  label exists to serve. No doc, comment or threat-model line may claim the label answers
  "whose bytes did the developer get".

- **D-11:** The label is asserted as part of the `uploadReleaseAsset` **argument ARRAY**
  (deep equality over `.mock.calls`, Phase 9 D-11's shape), never by a separate
  `expect.stringContaining` -- and the OS axis is `it.each(CACHE_OS_VALUES)`, never "the OS
  this machine is not". Phase 9 measured both failure modes: a hand-authored `'linux'`
  literal was pinned at a CI sampling rate of ZERO because `test` runs ubuntu-only, and a
  negated matcher inside `toHaveBeenCalledWith` asserts "SOME call lacks X" rather than "NO
  call carries X". Negate the QUANTIFIER, not the predicate.

### OBS-05 -- the leg-distinguishable publish seed

- **D-12:** A **new single-source helper** derives the seed hash from the run id and the
  leg's OS. Three constraints are LOCKED; the exact encoding is Claude's discretion:
  1. **Lowercase hex only.** `HASH_PATTERN` is `^[a-f0-9]{1,512}$`, so `<run_id>-linux`
     is not representable as a cache hash. This is the constraint a planner will miss.
  2. **NOT all-decimal.** A run id and every Nx task hash are all-decimal (verified over
     153 entries, zero containing `a-f`; the reasoning is already in `ci.yml`'s publish
     comment). A hex-letter component makes the seed structurally disjoint from both, so
     collision arguments become structural rather than probabilistic -- appending a digit
     instead would leave a 12-digit all-decimal key in the same space as a run id.
  3. **The OS component single-sourced from `CACHE_OS_VALUES`**, so adding an OS cannot
     silently collide. Recommended shape: a hex-letter marker plus the tuple INDEX plus the
     run id (e.g. `e2<run_id>`), with a spec asserting `CACHE_OS_VALUES.length < 10` so the
     single-digit index stays injective.

- **D-13:** The seed is driven by a **new internal `operation` value** on the dogfood
  action (recommended `mirror-seed`). `operation: seed` is NOT re-purposed: `dogfood-seed`
  / `dogfood-verify` REQUIRE one shared key per RUN, and per-OS seeding there is exactly
  the vacuity trap VER-06 closed in Phase 9. VERIFIED this session that this does not
  breach D2-02 / PARITY-07: `packages/github-cache/action.yml` is INTERNAL by its own
  header, and `public-surface.spec.ts:53` enumerates only `start-cache-server/action.yml`'s
  inputs (`['port']`).

- **D-14:** **No workflow-side hash arithmetic.** The `publish` job keeps
  `hash: ${{ github.run_id }}`; the `mirror-seed` operation and `read-back.ts` each call the
  D-12 helper with `cachePlatform()`. One helper, two call sites, no YAML-to-TypeScript
  mapping to drift -- a per-leg `${{ matrix.os == ... && 'x' || 'y' }}` expression would put
  the OS mapping in two languages, the exact drift class this repo guards against.

- **D-15:** Once the producer is knowable per leg, `read-back.ts` **TIGHTENS back to an
  exact single-producer expectation** -- `read-back.ts:105-108` instructs precisely this and
  names the success line's producer as what a Phase 10 executor reads to confirm the
  tightening is correct. Its "DO NOT UNIFY THIS GUARD WITH dogfood-verify's" lock is
  **UPDATED, not deleted**: the asymmetry's justification was "publish's producer is
  genuinely VARIABLE", and OBS-05 is what makes it known by construction. Leaving that
  paragraph standing would be stale prose of exactly the class that shipped the Phase 9
  regression. OBS-05 lands **BEFORE** CORR-02 (REQUIREMENTS' `Before/After`), or
  `publish-verify` goes vacuous the moment the rename lands.

### XOS-07 -- what `publish` waits on

- **D-16:** Widen `needs: build` to **`needs: [build, typecheck, test, integration]`**. This
  does NOT contradict the existing comment ("needs: build (NOT test): a failing test leg
  must never skip the mirror and drop already-built entries") -- `publish` carries
  `if: ${{ !cancelled() && github.event_name == 'push' }}`, and `!cancelled()` runs the job
  even when a dependency FAILED. **Rewrite that comment in the SAME COMMIT** to record
  `!cancelled()` as the mechanism. Phase 9's learning applies verbatim: correcting a claim
  requires SUPPLYING A REPLACEMENT REASON, or a future reader is left holding a documented
  argument for narrowing `needs:` straight back. `integration` is a two-leg matrix with no
  `needs:` of its own, so depending on it waits for both legs.

### CORR-05 -- site 4 and the replacement proof

- **D-17 (the explicit call on site 4):** `release-asset-name.spec.ts:60`
  (`cachePlatform()` vs `cachePlatform(process.platform)`) **MOVES to a new
  `packages/github-cache/src/lib/release-asset-name.integration.spec.ts`**, co-located with
  the unit spec. Its `eslint-disable-next-line` directive leaves in the SAME COMMIT
  (LINT-06 `reportUnusedDisableDirectives: 'error'` fails on a directive left behind).

  This deliberately IMPROVES on ROADMAP SC2's recommendation of
  `server/public-server.integration.spec.ts` (which does exist -- verified), and the
  deviation is recorded rather than taken silently. Two reasons: cohesion (a
  `release-asset-name` default-argument contract does not belong in a spec about the public
  HTTP server), and STRENGTH -- `vitest.integration.config.mts` includes
  `{src,tests}/**/*.integration.spec.{ts,mts,cts}` and `ci.yml`'s `integration` job is a
  two-leg `[ubuntu-24.04-arm, windows-11-arm]` matrix, so the assertion would run on
  Windows too. Today it runs under `test`, which is ubuntu-ONLY, where
  `cachePlatform()` and `cachePlatform('linux')` are indistinguishable -- the same
  sampling-rate-of-zero defect Phase 9's validation found in `action/index.spec.ts`. Moving
  it into `integration` does not merely relocate the read, it makes the assertion bite.

  The assertion is MOVED, never deleted: OBS-03 keeps `cachePlatform` alive, so its
  default-argument contract stays live and deleting the test would drop real coverage.

- **D-18 (the named replacement):** `releases-backend.spec.ts:103-118` is CORR-01's
  documented non-vacuity proof and CORR-02 destroys it on purpose. The replacement lands in
  the SAME COMMIT and asserts three clauses: the reader requested **EXACTLY ONE** asset
  name, **EQUAL** to the imported `releaseAssetName(hash)`, and carrying **NO platform
  token** -- the third checked against the whole `CACHE_OS_VALUES` tuple, never against
  "the OS this machine is not" (which LINT-02 bans and which vacuity punishes).
  `releases-backend.spec.ts:128-134` already carries the exactly-one + equality half
  (`expect(client.requested).toEqual([releaseAssetName('abc123')])`); EXTEND it rather than
  author a third overlapping spec. Phase 8's learning stands: three guards for one
  invariant can share one blind spot.

### TRUST-10 / TRUST-11 / TRUST-12 / TRUST-13

- **D-19:** C1 (write-trust allowlist), C2 (sync gate) and C16's **Actions-cache-side**
  filter (`isServerProducedKey`) are **verified UNCHANGED by assertion, not claimed** -- a
  diff over the commit range, not a sentence. Only C16's **Releases-side** filter changes,
  and that change is additive (RETAIN-04). `listCacheEntries`' `ref` scoping
  (`action/index.ts:42-51`, located by CONTENT) is pinned by spec and comment-locked as the
  now-SOLE in-repo control keeping non-default-branch trusted writes out of the
  world-readable mirror -- `TRUSTED_EVENTS` includes `push` with no ref check, and the
  OS-version barrier is gone.

- **D-20:** `publish-mirror.ts`'s "the shard asset set is byte-identical under CORR-01"
  comment is rewritten in the **SAME COMMIT** as CORR-02: byte-identity SURVIVES, its
  REASON changes from OS-namespacing to one-entry-per-hash. Keyed by **QUOTED PHRASE, never
  line number** -- this phase's edits shift each other's lines within one commit, and
  `ci.yml` drifted ~220 lines inside one milestone. Use Phase 9's `DOCS_08_SITES` pattern.

- **D-21:** The remaining half Phase 9 explicitly deferred here -- **`ci.yml`'s
  `publish-verify` job comment**, which still says each OS leg reads back ONLY its own-OS
  asset and that this proves the same-OS publisher-to-reader contract. `read-back.ts:128-137`
  flags it by JOB NAME and warns: **TRUST-11 must NOT be closed on the strength of
  `read-back.ts` having already changed.** Phase 9's hardest-won learning applies to the
  sweep shape: a same-OS-invariant sweep must enumerate **EXECUTABLE code and CI prose**,
  not only docs -- Phase 9's documentation-scoped grep missed `read-back.ts` and a `ci.yml`
  capacity comment, and both were found only after the sweep declared itself complete.
  Also in this sweep: the `ci.yml` shard-growth estimate's THIRD correction (D-02a).

- **D-22:** **TRUST-13 is reached BY `gsd-security-auditor`, never self-certified inline.**
  The PLAN.md `<threat_model>` block carries TRUST-11 and TRUST-12 as **INPUT, explicitly
  not as the conclusion**, with TRUST-11's arbitration point CORRECTED: the differing-payload
  race is at **`saveCache`, not at the Release upload**, because two publish legs restore
  the SAME single Actions-cache entry and upload it verbatim without re-executing the task;
  the race only appears once XOS-04 puts `build`/`typecheck`/`test` on a Windows leg, which
  **moves TRUST-11's residual risk into the XOS-05 write decision** (a cross-phase
  consequence Phase 12 must inherit). The auditor's required reading includes
  `09-SECURITY.md` section 1 -- "the OS partition was never a security boundary", which is
  the reframing that makes the exposure delta assessable as bounded -- and Phase 9's commit
  range, because Phase 9 CREATED the delta TRUST-12 records.

- **D-23:** **XOS-06:** `max-parallel: 1` is RETAINED with a comment recording that it is
  NOT a correctness control and that no requirement depends on which leg wins the
  first-write-wins race. Two clauses the requirement does not supply, both needed so the
  comment survives contact with U-01 below: (a) state the REJECTED ordering argument by name
  so a future reader does not reconstruct it; (b) if U-01 resolves such that OBS-05's
  dead-leg DETECTION leans on within-run step order, that is **guard sensitivity, not a
  wrong-result guarantee** -- write the distinction down in both places rather than letting
  one comment appear to contradict the other.

### Sequencing (load-bearing)

- **D-24:** Order, encoded as `depends_on` in plan frontmatter and NOT as prose (Phase 8:
  "a comment asking an executor to preserve ordering is not a control; a `depends_on` graph
  is"):
  1. **XOS-02's pre-rename baseline** (D-25) -- before any rename commit AND before the
     merge to `main`.
  2. **OBS-03's `label` seam**, **XOS-07's `needs:` widening**, and the D-21 comment sweep
     -- all independent of the rename.
  3. **OBS-05** (leg-distinguishable seeds, the `mirror-seed` operation, `read-back.ts`
     tightened, its do-not-unify lock updated) -- strictly BEFORE CORR-02.
  4. **ONE COMMIT:** CORR-02 + RETAIN-04 + RETAIN-05 + CORR-05 sites 2/3 and their
     `eslint-disable` directives + D-20's comment rewrite + `npm run build:action`.
     RETAIN-04 and RETAIN-05 each carry a literal same-commit-as-CORR-02 rule, and LINT-06
     forces each disable out with its violation. This is explicitly NOT a phase split.
  5. **TRUST-10's pins** and the threat-model input for the auditor.
  6. **SC6's recorded-not-gated notes** (D-26).

- **D-25 (XOS-02's unrecoverable baseline):** **Capture a FRESH pre-rename baseline AND
  cite the existing record.** The existing qualifying record is
  `.planning/quick/260725-w3s-.../260725-w3s-STEP0-RESULTS.md` (local Windows
  `[remote cache]` HIT on `integration` from a Windows-CI-produced asset, 2026-07-26), and
  ROADMAP sanctions citing it. But that sanction was written on 2026-07-26, **before Phase 9
  rotated the `@actions/cache` version**, so citing it alone leaves Phase 11's
  "non-regression" comparison straddling TWO changes instead of one. Capturing costs one
  local `nx reset` + cold `integration` run behind the sidecar and loses nothing, while the
  window closes permanently the moment the rename lands. Take both: the fresh capture is the
  baseline of record and the 2026-07-26 record is the corroborating prior.

- **D-26 (recorded, not gated -- SC6):** Two facts get written down so v0.0.3 does not
  re-derive them. (a) After this phase the **Windows publish leg mirrors ZERO real assets**:
  under one name per hash, `max-parallel: 1` runs ubuntu first, ubuntu uploads every hash it
  can restore, and the Windows leg finds every name already present and takes the
  benign-no-op `skipped` branch. That is the strongest argument for the deferred single-leg
  collapse -- and it is deferred, not adopted here. (b) The **Phase 9-to-10 window doubled
  shard growth** (every hash mirrored under both `-linux` and `-windows` until the rename
  lands): bounded, NOT a correctness bug, and the live measurement in D-08 is its record.

- **D-27 (ROBUST-04 RECURS):** VERIFIED this session -- `start-cache-server/index.js`
  inlines the `release-asset-name` module and `cachePlatform` (2 occurrences). So
  **CORR-02's commit MUST run `npm run build:action` and stage the bundle in that SAME
  commit**, and `npm run check:action` goes in that plan's acceptance. Two Phase 9
  qualifications carry: the diff is CHECKED, never assumed empty (a lockfile re-resolution
  drifted it 88 lines with no source edit); and the check is only meaningful in the **MAIN
  tree** -- a junctioned `node_modules` in a git worktree made esbuild rewrite 689 lines
  with no source edit at all, which is the INVERSE fault with an identical symptom.

### Claude's Discretion

- The exact names of the two RETAIN-04 branch predicates and the D-12 seed helper.
- The D-12 encoding's marker character and whether the OS index is a prefix or a suffix,
  subject to its three locked constraints.
- The `operation` value's name for D-13 (`mirror-seed` is a suggestion, not a lock).
- Where the RETAIN-05(b) disjointness table and the D-19 `ref`-scoping pin live -- an
  existing spec versus a new cross-cutting drift guard.
- The filenames and format of D-25's baseline capture and D-26's recorded notes.
- Plan count and wave grouping, subject to D-24's ordering.

### UNRESOLVED -- withheld from auto-lock (HIGH impact, NOT-HIGH confidence)

- **U-01: Whether OBS-05's leg-distinguishable seeds actually make a dead Windows publish
  leg FAIL -- and if so, whether the detection rests on step ORDERING.**

  OBS-05's stated purpose is "so a Windows publish path that is entirely dead FAILS instead
  of passing on the ubuntu leg's asset". Traced against the post-Phase-9 code, that outcome
  is **not obviously delivered by distinguishable seeds alone.** `publishMirror` enumerates
  EVERY server-produced key in the ref's Actions cache and mirrors every one it can restore
  -- and since VER-01/VER-03, the ubuntu leg CAN restore a Windows-seeded entry. With the
  namespace collapsed, ubuntu would mirror `nx-cache-<windowsSeed>` under the identical
  name the Windows leg would have used, and the Windows `publish-verify` leg would HIT on
  ubuntu's upload. A dead Windows publish path would still pass.

  What appears to save it is **within-run step order**: under `max-parallel: 1` with the
  matrix ordered `[ubuntu-24.04-arm, windows-11-arm]`, the ubuntu leg's `publish` step
  completes BEFORE the Windows leg's seed step runs, so `nx-cache-<windowsSeed>` does not
  yet exist when ubuntu enumerates -- making the Windows leg the only possible publisher of
  its own seed. If that holds, OBS-05 works, but its non-vacuity is an ORDERING property in
  a milestone whose premise is removing accidental-correctness dependencies, and XOS-06 --
  a requirement of THIS phase -- says `max-parallel: 1` must not become a correctness
  control.

  IMPACT is HIGH: it decides whether OBS-05 ships a guard that detects what it claims, and
  it is the one place where two of this phase's own requirements pull against each other.
  CONFIDENCE is NOT HIGH: the mechanism is reasoned from source, not measured, and it
  depends on GitHub Actions matrix-leg serialisation semantics that this repo has measured
  for `dogfood-seed`/`dogfood-verify` (separate JOBS) but not for two legs of ONE matrix job.

  **`gsd-phase-researcher` OWNS this**, with a pre-stated falsifiable condition -- it is an
  empirical question, not a maintainer preference, so it belongs in RESEARCH.md, not a
  checkpoint. The check: read a real recent `publish` run's per-leg step timestamps and
  confirm the ubuntu leg's `publish` step ends before the Windows leg's seed step starts;
  then confirm from `publishMirror` that ubuntu's enumeration is a single `listCacheEntries`
  call taken at that time, not a re-read.

  **If ordering DOES carry the detection**, the resolution is additive, not a redesign:
  also assert the `mirrored-by` label on the read-back asset equals the reader's own OS
  (D-09's label is the only field that names the PUBLISHING leg), and comment-lock the
  ordering dependency in BOTH directions per D-23(b) -- as guard sensitivity, never as a
  wrong-result guarantee -- noting that the assertion would go RED on a correct
  implementation if `max-parallel: 1` were ever removed. **If ordering does NOT hold**, the
  Windows leg cannot be the sole publisher of its own seed and OBS-05 needs a different
  mechanism -- that is a re-pricing of the requirement, so stop and re-open it with the
  maintainer rather than auto-selecting a fallback.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Required reading, in this order

- `.planning/REQUIREMENTS.md` -- **FIRST, and it is the authoritative requirement text**
  (D-00/D-01). Specifically: `:70-73` (CORR-02), `:88-117` (CORR-05's four-site table, its
  sequencing consequence, and the `releases-backend.spec.ts:103-118` replacement clause),
  `:391-397` (RETAIN-04), `:399-409` (RETAIN-05's three parts), `:532-547` (OBS-03,
  including the RETRACTION), `:562-566` (OBS-05), `:379-387` (XOS-06, XOS-07),
  `:413-448` (TRUST-10..13), `:568-591` (the `Before/After` sequencing table),
  `:55-65` (D2-01..D2-06), `:592-602` (Out of Scope -- read it, four of the six rows are
  things a planner would otherwise reach for).
- `.planning/ROADMAP.md` `:338-432` -- the Phase 10 section: goal, SC1/1b/2/3/4/5/6, the
  Live-CI close, and the **Pre-condition owed to Phase 11**. Its Coverage Validation
  (`:591`) and traceability rows (`:560-570`) are KNOWN WRONG for this phase (D-00) -- read
  the section, not the table.
- `.planning/phases/09-os-invariant-actions-cache-version/09-LEARNINGS.md` -- the six
  Patterns are directly reusable here and three Lessons are load-bearing: the same-OS sweep
  must include EXECUTABLE code, `git grep` false-zeroes on untracked/gitignored paths,
  and a guard can be pinned at a CI sampling rate of ZERO.
- `.planning/phases/09-os-invariant-actions-cache-version/09-SECURITY.md` section 1 --
  "the OS partition was never a security boundary". **Required for `gsd-security-auditor`**
  (D-22): it is the reframing that makes TRUST-12's exposure delta assessable as bounded.
- `.planning/phases/09-os-invariant-actions-cache-version/09-EVIDENCE.md` -- the
  pre-Phase-9 producer-attribution snapshot (106 shard assets + 164 Actions-cache entries)
  and its ADDENDUM. Phase 11's TEST-08 depends on it; do not let this phase spend it.

### Project-level locks

- `.planning/PROJECT.md` `## Key Decisions` -- the five v0.0.2 rows, especially
  "Releases asset name is `nx-cache-<hash>`", "no OS-separation knob", and
  **"cross-OS sharing rests on target platform-agnosticism, NEVER on publish-leg
  ordering"** (the row U-01 tests).
- `.planning/PROJECT.md` `## Constraints` -- "changes made for this repo's own CI/hashing
  must never leak into the consumer contract".
- `.planning/THREAT-MODEL.md` -- the C1-C18 CREEP control ledger. **C1, C2 and C16 are
  what TRUST-10 verifies-not-assumes**; C16's "distinguishing namespace/prefix" is what
  D2-03 reads literally; C9 is the cleanup delete-path discipline RETAIN-04 extends.

### Files this phase edits or asserts on

- `packages/github-cache/src/lib/release-asset-name.ts` -- the rename, the deleted
  `platform` parameter, the intentionally-kept annotations on `cachePlatform` /
  `CACHE_OS_VALUES`, and the two-branch filter.
- `packages/github-cache/src/lib/release-asset-name.spec.ts` -- CORR-05 sites 3 and 4 and
  their `eslint-disable` directives; the RETAIN-05(b) disjointness table.
- `packages/github-cache/src/lib/release-asset-name.integration.spec.ts` (NEW) -- site 4's
  destination (D-17).
- `packages/github-cache/src/lib/cache-key.ts` `:18-19` + `cache-key.spec.ts` `:93`, `:128`
  -- `CACHE_KEY_PREFIX`'s widened comment lock and its existing authored-count guard.
- `packages/github-cache/src/backend/releases-backend.spec.ts` `:35-39` (CORR-05 site 2),
  `:103-118` (the destroyed non-vacuity proof), `:128-134` (the replacement's existing half).
- `packages/github-cache/src/cleanup/cleanup.ts` `:89` -- the single filter call site.
- `packages/github-cache/src/publish/publish-mirror.ts` -- `PublishClient.uploadReleaseAsset`
  (`:64-68`), the `releaseAssetName(hash)` call (`:226`), the upload call (`:269`), and the
  "byte-identical under CORR-01" comment (D-20, locate by phrase).
- `packages/github-cache/src/publish/publish-mirror.spec.ts` -- every `uploadReleaseAsset`
  fake gains the `label` argument (~10 sites).
- `packages/github-cache/src/action/index.ts` -- the Octokit adapter (`:89-104`), the
  `ref`-scoped `listCacheEntries` (`:42-51`), and the seed/verify branch (`:281-300`) where
  the `mirror-seed` operation lands.
- `packages/github-cache/src/roundtrip/read-back.ts` -- the seed-hash derivation (`:44`),
  the producer scan (`:138-140`), and the do-not-unify lock (`:110-137`) that D-15 updates.
- `packages/github-cache/src/roundtrip/read-back.spec.ts` -- its `it.each(CACHE_OS_VALUES)`
  provenance group tightens with D-15.
- `packages/github-cache/action.yml` -- the internal dogfood action's `operation` values.
- `.github/workflows/ci.yml` -- `publish` (`:1003-1115`: `needs:`, `max-parallel: 1`, the
  seed step, the shard-growth comment) and `publish-verify` (`:1117-1150`: the stale
  same-OS job comment). Locate by JOB NAME, never by line number.
- `packages/github-cache/src/docs-same-os-claims.spec.ts` -- Phase 9's `DOCS_08_SITES`
  guard; the D-21 sweep's new rows extend it, and it is the pattern to copy.
- `start-cache-server/index.js` -- the committed bundle, rebuilt in CORR-02's commit (D-27).

### In-repo precedent

- `packages/github-cache/src/action/index.spec.ts` `:65-100`, `:330-345` -- mocking
  `cachePlatform` while keeping `CACHE_OS_VALUES` real, and deriving the OS axis from the
  tuple rather than from the running machine. The template for D-11 and D-18.
- `packages/github-cache/src/lib/cache-key.ts` -- the single-source + comment-lock +
  authored-count-guard triad the asset name mirrors.
- `packages/github-cache/src/lib/dogfood-body.ts` -- a required-not-defaulted provenance
  parameter, and the sibling comment explaining why `releaseAssetName`'s default differed.
  D-04 deletes that default, so this comment needs a look.
- `packages/github-cache/src/lib/summary.ts` -- `writeCountSummary` and its recorded refusal
  to be widened for one caller.
- `.planning/codebase/TESTING.md` and `CONVENTIONS.md` -- spec placement (cross-cutting
  drift guards at `src/*.spec.ts`, cohesive modules co-located) and the comment-density
  rule. **STALE WARNING:** `.planning/codebase/*` was mapped 2026-07-22 against v0.0.1 and
  both PROJECT.md and STATE.md flag it as stale -- v0.0.2 invalidated it materially
  (new archive path, inferred `lint` target, ESLint in the toolchain). Use it for
  conventions, never for facts about the current tree.

### Measured this session (2026-07-29), not inherited

- `gh api repos/op-nx/github-cache/releases/tags/cache-mirror-202607` -- the D-08 asset
  census: 122 total, 50 `<hash>.tar.gz`, 46 `-linux`, 26 `-windows`, 0 `-macos`, 0 other.
- `gsd-tools query init.plan-phase 10` -- returns all TWELVE requirement IDs, with a
  trailing period on the last (D-00).
- `rg -c "cachePlatform" start-cache-server/index.js` -> 2, and the `release-asset-name`
  module is present -- ROBUST-04 recurs (D-27).
- `packages/github-cache/vitest.integration.config.mts:16` -- includes
  `{src,tests}/**/*.integration.spec.{ts,mts,cts}`, so D-17's new file is picked up by the
  `integration` target and runs on both OS legs.
- `public-surface.spec.ts:53` -- `EXPECTED_ACTION_INPUTS = ['port']`, read from
  `start-cache-server/action.yml` ONLY, so D-13 is not a public-surface change.

### Unpackaged findings

`.planning/spikes/MANIFEST.md` exists with no corresponding
`./.claude/skills/spike-findings-*/SKILL.md`. Run `/gsd:spike --wrap-up` if those findings
are needed; otherwise `.planning/research/v0.0.2/` is the current source.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/github-cache/src/lib/cache-key.ts` supplies `CACHE_KEY_PREFIX` and
  `HASH_PATTERN`, so CORR-02 re-authors no literal and RETAIN-04's new branch reuses the
  same hex class the old one did.
- `cache-key.spec.ts`'s authored-occurrence counter already exists for
  `CACHE_KEY_PREFIX` -- RETAIN-05(c)'s pin EXTENDS it rather than building a mechanism.
- `packages/github-cache/src/docs-same-os-claims.spec.ts` is Phase 9's phrase-keyed
  `DOCS_08_SITES` guard. D-21's sweep adds rows to a shipped, mutation-proven pattern.
- `action/index.spec.ts` already mocks `cachePlatform` while keeping `CACHE_OS_VALUES`
  real -- exactly the harness D-10's label assertions need.
- `read-back.spec.ts` already has an `it.each(CACHE_OS_VALUES)` provenance group; D-15
  tightens it rather than rewriting it.
- `ci.yml`'s `integration` job is a working two-leg `[ubuntu-24.04-arm, windows-11-arm]`
  matrix with `fail-fast: false` -- and D-17's new integration spec inherits it for free.
- `npm run check:action` already exists as `build:action && git diff --exit-code`, so D-27
  wires an existing script into acceptance.

### Established Patterns

- **Single source + comment lock + drift guard.** `cacheArchivePath` and
  `releaseAssetName` are the two canonical instances; this phase rewrites one of them.
- **Assert over the whole value set, never over "the OS this machine is not."** Phase 9's
  pattern: it makes the spec machine-independent so it bites at every-commit rate instead
  of on one runner, and it sidesteps LINT-02's ban.
- **Mutation-test the guard and predict which case reddens.** The only instrument that
  reliably separates a guard that bites from one that merely exists -- it DISPROVED two
  Phase 9 guards that looked fine.
- **Correcting a claim requires supplying a REPLACEMENT reason.** Deleting the old
  justification leaves a future reader holding a documented argument for undoing the work.
- **Prove a guard can fail on a fixture AND on a real leg**, where a real leg is available.
- **Fail-closed writes, best-effort reads.** A read fault degrades to a MISS; the cleanup
  LIST phase aborts with zero deletions on any fault.
- **`rg`, never `git grep`, for an absence claim** -- `git grep` false-zeroes on untracked
  and gitignored paths and the zero reads as confirmation. Recurred three times in Phase 9.

### Integration Points

- `releaseAssetName` -- two production callers (`releases-backend.ts:75` reader,
  `publish-mirror.ts:226` publisher) plus `isServerProducedAssetName`'s one cleanup caller
  (`cleanup.ts:89`). Three call sites, one helper; that is the whole seam CORR-02 moves.
- `PublishClient.uploadReleaseAsset` -- the OBS-03 `label` widening crosses the interface,
  the real Octokit adapter, and ~10 spec fakes.
- `publishMirror`'s enumerate -> restore -> upload loop -- where the label is stamped and
  where U-01's dead-leg question lives.
- `ci.yml` `publish` / `publish-verify` -- `needs:`, `max-parallel: 1`, the seed operation,
  and two stale comments.
- `serve()` graph -> `start-cache-server/index.js` -- the bundle boundary that makes
  ROBUST-04 bite on CORR-02's commit.

</code_context>

<specifics>
## Specific Ideas

- **The 1000-asset cap framing in RETAIN-05(a) is per-SHARD, and that changes the answer.**
  The 50 unprunable PoC-era assets are permanent occupants of `cache-mirror-202607`'s cap
  only. That shard holds 122 assets and rolls over on 2026-08-01, so its cap is now
  unreachable. "Permanent occupants of the 1000-asset cap" is true and also bounded -- which
  is why D-08 records rather than prunes.
- **Every line-number citation in this phase's requirements predates ~220 lines of `ci.yml`
  churn plus Phase 9's edits.** Locate by CONTENT or by JOB NAME. Phase 9 tabulated the
  drift for exactly this reason and it saved its verifier from reading content-located edits
  as unauthorised drift.
- **This phase's success criteria are explicit about what does NOT count**, and each is an
  anti-requirement: a presence-only `publish-verify` check (OBS-05); a "producing OS" claim
  for the label (OBS-03's retraction); a self-certified TRUST-11/12 classification
  (TRUST-13); an ordering-based cross-OS-safety argument (XOS-06 and the PROJECT.md row);
  a filter whose branch-disjointness is a property of the split rather than of the design
  (RETAIN-05b).
- **CORR-02 is rotation window 3 of 3** in this milestone. Phase 9's OBS-04 tripwire is
  calibrated to exactly three and fires only on two consecutive all-miss pushes with no
  version-affecting change between them -- so this rename must not author anything that
  fires on window 3, and the first post-rename default-branch push publishing nothing is
  EXPECTED. If it coincides with Phase 9's rotation push, expect nothing at all.
- **`09-EVIDENCE.md`'s ADDENDUM, not the merge run, is the OBS-04 record.** The rotation
  signal is SPENT (sampled on run `30400231720`); a later merge shows all-HIT. Do not cite
  a fresh run as the rotation observation.
- **Phase 9 left two live-CI `human_needed` items at the real merge**
  (`publish-verify (windows-11-arm)` green with a `'linux'` producer line, and OBS-04's
  spent signal). This phase's Live-CI close adds a third: a default-branch push must
  republish the mirror under the new name before Phase 11's proofs can run.

</specifics>

<deferred>
## Deferred Ideas

- **Collapsing the publish matrix to one leg.** D-26(a) records the strongest argument for
  it -- the Windows leg mirrors ZERO real assets after this phase -- and it stays DEFERRED:
  REQUIREMENTS' Out of Scope makes it safe only AFTER XOS-05 is proven (Phase 12), and the
  Windows leg is still the only leg that produces Windows-hash entries at all.
- **A one-off manual prune of the 50 PoC-era `<hash>.tar.gz` assets.** D-08 records them
  instead. Available to the maintainer as an operational action; explicitly not code and
  not this phase's work.
- **Read-fallback across old and new asset names.** Out of scope (REQUIREMENTS) -- our own
  mirror repopulates on the next default-branch push, and there are no adopters.
- **A per-job or per-target OS-invariance flag.** Out of scope, and for the stronger reason
  than adopter count: every comparator puts the portability knob in the task DECLARATION,
  never in the cache BACKEND. "Wrong layer" does not expire the way "zero adopters" does.
- **XOS-01 / XOS-02 / XOS-03 / TEST-08 / TEST-09 / TEST-10 / OBS-02** -- Phase 11. This
  phase produces two preconditions (D-25's baseline and the warm-mirror push) and never a
  proof.
- **XOS-04 / XOS-05 / XOS-08 and the O4 write decision** -- Phase 12, gated on XOS-01 being
  PROVEN. Consequence carried forward: TRUST-11's residual risk moves into the XOS-05 write
  decision (D-22), and if the Windows legs write, the attribution loss is appended to this
  phase's threat-model record.
- **DOCS-07's consumer portability recipe** -- Phase 12.
- **Regenerating `.planning/codebase/*`** via `/gsd:map-codebase` -- flagged stale in both
  PROJECT.md and STATE.md, listed in Operator Next Steps, and not this phase's work. Treat
  those maps as conventions-only until it happens.
- **The unattributed `test` failure at `69bd1b7`** -- still open in
  `08-nx-task-hash-parity/deferred-items.md`. If `test` fails once here, capture the output
  BEFORE re-running; the re-run destroys the evidence.
- **A cross-process advisory lock for the archive path** -- the recorded ceiling in
  `cache-archive-path.ts`; unchanged by this phase.

</deferred>

---

*Phase: 10-OS-Invariant Releases Mirror*
*Context gathered: 2026-07-29*
