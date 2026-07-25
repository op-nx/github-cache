# Quick Task 260725-w3s: Research -- verifying local Nx cache HITs

**Researched:** 2026-07-25 (Windows 11 arm64, branch `gsd/quick-260725-rk4-dogfood-ci`, Nx 23.1.0, Node 24.13.0)
**Scope:** how to RUN the verification correctly and how to INTERPRET it honestly. Every
claim below was measured on this machine, not inferred from source alone.

Takes CONTEXT.md's mirror-contents evidence as given. Proposes no fixes (verify-only lock).

---

## 1. The exact local invocation -- validated end to end

`selectBackend` needs nothing configured. `isWriteTrusted` returns
`{trusted:false, reason:'not-ci'}` the moment `GITHUB_ACTIONS !== 'true'`
(`trust.ts:82`), so the untrusted branch returns the real Releases reader
(`select-backend.ts:40`). The empty in-memory backend is unreachable locally -- it
only exists on a *trusted* trigger with no token. Confirmed: `GITHUB_ACTIONS`,
`GH_TOKEN`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY` are all UNSET in this shell.

The sidecar must be a **separate process** (`serve()` never returns). The shipped bin
is `github-cache -> ./dist/serve.js` (`packages/github-cache/package.json`), and
`dist/serve.js` is present and current. Launch it directly -- that IS the shipped
surface, entry guard and all:

```bash
PORT=41999 NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<throwaway> \
  node packages/github-cache/dist/serve.js  >sidecar.out 2>sidecar.err &
```

Then point Nx at it with the two client vars, which must EXACTLY match the port and
token the sidecar bound:

```
NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:41999
NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<same throwaway>
```

Set the token yourself rather than scraping it from `sidecar.out` -- `serve.ts:192`
prints `bearer token: <token>` to stdout, and pre-setting it avoids handling that line.
`resolvePort` silently falls back to an OS-assigned port on a bad `PORT`, which would
mismatch a fixed URL and MISS everything (`serve.ts:51`).

**Measured (smoke test, this machine):** sidecar bound `http://127.0.0.1:41999`;
wrong bearer -> `401`; correct bearer + a real task hash -> `404` (a MISS); a cold
`nx run @op-nx/github-cache:build` through it reported `Cache: 0/1 hit (0%)` with no
cache label. The wiring works; the store is empty.

**How to confirm which backend was selected:** there is no direct probe. The
authenticated-`404`-not-`401` pair above is the practical one: a `404` on a valid
bearer proves the request reached a backend `get` and that backend returned a MISS.
Structurally, only the reader can be selected off-CI.

---

## 2. Making a MISS diagnosable -- the sidecar tells you almost nothing

**The sidecar's only two output channels** (`git grep` over server.ts / serve.ts /
releases-backend.ts / local-context.ts):

- `serve.ts:191-192` -- two startup lines on stdout.
- `releases-backend.ts:50` -- the `warnOnce` line on **stderr**.

There is **no request logging**. The sidecar cannot tell you which hashes Nx asked
for. Capture stderr to a file; it is the only fault channel.

**What `warnOnce` fires on:** only a *thrown* fault reaching the port catch
(`releases-backend.ts:95`) -- i.e. any non-404 status from `assertOkOrAbsent`
(401/403/429/5xx), a DNS failure, or a `FETCH_TIMEOUT_MS`/`DOWNLOAD_TIMEOUT_MS`
abort. It prints the numeric HTTP status when present.

**What it does NOT fire on -- three silent MISS causes, indistinguishable from each
other and from a genuine absence:**

1. **Asset genuinely absent** -- 404 on the shard or the asset name -> `undefined`, silent.
2. **No token resolved** -- `fetchAsset` returns `undefined` with **zero fetches**
   (`releases-backend.ts:306`). Silent.
3. **No repo identity resolved** -- same, `releases-backend.ts:316`. Silent.

It is also **once per process** (module-level `warned` flag), so one sidecar serving a
4-target `run-many` emits at most ONE warning. To get a per-target fault signal you
would have to restart the sidecar between targets.

**So the attribution must be assembled from outside the sidecar. Four signals, all
verified working here:**

| Signal | Rules out | Measured result |
|---|---|---|
| `tier-probe` (reader's exact `spawn` shape, `shell:false`) | cause 2 and 3 | `gh auth token` -> **RESOLVES** (exit 0, non-empty stdout); `git remote get-url origin` -> **RESOLVES** |
| `gh api` probe of the shard + asset name | cause 1 (confirms it positively) | shard `cache-mirror-202607` -> **200**, id 354838660, 79 assets; every candidate asset name -> **ABSENT** |
| sidecar `stderr` empty | every non-404 fault (auth, rate limit, timeout) | **EMPTY** after a full run |
| Nx's own end-of-run report | the verdict itself | see section 4 |

Tier 2 resolving is worth stating explicitly: Node's `spawn(..., {shell:false})` does
no PATHEXT resolution on Windows, so a `.cmd`-shimmed `gh` would have silently yielded
nothing. It was probed through the reader's literal `runHelper` options and resolves,
so that hazard is not in play here.

With all four in hand, a MISS is attributable to genuine absence -- no instrumentation,
no source changes.

---

## 3. Shard window -- NOT a fourth reason for a miss

`resolveMaxAgeDays` default 30 -> `shardTagsForWindow(30, 2026-07-25T21:12Z)` =
**`[cache-mirror-202607, cache-mirror-202606]`** (computed from the real
`retention.ts` arithmetic). The only populated shard is **first** in the walk.

- `cache-mirror-202607` -> HTTP 200 (present).
- `cache-mirror-202606` -> HTTP **404** (absent), so the walk's
  404-advances-to-next-shard path terminates cleanly on an exhausted window.
- Month-boundary check: on 2026-08-01 the window becomes
  `[cache-mirror-202608, cache-mirror-202607]`, so 202607 stays reachable.

**Conclusion: the window is not a fourth cause.** CONTEXT.md's three stacked reasons
remain the complete list.

---

## 4. Measurement pitfalls -- read this before running anything

### 4a. `Cache: n/m hit` cannot distinguish local from remote. Proven.

`performance-analysis.js:14` -- `CACHE_HIT_STATUSES` is
`{local-cache, local-cache-kept-existing, remote-cache}`. The percentage counts them
identically. **Measured:** a warm-local `nx run ...:build` printed
`Cache: 1/1 hit (100%)` with `[local cache]` on the task line. A non-zero
`Cache:` line is therefore NOT evidence of a remote consult either -- this extends
CONTEXT.md's warning, which only covered the `0/1` direction.

**The `[remote cache]` label on the task line is the only discriminating signal.** It
is rendered via `output.logCommandOutput -> addTaskStatus` (`output.js:229-235`) and it
**does print in this non-TTY shell**, for both `run` and `run-many` -- confirmed by
observing `[local cache]` live. `cache.js:71-99` is the mechanism: local SQL lookup
first, remote consulted only on a local miss, and `remote: true/false` sets the label.

### 4b. `--skip-nx-cache` is wrong, and `NX_CACHE_DIRECTORY` alone does NOT work

`--skip-nx-cache` disables the remote too. But the obvious alternative also fails:

**Measured -- `NX_CACHE_DIRECTORY=<fresh tmp>` alone still reported
`[local cache]` + `Cache: 1/1 hit (100%)`.** Reason: the cache RECORDS live in the
SQLite DB under `.nx/workspace-data/<uuid>-v3.db`, which is governed by
`NX_WORKSPACE_DATA_DIRECTORY` / `NX_PROJECT_GRAPH_CACHE_DIRECTORY`, **not** by
`NX_CACHE_DIRECTORY` (`db-connection.js:44`, `cache-directory.js:82`).
`NX_CACHE_DIRECTORY` only moves the artifact tree.

By the same mechanism, **`nx reset --onlyCache` should also fail to cold-start** -- it
only `rmSync`s `cacheDir` (`reset.js:135`) and leaves the DB. Inferred from the same
mechanism, not separately measured.

**What works -- measured:** both dirs fresh gives a genuine cold local cache
(no label, `Cache: 0/1 hit (0%)`, command actually ran), and mutates nothing under the
real `.nx/`:

```bash
NX_CACHE_DIRECTORY=<tmp>/nxcache NX_WORKSPACE_DATA_DIRECTORY=<tmp>/nxdata npx nx ...
```

### 4c. THE TRAP: that recipe changes the task hash under test

**Measured on this one machine, at one commit, same OS:**

| `.nx/workspace-data` state | `build` task hash |
|---|---|
| real / warm | `14522047022641658505` |
| fresh temp dir | `13655686526929222562` |

Both are deterministic (two independent fresh runs produced the same value). The warm
value was read authoritatively from the cache DB (`task_details` joined to
`cache_outputs`: `hash=14522047022641658505, target=build, created 2026-07-22 01:00:00,
accessed 2026-07-25 21:14:48` -- the access being this session's warm run).

So the cold-start recipe is not hash-neutral, and **there is no recipe that cold-starts
only the local cache while preserving the warm-state hash** (4b closes that door).

**Recommendation: use the fresh-both-dirs recipe anyway and state the hash you tested.**
It is the more faithful scenario regardless -- a new developer, a fresh clone, and a CI
runner all start with cold workspace-data. Record the hash per target so the result is
checkable.

### 4d. Recording the hash per target

The hash appears as a directory name inside `NX_CACHE_DIRECTORY` after the run, but
unlabelled. Map hash -> target from the run's own DB (copy it first; the daemon holds
the live file):

```
SELECT d.hash, d.target FROM task_details d;   -- in <tmp>/nxdata/<uuid>-v3.db
```

`node:sqlite` (Node 24 builtin, `readOnly: true`) reads it with no extra tooling.

### 4e. `run-many` once, not four separate runs

Both forms print the per-task label, so observability is equivalent -- but four separate
invocations sharing one cache dir would let run N warm the local cache for run N+1 and
mask the remote for `build` (which `typecheck` pulls in). One `run-many` over a single
fresh cache dir makes each task cold exactly once. Use it.

---

## 5. Can the reader be reached per target? Yes -- with one exception

`@op-nx/github-cache` has **zero project dependencies** (verified via `nx graph`:
`"@op-nx/github-cache": []`). So `^build` resolves to **no tasks**, and the
`dependentTasksOutputFiles` inputs resolve to nothing.

| Target | `dependsOn` (resolved) | Tasks in the run | Isolable? |
|---|---|---|---|
| `build` | `["^build"]` -> none | 1 | yes |
| `test` | `["^build"]` -> none | 1 | yes |
| `integration` | `["^build"]` -> none | 1 | yes |
| `typecheck` | **`["build", "^typecheck"]`** | **2** (build + typecheck) | no -- `build` always joins |

`typecheck` depends on the **same project's** `build` (not `^build`), which is why CI
reported `typecheck 2/2` rather than 1/1. Verifying `typecheck` in isolation is
impossible; a `run-many` over all four is 4 tasks total with `build` deduped, which
matches the CI shape and is the cleanest single observation.

`test`/`integration` are meaningful in isolation -- no build must run first.

---

## 6. Flagged for the deferred cross-OS parity item (observation only, no fix)

Section 4c is decision-relevant beyond method. STATE.md's Deferred Items row attributes
`14522047022641658505` to **ubuntu** CI and `13655686526929222562` to **windows-11-arm**
CI, and cites the pair as the measurement of cross-OS hash divergence for `build`.
**Both values are reproducible on this single Windows machine by varying only
`.nx/workspace-data` freshness** -- nothing OS-related. That does not disprove the
divergence (CI is always cold, and cold-Windows here equals the recorded cold-Windows
value), but it does mean workspace-data-derived state -- plugin target re-inference,
lockfile re-parse -- is an uncontrolled variable in that evidence.

Not root-caused here; out of scope per the verify-only lock. Worth recording against the
existing row so the parity investigation controls for it.

---

## 7. Ready-to-run sequence

```bash
# 0. Preconditions -- prove the two SILENT causes are not in play, via the
#    reader's own spawn shape. Both must say RESOLVES.
#    (gh auth token / git remote get-url origin, shell:false, 5s timeout)

# 1. Sidecar, separate process, stderr to a file.
PORT=41999 NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=$TOK \
  node packages/github-cache/dist/serve.js >sidecar.out 2>sidecar.err &

# 2. Poll until it answers (401 on a wrong bearer is a fine readiness probe).

# 3. One run-many, cold local cache, nothing under the real .nx/ touched.
NX_CACHE_DIRECTORY=$TMP/nxcache NX_WORKSPACE_DATA_DIRECTORY=$TMP/nxdata \
NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:41999 \
NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=$TOK \
  npx nx run-many -t build typecheck test integration

# 4. Read the verdict: per-task [remote cache] / [local cache] / no label.
#    Ignore the Cache: n/m line for local-vs-remote (4a).

# 5. cat sidecar.err  -- empty means no non-404 fault occurred.

# 6. Recover hash -> target from $TMP/nxdata/<uuid>-v3.db, then probe each
#    <hash>-windows name against the shard:
#    gh api repos/op-nx/github-cache/releases/354838660/assets?per_page=100 --paginate --jq '.[].name'

# 7. Kill the sidecar.
```

Expected per CONTEXT.md: all four MISS, `sidecar.err` empty, every `<hash>-windows`
absent from the shard -- i.e. reason 1 (nothing published in the current naming scheme),
with reasons 2 and 3 unobservable behind it. Report that, and leave the PASS/FAIL
labelling to the maintainer per the UNRESOLVED item.
