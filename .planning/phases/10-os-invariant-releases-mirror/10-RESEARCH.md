# Phase 10: OS-Invariant Releases Mirror - Research

**Researched:** 2026-07-29
**Domain:** GitHub Releases asset naming + GitHub Actions matrix scheduling + Nx remote-cache guard non-vacuity
**Confidence:** HIGH (every load-bearing claim MEASURED this session; the two CITED-only claims are named in the Assumptions Log)

**Measurement environment (PARITY-06 discipline):** Nx `23.1.0`, Node `v24.13.0`, npm `11.6.2`,
HEAD `c4a3b88` on `gsd/v0.0.2-os-invariant-cross-os-sharing`, MAIN TREE (not a worktree, no
junctioned `node_modules`), warm `.nx/workspace-data`. Live GitHub reads via `gh api` at
2026-07-29. Install mode: local `npm install` tree (NOT `npm ci`) -- relevant only to the bundle
note in Sequencing hazards, and that note is about NOT trusting a worktree, which does not apply
here.

---

## Summary

Three findings change how this phase should be planned.

**1. U-01 resolves in the affirmative, and more sharply than CONTEXT.md guessed.** Ordering DOES
carry OBS-05's dead-Windows-publish detection -- measured 5/5 across the five most recent
default-branch `publish` runs, with a 150-190 second margin -- but the dependency is *narrower*
than "ubuntu goes first". The general law is: **under `max-parallel: 1`, the leg that runs LAST
is the only leg whose dead publish path is detectable; the leg that runs FIRST is covered for by
the second leg.** OBS-05 names Windows, and Windows measurably runs last, so OBS-05 works. GitHub
documents matrix *creation* order but says nothing about `max-parallel` execution order, and the
two legs sit in **different runner pools** (`ubuntu-24.04-arm` vs `windows-11-arm`), so runner
availability is a genuinely independent per-leg scheduling variable. The additive resolution
CONTEXT.md pre-authorised is therefore not merely belt-and-braces: asserting the OBS-03
`mirrored-by` label on the read-back asset **converts the dependency from ordering (undocumented,
availability-sensitive) to non-overlap (`max-parallel: 1`'s own documented in-repo purpose)** and
makes the guard symmetric across both legs. Take it.

**2. XOS-07's race is not hypothetical -- it is measured, with an asset-census fingerprint.** On
run `30400231720`, `publish (ubuntu-24.04-arm)`'s enumeration ran at ~21:21:11 while
`integration (windows-11-arm)` did not finish until **21:23:13**. The Windows `integration` task
hash `8059758544828235640` therefore appears in the shard **only** under `-windows`, never under
`-linux`. The mirror is currently completing only because the Windows publish leg happens to run
second and slowly. This gives XOS-07 a citable live justification rather than a projection -- and
it exposes a coupling CONTEXT.md does not state: **D-26(a) ("the Windows publish leg mirrors ZERO
real assets") is TRUE only because XOS-07 lands in this same phase.** Without the widened
`needs:`, the Windows leg would remain the sole mirrorer of the Windows `integration` hash.

**3. `CORR-02` will TREE-SHAKE `cachePlatform` out of the committed bundle.** `start-cache-server/index.js`
inlines `cachePlatform` today only because `releaseAssetName` calls it. Proof that esbuild does
drop unused exports from that very module: `isServerProducedAssetName` and `CACHE_OS_VALUES` are
both already absent from the bundle. So CORR-02's `npm run build:action` diff is *predictable*:
the `cachePlatform` function disappears and `releaseAssetName`'s body changes. Predict it in the
plan so a reviewer does not read a legitimate removal as collateral damage.

**Primary recommendation:** plan five waves in D-24's order, with OBS-05 (wave 3) carrying the
`mirrored-by`-label read-back assertion as its non-vacuity control, and CORR-02+RETAIN-04+RETAIN-05
+CORR-05+D-20+`build:action` as one commit (wave 4) executed in the MAIN tree only.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Verbatim from `10-CONTEXT.md` `## Implementation Decisions`. All 27 (D-00..D-27) are LOCKED and
are NOT re-litigated by this research. Where a measurement contradicts one, it is recorded in
`## Corrections to CONTEXT.md` rather than silently worked around.

- **D-00:** `init.plan-phase 10` returns all TWELVE IDs (measured); last ID arrives as `TRUST-13.`
  with a trailing period; ROADMAP is internally inconsistent (`:591` says 11, `:560-570` omits
  `RETAIN-05`). Authoritative list is TWELVE. Surfaced, not silently fixed.
- **D-01:** Audit coverage against REQUIREMENTS.md's own words, never ROADMAP.md's table.
- **D-02:** (a) SC6's "~5 assets per push reads about double" was already corrected upward to ~10
  by Phase 9; this phase corrects the SAME comment a THIRD time, downward. (b) SC2's four-site
  list includes `cache-archive-path.spec.ts`, which left in Phase 9 with VER-02.
- **D-03:** `releaseAssetName(hash)` returns `` `${CACHE_KEY_PREFIX}${hash}` `` composed locally
  from the imported prefix. It does NOT alias `cacheKeyFor(hash)`. Comment-lock the deliberate
  separation.
- **D-04:** the `platform` parameter is DELETED, not defaulted away. `cachePlatform` and
  `CACHE_OS_VALUES` SURVIVE with intentionally-kept annotations (both, not just `CACHE_OS_VALUES`).
- **D-05:** `CACHE_KEY_PREFIX` pinned by EXTENDING the existing `cache-key.spec.ts` authored-count
  guard; its comment lock widened to name all FOUR governed things plus the orphaning consequence.
- **D-06:** `isServerProducedAssetName` admits both families through TWO separately named
  predicates composed in one exported function. Same commit as CORR-02.
- **D-07:** mutual exclusivity asserted DIRECTLY over an adversarial table, never inferred from the
  last-`-` split.
- **D-08 (RETAIN-05a):** the 50 PoC-era `<hash>.tar.gz` assets are RECORDED AS ACCEPTED DEAD WEIGHT
  WITH A MEASURED COUNT. No third accept branch, no code change. Census: 122 total in
  `cache-mirror-202607` -- 50 `.tar.gz`, 46 `-linux`, 26 `-windows`, 0 `-macos`, 0 other.
- **D-09:** `uploadReleaseAsset` gains a FOURTH POSITIONAL `label: string` parameter across the
  `PublishClient` interface, the real Octokit adapter, and every fake.
- **D-10:** value is `mirrored-by: <os>` from `cachePlatform()` called ONCE per `publishMirror` run,
  hoisted above the loop; NOT injected through `PublishOptions` (stays `{ now }`). Comment-lock
  OBS-03's RETRACTION at the construction site: the label is the PUBLISHING leg's OS, NOT the
  producing OS.
- **D-11:** the label is asserted as part of the `uploadReleaseAsset` ARGUMENT ARRAY (deep equality
  over `.mock.calls`), never via a separate `expect.stringContaining`; the OS axis is
  `it.each(CACHE_OS_VALUES)`, never "the OS this machine is not". Negate the QUANTIFIER, not the
  predicate.
- **D-12:** a NEW single-source helper derives the seed hash from the run id and the leg's OS.
  Three LOCKED constraints: (1) lowercase hex only; (2) NOT all-decimal; (3) OS component
  single-sourced from `CACHE_OS_VALUES`. Exact encoding is Claude's discretion.
- **D-13:** the seed is driven by a NEW internal `operation` value (recommended `mirror-seed`).
  `operation: seed` is NOT re-purposed. Verified not a D2-02/PARITY-07 breach.
- **D-14:** NO workflow-side hash arithmetic. `publish` keeps `hash: ${{ github.run_id }}`; the
  `mirror-seed` operation and `read-back.ts` each call the D-12 helper with `cachePlatform()`.
- **D-15:** `read-back.ts` TIGHTENS back to an exact single-producer expectation; its
  "DO NOT UNIFY" lock is UPDATED, not deleted. OBS-05 lands BEFORE CORR-02.
- **D-16:** widen `needs: build` to `needs: [build, typecheck, test, integration]`; rewrite the
  existing "needs: build (NOT test)" comment in the SAME COMMIT to record `!cancelled()` as the
  mechanism.
- **D-17:** `release-asset-name.spec.ts:60` MOVES to a new
  `packages/github-cache/src/lib/release-asset-name.integration.spec.ts`; its
  `eslint-disable-next-line` leaves in the SAME COMMIT. Deliberate improvement on ROADMAP SC2's
  `public-server.integration.spec.ts` recommendation, recorded rather than taken silently.
- **D-18:** the CORR-01 non-vacuity replacement EXTENDS `releases-backend.spec.ts:128-134` and
  asserts three clauses: EXACTLY ONE requested name, EQUAL to `releaseAssetName(hash)`, carrying
  NO platform token checked against the whole `CACHE_OS_VALUES` tuple.
- **D-19:** C1, C2 and C16's Actions-cache-side filter verified UNCHANGED by assertion (a diff over
  the commit range, not a sentence). `listCacheEntries`' `ref` scoping pinned by spec and
  comment-locked as the now-SOLE in-repo control.
- **D-20:** `publish-mirror.ts`'s "byte-identical under CORR-01" comment rewritten in the SAME
  COMMIT as CORR-02; keyed by QUOTED PHRASE, never line number.
- **D-21:** the D-21 sweep owns `ci.yml`'s `publish-verify` job comment plus the shard-growth
  estimate's THIRD correction. A same-OS-invariant sweep must enumerate EXECUTABLE code and CI
  prose, not only docs.
- **D-22:** TRUST-13 is reached BY `gsd-security-auditor`, never self-certified inline. TRUST-11's
  arbitration point CORRECTED to `saveCache`, not the Release upload.
- **D-23 (XOS-06):** `max-parallel: 1` RETAINED with a comment recording it is NOT a correctness
  control; (a) state the REJECTED ordering argument by name; (b) if U-01 leans on within-run step
  order, that is GUARD SENSITIVITY, not a wrong-result guarantee -- write it in both places.
- **D-24:** ordering encoded as `depends_on` in plan frontmatter, NOT prose. Six steps: (1) XOS-02
  baseline; (2) OBS-03 label seam + XOS-07 `needs:` + D-21 sweep; (3) OBS-05; (4) ONE COMMIT
  (CORR-02 + RETAIN-04 + RETAIN-05 + CORR-05 sites 2/3 + D-20 + `npm run build:action`);
  (5) TRUST-10 pins + threat-model input; (6) SC6 recorded notes.
- **D-25:** capture a FRESH pre-rename XOS-02 baseline AND cite the existing 2026-07-26 record.
- **D-26:** recorded, not gated -- (a) Windows publish leg mirrors ZERO real assets; (b) the Phase
  9-to-10 window doubled shard growth.
- **D-27 (ROBUST-04 RECURS):** CORR-02's commit MUST run `npm run build:action` and stage the
  bundle in that SAME commit; `npm run check:action` in that plan's acceptance; the diff is
  CHECKED, never assumed empty; the check is only meaningful in the MAIN tree.

### Claude's Discretion

- The exact names of the two RETAIN-04 branch predicates and the D-12 seed helper.
- The D-12 encoding's marker character and whether the OS index is a prefix or a suffix, subject to
  its three locked constraints.
- The `operation` value's name for D-13 (`mirror-seed` is a suggestion, not a lock).
- Where the RETAIN-05(b) disjointness table and the D-19 `ref`-scoping pin live -- an existing spec
  versus a new cross-cutting drift guard.
- The filenames and format of D-25's baseline capture and D-26's recorded notes.
- Plan count and wave grouping, subject to D-24's ordering.

### Deferred Ideas (OUT OF SCOPE)

- **Collapsing the publish matrix to one leg.** Deferred until XOS-05 is proven (Phase 12).
- **A one-off manual prune of the 50 PoC-era `<hash>.tar.gz` assets.** Operational, not code.
- **Read-fallback across old and new asset names.** Out of scope -- the mirror repopulates on the
  next default-branch push; zero adopters.
- **A per-job or per-target OS-invariance flag.** Wrong LAYER, not merely YAGNI.
- **XOS-01 / XOS-02 / XOS-03 / TEST-08 / TEST-09 / TEST-10 / OBS-02** -- Phase 11. This phase
  produces two preconditions and never a proof.
- **XOS-04 / XOS-05 / XOS-08 and the O4 write decision** -- Phase 12.
- **DOCS-07's consumer portability recipe** -- Phase 12.
- **Regenerating `.planning/codebase/*`** -- not this phase's work; conventions-only until then.
- **The unattributed `test` failure at `69bd1b7`** -- capture output BEFORE re-running.
- **A cross-process advisory lock for the archive path** -- unchanged by this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

**TWELVE.** Audited against `REQUIREMENTS.md`'s own words (D-01), not ROADMAP's table.

| ID | REQUIREMENTS.md anchor | Research support |
|----|------------------------|------------------|
| CORR-02 | `:70-73` | `## CORR-02` below: `releaseAssetName` rewrite, its 4 production + ~8 spec consumers enumerated, the predicted bundle tree-shake |
| CORR-05 | `:88-117` | `## CORR-05` below: exactly THREE extant sites (not four -- one left in Phase 9), the `CORR_05_SITES` table empties, the D-18 replacement's three clauses |
| RETAIN-04 | `:391-397` | `## RETAIN-04` below: two-branch filter, disjointness MEASURED over 26 adversarial cases + 1.6M randomised candidates, 0 collisions |
| RETAIN-05 | `:399-409` | `## RETAIN-05` below: (a) the 122/50/46/26/0/0 census; (b) the structural disjointness MECHANISM (the prefix contains a `-`); (c) the existing `cache-key.spec.ts` cross-file count guard extended |
| OBS-03 | `:532-547` | `## OBS-03` below: `label` VERIFIED as a free-form optional query param, returned by `listReleaseAssets`, absent from the name and the download URL; backfill possible via PATCH |
| OBS-05 | `:562-566` | `## U-01 Resolution` + `## OBS-05` below: the seed encoding, the `mirror-seed` operation's `url` trap, and the `mirrored-by` read-back assertion that removes the ordering dependency |
| XOS-06 | `:379-384` | `## XOS-06` below: no spec pins `max-parallel: 1` today; the ordering-vs-serialisation distinction to comment-lock in both directions |
| XOS-07 | `:385-387` | `## XOS-07` below: the race MEASURED on run `30400231720`; `!cancelled()` semantics CITED from GitHub docs; `integration` confirmed to have no `needs:` of its own |
| TRUST-10 | `:413-419` | `## TRUST-10` below: C1/C2/C16 diff scope, the `ref`-scoping pin's real location (`action/index.ts:42-51`, cited as `:40-43`) |
| TRUST-11 | `:421-437` | `## TRUST-11` below: threat-model input text, the `saveCache` correction, the single-`listCacheEntries` proof |
| TRUST-12 | `:439-443` | `## TRUST-12` below: exposure-delta input, bounded by 09-SECURITY section 1's reframing |
| TRUST-13 | `:445-448` | `## TRUST-13` below: what the PLAN.md `<threat_model>` block must carry for an independent classification |

</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Consequence for this phase |
|-----------|----------------------------|
| **PUBLIC repo -- no work email or its bare domain in committed content** | Nothing in this phase authors contact details. `governance-email.spec.ts` already guards it. No action, but do not paste any `gh api` output containing a committer email into an artifact. |
| **Run Nx tasks through `npx nx` / `npm run <script>`, never the underlying tool** | Acceptance commands must be `npx nx run @op-nx/github-cache:test`, `npm run typecheck`, `npm run lint`, `npm run integration`, `npm run check:action`. |
| **Never use `grep` or the Grep tool; `git grep` for tracked, `rg` for everything else** | Any "no occurrence of X" acceptance criterion uses `rg`. `git grep -c` counts LINES, not occurrences -- an occurrence criterion must use `countAuthored`-style counting or `git grep -o`. |
| **Vitest is the runner** | `vi.mock` partial-module idiom is the established harness (`action/index.spec.ts:87`). |
| **No emojis / non-ASCII in output** | Applies to every comment and message this phase authors. `[OK]` / `->` / `--`. |
| **Never `git add .` / `-A` / `-u`; stage by name** | The one-commit wave 4 stages ~10 named paths INCLUDING `start-cache-server/index.js`. |
| **`git commit -m` fails EINVAL on this Dev Drive (ReFS)** | Use `git commit -F <file>`. |
| **Worktree `node_modules` junction breaks `check:action`** | `npm run check:action` is only meaningful in the MAIN tree (D-27). If wave 4 runs in a worktree, the bundle verdict must be deferred to the main tree. |
| **GSD entry points** | All edits go through `/gsd:execute-phase`. |

---

## U-01 Resolution

**Verdict: ordering DOES currently carry OBS-05's dead-Windows-publish detection.** Take
CONTEXT.md's additive branch -- and the additive assertion turns out to *remove* the ordering
dependency rather than merely annotate it.

### (a) Measured per-leg step timestamps -- 5/5, margin 150-190s

Every push run of `ci.yml` currently on record. Step `#6` is the seed step
(`uses: ./packages/github-cache` with `operation: seed`); step `#7` is the publish step. Read via
`gh api repos/op-nx/github-cache/actions/runs/<id>/jobs?per_page=100 --paginate`.

| Run id | Date | ubuntu `publish` step END | windows `seed` step START | Margin | Order |
|--------|------|---------------------------|---------------------------|--------|-------|
| `30401077417` | 2026-07-28 | `21:33:39Z` | `21:36:32Z` | **173 s** | ubuntu first |
| `30400231720` | 2026-07-28 | `21:21:27Z` | `21:24:32Z` | **185 s** | ubuntu first |
| `30200859202` | 2026-07-26 | `11:50:54Z` | `11:53:27Z` | **153 s** | ubuntu first |
| `30197079037` | 2026-07-26 | `09:48:10Z` | `09:51:21Z` | **191 s** | ubuntu first |
| `30181729913` | 2026-07-26 | `00:47:34Z` | `00:50:11Z` | **157 s** | ubuntu first |

Job-level serialisation is also confirmed: on `30401077417` the whole ubuntu job completed
`21:33:40Z` and the Windows job started `21:33:42Z` -- a 2-second gap, i.e. `max-parallel: 1`
serialises at the JOB level, so the two legs never overlap at all. The margin's *source* is the
Windows `npm ci` step: 2m14s on `windows-11-arm` (`21:34:08Z -> 21:36:22Z`) versus 16s on ubuntu.

**Cited run/timestamps for the plan:** run `30401077417`, `publish (ubuntu-24.04-arm)` step 7 ends
`2026-07-28T21:33:39Z`; `publish (windows-11-arm)` step 6 starts `2026-07-28T21:36:32Z`.

### (b) The enumeration is a SINGLE `listCacheEntries()` call -- CONFIRMED

`packages/github-cache/src/publish/publish-mirror.ts:177`:

```ts
const entries = await client.listCacheEntries();
```

One call, before the loop, assigned to a `const`. The dedup at `:190-200` maps over that same
array. The `for (const hash of hashes)` loop at `:215` iterates the frozen list; nothing inside the
loop re-reads the Actions cache (`actionsCache.get(hash)` is a per-hash RESTORE, not an
enumeration). `listReleaseAssets` IS read lazily inside the loop (`:247`) but that reads the
RELEASE, not the cache. So a leg's view of the Actions-cache key set is a single instantaneous
snapshot taken at its publish step's start. CONFIRMED.

### (c) Does `max-parallel: 1` guarantee leg ordering? NO -- and this is a finding, not a gap

GitHub's `workflow-syntax` reference documents `max-parallel` as exactly one sentence, with no
order clause:

> `jobs.<job_id>.strategy.max-parallel` -- By default, GitHub will maximize the number of jobs run
> in parallel depending on runner availability.

The only documented order statement is about **creation**, in the `strategy.matrix` section:

> The order of the variables in the matrix determines the order in which the jobs are created. The
> first variable you define will be the first job that is created in your workflow run.

So: **creation order follows declaration order (documented). Execution/start order under
`max-parallel` is NOT documented.** In practice a serialised queue drained in creation order
yields declaration order, and we measured 5/5 -- but the guarantee is absent, and the docs
explicitly name *runner availability* as a scheduling input. The falsifier is concrete and
specific to this matrix: the two legs use **different runner labels**
(`ubuntu-24.04-arm`, `windows-11-arm`), i.e. different hosted pools. A scheduler honouring
`max-parallel: 1` while starting the first *available* job could start Windows first if the ubuntu
arm pool were saturated. A same-runner matrix would not have this axis; ours does.

### The actual law, which is narrower than "ubuntu first"

Trace the four cases. `S_os` = that leg's mirror seed key `nx-cache-<seed_os>`.

| Case | What happens | Is a DEAD Windows publish detected? |
|------|--------------|-------------------------------------|
| ubuntu first, Windows publish healthy | ubuntu enumerates before `S_win` exists -> cannot mirror it. Windows seeds, enumerates, uploads `S_win`. | n/a (healthy) |
| **ubuntu first, Windows publish DEAD** | ubuntu never saw `S_win`. Nobody uploads it. `publish-verify (windows)` MISSES -> **RED**. | **YES** |
| Windows first, Windows publish healthy | Windows seeds + uploads `S_win`. ubuntu then enumerates, sees the name already present, takes the `skipped` no-op branch. | n/a (healthy) |
| **Windows first, Windows publish DEAD** | Windows seeds `S_win` but never uploads. ubuntu then enumerates, SEES `S_win` (cross-OS restore works since VER-01/VER-03), restores it, and uploads `nx-cache-<seed_win>`. `publish-verify (windows)` **HITS on ubuntu's upload -> GREEN**. | **NO -- VACUOUS** |

Generalised: **the leg that runs LAST is the only leg whose dead publish path is detectable.** The
second leg's enumeration necessarily post-dates the first leg's seed, so it covers for the first
leg. This is symmetric: under the measured ubuntu-first ordering, a dead *ubuntu* publish path is
equally undetectable (Windows would mirror `nx-cache-<seed_linux>` and `publish-verify (ubuntu)`
would pass).

OBS-05's stated purpose names *Windows*, and Windows measurably runs LAST, so **OBS-05 as written
is satisfied by distinguishable seeds under the measured ordering** -- but its non-vacuity is a
property of GitHub's undocumented start order, in exactly the milestone whose premise is removing
accidental-correctness dependencies.

### The resolution: assert the `mirrored-by` label on the read-back asset

D-09's `label` is the ONLY field that names the PUBLISHING leg. Adding to `read-back.ts` the
assertion **"the shard asset `nx-cache-<mySeed>` carries `label === 'mirrored-by: ' + cachePlatform()'`"**:

- **Detects a dead publish path on EITHER leg, under EITHER ordering.** In the Windows-first-dead
  case the asset exists but was uploaded by ubuntu, so its label reads `mirrored-by: linux` while
  the Windows reader expects `mirrored-by: windows` -> RED. The ordering dependency is gone.
- **Its remaining dependency is NON-OVERLAP, not order.** With `max-parallel: 1` removed and the
  legs concurrent, ubuntu could win the upload race for `nx-cache-<seed_win>` (Windows then 422s
  into the benign `skipped` branch) and the label assertion would go RED on a **correct**
  implementation. That is the caveat U-01 named, and it is real. But non-overlap is precisely what
  `ci.yml:1008` already documents `max-parallel: 1` as existing for ("max-parallel 1 serializes
  the OS legs (WR-01)"), whereas *start order* is a property GitHub does not document at all. The
  additive assertion therefore trades an undocumented external guarantee for a documented in-repo
  one. That is a strict improvement, not a lateral move.
- **It is the ONLY mechanism that detects a dead publisher.** D-15's payload tightening does NOT:
  the bytes of `nx-cache-<seed_win>` are `dogfoodBody(seed_win, 'windows')` regardless of which
  leg *uploaded* them, because the SEED was written by Windows. Provenance-of-payload and
  provenance-of-publisher are different axes and only the label carries the second. Write this
  distinction into the comment lock -- a reader will otherwise assume D-15 already covers it.

### Why this does NOT breach XOS-06 or PROJECT.md's rejected-ordering row

`PROJECT.md` `## Key Decisions` row: *"cross-OS sharing rests on target platform-agnosticism,
NEVER on publish-leg ordering"*, with the rationale *"it would rest a **wrong-result guarantee**
on CI job scheduling"*. XOS-06: *"`max-parallel: 1` ... MUST NOT become a correctness control. No
requirement may depend on which OS leg wins the first-write-wins race."*

The line I draw, and defend:

- **Forbidden: a WRONG-RESULT guarantee resting on ordering.** "The artifact a developer receives
  is correct *because* ubuntu published first" would be forbidden. Nothing in this phase says
  that. Correctness of a served artifact rests on CORR-05's platform-agnosticism; both legs upload
  byte-identical bytes restored from the SAME single Actions-cache entry (TRUST-11), so the race
  winner is immaterial to what any reader gets.
- **Acceptable-with-record: a GUARD's SENSITIVITY resting on serialisation.** `publish-verify`'s
  ability to *detect* a dead publish path is a CI observability property, not a correctness
  property. If it degrades, a real defect goes unnoticed -- it does not make a wrong artifact
  reachable. Its dependency is on non-overlap (`max-parallel: 1`'s stated purpose), and it depends
  on **neither leg's identity nor the race winner**, so XOS-06's literal clause ("no requirement
  may depend on which OS leg wins the race") is not engaged at all.
- **The distinction is testable, which is why it is not sophistry.** Remove `max-parallel: 1` and
  ask: does any reader get wrong bytes? No. Does a CI guard lose sensitivity? Yes. Two different
  failure classes with two different severities.

**Comment-lock in BOTH directions (D-23b):**
1. At `ci.yml`'s `max-parallel: 1`: it is NOT a correctness control; name the REJECTED ordering
   argument (the ubuntu-first-stricter-verdict argument) so nobody reconstructs it; then state that
   `publish-verify`'s dead-leg SENSITIVITY does rest on serialisation, point at `read-back.ts` by
   FILE NAME, and say removing `max-parallel: 1` would redden `publish-verify` on a correct
   implementation.
2. At `read-back.ts`'s label assertion: state the dependency is on NON-OVERLAP not on ORDER, name
   `max-parallel: 1` and `ci.yml`'s `publish` JOB (never a line number), record that the previous
   dependency was on undocumented GitHub start order and that this assertion is what removed it,
   and state that this is guard sensitivity and NOT a wrong-result guarantee.

### Confidence

| Sub-claim | Level | Basis |
|-----------|-------|-------|
| ubuntu `publish` ends before Windows `seed` starts, 5/5 | HIGH | `[VERIFIED: gh api actions/runs/*/jobs]`, five runs, 150-190s margins |
| single `listCacheEntries()` snapshot | HIGH | `[VERIFIED: publish-mirror.ts:177]` |
| `max-parallel` order is UNDOCUMENTED; creation order IS documented | HIGH | `[CITED: docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax]` |
| the last-leg law (second leg covers for the first) | HIGH | derived from the two measured facts above; falsifier = a re-read mid-loop, which (b) excludes |
| the label assertion removes the ordering dependency | HIGH | follows from OBS-03's label being the publishing leg's OS, which is `[VERIFIED: octokit openapi-types]` |
| different runner pools make availability an independent per-leg variable | MEDIUM | `[CITED]` for "depending on runner availability"; the pool-independence inference is reasoning, falsified by observing a Windows-first run |

---

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|------------|--------------|----------------|-----------|
| Asset lookup name (`nx-cache-<hash>`) | pure lib (`src/lib/release-asset-name.ts`) | -- | Single source consumed by reader, publisher and cleanup; must stay a pure string function so the bundle can inline it |
| Producer attribution (`mirrored-by`) | Release metadata (GitHub API `label`) | publish engine (`publish-mirror.ts` stamps it) | Deliberately OUTSIDE the lookup name -- that is OBS-03's whole design |
| Prune eligibility | pure lib predicate (`isServerProducedAssetName`) | cleanup engine (`cleanup.ts:89`, one call site) | The delete path must be narrow and testable without network |
| Per-leg seed derivation | pure lib (NEW D-12 helper) | action bin (`mirror-seed`) + roundtrip bin (`read-back.ts`) | One helper, two call sites; NO YAML arithmetic (D-14) |
| Dead-publish-path detection | CI job (`publish-verify`) | pure spec cannot do it | A spec runs one process on one OS and cannot observe a two-leg property (VER-06's precedent) |
| Job ordering / serialisation | `ci.yml` `strategy` | -- | Observability control only; never a correctness control (XOS-06) |
| Trust boundary (who may write the mirror) | `ref` scoping on `listCacheEntries` + `isSyncTrusted` | GitHub per-ref cache scope | Both OS-blind; the OS partition never was a boundary (09-SECURITY s.1) |
| Threat classification | `gsd-security-auditor` (SECURITY.md) | PLAN.md `<threat_model>` supplies INPUT | TRUST-13 forbids self-certification |

---

## Standard Stack

**No new dependencies. None. This phase adds zero packages.**

### Core (already installed and pinned)

| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| `@octokit/rest` (via `createResilientOctokit`) | in-tree | `uploadReleaseAsset` with the new `label` query param | Already the publish adapter's only client |
| `@actions/core` | in-tree | `core.getInput('operation')` dispatch, warnings | Already the bin's I/O |
| `@actions/cache` | `6.2.0` (pinned) | untouched by this phase | VER-01/VER-03 already landed |
| `vitest` | `~4.1.0` | unit + integration suites | `vi.mock` partial-module idiom already used at `action/index.spec.ts:87` |
| `esbuild` (via `esbuild.action.mjs`) | pinned | `npm run build:action` for D-27 | `check:action` already exists as `build:action && git diff --exit-code -- start-cache-server/index.js` |

### Alternatives considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Widening `ReleaseReadClient.fetchAsset` to return the label | a separate native-`fetch` read in `read-back.ts` | **Take the separate read.** Widening the reader seam would touch `serve()`'s graph -> ROBUST-04 bundle rebuild -> and would put an attribution concern into the consumer read path for no consumer benefit. `read-back.ts` already resolves `GITHUB_TOKEN` + `GITHUB_REPOSITORY` and is NOT in the bundle, so an extra `GET /repos/{owner}/{repo}/releases/tags/<shardTag>` with native `fetch` costs one function and zero blast radius. |
| A positional 4th `label` param on `uploadReleaseAsset` | an options object | D-09 LOCKS positional. One call site, one implementation; `summary.ts`'s recorded refusal-to-widen is the house precedent. |
| A third accept branch for `<hash>.tar.gz` | recording the count | D-08 LOCKS recording. Widening a DELETE filter that quick `260721-vdn` deliberately narrowed is the worst option. |

---

## Package Legitimacy Audit

**Not applicable: this phase installs zero external packages.** No `npm install`, no `package.json`
dependency edit, no lockfile change. Consequently:

- No `gsd-tools query package-legitimacy check` run is required.
- No `checkpoint:human-verify` install gate is required.
- **Corollary for the AGENTS.md worktree decision rule:** because no plan changes deps, every plan
  in this phase is eligible for the junctioned-`node_modules` worktree path -- EXCEPT wave 4, which
  must run `npm run check:action` and therefore must run in the MAIN tree (Phase 9 measured a
  junction causing esbuild to rewrite 689 lines with no source edit). See Sequencing hazards.

---

## Line-number drift table

Every line-number citation in this phase's requirements predates ~220 lines of `ci.yml` churn plus
Phase 9's edits. Located by CONTENT or JOB NAME. **Record this table in the plan so the verifier
does not read a content-located edit as unauthorised drift.**

| Cited as | Cited by | ACTUAL location (measured) | Drift | How located |
|----------|----------|----------------------------|-------|-------------|
| `ci.yml:336-337` (platform-discriminator strategy) | REQUIREMENTS CORR-05, milestone framing | `ci.yml:384` (`# Integration tests hit real OS surface (real sockets, real filesystem/tmpdir),`) | +47 | phrase `real OS surface` |
| `ci.yml:356-360` (DOCS-08 site 3, integration job comment) | REQUIREMENTS DOCS-08 | `ci.yml:388` and `ci.yml:409` | +32 / +49 | phrases `that Nx hash is the ONLY thing separating them`, `that hash is the SOLE separation` |
| `ci.yml:577-583` (DOCS-08 site 2) | REQUIREMENTS DOCS-08 | `ci.yml:990`, `:992`, `:995` | **+413** | phrases `an ubuntu leg CAN now restore a Windows-saved entry`, `the ONLY leg that produces Windows-hash entries`, `keep BOTH legs` |
| `ci.yml:652` (captured terminal output) | REQUIREMENTS TRUST-11 | `ci.yml:1068` (`# captured TERMINAL OUTPUT as well as its outputs`) | **+416** | phrase `TERMINAL OUTPUT` |
| `ci.yml:693` (Phase-10-owned same-OS claim) | REQUIREMENTS DOCS-08 | `ci.yml:1109` (`# its own-OS asset (<run_id>-<os> via releaseAssetName), so this proves the same-OS`) | **+416** | phrase `own-OS asset` |
| `ci.yml:1003-1115` (`publish`) | CONTEXT canonical_refs | `publish:` at `ci.yml:1003`; block runs `:1003-1101`; the leading comment starts `:983` | 0 (still correct at HEAD `c4a3b88`) | job key `^  publish:$` |
| `ci.yml:1117-1150` (`publish-verify`) | CONTEXT canonical_refs | `publish-verify:` at `ci.yml:1117`; block `:1117-1137`; leading comment `:1103-1116` | 0 | job key |
| `read-back.ts:37` (seed hash) | REQUIREMENTS OBS-05 | `read-back.ts:44` (`const hash = parseHash(process.env.GITHUB_RUN_ID ?? '')`) | +7 | content |
| `read-back.ts:10-31,52-56` | REQUIREMENTS DOCS-08 | doc block now `:11-39`; the MISS throw `:57-64` | shifted | content |
| `read-back.ts:105-108` (tightening instruction) | CONTEXT D-15 | `read-back.ts:105-108` -- EXACT, no drift | 0 | content |
| `read-back.ts:110-137` (do-not-unify lock) | CONTEXT D-15 | `read-back.ts:110-120` (lock) + `:122-137` (sweep + Phase-10 hand-off) | -17 on the lock's end | content |
| `read-back.ts:128-137` (`publish-verify` job flag) | CONTEXT D-21 | `read-back.ts:128-137` -- EXACT | 0 | content |
| `read-back.ts:138-140` (producer scan) | CONTEXT canonical_refs | `read-back.ts:138-140` -- EXACT | 0 | content |
| `publish-mirror.ts:159` ("byte-identical under CORR-01") | REQUIREMENTS TRUST-11, ROADMAP SC5 | `publish-mirror.ts:159` -- EXACT | 0 | phrase |
| `publish-mirror.ts:64-68` (`PublishClient.uploadReleaseAsset`) | CONTEXT | `:64-68` -- EXACT | 0 | content |
| `publish-mirror.ts:226` (`releaseAssetName(hash)`) | CONTEXT | `:226` -- EXACT | 0 | content |
| `publish-mirror.ts:269` (upload call) | CONTEXT | `:269` -- EXACT | 0 | content |
| `action/index.ts:40-43` (`ref`-scoped `listCacheEntries`) | REQUIREMENTS TRUST-10 | method body `action/index.ts:45-58`; the `ref` param is `:42`; the `octokit.paginate` call `:48-51`; the scoping comment `:46-47` | +5 on the body | content |
| `action/index.ts:89-104` (Octokit upload adapter) | CONTEXT | `:89-104` -- EXACT | 0 | content |
| `action/index.ts:281-300` (seed/verify branch) | CONTEXT | `seed` branch `:281-305`; `verify` branch `:307-379`; the unknown-operation `setFailed` `:381-383` | end +5 | content |
| `cleanup.ts:89` (filter call site) | CONTEXT | `:89` -- EXACT, and the ONLY call site | 0 | `git grep -n isServerProducedAssetName` |
| `cache-key.ts:18-19` (comment lock) | CONTEXT | `:17-18` is the JSDoc + `:18` is `export const CACHE_KEY_PREFIX = 'nx-cache-';`; the file-level lock prose is `:1-15` | -1 | content |
| `cache-key.spec.ts:93`, `:128` (authored count) | CONTEXT D-05 | `:93` and `:128` -- BOTH EXACT | 0 | content |
| `releases-backend.spec.ts:35-39` (CORR-05 site 2) | CONTEXT | `:33-39`; the disable directive is `:38`, the expression `:39` | -2 on the start | content |
| `releases-backend.spec.ts:103-118` (destroyed proof) | REQUIREMENTS CORR-05 | `:104-119` (`MISSES an OS-sensitive hash ...`) | +1 | content |
| `releases-backend.spec.ts:128-134` (replacement's half) | CONTEXT D-18 | `:128-135` -- start EXACT | 0 | content |
| `release-asset-name.spec.ts:39` (CORR-05 site 3) | REQUIREMENTS CORR-05 | directive `:39`, expression `:40` | 0 / +1 | content |
| `release-asset-name.spec.ts:60` (CORR-05 site 4) | REQUIREMENTS CORR-05 | directive `:61`, expression `:62` | +1 / +2 | content |
| `public-surface.spec.ts:53` (`EXPECTED_ACTION_INPUTS`) | CONTEXT D-13 | `:53` -- EXACT; consumed at `:151-155` reading `start-cache-server/action.yml` ONLY | 0 | content |
| `vitest.integration.config.mts:16` (include glob) | CONTEXT | `:16` -- EXACT | 0 | content |
| `nx.json:69` (PARITY-08 `ci.yml` input) | ROADMAP/REQUIREMENTS | `nx.json:69` is `"{workspaceRoot}/.github/workflows/ci.yml"` | 0 | content |
| `eslint.config.mjs:263` (LINT-02 spec scoping) | `action/index.ts:284` comment | not re-verified this session -- LOW priority, the comment is prose | unknown | -- |
| `ci.yml:1051-1063` (shard-growth estimate) | D-02a / D-21 | `:1051` (`~5 distinct real task`) and `:1056` (`~10 real assets`) | n/a (Phase 9 authored) | phrase |
| `ci.yml:944-949` (`cafe<run_id>` seed) | not cited anywhere | `:944` comment, `:949` `RUN_HASH: cafe${{ github.run_id }}` | **NEW to this research** | phrase `cafe` |

---

## Corrections to CONTEXT.md

RESEARCH.md wins where it MEASURED and CONTEXT.md reasoned (the Phase 9 convention).

### C-1. D-26(a) is TRUE but depends on XOS-07, and "ZERO assets" needs a carve-out

D-26(a): *"the Windows publish leg mirrors ZERO real assets: under one name per hash,
`max-parallel: 1` runs ubuntu first, ubuntu uploads every hash it can restore, and the Windows leg
finds every name already present."*

**Two measured corrections.**

(i) **It depends on XOS-07, not only on CORR-02.** MEASURED on run `30400231720`:
`publish (ubuntu-24.04-arm)` enumerated at ~`21:21:11Z` while `integration (windows-11-arm)` did
not complete until `21:23:13Z`. So ubuntu's snapshot did NOT contain the Windows `integration`
entry, and the shard census proves it: `8059758544828235640` appears ONLY as
`8059758544828235640-windows`, never under `-linux`. Under CORR-02 alone the Windows leg would
still be the SOLE mirrorer of the Windows `integration` hash, i.e. it would mirror ONE real asset,
not zero. **D-26(a) becomes true only once XOS-07 widens `needs:` so `publish` starts after
`integration` completes.** State the dependency, or v0.0.3 reads D-26(a) as a consequence of the
rename and reaches the wrong conclusion about collapsing the matrix.

(ii) **"ZERO assets" is false; "zero REAL TASK assets" is true.** After OBS-05 the Windows leg
mirrors exactly ONE asset -- its own seed `nx-cache-<seed_windows>` -- and that one asset is
precisely what makes OBS-05 non-vacuous. Two consequences:
- `publish (windows)`'s OBS-01 summary will read `mirrored: 1`, not `0`. The all-restore-MISS
  warning at `publish-mirror.ts:317` requires `mirrored === 0`, so it will NOT fire. Good, but the
  predicted signal must say `1`.
- **The deferred single-leg collapse would DESTROY OBS-05.** D-26(a) is framed as "the strongest
  argument for" the collapse. It is now also the strongest argument that the collapse cannot happen
  without re-pricing OBS-05, because the only thing the Windows leg publishes is the artifact
  OBS-05 exists to check. Record BOTH halves in the SC6 note.

### C-2. CORR-05 has THREE extant sites, not four -- and the `CORR_05_SITES` table empties to ZERO

`lint-rules.spec.ts:729-754` currently holds exactly THREE rows (site 4 -- the
`cache-archive-path.spec.ts` import -- was deleted by Phase 9 under VER-02, and the doc block at
`:705` says so: *"There are now THREE sites and THREE error positions. There is NO fourth."*).
**All three leave in this phase**, so `CORR_05_SITES` becomes an EMPTY array -- and
`describe(...)`'s `for (const ... of CORR_05_SITES)` over an empty array emits **zero tests**, silently.
That is a coverage cliff CONTEXT.md does not mention. Two facts that make it manageable:
- The RULE's non-vacuity does NOT live in that table. `EVASION_SHAPES`
  (`lint-rules.spec.ts:353-503`, driven at `:504-513` and `:524-535`) proves the ban fires on all
  six evasion shapes at a unit-spec path and is exempt at an integration path. That survives
  untouched.
- **Recommended shape:** delete all three rows and replace the enumeration's outer `describe` body
  with one positive assertion -- `expect(CORR_05_SITES).toEqual([])` under a title naming
  "CORR-05 is now TRUE: zero extant ambient-platform reads in unit specs" -- plus a comment
  recording that the rule's proof moved to `EVASION_SHAPES` and that the table's HISTORICAL block
  is preserved (it already documents its own two miscounts and must not be deleted).

### C-3. D-17's site-4 move must DELETE its `CORR_05_SITES` row, not repoint it

The row's two tests are `is CAUGHT by the ban once its described disable is stripped` and
`carries a described disable ...`. Once the expression lives in `release-asset-name.integration.spec.ts`,
LINT-02's `ignores: ['**/*.integration.spec.{ts,mts,cts}']` means the ban does NOT fire there, so
`expect(banRuleIdsOf(messages)).toEqual([rule])` would return `[]` and go RED on a CORRECT
implementation. Repointing the row's `file` is therefore a trap. Delete the row.

### C-4. D-12 must also be disjoint from an EXISTING third seed family: `cafe<run_id>`

CONTEXT.md's D-12 names two spaces to be disjoint from (run ids and Nx task hashes, both
all-decimal). There is a **third**, already shipped and already comment-locked:
`ci.yml:944-949`, the `consumer-smoke` job --

```yaml
# `cafe` prefix keeps the key valid hex (^[a-f0-9]+$) yet DISTINCT from the
# dogfood-seed / publish `nx-cache-<run_id>` key. ...
RUN_HASH: cafe${{ github.run_id }}
```

Live proof in the shard: `cafe30401077417-linux`, `cafe30400231720-linux`,
`cafe30400231720-windows`. So the repo already HAS the hex-word-marker convention D-12 is
reinventing, with the identical rationale. **Follow the precedent with a DIFFERENT marker word,
and add "disjoint from `cafe<run_id>`" to D-12's constraint list.** See `## OBS-05` for the
recommended encoding.

### C-5. `releaseAssetName` has FIVE spec consumers, not the three CONTEXT enumerates

CONTEXT's `## Integration Points` names three call sites (reader, publisher, cleanup) -- correct
for PRODUCTION. The `platform` parameter's deletion additionally breaks:
- `select-backend.spec.ts:163` -- `releaseAssetName(HASH)`, single-arg, SURVIVES unchanged.
- `test/workspace-root-cwd.ts:38` -- a COMMENT reading `releaseAssetName(hash, platform)`. Stale
  prose about a deleted signature; the exact class Phase 9's regression came from. Fix it.
- `release-asset-name.spec.ts:22,26-27,32-33,38-40,95` -- SEVEN two-argument calls, i.e. four whole
  `it()` blocks in the `releaseAssetName (CORR-01)` describe plus the `round-trips with
  releaseAssetName` case, all of which must be re-authored, not merely edited.
- `publish-mirror.spec.ts` -- eight `releaseAssetName(...)` calls, all single-arg, all SURVIVE.
- `releases-backend.spec.ts:88-89,111,134` -- `:89` and `:111` are two-arg and go with CORR-02.
- `dogfood-body.ts:19` -- a comment citing `releaseAssetName(hash, platform = process.platform)` as
  the contrast case for its own required-not-defaulted parameter. CONTEXT flags this ("needs a
  look"); confirmed it exists and must be rewritten, because after D-04 the contrast is gone.

### C-6. `publish-mirror.spec.ts` has 4 fake definitions + 4 argument-array assertions, not "~10 sites"

MEASURED: `uploadReleaseAsset` appears on **22 lines**. The edits are: **4** fake definitions
(`:60`, `:182`, `:261-262`, `:286`), **4** `toHaveBeenCalledWith(...)` argument lists that must gain
the 4th positional `label` (`:120`, `:214`, `:237`, `:397`), and **1** `.mock.calls[0][1]` index read
(`:132` -- index 1 is the NAME, unaffected). The remaining 13 lines are
`toHaveBeenCalledOnce`/`not.toHaveBeenCalled`/prose and need no change. Plan against 8 edits, not 10.

### C-7. D-19's cited `ref`-scoping line range is stale in BOTH sources

REQUIREMENTS TRUST-10 cites `action/index.ts:40-43`; CONTEXT D-19 cites `:42-51`. The truth:
`ref` is the 4th parameter at `:42`, the scoping COMMENT is `:46-47`, and the `octokit.paginate`
call carrying `ref` is `:48-51`. CONTEXT's range is the better of the two but still excludes the
comment it asks to be widened. Locate by the phrase `Scope to`.

---

## Per-requirement implementation notes

### CORR-02 -- the OS-free asset name

**Target (D-03):**
```ts
// release-asset-name.ts
import { CACHE_KEY_PREFIX, HASH_PATTERN, type Hash } from './cache-key.js';

export function releaseAssetName(hash: Hash): string {
  return `${CACHE_KEY_PREFIX}${hash}`;
}
```

Verified facts the planner needs:

- **`CACHE_KEY_PREFIX = 'nx-cache-'`** at `cache-key.ts:18`; `HASH_PATTERN = /^[a-f0-9]{1,512}$/`
  at `:21`. `[VERIFIED: cache-key.ts]`
- **Do NOT alias `cacheKeyFor`.** `cacheKeyFor(hash)` at `cache-key.ts:42-44` returns the identical
  string. D-03 forbids the alias; the comment lock must anticipate "tidy these together".
- **The single-source count guard is `cache-key.spec.ts:108-137`**, which asserts the authored
  literal `'nx-cache-'` totals **exactly 1** across `cache-key.ts` (1), `actions-cache-backend.ts`
  (0), `publish-mirror.ts` (0), using `countAuthored` (`:17-32`, comment-stripped, counts
  OCCURRENCES not lines). **D-05's extension = add `release-asset-name.ts` to that `files` map with
  expected count 0**, because D-03 imports the prefix rather than re-authoring it. `[VERIFIED]`
- **Do NOT add spec files to that map.** `release-asset-name.spec.ts`'s post-rename pinned
  expectation MUST author the literal (`expect(releaseAssetName('abc123' as Hash)).toBe('nx-cache-abc123')`)
  -- its own doc block at `:11-19` makes the case for spelling literals rather than rebuilding the
  template, and that discipline is what catches a separator change. `cache-key.spec.ts:36` already
  authors `'nx-cache-abc123'` under the same exemption.
- **The predicted bundle change (see Sequencing hazards H-3).**

**What a RED can assert:** the exact string `'nx-cache-abc123'` (goes RED before the rewrite, since
today the function returns `'abc123-linux'` on a Linux runner). This is an **assertion-level** RED,
not an import-level one -- 09's lesson applies: an import-level RED proves only wiring.

### CORR-05 -- the last ambient-platform reads

Three extant sites (see C-2). Their exact shapes:

| # | File:line | Expression | Disposition |
|---|-----------|------------|-------------|
| 1 | `releases-backend.spec.ts:38-39` | `cachePlatform(process.platform) === 'windows' ? 'linux' : 'win32';` | LEAVES with CORR-02 (`OTHER_PLATFORM` has no meaning once the name has no platform) |
| 2 | `release-asset-name.spec.ts:39-40` | `releaseAssetName('abc123' as Hash, process.platform),` | LEAVES with CORR-02 (the parameter is deleted) |
| 3 | `release-asset-name.spec.ts:61-62` | `expect(cachePlatform()).toBe(cachePlatform(process.platform));` | **MOVES** to `src/lib/release-asset-name.integration.spec.ts` (D-17) |

**D-17's hazard check answered (research target 5) -- DIRECTLY MEASURED, not inferred.**

Step 1, the merged config: `npx nx show project @op-nx/github-cache --json` shows
`packages/github-cache/project.json` declares the `integration` target with a `command` and
`options` **but NO `inputs`**, so `nx.json`'s `targetDefaults.integration.inputs` applies wholesale
to the MERGED config. (This mattered: a `project.json` inputs list REPLACES `targetDefaults`
wholesale, so the absence is the load-bearing fact.) Those inputs lead with `"default"`, and
`namedInputs.default` is `["{projectRoot}/**/*", "sharedGlobals"]`.

Step 2, the resolved file list: `npx nx show target inputs @op-nx/github-cache:integration` resolves
to **73 `packages/github-cache/src/**` entries**, and they include unit specs by name --
`packages/github-cache/src/lib/release-asset-name.spec.ts` (line 53 of the output),
`release-asset-name.ts` (54), `cache-key.spec.ts`, `dogfood-body.spec.ts`, and
`src/server/public-server.integration.spec.ts` (80). The whole `src/lib/` directory is hashed,
spec files included.

**So a new `packages/github-cache/src/lib/release-asset-name.integration.spec.ts` IS hashed by the
`integration` target. There is NO stale-cached-PASS hazard and the plan needs no `nx.json` edit.**
`[VERIFIED: nx show project --json + nx show target inputs, Nx 23.1.0]`

The merged `integration` inputs also carry `{ "runtime": "node -p process.platform" }` -- CORR-04's
discriminator -- which is why the two legs compute different hashes and why the new spec runs and
is cached PER OS. That is exactly D-17's "makes the assertion bite" claim, and it is measured.

**LINT-06 consequence, load-bearing:** the moment the expression sits at an `*.integration.spec.ts`
path, LINT-02's `ignores` exempts it, so the `eslint-disable-next-line` becomes unused and
`reportUnusedDisableDirectives: 'error'` FAILS. The directive must be dropped in the same edit as
the move. Same-commit, and the `CORR_05_SITES` row DELETED (C-3).

**D-18's replacement (the named non-vacuity proof).** `releases-backend.spec.ts:104-119` is the
proof CORR-02 destroys (it asserts a MISS for a hash present only under another platform -- once
the name has no platform, `here === there` and the case is incoherent). EXTEND `:128-135`, which
already carries two of the three clauses:
```ts
expect(client.requested).toEqual([releaseAssetName('abc123' as Hash)]);   // exactly-one + equality
```
Add the third clause over the WHOLE tuple, never "the OS this machine is not":
```ts
for (const os of CACHE_OS_VALUES) {
  expect(client.requested[0]).not.toContain(os);
}
```
Note `toEqual([...])` already pins the array LENGTH, so "exactly one" is covered -- do not add a
redundant third guard (Phase 8: three guards for one invariant can share one blind spot).

### RETAIN-04 -- the two-branch cleanup filter

**D-06's shape:** two separately named predicates composed in one export, because RETAIN-05(b)
needs two things to assert about.

```ts
function isCurrentAssetName(name: string): boolean {
  return (
    name.startsWith(CACHE_KEY_PREFIX) &&
    HASH_PATTERN.test(name.slice(CACHE_KEY_PREFIX.length))
  );
}

function isLegacyOsSuffixedAssetName(name: string): boolean { /* today's body, verbatim */ }

export function isServerProducedAssetName(name: string): boolean {
  return isCurrentAssetName(name) || isLegacyOsSuffixedAssetName(name);
}
```

Note `isCurrentAssetName`'s body is byte-identical in SHAPE to `isServerProducedKey`
(`cache-key.ts:52-57`). That is expected and must NOT be aliased for the same reason D-03 forbids
aliasing `cacheKeyFor`: the Actions-cache KEY namespace and the Release ASSET namespace are
deliberately separate consumers of one prefix (RETAIN-05c names four distinct consumers).
Comment-lock it.

**The single call site is `cleanup.ts:89`** -- verified by `git grep -n isServerProducedAssetName`,
one production hit. `[VERIFIED]`

**MEASURED disjointness (research target 4).** I ran both predicates over a 26-case adversarial
table AND 1.6M randomised candidates drawn from the alphabet `abcdef0123456789-nxcheus` (the exact
characters that could construct a near-miss), each wrapped four ways (bare, prefixed,
`-linux`-suffixed, prefixed+`-windows`-suffixed). **BOTH-true count: 0. Randomised collisions: 0.**

| Name | branch A (new) | branch B (legacy) |
|------|----------------|-------------------|
| `nx-cache-abc123` | true | false |
| `nx-cache-abc123-linux` | false | false |
| `nx-cache-abc123-windows` | false | false |
| `nx-cache-abc123-macos` | false | false |
| `abc123-linux` | false | true |
| `0-macos` | false | true |
| `abc123` | false | false |
| `nx-cache-` | false | false |
| `nx-cache-nx-cache-abc123` | false | false |
| `-linux` | false | false |
| `abc123-` | false | false |
| `nx-cache--linux` | false | false |
| `nx-cache-abc123-freebsd` | false | false |
| `nx-cache-ABC123` | false | false |
| `NX-CACHE-abc123` | false | false |
| `nx-cache-abc123.tar.gz` | false | false |
| `abc123.tar.gz` | false | false (the D-08 dead weight) |
| `nx-cache-` + `a`*512 | true | false |
| `nx-cache-` + `a`*513 | false | false |
| `a`*512 + `-linux` | false | true |
| `nx-cache-abc123-linux-linux` | false | false |
| `nx-cache-cafe30401077417` | true | false |
| `nx-cache-feed230401077417` (proposed seed) | true | false |
| `nxcache-abc123` | false | false |
| `notes-backup` | false | false |
| `nx-cache-0` | true | false |

**The MECHANISM -- this is what RETAIN-05(b) actually wants, and there are TWO independent reasons.**

1. **`CACHE_KEY_PREFIX` itself contains a `-`.** For any A-accepted name, the whole post-prefix
   remainder matches `HASH_PATTERN`, which forbids `-`. Therefore
   `name.lastIndexOf('-') === CACHE_KEY_PREFIX.length - 1 === 8`, so branch B's hash half is
   *exactly the string `'nx-cache'`* -- which itself contains a `-` and can never match
   `HASH_PATTERN`. **Disjointness is a property of the PREFIX, not of the split.**
2. **Belt: even a dashless prefix would work.** If the prefix held no `-`, an A-accepted name would
   contain zero dashes, and branch B's `if (separator < 0) return false` rejects it outright.

Both reasons are one-line assertable, which converts "a property of the last-`-` split" into "a
property of the design":
```ts
expect(HASH_PATTERN.test('-')).toBe(false);            // the atom
expect(CACHE_KEY_PREFIX).toContain('-');               // reason 1
expect(CACHE_KEY_PREFIX.lastIndexOf('-')).toBe(CACHE_KEY_PREFIX.length - 1);
```
Then the adversarial table, asserting `!(A && B)` for every row, with the `both` count pinned to 0.

**RETAIN-04's "cleanup dry-run over a mixed shard"** is satisfiable offline against the real census
shape: 50 `.tar.gz` + 46 `-linux` + 26 `-windows` + N new-form. Build that fixture from the counts
in D-08 rather than hitting the network.

### RETAIN-05 -- the three things RETAIN-04 does not cover

**(a) The PoC-era dead weight -- MEASURED and D-08-locked.** Re-verified live 2026-07-29 against
release id `354838660` (tag `cache-mirror-202607`): **122 assets total**, and `label` is EMPTY
(`""`) on **every one of the 122** -- confirming OBS-03 is a genuinely new field, not a partially
populated one. Distribution: 50 `<hash>.tar.gz`, 46 `-linux`, 26 `-windows`, 0 `-macos`, 0 other.
Neither branch matches `.tar.gz` (verified in the table above). Record the count, the shard-scoped
bounding argument (122 of 1000, shard rolls over 2026-08-01), and the available manual prune.

**(b)** covered under RETAIN-04 above.

**(c) `CACHE_KEY_PREFIX` governs FOUR things.** Verified all four exist and are distinct:

| # | Consumer | Location |
|---|----------|----------|
| 1 | the Actions-cache key | `cacheKeyFor` (`cache-key.ts:42-44`) |
| 2 | `isServerProducedKey` (Actions-cache enumeration filter) | `cache-key.ts:52-57` |
| 3 | the Release asset name | `releaseAssetName` (post-CORR-02) |
| 4 | the cleanup accept filter's new branch | `isCurrentAssetName` (post-RETAIN-04) |

Widen `cache-key.ts`'s comment lock to name all four PLUS the consequence: changing the literal
orphans the entire mirror, and RETAIN-04's legacy branch does NOT cover the orphans because it only
knows `<hash>-<os>`.

### OBS-03 -- the `mirrored-by` label

**The API premise is VERIFIED against the installed Octokit, not assumed.**

| Question | Answer | Source |
|----------|--------|--------|
| Does `octokit.rest.repos.uploadReleaseAsset` accept `label`? | **YES.** The endpoint route in `@octokit/types` is literally `"POST {origin}/repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}"` | `[VERIFIED: node_modules/@octokit/types/dist-types/generated/Endpoints.d.ts:4104]` |
| Is it free-form? | **YES.** `repos/upload-release-asset` declares `query: { name: string; label?: string }` -- optional, plain `string`, no enum, no pattern, no length constraint | `[VERIFIED: node_modules/@octokit/openapi-types/types.d.ts:114935-114946]` |
| Is it returned by `listReleaseAssets`? | **YES.** The `release-asset` schema carries `label: string \| null` alongside `name`, `id`, `created_at`, `browser_download_url` | `[VERIFIED: openapi-types.d.ts:27663-27690]` |
| Does setting it affect the asset NAME or the download URL? | **NO.** `name` is a separate required query param documented as "The file name of the asset"; `browser_download_url` is its own response field. The 422 response is documented as *"Response if you upload an asset with the same filename as another uploaded asset"* -- keyed on FILENAME, so the label plays no part in uniqueness either | `[VERIFIED: openapi-types.d.ts:114938, :114959-114962, :27667, :27674]` |
| Can labels be BACKFILLED onto existing assets? | **YES**, via `PATCH /repos/{owner}/{repo}/releases/assets/{asset_id}` whose JSON body accepts `name?`, `label?`, `state?`. It is NOT upload-time-only | `[VERIFIED: Endpoints.d.ts:3356 + openapi-types.d.ts repos/update-release-asset]` |

**Backfill is possible but OUT OF SCOPE.** No requirement asks for it, all 122 existing assets are
legacy-named and age out through `CACHE_MIRROR_MAX_AGE_DAYS` anyway, and a PATCH loop over 122
assets would be new network-mutating code on a repo whose delete path is deliberately narrow.
Record the capability so v0.0.3 does not re-derive it; do not build it.

**The seam edit (D-09), exact:**
```ts
// publish-mirror.ts:64-68
uploadReleaseAsset(
  releaseId: number,
  name: string,
  bytes: Buffer,
  label: string,
): Promise<void>;
```
Adapter (`action/index.ts:89-104`) passes `label` straight into the Octokit call alongside `name`.
Spec edits: 4 fake definitions + 4 argument-array assertions (see C-6).

**The value (D-10):** `` `mirrored-by: ${cachePlatform()}` ``, `cachePlatform()` called ONCE per
`publishMirror` run, hoisted ABOVE the `for` loop at `:215`. `PublishOptions` stays `{ now }`.
The spec mocks `release-asset-name.js`'s `cachePlatform` via the partial-`vi.mock` idiom already
shipped at `action/index.spec.ts:83-95`:
```ts
vi.mock('../lib/release-asset-name.js', async (orig) => {
  const actual = await orig<typeof import('../lib/release-asset-name.js')>();
  return { ...actual, cachePlatform: vi.fn((): CacheOs => 'linux') };
});
```
-- keeping `CACHE_OS_VALUES` REAL, which is what makes the `it.each(CACHE_OS_VALUES)` axis honest.

**Comment-lock the RETRACTION at the construction site.** The label is the PUBLISHING leg's OS.
`listCacheEntries` returns `{ key }` only (`publish-mirror.ts:38-40`, and the adapter at
`action/index.ts:53-57` maps every row to `{ key: cache.key }` -- so there is no producing-OS field
to read even if the API had one). `docs-same-os-claims.spec.ts:194-207` already guards the
retraction repo-wide via `/whose byte[s]/i` over four files; that guard stays and its scope should
be checked against any file this phase edits.

### OBS-05 -- the leg-distinguishable publish seed

**Recommended D-12 encoding** (discretionary; all four constraints checked):

```ts
// release-asset-name.ts (or a new lib/mirror-seed.ts -- see the placement note)
export function mirrorSeedHash(runId: string, os: CacheOs): string {
  return `feed${CACHE_OS_VALUES.indexOf(os)}${runId}`;
}
```
Producing `feed0<run_id>` (windows), `feed1<run_id>` (macos), `feed2<run_id>` (linux).

| Constraint | Check |
|------------|-------|
| lowercase hex only (`^[a-f0-9]{1,512}$`) | `f`,`e`,`e`,`d` + digits -- PASSES `parseHash` |
| NOT all-decimal | contains `f`,`e`,`d` |
| OS component single-sourced from `CACHE_OS_VALUES` | `indexOf` into the real tuple |
| **NEW (C-4): disjoint from `cafe<run_id>`** | `f` vs `c` at index 0 |
| disjoint from a bare run id | has letters |
| disjoint from an Nx task hash | Nx renders 64-bit hashes as all-decimal (verified over 153 entries; and the shard census shows only all-decimal real hashes) |
| injective across OSes | single-digit index; pin `expect(CACHE_OS_VALUES.length).toBeLessThan(10)` |
| length | 4 + 1 + ~11 = ~16 chars, far under 512 |
| MEASURED against the cleanup filter | `nx-cache-feed230401077417` -> branch A true, branch B false (row in the RETAIN-04 table) |

`feed` rather than reusing `cafe`: the two seed families must stay distinguishable in a shard
listing, and following the in-repo hex-word convention makes both read instantly as
"marker-prefixed run-scoped seed". `e2<run_id>` (CONTEXT's suggestion) also satisfies every
constraint and is terser; the trade-off is legibility beside `cafe<run_id>`.

**Every consumer verified to survive the encoding:**

| Consumer | Location | Verdict |
|----------|----------|---------|
| `parseHash` | `cache-key.ts:37-39` | PASSES (`HASH_PATTERN`) |
| server SRV-03 route validator | `server.ts:111` -> `parseHash` | PASSES (same pattern -- so the `mirror-seed` PUT is accepted) |
| `cacheKeyFor` | `cache-key.ts:42-44` | PASSES |
| `isServerProducedKey` | `cache-key.ts:52-57` | PASSES -> the seed IS enumerated and mirrored, which is required |
| `releaseAssetName` (post-CORR-02) | -- | PASSES |
| cleanup branch A | `isCurrentAssetName` | PASSES (measured) |
| existing specs pinning a seed shape | `read-back.spec.ts`, `action/index.spec.ts` | `read-back.spec.ts` uses `it.each(CACHE_OS_VALUES)` for PROVENANCE, and `action/index.spec.ts` feeds `'run-1'` as the hash input -- **no spec pins the seed-hash SHAPE**, so nothing breaks. `[VERIFIED: git grep over both files]` |

**D-13's `operation` value -- safety CONFIRMED, plus one guard CONTEXT did not check.**

- `public-surface.spec.ts:53` `EXPECTED_ACTION_INPUTS = ['port']` is consumed at `:151-155` reading
  `readSource('../../../start-cache-server/action.yml')` **only**. The dogfood
  `packages/github-cache/action.yml` is never read by that guard. **No D2-02 / PARITY-07 breach.**
  `[VERIFIED]`
- **The other guard CONTEXT asked about:** `dogfood-cross-os.spec.ts:83-84` asserts
  `jobBlock('dogfood-seed')` matches `/operation:\s*seed/` and `jobBlock('dogfood-verify')` matches
  `/operation:\s*verify/`. These are positive, JOB-SCOPED assertions -- adding a `mirror-seed`
  value and using it in the `publish` job does not touch them. `docs-adoption.spec.ts:160` asserts
  the CONSUMER example contains no `operation:` -- unaffected. **No other guard pins the operation
  set.** `[VERIFIED: git grep for operation across all specs]`
- **The message that DOES need editing:** `action/index.ts:381-383` reads
  `` `... unknown operation '${operation}' (expected 'seed' or 'verify').` ``. It must name
  `mirror-seed`. No spec asserts that string today, so nothing goes red -- which is exactly why it
  is easy to leave stale. Add it to the plan's file list.

**THE `mirror-seed` BRANCH TRAP -- read this before writing the plan.** `action/index.ts` computes
```ts
const hash = core.getInput('hash', { required: true });   // :247
...
const url = `${running.url}/v1/cache/${hash}`;            // :265
```
**before** the operation branch. A `mirror-seed` branch that reuses `url` PUTs at
`nx-cache-<run_id>`, not at the derived seed -- and `read-back.ts` would MISS. The branch must
build its own `seedHash` and its own URL. Do NOT hoist a conditional hash above `:265` either:
`:267-273` carries an explicit lock against hoisting shared state above the seed/verify branches
(the coupling that made VER-06's vacuity trap reachable). Recommended: a third sibling branch that
derives `mirrorSeedHash(hash, cachePlatform())`, builds its own URL, and PUTs
`dogfoodBody(seedHash, cachePlatform())`.

**D-15's tightening + the U-01 label assertion in `read-back.ts`:**
- `read-back.ts:44` becomes `parseHash(mirrorSeedHash(process.env.GITHUB_RUN_ID ?? '', cachePlatform()))`.
- `:138-140`'s `CACHE_OS_VALUES.find(...)` scan tightens to an exact comparison against
  `dogfoodBody(hash, cachePlatform())` -- the seed hash is derived from the reader's own OS and only
  that leg seeded it, so the producer is known by construction again.
- **PLUS the label assertion (U-01):** read the shard's asset list and assert
  `label === 'mirrored-by: ' + cachePlatform()` for `nx-cache-<seedHash>`. Use a native `fetch` on
  `GET /repos/{owner}/{repo}/releases/tags/${shardTag()}` -- `read-back.ts` already has the token
  and repo identity, `shardTag` is already exported from `lib/retention.ts:54`, and `read-back.ts`
  is deliberately on the zero-dep native-fetch path (its doc block `:20-24`). Do NOT widen
  `ReleaseReadClient` (that seam is in the bundle).
- `:110-120`'s "DO NOT UNIFY" lock is UPDATED, not deleted: the asymmetry's justification changes
  from "publish's producer is genuinely VARIABLE" to "publish's producer is now known per leg by
  construction (OBS-05), so BOTH guards assert one producer -- and the reason they still must not
  be unified is that `dogfood-verify`'s producer is fixed by a single-leg JOB while this bin's is
  fixed by a per-leg SEED DERIVATION; the two facts have different failure modes."

**What a RED can assert here (three levels, all available):**
1. Unit: `mirrorSeedHash(runId, os)` returns the exact literal for each `CACHE_OS_VALUES` member,
   `it.each` over the real tuple. RED before the helper exists.
2. Unit: `read-back.ts`'s `run()` MISSES when the fake reader holds only the *other* OS's seed name
   -- the leg-distinguishability claim, machine-independently, via a mocked `cachePlatform`.
3. Unit: `run()` throws when the asset's label names a DIFFERENT OS than the reader's. This is the
   U-01 assertion and it is unit-testable with a fake asset-list reader, so it does NOT depend on a
   live run to be proven non-vacuous. Mutation-test it by flipping the label.

### XOS-06 -- `max-parallel: 1` retained, comment-locked

- **No spec pins `max-parallel: 1` today.** `git grep -rn "max-parallel"` returns exactly two hits
  in `ci.yml` (`:1008` comment, `:1017` value) and one prose mention in `read-back.ts:117`. There
  is NO drift guard. `[VERIFIED]`
- **A comment-only lock is what XOS-06 asks for** ("A comment records this explicitly"), so a new
  spec is discretionary. If one is added, note the harness constraint: `dogfood-cross-os.spec.ts`'s
  `codeLines` **strips `#` lines** (`:54`), so its `jobBlock()` helper cannot see comments. Use
  `docs-same-os-claims.spec.ts`'s `read(file)` (raw, comments included) for a phrase lock and
  `jobBlock()` for the VALUE. Both patterns already exist; do not build a third.
- **Content the comment must carry** (D-23 a+b, plus U-01):
  (a) `max-parallel: 1` exists for serialisation (no concurrent shard-creation or delete races) and
  is NOT a correctness control; no requirement depends on which leg wins the first-write-wins race,
  because both legs restore the SAME single Actions-cache entry and upload it verbatim (TRUST-11).
  (b) The REJECTED argument, BY NAME: "ubuntu-first ordering makes the stricter Linux verdict win"
  -- rejected because it would rest a wrong-result guarantee on CI job scheduling
  (`REQUIREMENTS.md:37-43`, `PROJECT.md` Key Decisions). Do not reconstruct it.
  (c) The one thing that DOES depend on this knob: `publish-verify`'s dead-publish-leg SENSITIVITY
  (see `read-back.ts`). That is guard sensitivity, not a wrong-result guarantee; removing
  `max-parallel: 1` would redden `publish-verify` on a CORRECT implementation.

### XOS-07 -- what `publish` waits on

**D-16's premise CONFIRMED, one part cited rather than measured.**

- `publish` carries `if: ${{ !cancelled() && github.event_name == 'push' }}` at `ci.yml:1004`.
  `[VERIFIED]`
- GitHub documents: *"If a job fails or is skipped, all jobs that need it are skipped **unless the
  jobs use a conditional expression that causes the job to continue**."* and, for `always()`:
  *"If you want to run a job or step regardless of its success or failure, use the recommended
  alternative: `if: ${{ !cancelled() }}`."* So `!cancelled()` IS the documented mechanism for
  running past a FAILED dependency. `[CITED: docs.github.com .../workflow-syntax#jobsjob_idneeds
  and .../expressions#cancelled]`
- **NOT empirically confirmed in this repo:** there is no run on record where a `needs:` ancestor of
  `publish` failed. Run `30400231720` failed only at `publish-verify`, which is downstream. Recorded
  in the Assumptions Log. **Bounded downside if the citation is wrong:** `publish` gets SKIPPED on a
  red-`test` push -- a mirror GAP, never a wrong result -- and the existing comment's stated concern
  ("a failing test leg must never skip the mirror and drop already-built entries") re-materialises.
  The rewritten comment must say that the mechanism is `!cancelled()` AND that the failure mode if
  it ever changes is a skipped mirror, not a wrong artifact.
- `integration` has **NO `needs:` of its own** and is a two-leg
  `[ubuntu-24.04-arm, windows-11-arm]` matrix with `fail-fast: false`, so depending on it waits for
  BOTH legs. `build`, `typecheck`, `test` are each single-leg `ubuntu-24.04-arm`, no `needs:`, no
  `if:`. **No `needs:` cycle is created.** `[VERIFIED: per-job extraction from ci.yml]`
- **The race XOS-07 removes is MEASURED, not projected.** Run `30400231720`:
  `integration (windows-11-arm)` ran `21:20:14Z -> 21:23:13Z`; `publish (ubuntu-24.04-arm)` ran
  `21:20:50Z -> 21:21:30Z` with its enumeration at ~`21:21:11Z` -- **122 seconds before the Windows
  `integration` entry existed.** Fingerprint in the shard: `8059758544828235640` exists ONLY as
  `8059758544828235640-windows`. Cite this in the plan; it is stronger than the requirement's own
  hypothetical framing.
- **Wall-clock cost:** `publish` currently starts ~40s after the run begins; post-widening it waits
  for `integration (windows-11-arm)`, i.e. ~3 minutes. `publish-verify` shifts with it. Acceptable
  for a push-only background job; worth one sentence in the comment.
- **Downstream note:** `publish-verify` has `if: github.event_name == 'push'` with NO
  `!cancelled()`, so it is SKIPPED whenever `publish` fails. Widening `needs:` makes `publish` run
  on a red-`test` push, which means `publish-verify` now runs there too. That is desirable and worth
  naming, because it changes which pushes sample OBS-05.

### TRUST-10 -- verified unchanged, not assumed

**The diff-based assertion (D-19).** C1, C2 and C16's Actions-cache-side filter are proven unchanged
by a DIFF over this phase's commit range, not a sentence. Exact scope:

| Control | Files that must show ZERO diff | Location |
|---------|-------------------------------|----------|
| C1 write-trust allowlist | `packages/github-cache/src/lib/trust.ts` | `TRUSTED_EVENTS = ['push','schedule']` at `:32`; consumed `:88` |
| C2 sync gate | `packages/github-cache/src/lib/sync-gate.ts` | separate predicate, `{push, schedule}` + default-ref check |
| C16 Actions-cache-side filter | `isServerProducedKey` in `packages/github-cache/src/lib/cache-key.ts:52-57` | **CAUTION:** `cache-key.ts` DOES change in this phase (D-05 widens its comment lock). So the assertion must be scoped to the FUNCTION, not the file -- e.g. `git diff <base>..HEAD -- packages/github-cache/src/lib/cache-key.ts` reviewed to contain only comment lines, plus a spec pinning `isServerProducedKey`'s accept/reject sets (which `cache-key.spec.ts:34-74` already does). |

C16's Releases-side filter (`isServerProducedAssetName`) DOES change, and the change is ADDITIVE
(a new `||` branch; every previously-accepted name is still accepted -- provable from the
disjointness table, since branch B is preserved verbatim).

**The `ref`-scoping pin.** Located by content (see C-7): `action/index.ts:42` (`ref: string`
parameter), `:46-47` (the scoping comment), `:48-51` (the `octokit.paginate` call passing `ref`).
`runPublish` supplies it from `process.env.GITHUB_REF` at `:155,159`.

Pin BY SPEC: `action/index.spec.ts` already drives `createPublishClient`; assert `listCacheEntries()`
calls `octokit.paginate` with an object whose `ref` equals the constructor's `ref`, over the WHOLE
argument array (`toEqual` on `.mock.calls[0]`, the Phase 9 D-11 shape), and pin the call count so a
second unscoped enumeration cannot be added. Comment-lock it as the **now-SOLE in-repo control**
keeping non-default-branch trusted writes out of the world-readable mirror, because
`TRUSTED_EVENTS` includes `push` with no ref check (`trust.ts:32`) and the OS-version barrier is
gone. `[VERIFIED: trust.ts:32]`

### TRUST-11 -- where first-write-wins arbitrates between non-identical payloads

**Threat-model INPUT for the plan's `<threat_model>` block. This is INPUT, never the conclusion (D-22).**

- **The arbitration point is `saveCache`, NOT the Release upload.** Proof from code, not assertion:
  `publishMirror` restores each hash with `actionsCache.get(hash)` (`publish-mirror.ts:216`) and
  uploads `restored.bytes` verbatim (`:225,269`). It never re-executes the task. For a given hash
  the Actions cache holds exactly ONE entry, so both legs upload byte-identical bytes. The
  "byte-identical" comment at `:159` is therefore still TRUE -- only its REASON changes, from
  OS-namespacing to one-entry-per-hash (D-20; rewrite in CORR-02's commit, keyed by the quoted
  phrase `byte-identical under CORR-01`).
- **The real race appears only once XOS-04 puts `build`/`typecheck`/`test` on a Windows leg**: two
  jobs then compute the same hash H and both call `saveCache(nx-cache-H)`; the winner owns the entry
  INCLUDING its OS-specific captured terminal output (`ci.yml:1068`, cited as `:652`). Those legs
  run in PARALLEL, so that race IS ordering-dependent. XOS-06 is satisfied because no requirement
  DEPENDS on the winner -- not because the race does not exist. **This moves TRUST-11's residual
  risk into the XOS-05 write decision**, a cross-phase consequence Phase 12 must inherit.
- **Two clauses that remain correct as originally written:** the month-shard newest-first read walk
  makes the winner shard-dependent when a hash is mirrored into two shards
  (`shardTagsForWindow`, `retention.ts:134`); and cross-OS restore is byte-faithful (tar-in-tar,
  inner entry names forward-slash-normalised by `resolvePaths`), so the out-of-scope file-mode
  question applies to the Nx client's extraction of the INNER tar, not to our transport.
- **One clause this research ADDS as input:** the enumeration snapshot. Each leg's view of the
  Actions-cache key set is a SINGLE `listCacheEntries()` call (`:177`), never re-read. So "which
  entries a leg can mirror" is a function of that leg's start time, which is what makes the U-01
  law hold and what XOS-07 corrects.

### TRUST-12 -- the exposure delta

**Threat-model INPUT.**

- VER-01/VER-03 removed the incidental within-scope OS partitioning, leaving CORR-04's declared
  discriminator (`{ "runtime": "node -p process.platform" }`, MEASURED present in the merged
  `integration` inputs) as the sole separation mechanism.
- **The public-repo EXPOSURE DELTA:** a single-OS publish leg can now restore and mirror every OS's
  entries, so the captured terminal output of every CI job on every OS crosses into the
  anonymously-readable Releases mirror. **This is already live and measurable, not hypothetical:**
  on run `30400231720` the ubuntu leg mirrored four all-decimal task hashes and the Windows leg
  mirrored those same four under `-windows` plus the Windows-only `8059758544828235640`. After
  CORR-02 the SAME set exists under one name each -- the exposed content is unchanged; only the
  naming collapses.
- **What CORR-02 adds on top of VER-01/VER-03:** nothing in exposure terms. The bytes were already
  crossing. CORR-02 removes the *asset-name* OS token, which removes the only in-name attribution.
  OBS-03's label restores attribution as metadata. **The delta this phase introduces is therefore
  an ATTRIBUTION change, not an EXPOSURE change** -- and the attribution it restores is of the
  PUBLISHER, not the producer (OBS-03's retraction).
- **The reframing that bounds it (09-SECURITY section 1, required auditor reading):** the Actions
  cache read/write boundary is GitHub's per-ref scope plus this repo's own write gate
  (`selectBackend` / `isTrustedSyncEvent`), and both are OS-blind. Two runners in the same scope
  were ALREADY mutually trusted. The OS partition was never a security boundary. What changed is
  which of an already-trusted writer's bytes a reader will accept, not who may write.

### TRUST-13 -- the auditor hand-off

**What the PLAN.md `<threat_model>` block MUST contain so `gsd-security-auditor` can classify
TRUST-11 and TRUST-12 independently:**

1. **The two claims, stated as QUESTIONS, not verdicts.** "Does the `saveCache` first-write-wins
   race between two same-hash producers cross a trust boundary?" and "Does collapsing the asset
   namespace change the public-repo exposure surface?"
2. **The PROPOSED classification labelled as INPUT:** *neither crosses a trust boundary, because
   the Actions cache's boundary is ref scope, not OS.* Explicitly marked "offered as INPUT to the
   audit, not as its conclusion" (REQUIREMENTS TRUST-13's own words).
3. **The CORRECTED arbitration point** with its code citations (`publish-mirror.ts:216,225,269` and
   the "no re-execution" argument), and the statement that the race is NOT reachable until XOS-04.
4. **Required reading, by path:**
   - `.planning/phases/09-os-invariant-actions-cache-version/09-SECURITY.md` section 1 -- "the OS
     partition was never a security boundary". This is the reframing that makes the delta assessable
     as BOUNDED rather than alarming.
   - Phase 9's commit range -- because Phase 9 CREATED the delta TRUST-12 records. Give the auditor
     the range explicitly (Phase 9's plan commits through the merge), not "look at git log".
   - `.planning/THREAT-MODEL.md` rows C1 (`:65`), C2 (`:66`), C9 (`:73`), C16 (`:80`).
5. **The controls in scope and their verdict-relevant status:** C1 unchanged, C2 unchanged, C16
   Actions-cache side unchanged / Releases side ADDITIVELY widened, C9 (cleanup delete-path
   discipline) extended by RETAIN-04, and the `ref` scoping now the sole in-repo control.
6. **The three anti-requirements**, so the auditor can check them: no "producing OS" claim anywhere
   (OBS-03's retraction); no self-certified verdict; no ordering-based cross-OS-safety argument.
7. **The U-01 finding**, because it is the one place two of this phase's own requirements pull
   against each other and the auditor should see the line that was drawn (guard sensitivity vs
   wrong-result guarantee) rather than discover it.

**Process constraint:** `/gsd:secure-phase` short-circuits past the auditor and writes SECURITY.md
inline when `threats_open: 0 AND register_authored_at_plan_time: true`. **Do not take that
short-circuit.** TRUST-13 forbids it in as many words, and the user's standing rule forbids it for
every gated auditor.

---

## Sequencing hazards

Things that FORCE two changes into one commit, or FORBID an ordering. Encode as `depends_on` in plan
frontmatter, never as prose (D-24).

### H-1. CORR-02 + RETAIN-04 + RETAIN-05 + CORR-05 sites 2/3 + D-20 + `build:action` = ONE COMMIT

Five independent same-commit rules converge, from four documents:
- `REQUIREMENTS.md:586` -- RETAIN-04 same commit as CORR-02 ("a new name against an unextended
  filter silently stops pruning").
- `REQUIREMENTS.md:583` -- RETAIN-05 same commit as CORR-02.
- `REQUIREMENTS.md:437` + ROADMAP SC5 -- D-20's comment rewrite in CORR-02's commit.
- `REQUIREMENTS.md:582` / ROBUST-04 -- `npm run build:action` in the same commit as any
  `serve()`-reachable edit. `release-asset-name.ts` IS reachable.
- **LINT-06 (`reportUnusedDisableDirectives: 'error'`)** forces each `eslint-disable-next-line` out
  together with its violation. A CORR-02 commit that deletes the `platform` parameter but leaves
  `release-asset-name.spec.ts:39`'s directive fails `lint`.
- **Plus one more, from C-2/C-3:** the `CORR_05_SITES` rows must be deleted in the same commit as
  their sites, or `lineIndexOf` throws.

**Cost, weighed not assumed** (09's lesson): a one-commit constraint means nothing is durable until
the whole wave lands. Phase 9's 09-03 executor was killed mid-plan by a spend limit and lost ~40
minutes of unrecoverable work under exactly this constraint. Mitigation: keep the RED for this wave
as SMALL and as EARLY as possible, and consider committing the RED (failing specs only, with the
directives still in place and the implementation unchanged) as a separate commit -- the same-commit
rules bind the *implementation* changes, not the spec RED. Verify that a RED-only commit keeps
`lint` green before relying on this.

### H-2. OBS-05 lands strictly BEFORE CORR-02

`REQUIREMENTS.md:587`: "OBS-05 -> CORR-02 -- Or `publish-verify` goes vacuous the moment the rename
lands." Concretely: today the two legs are separated only by the asset-name OS suffix. Under CORR-02
with a shared run-id seed, a Windows reader would derive `nx-cache-<run_id>` -- the exact name ubuntu
uploaded -- and pass unconditionally. OBS-05 is what keeps the names distinct.

### H-3. The bundle diff CORR-02 produces is PREDICTABLE -- predict it, then check it

MEASURED bundle contents at HEAD `c4a3b88` (`rg -uu -c -F` over `start-cache-server/index.js`):

| Symbol | In bundle? | Line(s) |
|--------|-----------|---------|
| `cachePlatform` | **YES** | def at `:68486`, called at `:68496` |
| `releaseAssetName` | **YES** | def at `:68495`, called at `:68557` (the releases-backend reader) |
| `CACHE_OS_VALUES` | **no** | tree-shaken |
| `isServerProducedAssetName` | **no** | tree-shaken |
| `cacheKeyFor` / `HASH_PATTERN` / `parseHash` | YES | 5 / 2 / 4 lines |
| `publishMirror`, `cleanupMirror`, `read-back`, `dogfoodBody`, `uploadReleaseAsset`, `resolveCompressionMethod`, `writeCountSummary`, `isSyncTrusted` | **no** | not reachable from `serve()` |
| `selectBackend`, `cacheArchivePath`, `shardTag`, `shardTagsForWindow`, `resolveMaxAgeDays`, `TRUSTED_EVENTS`, `createReleasesReadBackend`, `statusOf`, `isEntrypoint` | YES | reachable from `serve()` |

**Two consequences.**

(i) `CACHE_OS_VALUES` and `isServerProducedAssetName` being absent PROVES esbuild tree-shakes unused
exports from `release-asset-name.ts`. Post-CORR-02, `releaseAssetName` no longer calls
`cachePlatform`, and nothing else in the `serve()` graph does -- so **`cachePlatform` will be
REMOVED from the bundle.** Expected diff shape: `releaseAssetName`'s one-line body changes, the
`cachePlatform` function (~10 lines) disappears, and esbuild may renumber/rename nothing else (the
symbol claims no common base name, unlike Phase 9's `resolve`/`resolve2`/`resolve3` cascade that
produced 426 lines of pure rename). Predict "roughly a dozen lines, zero `__commonJS`
registrations changed" in the plan and then CHECK it -- never assume.

(ii) **Per-commit ROBUST-04 obligation (research target 6):**

| Wave / edit | `serve()`-reachable? | `build:action` needed in that commit? |
|-------------|---------------------|--------------------------------------|
| OBS-03: `publish-mirror.ts` seam + `action/index.ts` adapter + spec fakes | **NO** | no |
| XOS-07: `ci.yml` `needs:` + comment | NO | no |
| D-21 sweep: `ci.yml` comments + `docs-same-os-claims.spec.ts` rows | NO | no |
| OBS-05: new `mirrorSeedHash` helper | **DEPENDS ON PLACEMENT** -- see below | see below |
| OBS-05: `action/index.ts` `mirror-seed` branch | NO | no |
| OBS-05: `read-back.ts` | NO | no |
| **CORR-02 wave: `release-asset-name.ts`** | **YES** | **YES -- stage `start-cache-server/index.js` in the same commit** |
| CORR-02 wave: `cache-key.ts` comment lock | YES (file is in the bundle) but comments do not survive bundling -- a comment-only edit produces a ZERO-line bundle diff | run `check:action` to confirm zero; do not skip it |
| TRUST-10 pins (specs only) | NO | no |

**Placement decision for `mirrorSeedHash` (discretionary, with a consequence):** putting it in
`release-asset-name.ts` makes it reachable from the bundle only if something in the `serve()` graph
calls it -- nothing does -- so esbuild tree-shakes it and the bundle diff is ZERO. But it means
OBS-05's commit touches a bundle-source file, which the plan must then run `check:action` against
anyway. Putting it in a NEW `src/lib/mirror-seed.ts` keeps OBS-05's commit entirely outside the
bundle-source set. **Recommend the new file**: it is cleaner for ROBUST-04 accounting, and
`CACHE_OS_VALUES` can be imported.

### H-4. `check:action` is only meaningful in the MAIN tree

`npm run check:action` = `build:action && git diff --exit-code -- start-cache-server/index.js`.
Phase 9 measured a junctioned `node_modules` in a git worktree causing esbuild to rewrite **689
lines with no source edit** (main tree: 0). esbuild bakes the resolution path into `__commonJS` keys
and path comments. **So wave 4 must execute in the main tree, or its bundle verdict must be
explicitly deferred.** This is the INVERSE of the documented "an edit drifts the bundle" rule with
an identical symptom, which is what makes it dangerous.

Combined with the AGENTS.md decision rule: no plan in this phase changes deps, so waves 2, 3 and 5
are worktree-eligible. **Wave 4 is not.**

### H-5. XOS-02's baseline window closes permanently at the rename

D-25: capture a FRESH pre-rename baseline (`nx reset`, then start the sidecar -- **that order**, per
VER-07/TEST-10: `nx reset` deletes `.nx/cache`, which is where the archive lives, so resetting under
a running sidecar 500s the next PUT) AND cite the existing 2026-07-26 record
(`.planning/quick/260725-w3s-.../260725-w3s-STEP0-RESULTS.md`). Must complete **before any rename
commit AND before the merge to `main`** -- a merge triggers `publish`, which republishes under the
new name.

### H-6. CORR-02 is rotation window 3 of 3; do not author anything that fires on it

OBS-04's tripwire is gated on TWO consecutive all-miss pushes with NO version-affecting change in
between. CORR-02 rotates the ASSET NAME, not the cache version -- so `publishMirror`'s
all-restore-MISS warning (which is about the `@actions/cache` VERSION) should NOT fire at all: the
restores still HIT, only the asset names are new, so the first post-rename push publishes a full new
set of names. **Predicted signal for the first post-rename default-branch push:**
`scanned` unchanged, `mirrored` ~9 on the ubuntu leg (every name is new), `skipped` low,
`readMisses` 0, no warning. That differs from ROADMAP's "expect the first such push to publish
nothing" -- see the Assumptions Log entry A-3.

### H-7. Guard-shape hazards from Phase 9's validation (research target 9)

Both disproved failure modes are LIVE in this phase's work.

**(a) A hand-authored OS literal is pinned at a CI sampling rate of ZERO.** `test` is single-leg
`ubuntu-24.04-arm` (VERIFIED). So on the only runner the unit suite executes, `cachePlatform()` IS
`'linux'`, and any assertion whose expected value is the literal `'linux'` is indistinguishable from
one derived from the running machine. Applies to:

| This phase's assertion | Shape that DOES bite |
|------------------------|----------------------|
| the `mirrored-by` label value | `it.each(CACHE_OS_VALUES)` with `cachePlatform` MOCKED to each member, asserting the label equals `` `mirrored-by: ${os}` ``. Never a `'linux'` literal. |
| `mirrorSeedHash`'s per-OS output | `it.each(CACHE_OS_VALUES)` deriving the expected index from `CACHE_OS_VALUES.indexOf(os)` -- but ALSO one hand-pinned literal per OS (`feed0<runId>`, `feed1...`, `feed2...`) so a change to the marker or slot order goes red. Both, for the same reason `release-asset-name.spec.ts:11-19` pins literals. |
| `read-back.ts`'s tightened producer expectation | mock `cachePlatform`, drive `run()` once per `CACHE_OS_VALUES` member, assert the reader accepts its OWN and REJECTS each other member |
| D-18's "no platform token" clause | loop the whole `CACHE_OS_VALUES` tuple, never `process.platform` (LINT-02 bans it anyway) |
| D-17's moved site-4 assertion | this one is DELIBERATELY machine-dependent and belongs in `integration` precisely because `integration` is a two-leg matrix -- that is the entire justification for the move, and it is MEASURED correct (the merged `integration` inputs carry the platform runtime discriminator, so it runs and caches per OS) |

**(b) A negated matcher inside `toHaveBeenCalledWith` is vacuous.**
`expect(fn).toHaveBeenCalledWith(expect.not.stringMatching(/x/))` asserts "SOME call lacks x". This
phase has two absence claims where the trap applies:

| Absence claim | WRONG shape | RIGHT shape |
|---------------|-------------|-------------|
| no uploaded asset name carries a platform token | `expect(upload).toHaveBeenCalledWith(expect.not.stringContaining('linux'), ...)` | pin the COUNT (`toHaveBeenCalledOnce` / assert `.mock.calls.length`) then assert over EVERY recorded argument array: `for (const call of upload.mock.calls) { for (const os of CACHE_OS_VALUES) expect(call[1]).not.toContain(os); }` |
| no `core.warning` claims a "producing OS" | a negated matcher | count-pinned + `not.toContainEqual` over every recorded argument (the exact fix 09-VALIDATION G3 landed on `publish-mirror.spec.ts`) |

**Negate the QUANTIFIER, not the predicate.** And per D-11, assert the label as part of the whole
argument ARRAY via deep equality on `.mock.calls`, not with a separate matcher -- Phase 9 measured
that `toEqual` and `toStrictEqual` return identical verdicts on all eight argument shapes on vitest
4.1.10, so the load-bearing choice is asserting the WHOLE array, not which matcher.

**(c) Mutation-test every new guard and predict which case reddens.** This is the only instrument
that separates a guard that bites from one that merely exists, and it DISPROVED two Phase 9 guards
that looked fine. Minimum mutation set for this phase:

| Mutation | Predicted redness |
|----------|-------------------|
| `releaseAssetName` returns `` `${hash}` `` (drop the prefix) | the pinned literal case; the D-18 equality clause stays green (it rebuilds from the helper) -- which is exactly why the literal is needed |
| `releaseAssetName` returns `` `${CACHE_KEY_PREFIX}${hash}-${cachePlatform()}` `` (re-add the token) | D-18's no-platform-token clause reddens; the exactly-one and equality clauses stay GREEN |
| `isServerProducedAssetName` = branch A only | the legacy accept cases redden; the disjointness table stays green |
| `isServerProducedAssetName` = `A && B` instead of `A \|\| B` | every accept case reddens |
| the label hoist moved back inside the loop | nothing should redden (behaviourally identical) -- state this, so nobody claims the hoist is guarded when it is not |
| `mirrorSeedHash` drops the OS index | the per-OS literal cases redden; a `CACHE_OS_VALUES.indexOf`-derived-only assertion would ALSO redden, but the literal is what catches a marker change |
| `read-back.ts` label assertion compares against a hardcoded `'linux'` | the mocked non-linux `it.each` cases redden |
| `publish` `needs:` reverted to `build` | **nothing reddens today** -- there is no guard. If XOS-07 deserves one, it needs a new `jobBlock('publish')` assertion. State the gap rather than implying coverage. |

---

## Runtime State Inventory

This phase renames an asset-name scheme, so the rename/refactor inventory applies. **A grep audit
finds files; it does not find runtime state.**

| Category | Items found | Action required |
|----------|-------------|------------------|
| **Stored data** | **122 Release assets in `cache-mirror-202607` (release id `354838660`) carry the OLD `<hash>-<os>` or PoC `<hash>.tar.gz` names.** 46 `-linux`, 26 `-windows`, 50 `.tar.gz`. Also: the Actions cache holds `nx-cache-<hash>` keys, which this phase does NOT rename (only the ASSET name changes). | **NO data migration.** RETAIN-04's legacy branch keeps the 72 OS-suffixed assets prunable so they age out via `CACHE_MIRROR_MAX_AGE_DAYS`; read-fallback is explicitly out of scope because the mirror repopulates on the next default-branch push. The 50 `.tar.gz` are D-08 accepted dead weight. **Code edit only.** |
| **Live service config** | `label` is EMPTY (`""`) on all 122 existing assets -- verified via `gh api`. So OBS-03's field starts unpopulated for every legacy asset. No GitHub-side setting, no dashboard, no external service config carries the asset-name scheme. | **None.** Backfill via `PATCH .../releases/assets/{asset_id}` is POSSIBLE (verified) but out of scope. |
| **OS-registered state** | None. No Windows Task Scheduler entry, no pm2/launchd/systemd unit, no scheduled local job references the asset name. The only scheduler is `.github/workflows/cleanup.yml` (a GitHub `schedule:`), which references the FILTER by import, not by literal. | **None -- verified by `git grep` over `.github/workflows/` for the name scheme, plus the `cleanup.yml` job reading only `isServerProducedAssetName`.** |
| **Secrets / env vars** | None renamed. `GITHUB_TOKEN`/`GH_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_REF`, `GITHUB_RUN_ID`, `NX_SELF_HOSTED_REMOTE_CACHE_*`, `CACHE_MIRROR_MAX_AGE_DAYS`, `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION` are all untouched. D2-02 forbids a new env knob and PARITY-07 guards it. | **None.** |
| **Build artifacts / installed packages** | **`start-cache-server/index.js` (the COMMITTED esbuild bundle) inlines `releaseAssetName` and `cachePlatform`** and is executed from the git ref by four `ci.yml` sidecar jobs rather than from a build output. Also `packages/github-cache/dist/**` (gitignored, rebuilt in-job by every `npm run build`). | **`npm run build:action` in CORR-02's commit + `npm run check:action` in acceptance (D-27/ROBUST-04).** `dist/**` needs nothing -- every consuming job rebuilds it. |

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Reading a Release asset's label | a new method on `ReleaseReadClient` | a direct native `fetch` in `read-back.ts` on `GET /repos/{o}/{r}/releases/tags/${shardTag()}` | The reader seam is in the `serve()` bundle; widening it triggers ROBUST-04 and puts an attribution concern in the consumer read path |
| The month-shard tag | a date format string | `shardTag()` / `shardTagsForWindow()` from `lib/retention.ts:54,134` | Already single-sourced and clock-injectable |
| The hex hash class | a new regex | `HASH_PATTERN` from `cache-key.ts:21` | RETAIN-04's new branch must reuse the same class the old one did |
| The prefix literal | a second authored copy | import `CACHE_KEY_PREFIX` | `cache-key.spec.ts:108-137` fails on a second authored copy |
| A ci.yml job-block extractor | a new parser | `jobBlock()` from `dogfood-cross-os.spec.ts:62-77` (comment-STRIPPED) | Shipped and mutation-proven. For COMMENT locks use `docs-same-os-claims.spec.ts`'s raw `read(file)` instead |
| A phrase-keyed drift table | a new mechanism | extend `DOCS_08_SITES` in `docs-same-os-claims.spec.ts:50-151` | Shipped, phrase-keyed (not line-keyed), and already the D-21 pattern of record |
| An authored-literal counter | a new helper | `countAuthored` in `cache-key.spec.ts:17-32` | Comment-stripping, counts occurrences not lines |
| A partial module mock for `cachePlatform` | a full module stub | the `async (orig)` + spread idiom at `action/index.spec.ts:83-95` | Keeps `CACHE_OS_VALUES` REAL, which is what makes the `it.each` axis honest |
| A bundle drift check | a bespoke diff | `npm run check:action` | Already `build:action && git diff --exit-code -- start-cache-server/index.js` |
| A cleanup dry-run against live GitHub | a network fixture | a `CleanupClient` fake built from D-08's measured census counts | The engine is pure orchestration behind an injected seam; `cleanupMirror` needs no network |

**Key insight:** every mechanism this phase needs already exists in the tree, mutation-proven, from
Phases 4-9. The phase's real work is deletion (`platform`), one additive branch, one seam parameter,
one derived-hash helper, and prose that stops being false. Any new *mechanism* proposed by a plan is
a smell.

---

## Common Pitfalls

### Pitfall 1: reading "no occurrence of X" from `git grep` on an untracked path
**What goes wrong:** zero matches reads identical to verified-absent. **Why:** `git grep` searches
the index only. **Avoid:** use `rg` for every absence claim, or confirm the path is tracked first.
Recurred THREE times in Phase 9. Note the new `release-asset-name.integration.spec.ts` will be
UNTRACKED when first written -- the highest-risk path in this phase. **Warning sign:** an absence
criterion whose subject is a file the same plan just created.

### Pitfall 2: `git grep -c` counts LINES
**What goes wrong:** an occurrence-count criterion is wrong by construction. **Avoid:** `git grep
-n` and count hits, or `countAuthored`. `uploadReleaseAsset` appears on **22 lines** of
`publish-mirror.spec.ts` but has only 4 fake definitions and 4 argument assertions.

### Pitfall 3: an import-level RED
**What goes wrong:** a whole-suite import failure means no assertion was ever evaluated -- it proves
wiring, not bite. **Avoid:** state which KIND of RED each task achieved; require assertion-level.
09-04 volunteered this about itself.

### Pitfall 4: `npm run typecheck` / `lint` serving a stale PASS after a spec-only edit
**What goes wrong:** Phase 9 measured `Cache: 2/2 hit` with no re-run after editing only spec files.
**Avoid:** post-edit verification of specs uses `--skip-nx-cache`. Also: vitest transpiles without
type-checking, so a green suite can hide a real `TS2339` (09-06 hit exactly that).

### Pitfall 5: a comment-only edit read as a bundle regression, or vice versa
**What goes wrong:** `cache-key.ts` is in the bundle, so a reviewer expects a diff; comments do not
survive bundling, so the correct diff is ZERO. Conversely a junctioned worktree produces 689 lines
with no source edit. **Avoid:** run `check:action` in the MAIN tree and state the EXPECTED diff
before running it.

### Pitfall 6: correcting a claim without supplying a replacement reason
**What goes wrong:** deleting a justification leaves a future reader holding a documented argument
for undoing the work. Phase 9's 09-06 nearly shipped this. **Avoid:** every corrected comment in the
D-21 sweep gets a NEW reason on a different axis. Two specific instances here: the
"needs: build (NOT test)" comment (replacement reason = `!cancelled()`), and
`publish-mirror.ts:159`'s byte-identity comment (replacement reason = one-entry-per-hash).

### Pitfall 7: a same-OS sweep scoped to prose
**What goes wrong:** Phase 9's DOCS-08 enumerated four DOC sites; the regression came from a FIFTH
in `read-back.ts`'s executable-logic comment, and a SIXTH in a `ci.yml` capacity comment nobody had
recorded. **Avoid:** the D-21 sweep enumerates EXECUTABLE code and CI prose. Known live targets
this research found: `ci.yml:1109` (`publish-verify` job comment), `ci.yml:1051,1056` (shard growth,
third correction), `ci.yml:1013` and `:1054` (two more "its own OS" phrases), `test/workspace-root-cwd.ts:38`
(stale `releaseAssetName(hash, platform)` signature), `dogfood-body.ts:19` (the contrast case D-04
deletes), `read-back.ts:14` (`as <run_id>-<os>` in the doc block), `read-back.ts:33`
(`Each OS leg resolves ONLY its own-OS asset NAME`).

### Pitfall 8: assuming the ordering that carries U-01 is a guarantee
**What goes wrong:** a comment that says "ubuntu runs first" reads as a documented property.
GitHub documents matrix CREATION order only, and the two legs are in different runner pools.
**Avoid:** the comment says "MEASURED 5/5, run ids cited; NOT a documented guarantee", and the label
assertion is what removes the dependence.

---

## Code Examples

### The two-branch filter with the disjointness mechanism made explicit
```ts
// release-asset-name.ts -- post-RETAIN-04. Named separately because RETAIN-05(b)
// requires asserting them mutually exclusive DIRECTLY, which needs two subjects.
//
// DISJOINTNESS IS A PROPERTY OF THE PREFIX, NOT OF THE SPLIT. CACHE_KEY_PREFIX
// ('nx-cache-') itself CONTAINS a '-', and HASH_PATTERN forbids '-', so for any
// name branch A accepts, name.lastIndexOf('-') === CACHE_KEY_PREFIX.length - 1 and
// branch B's hash half is exactly 'nx-cache' -- which holds a '-' and can never
// match HASH_PATTERN. Belt: even a dashless prefix would work, because an
// A-accepted name would then contain zero dashes and B's `separator < 0` guard
// rejects it. MEASURED: 0 collisions over a 26-case adversarial table plus 1.6M
// randomised candidates (10-RESEARCH.md).
function isCurrentAssetName(name: string): boolean {
  return (
    name.startsWith(CACHE_KEY_PREFIX) &&
    HASH_PATTERN.test(name.slice(CACHE_KEY_PREFIX.length))
  );
}
```

### The absence assertion that actually bites (negate the quantifier)
```ts
// Source: the 09-VALIDATION G3 fix, applied to this phase's no-platform-token claim.
const calls = vi.mocked(fake.uploadReleaseAsset).mock.calls;

expect(calls).toHaveLength(1);                      // pin the COUNT first

for (const call of calls) {
  for (const os of CACHE_OS_VALUES) {               // the whole tuple, never "not this machine"
    expect(call[1]).not.toContain(os);
  }
}
```

### The whole-argument-array assertion for the new `label` (D-11)
```ts
// Source: Phase 9 D-11's shape. Assert the WHOLE array; that, not toEqual-vs-
// toStrictEqual, is the load-bearing choice (09-03 measured the matchers identical
// on all eight argument shapes under vitest 4.1.10).
expect(vi.mocked(fake.uploadReleaseAsset).mock.calls).toEqual([
  [SHARD_ID, releaseAssetName(HASH), BYTES, `mirrored-by: ${os}`],
]);
```

### The partial mock that keeps the OS tuple real
```ts
// Source: action/index.spec.ts:83-95 (shipped).
vi.mock('../lib/release-asset-name.js', async (orig) => {
  const actual = await orig<typeof import('../lib/release-asset-name.js')>();

  return { ...actual, cachePlatform: vi.fn((): CacheOs => 'linux') };
});
```

---

## State of the Art

| Old approach | Current approach | When changed | Impact on this phase |
|--------------|------------------|--------------|----------------------|
| Asset name `<hash>-<os>` (CORR-01) | `nx-cache-<hash>` (CORR-02, D2-03) | this phase | supersedes CORR-01's "OS-namespaced by default" branch |
| Restore is same-OS | cross-OS restore WORKS | Phase 9 (VER-01 + VER-03) | breaks publisher-equals-producer; OBS-03's retraction exists because of it |
| Producer attribution from the asset NAME | attribution from Release `label` metadata | this phase (OBS-03) | the label names the PUBLISHER, never the producer |
| `read-back.ts` accepts any known producer | tightens to one producer per leg | this phase (OBS-05/D-15) | the "genuinely VARIABLE producer" justification is UPDATED, not deleted |
| `publish` `needs: build` | `needs: [build, typecheck, test, integration]` | this phase (XOS-07) | one push mirrors that push's full task set |
| Ordering-based cross-OS safety argument | platform-agnosticism (CORR-05) | v0.0.2 requirements | REJECTED explicitly in `PROJECT.md` Key Decisions; U-01 tests the boundary |

**Deprecated / outdated in the tree right now:**
- `releaseAssetName`'s `platform` parameter -- deleted by D-04.
- `release-asset-name.ts:33-48`'s whole doc block ("OS-namespaced ... a read on platform P can only
  ever resolve an asset produced under platform P") -- FALSE after CORR-02, and it is executable-adjacent
  prose of exactly Pitfall 7's class.
- `test/workspace-root-cwd.ts:38` and `dogfood-body.ts:19` -- both cite the two-argument signature.
- `ci.yml:1109` -- "each OS leg reads back ONLY its own-OS asset ... proves the same-OS
  publisher->reader contract". Flagged by `read-back.ts:128-137` as Phase 10's to fix.
- `ci.yml:1051-1063` -- the `~5 -> ~10` shard-growth estimate, third correction due.

---

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | Vitest `~4.1.0` (measured effective `4.1.10` per 09-03's matcher measurement) |
| Unit config | `packages/github-cache/vitest.config.mts` -- includes `**/*.{test,spec}.ts`, EXCLUDES `*.integration.spec.ts` |
| Integration config | `packages/github-cache/vitest.integration.config.mts:16` -- `include: ['{src,tests}/**/*.integration.spec.{ts,mts,cts}']`; distinct `cacheDir` |
| Quick run (unit) | `npx nx run @op-nx/github-cache:test --skip-nx-cache` |
| Full unit suite | `npm run test` |
| Integration suite | `npm run integration` (Nx target defined in `project.json`, merged inputs from `nx.json targetDefaults.integration`) |
| Type check | `npm run typecheck` -- catches what a green suite cannot (vitest transpiles without type-checking) |
| Lint | `npm run lint` -- LINT-06 `reportUnusedDisableDirectives: 'error'` makes a stale disable a build failure |
| Bundle drift | `npm run check:action` -- MAIN TREE ONLY |
| CI sampling: `test` | **ubuntu-24.04-arm ONLY, single leg** -- so any hand-authored `'linux'` literal is sampled at rate ZERO |
| CI sampling: `integration` | **two-leg `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`** -- the only every-PR two-OS sampler |
| CI sampling: `publish` / `publish-verify` | **push-to-`main` ONLY** -- unobservable pre-merge; this is why Phase 9's regression was only findable live |
| CI sampling: `action-bundle-drift` | every PR and every push (no job-level `if:`, pinned by `dogfood-cross-os.spec.ts:138-151`) |

### Phase requirements -> test map

| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|--------------|
| CORR-02 | `releaseAssetName(hash)` is exactly `nx-cache-<hash>`, pinned as a LITERAL | unit | `npx nx run @op-nx/github-cache:test --skip-nx-cache -- release-asset-name` | [OK] `src/lib/release-asset-name.spec.ts` (re-authored) |
| CORR-02 | reader and publisher both derive through the ONE helper (no inlined template) | unit | same, `releases-backend` + `publish-mirror` | [OK] `releases-backend.spec.ts:128-135`, `publish-mirror.spec.ts:127-136` |
| CORR-02 | the prefix literal is authored exactly ONCE across leaf + 3 consumers | unit (source-reading) | same, `cache-key` | [OK] `cache-key.spec.ts:108-137` -- EXTEND the `files` map with `release-asset-name.ts` -> 0 |
| CORR-02 | the committed bundle matches a fresh build | artifact diff | `npm run check:action` (**main tree**) | [OK] existing script; CI job `action-bundle-drift` |
| CORR-05 | zero extant ambient-platform reads in unit specs | unit (source-reading) | same, `lint-rules` | [OK] `lint-rules.spec.ts` -- `CORR_05_SITES` empties; ADD `expect(CORR_05_SITES).toEqual([])` (C-2) |
| CORR-05 | the ban still fires on all six evasion shapes at a unit path and is exempt at an integration path | unit | same, `lint-rules` | [OK] `EVASION_SHAPES` `:353-503`, driven `:504-513`, `:524-535` -- unchanged |
| CORR-05 | `cachePlatform()`'s default-argument contract, sampled on BOTH OSes | **integration** | `npm run integration` | [FAIL] **Wave 0: NEW** `src/lib/release-asset-name.integration.spec.ts` (D-17) |
| CORR-05 | D-18's replacement: exactly one requested name, equal to the helper's, no platform token | unit | same, `releases-backend` | [OK] EXTEND `releases-backend.spec.ts:128-135` |
| RETAIN-04 | both name families accepted | unit | same, `release-asset-name` | [OK] `release-asset-name.spec.ts:66-103` -- extend accept/reject sets |
| RETAIN-04 | a cleanup dry-run over a mixed shard prunes both families and never a foreign asset | unit (engine + fake) | same, `cleanup` | [OK] `src/cleanup/cleanup.spec.ts` -- add a mixed-shard fixture from D-08's counts |
| RETAIN-05b | the two branches are mutually exclusive, asserted DIRECTLY over an adversarial table | unit | same, `release-asset-name` | [FAIL] **Wave 0: NEW describe** -- 26-row table + the 3 structural atoms (see RETAIN-04 notes) |
| RETAIN-05c | `CACHE_KEY_PREFIX` pinned + comment-locked as governing FOUR things | unit (source-reading) | same, `cache-key` | [OK] extend `cache-key.spec.ts:108-137` |
| RETAIN-05a | the 50 `.tar.gz` disposition is RECORDED with a count | **documentation, not a test** | n/a -- an artifact under `.planning/phases/10-.../` | [FAIL] **NEW note file** (D-08 + D-26 can share one) |
| OBS-03 | the label is a 4th positional arg on every upload, value `mirrored-by: <os>`, asserted over the WHOLE argument array, `it.each(CACHE_OS_VALUES)` | unit | same, `publish-mirror` | [OK] `publish-mirror.spec.ts` -- 4 fakes + 4 argument assertions (C-6) |
| OBS-03 | `cachePlatform()` is called ONCE per run, not per iteration | unit | same, `publish-mirror` | [FAIL] **Wave 0: NEW case** -- `expect(cachePlatformMock).toHaveBeenCalledOnce()` on a multi-hash fixture. Without it the hoist is unguarded (H-7c) |
| OBS-03 | the real Octokit adapter forwards `label` into `uploadReleaseAsset` | unit | same, `action/index` | [OK] `action/index.spec.ts` -- extend the adapter test |
| OBS-03 | no file claims "producing OS" / "whose bytes" | unit (source-reading) | same, `docs-same-os-claims` | [OK] `docs-same-os-claims.spec.ts:194-207` -- extend `EDITED_FILES` to cover this phase's edits |
| OBS-05 | `mirrorSeedHash` yields a distinct, hex, non-all-decimal key per `CACHE_OS_VALUES` member | unit | same, `mirror-seed` | [FAIL] **Wave 0: NEW** `src/lib/mirror-seed.spec.ts` (+ `CACHE_OS_VALUES.length < 10`) |
| OBS-05 | the derived seed survives `parseHash`, `isServerProducedKey`, `releaseAssetName` and BOTH cleanup branches | unit | same | [FAIL] **Wave 0: NEW** -- a round-trip case in `mirror-seed.spec.ts` |
| OBS-05 | `read-back.ts` accepts its OWN leg's seed payload and REJECTS every other member's | unit | same, `read-back` | [OK] `read-back.spec.ts:80` `it.each(CACHE_OS_VALUES)` -- TIGHTEN (D-15) |
| OBS-05 | **the read-back asset's `mirrored-by` label equals the reader's own OS** (the U-01 control) | unit | same, `read-back` | [FAIL] **Wave 0: NEW cases** -- fake asset-list reader; mutation = flip the label |
| OBS-05 | the `mirror-seed` operation PUTs at the DERIVED hash, not at the raw `hash` input | unit | same, `action/index` | [FAIL] **Wave 0: NEW case** -- assert the fetched URL path. This is the `url`-reuse trap; without this case the trap ships silently |
| OBS-05 | live: each `publish-verify` leg reads back its OWN leg's asset | **live CI, push-to-`main` only** | `publish-verify` job | [OK] job exists; **NOT observable pre-merge** -> Live-CI close |
| XOS-06 | `max-parallel: 1` retained | unit (ci.yml value) | same, `dogfood-cross-os` or a new guard | [FAIL] **OPTIONAL NEW** -- `jobBlock('publish')` matches `/max-parallel:\s*1/`. No guard exists today |
| XOS-06 | the comment records "not a correctness control" + the rejected argument + the U-01 sensitivity | unit (raw-file phrase) | same, `docs-same-os-claims` | [FAIL] **NEW rows** in `DOCS_08_SITES` (raw `read(file)` sees comments; `jobBlock` does not) |
| XOS-07 | `publish` declares `needs: [build, typecheck, test, integration]` | unit (ci.yml value) | same | [FAIL] **NEW** -- `jobBlock('publish')` matches all four |
| XOS-07 | the comment records `!cancelled()` as the mechanism | unit (raw-file phrase) | same, `docs-same-os-claims` | [FAIL] **NEW row** |
| XOS-07 | live: one push mirrors that push's full task set | **live CI** | asset census after the merge push | [OK] `gh api` -- Live-CI close |
| TRUST-10 | C1/C2 unchanged | commit-range diff + existing specs | `git diff <base>..HEAD -- src/lib/trust.ts src/lib/sync-gate.ts` (expect empty) + `trust.spec.ts`, `sync-gate.spec.ts` | [OK] |
| TRUST-10 | C16 Actions-cache side unchanged | function-scoped diff + accept/reject pin | `cache-key.spec.ts:34-74` | [OK] |
| TRUST-10 | `listCacheEntries` is `ref`-scoped, pinned by spec + comment-locked | unit | same, `action/index` | [FAIL] **Wave 0: NEW case** -- whole-argument-array assertion on `octokit.paginate` + call count |
| TRUST-11/12 | recorded in the PLAN.md `<threat_model>` block as INPUT | **plan artifact** | plan-checker reads it | n/a |
| TRUST-13 | classified BY `gsd-security-auditor` in SECURITY.md | **agent gate** | `/gsd:secure-phase` -> `gsd-security-auditor` | n/a -- **do NOT take the inline short-circuit** |

### Sampling rate

- **Per task commit:** `npx nx run @op-nx/github-cache:test --skip-nx-cache` (the
  `--skip-nx-cache` is not optional after a spec-only edit -- Phase 9 measured a `2/2 hit` stale
  PASS), plus `npm run lint` on any commit touching a disable directive.
- **Per wave merge:** `npm run test && npm run typecheck && npm run lint && npm run integration`.
  Wave 4 additionally `npm run check:action` **in the main tree**.
- **Phase gate:** full battery green, then `/gsd:verify-work`.
- **Live-CI close (NOT samplable pre-merge, three items):** `publish-verify` per-leg own-asset
  read-back (OBS-05), a default-branch push republishing the mirror under the new name (Phase 11's
  precondition), and the post-XOS-07 full-task-set mirror. `publish`/`publish-verify` are
  `push`-gated to `main`, so no PR run samples them at any rate -- exactly why Phase 9's regression
  was only findable live.

### Wave 0 gaps

New files and new cases required before or alongside implementation:

- [ ] `packages/github-cache/src/lib/release-asset-name.integration.spec.ts` -- covers CORR-05 site 4
      (D-17). MEASURED to be hashed by the `integration` target and to run on both OS legs.
- [ ] `packages/github-cache/src/lib/mirror-seed.ts` + `mirror-seed.spec.ts` -- covers OBS-05's
      derivation and its `CACHE_OS_VALUES.length < 10` injectivity pin. New file rather than
      `release-asset-name.ts` so OBS-05's commit stays outside the bundle-source set (H-3).
- [ ] `release-asset-name.spec.ts` -- NEW `describe` for RETAIN-05(b): the 3 structural atoms plus
      the 26-row adversarial disjointness table with the both-count pinned to 0.
- [ ] `publish-mirror.spec.ts` -- NEW case: `cachePlatform` called exactly ONCE per run (guards the
      D-10 hoist, which is otherwise unguarded).
- [ ] `read-back.spec.ts` -- NEW cases: the `mirrored-by` label assertion (U-01) and its
      wrong-label rejection.
- [ ] `action/index.spec.ts` -- NEW cases: the `mirror-seed` branch PUTs at the DERIVED hash (the
      `url`-reuse trap), and `listCacheEntries` passes the constructor's `ref` (TRUST-10).
- [ ] `docs-same-os-claims.spec.ts` -- NEW `DOCS_08_SITES` rows for the D-21 sweep: `ci.yml`'s
      `publish-verify` job comment, the shard-growth third correction, the `max-parallel: 1`
      not-a-correctness-control lock, the `needs:`/`!cancelled()` replacement reason.
- [ ] `cleanup.spec.ts` -- mixed-shard fixture built from D-08's measured census counts.
- [ ] OPTIONAL: a `jobBlock('publish')` guard for `needs:` and `max-parallel: 1` values. **No such
      guard exists today**; without it, reverting XOS-07's `needs:` reddens nothing.
- [ ] Recording artifacts (not tests): D-08's census + bounding argument, D-25's fresh XOS-02
      baseline, D-26(a)+(b) SC6 notes.

**Framework install:** none. **New fixture file:** none -- every harness needed already exists.

---

## Security Domain

`workflow.security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`
(measured in `.planning/config.json`).

### Applicable ASVS categories

| ASVS category | Applies | Standard control in this phase |
|---------------|---------|-------------------------------|
| V2 Authentication | partly | unchanged. Token resolution via `resolveGitHubToken` / `resolveLocalReadToken`; no new credential path. The `mirror-seed` operation reuses `serve()`'s existing per-process CSPRNG bearer token |
| V3 Session management | no | no sessions |
| V4 Access control | **yes** | C1 write-trust allowlist (`trust.ts:32`) + C2 sync gate + the `ref` scoping on `listCacheEntries`. TRUST-10 verifies all three UNCHANGED by assertion. The `ref` scoping becomes the SOLE in-repo control after the OS-version barrier's removal |
| V5 Input validation | **yes** | `HASH_PATTERN` at the SRV-03 route boundary (`server.ts:111` -> `parseHash`) and at the C16 mirror filter. The new derived seed must pass BOTH -- verified. The two-branch cleanup filter is a validation widening on a DELETE path and is the highest-attention change in the phase |
| V6 Cryptography | no | none hand-rolled; nothing added |
| V7 Error handling / logging | **yes** | fail-closed writes, best-effort reads is preserved. Only asset NAMES and numeric statuses reach logs; restored cache bytes never do (`action/index.ts:358-363`'s recorded rule). The new label value is derived, never user-supplied |
| V10 Malicious code | **yes** | zero new dependencies -> no supply-chain delta. `check:action` proves the committed bundle matches a fresh build |
| V12 Files / resources | **yes** | the `~2 GiB` pre-upload boundary and the 1000-asset cap are untouched; the label is a query param and cannot influence the filename or the download URL (VERIFIED) |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation | Status in this phase |
|---------|--------|--------------------|----------------------|
| Foreign asset pruned as ours (over-wide DELETE filter) | Tampering / DoS | narrow accept-list validated against `HASH_PATTERN` + a known value set | **CHANGED (additive).** RETAIN-04 adds one branch. Disjointness MEASURED. D-08 refuses the third branch precisely because `<hash>.tar.gz` is indistinguishable from a foreign asset |
| Non-default-branch trusted write reaching the public mirror | Information disclosure | `ref`-scoped enumeration + `isSyncTrusted` | **UNCHANGED but now SOLE.** TRUST-10 pins it. `TRUSTED_EVENTS` includes `push` with no ref check |
| Secret in a mirrored task's captured terminal output | Information disclosure | the invariant "no mirrored task ever prints a secret" -- NOT `::add-mask::`, which redacts logs only, never a cache payload (`ci.yml:1067-1074`) | **UNCHANGED.** XOS-07 widens which JOBS gate `publish`, not which tasks route through the sidecar |
| First-write-wins arbitrating between differing payloads | Tampering | one Actions-cache entry per hash; both legs upload it verbatim | **NOT REACHABLE until XOS-04.** TRUST-11's correction |
| False attribution of a served artifact to a producer | Repudiation | `mirrored-by` label, with an EXPLICIT retraction that it is the publisher not the producer | **NEW (OBS-03).** The retraction is the security-relevant part: a wrong attribution claim in an incident is worse than no claim |
| A guard that passes vacuously | (process) | mutation-test every guard and predict which case reddens | **LIVE RISK.** H-7 enumerates the two Phase-9-disproved shapes and the correct form for each |
| Slopsquatted dependency | Supply chain | package legitimacy gate | **N/A** -- zero new packages |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | [OK] | `v24.13.0` (`.node-version` = `lts/krypton`, a moving alias) | -- |
| npm | `npm ci` in CI, scripts locally | [OK] | `11.6.2` | -- |
| Nx | all targets | [OK] | `23.1.0` | -- |
| `gh` CLI | D-08 census, U-01 timestamps, live-CI close | [OK] | authenticated against `op-nx/github-cache` this session | `curl` + a PAT |
| `rg` | absence claims | [OK] | Chocolatey x86_64 under QEMU | -- |
| `git grep` | tracked-file search | [OK] | -- | -- |
| esbuild (via `esbuild.action.mjs`) | `build:action` for D-27 | [OK] | pinned devDependency | -- |
| `zstd` on `windows-11-arm` | VER-05's compression component | [OK] | `1.5.7` at `C:\tools\zstd` (measured 2026-07-26) | not this phase's concern |
| A `windows-11-arm` runner | `integration` leg, `publish`/`publish-verify` Windows legs, D-25's local baseline | [OK] | this workstation IS Windows 11 arm64 | -- |
| A default-branch push | the Live-CI close | [OK] | maintainer-gated | none -- structurally unavailable pre-merge |

**Missing dependencies with no fallback:** none.
**Missing with fallback:** none.
**Structurally unavailable:** pre-merge observation of `publish` / `publish-verify` (push-gated to
`main`). This is not a tooling gap; it is why the Live-CI close exists.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A-1 | `!cancelled()` runs `publish` when a `needs:` dependency FAILED (not merely when skipped) | XOS-07 | `[CITED: docs.github.com .../workflow-syntax#jobsjob_idneeds, .../expressions]`. NOT empirically confirmed in this repo -- no run on record has a failed `publish` ancestor. **Bounded downside:** `publish` gets skipped on a red-`test` push -- a mirror GAP, never a wrong artifact. The rewritten comment must name this failure mode. Falsifiable by one push with a deliberately failing `test`. |
| A-2 | `max-parallel: 1` will keep starting the ubuntu leg first | U-01 | **UNDOCUMENTED.** Measured 5/5; GitHub documents matrix CREATION order only, and names runner availability as a scheduling input. Different runner pools per leg make this an independent variable. **Mitigated by design:** the `mirrored-by` label assertion removes the dependence on order, leaving only non-overlap. |
| A-3 | The first post-rename default-branch push publishes a FULL new set of names, and `publishMirror`'s all-restore-MISS warning does NOT fire | H-6 | ROADMAP's Live-CI close says "expect the first such push to publish nothing" if it coincides with Phase 9's rotation window. That window is SPENT (sampled on run `30400231720`; 09-EVIDENCE's ADDENDUM is the record). CORR-02 rotates the ASSET NAME, a different mechanism from the cache VERSION the warning is about -- so restores should still HIT and every name should be new. **Reasoned, not measured.** Falsified if the ubuntu leg reports `mirrored: 0` with `readMisses == scanned`. |
| A-4 | esbuild will tree-shake `cachePlatform` out of the bundle post-CORR-02 | H-3 | Strong basis: `CACHE_OS_VALUES` and `isServerProducedAssetName` from the same module are ALREADY absent, proving the mechanism. Still an inference about a future build. Falsified by `check:action`'s actual diff -- which the plan runs anyway. |
| A-5 | Nx task hashes remain all-decimal, so the D-12 seed stays structurally disjoint | OBS-05 | Verified over 153 local entries (Phase 9) and re-corroborated by the live shard census (every real hash in the 122-asset census is all-decimal). An Nx version that rendered hashes as hex would break the structural argument down to a probabilistic one. Falsified by a hex-containing task hash after an Nx bump. |
| A-6 | No plan in this phase changes `package.json` / the lockfile | Package Legitimacy Audit, H-4 | Follows from "zero new dependencies", which follows from every mechanism already existing. Falsified if a plan reaches for a new library -- which would itself be the smell named in Don't Hand-Roll. |
| A-7 | `eslint.config.mjs:263` is still LINT-02's spec scoping | drift table | Not re-verified this session. Cited only by a code comment (`action/index.ts:284`), load-bearing for nothing this phase asserts. |

---

## Open Questions

1. **Should XOS-07's `needs:` widening get a drift guard?**
   - What we know: NO spec asserts `publish`'s `needs:` today. Reverting the widening would redden
     nothing. `jobBlock()` exists and would make it a three-line guard.
   - What's unclear: XOS-07's text asks only that `publish` "depends on every job producing a
     mirrored entry", not that a guard exist.
   - Recommendation: ADD it. The whole XOS-07 argument (`!cancelled()` makes the wide `needs:` safe)
     is exactly the kind of reasoning a future reader undoes, and the existing comment already
     documented the opposite once. Cost is three lines in a shipped harness.

2. **Where do the RETAIN-05(b) table and the TRUST-10 `ref` pin live?** (Claude's discretion.)
   - Recommendation: the disjointness table goes in `release-asset-name.spec.ts` (cohesive -- both
     predicates live in that module); the `ref` pin goes in `action/index.spec.ts` (cohesive -- it
     is an assertion about that adapter). Neither is cross-cutting, so neither belongs at
     `src/*.spec.ts` under `.planning/codebase/TESTING.md`'s placement rule.

3. **Does the `CORR_05_SITES` describe need replacing, or is an empty table acceptable?**
   - What we know: an empty array yields zero tests, silently. The RULE's proof survives in
     `EVASION_SHAPES`.
   - Recommendation: replace the enumeration with `expect(CORR_05_SITES).toEqual([])` under a title
     naming CORR-05 as now TRUE. Cheap, and it converts a silent zero into a positive claim. Flagged
     as C-2; the planner should decide explicitly rather than let it happen.

4. **Is a live `publish-verify` failure needed to prove OBS-05 non-vacuous?**
   - What we know: the label assertion IS unit-testable with a fake asset-list reader, so
     non-vacuity can be mutation-proven offline. Phase 9's `publish-verify` regression was findable
     only live, but that was a guard with NO unit coverage of the property.
   - Recommendation: mutation-prove it offline AND record the live close as the confirming
     observation. Do NOT deliberately break the Windows publish path on `main` to demonstrate it.

5. **Should the `<hash>.tar.gz` census be re-taken at plan time?**
   - It was taken 2026-07-29 (this session) and 2026-07-29 (discuss). The shard rolls over
     2026-08-01, so a plan executing in August measures a NEW shard. Record the tag with the count
     (`cache-mirror-202607`, 122 assets, release id `354838660`) so a later reader knows which
     shard the number describes.

---

## Sources

### Primary (HIGH confidence -- measured this session)

- `gh api repos/op-nx/github-cache/actions/runs/{30401077417,30400231720,30200859202,30197079037,30181729913}/jobs`
  -- per-leg and per-step timestamps; the U-01 ordering table and the XOS-07 race measurement.
- `gh api repos/op-nx/github-cache/releases/tags/cache-mirror-202607` and
  `.../releases/354838660/assets?per_page=100 --paginate` -- the 122-asset census with `created_at`
  and `label` (empty on all 122), and the per-push mirroring fingerprint.
- `npx nx show project @op-nx/github-cache --json` -- the MERGED `integration` target inputs, and
  `npx nx show target inputs @op-nx/github-cache:integration` -- the RESOLVED 73-file list naming
  `src/lib/release-asset-name.spec.ts` (D-17's stale-cache hazard, resolved: no hazard).
- `node_modules/@octokit/types/dist-types/generated/Endpoints.d.ts:4104`, `:3356`, `:2552` --
  the upload endpoint's `{?name,label}` template and the PATCH/GET asset endpoints.
- `node_modules/@octokit/openapi-types/types.d.ts:27663-27690`, `:114935-114963`,
  `repos/update-release-asset` -- the `release-asset` schema (`label: string | null`), the upload
  query params, the 422-on-filename semantics, and the backfill body.
- Tree reads at HEAD `c4a3b88`: `publish-mirror.ts`, `read-back.ts`, `release-asset-name.ts`,
  `cache-key.ts`, `cache-key.spec.ts`, `releases-backend.ts`, `releases-backend.spec.ts`,
  `release-asset-name.spec.ts`, `cleanup.ts`, `action/index.ts`, `lint-rules.spec.ts`,
  `dogfood-cross-os.spec.ts`, `docs-same-os-claims.spec.ts`, `nx.json`, `project.json`,
  `vitest.integration.config.mts`, `packages/github-cache/action.yml`, `public-surface.spec.ts`,
  `.github/workflows/ci.yml`, `start-cache-server/entry.ts`, `package.json`.
- `rg -uu -c -F <symbol> start-cache-server/index.js` -- the bundle reachability map (H-3).
- A local adversarial + randomised disjointness probe over both filter branches -- 26 cases plus
  1.6M randomised candidates, 0 collisions.

### Secondary (MEDIUM confidence -- cited from official docs)

- `docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax` (fetched via
  `markdown.new`) -- `jobs.<job_id>.strategy.max-parallel` (no order clause),
  `jobs.<job_id>.strategy.matrix` (creation order follows declaration order),
  `jobs.<job_id>.needs` ("skipped unless the jobs use a conditional expression").
- `docs.github.com/en/actions/reference/workflows-and-actions/expressions` -- `cancelled()`,
  `always()` and the explicit recommendation of `if: ${{ !cancelled() }}` for "run regardless of
  success or failure".

### Project artifacts (authoritative for intent)

- `.planning/REQUIREMENTS.md` (the authoritative requirement text, D-01),
  `.planning/ROADMAP.md:338-432`, `.planning/PROJECT.md` `## Key Decisions` + `## Constraints`,
  `.planning/THREAT-MODEL.md` C1/C2/C9/C16,
  `.planning/phases/10-.../10-CONTEXT.md`,
  `09-LEARNINGS.md`, `09-VALIDATION.md` (gaps G2, G3), `09-SECURITY.md` section 1 (via
  09-LEARNINGS' quotation), `.planning/config.json`.

### Tertiary (LOW confidence)

- None. No claim in this document rests on a search result alone.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| U-01 resolution | HIGH | 5/5 measured timestamps with cited run ids; the single-snapshot property read from source; the docs gap confirmed by fetching the reference |
| Standard stack | HIGH | zero new dependencies; every mechanism located in the tree |
| Architecture / seam shapes | HIGH | every file and line read at HEAD `c4a3b88` |
| Octokit `label` semantics | HIGH | read from the INSTALLED types, not from prose |
| Disjointness | HIGH | measured, not reasoned -- 0 collisions over 1.6M candidates plus a structural proof with two independent reasons |
| D-17's cache hazard | HIGH | measured twice -- `nx show project --json` for the MERGED config, then `nx show target inputs` for the resolved 73-file list naming `src/lib/*.spec.ts` by name |
| Bundle blast radius | HIGH for the current map (measured), MEDIUM for the predicted post-CORR-02 diff (inference, falsified by `check:action`) |
| `!cancelled()` past a FAILED dep | MEDIUM | cited from GitHub docs, not reproduced in this repo; downside bounded and named |
| Line-number drift | HIGH | every row located by content or job name |
| Pitfalls | HIGH | drawn from 09-LEARNINGS / 09-VALIDATION measurements, each re-checked against this phase's surface |

**Research date:** 2026-07-29
**Valid until:** 2026-08-12 for the code-shape findings (~14 days -- `ci.yml` drifted ~220 lines
inside one milestone, so re-locate by content if any of it goes stale). **Two entries expire
sooner:** the shard census is scoped to `cache-mirror-202607`, which rolls over **2026-08-01**; and
the U-01 ordering measurement should be re-sampled on the first push after XOS-07's `needs:`
widening, because widening `needs:` changes when `publish` starts and therefore the margin (not the
ordering, but the margin is the evidence).
