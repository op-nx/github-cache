# Quick Task 260809-2s6 -- Research

**Researched:** 2026-08-09
**Scope:** integration points only (locked decisions D1-D5, constraints C1-C7 not revisited)

## BLOCKERS: none

D1 is safe: `GITHUB_RUN_ID` **is** available in the `publish` job's runtime (Q3 below, with
in-repo proof rather than vendor docs). No locked decision is invalidated.

---

## Q1 -- Every writer of every seed family

| Family | Written by | Read back by | Notes |
|---|---|---|---|
| `cafe<run_id>` | `.github/workflows/ci.yml:2120` (`consumer-smoke`, env `RUN_HASH`, ubuntu-only) | nothing -- PUT+GET inside the same step | Marker word authored in YAML. Precedent for a YAML-side marker. |
| `feed<index><run_id>` | `packages/github-cache/src/lib/mirror-seed.ts:59-61`, called from `action/index.ts:376` (`mirror-seed` op), driven by `ci.yml:2453-2456` (`publish` job, both legs) | `roundtrip/read-back.ts:388` (same helper) -- `publish-verify` | The only family with a TS helper. C1 depends on the CURRENT run's key being mirrored. |
| bare `<run_id>` | `ci.yml:1979` (`dogfood-seed`, `operation: seed`) -> `action/index.ts:329` uses the raw `hash` input | `ci.yml:2044` (`dogfood-verify`, `operation: verify`) -> `action/index.ts:423` uses the raw `hash` input | All-decimal, indistinguishable from an Nx task hash. 28 of 48 stale seeds. |

### D2 -- every site that must change together for the bare-run-id family

Two viable shapes. **The YAML-only shape touches strictly fewer sites and breaks zero specs.**

**Shape A (recommended, mirrors the `cafe` precedent):** change the `with: hash:` value in
BOTH dogfood jobs.

| # | Site | Change |
|---|---|---|
| 1 | `ci.yml:1979` (`dogfood-seed`) | `hash: <word>${{ github.run_id }}` |
| 2 | `ci.yml:2044` (`dogfood-verify`) | same value -- these two MUST move together or the round-trip MISSes |
| 3 | `ci.yml:29` | comment "the seed key is nx-cache-<GITHUB_RUN_ID>" -- stale prose |
| 4 | `ci.yml:1999` | comment, same claim (the vacuity-condition block) |
| 5 | `ci.yml:2116-2117` | `cafe` rationale names "the dogfood-seed / publish `nx-cache-<run_id>` key" -- stale |
| 6 | `ci.yml:2450-2452` | the disjointness paragraph ("a `nx-cache-<run_id>` collision would need...") -- the whole argument is superseded for this family |
| 7 | `action/index.ts:415` | verify-branch comment "The seed key is nx-cache-<GITHUB_RUN_ID>" |
| 8 | `mirror-seed.ts:35-38` | the "DISTINCT marker word per family" paragraph names two families; a third exists now |
| 9 | `dogfood-cross-os.spec.ts:16,101` | doc + failure-message prose repeating the same claim (message text only -- see Q2) |

Shape A requires **no** TypeScript change and **no** action-bundle rebuild.

**Shape B (a `dogfoodSeedHash(runId)` helper in TS, D-14 style):** adds sites 10-13 --
`lib/dogfood-seed.ts` (new), `action/index.ts` seed branch (`:329`) and verify branch
(`:423`), plus a new `EDITED_FILES` entry, and it breaks the specs in Q2. D-14's stated
reason for TS derivation is that YAML cannot import `CACHE_OS_VALUES`; a constant marker
word has no such mapping, so that reason does not transfer.

No fixture or doc outside `.planning/` hardcodes the bare shape: `git grep -n "nx-cache-<GITHUB_RUN_ID>" -- docs README.md` -> exit 1 (positive control: the same needle over `.github` returns 2 hits).

**Marker-word constraints (discretion is the planner's):** all-`[a-f0-9]`, leading hex
LETTER, and not a prefix of / prefixed by `cafe` or `feed` so the D1 filter can split the
three families. `dead` and `face` both satisfy this.

---

## Q2 -- Tests that pin a seed key shape

| Spec:line | Pins what | Breaks under Shape A? | Breaks under Shape B? |
|---|---|---|---|
| `lib/mirror-seed.spec.ts:59,66,75,82,93,99,118` | the `feed<i><run_id>` format itself, incl. `startsWith('cafe') === false` | no | no |
| `action/index.spec.ts:518-558` (`mirror-seed`) | derived URL is the seed, not the raw run id | no | no |
| `action/index.spec.ts:452-483` (`verify`) | **incidental fixture** -- `'run-1'` as hash, hand-authored body `nx-github-cache-dogfood:linux:run-1` | no | YES (URL + body literal) |
| `action/index.spec.ts` seed-branch cases | **incidental fixture** -- raw hash echoed into the PUT url | no | YES |
| `roundtrip/read-back.spec.ts:202,523-534` | `GITHUB_RUN_ID` presence + non-hex guard for the `feed` family | no | no |
| `dogfood-cross-os.spec.ts:83-108` | `operation: seed` / no-matrix / `runs-on` -- **never the `hash:` value**. `nx-cache-<GITHUB_RUN_ID>` at `:101` is the assertion's *message* string, not a needle | no | no |
| `docs-same-os-claims.spec.ts` | 15 `ci.yml` phrase locks + a forbidden-phrase scan over `EDITED_FILES` (`:627-640`), which already contains ci.yml, publish-mirror.ts, action/index.ts, read-back.ts, mirror-seed.ts, cache-key.ts | only if a locked comment phrase is deleted | same |
| `lib/release-asset-name.spec.ts:282-285`, `cleanup.spec.ts:233` | `cafe`/`feed` seeds survive the asset-name + cleanup filters -- **incidental fixtures** | no | no |

Verified absent: no spec reads `hash:` out of ci.yml. `git grep -n "github.run_id" -- 'packages/**/*.spec.ts'` -> exit 1; positive control on `.github/workflows/ci.yml` -> 5 hits.

---

## Q3 -- Is `GITHUB_RUN_ID` available where `publishMirror` runs?

**Yes.** `publish` runs `uses: ./packages/github-cache` with `operation: publish`
(`ci.yml:2457-2463`), i.e. a JS action -- a Node process that inherits the runner's default
env. That step's `env:` block sets only `GITHUB_TOKEN`, and the same code path already reads
two other runner-injected defaults from `process.env` on that exact step:
`GITHUB_REPOSITORY` (`action/index.ts:177`) and `GITHUB_REF` (`action/index.ts:198`). Both
are load-bearing (the repo-identity fail-closed and the TRUST-10 ref scoping), so the
injection is proven by the shipped behaviour, not assumed. `read-back.ts:374` reads
`process.env.GITHUB_RUN_ID` under the same convention, and `ci.yml:2521` records it
("GITHUB_REPOSITORY (runner-injected); GITHUB_RUN_ID is the hash").

**Plumbing note:** `publishMirror` reads no env today -- it is pure orchestration behind the
injected client, and `publish-mirror.spec.ts` drives it directly. Pass the run id as
`PublishOptions.runId`, alongside the existing `now` test-injection knob
(`publish-mirror.ts:109-111`), and read `process.env.GITHUB_RUN_ID` in `runPublish`
(`action/index.ts:201`). Adding an optional option field breaks no spec.

---

## Q4 -- `isServerProducedKey` / `HASH_PATTERN`

```
cache-key.ts:46  HASH_PATTERN = /^[a-f0-9]{1,512}$/
cache-key.ts:77  isServerProducedKey(key) = key.startsWith('nx-cache-') && HASH_PATTERN.test(suffix)
```

| Consumer | Site | Effect of the D1 filter |
|---|---|---|
| `isServerProducedKey` | `publish-mirror.ts:336` -- the ONLY runtime caller | none: keep it as-is and add the seed filter as a SECOND `.filter` in the same pipeline |
| `parseHash` (same `HASH_PATTERN`) | `server.ts:109` (SRV-03 route), `publish-mirror.ts:340`, `read-back.ts:388` | untouched |
| `HASH_PATTERN` direct | `release-asset-name.ts:111` (`isCurrentAssetName`, cleanup ACCEPT), `:163` (legacy branch) | untouched |

Do **not** narrow `isServerProducedKey` or `HASH_PATTERN`. `cache-key.ts:9-35` locks the
literal count (pinned by `cache-key.spec.ts`) and documents that changing it orphans the
whole mirror; `release-asset-name.ts:101` and `retention.ts:51` deliberately refuse to alias
these predicates. The seed filter belongs in `publish-mirror.ts` where the run id is known --
`cache-key.ts` is a leaf with no notion of a run.

---

## Q5 -- Action-bundle reachability

Measured against the committed bundle (`rg -c -F <symbol> start-cache-server/index.js`;
positive control `createCacheServer` -> 3):

| File | In bundle? | Evidence |
|---|---|---|
| `publish/publish-mirror.ts` | NO | `publishMirror` 0, `RELEASE_ASSET_CAP` 0 (exit 1) |
| `action/index.ts` | NO | `publishMirror` 0 |
| `lib/mirror-seed.ts` | NO | `mirrorSeedHash` 0 (its own docblock states this) |
| `roundtrip/read-back.ts` | NO | not reachable from `serve()` |
| `.github/workflows/ci.yml` | n/a | not source |
| `lib/cache-key.ts` | **YES** | `nx-cache-` 2, `a-f0-9` 1 |
| `lib/release-asset-name.ts` | **YES** | `releaseAssetName` 2 |

**Every file this task needs to edit is OUT of the bundle**, so no rebuild is required --
provided the plan does not touch `cache-key.ts` or `release-asset-name.ts` (Q4 says it must
not). If either is touched: regenerate with `npm run build:action` in the SAME commit
(verify with `npm run check:action`, which is the `action-bundle-drift` job at `ci.yml:128`).
Per C7 this must run on the main tree -- a junctioned `node_modules` produces a false drift.

---

## Q6 -- The loop reorder (D3): the shard is LAZY

`publish-mirror.ts:356` declares `shard` as `undefined` and `:437-448` resolves it inside the
loop, on the **first restorable entry**. The header states the intent explicitly at `:271-272`
("ensured LAZILY ... so an all-MISS leg never creates an empty release"), and `:365`
(`burnedShardTag`) exists precisely because the lazy resolve re-runs on every iteration while
`shard` is undefined.

So the membership test **must** handle "no shard yet". The enabling fact: `releaseAssetName(hash)`
(`:406`) depends on the hash ONLY -- no bytes -- so the name is computable before the restore.
The correct guard is `shard !== undefined && shard.names.has(name)`, placed above the
`actionsCache.get(hash)` call. Do **not** hoist `ensureShardRelease` above the loop: that
converts an all-MISS leg into an empty-release creator and re-opens the burned-tag noise case.

---

## Q7 -- Pitfalls

1. **11 exact-equality assertions on `PublishResult`.** `publish-mirror.spec.ts` has 11
   `expect(result).toEqual({ scanned, mirrored, skipped, readMisses, failed })` blocks
   (`:165, 263, 285, 304, 403, 746, 886, 958, 968, 1035, 1146`). D4 adding a counter field
   breaks every one. Budget for it.
2. **D3 silently reclassifies misses -- and can mute the existing gate.** Skipping before the
   restore means a present-but-unrestorable entry counts as already-present instead of
   `readMisses`. Measured as zero today (no miss was in the shard), but structurally it makes
   `readMisses === hashes.length` (`:548`) harder to reach, so the total-case warning can go
   silent for a new reason. Note it where the D5 partial guard lands.
3. **`scanned` must keep reconciling.** `scanned = hashes.length` (`:573`) and every loop
   iteration increments exactly one of `mirrored` / `skipped` / `failed`
   (`mirrored + skipped + failed === scanned`, asserted in spirit at
   `action/index.spec.ts:162`). `readMisses` is a strict SUBSET of `skipped` -- the miss branch
   at `:398-402` increments both. Any new already-present counter must also be a SUBSET of
   `skipped`, and the summary label must say so; `action/index.spec.ts:182` pins the exact
   string `'restore-MISS (of skipped)'`. `writeCountSummary` takes `[string, number]` pairs
   only and is documented (twice) as not widenable for one caller -- the label is the only
   place the subset relation can be stated. Rows are asserted with `toContainEqual`, so ADDING
   a row is safe; RENAMING the existing one is not.
4. **D1 shrinks `scanned`, which is the all-MISS gate's denominator.** Intended, but it means
   the before/after `scanned` figures in CONTEXT (149/150) are not comparable post-fix.
5. **The dedup is on DISTINCT hashes, not `(key, version)` rows** (`:333-343`). The seed filter
   must go inside that same pipeline (after `isServerProducedKey`, before or after `parseHash`)
   so a filtered seed never inflates the `Set`.
6. **C1 needs the CURRENT run's `feed` seed admitted for ALL indices, not just this leg's.**
   `max-parallel: 1` runs ubuntu first, so the windows leg enumerates ubuntu's `feed1<run>`
   too. Filter on the embedded run id only; do not additionally filter on this leg's OS index.
7. **D-11 cap branch (`:451`) reads `shard.names.size` and `shard.names.has(name)`.** Under D3,
   an already-present name now returns before that branch -- behaviourally identical (the cap
   branch already exempts present names via `&& !shard.names.has(name)`) but the spec at
   `:886` drives that path; re-check it.
8. **The D-12 oversized check (`:416`) needs bytes**, so it stays after the restore. Moving
   membership above it means an oversized-but-already-present asset no longer counts as
   `failed`. That is correct (nothing is uploaded) but it changes an aggregate `setFailed`
   outcome -- state it in the commit rather than letting review find it.
9. **`failed > 0` -> `core.setFailed` (`:569`)** is the only red signal in this file. D5's
   partial guard must be a `core.warning`, not a fail: `:534-536` records that a tripwire
   firing on correct work gets disabled (D-28b).
10. **`docs-same-os-claims.spec.ts` scans the comment prose of every file this task edits**
    (`EDITED_FILES`, `:627-640`) and holds 15 required-phrase locks on `ci.yml`. Reword freely,
    delete a locked phrase and the suite reddens with a message telling you to update the row
    in the same commit.

---

## Commands run

```
git grep -n "cafe\|mirrorSeedHash\|mirror-seed\|run_id\|GITHUB_RUN_ID" -- ':!*.md'
git grep -n "isServerProducedKey" -- 'packages/**' '.github/**'
git grep -n "HASH_PATTERN" -- 'packages/**' '.github/**'
git grep -n "GITHUB_RUN_ID\|github.run_id\|RUN_ID" -- 'packages/**/*.spec.ts'
git grep -n "dogfood-seed\|dogfood-verify" -- 'packages/**/*.spec.ts'
git grep -n "readMisses\|restore-MISS\|of skipped" -- 'packages/**'
rg -c -F <symbol> start-cache-server/index.js      # bundle reachability, per symbol
rg -c "expect\(result\)\.toEqual" packages/github-cache/src/publish/publish-mirror.spec.ts
```

Exit codes were read on every zero-result search; each absence claim above carries a
positive control on the same path.
