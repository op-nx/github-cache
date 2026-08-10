# Architecture Research -- v0.0.2 OS-invariant cross-OS sharing

**Domain:** integrating OS-invariance into the shipped v0.0.1 ports-and-adapters cache
**Researched:** 2026-07-26
**Consumer:** gsd-roadmapper and the Phase 7-12 planners
**Confidence:** HIGH for blast radius and the publish path (read directly from the tree and from
the installed `@actions/cache@6.2.0` source); HIGH for the layer-coupling verdict; MEDIUM for the
Phase 7 lint-inference risk (unmeasurable until Phase 8 runs).

> Carries forward `.planning/research/ARCHITECTURE.md` (v0.0.1) without repeating it: the
> `CacheBackend` port, `selectBackend`'s one-backend-per-process rule, the two-predicate trust
> split, and the "publish/cleanup is reader-specific and behind no port" boundary all still hold
> and are unchanged by v0.0.2. What follows is only what v0.0.2 touches.

---

## 0. Headline findings

Seven things the committed roadmap does not say, ordered by how much they change planning:

1. **TEST-09 / XOS-03 as written becomes unsatisfiable after Phase 9.** After VER-01/VER-03 the
   Actions cache no longer partitions by OS, so a Windows runner CAN restore the Linux
   `integration` entry at the storage layer. "Windows CI MISSES the Linux entry" is now a
   statement about **Nx hashes**, not about cache storage. See section 6.1. This needs a
   re-specification before Phase 11 is planned.
2. **`start-cache-server/index.js` inlines both comment-locked helpers.** Every Phase 9 and Phase
   10 source edit must run `npm run build:action` in the same commit, or the sidecar and the
   publish action compute different cache versions. Section 2.3.
3. **`ci.yml` is NOT in `nx.json`'s `test` inputs.** Phase 10's OBS-05/XOS-06/XOS-07 guards and
   Phase 12's DOCS-07 drift guard will serve stale cached PASSes. Section 5.4.
4. **Phase 12's O4 HIT has no producer-to-consumer ordering.** Parallel ubuntu and Windows legs at
   the same hash both MISS on the first run. Section 6.3.
5. **CORR-05 has four violation sites in three files, and one of them survives CORR-02.**
   `release-asset-name.spec.ts:60` is not eliminated by the rename, because OBS-03 keeps
   `cachePlatform` alive. Section 2.2.
6. **The Phase 9-to-Phase 10 window doubles shard asset growth** (every hash mirrored under both
   `-linux` and `-windows`). Bounded and safe, but it must not be misread as a regression.
   Section 4.3.
7. **TRUST-11's arbitration point is wrong.** First-write-wins between differing payloads happens
   at the Actions-cache `saveCache`, not at the Release upload. Section 4.4.

---

## 1. What v0.0.2 does and does not touch

| Layer | v0.0.2 impact |
|-------|---------------|
| HTTP protocol (`server/server.ts`) | NONE |
| `CacheBackend` port (`backend/types.ts`) | NONE |
| `selectBackend` (`lib/select-backend.ts`) | NONE. No new branch, no new env read. This is what makes PARITY-05 / D2-02 cheap to satisfy |
| Trust predicates (`lib/trust.ts`, `lib/sync-gate.ts`) | NONE (TRUST-10 verifies, does not change) |
| Retention (`lib/retention.ts`) | NONE. The one coupled knob and the shard-tag scheme are untouched |
| Cache-key namespace (`lib/cache-key.ts`) | NONE to the code; it becomes the SOURCE for the new asset name (D2-03) |
| `lib/cache-archive-path.ts` | REWRITTEN (VER-01/VER-02/VER-04) |
| `lib/release-asset-name.ts` | REWRITTEN (CORR-02/RETAIN-04/OBS-03) |
| `backend/actions-cache-backend.ts` | MODIFIED at 3 call sites (VER-03) + archive-dir creation |
| `publish/publish-mirror.ts` | MODIFIED (label plumbing for OBS-03) |
| `action/index.ts` | MODIFIED (`uploadReleaseAsset` adapter gains `label`) |
| `cleanup/cleanup.ts` | UNCHANGED code; its filter's BEHAVIOUR changes via `isServerProducedAssetName` |
| `start-cache-server/index.js` | REGENERATED (never hand-edited) |
| `nx.json` | MODIFIED (CORR-04 discriminator audit, `lint` inputs, `ci.yml` as a `test` input) |
| `.github/workflows/ci.yml` | MODIFIED in Phases 8, 9, 10, 11 and 12 |

Two files carry the whole milestone's code risk: `cache-archive-path.ts` and
`release-asset-name.ts`. Both are comment-locked single sources whose failure mode is a silent
MISS, not a crash.

---

## 2. Blast radius of the two comment-locked helpers

### 2.1 `cacheArchivePath` (VER-01, VER-02, VER-04)

Current: `join(tmpdir(), 'nx-github-cache-<hash>.tar')`.
Target: a hardcoded forward-slash workspace-relative literal under `.nx/cache/`.

**Production call sites (complete):**

| Location | Role |
|----------|------|
| `packages/github-cache/src/lib/cache-archive-path.ts:34` | definition |
| `packages/github-cache/src/backend/actions-cache-backend.ts:45` | `get` -> `restoreCache` + `readFile` + `rm` |
| `packages/github-cache/src/backend/actions-cache-backend.ts:67` | `put` -> `writeFile` + `saveCache` + `lookupOnly` probe + `rm` |
| `packages/github-cache/src/publish/publish-mirror.ts:175`, `:216` | transitive, via `createActionsCacheBackend()` |
| `packages/github-cache/src/serve.ts:90` | transitive, via `selectBackend` |
| `start-cache-server/index.js` (generated) | INLINED copy consumed by every `uses: ./start-cache-server` sidecar |

**Test pins, classified:**

| Pin | Verdict |
|-----|---------|
| `lib/cache-archive-path.spec.ts:22-27` (`isAbsolute` true, `dirname === tmpdir()`) | **REPLACE.** VER-02 says so explicitly. Both clauses invert: the new path is relative and has no `tmpdir` relationship. This is CORR-05 violation 1 of 4 |
| `lib/cache-archive-path.spec.ts:16-20` (`basename(path) === 'nx-github-cache-abc123.tar'`) | **REPLACE.** Pin the FULL literal string, not `basename()`. The whole point is that the exact bytes handed to `@actions/cache` are what get hashed; a `basename()` assertion cannot see a directory-prefix change |
| `lib/cache-archive-path.spec.ts:29-36` (byte-identical / differs by hash) | KEEP unchanged |
| `backend/actions-cache-backend.spec.ts:340-355` (`restoreCache`/`saveCache` receive exactly `[cacheArchivePath(hash)]`) | KEEP, and EXTEND for VER-03 (argument list + call count across all three sites) |
| `backend/actions-cache-backend.spec.ts:32,38,50,54,58,92,131,160,169,241,242,351` | Derived from the helper, so they relax automatically. BUT they do real filesystem I/O -- see the ENOENT hazard below |
| `lib/select-backend.spec.ts:53`, `serve.spec.ts:421` | Derived cleanup `rm` calls. Same ENOENT/dir hazard |
| `action/index.ts:259` (error text naming `cacheArchivePath`) | Text only; keep, it stays accurate |

**Three implementation hazards the requirements do not name:**

1. **ENOENT on save.** `tmpdir()` always exists; `.nx/cache/` may not. `put` does
   `writeFile(path, bytes)` BEFORE `saveCache`, so the backend must `mkdir` the directory
   recursively first. The specs that write archives directly need the same setup. One `mkdir`
   with `{ recursive: true }` in `actions-cache-backend.ts` covers both `get` and `put`.
2. **Glob base vs tar base.** Verified in `node_modules/@actions/cache/lib/internal/cacheUtils.js`
   and `tar.js` at the pinned 6.2.0:
   - `resolvePaths()` globs the pattern against **`process.cwd()`**;
   - it then makes each match relative to **`GITHUB_WORKSPACE ?? cwd()`** for the tar entry name;
   - `extractTar` runs `tar -C <GITHUB_WORKSPACE ?? cwd()>`;
   - our own `readFile`/`writeFile` resolve against **`process.cwd()`**.

   A relative path is therefore only coherent when `cwd === GITHUB_WORKSPACE`. VER-04's assertion
   should be exactly that (plus "and it is the Nx workspace root", cheaply `existsSync('nx.json')`),
   not a looser "cwd looks like a workspace". Place the assert at
   `createActionsCacheBackend()` construction, NOT inside `cacheArchivePath` -- the helper must stay
   a pure string function so its specs stay pure, and construction covers both `serve()` and
   `publishMirror()` in one place. It is naturally scoped: the Actions backend is only ever
   constructed in a write-trusted CI context, so a local developer's sidecar never trips it.
3. **`.nx/cache/` is Nx's own directory.** Writing `nx-github-cache-<hash>.tar` beside Nx's task
   cache is harmless (file vs directory, no name collision) but `nx reset` clears it. Consider
   `.nx/cache/github-cache/` as the literal instead of `.nx/cache/` to keep the two tenants
   visibly separate; either satisfies D2-04.

**Verified upstream facts backing VER-01/VER-03/VER-05** (`@actions/cache@6.2.0`, read from
`node_modules`, not from docs):

```js
export function getCacheVersion(paths, compressionMethod, enableCrossOsArchive = false) {
  const components = paths.slice();                       // the RAW strings, never resolved
  if (compressionMethod) components.push(compressionMethod);
  if (process.platform === 'win32' && !enableCrossOsArchive) components.push('windows-only');
  components.push(versionSalt);                           // '1.0'
  return crypto.createHash('sha256').update(components.join('|')).digest('hex');
}
```

So the version has exactly three variable components, matching VER-01 (path), VER-05
(compression), VER-03 (`windows-only`). `paths` is the untouched caller array, which is why a
separator difference is a silent MISS and why the literal must be pinned.

**VER-03's positional-index claim is CONFIRMED at 6.2.0.** From `lib/cache.d.ts`:

- `restoreCache(paths, primaryKey, restoreKeys?, options?, enableCrossOsArchive?)` -> **index 4**
- `saveCache(paths, key, options?, enableCrossOsArchive?)` -> **index 3**

and `saveCache`'s JSDoc lists `@param enableCrossOsArchive` BEFORE `@param options`, while the
signature is the reverse. The three edits are therefore:

```ts
cache.restoreCache([path], cacheKeyFor(hash), [], undefined, true)              // get
cache.saveCache([path], cacheKeyFor(hash), undefined, true)                     // put
cache.restoreCache([path], cacheKeyFor(hash), [], { lookupOnly: true }, true)   // put probe
```

Note the `undefined` placeholders. A spec that asserts only "the last argument is `true`" would
pass on a wrong-index call; assert the full argument LIST per site, as VER-03 requires.

### 2.2 `releaseAssetName` (CORR-02, RETAIN-04, OBS-03)

Current: `` `${hash}-${cachePlatform(platform)}` ``.
Target: `nx-cache-<hash>`, single-sourced from `CACHE_KEY_PREFIX` (D2-03).

**Production call sites (complete):**

| Location | Role |
|----------|------|
| `lib/release-asset-name.ts:50` | definition |
| `backend/releases-backend.ts:75` | the reader's single derivation (`assetNaming.releaseAssetName(hash)`) |
| `publish/publish-mirror.ts:226` | the publisher's single derivation |
| `cleanup/cleanup.ts:89` | consumes the sibling `isServerProducedAssetName` filter |
| `start-cache-server/index.js:68387` (generated) | INLINED copy |

**Test pins, classified:**

| Pin | Verdict |
|-----|---------|
| `lib/release-asset-name.spec.ts:21-23` (`'abc123-linux'` literal) | **REPLACE** with the `'nx-cache-abc123'` literal |
| `lib/release-asset-name.spec.ts:31-35` ("differs for the same hash under a different platform") | **REPLACE BY ITS INVERSE.** This is the single most important pin flip in the milestone. It must become "IDENTICAL across platforms" -- deleting it instead would leave nothing at all asserting OS-invariance |
| `lib/release-asset-name.spec.ts:37-41` (default arg equals `process.platform`) | **DELETE.** The parameter goes away. CORR-05 violation 2 of 4 |
| `lib/release-asset-name.spec.ts:50-57` (`cachePlatform` mapping `it.each`) | KEEP. Injected values only, and OBS-03 keeps `cachePlatform` alive for the asset label |
| `lib/release-asset-name.spec.ts:59-61` (`cachePlatform()` vs `cachePlatform(process.platform)`) | **CORR-05 violation 3 of 4, and it is NOT removed by CORR-02.** See the gap note below |
| `lib/release-asset-name.spec.ts:68-100` (`isServerProducedAssetName` accept/reject/round-trip) | **EXTEND, do not replace.** Add `nx-cache-<hex>` accepts; keep every legacy accept (RETAIN-04); keep every reject. Rewrite the round-trip against the new producer |
| `lib/release-asset-name.spec.ts:98-100` (`CACHE_OS_VALUES` content pin) | KEEP. RETAIN-04 requires the tuple to survive |
| `lib/release-asset-name.spec.ts:106-121` (`.gitattributes` LF guard) | KEEP. Unrelated and still load-bearing |
| `backend/releases-backend.spec.ts:37-38` (`OTHER_PLATFORM` from `process.platform`) | **REPLACE.** CORR-05 violation 4 of 4 |
| `backend/releases-backend.spec.ts:103-118` ("MISSES an OS-sensitive hash present ONLY under another platform") | **REPLACE.** It asserts the exact property CORR-02 removes. See the coverage note below |
| `backend/releases-backend.spec.ts:86-101` (returns THIS platform's bytes) | REPLACE with a single-name resolution assertion |
| `backend/releases-backend.spec.ts:127-134` (derives the name ONLY through the helper) | KEEP. Derived, and it is the anti-drift guard that matters most |
| `publish/publish-mirror.spec.ts:100,101,122,135,165,216,239,399` | All derived. Survive unchanged |
| `lib/select-backend.spec.ts:130` | Derived. Survives |
| `cleanup/cleanup.spec.ts:77,167,168,191,216-218,240,241,260,261,303` | **KEEP AS-IS.** These twelve `<hash>-linux` fixtures ARE the legacy-family coverage RETAIN-04 demands. Add new-family fixtures and a mixed-shard dry-run alongside them |

**Gap 1 -- CORR-05 is not fully closed by CORR-02.** REQUIREMENTS.md says all three violating
files are "eliminated as a side effect of VER-02 and CORR-02". That holds for
`cache-archive-path.spec.ts`, for `releases-backend.spec.ts:38`, and for
`release-asset-name.spec.ts:39`. It does NOT hold for `release-asset-name.spec.ts:60`: OBS-03
deliberately keeps `cachePlatform` (it is what derives the producing-OS label), so the
`cachePlatform()` default-argument test is still meaningful and still an ambient read. Phase 10
must make an explicit call: delete it and accept the lost default-arg branch coverage, or move it
into `public-server.integration.spec.ts` where LINT-02 allows it. Phase 10 SC 2 should say which.

**Gap 2 -- CORR-02 destroys a negative control with nothing named to replace it.**
`releases-backend.spec.ts:103-118` is explicitly documented as the non-vacuous proof of CORR-01
("a positive-only correct-hit assertion above still passes with OS-namespacing deleted entirely").
CORR-02 deletes OS-namespacing on purpose, so that test must go -- and the reason it existed
(a positive-only assertion is vacuous) does not go away. The replacement should be: assert the
reader requested EXACTLY ONE asset name and that the recorded name equals the imported
`releaseAssetName(hash)` and contains no platform token. Phase 10's plan must name this
explicitly or coverage drops silently.

**Gap 3 -- `releaseAssetName`'s `platform` parameter is dead after Phase 10, but LINT-02,
CORR-06 and ROADMAP Phase 7 SC 2 all use `releaseAssetName(hash, 'win32')` as the canonical
"injected value is allowed" example.** Phase 7 lands three phases earlier, so the example is
valid when written and dead when Phase 10 ships (and `fallow` will flag the unused parameter).
Tell the Phase 7 planner to write the LINT-03 fixture against a symbol Phase 10 keeps --
`cachePlatform('win32')` is the obvious substitute, since OBS-03 preserves it.

**Naming convergence worth exploiting.** With the new name being `nx-cache-<hash>`, the asset name
is byte-identical to the Actions-cache key produced by `cacheKeyFor(hash)`. The laziest correct
implementation is therefore:

```ts
export function releaseAssetName(hash: Hash): string { return cacheKeyFor(hash); }

export function isServerProducedAssetName(name: string): boolean {
  return isServerProducedKey(name) || isLegacyOsSuffixedAssetName(name);
}
```

This satisfies D2-03 literally (one authored prefix, in `cache-key.ts`) and keeps the legacy
branch as an isolated, deletable function. The two name families are provably disjoint: the legacy
accepter splits on the LAST `-`, so `nx-cache-abc123` yields hash `nx-cache`, which fails
`HASH_PATTERN`; and no legacy `<hex>-<os>` name starts with `nx-cache-`. **TRUST-10 caveat:** if
`isServerProducedAssetName` delegates to `isServerProducedKey`, the auditor verifying that C16's
Actions-cache-side filter is "unchanged" must check the function's behaviour AND its
`publish-mirror.ts:191` call site, not merely that the file diff is empty -- a new caller has been
added.

### 2.3 The generated bundle is a third call site (highest-severity drift risk)

`start-cache-server/index.js` is an esbuild bundle of `start-cache-server/entry.ts`, which reaches
`serve()` -> `selectBackend` -> BOTH backends. Confirmed by inspection: the committed bundle
contains `getCacheVersion`'s `windows-only` branch at line 30367 and `cachePlatform` /
`releaseAssetName` at lines 68378 / 68387.

The four sidecar jobs in `ci.yml` (`build`, `typecheck`, `test`, `integration`) run the COMMITTED
bundle from the git ref, never a build output. The `publish` and `dogfood-*` jobs run
`dist/action/index.js`, built fresh. **If Phase 9 changes `cache-archive-path.ts` without
regenerating the bundle, the sidecar writes entries at cache version V_old while the publish
action restores at V_new: the mirror silently stops receiving anything, surfacing only as the
soft all-restore-MISS warning.** The `action-bundle-drift` CI job does catch this, but only on
push, so name `npm run build:action` as an explicit task in every Phase 9 and Phase 10 plan that
touches a `serve()`-reachable source. The same applies if any Phase 7 ESLint autofix rewrites one
of those files.

---

## 3. Layer independence: confirmed for reads, false for writes

**Verdict: the O1/O2 (Releases) and O3/O4 (Actions cache) layers are genuinely independent on the
READ path, which is what the mandated ordering needs. They are COUPLED on the WRITE path, and the
roadmap's "two independent layers" framing understates this.**

The read paths are cleanly separated by `selectBackend`: an untrusted context (a local Windows
workstation) gets `createReleasesReadBackend` and never constructs the Actions backend or touches
`cacheArchivePath`; a trusted CI context gets `createActionsCacheBackend` and never touches
`releaseAssetName`. No shared state, no shared code path. O1/O2 cannot be affected by a
`cacheArchivePath` change at read time, and O3/O4 cannot be affected by a `releaseAssetName`
change at all.

**The coupling the requirements missed: `publishMirror` is the bridge.** It constructs
`createActionsCacheBackend()` (`publish-mirror.ts:175`) and restores through it
(`:216`) before uploading under `releaseAssetName` (`:226`). So the Releases mirror's CONTENT is
determined by Actions-cache restore semantics. Three consequences the plans need:

1. **O1 and O2 depend on Phase 9, not just Phase 10.** Today a Windows-produced entry only reaches
   the mirror via the Windows publish leg (a same-OS restore). Phase 9 removes that constraint.
   The roadmap captures this only as a TRUST-12 argument for Phase 9-before-Phase-10; it should
   also appear as a functional dependency of the Phase 11 proofs.
2. **The publisher labels by the PUBLISHING leg's OS, not the producing OS.**
   `releaseAssetName(hash)` at `:226` uses the running platform. Today publisher-OS equals
   producer-OS because restore is same-OS; Phase 9 breaks that identity while Phase 10 has not yet
   removed the suffix. See section 4.3 for the (bounded, non-correctness) consequence.
3. **`read-back.ts` is a Releases-side proof with an Actions-cache dependency.** Its hash is
   `GITHUB_RUN_ID`, seeded by the publish job's `operation: seed` step through the Actions-cache
   write path. OBS-05 fixes the leg-distinguishability but the cross-layer dependency remains, so
   an Actions-cache regression can present as a Releases-side `publish-verify` failure.

**One further coupling, in the hashing layer rather than the storage layer.** Both `integration`
(the OS-sensitive target, O3's mechanism) and `test`/`build`/`typecheck` (the shared targets, O1/O4)
derive from the same `nx.json` and the same `hash_project_config`. Any change to inference plugins
or target inputs moves BOTH at once. This is why Phase 7 must precede Phase 8, and it is also why
Phase 8's CORR-03 job is the continuous guard for Phases 9-12 that the roadmap already identifies.

---

## 4. The publish path after OS-invariance

### 4.1 What actually changes

Before Phase 9, `getCacheVersion` on a Windows runner appends `windows-only`, so the ubuntu
publish leg's `restoreCache` on a Windows-saved key MISSes and the engine's miss branch
(`publish-mirror.ts:218-222`) skips it. After Phase 9, both legs compute the same version for the
same key, so **either leg can restore every entry the `ref`-scoped `listCacheEntries` enumerates.**

`listCacheEntries` was already OS-blind: it is scoped only by `ref`
(`action/index.ts:40-43`). The OS filter was purely the restore step. This is precisely TRUST-12's
"sole-mechanism collapse", and it is why TRUST-10 pins the `ref` scoping by spec -- it becomes the
only in-repo control keeping non-default-branch trusted writes out of the world-readable mirror
(`TRUSTED_EVENTS` includes `push` with no ref check; `isSyncTrusted` does check the default branch,
but that gates the JOB, not the enumeration).

### 4.2 Is the per-OS publish matrix still needed?

**Not for coverage. Keep it for v0.0.2 anyway, and record that it is on borrowed time.**

- Coverage: one leg now suffices. `ci.yml:580-584`'s claim that the matrix is "LOAD-BEARING and
  self-enforcing" and that "collapsing this to one OS SILENTLY drops the other OS's entries"
  becomes FALSE. That is DOCS-08's `ci.yml:577-583` correction.
- Honest post-Phase-10 state: under `max-parallel: 1` with the matrix ordered
  `[ubuntu-24.04-arm, windows-11-arm]`, the ubuntu leg uploads everything and the Windows leg
  finds every name already present, hits the first-write-wins skip branch
  (`publish-mirror.ts:262-266`), and mirrors **zero** real assets. Its only genuine output becomes
  OBS-05's leg-distinguishable seed -- that is, the Windows publish leg becomes a test of itself.
  This is the strongest argument for the deferred collapse and should be written into the Phase 10
  record so the v0.0.3 follow-on is not re-derived.
- Why keep it in v0.0.2 regardless: REQUIREMENTS.md puts the collapse out of scope until XOS-05 is
  proven, and removing a leg before O4 is demonstrated would remove the evidence needed to justify
  removing it. Correct sequencing.

### 4.3 `max-parallel: 1`, first-write-wins, and the Phase 9-to-Phase 10 window

XOS-06 retains `max-parallel: 1`. It is still needed for its stated reason -- the shard-cap race,
where two concurrent legs both observe 999 assets and both pass the soft cap check. That reason is
unaffected by OS-invariance.

**The window nobody costed.** Between Phase 9 landing and Phase 10 landing, the asset name still
carries the publishing leg's OS while both legs can restore everything. Each hash is therefore
mirrored TWICE, once as `<hash>-linux` and once as `<hash>-windows`. Analysis:

- Not a correctness bug. A Linux reader derives `<hash>-linux` and only ever computes Linux
  hashes; a Windows reader derives `<hash>-windows`. The only OS-sensitive target (`integration`)
  already has distinct hashes per OS via CORR-04, so the mislabeled duplicate is unreachable by
  name from the wrong-OS reader. O2 continues to work: the Windows leg still uploads
  `<H_win>-windows` because the ubuntu leg only created `<H_win>-linux`.
- It is a **2x shard-growth effect**. `ci.yml:640-647` estimates roughly 5 real assets per
  input-changing push and ~125 pushes per calendar month before `RELEASE_ASSET_CAP`. In this
  window that becomes ~10 per push and ~62 pushes of headroom. Still comfortable, but the
  arithmetic in that comment goes stale, and an operator watching shard growth must not read the
  doubling as a bug. Record the expected signal alongside OBS-04's rotation signal, and keep the
  Phase 9-to-Phase 10 window short.

### 4.4 TRUST-11's arbitration point needs correcting before TRUST-13 audits it

TRUST-11 states: "an Nx cache entry carries captured terminal output, which embeds OS-specific
paths, so two legs produce different bytes for the same hash. First-write-wins therefore
arbitrates between differing payloads."

The premise is right; the arbitration point named is wrong, in a way that matters to the auditor:

- **Two publish legs never produce differing payloads.** They both RESTORE the same Actions-cache
  entry and upload those bytes verbatim; they do not re-execute the task. Byte-identical.
- **The real arbitration is at `saveCache`.** Once Phase 12's XOS-04 puts `build`/`typecheck`/`test`
  on a Windows leg, two jobs compute the same hash H and both call `saveCache(nx-cache-H)`. The
  Actions cache is first-write-wins, so whichever job's save lands first owns the entry, including
  its OS-specific captured terminal output. That IS ordering-dependent (the two legs run in
  parallel), and it is the correct target of TRUST-11's residual-risk statement. XOS-06 is
  satisfied because no requirement depends on the winner, not because the race does not exist.
- **The Releases-side first-write-wins matters only across shards**, which is TRUST-11's
  second clause and is correctly stated: a hash mirrored in June and re-mirrored in July under a
  different producer is resolved July-first by `shardTagsForWindow`, so the reader's winner is
  shard-dependent.
- **Cross-OS restore is byte-faithful.** The stored object is tar-in-tar: `@actions/cache` wraps
  our single `.tar` file, whose entry name is forward-slash-normalized by `resolvePaths`. Restoring
  on a different OS reproduces the inner file's bytes exactly, so mirroring a Windows-produced
  artifact from the ubuntu leg does not corrupt it. The residual file-mode question in the
  out-of-scope list applies to the Nx client's extraction of the INNER tar, not to our transport.

Hand this to gsd-security-auditor as corrected INPUT, per TRUST-13.

### 4.5 XOS-07 changes the publish job's critical path

`needs: build` becomes `needs: [build, typecheck, test, integration]`. `integration` is a
two-leg matrix including `windows-11-arm` with `timeout-minutes: 20`, so publish now waits on the
slowest Windows leg. `if: ${{ !cancelled() && github.event_name == 'push' }}` is preserved
correctly: a failing Windows integration leg still lets the mirror run, which is the existing
"a failing test leg must never skip the mirror" property. No change needed to the `if:`, but the
plan should note the added wall clock.

### 4.6 OBS-03 requires widening a seam

`PublishClient.uploadReleaseAsset(releaseId, name, bytes)` has no label parameter. OBS-03 needs one:

- `publish/publish-mirror.ts:64-68` -- widen the interface to `(releaseId, name, bytes, label)`
- `publish/publish-mirror.ts:269` -- pass `cachePlatform()` (the publishing leg's OS)
- `action/index.ts:81-96` -- pass `label` through to `octokit.rest.repos.uploadReleaseAsset`
- `publish/publish-mirror.spec.ts` -- every `uploadReleaseAsset` fake gains the parameter

Note the semantics: the label records the OS of the leg that UPLOADED, which after Phase 9 is not
necessarily the OS that PRODUCED the entry. If OBS-03's incident-response goal is producer
attribution, the label as derived from `cachePlatform()` is misleading for cross-OS-restored
entries. There is no producing-OS signal available at the publish site -- `listCacheEntries`
returns only `{ key }`, and the Actions-cache API exposes no producing-OS field. Phase 10 must
either (a) label it honestly as `mirrored-by: <os>` rather than "producing OS", or (b) accept the
approximation and record the limitation. Recommend (a): it is one word of prose and it is true.

---

## 5. Integration points not owned by the two helpers

### 5.1 Phase 7 lint toolchain

- `@nx/eslint` is NOT currently a devDependency. Adding it also requires an
  `.fallowrc.jsonc` `ignoreDependencies` entry next to `@nx/vitest` (inference plugins are never
  imported, so fallow reads them as unused). A root `eslint.config.mjs` is likewise never imported
  and will probably need an `entry` declaration, alongside `esbuild.action.mjs`.
- `pinned-deps.spec.ts` is an **explicit per-package list of `it()` blocks**, not a blanket rule
  over `dependencies`. LINT-01's "covered by the `pinned-deps` guard" therefore means adding one
  `it()` per new dev dependency, in the `pinned build tooling (ROBUST-03)` describe block, which
  already reads the ROOT manifest. Note the existing devDeps are a MIX (`@nx/js: "23.1.0"` exact,
  `prettier: "^3.8.1"` ranged), so the guard is opt-in by design and the new entries must be
  added deliberately.
- LINT-02's scoping mirrors real config: `vitest.config.mts` includes
  `{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` and excludes
  `{src,tests}/**/*.integration.spec.{ts,mts,cts}`; `vitest.integration.config.mts` includes only
  the latter. There is exactly ONE integration spec today
  (`server/public-server.integration.spec.ts`), so the `ignores:` list has one real member. The
  ESLint `files`/`ignores` glob pair must cover `.mts`/`.cts` too, or a future `*.spec.mts` slips
  the rule.
- **The complete current inventory of ambient platform reads in spec files is four sites in three
  files** -- `cache-archive-path.spec.ts:1,26`, `releases-backend.spec.ts:38`,
  `release-asset-name.spec.ts:39`, `release-asset-name.spec.ts:60`. LINT-03's "confirmed CAUGHT"
  evidence should enumerate all four, not the three files. Non-spec sources
  (`release-asset-name.ts`, `cache-archive-path.ts`, `read-back.ts`) also read
  `process.platform`/`node:os` and must remain OUT of the rule's scope.

### 5.2 Phase 8 hash parity

- `nx.json` currently declares the discriminator on exactly one target:
  `targetDefaults.integration.inputs` carries `{ "runtime": "node -p process.platform" }`
  (`nx.json:85`). CORR-04's "and is the ONLY target that does" is TRUE today; the requirement is
  to keep it true mechanically.
- `{workspaceRoot}/nx.json` IS a `test` input (`nx.json:50`), so `nx-target-inputs.spec.ts` cannot
  serve a stale pass on a discriminator change. Good precedent for CORR-04's guard: extend
  `nx-target-inputs.spec.ts` rather than creating a new spec.
- CORR-03's requirement that a textual `nx.json` assertion does NOT satisfy the guard means the
  two-leg job must capture real `nx show project` / hash output per leg. Note DOCS-07's warning
  that `hash_runtime` hashes stdout AND stderr, so the capture must record both, and the
  discriminator command itself must be stderr-silent.

### 5.3 Phase 9 CI wiring

`dogfood-verify` is ubuntu-only today (`ci.yml:451-470`). VER-06 needs it on `windows-11-arm`
while `dogfood-seed` stays on ubuntu. The existing `needs: dogfood-seed` already gives the
producer-then-consumer ordering, so this is a `runs-on:` change plus a note that the pair is now
the cross-OS control. This same shape is the answer to Phase 12's ordering problem (section 6.3).

### 5.4 `ci.yml` is not hashed by `test` -- a live stale-PASS hole

`nx.json:41-71` lists `{workspaceRoot}/.github/workflows/cleanup.yml` as a `test` input but NOT
`ci.yml`. `cleanup-workflow.spec.ts` exists and is safe; any new spec asserting on `ci.yml` is not.
This affects:

- Phase 10's OBS-05 (leg-distinguishable seed), XOS-06 (the `max-parallel: 1` comment lock) and
  XOS-07 (`publish` dependency list), if any are enforced by spec;
- Phase 12's DOCS-07, which explicitly says "registered in `nx.json`'s `test` inputs and guarded
  against drift";
- Phase 9's DOCS-08 correction of the `ci.yml` comments.

`ci.yml:249-253` already documents this exact hazard as an unguarded invariant. Adding
`{workspaceRoot}/.github/workflows/ci.yml` to `targetDefaults.test.inputs` is the fix; it must land
BEFORE the first spec that reads `ci.yml`, i.e. early in Phase 10. It is OS-uniform so it has no
parity impact -- but see section 6.3 for how it interacts with the O4 proof.

**DOCS-08 misses a third location.** It names `docs/advanced.md:54-57` and `ci.yml:577-583`.
`ci.yml:356-360` makes the same now-false claim in the integration job's comment ("the Linux and
Windows legs compute DIFFERENT Nx task hashes, so neither leg can ever restore the other's entry --
exactly the CORR-01 namespacing the store already relies on"). Add it to the DOCS-08 list.
`ci.yml:693` (`<run_id>-<os> via releaseAssetName`) and `roundtrip/read-back.ts:10-31,52-56`
likewise assert the same-OS contract and belong to Phase 10's CORR-02/OBS-05 work.

Also worth noting for scoping: `README.md:125` and `docs/trust-and-security.md:155` frame "never a
wrong result" as a consequence of FAULT DEGRADATION ("every read fault degrades to a MISS"), which
stays true. DOCS-08's correction there is ADDITIVE (a new precondition about target
platform-agnosticism), not a contradiction. `docs/advanced.md:45` says the same thing and needs the
same treatment.

---

## 6. Build order

**Recommended order: 7 -> 8 -> 9 -> 10 -> 11 -> 12. The committed roadmap's sequence is correct.**
Three of its stated justifications need adjusting, and three phases need content the roadmap does
not currently allocate.

### 6.1 Phase 11's O3 proof must be re-specified BEFORE Phase 11 is planned

This is the most consequential disagreement.

TEST-09 requires: "the Windows job must MISS the Linux `integration` hash AND HIT at least one
entry through the same code path in that same run", and Phase 11 SC 4 repeats it.

After VER-01/VER-03, a storage-level probe for the Linux hash from a Windows runner would **HIT**,
not miss. The cache version is now identical across OSes, so `restoreCache([path],
'nx-cache-<H_linux>')` on `windows-11-arm` matches the entry the ubuntu leg saved. Asserting a 404
there would be asserting a property this milestone deliberately destroyed.

Worse, if such a probe DID return 404, the most likely cause would be a **compression-method
divergence** (VER-05's third version component: a runner image without `zstd` re-partitions the
version). That is exactly the "the proof passes for the pre-change reason" failure TEST-09 exists
to prevent, inverted.

The proof that is actually available, and actually proves CORR-04, is:

1. Record `H_linux` and `H_win` for `integration` at one commit and show they differ (this is
   CORR-03(b), already a Phase 8 build-gating job -- Phase 11 can cite it rather than re-derive).
2. Show the Windows `integration` task EXECUTED (no `[remote cache]` label) in a run where
   `nx-cache-<H_linux>` demonstrably existed in the Actions cache at the time.
3. Positive control in the same job: a scripted authed GET on a known-present key returns 200
   through the same sidecar and backend, so step 2 is not an artifact of a dead sidecar. The
   existing `Wait for the loopback sidecar` step (`ci.yml:391-407`) is already a scripted authed
   GET, so this is a small extension of a proven pattern, not new machinery.

Reframed this way the proof is stronger: it demonstrates that the ONLY thing separating the two
targets is the declared Nx input, which is precisely CORR-04's claim. Recommend the roadmapper
amend XOS-03 / TEST-09 / Phase 11 SC 4 accordingly.

### 6.2 Phase 11 is not proof-only

The roadmap says "Phase 11 is proof-only, so MVP slicing does not apply". It carries real
implementation:

- the scripted MISS-plus-positive-control probe above (new `ci.yml` steps);
- TEST-08's "the premise that Windows CI produces no `build`/`typecheck`/`test` hash is asserted
  MECHANICALLY against the resolved Nx task graph" -- that is new tooling, not a proof artifact.

Allocate plan capacity for both. MVP slicing still does not apply, but "no code" does not either.

### 6.3 Phase 12's O4 HIT needs a producer-to-consumer ordering, and `ci.yml`-as-test-input forces the issue

XOS-05 requires the Windows `build`/`typecheck`/`test` legs to HIT on entries the ubuntu leg saved.
The `integration` matrix precedent does not transfer: its two legs compute DIFFERENT hashes, so
parallelism is harmless. The new legs compute the SAME hash, so run in parallel they both MISS,
both execute, and both race `saveCache`.

Two mechanisms, and section 5.4 makes the choice for us:

- **Same-run, ordered.** Give the Windows legs `needs:` on the corresponding ubuntu jobs, mirroring
  `dogfood-seed` -> `dogfood-verify`. Deterministic, provable in one run, costs the Windows legs
  the ubuntu legs' wall clock.
- **Cross-push.** Prove on a follow-up push that changes no hashed input. Free, but fragile.

Once `ci.yml` is a `test` input (needed for Phase 10 and Phase 12's own drift guard), the very
commit that ADDS the Windows legs invalidates the `test` hash -- so the cross-push option requires
a second, no-op push and the same-run option becomes the only clean proof on the enabling commit.
**Recommend `needs:`.** Phase 12's SC 1 currently says only "wired through the same sidecar block
as the `integration` matrix", which is exactly the wiring that will NOT produce the HIT. Amend it.

### 6.4 Phase 7 first: agree, with one addition and one cheaper alternative named

The `hash_project_config` argument is sound: `@nx/eslint` is an inference plugin, an inferred
`lint` target changes the project configuration hash, and that folds into every task hash. Adopting
it after Phase 8's node-by-node record would invalidate the record.

What the roadmap flags but does not measure: `@nx/eslint` would be a THIRD inference plugin
alongside `@nx/js/typescript` and `@nx/vitest`, and the recorded root cause of this repo's
cross-OS divergence is ProjectConfiguration divergence from exactly that class of plugin. Phase 7
therefore ADDS divergence risk immediately before the phase that measures it. Phase 7 has no
cross-OS success criterion at all. Two options:

- **Recommended:** keep the order, and make PARITY-01's node-by-node record explicitly enumerate
  the `lint` target's inferred configuration nodes. Phase 8 runs after Phase 7, so it naturally
  absorbs the risk -- but only if the record is required to cover it.
- Alternative worth one line: skip the Nx target entirely and run `eslint .` as a plain npm script
  in the CI battery. Zero `hash_project_config` change, the LINT-01 -> PARITY-01 sequencing
  constraint disappears, and Phase 8 could go first. Cost: no Nx caching for lint (irrelevant on a
  one-project workspace, seconds), and LINT-04 becomes moot. Rejected here because LINT-01
  specifies a `lint` target and AGENTS.md prefers running tasks through Nx -- but it is the lazier
  option if the parity risk turns out to be real.

### 6.5 Phase 9 before Phase 10: agree, but the roadmap's mechanical argument is weaker than it thinks

The roadmap's stated reason -- all four TRUST requirements land in one phase with verifiable code
behind them -- is the RIGHT reason, and it holds.

The mechanical constraint is weak in both directions. Phase-10-first would also be safe: with the
version still OS-partitioned, the two legs would restore disjoint entry sets and upload into a
shared name space with no collision. What Phase-9-first buys mechanically is only that OBS-05 has
a concrete reason to exist before CORR-02 removes the OS suffix that currently distinguishes the
legs. Keep the order; do not over-claim the mechanics.

The real cost of Phase-9-first is the 2x shard-growth window (section 4.3). Keep the two phases
back-to-back.

### 6.6 Sequencing rows the roadmap gets right and should keep

- LINT-02 before CORR-05 violation removal (the rule must be proven to catch all four sites).
- RETAIN-04 in the SAME COMMIT as CORR-02. Confirmed necessary by reading `cleanup.ts:89`: the
  filter is the ONLY gate on the delete path, so a publisher writing `nx-cache-<hash>` against the
  unextended filter makes every new asset unprunable, silently, until the shard hits the 1000-asset
  cap.
- OBS-05 before CORR-02. Confirmed by reading `read-back.ts:37` and `publish-mirror.ts:262-266`:
  both legs seed `GITHUB_RUN_ID`; after the rename the ubuntu leg uploads `nx-cache-<run_id>` first
  (under `max-parallel: 1`), the Windows leg skips on name-present, and BOTH `publish-verify` legs
  read back the ubuntu-produced asset. The Windows publish path could be entirely dead and the job
  would stay green. Exactly as OBS-05 states.
- XOS-01 proven before XOS-04/XOS-05. Non-negotiable and correctly placed at the Phase 11/12
  boundary.

---

## 7. New vs modified, by phase

**Phase 7 (lint):** NEW `eslint.config.mjs`, NEW `lint` target, NEW LINT-03 violating fixture.
MODIFIED root `package.json` (devDeps + script), `pinned-deps.spec.ts` (one `it()` per new dep),
`.fallowrc.jsonc` (`ignoreDependencies` for `@nx/eslint`, likely an `entry` for the config).
Regenerate the action bundle if any autofix touches a `serve()`-reachable file.

**Phase 8 (parity):** NEW root-cause record, NEW CORR-03 two-leg CI job. MODIFIED `nx.json` only if
the root cause demands it; MODIFIED `nx-target-inputs.spec.ts` for the CORR-04 sole-discriminator
guard. No production source changes expected.

**Phase 9 (Actions-cache version):** MODIFIED `lib/cache-archive-path.ts` (rewrite + comment lock
rewrite), `lib/cache-archive-path.spec.ts` (two pins REPLACED), `backend/actions-cache-backend.ts`
(3 call sites + `mkdir` + the VER-04 cwd assert at construction),
`backend/actions-cache-backend.spec.ts` (extend to VER-03's argument-list and call-count
assertions), `publish/publish-mirror.ts` or `action/index.ts` (VER-05 compression surfacing in the
summary), `ci.yml` (VER-06 Windows `dogfood-verify`, OBS-04 wording, DOCS-08 comment corrections at
`:356-360` and `:577-583`), `docs/advanced.md`, `README.md`, `docs/trust-and-security.md`.
REGENERATE `start-cache-server/index.js`.

**Phase 10 (Releases name):** MODIFIED `lib/release-asset-name.ts` (rewrite; `releaseAssetName`
delegates to `cacheKeyFor`; `isServerProducedAssetName` gains the legacy branch; `cachePlatform`
and `CACHE_OS_VALUES` retained and annotated), `lib/release-asset-name.spec.ts` (three pins
replaced, one deleted, accept-list extended), `backend/releases-backend.spec.ts` (cross-OS block
replaced -- supply the new negative control), `cleanup/cleanup.spec.ts` (add new-family and
mixed-shard cases; keep all twelve legacy fixtures), `publish/publish-mirror.ts` +
`action/index.ts` + `publish/publish-mirror.spec.ts` (OBS-03 label seam),
`roundtrip/read-back.ts` (OBS-05 leg-distinguishable seed + comment rewrite), `ci.yml` (OBS-05
seeds, XOS-06 comment lock, XOS-07 `needs`, `:693` comment), `nx.json` (add `ci.yml` to `test`
inputs -- land this FIRST), `SECURITY.md` (TRUST-13, authored by gsd-security-auditor).
REGENERATE `start-cache-server/index.js`.

**Phase 11 (proofs):** NEW `ci.yml` probe steps for the re-specified O3 proof, NEW task-graph
assertion tooling for TEST-08, NEW evidence record. No production source changes.

**Phase 12 (O4 + docs):** MODIFIED `ci.yml` (Windows `build`/`typecheck`/`test` legs WITH `needs:`
on the ubuntu jobs), NEW consumer recipe doc, MODIFIED `nx.json` (register the recipe in `test`
inputs per DOCS-07), MODIFIED `docs-adoption.spec.ts` for the drift guard, MODIFIED the Phase 10
threat record if the Windows legs write.

---

## 8. Decisions owed before planning

1. **O3's proof shape** (section 6.1). Blocking for Phase 11; should be settled at roadmap
   amendment time, not at plan time.
2. **Phase 12's O4 ordering mechanism** (section 6.3). `needs:` is recommended; the decision
   changes Phase 12 SC 1.
3. **`release-asset-name.spec.ts:60`** (section 2.2, Gap 1). Delete or move to integration.
4. **The OBS-03 label's semantics** (section 4.6). "mirrored-by" is honest; "producing OS" is not
   derivable at the publish site.
5. **`.nx/cache/` vs `.nx/cache/github-cache/`** as the VER-01 literal (section 2.1, hazard 3).
   Cosmetic but the literal is comment-locked, so decide once.
6. **Whether the Windows publish leg survives v0.0.2** (section 4.2). Keeping it is correct per
   REQUIREMENTS.md; record the "it mirrors zero real assets" finding so v0.0.3 does not re-derive
   it.

---

*Architecture research for v0.0.2 OS-invariant cross-OS sharing. Researched 2026-07-26 against the
shipped v0.0.1 tree at `main` (fe25a3f) and `@actions/cache@6.2.0` as installed. Carries forward
`.planning/research/ARCHITECTURE.md` (v0.0.1) without repeating it.*
