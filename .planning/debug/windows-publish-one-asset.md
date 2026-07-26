---
slug: windows-publish-one-asset
status: root_caused
trigger: "Why did the Windows publish leg mirror only one task-hash asset while the Linux leg mirrored four?"
goal: find_root_cause_only
verdict: correct_by_design
created: 2026-07-26
updated: 2026-07-26
---

# Debug: Windows publish leg mirrored only one task-hash asset

## Symptoms

**Expected behavior:** Both `publish` matrix legs mirror the server-produced Actions-cache
entries available to them. Since restore is same-OS (D-03), each leg is expected to mirror ITS
OWN entries -- so a roughly symmetric count per OS, or at minimum more than one from Windows.

**Actual behavior:** Of the 5 new `<taskhash>-<os>` assets, FOUR are `-linux` and exactly ONE is
`-windows`. Both `publish` legs (ubuntu-24.04-arm, windows-11-arm) reported success, as did both
`publish-verify` legs.

**Error messages:** NONE. Both legs green. The absence of any error is part of what makes this
worth investigating -- a silent asymmetry, not a failure.

**Timeline:** First ever occurrence, and the only possible one so far. Run 30180166604 (event
`push`, commit `bfd5143` on `main`) is the FIRST run in which all 17 jobs executed with zero
skipped, i.e. the first time `publish` ran with real task artifacts present. There is no prior
working state to regress from.

**Reproduction:** A push to `main` triggers the `publish` matrix. Inspect the resulting asset
names on release id 354838660 (shard `cache-mirror-202607`, repo `op-nx/github-cache`):
`gh api repos/op-nx/github-cache/releases/354838660/assets --paginate -q '.[].name'`

## ROOT CAUSE

**The Windows leg mirrored one task-hash asset because the Windows runner only ever SAVED one
server-produced task-hash cache entry. `build`, `typecheck`, and `test` are single-OS
`ubuntu-24.04-arm` jobs -- they never run on Windows at all, so Windows computed no hash and
wrote no cache entry for them. `integration` is the only cacheable Nx task in the matrix, and its
Nx input hash carries an OS discriminator, so its Windows hash is distinct from its Linux one.**

The arithmetic is exact and leaves no residue:

| | cacheable Nx tasks that RAN | task-hash entries SAVED | task-hash assets MIRRORED |
|---|---|---|---|
| ubuntu-24.04-arm | build, typecheck, test, integration | 4 | 4 |
| windows-11-arm | integration | 1 | 1 |

The 4/1 split is the workflow's job topology projected through same-OS restore. It is the only
outcome the current `ci.yml` can produce. Nothing was filtered, raced, skipped, capped, or
silently dropped.

**Mechanism, in the two code facts that make restore strictly same-OS:**

1. `packages/github-cache/src/lib/cache-archive-path.ts:34-36` -- the archive path passed to
   `@actions/cache` is `join(tmpdir(), 'nx-github-cache-<hash>.tar')`. `tmpdir()` resolves to
   `/tmp` on the ubuntu runner and a `C:\...\Temp` path on the Windows runner, so the LITERAL
   path string differs per OS.
2. `node_modules/@actions/cache/lib/internal/cacheUtils.js:157-171` (`@actions/cache` 6.2.0) --
   `getCacheVersion` hashes `paths` + `compressionMethod` + `'windows-only'` (appended when
   `process.platform === 'win32'` and `enableCrossOsArchive` is false, which it is here, the
   backend never passes options) + the `'1.0'` salt.

Either factor alone makes the derived `version` OS-distinct. A restore only matches a
(key, version) pair, so a Windows leg can never resolve a Linux-saved entry and vice versa.
Because the path also contains the hash, every hash gets its own version -- which is why the
live cache list shows a distinct `version` per task-hash entry rather than one version per OS.

## Evidence

### E1 -- Only one Windows-saved task-hash entry ever existed (the root cause, directly measured)

`gh api repos/op-nx/github-cache/actions/caches --paginate`, the five task-hash entries on
`refs/heads/main`, with the job window each creation timestamp falls inside:

| key | version | bytes | created | created by |
|---|---|---|---|---|
| `nx-cache-14522047022641658505` | `076cb124819a` | 75674 | 23:52:41 | ubuntu (`build`, 23:52:16-23:52:43) |
| `nx-cache-6174109223991820850` | `db188fc5322c` | 663 | 23:52:45 | ubuntu (`integration` ubuntu, 23:52:17-23:52:48) |
| `nx-cache-7394251287891182137` | `8f17e9900fe2` | 69175 | 23:52:46 | ubuntu (`typecheck`, 23:52:17-23:52:48) |
| `nx-cache-12332927989897543193` | `b1bf22875cca` | 1084 | 23:52:46 | ubuntu (`test`, 23:52:17-23:52:49) |
| `nx-cache-13758457399293023985` | `76d3f03707ed` | 695 | **23:54:56** | **windows (`integration` windows, 23:52:18-23:55:05)** |

Four created inside a 5-second ubuntu window; the fifth created 2m10s later, inside the Windows
`integration` job's window and 9 seconds before that job ended. Exactly one Windows-saved
task-hash entry.

The task-to-hash attribution above is MEASURED, not inferred (this closed the original U1).
Every `nx-cache-<hash>` key referenced in each ubuntu job's log, run 30181729913 (all hashes
unchanged from 30180166604 -- see E8):

| job | `nx-cache-*` keys touched |
|---|---|
| `build` (89739334516) | `14522047022641658505` |
| `typecheck` (89739334551) | `14522047022641658505`, `7394251287891182137` |
| `test` (89739334572) | `12332927989897543193` |
| `integration (ubuntu-24.04-arm)` (89739334622) | `6174109223991820850` |

So `build` = `14522047022641658505`, `typecheck` = `7394251287891182137`,
`test` = `12332927989897543193`, ubuntu-`integration` = `6174109223991820850`, and
windows-`integration` = `13758457399293023985`. Four ubuntu, one windows.

### E2 -- The workflow gives Windows only one cacheable task, and the ubuntu count is exactly 4

`.github/workflows/ci.yml`, verified directly:

- `build:` line 158 -> `runs-on: ubuntu-24.04-arm` (no matrix)
- `typecheck:` line 232 -> `runs-on: ubuntu-24.04-arm` (no matrix)
- `test:` line 288 -> `runs-on: ubuntu-24.04-arm` (no matrix)
- `integration:` lines 359-364 -> `matrix: os: [ubuntu-24.04-arm, windows-11-arm]`

Confirmed by the job list for the run: `build`, `typecheck`, `test` appear once with no matrix
suffix; only `integration`, `publish`, `publish-verify` appear as `(ubuntu-24.04-arm)` /
`(windows-11-arm)` pairs. `dogfood-seed` (line 430) is ubuntu-only and writes a RUN-ID key, not a
task hash, so it does not enter this arithmetic.

**The "`typecheck` is 2 tasks" discrepancy -- RESOLVED, no entry is missing.** Every CI script is
`nx run-many -t <target>` over a single project (`packages/github-cache` is the only project), and
the Nx task counts per job are `build` 1, `test` 1, **`typecheck` 2**. A naive reading makes the
ubuntu expectation 5 task hashes against 4 observed. It is not a missing entry: the `typecheck`
job's second task is `build`, which it pulls in as a dependency and satisfies from cache. E1's
measured map shows the `typecheck` job touching BOTH `14522047022641658505` (the `build` hash,
identical to the `build` job's) and `7394251287891182137` (its own). `typecheck` therefore
contributes exactly ONE distinct hash, and the ubuntu total is 4, not 5:

    build(1) + typecheck(1 new + 1 shared with build) + test(1) + integration-ubuntu(1) = 4 distinct

Cross-checked against the PR run: `refs/pull/4/merge` holds 10 task-hash entries -- two generations
of 5 (`13655686526929222562`/`8635352794635529955`/`4445130902809326836`/`8416938578790724946`/
`4678388644353014375`, plus the 5 that carried to `main`), each generation sizing 1:1 against
build/typecheck/test/integration-ubuntu/integration-windows. Five per run, never six. The
arithmetic closes with zero residue.

`ci.yml:337` already documents the OS discriminator in prose: "differ, so both matrix legs run
and a Linux cache never satisfies a Windows [cache]".

### E3 -- Both legs enumerated the SAME set and each restored exactly its own OS's rows

`listCacheEntries` (`packages/github-cache/src/action/index.ts:37-50`) paginates
`getActionsCacheList` scoped to `ref` only -- it does NOT filter by OS or version. So both legs
saw an identical enumeration. The API returns **one row per (key, version) pair**, and
`publishMirror` maps rows to hashes with no dedup (`publish-mirror.ts:162-168`), so a key present
in both OS versions is restored TWICE per leg.

Enumeration at run time: 37 rows / 25 distinct `nx-cache-*` keys on `refs/heads/main`. (Measured
live as 40 rows / 27 keys on 2026-07-26; subtracting the 3 rows / 2 keys from the later run
30181729913 gives 37 / 25, matching the reconstruction exactly.)

Restore outcomes from the job logs, step `Run ./packages/github-cache`, `operation: publish`:

| | rows enumerated | restore HITs logged | distinct keys hit | restore MISSes |
|---|---|---|---|---|
| ubuntu leg (job 89735302848) | 37 | **36** | 24 | **1** |
| windows leg (job 89735302852) | 37 | **25** | 13 | **12** |

Both numbers are fully derivable from the version data, with zero slack:

- Windows-restorable rows = 12 dual-version run-id keys x 2 rows + 1 row for
  `nx-cache-13758457399293023985` = **25**. Windows logged 25 hits.
- Linux-restorable rows = 24 rows from the 12 dual-version keys + 2 rows (`nx-cache-29685631933`,
  `nx-cache-29685868362`) + 6 `nx-cache-cafe*` rows + 4 task-hash rows = **36**. Linux logged 36.
- Windows's 12 misses = the 4 Linux task hashes + 6 `cafe*` + 2 Linux-only run-id keys.
- Linux's 1 miss = the single Windows-only row, `nx-cache-13758457399293023985`.

The same-key-two-versions pairs are visible in the byte counts: Windows restored
`nx-cache-30169158892` at 251 B (version `081752d31ebd`), Linux restored the same key at 232 B
(version `d62752a29d84`). Each leg silently got its own copy.

### E4 -- Every restore hit that was not already present became an upload; nothing was dropped

The shard's +8 asset delta decomposes exactly, and each upload timestamp sits ~1s after its
restore-hit timestamp in the corresponding job log:

| asset | created | leg |
|---|---|---|
| `cafe30180166604-linux` | 23:53:17 | ubuntu |
| `30180166604-linux` | 23:53:18 | ubuntu |
| `12332927989897543193-linux` | 23:53:19 | ubuntu |
| `7394251287891182137-linux` | 23:53:21 | ubuntu |
| `6174109223991820850-linux` | 23:53:22 | ubuntu |
| `14522047022641658505-linux` | 23:53:23 | ubuntu |
| `30180166604-windows` | 23:56:21 | windows |
| `13758457399293023985-windows` | 23:56:22 | windows |

So the true OBS-01 counts were ubuntu `mirrored 6 / skipped 32 / failed 0` and windows
`mirrored 2 / skipped 24 / failed 0`. The Windows leg's upload path demonstrably WORKED -- it
wrote two assets. The 4-vs-1 framing is the task-hash-shaped subset of a 6-vs-2 mirror.

### E5 -- Why the 12 Windows misses left no trace in the log (the observability gap)

`node_modules/@actions/cache/lib/cache.js:294` (`@actions/cache` 6.2.0), the v2 blob-service
restore path:

```js
if (!response.ok) {
    core.debug(`Cache not found for version ${request.version} of keys: ${keys.join(', ')}`);
    return undefined;
}
```

A restore MISS is logged at **`core.debug`**, not `core.info`. With `ACTIONS_STEP_DEBUG` unset,
every one of the Windows leg's 12 misses was completely invisible in the job log -- which is why
the log shows a clean run of 25 hits and no hint that 12 lookups failed.

### E6 -- The OBS-01 summary could not have discriminated the hypotheses

The brief expected a `scanned` count in the summary. **It does not exist.**
`action/index.ts:156-160` emits exactly three rows:

```js
await writeCountSummary('github-cache publish', [
  ['mirrored', result.mirrored],
  ['skipped', result.skipped],
  ['failed', result.failed],
]);
```

`PublishResult` (`publish-mirror.ts:72-76`) carries only `mirrored | skipped | failed`.
`readMisses` IS tracked internally (`publish-mirror.ts:175`) but is never returned or reported --
it only gates the all-miss warning at `publish-mirror.ts:264-271`, whose condition is
`readMisses === hashes.length && mirrored === 0`. The Windows leg had 12 of 37 misses and
mirrored 2, so the warning correctly did not fire. A PARTIAL miss population is silent by
construction.

Consequence: the Windows summary read `mirrored 2 / skipped 24 / failed 0`, where `skipped`
conflates restore-MISS (12) with already-present-in-shard (12). Reading only the summary, the
two hypothesis families ("nothing to mirror" vs "tried and skipped") are indistinguishable.
**This is the actionable finding of the investigation.**

### E7 -- ROBUST-05 asset cap was not active

`RELEASE_ASSET_CAP = 1000` (`publish-mirror.ts:28`); the shard went 79 -> 87. No `core.warning`
appears in either job log, and the +8 delta in E4 accounts for every restore hit, so the
skip-and-warn branch (`publish-mirror.ts:217-224`) never executed. Confirmed inactive.

### E8 -- REPLICATION: run 30181729913 reproduces the asymmetry and confirms first-write-wins

A second `push` run landed mid-investigation: **30181729913**, head `2d3cfc5` (PR #5 merged),
completed `success` at 2026-07-26T00:53. It is a genuinely controlled repeat -- PR #5 changed only
`.planning/STATE.md` and four files under `.planning/quick/260725-w3s-.../`. Nothing under
`.planning/` appears in any Nx target's input set (`nx.json` inputs are `{projectRoot}/**/*` for
`packages/github-cache` plus a named list of `{workspaceRoot}` docs), so every task hash is
predicted unchanged.

Confirmed: **run 30181729913 created ZERO new task-hash Actions-cache entries.** The five
task-hash entries on `refs/heads/main` still carry their original 2026-07-25T23:5x creation
timestamps. All four ubuntu jobs and the windows `integration` job were cache HITs
("Nx read the output"), so nothing new was saved.

Per-leg restore counts, both runs:

| run | ubuntu hits / distinct | windows hits / distinct | ubuntu-only keys |
|---|---|---|---|
| 30180166604 | 36 / 24 | 25 / 13 | 11 |
| 30181729913 | 38 / 25 | 27 / 14 | 11 |

Each leg gained exactly +1 distinct key between runs -- that run's own run-id key, in its own OS
version. **The asymmetry is identical in both runs: 11 keys the ubuntu leg restores and the
windows leg cannot.** Systematic, not a one-off.

Task-hash assets mirrored by run 30181729913: **ZERO**. The only two new assets are the run-id
seeds, `30181729913-linux` (00:47:12) and `30181729913-windows` (00:50:15). The five pre-existing
task-hash assets were all already present, so first-write-wins (TRUST-07 / C3) made every one a
benign no-op -- exactly as designed, and directly confirmed.

Two consequences:

1. **The shard delta is the wrong number to reason about.** Run 30180166604 gave +8 and run
   30181729913 gave +2, from identical cache content. Only the per-run scanned / mirrored /
   restore-MISS counts are causally meaningful -- which is precisely what the summary does not
   report (E6).
2. **This is the observability hazard in its purest form.** Run 30181729913's windows `publish`
   leg mirrored zero task-hash assets, restored 14 of 27 enumerated rows, MISSed 13, and exited
   GREEN with `mirrored 1 / skipped N / failed 0`. A leg whose Actions-cache read scope had fully
   regressed would present identically. Nothing in the artifacts distinguishes the two.

### E9 -- PITFALLS Pitfall 7 verified, with two corrections

`.planning/research/PITFALLS.md` Pitfall 7 ("MUST-NOT-REOPEN -- cross-OS hashing and compression
traps") describes this mechanism, and its point 3 correctly predicted the silence: an unrestorable
entry is treated as "evicted; skip" with NO error. That IS the mechanism for both legs being green.
Two claims in it do not hold as written against this run:

**Correction 1 -- the compression clause in point 2 is STALE.** It states "windows-11-arm lacks
zstd and falls back to gzip, so a Windows entry cannot be restored by a zstd host." The job logs
show BOTH legs used zstd: the windows leg ran
`"C:\Program Files\Git\usr\bin\tar.exe" --posix -cf cache.tzst ... --use-compress-program "zstd -T0"`
and the ubuntu leg `tar --posix -cf cache.tzst ... --use-compress-program zstdmt`. The Windows
runner image now ships zstd (Git for Windows bundles it under `usr/bin`), so `compressionMethod`
was `zstd` on both sides and did NOT contribute to the version difference. Pitfall 7's own
Warning-signs section anticipated exactly this transition ("zstd added to windows-11-arm
invalidates pre-existing gzip entries -- transient, self-heals"), so the parenthetical simply
needs updating. The version is still OS-distinct via the other two factors (`tmpdir()` in the
literal path + the `windows-only` salt), so the verdict is unaffected -- but anyone reasoning from
that clause would attribute the split to the wrong factor.

**Correction 2 -- `uploadHash` no longer exists.** `git grep uploadHash -- packages/` returns
nothing; the function was renamed/refactored away. The current mechanism for "unrestorable entry
-> skip, no error" is the `restored.kind === 'miss'` branch at `publish-mirror.ts:184-189`. The
behaviour Pitfall 7 point 3 describes is intact; only the symbol name is stale.

Point 3's actual warning -- "collapsing the matrix back to one OS silently drops the other OS's
entries" -- is confirmed live: the ubuntu leg MISSed the one Windows-saved entry in both runs
(E3, E8), so a single-OS matrix would silently stop mirroring it.

## Eliminated

**(a) Windows entries were saved under keys the `nx-cache-` + hex filter rejected.** ELIMINATED.
Both legs enumerated the identical 37 rows and `isServerProducedKey` accepted the same set on
both; the filter is OS-blind (`publish-mirror.ts:163`, no platform input). The measured Windows
restore count (25) equals the Windows-restorable row count exactly (E3), which leaves zero rows
for a filter to have rejected. Separately: the filter accepts `nx-cache-<runid>` and
`nx-cache-cafe<runid>` because both suffixes are valid lowercase hex -- that is why 26
`<run_id>-<os>` assets exist -- but it is not implicated in this asymmetry.

**(c) Identical hashes across OSes caused first-write-wins 409 no-ops.** ELIMINATED on two
independent grounds, per the brief's instruction to check the upload call site:

1. `releaseAssetName` (`lib/release-asset-name.ts:50-55`) is unconditionally
   `` `${hash}-${cachePlatform(platform)}` `` with `platform` defaulting to `process.platform`,
   and `publish-mirror.ts:192` is the sole derivation feeding `uploadReleaseAsset` at
   `publish-mirror.ts:235`. A Windows upload is `<hash>-windows` and cannot collide with
   `<hash>-linux`. The hypothesis as written is impossible.
2. Decisively, and independent of naming: the Windows leg never obtained bytes for those four
   hashes. Each returned `restored.kind === 'miss'` and hit `continue` at
   `publish-mirror.ts:184-189` -- 12 measured misses (E3) -- so `uploadReleaseAsset` was never
   reached and no 409/422 was possible. The 422-already-exists branch
   (`publish-mirror.ts:239-246`) never ran either.

There is no surviving variant of (c). Windows and Linux did NOT compute identical hashes for
build/typecheck/test, because Windows never ran those tasks.

**(d) Job ordering / concurrency race.** ELIMINATED, and now doubly so. The legs ran strictly
sequentially with no overlap: ubuntu `publish` 23:52:47-23:53:42, windows `publish`
23:53:45-23:56:45 (3 seconds of gap). The ubuntu leg created the shard and uploaded 6; the Windows
leg then found the existing shard and uploaded 2 (E4). Zero contention, and no
`ensureShardRelease` 422-race branch was needed. Ordering is also causally irrelevant: had Windows
run first, it would still have restored only its own 13 keys and mirrored the same 2 assets,
because the enumeration and the version match are both order-independent.

The replication (E8) closes this off empirically: run 30181729913 reproduced the same 11-key
ubuntu-only surplus on a separate run with independent scheduling. A race would not reproduce the
identical split twice.

## Supported (with corrections)

**(b) The Windows leg had fewer entries available to restore.** SUPPORTED -- this is the root
cause, with the mechanism pinned to job topology rather than to save/restore timing or a
per-OS seed difference. The `dogfood-seed` job is ubuntu-only, but that is not the driver; each
`publish` leg runs its own `operation: seed` step first (visible at 23:53:14 ubuntu / 23:56:16
windows), which is why `30180166604` exists in both OS versions.

**(e) Windows genuinely only HAD one server-produced entry to mirror.** CONCLUSION SUPPORTED,
REASONING CORRECTED on two points:

1. WRONG: "build/typecheck/test hashes matched Linux's and were already restored-and-mirrored by
   the ubuntu leg". Those tasks never ran on Windows (E2), so Windows computed no hash and saved
   nothing for them. There was no hash collision to be absorbed.
2. WRONG: "the Actions cache is not OS-partitioned by default". It is not partitioned by KEY,
   but it IS partitioned by VERSION, and this backend's version is OS-distinct for two
   independent reasons (E5 / the two ROOT CAUSE mechanism facts). Even if Windows HAD run
   build/typecheck/test and computed byte-identical hashes, its publish leg still could not have
   restored the Linux-saved entries -- proven by the 12 measured cross-OS misses (E3), 4 of which
   were exactly those Linux task hashes.

## Verdict: CORRECT-BY-DESIGN

Not a defect. The 4/1 split is the exact, and the only possible, projection of the current
`ci.yml` job topology through same-OS restore (D-03). Every design decision behaved as
specified: the key filter passed everything legitimate, restore was correctly same-OS, the shard
was created once and raced correctly, first-write-wins skipped only already-present names, the
asset cap stayed dormant, and no upload failed. The mirror is complete with respect to what each
OS actually produced.

The ubuntu count was independently pressure-tested against a plausible "missing fifth entry"
reading (`typecheck` runs 2 Nx tasks) and survives: the second task is `build`, satisfied from
cache, so 4 is right (E2). The split also replicated exactly on a second run (E8). Two separate
attempts to find a real drop found none.

What went wrong is **observability, not behavior**: the asymmetry was unexplainable from the
artifacts the run emitted. Three compounding blind spots:

1. Restore MISSes are invisible in the log -- `@actions/cache` logs them at `core.debug` (E5).
2. The OBS-01 summary has no `scanned` and no restore-MISS row, and folds misses into `skipped`
   alongside already-present and cap skips (E6).
3. The all-miss warning only fires on a TOTAL miss, so a 12-of-37 partial miss is silent by
   construction (E6).

Together these mean a leg that mirrors nothing because its OS ran nothing is indistinguishable
from a leg whose Actions-cache read scope regressed. That equivalence is the real risk here --
the read-scope regression that `publish-mirror.ts:258-271` was written to catch would, on the
Windows leg, currently present as exactly the run we just spent this investigation explaining.

## PROPOSED (explicitly NOT applied -- goal is find_root_cause_only)

Ordered by value. Item 1 is the one that would have made this run self-explaining.

1. **Report `scanned` and `readMisses` in the OBS-01 summary.** Add both to `PublishResult`
   (`publish-mirror.ts:72-76`), return them from `publishMirror`, and add two rows in
   `action/index.ts:156-160`. `scanned` is `hashes.length`; `readMisses` is already computed and
   just needs returning. The Windows leg would then read
   `scanned 37 / mirrored 2 / restore-MISS 12 / skipped 12 / failed 0`, and the 4/1 split is
   obvious at a glance without touching a log. Small, additive, no contract change -- the
   summary is a job-summary table, not part of the consumer contract.

2. **Dedup `hashes` before the restore loop.** `publish-mirror.ts:162-168` maps one entry per
   (key, version) row, so every dual-version key is restored twice: 12 redundant restores on
   each leg this run (36 hits for 24 distinct keys on ubuntu, 25 for 13 on windows). A
   `[...new Set(...)]` around the mapped hashes removes the wasted round-trips and stops
   `skipped` being inflated by duplicate already-present hits. Behaviourally neutral -- the
   second pass is always a no-op skip -- so this is a cost and clarity fix, not a correctness
   one. Note it would change `hashes.length`, so land it together with item 1 so `scanned` means
   "distinct hashes" from the start.

3. **Document the expected shape.** One line in the publish docs: each `publish` leg can only
   mirror tasks that actually RAN on that OS, so a per-OS asset count asymmetry is the expected
   shape and each leg's count equals that OS's cacheable-task count. With only `integration`
   matrixed, `N-linux : 1-windows` is correct, not a bug.

4. **Update PITFALLS Pitfall 7** for the two staleness corrections in E9: drop or reword the
   "windows-11-arm lacks zstd and falls back to gzip" clause (both legs now use zstd, so
   compression is not currently a version discriminator), and replace the `uploadHash` symbol
   reference with `publish-mirror.ts`'s miss branch. Pure documentation accuracy -- the invariant
   the pitfall protects is intact and must stay.

**Explicitly NOT recommended:** anything that makes a leg mirror another OS's entries.
`enableCrossOsArchive` would change the derived version for every entry (invalidating the whole
existing mirror) and contradicts D-03 and the `cacheArchivePath` comment lock. Whether the
cross-OS gap is worth closing at all is a separate value question already scoped as deferred
under the recorded "publish-mirror cross-OS gap" and quick 260725-rk4/TEST-05 -- this
investigation does not reopen it.

## UNRESOLVED

**U1 -- CLOSED (was: exact task identity of `7394251287891182137` and `6174109223991820850`).**
Settled by direct measurement, not inference: each ubuntu job's log was searched for the
`nx-cache-<hash>` keys it touched, giving `build` = `14522047022641658505`,
`typecheck` = `7394251287891182137`, `test` = `12332927989897543193`, ubuntu-`integration` =
`6174109223991820850` (E1). The earlier size-analogy assignment was correct.

**U2 -- the six `nx-cache-cafe<runid>` entries exist only in a Linux version.** These are
integration-test fixture writes (the `cafe` prefix is hex, so they pass `isServerProducedKey` and
get mirrored as real assets). Since `integration` IS matrixed, a Windows-version `cafe*` entry
would be expected too, and none exists. This did not affect the investigated asymmetry -- they
are not task hashes, and they are already accounted for in Linux's 36 hits and Windows's 12
misses -- but it suggests the Windows `integration` suite may skip the fixture that writes them.
What would settle it: read the windows `integration` job log (89735268288) for the fixture's
save step, or check whether that spec is OS-gated. Worth a separate look; out of scope here.

## Constraints on the investigation (honoured)

- READ-ONLY: no source, workflow, or contract change; no fix applied.
- No mirror asset, release, or Actions-cache entry was deleted or modified. All `gh api` calls
  were GETs.
- `git grep` / `rg` only; never the Grep tool or the `grep` command.
- No `cd <path> &&` prefixes; ASCII only; temp logs kept in the session scratchpad.

## Current Focus

hypothesis: (b)/(e) -- Windows saved only one server-produced task-hash entry, because only
  `integration` runs on Windows and restore is strictly same-OS
test: COMPLETE. Measured task-to-hash map per ubuntu job (E1), ci.yml topology + the
  `typecheck`-is-2-tasks arithmetic challenge (E2), per-leg restore hit/miss arithmetic against
  the version data (E3), asset-delta reconciliation (E4), replication on run 30181729913 (E8),
  PITFALLS Pitfall 7 verification (E9)
expecting: CONFIRMED with zero unexplained residue -- 37 rows enumerated per leg; ubuntu 36 hits
  / 1 miss / 6 mirrored; windows 25 hits / 12 misses / 2 mirrored; shard +8. Replicated on run
  30181729913 (same 11-key ubuntu-only surplus, 0 new task-hash assets via first-write-wins)
next_action: none for diagnosis. Verdict correct-by-design; observability improvements 1-4 above
  await a decision. U2 is a separate, unrelated thread.
