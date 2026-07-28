# Phase 9 -- Evidence Record

Authored by plan 09-07, in wave 6, BEFORE the merge of
`gsd/v0.0.2-os-invariant-cross-os-sharing` into `main`.

Three sections live here and they are three different KINDS of record. Read the kind before
reading the content:

1. `## Producer-attribution snapshot (D-34)` -- a PERISHABLE measurement of live repository
   state, taken at the last moment it can be taken. It is evidence PRESERVATION for Phase 11's
   TEST-08. It is NOT a proof and must not become one.
2. `## Live-CI closures` -- one row per behaviour only a real runner can settle, each with
   either a reference or an explicit open-with-reason. Two are `human_needed` at the merge and
   NEITHER is claimed closed here.
3. `## Recorded corrections` -- every miscount, stale citation and line-number drift this phase
   encountered, recorded rather than silently fixed, so the verifier and the milestone audit's
   three-source cross-reference do not read a content-located edit as unauthorised drift.

---

## Producer-attribution snapshot (D-34)

### Method

PARITY-06 discipline: every input below was RESOLVED rather than remembered, and the tool
versions are recorded beside the data so a later reader knows what produced it.

| Input | Value | How resolved |
|---|---|---|
| Capture timestamp (UTC) | `2026-07-28T20:30:55Z` | `date -u` |
| Repository | `op-nx/github-cache` | `gh repo view --json nameWithOwner` |
| Month-shard tag | `cache-mirror-202607` (July 2026) | `shardTag()` at `packages/github-cache/src/lib/retention.ts:54-59`, which concatenates `SHARD_TAG_PREFIX` (`:52`, `'cache-mirror-'`) with the UTC year and the zero-padded UTC month. Derived from that one source, not hand-guessed. |
| Shard release id | `354838660` | `gh api .../releases/tags/cache-mirror-202607` |
| Retention window | 30 days | `DEFAULT_MAX_AGE_DAYS` at `retention.ts:21`, the value `resolveMaxAgeDays` returns for an unset `CACHE_MIRROR_MAX_AGE_DAYS` |
| `gh` | 2.86.0 (2026-01-21) | `gh --version` |
| Nx | 23.1.0 | exact-pinned at `package.json:40` |
| Authoring commit | `72eeca3` (`docs(phase-09): update tracking after wave 5`) | `git rev-parse HEAD` |

All calls were read-only and GET-shaped. Nothing was created, updated or deleted: no release, no
asset, no issue, no pull request, no workflow dispatch.

### WHEN, and WHY now

**The gate is the MERGE to `main`, not this phase's first code commit.** `ci.yml:3-7` filters
`push` to `branches: [main]`, and the `publish` job is
`if: ${{ !cancelled() && github.event_name == 'push' }}` (`ci.yml:1003-1004`). So no commit on
this branch and no pull request mirrors anything -- VER-01 and VER-03 have already landed here
(09-03 at `47597a6`) and the ubuntu publish leg has still never had the opportunity to mirror a
Windows entry. C-05 corrected D-34's original gate on exactly this basis, and the run list in
`## Live-CI closures` below confirms it first-hand: every `publish` job on this branch is
`skipped`.

**Taking it LATE is deliberate.** Any asset created between the snapshot and the merge would
otherwise be missing from the record, and the record cannot be topped up afterwards. Waiting
past the merge is not the safe direction either: `CACHE_MIRROR_MAX_AGE_DAYS` defaults to 30, so
the shard's oldest in-window assets age out of the mirror while the snapshot's value decays.

### WHAT this is, and what it is NOT

This is evidence PRESERVATION for **TEST-08**, which is a **Phase 11** requirement and is **NOT
one of this phase's eleven** (`PARITY-08, VER-01..07, ROBUST-04, OBS-04, DOCS-08`). TEST-08's own
words: "The attribution window closes at Phase 9, not Phase 12 ... Capture `created_at` and the
OBS-03 label per asset, not just the asset list" (`REQUIREMENTS.md:473-491`).

It is **NOT the O1 proof.** It performs no per-hit attribution, cross-references nothing against
job windows, and derives no HIT/MISS verdict. State that plainly, because the natural next step
from this data is exactly the proof this phase must not perform -- D-34's own scope note says so,
and T-09-56 is the register entry for the drift.

Two lists were captured and only the named fields were captured. **No raw API JSON is reproduced
here**: the responses carry uploader identities, node ids and signed asset URLs, none of which
the record needs and all of which would be permanent once committed to a public repository
(T-09-52).

### WHY the window closes

Today the asset name's OS suffix IS producer attribution, and it is about to stop being one.

The `publish` job seeds `nx-cache-<github.run_id>` on EACH matrix leg
(`ci.yml:1084-1089`, `operation: seed`) and then mirrors the entries that leg can restore, naming
each `<hash>-<its own OS>` via `releaseAssetName`. Under the OS-partitioned cache version each
leg could only ever restore ITS OWN save, so `-linux` meant linux-produced and `-windows` meant
windows-produced. From the first post-merge push the version is OS-invariant, so a leg can
restore the OTHER leg's save and would still name it after itself. The suffix becomes a statement
about the PUBLISHING leg, not the producing one.

The visible fingerprint of the old partition is in the cache list below: **15 (key, ref) pairs
appear exactly twice**, all of them `nx-cache-<run_id>` seed keys on `refs/heads/main` -- two
distinct cache VERSIONS under one key, which is what two OSes saving the same key produced. The
real `nx-cache-<taskhash>` keys appear once each, because the platform discriminator already
keeps those task hashes distinct per OS. **Which version belongs to which OS is NOT derived
here** -- the list endpoint does not expose the version, the version also folds in the
compression method (VER-05's third component, pushed unconditionally at `cacheUtils.js:162-163`),
and deriving it is TEST-08's work, not this record's.

### The OBS-03 gap

**Every one of the 106 assets in the shard has an EMPTY `label`.** Recording that emptiness is
the point: `mirrored-by` is OBS-03, which is Phase 10, so until it lands the mirrored assets
carry no attribution field at all and this snapshot is what covers that window.

The retracted claim must not be written back in. The `label` will record the **PUBLISHING leg's
OS**, which from this phase forward can differ from the producing OS. It does NOT answer "whose
bytes did the developer get" -- that claim is explicitly RETRACTED (D-33), and
`docs-same-os-claims.spec.ts` asserts the phrase appears in none of the four edited doc files.

### Commands run, verbatim

```
date -u +"%Y-%m-%dT%H:%M:%SZ"
gh --version
gh repo view --json nameWithOwner
gh api repos/op-nx/github-cache/releases/tags/cache-mirror-202607 -q '.id, .tag_name, (.assets|length)'
gh api repos/op-nx/github-cache/actions/caches -q 'keys'
gh api repos/op-nx/github-cache/releases/354838660/assets --paginate -q '.[] | [.name, .created_at, (.size|tostring), (.label // "")] | @tsv'
gh api repos/op-nx/github-cache/actions/caches --paginate -q '.actions_caches[] | [.key, .ref, .created_at, .last_accessed_at, (.size_in_bytes|tostring)] | @tsv'
```

Two flag facts were confirmed before running rather than guessed (`gh api --help`): `--method`
defaults to `GET`, and `--paginate` is required because the assets endpoint pages. The
Actions-cache endpoint wraps its array in an `actions_caches` field -- confirmed by
`gh api .../actions/caches -q 'keys'` returning `["actions_caches","total_count"]` -- so a naive
`-q '.[]'` returns nothing there.

The shard release did NOT 404. Had it, that result would have been recorded verbatim rather than
the query being widened to another month (T-09-58).

### List 1 -- month-shard release assets (`cache-mirror-202607`, release `354838660`)

**106 assets.** Fields, tab-separated, in the order the endpoint returned them:
`name`, `created_at`, `size` (bytes), `label`.

The fourth field is EMPTY on every row. `size` and `created_at` are the two fields that matter
downstream: cleanup prunes on `created_at` (`cleanup/cleanup.ts:94`, with an unparseable value
skipped rather than pruned at `:97-104`), and `created_at` is what dates this population against
the merge.

Name families in this shard: 50 `<taskhash>.tar.gz` (pre-`CACHE_KEY_PREFIX` era), 38
`<hash>-linux`, 18 `<hash>-windows`.

```
name	created_at	size	label
10096198937770481578.tar.gz	2026-07-17T01:07:20Z	880	
10435320145148373986.tar.gz	2026-07-16T19:08:54Z	38764	
10499791444489987587.tar.gz	2026-07-16T22:08:55Z	32278	
10585782167112563771.tar.gz	2026-07-17T01:04:29Z	765	
10633740450907365976-windows	2026-07-26T09:51:27Z	413	
10647470443291386135.tar.gz	2026-07-16T18:14:31Z	766	
10766407421790863816.tar.gz	2026-07-17T02:24:45Z	894	
1106275010828907892.tar.gz	2026-07-17T01:04:30Z	894	
11426387616893273242.tar.gz	2026-07-17T01:50:13Z	33102	
11851244841046600347.tar.gz	2026-07-16T02:52:10Z	38365	
12047950478417881959.tar.gz	2026-07-16T15:27:34Z	1191	
12332927989897543193-linux	2026-07-25T23:53:19Z	838	
12951467812170628122.tar.gz	2026-07-16T18:47:48Z	32276	
13141311006143740150.tar.gz	2026-07-16T02:52:15Z	1186	
13547616286819861645.tar.gz	2026-07-17T01:50:15Z	767	
13619958981758949695-linux	2026-07-26T11:50:37Z	866	
13705612481333742155.tar.gz	2026-07-16T19:08:53Z	32277	
13758457399293023985-windows	2026-07-25T23:56:22Z	410	
13760497641595851564-linux	2026-07-26T11:50:39Z	72378	
13852687490143444310.tar.gz	2026-07-17T01:07:21Z	879	
13882857160826752849.tar.gz	2026-07-16T02:52:13Z	38542	
13903219299817011180.tar.gz	2026-07-17T01:07:18Z	878	
1421785687547170840.tar.gz	2026-07-16T15:27:32Z	38409	
14262061950303926685.tar.gz	2026-07-16T22:08:53Z	894	
14338304918331033483.tar.gz	2026-07-17T01:50:11Z	39058	
14522047022641658505-linux	2026-07-25T23:53:23Z	75316	
1471497094247345205.tar.gz	2026-07-16T19:31:25Z	32274	
14852852295936381207-linux	2026-07-26T09:47:58Z	855	
15536599390563745000.tar.gz	2026-07-16T02:52:09Z	1191	
15686506907291110714.tar.gz	2026-07-16T22:08:56Z	764	
16055051353815622661.tar.gz	2026-07-17T02:24:44Z	766	
16257400826014458324.tar.gz	2026-07-16T18:14:32Z	893	
16687857581845033275.tar.gz	2026-07-16T18:47:46Z	761	
16988467662695351114.tar.gz	2026-07-17T01:07:22Z	874	
17399590177850275118.tar.gz	2026-07-16T18:14:33Z	38767	
18181304708480479299.tar.gz	2026-07-17T02:24:42Z	39062	
1822904335635353663-windows	2026-07-26T11:53:33Z	411	
2061165761482534270.tar.gz	2026-07-17T01:07:19Z	876	
29685631933-linux	2026-07-20T08:09:05Z	35	
29685868362-linux	2026-07-20T08:09:03Z	35	
29726834220-linux	2026-07-20T08:09:02Z	35	
29726834220-windows	2026-07-20T08:11:48Z	35	
29771418344-linux	2026-07-20T19:19:21Z	35	
29771418344-windows	2026-07-20T19:21:58Z	35	
29772015309-linux	2026-07-20T19:28:03Z	35	
29772015309-windows	2026-07-20T19:30:45Z	35	
29790845037-linux	2026-07-21T00:39:01Z	35	
29790845037-windows	2026-07-21T00:42:37Z	35	
29791988995-linux	2026-07-21T01:02:34Z	35	
29791988995-windows	2026-07-21T01:05:08Z	35	
29792552880-linux	2026-07-21T01:14:35Z	26	
29792552880-windows	2026-07-21T01:17:00Z	35	
29792990244-linux	2026-07-21T01:24:16Z	35	
29792990244-windows	2026-07-21T01:26:59Z	35	
29883197438-linux	2026-07-22T01:29:36Z	35	
29883197438-windows	2026-07-22T01:32:37Z	35	
29883620760-linux	2026-07-22T01:38:29Z	35	
29883620760-windows	2026-07-22T01:41:12Z	35	
29884131798-linux	2026-07-22T01:49:45Z	35	
29884131798-windows	2026-07-22T01:52:41Z	35	
30169158892-linux	2026-07-25T18:13:17Z	35	
30169158892-windows	2026-07-25T18:15:49Z	35	
30180166604-linux	2026-07-25T23:53:18Z	35	
30180166604-windows	2026-07-25T23:56:21Z	35	
30181729913-linux	2026-07-26T00:47:12Z	35	
30181729913-windows	2026-07-26T00:50:15Z	35	
30197079037-linux	2026-07-26T09:47:56Z	35	
30197079037-windows	2026-07-26T09:51:25Z	35	
30200859202-linux	2026-07-26T11:50:34Z	35	
30200859202-windows	2026-07-26T11:53:32Z	35	
3136714030983044253.tar.gz	2026-07-16T18:47:50Z	894	
3919282196916976507-linux	2026-07-26T11:50:40Z	76416	
4178978998671386532.tar.gz	2026-07-16T18:14:30Z	32275	
4422798243389887025.tar.gz	2026-07-17T01:07:23Z	879	
4570830505326273802-linux	2026-07-26T09:48:00Z	76415	
4675037252562663442-linux	2026-07-26T09:48:01Z	417	
488032211555110318.tar.gz	2026-07-17T01:07:25Z	1169	
5034086445813481975-linux	2026-07-26T09:47:59Z	69159	
5228972701044460875.tar.gz	2026-07-17T02:27:22Z	879	
5978213973311737682.tar.gz	2026-07-17T02:24:47Z	33103	
6174109223991820850-linux	2026-07-25T23:53:22Z	417	
633350425129962113.tar.gz	2026-07-17T01:53:18Z	877	
6565553832009482452.tar.gz	2026-07-16T19:31:21Z	897	
6971251937101145570.tar.gz	2026-07-16T22:08:52Z	38766	
7081221982016459873.tar.gz	2026-07-16T18:47:44Z	38767	
7127255875494356461.tar.gz	2026-07-16T19:08:51Z	894	
7394251287891182137-linux	2026-07-25T23:53:21Z	68769	
7841430876028869616.tar.gz	2026-07-16T19:31:22Z	38770	
8368415452971856240.tar.gz	2026-07-17T01:07:24Z	873	
8509014362583143036.tar.gz	2026-07-17T01:04:31Z	32874	
8511155124892175930.tar.gz	2026-07-17T01:04:32Z	38788	
8675795456733546245.tar.gz	2026-07-16T15:27:36Z	32316	
8865876519165210738-linux	2026-07-26T11:50:36Z	418	
8866931918020923587.tar.gz	2026-07-16T19:31:24Z	770	
8923614715100397599.tar.gz	2026-07-17T01:50:16Z	894	
897487829682502953.tar.gz	2026-07-16T02:52:12Z	1194	
9870912208507404733.tar.gz	2026-07-16T19:08:52Z	768	
cafe29792990244-linux	2026-07-21T01:24:16Z	30	
cafe29883197438-linux	2026-07-22T01:29:37Z	30	
cafe29883620760-linux	2026-07-22T01:38:30Z	30	
cafe29884131798-linux	2026-07-22T18:08:53Z	30	
cafe30169158892-linux	2026-07-25T18:13:18Z	30	
cafe30180166604-linux	2026-07-25T23:53:17Z	30	
cafe30181729913-linux	2026-07-26T09:48:09Z	30	
cafe30197079037-linux	2026-07-26T09:47:57Z	30	
cafe30200859202-linux	2026-07-26T11:50:35Z	30	
```

Window covered: earliest `created_at` `2026-07-16T02:52:09Z`, latest `2026-07-26T11:53:33Z`. Every
asset here predates the merge, which is the whole value of the timestamp.

### List 2 -- repository Actions-cache entries

**164 entries.** Fields, tab-separated, in the order the endpoint returned them:
`key`, `ref`, `created_at`, `last_accessed_at`, `size_in_bytes`.

Key families, so a reader does not mistake one for another:

- **104 `nx-cache-*`** -- this project's entries. `CACHE_KEY_PREFIX` is `'nx-cache-'`
  (`lib/cache-key.ts:18`) and `isServerProducedKey` (`:52`) is the filter
  `getActionsCacheList` applies, so these are the only entries the publish path enumerates.
- **50 bare all-decimal keys** -- the pre-`CACHE_KEY_PREFIX` era; they correspond to the 50
  `<taskhash>.tar.gz` assets in list 1.
- **10 `node-cache-*`** -- `actions/setup-node`'s npm cache, not this project's, and not
  enumerated by the publish path. Present in the list because the endpoint is repository-wide.

`last_accessed_at` is captured because it is the only recency signal the Actions cache exposes
that the Releases mirror does not.

```
key	ref	created_at	last_accessed_at	size_in_bytes
nx-cache-6755489035308956894	refs/pull/9/merge	2026-07-28T15:21:26.704123000Z	2026-07-28T15:21:26.704123000Z	694
node-cache-Linux-arm64-npm-b8cfa691909850d039dabe483cbcfc8d783b8bc1a874023dc8c270b6128a6999	refs/pull/9/merge	2026-07-28T04:55:28.482999000Z	2026-07-28T15:21:26.350953000Z	104521927
nx-cache-13772310617450523374	refs/pull/9/merge	2026-07-28T15:18:45.883613000Z	2026-07-28T15:18:45.883613000Z	1174
nx-cache-258234447546071765	refs/pull/9/merge	2026-07-28T15:18:41.306466000Z	2026-07-28T15:18:41.306466000Z	77777
nx-cache-10560369841959014477	refs/pull/9/merge	2026-07-28T15:18:40.374624000Z	2026-07-28T15:18:40.374624000Z	664
nx-cache-17776792307406644378	refs/pull/9/merge	2026-07-28T14:18:34.178398000Z	2026-07-28T15:18:38.509509000Z	88193
node-cache-Windows-arm64-npm-b8cfa691909850d039dabe483cbcfc8d783b8bc1a874023dc8c270b6128a6999	refs/pull/9/merge	2026-07-28T04:58:10.615222000Z	2026-07-28T15:18:33.919475000Z	83158621
nx-cache-14358488692745251710	refs/pull/9/merge	2026-07-28T14:21:06.477785000Z	2026-07-28T14:21:06.477785000Z	695
nx-cache-8216412676813117775	refs/pull/9/merge	2026-07-28T14:18:39.205588000Z	2026-07-28T14:18:39.205588000Z	77447
nx-cache-18300191991966455953	refs/pull/9/merge	2026-07-28T14:18:32.349707000Z	2026-07-28T14:18:32.349707000Z	1164
nx-cache-4975009469470580751	refs/pull/9/merge	2026-07-28T14:18:29.051586000Z	2026-07-28T14:18:29.051586000Z	663
nx-cache-7983796642337867957	refs/pull/9/merge	2026-07-28T12:17:21.549803000Z	2026-07-28T12:47:00.558736000Z	696
nx-cache-140274194769865569	refs/pull/9/merge	2026-07-28T12:14:03.892283000Z	2026-07-28T12:44:26.738179000Z	84910
nx-cache-5058222226783247370	refs/pull/9/merge	2026-07-28T12:14:08.658216000Z	2026-07-28T12:44:26.688260000Z	1167
nx-cache-4678325324251623133	refs/pull/9/merge	2026-07-28T12:14:06.384120000Z	2026-07-28T12:44:25.762737000Z	76873
nx-cache-9553643947593596122	refs/pull/9/merge	2026-07-28T12:14:04.572269000Z	2026-07-28T12:44:22.862326000Z	666
nx-cache-1193647465557986036	refs/pull/9/merge	2026-07-28T06:40:27.983884000Z	2026-07-28T12:07:22.613148000Z	693
nx-cache-17197827372395989528	refs/pull/9/merge	2026-07-28T06:38:10.220977000Z	2026-07-28T12:03:52.085230000Z	84897
nx-cache-8949082127832201885	refs/pull/9/merge	2026-07-28T06:38:15.354024000Z	2026-07-28T12:03:45.820332000Z	76873
nx-cache-11946835023040710407	refs/pull/9/merge	2026-07-28T06:38:14.821114000Z	2026-07-28T12:03:45.804649000Z	669
nx-cache-1367622961810189968	refs/pull/9/merge	2026-07-28T06:38:16.467155000Z	2026-07-28T12:03:44.718347000Z	1160
nx-cache-11468316965167204315	refs/pull/9/merge	2026-07-28T11:50:41.607885000Z	2026-07-28T11:50:41.607885000Z	695
nx-cache-10651167368357562750	refs/pull/9/merge	2026-07-28T11:48:27.946991000Z	2026-07-28T11:48:27.946991000Z	76592
nx-cache-5346514019200865346	refs/pull/9/merge	2026-07-28T11:48:25.166027000Z	2026-07-28T11:48:25.166027000Z	84906
nx-cache-15041194964919364427	refs/pull/9/merge	2026-07-28T11:48:18.706066000Z	2026-07-28T11:48:18.706066000Z	660
nx-cache-3844377013355031551	refs/pull/9/merge	2026-07-28T04:58:36.406306000Z	2026-07-28T06:08:57.785517000Z	693
nx-cache-4268438596418767705	refs/pull/9/merge	2026-07-28T04:55:35.145331000Z	2026-07-28T06:06:38.625131000Z	76580
nx-cache-4824412313941236224	refs/pull/9/merge	2026-07-28T04:55:31.494094000Z	2026-07-28T06:06:38.283479000Z	84899
nx-cache-3399438549782114146	refs/pull/9/merge	2026-07-28T04:55:30.471937000Z	2026-07-28T06:06:37.337341000Z	1168
nx-cache-23244131947937181	refs/pull/9/merge	2026-07-28T04:55:30.338393000Z	2026-07-28T06:06:36.716137000Z	660
node-cache-Linux-arm64-npm-c0742716ac179775e5b61e028d6cc7af3a8d3ec8537556a43bde11435367a7aa	refs/heads/main	2026-07-22T01:29:09.172949000Z	2026-07-28T06:03:26.656738000Z	124673801
nx-cache-1822904335635353663	refs/heads/main	2026-07-26T11:53:09.790193000Z	2026-07-26T21:13:22.179640000Z	696
nx-cache-13760497641595851564	refs/heads/main	2026-07-26T11:49:59.121297000Z	2026-07-26T21:11:25.123297000Z	72819
nx-cache-3919282196916976507	refs/heads/main	2026-07-26T11:49:56.881382000Z	2026-07-26T21:11:24.165595000Z	76874
nx-cache-13619958981758949695	refs/heads/main	2026-07-26T11:50:01.321764000Z	2026-07-26T21:11:22.160285000Z	1124
nx-cache-8865876519165210738	refs/heads/main	2026-07-26T11:50:05.958183000Z	2026-07-26T21:11:21.069511000Z	674
node-cache-Windows-arm64-npm-c0742716ac179775e5b61e028d6cc7af3a8d3ec8537556a43bde11435367a7aa	refs/heads/main	2026-07-22T01:31:35.972149000Z	2026-07-26T21:11:16.749696000Z	71947714
nx-cache-10633740450907365976	refs/heads/main	2026-07-26T09:49:23.193357000Z	2026-07-26T11:53:45.450674000Z	696
nx-cache-13758457399293023985	refs/heads/main	2026-07-25T23:54:56.446711000Z	2026-07-26T11:53:45.110220000Z	695
nx-cache-30180166604	refs/heads/main	2026-07-25T23:56:17.758860000Z	2026-07-26T11:53:43.661965000Z	251
nx-cache-29884131798	refs/heads/main	2026-07-22T01:52:37.674464000Z	2026-07-26T11:53:43.288527000Z	252
nx-cache-29883620760	refs/heads/main	2026-07-22T01:41:08.577018000Z	2026-07-26T11:53:42.822883000Z	252
nx-cache-29792990244	refs/heads/main	2026-07-21T01:26:56.637077000Z	2026-07-26T11:53:42.460385000Z	252
nx-cache-29791988995	refs/heads/main	2026-07-21T01:05:05.522342000Z	2026-07-26T11:53:42.000426000Z	251
nx-cache-29772015309	refs/heads/main	2026-07-20T19:30:42.744554000Z	2026-07-26T11:53:41.616292000Z	254
nx-cache-29726834220	refs/heads/main	2026-07-20T08:11:45.960286000Z	2026-07-26T11:53:41.121504000Z	252
nx-cache-29771418344	refs/heads/main	2026-07-20T19:21:56.180204000Z	2026-07-26T11:53:40.601064000Z	251
nx-cache-29790845037	refs/heads/main	2026-07-21T00:42:34.942109000Z	2026-07-26T11:53:40.078957000Z	252
nx-cache-29792552880	refs/heads/main	2026-07-21T01:16:58.240862000Z	2026-07-26T11:53:39.715905000Z	253
nx-cache-29883197438	refs/heads/main	2026-07-22T01:32:34.564824000Z	2026-07-26T11:53:39.251306000Z	253
nx-cache-30169158892	refs/heads/main	2026-07-25T18:15:46.610250000Z	2026-07-26T11:53:38.729524000Z	251
nx-cache-30181729913	refs/heads/main	2026-07-26T00:50:12.840025000Z	2026-07-26T11:53:38.228794000Z	250
nx-cache-30197079037	refs/heads/main	2026-07-26T09:51:22.884211000Z	2026-07-26T11:53:37.775394000Z	253
nx-cache-30200859202	refs/heads/main	2026-07-26T11:53:28.769727000Z	2026-07-26T11:53:30.406491000Z	251
nx-cache-cafe30197079037	refs/heads/main	2026-07-26T09:47:41.987710000Z	2026-07-26T11:50:53.694442000Z	235
nx-cache-14852852295936381207	refs/heads/main	2026-07-26T09:47:28.458691000Z	2026-07-26T11:50:53.422679000Z	1112
nx-cache-5034086445813481975	refs/heads/main	2026-07-26T09:47:28.356573000Z	2026-07-26T11:50:53.095898000Z	69494
nx-cache-4570830505326273802	refs/heads/main	2026-07-26T09:47:23.791926000Z	2026-07-26T11:50:52.713546000Z	76886
nx-cache-4675037252562663442	refs/heads/main	2026-07-26T09:47:23.195550000Z	2026-07-26T11:50:52.421273000Z	663
nx-cache-cafe30180166604	refs/heads/main	2026-07-25T23:53:15.412625000Z	2026-07-26T11:50:52.144041000Z	235
nx-cache-cafe29883620760	refs/heads/main	2026-07-22T01:38:27.168123000Z	2026-07-26T11:50:51.862599000Z	230
nx-cache-cafe29792990244	refs/heads/main	2026-07-21T01:23:55.309144000Z	2026-07-26T11:50:51.580308000Z	230
nx-cache-29685868362	refs/heads/main	2026-07-19T11:50:47.891309000Z	2026-07-26T11:50:51.262601000Z	228
nx-cache-29685631933	refs/heads/main	2026-07-19T11:43:04.567931000Z	2026-07-26T11:50:50.963497000Z	223
nx-cache-cafe29883197438	refs/heads/main	2026-07-22T01:29:31.910538000Z	2026-07-26T11:50:50.641407000Z	230
nx-cache-cafe29884131798	refs/heads/main	2026-07-22T01:49:45.328640000Z	2026-07-26T11:50:50.273845000Z	230
nx-cache-cafe30169158892	refs/heads/main	2026-07-25T18:13:15.051541000Z	2026-07-26T11:50:49.984073000Z	230
nx-cache-6174109223991820850	refs/heads/main	2026-07-25T23:52:45.406069000Z	2026-07-26T11:50:49.699554000Z	663
nx-cache-12332927989897543193	refs/heads/main	2026-07-25T23:52:46.779455000Z	2026-07-26T11:50:49.121072000Z	1084
nx-cache-7394251287891182137	refs/heads/main	2026-07-25T23:52:46.196443000Z	2026-07-26T11:50:48.746341000Z	69175
nx-cache-14522047022641658505	refs/heads/main	2026-07-25T23:52:41.789971000Z	2026-07-26T11:50:48.063237000Z	75674
nx-cache-cafe30181729913	refs/heads/main	2026-07-26T00:47:11.021851000Z	2026-07-26T11:50:47.753444000Z	237
nx-cache-30197079037	refs/heads/main	2026-07-26T09:47:17.268532000Z	2026-07-26T11:50:47.478697000Z	223
nx-cache-30181729913	refs/heads/main	2026-07-26T00:46:36.576371000Z	2026-07-26T11:50:47.016826000Z	223
nx-cache-30169158892	refs/heads/main	2026-07-25T18:12:43.658031000Z	2026-07-26T11:50:46.437148000Z	232
nx-cache-29883197438	refs/heads/main	2026-07-22T01:29:20.027061000Z	2026-07-26T11:50:46.148276000Z	229
nx-cache-29792552880	refs/heads/main	2026-07-21T01:14:05.921765000Z	2026-07-26T11:50:45.578279000Z	231
nx-cache-29790845037	refs/heads/main	2026-07-21T00:38:30.657560000Z	2026-07-26T11:50:44.998985000Z	229
nx-cache-29771418344	refs/heads/main	2026-07-20T19:18:41.868452000Z	2026-07-26T11:50:44.665317000Z	223
nx-cache-29726834220	refs/heads/main	2026-07-20T08:08:31.868316000Z	2026-07-26T11:50:43.968636000Z	224
nx-cache-29772015309	refs/heads/main	2026-07-20T19:27:22.970581000Z	2026-07-26T11:50:43.655308000Z	228
nx-cache-29791988995	refs/heads/main	2026-07-21T01:02:00.924665000Z	2026-07-26T11:50:43.352204000Z	225
nx-cache-29792990244	refs/heads/main	2026-07-21T01:23:58.137497000Z	2026-07-26T11:50:42.739456000Z	224
nx-cache-29883620760	refs/heads/main	2026-07-22T01:38:11.299188000Z	2026-07-26T11:50:42.092434000Z	226
nx-cache-29884131798	refs/heads/main	2026-07-22T01:49:26.439082000Z	2026-07-26T11:50:41.493975000Z	222
nx-cache-30180166604	refs/heads/main	2026-07-25T23:52:44.531850000Z	2026-07-26T11:50:40.883688000Z	220
nx-cache-cafe30200859202	refs/heads/main	2026-07-26T11:50:27.215017000Z	2026-07-26T11:50:35.124492000Z	229
nx-cache-30200859202	refs/heads/main	2026-07-26T11:49:58.299803000Z	2026-07-26T11:50:33.478196000Z	222
nx-cache-1822904335635353663	refs/pull/7/merge	2026-07-26T11:46:27.669470000Z	2026-07-26T11:46:27.669470000Z	694
nx-cache-13760497641595851564	refs/pull/7/merge	2026-07-26T11:43:52.882186000Z	2026-07-26T11:43:52.882186000Z	72820
nx-cache-3919282196916976507	refs/pull/7/merge	2026-07-26T11:43:50.579500000Z	2026-07-26T11:43:51.808226000Z	76888
nx-cache-8865876519165210738	refs/pull/7/merge	2026-07-26T11:43:50.916761000Z	2026-07-26T11:43:50.916761000Z	667
nx-cache-13619958981758949695	refs/pull/7/merge	2026-07-26T11:43:49.468068000Z	2026-07-26T11:43:49.468068000Z	1115
nx-cache-10633740450907365976	refs/pull/6/merge	2026-07-26T09:37:27.342095000Z	2026-07-26T09:43:39.104930000Z	695
nx-cache-4675037252562663442	refs/pull/6/merge	2026-07-26T09:35:19.231642000Z	2026-07-26T09:41:23.488253000Z	674
nx-cache-4570830505326273802	refs/pull/6/merge	2026-07-26T09:35:19.737987000Z	2026-07-26T09:41:23.260154000Z	76872
nx-cache-5034086445813481975	refs/pull/6/merge	2026-07-26T09:35:24.755192000Z	2026-07-26T09:41:19.523323000Z	69481
nx-cache-14852852295936381207	refs/pull/6/merge	2026-07-26T09:35:19.444865000Z	2026-07-26T09:41:17.405341000Z	1099
nx-cache-13758457399293023985	refs/pull/4/merge	2026-07-25T19:24:17.637103000Z	2026-07-25T23:50:43.926592000Z	694
nx-cache-12332927989897543193	refs/pull/4/merge	2026-07-25T19:22:10.906978000Z	2026-07-25T23:48:39.015789000Z	1089
nx-cache-7394251287891182137	refs/pull/4/merge	2026-07-25T19:22:08.992092000Z	2026-07-25T23:48:38.732248000Z	69243
nx-cache-6174109223991820850	refs/pull/4/merge	2026-07-25T19:22:01.602711000Z	2026-07-25T23:48:38.702897000Z	662
nx-cache-14522047022641658505	refs/pull/4/merge	2026-07-25T18:54:09.456343000Z	2026-07-25T23:48:38.398857000Z	75688
nx-cache-13655686526929222562	refs/pull/4/merge	2026-07-25T20:32:13.005497000Z	2026-07-25T20:32:13.005497000Z	73142
nx-cache-4678388644353014375	refs/pull/4/merge	2026-07-25T18:57:43.946315000Z	2026-07-25T18:57:43.946315000Z	694
nx-cache-8635352794635529955	refs/pull/4/merge	2026-07-25T18:54:16.743572000Z	2026-07-25T18:54:16.743572000Z	69245
nx-cache-4445130902809326836	refs/pull/4/merge	2026-07-25T18:54:12.701716000Z	2026-07-25T18:54:12.701716000Z	1092
nx-cache-8416938578790724946	refs/pull/4/merge	2026-07-25T18:54:11.113284000Z	2026-07-25T18:54:11.113284000Z	663
node-cache-Windows-arm64-npm-c0742716ac179775e5b61e028d6cc7af3a8d3ec8537556a43bde11435367a7aa	refs/pull/3/merge	2026-07-22T01:07:24.372202000Z	2026-07-22T01:25:42.679593000Z	71943914
node-cache-Linux-arm64-npm-c0742716ac179775e5b61e028d6cc7af3a8d3ec8537556a43bde11435367a7aa	refs/pull/3/merge	2026-07-22T01:05:20.364550000Z	2026-07-22T01:25:36.139333000Z	124674386
node-cache-Windows-arm64-npm-86106022733a8b5d619ada7d051f5b0b87da328dfc90975daae4b4b4a8910a73	refs/heads/main	2026-07-21T00:40:32.871126000Z	2026-07-21T22:59:00.820740000Z	71795965
node-cache-Linux-arm64-npm-86106022733a8b5d619ada7d051f5b0b87da328dfc90975daae4b4b4a8910a73	refs/heads/main	2026-07-21T00:38:28.911515000Z	2026-07-21T22:58:53.332004000Z	124529693
13903219299817011180	refs/heads/main	2026-07-17T01:03:59.258229000Z	2026-07-21T22:51:28.095877000Z	1165
2061165761482534270	refs/heads/main	2026-07-17T00:18:51.521219000Z	2026-07-21T22:51:27.122133000Z	1165
10096198937770481578	refs/heads/main	2026-07-16T22:07:53.429017000Z	2026-07-21T22:51:26.227756000Z	1168
13852687490143444310	refs/heads/main	2026-07-16T19:30:48.083069000Z	2026-07-21T22:51:25.296597000Z	1166
16988467662695351114	refs/heads/main	2026-07-16T19:08:15.941378000Z	2026-07-21T22:51:24.379841000Z	1162
4422798243389887025	refs/heads/main	2026-07-16T18:46:49.654362000Z	2026-07-21T22:51:23.495497000Z	1167
8368415452971856240	refs/heads/main	2026-07-16T18:16:43.405506000Z	2026-07-21T22:51:22.504063000Z	1160
488032211555110318	refs/heads/main	2026-07-16T15:30:22.482368000Z	2026-07-21T22:51:21.620009000Z	1460
633350425129962113	refs/heads/main	2026-07-17T01:49:35.793960000Z	2026-07-21T22:51:20.630049000Z	1164
5228972701044460875	refs/heads/main	2026-07-17T02:24:05.807871000Z	2026-07-21T22:51:19.683104000Z	1167
10585782167112563771	refs/heads/main	2026-07-17T00:59:48.912169000Z	2026-07-21T22:47:53.171810000Z	1013
1106275010828907892	refs/heads/main	2026-07-17T00:59:48.466269000Z	2026-07-21T22:47:52.667402000Z	1141
8509014362583143036	refs/heads/main	2026-07-17T00:59:47.033931000Z	2026-07-21T22:47:51.983855000Z	33179
8511155124892175930	refs/heads/main	2026-07-17T00:59:45.819989000Z	2026-07-21T22:47:51.246696000Z	39073
10647470443291386135	refs/heads/main	2026-07-16T18:13:44.812075000Z	2026-07-21T22:47:50.647789000Z	1014
16257400826014458324	refs/heads/main	2026-07-16T18:13:43.313502000Z	2026-07-21T22:47:49.823997000Z	1138
4178978998671386532	refs/heads/main	2026-07-16T18:13:51.381003000Z	2026-07-21T22:47:48.760306000Z	32540
17399590177850275118	refs/heads/main	2026-07-16T18:13:41.691655000Z	2026-07-21T22:47:47.860652000Z	39064
1421785687547170840	refs/heads/main	2026-07-16T13:56:56.510969000Z	2026-07-21T22:47:46.947332000Z	38761
12047950478417881959	refs/heads/main	2026-07-16T13:56:56.216141000Z	2026-07-21T22:47:46.084613000Z	1439
8675795456733546245	refs/heads/main	2026-07-16T13:56:56.261593000Z	2026-07-21T22:47:45.169064000Z	32666
13141311006143740150	refs/heads/main	2026-07-16T02:35:39.701514000Z	2026-07-21T22:47:44.297747000Z	1434
13882857160826752849	refs/heads/main	2026-07-16T02:35:33.491015000Z	2026-07-21T22:47:43.632286000Z	38911
897487829682502953	refs/heads/main	2026-07-16T02:39:27.112910000Z	2026-07-21T22:47:43.093082000Z	1440
11851244841046600347	refs/heads/main	2026-07-16T02:51:45.981813000Z	2026-07-21T22:47:42.417391000Z	38392
15536599390563745000	refs/heads/main	2026-07-16T02:51:48.873420000Z	2026-07-21T22:47:41.898516000Z	1439
3136714030983044253	refs/heads/main	2026-07-16T18:43:50.328456000Z	2026-07-21T22:47:40.831796000Z	1141
12951467812170628122	refs/heads/main	2026-07-16T18:43:51.130503000Z	2026-07-21T22:47:40.007579000Z	32553
16687857581845033275	refs/heads/main	2026-07-16T18:43:51.153702000Z	2026-07-21T22:47:39.369823000Z	1009
7081221982016459873	refs/heads/main	2026-07-16T18:43:58.439218000Z	2026-07-21T22:47:38.836591000Z	39064
7127255875494356461	refs/heads/main	2026-07-16T19:04:27.751403000Z	2026-07-21T22:47:37.841335000Z	1141
10435320145148373986	refs/heads/main	2026-07-16T19:04:17.411108000Z	2026-07-21T22:47:36.945969000Z	39064
13705612481333742155	refs/heads/main	2026-07-16T19:04:17.673917000Z	2026-07-21T22:47:36.364903000Z	32541
9870912208507404733	refs/heads/main	2026-07-16T19:04:19.985998000Z	2026-07-21T22:47:35.847364000Z	1016
6565553832009482452	refs/heads/main	2026-07-16T19:27:05.933685000Z	2026-07-21T22:47:34.798587000Z	1144
7841430876028869616	refs/heads/main	2026-07-16T19:26:50.984265000Z	2026-07-21T22:47:33.965030000Z	38943
1471497094247345205	refs/heads/main	2026-07-16T19:26:46.173852000Z	2026-07-21T22:47:33.149100000Z	32549
8866931918020923587	refs/heads/main	2026-07-16T19:26:49.873335000Z	2026-07-21T22:47:32.712402000Z	1017
10499791444489987587	refs/heads/main	2026-07-16T22:05:01.292514000Z	2026-07-21T22:47:32.214461000Z	32541
14262061950303926685	refs/heads/main	2026-07-16T22:05:02.816399000Z	2026-07-21T22:47:31.685191000Z	1141
15686506907291110714	refs/heads/main	2026-07-16T22:04:59.929099000Z	2026-07-21T22:47:30.808699000Z	1012
6971251937101145570	refs/heads/main	2026-07-16T22:05:04.593582000Z	2026-07-21T22:47:30.028836000Z	38913
8923614715100397599	refs/heads/main	2026-07-17T01:46:54.237069000Z	2026-07-21T22:47:29.169617000Z	1141
13547616286819861645	refs/heads/main	2026-07-17T01:46:55.406773000Z	2026-07-21T22:47:28.058559000Z	1012
11426387616893273242	refs/heads/main	2026-07-17T01:46:55.418267000Z	2026-07-21T22:47:26.882895000Z	33439
14338304918331033483	refs/heads/main	2026-07-17T01:46:59.230114000Z	2026-07-21T22:47:26.012802000Z	39328
16055051353815622661	refs/heads/main	2026-07-17T02:21:27.288550000Z	2026-07-21T22:47:23.933214000Z	1014
10766407421790863816	refs/heads/main	2026-07-17T02:21:27.233771000Z	2026-07-21T22:47:23.047607000Z	1140
5978213973311737682	refs/heads/main	2026-07-17T02:21:26.372248000Z	2026-07-21T22:47:22.163092000Z	33439
18181304708480479299	refs/heads/main	2026-07-17T02:21:29.260072000Z	2026-07-21T22:47:20.946650000Z	39422
node-cache-Windows-arm64-npm-7fc8556cca69a961d57f637844795817a90d20759c6b04f1593cfc3a4d0a25c3	refs/heads/main	2026-07-17T00:18:55.764884000Z	2026-07-21T22:47:10.031914000Z	61062834
node-cache-Linux-arm64-npm-7fc8556cca69a961d57f637844795817a90d20759c6b04f1593cfc3a4d0a25c3	refs/heads/main	2026-07-16T13:56:51.603634000Z	2026-07-21T22:46:57.751159000Z	68376112
```

Window covered: earliest `created_at` `2026-07-16T02:35:33.491015000Z`, latest
`2026-07-28T15:21:26.704123000Z`.

The 15 duplicated `(key, ref)` pairs, all on `refs/heads/main`:
`nx-cache-29726834220`, `nx-cache-29771418344`, `nx-cache-29772015309`, `nx-cache-29790845037`,
`nx-cache-29791988995`, `nx-cache-29792552880`, `nx-cache-29792990244`, `nx-cache-29883197438`,
`nx-cache-29883620760`, `nx-cache-29884131798`, `nx-cache-30169158892`, `nx-cache-30180166604`,
`nx-cache-30181729913`, `nx-cache-30197079037`, `nx-cache-30200859202`. Each appears exactly
twice; nothing appears three or more times.

---

## Live-CI closures

Per `.planning/codebase/TESTING.md`'s Live-CI first-push pattern, every item below is one that
only a REAL runner can settle, NAMED individually rather than folded into a general "CI is
green". Each carries either a reference or an explicit open-with-reason. **Nothing is stated as
closed that is open.**

### The one live observation this plan DID make: the push gate, first-hand

The reason VER-06 and OBS-04 cannot be observed pre-merge has been read from `ci.yml` throughout
this phase (C-06). It is now also OBSERVED on a real run.

`gh run list --branch gsd/v0.0.2-os-invariant-cross-os-sharing` returns `pull_request` events
ONLY -- no `push` event has ever fired on this branch, which is the `ci.yml:3-7`
`branches: [main]` filter working. And in the latest such run,
[`30372679674`](https://github.com/op-nx/github-cache/actions/runs/30372679674) (conclusion
`success`, created `2026-07-28T15:18:05Z`), the job conclusions are:

| Job | Conclusion |
|---|---|
| `format-check`, `lint`, `fallow`, `pack-check`, `ppe` | success |
| `action-bundle-drift` | success |
| `build`, `typecheck`, `test` | success |
| `integration (ubuntu-24.04-arm)`, `integration (windows-11-arm)` | success |
| `hash-parity (ubuntu-24.04-arm)`, `hash-parity (windows-11-arm)`, `hash-parity-compare` | success |
| `dogfood-seed` | **skipped** |
| `dogfood-verify` | **skipped** |
| `consumer-smoke` | **skipped** |
| `publish` | **skipped** |
| `publish-verify` | **skipped** |

Five skipped jobs, all five of them the `if: github.event_name == 'push'` ones
(`ci.yml:802`, `:853`, `:901`, `:1004`, `:1113`). That is the gate, measured rather than
inferred. It is also why the two items below have no pre-merge acceptance check and why authoring
one would be a guard passing for the wrong reason.

### A precondition on every row in this section: the branch is UNPUSHED

**Read this before reading any "pre-merge" result below.** `git rev-list --left-right --count
origin/gsd/v0.0.2-os-invariant-cross-os-sharing...HEAD` returns `0 32`: the 32 commits carrying
this whole phase are LOCAL ONLY. Pull request #9's head is `3327a4f`
(`docs(08): extract phase learnings`), the END of Phase 8.

So run `30372679674` above -- the most recent run on this branch and the source of every
conclusion in that table -- was computed on **Phase 8's tree, containing NONE of Phase 9's code**.
It is recorded as the last observed value and as first-hand proof of the push gate. It is **NOT**
evidence about anything this phase built.

This makes the two "available pre-merge" items below **AVAILABLE but NOT YET SAMPLED**. They are
categorically different from the two `human_needed` ones: these two CAN close before the merge,
on the next push of this branch, and they simply have not run yet. Do not merge the two
categories, and do not read `action-bundle-drift: success` at `3327a4f` as ROBUST-04 satisfied
for Phase 9.

### OPEN, `human_needed` at the merge

**1. VER-06 -- the cross-OS read-back.**

| | |
|---|---|
| Status | **OPEN. `human_needed`. NOT closed by this phase and no check in this phase claims it.** |
| Why not observable earlier | `ci.yml:3-7` filters `push` to `main`, and BOTH dogfood jobs are `if: github.event_name == 'push'` (`ci.yml:802`, `:853`). Neither runs on this branch nor on any pull request -- observed `skipped` in run `30372679674` above. |
| Where it is read | The first push to `main` after this branch merges: `dogfood-seed` (ubuntu-24.04-arm, SINGLE leg) followed by `dogfood-verify` (two-leg matrix `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`, `timeout-minutes: 20`). |
| What closes it | A green **`windows-11-arm`** `dogfood-verify` leg. A MISS or a byte-mismatch calls `core.setFailed`, so **a MISS fails the job and a green Windows leg IS the proof** -- no log reading is required beyond confirming both legs actually RAN rather than skipped. |
| The confirming log line | `github-cache dogfood verify: cache HIT for <run_id> on windows with bytes matching a 'linux'-produced payload.` (recorded by plan 09-05.) |
| Sampling rate | Every push to `main`. Unlike OBS-04 this one is re-samplable, so a first push that is inconclusive for an unrelated reason is recoverable. |
| If the Windows leg goes RED | That is a **REAL RESULT, not a setup problem.** The runner combination is already proven in-repo -- `publish` runs `npm ci` + `npm run build` + `uses: ./packages/github-cache` on `windows-11-arm` today. The MISS message names both hypotheses (cross-OS extraction failing vs the archive version still differing) so the failure is diagnosable. |

**2. OBS-04 -- the one-time rotation signal.**

| | |
|---|---|
| Status | **OPEN. `human_needed`. NOT closed by this phase and no check in this phase claims it.** |
| Why not observable earlier | Same gate: `publish` is `if: ${{ !cancelled() && github.event_name == 'push' }}` (`ci.yml:1004`), observed `skipped` in run `30372679674`. |
| Where it is read | The `publish` job summary on the **FIRST** push to `main` after the merge, on **BOTH** matrix legs (`ubuntu-24.04-arm` and `windows-11-arm`, `max-parallel: 1`). |
| What it is checked against | `09-ROTATION-SIGNAL.md`, committed in wave 1 at **`e7018d0`** -- deliberately BEFORE `47597a6`, the commit that changed `getCacheVersion`'s input. `git merge-base --is-ancestor e7018d0 47597a6` succeeds, so "recorded in advance" is a fact about git history rather than a claim. |
| Expected signal | A **BOTH-LEGS all-MISS**: per leg, `scanned > 0`, `mirrored == 0`, `skipped == scanned`, `restore-MISS (of skipped) == scanned`, `failed == 0`, plus exactly one `core.warning` containing `restored as a MISS`. |
| ONCE ONLY | The signal exists on **exactly one run** and cannot be re-sampled -- the next push is a normal all-HIT push. A `scanned == 0` run does not satisfy it either: the warning's branch requires `hashes.length > 0` (`publish-mirror.ts:300`), so a zero-scan run means the prediction was never SAMPLED and the one opportunity is gone. This is why recording it in advance was a control rather than paperwork. |
| The diagnostic that is NOT this event | A **WINDOWS-ONLY** miss means VER-03 landed WITHOUT VER-01. `@actions/cache` 6.2.0 `cacheUtils.js:166` pushes the `windows-only` component only when `process.platform === 'win32' && !enableCrossOsArchive`, while the path components (`:159`) and the compression method (`:162-163`) are pushed UNCONDITIONALLY. So the flag alone rotates only Windows entries; a symmetric both-legs miss comes from the PATH. Do not rationalise an asymmetry as "the rotation, arriving unevenly". |
| The other misreading | An all-MISS is this event only if `47597a6` is in the range **AND** `action-bundle-drift` was green on the merge. A `serve()`-reachable edit reaching `main` without the rebuilt `start-cache-server/index.js` produces an identical-looking all-MISS on a run where it is a DEFECT. |

### AVAILABLE pre-merge, NOT YET SAMPLED for this phase's code

**3. ROBUST-04 -- `action-bundle-drift`.**

- The job is at `ci.yml:99-114` and carries **no `if:` gate**, so it DOES run on pull requests.
  (Note: prior artifacts in this phase cite the range as `:99-116`; the job body ends at `:114`
  and `:116` is the next job's comment. See `## Recorded corrections`.)
- **Last observed:** `success` in run `30372679674` -- but at `3327a4f`, Phase 8's tree. This
  phase's `serve()`-reachable edits (09-03's `cache-archive-path.ts` and
  `actions-cache-backend.ts`, and the regenerated bundle in the same commit `47597a6`) have
  **never been through this job on a runner.**
- **Closes:** on the next push of this branch, which updates PR #9. Before the merge.
- **The caveat that makes it load-bearing:** a green `dogfood-verify` is **NOT** ROBUST-04
  evidence. Both dogfood jobs use `uses: ./packages/github-cache`, whose `dist/action/index.js`
  is built from source in-job; they never execute the committed `start-cache-server/index.js`,
  which is what four of the five sidecar sites run. `action-bundle-drift` is the only control
  tying them together.
- **Locally at `47597a6`, `npm run check:action` exited 0 with an EMPTY diff** on a tree whose
  `node_modules` came from `npm ci` rather than a junction (09-03). That is a real measurement and
  it is the best pre-merge evidence available, but it is a workstation measurement, not this job.

**4. VER-04 -- the cwd / `GITHUB_WORKSPACE` identity on a real Windows runner.**

- Already MEASURED on 2026-07-26 (`research/v0.0.2/PROBE-RESULTS.md` Q2): the identity HOLDS on
  both runners today. This phase makes it ENFORCED rather than assumed, so the guard is a drift
  guard rather than a live fix.
- `integration` is a two-leg matrix with no push gate, so its Windows leg exercises the guard on
  every pull request.
- **Last observed:** `integration (windows-11-arm)` and `integration (ubuntu-24.04-arm)` both
  `success` in run `30372679674` -- again at `3327a4f`, i.e. BEFORE the construction-time guard
  existed. The guard has therefore **not yet been exercised on a real Windows runner.**
- **Closes:** on the next push of this branch. A guard that throws where the identity actually
  holds would fail the Windows `integration` leg loudly, which is the signal to watch.

### INFORMATIONAL, push-gated, deliberately NOT a gate

**5. VER-05 -- the resolved compression method per runner image.**

- Read from BOTH `publish` legs' job summaries after the merge: the line
  `compression method (@actions/cache): <value>` (also emitted to `core.info`).
- **Surfaced, never gated.** No branch anywhere reads this value, so a surprising value is a
  FINDING to record rather than a failure. Recording it matters because `getCacheVersion` pushes
  the compression method unconditionally (`cacheUtils.js:162-163`), so two runners that disagree
  about zstd disagree about the cache version no matter what `enableCrossOsArchive` says -- it is
  the one axis VER-01 and VER-03 cannot rescue.
- VER-05's own CORRECTNESS is fully closed pre-merge by the eight-case fixture matrix plus four
  observed mutations (09-04), so this requirement leaves **no `human_needed` item**; only the
  observed VALUE is post-merge.

### The nine-command battery

This plan is documentation-only and its commit touches one file under `.planning/`, which is
prettier-ignored (`.prettierignore`) and is an input to no Nx target. `npm run format:check` exits
0 here. The remaining eight were NOT run in this worktree -- see the SUMMARY's Deviations for the
reason, which is the same one 09-01 measured: `check:action` is MUTATING and manufactures a
false 689-line bundle drift when run against a shared `node_modules`.

**Carry-forward:** run the full nine-command battery once on the MAIN tree at the merge commit,
where `node_modules` legitimately lives and `check:action` is a meaningful, non-racing check. This
repeats 09-01's and 09-02's identical recommendation; it is not a new item.

### The unattributed `test` failure

**It did NOT recur in this phase.** All six prior plans report their batteries green
(`09-01`..`09-06`), and every RED test run in this phase was deliberate: TDD RED gates and the
mutation tests, each recorded with its verbatim failure in the owning SUMMARY.

Phase 8's item stays OPEN and unattributed:
`.planning/phases/08-nx-task-hash-parity/deferred-items.md` item 1, one `npm run test` exit 1 at
commit `69bd1b7` whose output was destroyed by the re-run. Nothing in this phase makes it
actionable. The standing instruction still applies: **capture the output BEFORE re-running.**

---

## Recorded corrections

Every miscount, stale citation and position drift this phase encountered, **recorded rather than
silently fixed**, so the verifier and the milestone audit's three-source cross-reference can
reconcile a cited number with the real location instead of reading a content-located edit as
unauthorised drift (T-09-57).

Each item below was **re-verified against the tree at `72eeca3` while writing this record**, not
copied from a prior artifact. Two of the corrections this plan was handed were themselves stale
and are corrected here: items A6 and C1.

### Group A -- requirement counts and traceability

**A1. The requirement list is ELEVEN, and the tooling returns NINE.**
`gsd-tools query init.plan-phase 9` returns
`PARITY-08, VER-01..VER-07, ROBUST-04` -- nine. `OBS-04` and `DOCS-08` are silently dropped
because ROADMAP.md's `**Requirements**:` line for Phase 9 **wraps across `:256-257`**, with
`OBS-04, DOCS-08.` alone on the continuation line, and the query stops at the newline. Verified
at `72eeca3`. Phase 8 lost `CORR-03`/`CORR-04` to the identical defect
(`08-LEARNINGS.md`). The authoritative list is
`PARITY-08, VER-01, VER-02, VER-03, VER-04, VER-05, VER-06, VER-07, ROBUST-04, OBS-04, DOCS-08`.

**A2. ROADMAP.md is wrong twice more for this phase, and D-00's own citations for those two have
drifted.**

| Claim | D-00 cites | Measured at `72eeca3` | Verdict |
|---|---|---|---|
| Per-phase count | `ROADMAP:575` | `ROADMAP:583`, `- Phase 9: 8` | count WRONG (8, not 11); D-00's line number now off by 8 |
| Traceability rows | `ROADMAP:537-544` | `ROADMAP:545-552`, eight rows | rows INCOMPLETE (omit `PARITY-08`, `VER-07`, `ROBUST-04`); D-00's range now off by 8 |
| REQUIREMENTS rows | `REQUIREMENTS:628-638` | `:628-638`, eleven rows | ACCURATE, still |
| REQUIREMENTS count | `REQUIREMENTS:663-665` | `:663-665`, `Phase 9 = 11` | ACCURATE, still |

REQUIREMENTS.md is self-consistent at eleven. **Coverage was audited against REQUIREMENTS.md's
own words throughout** (D-28), which is how Phase 8 caught ROADMAP's stale PARITY numbering and
why `init.plan-phase`'s nine-ID answer was never trusted.

**A3. ROBUST-04's sidecar-job count is FIVE, not four -- and the same sentence carries a second
error.**

- `REQUIREMENTS.md:332-339` (the word "four" on `:334`) and ROADMAP SC1d (`:284-287`, "four" on
  `:285`) both say four. Prior artifacts cite `REQUIREMENTS.md:335` and `ROADMAP:286`; both are
  off by one now.
- There are **FIVE**: `ci.yml:236`, `:310`, `:357`, `:437`, `:935`. Two of those five drifted
  during THIS phase (previously recorded as `:432` and `:895`) because 09-05 and 09-06 added lines
  above them. `integration` is a two-leg matrix, so it is **six job-legs**.
- **Second error, same sentence:** `REQUIREMENTS.md:338` says `action-bundle-drift` "catches it,
  but only on push". It does NOT. The job at `ci.yml:99-114` carries **no `if:` gate**, so it runs
  on pull requests -- which is the entire reason ROBUST-04 is the one control in this phase that
  is available before the merge (C-06). Recording this because the requirement's own text argues
  against the pre-merge availability the phase depends on. Note also that this phase's artifacts
  cite the job as `ci.yml:99-116`; the body ends at `:114` and `:116` opens the next job's
  comment.

**A4. DOCS-08's site count: four named, six touched.**
DOCS-08 (`REQUIREMENTS.md:461-469`) names FOUR sites-in-scope. The real shape is **three
corrections plus three additive preconditions = six sites touched**, and `docs/advanced.md:45`
fails DOCS-08's OWN membership criterion for a correction: it asserts fault degradation, not
same-OS restore, which DOCS-08 explicitly says must not be "corrected as though it were wrong"
(D-32). `DOCS_08_SITES` in `docs-same-os-claims.spec.ts` carries six rows (verified: six
`bucket:` fields) with the miscount comment-locked, following Phase 7's `CORR_05_SITES`
precedent.

**A5. The construction census: 17 direct / 21 total across THREE files.**
`09-RESEARCH.md` says 15 constructions in `actions-cache-backend.spec.ts` and 16 overall while
listing sixteen line numbers, and marks `select-backend.spec.ts` "probably". Measured by 09-03:
**17 direct** and **21 total across THREE files**, with `select-backend.spec.ts` **CONFIRMED**.
Re-verified here: `enterWorkspaceRootCwd` is imported by exactly three spec files --
`backend/actions-cache-backend.spec.ts`, `lib/select-backend.spec.ts`, `serve.spec.ts` --
plus its own definition in `test/workspace-root-cwd.ts`. `publish-mirror.spec.ts` module-mocks
the factory and correctly did NOT get the hook.

**A6. `packages/github-cache/project.json` EXISTS -- and the correction handed down about WHICH
decisions assert otherwise was itself wrong.**

The file exists (tracked since `7413363`, declaring `integration`), so PARITY-08's
merged-configuration guard depends on it.

The premise it falsifies belongs to **Phase 8's D-12 ONLY** (`08-CONTEXT.md:111`: "No
`project.json` (the workspace is deliberately free of them)"). **Phase 7's D-02 does NOT assert
it** -- `07-CONTEXT.md:48-54` D-02 is the five exact-pinned root devDependencies. The Phase 7
decision that mentions the file is **D-01** (`:35-46`), and it states it CORRECTLY ("beside the
existing `integration` target in `packages/github-cache/project.json`").

So: ONE locked decision is falsified, not two. The misattribution originates in **`09-CONTEXT.md`
D-24's corollary at `:296-297`**, which still carries it verbatim; 09-01's plan inherited it and
09-01's executor caught it before writing it into the very comment block whose purpose is
preventing false records. It is recorded here because the corollary is still on disk and a later
reader will meet it again.

**A7. The `@actions/cache` bump checklist VER-05 and D-13 both name DOES NOT EXIST.**
Zero hits repo-wide. The note ("re-read `getCompressionMethod`; VER-05 duplicates it") went above
the `@actions/cache` assertion in `pinned-deps.spec.ts` instead -- the line a bumper cannot avoid
editing. The requirement's dangling reference is recorded in that comment rather than treated as
satisfied.

**A8. U-01 is CLOSED and D-01 STANDS.**
Nx **23.1.0** tolerates a foreign `.tar` under `.nx/cache` on every axis measured: the `build`
hash was byte-identical across four runs with a 5 MB `.tar` present, `getCacheSize()` excluded it
(so it cannot drive eviction), the CI-only `assertCacheIsValid` warning did not fire, and
`nx reset` still clears it. A positive control (`zz-stray-probe.txt`) DID move the hash, so the
instrument fires. The Nx version is recorded beside the literal's comment lock
(`cache-archive-path.ts:72`, `CACHE_ARCHIVE_DIR = '.nx/cache'`).

### Group B -- instruments and methods

**B1. A `toEqual`/`toStrictEqual` rationale was MEASURED FALSE.**
The claim "`toEqual` treats a trailing `undefined` as absent, so it would ACCEPT a shorter array
whose missing tail is the flag" does **not** hold on **vitest 4.1.10**: `toEqual` runs `equals`
with `hasDefinedKey` (`@vitest/expect/dist/index.js:213,408`), which compares the COUNT of
defined keys, and `iterableEquality` catches an extra trailing `undefined` too. All eight
argument shapes the clause could see were probed directly and **both matchers returned the SAME
verdict on every one.** The actually load-bearing choice is asserting the WHOLE array rather than
indexing single positions. `toStrictEqual` is kept for what it genuinely adds (type/class
identity, sparse-array holes). The measurement and the plausible-but-wrong assumption are both
comment-locked at `actions-cache-backend.spec.ts:414-430`, verified present here.

**B2. Wrong-instrument acceptance criteria -- hit THREE times in this phase.**

- **`git grep` returns a FALSE ZERO on untracked and gitignored paths, and it reads exactly like
  confirmation.** 09-04 nearly banked an absence claim this way: the criterion "shows no read of
  the result's exit-code or error field" was first checked with `git grep` while
  `compression-method.ts` was still untracked. Re-verified with `rg`. Any absence claim in this
  repo must name its instrument.
- **`git grep -c` counts LINES, not occurrences.** 09-05's criterion expected
  `git grep -c "dogfoodBody" -- action/index.ts` to return 2; it returns **4** (import,
  explanatory comment, two calls) -- re-verified as 4 at `72eeca3`. The intent held; the
  instrument was wrong. `git grep -n "dogfoodBody("` is the right one.
- 09-06 met the same trap on `git grep -c "differen" -- publish-mirror.ts` and **sidestepped it
  rather than reinterpreting it**: the reword avoids the token entirely (SEPARATE/distinct), so
  the command genuinely returns no match and the criterion reads cleanly.

**B3. `npm run typecheck` catches what tests structurally cannot.**
09-06 hit a real `TS2339` -- an `as const` producing union members that lacked `forbidden`, so
destructuring it in the loop did not compile -- while **all 663 tests were green**, because vitest
transpiles without type-checking. Recorded as a verification-method note: a green `test` is not a
type gate, and the nine-command battery's `typecheck` / `typecheck:action` entries are not
redundant with it. Fix verified present: three explicit `forbidden: []` rows at
`docs-same-os-claims.spec.ts:122,136,149`.

**B4. `T-09-45` cites the wrong anti-pattern.**
`09-06-PLAN.md:496` cites "PATTERNS anti-pattern 10" as naming the matrix-justification coupling.
Anti-pattern 10 (`09-PATTERNS.md:791`) is **"Over-correcting DOCS-08 site 3"**. The coupling is
named in RESEARCH Q10's closing paragraph on site 2 and in that plan's own `key_links`. **Both
constraints were honoured; only the citation is wrong.**

### Group C -- position drift caused by this phase's own edits

Locate by CONTENT, never by these numbers. They are recorded so a later audit can reconcile a
citation, not so it can be trusted.

**C1. `dogfoodBody`'s call sites moved TWICE, and the correction handed to this plan describes
the middle state.**

| Stage | Shape | Source |
|---|---|---|
| As cited | TWO calls, `action/index.ts:224` and `:276` | `09-CONTEXT.md` canonical-refs |
| C-01's measurement | ONE call at `:224`; `:276` is `received.equals(body)`, a reuse of that buffer | `09-RESEARCH.md` C-01 |
| After 09-04 | ONE call at `:265` (09-04's insertions shifted it) | `09-05-SUMMARY.md` |
| **At `72eeca3`, measured here** | **TWO calls, `:286` and `:329`** | `git grep -n "dogfoodBody("` |

The two calls today are NOT the two the canonical-refs line meant. 09-05 (D-19, C-01) moved the
single pre-branch call INTO each branch so the seed leg's `cachePlatform()` and the verify leg's
literal `'linux'` stay physically apart; a comment where the old call sat records that hoisting
them back together reintroduces the coupling that makes the vacuity trap reachable.

Relatedly: `action/index.spec.ts` has **ONE** hand-authored dogfood payload literal, not three
(the other two verify tests use `null` and `'wrong-bytes'`). It is at **`:226`** and now reads
`nx-github-cache-dogfood:linux:run-1` -- 09-05 recorded it at `:221` before its own added
assertions shifted it.

**C2. The three `@actions/cache` call sites.**
D-09's table cites `actions-cache-backend.ts:46`, `:101`, `:107`. Measured at `72eeca3`:
`restoreCache` at **`:141`**, `saveCache` at **`:215`**, the `lookupOnly` probe at **`:236`**. The
shift is 09-03's construction-time guard, `mkdirSync` and comment locks. The positional indices
themselves are unchanged and asserted (5th / 4th / 5th), and `saveCache`'s JSDoc really is
inverted relative to its signature.

**C3. `resolveCompressionMethod()`'s call site.**
Imported at `action/index.ts:16`, called at **`:184`** (some briefs say `:183`). Exactly one
import site, which is the structural proof of D-17 that keeps the probe out of the bundle graph.

**C4. `ci.yml` drift, cumulative.**
Phase 8 inserted `hash-parity` and `hash-parity-compare` (now at `:578` and `:747`), so
REQUIREMENTS' cited `ci.yml:577-583` lands INSIDE the hash-parity job. This phase then moved
things again: `dogfood-seed:` is at `:799` and `dogfood-verify:` at `:822`; the publish-matrix
comment 09-06 corrected is at `:983-1002` (RESEARCH Q10 said `:947`, 09-06 measured `:982`);
`publish:` at `:1003`; `publish-verify:` at `:1112` with its untouched own-OS-asset comment at
`:1104`. **Every DOCS-08 site was located by PHRASE**, which is why `DOCS_08_SITES` is keyed on
FILE plus QUOTED PHRASE -- the six edits shift each other's lines within one commit.

### Two facts a future reader would otherwise misread

1. **This phase's commit `47597a6` is the milestone's rotation window 2 of 3** (Phase 7's inferred
   `lint` target was 1; Phase 10's CORR-02 asset rename is 3). Its all-MISS push is EXPECTED, and
   **no tripwire authored in this phase may fire on it** (D-30). The three windows are three
   different mechanisms on two different axes -- Nx TASK hash, `@actions/cache` cache VERSION,
   Release ASSET NAME -- which is why the reworded warning names its axis rather than saying
   "rotation".

2. **The both-legs all-MISS comes from the PATH change, not from `enableCrossOsArchive`** --
   which alone rotates only WINDOWS entries, because `cacheUtils.js:166` pushes the `windows-only`
   component only under `process.platform === 'win32' && !enableCrossOsArchive`, while the path
   components (`:159`) and the compression method (`:162-163`) are pushed unconditionally.
   Getting this backwards in either direction is the misdiagnosis D-29 exists to prevent.

### A note on TDD gate compliance across the phase

Three plans -- 09-03, 09-05, 09-06 -- carry plan-imposed ONE-COMMIT constraints and therefore
have **no separate `test(...)` RED commit**. Each recorded a `## TDD Gate Compliance` exception
with its reason and each achieved **assertion-level RED** (named tests failing on their own
merits, with the suite running to completion) rather than an import failure. The reasons are
substantive, not convenience: for 09-03 a split would have given the milestone a FOURTH rotation
window where D-30 says three and `09-ROTATION-SIGNAL.md` says "expected once"; for 09-05 a
RED-only commit would not typecheck (9 x `TS2554`); for 09-06 the guard's required phrases assert
text that only exists after the six doc edits. 09-01 and 09-02 are single documentation/config
tasks; 09-04 carried no such constraint and did the normal two-commit RED -> GREEN
(`183bdb7` -> `0999bd8`).

**The maintainer has reviewed this and accepted it as a documented exception.** Recorded here so
the phase-level gate scanner meets the record rather than discovering a gap.

---

*Phase: 09-os-invariant-actions-cache-version*
*Snapshot captured: 2026-07-28T20:30:55Z, at commit `72eeca3`, before the merge to `main`*




