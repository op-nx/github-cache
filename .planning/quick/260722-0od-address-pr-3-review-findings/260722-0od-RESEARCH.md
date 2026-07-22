# Quick Task 260722-0od: Address PR #3 review findings - Research

**Researched:** 2026-07-22
**Domain:** Octokit resilience, cross-process temp contention, TS build config, npm packaging, destructive-change guards
**Confidence:** HIGH (Q1, Q3, Q4, Q5) / HIGH (Q2, on the proportionality call)

Scope note: this answers only the five narrow questions in the brief. Everything settled in
`260722-0od-CONTEXT.md` (the 409 fix, the `merge_group` non-defect, the retention floor, the
hash-lock relocation) is LOCKED and not revisited.

---

## Q1. Octokit retry / backoff for transient 429 + 5xx

### Versions to install (exact pins)

| Package | Exact version | Peer requirement | Compatible with `@octokit/rest@22.0.1`? |
|---|---|---|---|
| `@octokit/plugin-retry` | **`8.1.0`** | `@octokit/core >=7` | Yes -- installed `@octokit/core` is `7.0.6` |
| `@octokit/plugin-throttling` | **`11.0.3`** | `@octokit/core ^7.0.0` | Yes -- same |

`[VERIFIED: registry.npmjs.org]` versions, publish dates (retry 8.1.0 = 2026-02-18, throttling
11.0.3 = 2025-10-31), and peer ranges read from the registry documents.
`[VERIFIED: registry.npmjs.org]` neither package declares any `scripts` (no postinstall).
`[VERIFIED: registry.npmjs.org]` **`octokit@5.0.5`** -- the official batteries-included
distribution -- depends on exactly `@octokit/plugin-retry@^8.0.3` + `@octokit/plugin-throttling@^11.0.3`
on `@octokit/core@^7.0.6`. That is the authoritative confirmation that this pairing is the
maintained, upstream-blessed combination for the core 7 line, not a guess.

Add both to `packages/github-cache/package.json` `dependencies` as bare `x.y.z` so
`pinned-deps.spec.ts`'s `EXACT_SEMVER` regex passes. Extend that spec with two more cases
(same shape as the existing `@octokit/rest` case) so the new supply-chain surface is governed
identically.

### What each plugin actually retries (read from published source, not docs)

`[VERIFIED: cdn.jsdelivr.net/npm/@octokit/plugin-retry@8.1.0/dist-src/*]`

```
doNotRetry: [400, 401, 403, 404, 410, 422, 451]
retries:    3
retryAfter: Math.pow((retryCount || 0) + 1, 2)  seconds  x  retryAfterBaseValue (1000ms)
```

- **429 IS retried** by plugin-retry (429 is not in `doNotRetry`).
- **All 5xx are retried.**
- **plugin-retry does NOT honor `Retry-After`.** The delay is a purely computed quadratic
  backoff: 1s, 4s, 9s. Confirmed by reading `error-request.js` -- it never touches
  `error.response.headers`.
- 404 and 422 are in `doNotRetry`, so `ensureShardRelease`'s 404-means-absent /
  422-means-race discrimination keeps working with **zero added latency and no code change**.
  `statusOf(error)` still sees the final status after retries are exhausted.

`[VERIFIED: cdn.jsdelivr.net/npm/@octokit/plugin-throttling@11.0.3/dist-src/index.js]`

- Intercepts **only 403, 429, and GraphQL** faults. It does **not** touch 5xx -- that is
  plugin-retry's job. The two are complementary, which is why upstream ships both.
- **Honors headers:** secondary rate limit -> `retry-after` header, falling back to
  `fallbackSecondaryRateRetryAfter: 60` seconds. Primary rate limit (`x-ratelimit-remaining: 0`)
  -> waits until `x-ratelimit-reset` + 1s.
- **Both callbacks are MANDATORY.** The plugin `throw`s at construction if either
  `onRateLimit` or `onSecondaryRateLimit` is not a function.

### Callback contract

`onRateLimit(retryAfter, options, octokit, retryCount)` and
`onSecondaryRateLimit(retryAfter, options, octokit, retryCount)`.
**Return `true` to retry; return anything falsy (including `undefined`) to give up and let the
error propagate.** `[CITED: github.com/octokit/plugin-throttling.js README]` -- "Return `true`
to automatically retry the request after `retryAfter` seconds."

### Wiring idiom (order is load-bearing)

`[VERIFIED: cdn.jsdelivr.net/npm/octokit@5.0.5/dist-src/octokit.js]` -- upstream composes
`retry` **before** `throttling`. Mirror that exactly:

```ts
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';

const ResilientOctokit = Octokit.plugin(retry, throttling);

const octokit = new ResilientOctokit({
  auth: token,
  throttle: {
    onRateLimit: (retryAfter, options, _octokit, retryCount) => {
      core.warning(
        `github-cache: rate limit on ${options.method} ${options.url}; ` +
          `retrying in ${retryAfter}s (attempt ${retryCount + 1}).`,
      );

      return retryCount < 1;
    },
    onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
      core.warning(
        `github-cache: secondary rate limit on ${options.method} ${options.url}; ` +
          `retrying in ${retryAfter}s (attempt ${retryCount + 1}).`,
      );

      return retryCount < 1;
    },
  },
});
```

`retryCount < 1` (one retry) matches upstream's own default handlers. Never log the token or a
raw workflow-command string -- `options.url` and `options.method` only, consistent with the
existing `core.warning` discipline in `publish-mirror.ts:245`.

Both call sites need this: `src/action/index.ts:156` and `src/cleanup/index.ts:107`. Extract a
single `createResilientOctokit(token)` helper rather than duplicating the throttle block --
the two existing `new Octokit({ auth: token })` lines are otherwise identical.

### Two behavior changes to flag before wiring

1. **plugin-throttling serializes and paces every write.** Its `write` Bottleneck group is
   `{ maxConcurrent: 1, minTime: 1000 }`. `publish-mirror`'s upload loop is already sequential,
   so `maxConcurrent: 1` costs nothing -- but `minTime: 1000` adds **1 second between every
   asset upload**. At the documented 1000-asset shard cap that is up to ~16 minutes of added
   wall-clock on a full shard. Real, bounded, and probably acceptable for a push-only background
   mirror job, but it should be a conscious choice, not a surprise.
2. **The Bottleneck `groups` object is a module-level singleton** shared across every Octokit
   instance in the process. Harmless here (one instance per action process), but it means the
   pacing is process-global, not per-client.

3. **429 is handled by both plugins.** throttling's `retryLimiter` catches it first (honoring
   headers), and plugin-retry's error hook can also retry it. Worst case with the handlers above:
   1 throttled retry + 3 plugin-retry attempts. This doubling-up is exactly what upstream
   `octokit@5.0.5` ships, so it is the sanctioned configuration -- but bound it deliberately via
   `retryCount < 1` rather than leaving the handlers unbounded.

### `ensureShardRelease` whole-run abort

The brief notes `ensureShardRelease` aborts the whole run on any non-404/422 status. Adding
plugin-retry fixes the *transient* half of that for free (429/5xx now retry 3x before the throw
ever fires). The remaining permanent-fault propagation (401/403) is correct as-is -- a token
whose permissions regressed **should** fail loud. No further change recommended there.

---

## Q2. Cross-process temp-path contention

**Recommendation: document the invariant. Do not add a cross-process lock.**

### The exposure is narrower than the finding implies

| Fact | Evidence |
|---|---|
| `packages/github-cache/action.yml` is explicitly INTERNAL-ONLY | Its own header: *"INTERNAL to this repository's CI dogfood ONLY. This is NOT the published, enumerated consumer surface -- that ships as `start-cache-server/action.yml`"* |
| The published consumer action runs `serve()` and nothing else | `start-cache-server/entry.ts` imports only `serve` |
| The `publish` operation has **no consumer-facing entry point at all** | Only reachable via the internal dogfood `action.yml` (`operation: publish`) |
| The documented consumer wiring never colocates the two | `docs/advanced.md:35-60` -- publish/cleanup are *"opt-in and run in CI"*, *"exercised end to end by this repository's own CI as the reference implementation"* |
| This repo's own CI never colocates them | `ci.yml`: `consumer-smoke` backgrounds the sidecar and does NOT publish; `publish` runs `seed` then `publish` as two sequential JS-action steps with no sidecar. `max-parallel: 1` already serializes the OS legs. |

So the exposure requires a consumer to (a) build their own JS action around
`publish/publish-mirror.ts` -- an undocumented, unsupported path -- and (b) run it in the same
job as a backgrounded sidecar, and (c) hit the **same hash** concurrently. That is a
three-condition tail, not a live defect.

### The failure mode (for the doc comment)

`cacheArchivePath(hash)` is deterministic. `actions-cache-backend.get` does
`restoreCache -> readFile -> rm(path)` and `put` does `writeFile -> saveCache -> rm(path)`,
both with `rm` in a `finally`. Two processes on the same hash can therefore:
- have the publisher's `get`-path `rm` delete the archive the sidecar's `put` just wrote,
  *before* `saveCache` reads it -> a silently dropped write; or
- have the sidecar's `writeFile` overwrite the archive the publisher's `readFile` is reading
  -> wrong bytes mirrored.

### Why not a lockfile

| Option | Verdict |
|---|---|
| Per-process unique path | **Unavailable.** `cache-archive-path.ts:11-17` is comment-locked; @actions/cache version-hashes the literal path string, so any change silently MISSes every restore. |
| `proper-lockfile` | A new runtime dependency on the *published* package, for a path no consumer can reach. Fails ponytail rung 5 outright. |
| `fs.mkdir` (atomic on both platforms) or `open(..., 'wx')` | No new dep, but still needs stale-lock detection, a crash-recovery TTL, and a wedge story. On Windows the classic `wx`-plus-`unlink` pattern is additionally exposed to sharing-violation retries. |
| **Document the invariant** | Zero code, zero deps, zero new failure modes. |

Every lock design here introduces a *new* way for the cache to silently stop working (a stale
lock wedging `put` forever) in exchange for closing a path no supported deployment reaches --
the same trade CONTEXT.md already rejected for the cleanup ratio breaker.

### Concrete recommendation

Add a `ponytail:`-style comment block to `cache-archive-path.ts` (next to the existing
comment-lock) naming the invariant, with the ceiling and the upgrade path:

> **Cross-process invariant.** This path is deterministic per hash and shared by every process
> using this backend. `withHashLock` is in-process only and cannot serialize across processes.
> Callers MUST NOT run `serve()` and `publishMirror()` concurrently in the same job/container --
> the documented wiring runs publish as a separate sequential step (`docs/advanced.md`), and this
> repo's `ci.yml` does the same. A per-process unique path is NOT available: @actions/cache
> version-hashes this literal string. If a colocated deployment ever becomes supported, the
> upgrade path is a cross-process advisory lock keyed on the hash (`fs.mkdir` sentinel + TTL),
> not a different path.

Then add one line to `docs/advanced.md`'s Publish/sync bullet stating publish must not share a
job with a running sidecar.

`[ASSUMED]` -- I did not survey Node lockfile libraries in depth, because the recommendation is
not to use one. If the planner overrides this call, `proper-lockfile` is the ecosystem default
and does work cross-platform, but I have not verified its current version or maintenance status.

---

## Q3. Type-checking `start-cache-server/entry.ts`

**Verified working end-to-end in this workspace.** I created the config below, ran it, and
confirmed both the clean pass and a deliberate-error failure, then removed the probe files.
`git status` is clean.

### Is the rootDir exclusion a real constraint? No.

`tsconfig.lib.json` sets `rootDir: "src"`, which *does* forbid including `../../start-cache-server/entry.ts`
in that project. But that only rules out extending the *existing* config. A **separate,
non-composite, `noEmit` config at the repo root** has no rootDir constraint at all, because it
emits nothing.

### The config (new file: `tsconfig.action.json` at the repo root)

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "declarationMap": false,
    "emitDeclarationOnly": false,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["start-cache-server/entry.ts"]
}
```

All four `compilerOptions` overrides are load-bearing against `tsconfig.base.json`:
`composite: true` forbids `noEmit`; `declarationMap: true` requires `declaration`/`composite`;
`emitDeclarationOnly: true` conflicts with `noEmit`. `types: ["node"]` narrows the base's
`types: ["*"]` (vitest globals are irrelevant here).

`[VERIFIED: local run]` `npx tsc -p tsconfig.action.json` -> exit 0.
`[VERIFIED: local run]` `--listFiles` shows the program pulls in exactly the esbuild-reachable
graph: `entry.ts`, `serve.ts`, `server/server.ts`, `lib/trust.ts`, `lib/select-backend.ts`,
`lib/with-hash-lock.ts`, `lib/cache-archive-path.ts`, `lib/cache-key.ts`, all three backends,
plus `@actions/core` and `@actions/cache` types. That is the same reachability set the bundle
inlines -- so this closes the gap for the whole bundle, not just the entry file.
`[VERIFIED: local run]` a deliberate type error in an included file produces
`error TS2322` and exit code 2 -- `noEmit` does not suppress diagnostics.

**Bonus:** under `moduleResolution: nodenext`, `start-cache-server/` resolves as CommonJS (no
`"type": "module"` in the root manifest), which *matches* esbuild's `format: 'cjs'` output. A
top-level-await regression in `entry.ts` now fails typecheck with `TS1309` instead of producing
a broken bundle.

### Does it break the bundle or the byte-diff? No.

`noEmit: true` writes nothing. `esbuild.action.mjs` is untouched. `start-cache-server/index.js`
is byte-identical. `npm run check:action` is unaffected.

### Nx / CI wiring

`[VERIFIED: nx show project]` neither project has a target that would pick this file up:
`@op-nx/github-cache`'s `typecheck` is `tsc --build tsconfig.json` scoped to the package;
`@op-nx/source` (the workspace root) has **`"targets": {}`** -- no targets at all. So a new root
`tsconfig.action.json` is inert until wired explicitly. `@nx/js/typescript` will not infer a
target for it.

Laziest wiring that stays inside existing conventions -- one npm script, one CI line:

```jsonc
// package.json scripts
"typecheck:action": "tsc -p tsconfig.action.json",
```

```yaml
# .github/workflows/ci.yml, in the existing action-bundle-drift job
      - run: npm run check:action
      - run: npm run typecheck:action   # <- add
```

Putting it in `action-bundle-drift` (rather than a new job) is deliberate: that job already owns
"the committed bundle is correct", and typecheck is the same concern. `npm run typecheck` stays
`nx run-many -t typecheck` and is not touched -- no Nx graph or cache-input churn.

If a distinct red job is preferred (matching the repo's `fallow` / `pack-check` style), a
separate `action-typecheck` job with the same four setup steps works equally well; the config is
identical either way.

---

## Q4. npm tarball surface

### Measured current state

`[VERIFIED: npm pack --dry-run --json, local]` **88 files, 219,116 bytes unpacked.**

| Path | Files | Consumer-facing? |
|---|---|---|
| `dist/lib`, `dist/backend`, `dist/server`, `dist/index.*`, `dist/serve.*` | 66 | Yes -- the barrel, the bin, the backends |
| `dist/publish`, `dist/cleanup` | 9 | Yes -- `docs/advanced.md:56-57` states both *"ship in the package"* |
| **`dist/action`** | 3 | **No** -- `action.yml`'s `main`; that action.yml is itself internal-only and not in the tarball |
| **`dist/roundtrip`** | 3 | **No** -- `read-back.js`, invoked only by `ci.yml`'s `publish-verify` job |
| **`dist/test`** | 6 | **No** -- `octokit-fault.ts` / `consumer-contract.ts`; `git grep` confirms they are imported by `*.spec.ts` **only** |
| **`dist/tsconfig.lib.tsbuildinfo`** | 1 | **No** -- build metadata |
| `**/*.d.ts.map` | 22 | Dead -- they point at `src/`, which does not ship |

### Recommended mechanism: negated globs in `files`

`[VERIFIED: npm pack --dry-run --json against an isolated scratch copy]` npm's `files` array
**does** honor `!`-negation. Result: **88 -> 51 files, 219 KB -> 137 KB unpacked.**

```json
"files": [
  "dist",
  "!dist/action",
  "!dist/roundtrip",
  "!dist/test",
  "!dist/**/*.tsbuildinfo",
  "!dist/**/*.d.ts.map"
]
```

`[VERIFIED: rg over dist/]` no shipped module imports anything under `action/`, `roundtrip/`, or
`test/` -- excluding them cannot break a consumer.

The `.d.ts.map` line is optional and lower-confidence value: dropping the maps leaves a dangling
`//# sourceMappingURL=` comment in each `.d.ts`, which editors ignore. Since the maps resolve to
`src/` paths that never ship, they are already non-functional -- excluding them is correct, just
not urgent. Drop that line if the planner prefers the minimal diff.

**Why not the alternatives**
- `.npmignore` -- npm's own docs are explicit that files matched by `files` cannot be excluded by
  `.npmignore`; and adding a second, differently-scoped ignore mechanism next to an allowlist is
  exactly the kind of two-sources-of-truth the `pack-check.cjs` header calls out.
- A separate build target / publish tsconfig -- would need a second `tsc` invocation, a second
  outDir, new Nx targets and cache inputs, and would break `ci.yml`'s
  `node packages/github-cache/dist/roundtrip/read-back.js` and `action.yml`'s
  `main: dist/action/index.js` unless both are repointed. Large diff for the same outcome. The
  constraint "must still be BUILT, only excluded from the tarball" is satisfied for free by the
  `files` approach: `tsc` still emits everything into `dist/`; npm just does not pack it.

### How `pack-check.cjs` should assert it

The guard already reads the real `npm pack --dry-run --json` file list -- only its predicate set
needs extending. Add to `FORBIDDEN`:

```js
{ label: 'the internal dogfood action build output', test: (p) => p.startsWith('dist/action/') },
{ label: 'the CI round-trip build output',            test: (p) => p.startsWith('dist/roundtrip/') },
{ label: 'test-support build output',                 test: (p) => p.startsWith('dist/test/') },
{ label: 'a tsbuildinfo build artifact',              test: (p) => p.endsWith('.tsbuildinfo') },
```

And add a positive assertion alongside the existing `dist/` check so a future over-narrow `files`
edit cannot silently ship an empty package:

```js
for (const required of ['dist/index.js', 'dist/index.d.ts', 'dist/serve.js']) {
  if (!files.includes(required)) {
    problems.push(`MISSING: ${required} is not in the tarball`);
  }
}
```

The file's docblock also needs a small correction: it currently claims the tarball ships
*"dist/ + LICENSE + README.md + package.json"* with no qualification -- update it to name the
excluded `dist/` subtrees and why (dogfood-stays-local applies *inside* `dist/`, not just at the
repo root). The existing `.d.ts.map` exclusion, if adopted, does not need a `FORBIDDEN` entry --
it is a size optimization, not a leak.

---

## Q5. Ratio / volume-threshold breaker prior art

### The survey

| Tool | Mechanism | Exact keys / defaults | On breach | Bypass |
|---|---|---|---|---|
| **octoDNS** | **Ratio guard -- CONFIRMED** | `MAX_SAFE_UPDATE_PCENT = 0.3`, `MAX_SAFE_DELETE_PCENT = 0.3`, `MIN_EXISTING_RECORDS = 10`. Per-zone override keys `update_pcent_threshold` / `delete_pcent_threshold` (zone config beats provider default) | **ABORTS** -- raises `TooMuchChange(UnsafePlan)`, message ends *"force required"* | `--force` (`manager.py:1130`: `if not force: plan.raise_if_unsafe()`) |
| **octoDNS (scope guard)** | Identity guard | `RootNsChange` -- any change to a zone's root NS record | ABORTS | same `--force` |
| **external-dns** | **NO volume guard** | `--policy` enum `sync` / `upsert-only` / `create-only` (default `sync`); `--dry-run` (default false); `--txt-owner-id` ownership registry. `--batch-change-size` (default 200; AWS 1000) is provider API batching, **not** a safety threshold | n/a | n/a |
| **Terraform** | **NO volume guard** | `lifecycle { prevent_destroy = true }` -- per-resource | Rejects the **plan** with an error | Remove the config / `-target`; docs warn "use sparingly" |
| **Kubernetes node-lifecycle** | **Ratio-keyed THROTTLE** | `--unhealthy-zone-threshold` **0.55** (min 3 nodes), `--node-eviction-rate` **0.1/s**, `--secondary-node-eviction-rate` **0.01/s**, `--large-cluster-size-threshold` **50** (below it, secondary rate is implicitly **0**) | **DEGRADES the rate**, does not abort | operator reconfig |
| **Kubernetes PDB** | Per-request volume guard | `minAvailable` / `maxUnavailable` | Eviction API returns **429 Too Many Requests**; the caller blocks | delete the Pod directly, bypassing the Eviction API |
| **restic** | **NO volume guard -- policy + scope only** | `--keep-*` policy; `--unsafe-allow-remove-all` (default false) and, notably, *"`--unsafe-allow-remove-all` is not allowed unless a snapshot filter option is specified"* -- even the escape hatch requires a scope narrowing; `--dry-run`/`-n` | n/a | n/a |
| **borg** | **NO volume guard** | mandatory scope prefix + at least one `--keep-X` (per CONTEXT.md prior art) | n/a | n/a |
| **rsync** | **Absolute-count volume guard** | `--max-delete=NUM`, **default off** | **Does NOT abort.** Skips all further deletions through the end of the transfer, **completes the transfer**, emits a warning including a count of skipped deletions, and **exits with code 25**. `--max-delete=0` is a documented "warn about extraneous files without removing any" mode | raise/remove the flag |
| **rclone** | Absolute-count + byte volume guard | `--max-delete int`, `--max-delete-size`, both **default off** | **ABORTS** -- "a fatal error will be generated and rclone will stop the operation in progress" | raise/remove the flag |
| **gh-ost** | Two-tier LOAD guard (not change-volume) | `--max-load` -> throttles writes; `--critical-load` -> "panics and quits"; `--critical-load-interval-millis` requires a *second* breach before bailing (hysteresis); `--critical-load-hibernate-seconds` converts the abort into a pause | throttle / abort / hibernate | flag config |

Sources: octoDNS `octodns/provider/plan.py` + `octodns/manager.py` (main);
external-dns `pkg/apis/externaldns/types.go` (master); kubernetes/website
`kube-controller-manager.md`, `api-eviction.md`; restic `cmd/restic/cmd_forget.go` (master);
`RsyncProject/rsync` `rsync.1.md`; `rclone/rclone` `docs/content/docs.md`;
`github/gh-ost` `go/cmd/gh-ost/main.go`. All `[VERIFIED: raw source read this session]` except
Terraform, which is `[CITED: developer.hashicorp.com/terraform/language/meta-arguments/lifecycle]`.

### Stated rationale for choosing a volume guard

**Nobody states one.** octoDNS -- the only true ratio guard found -- documents these thresholds
**nowhere**: `[VERIFIED]` no matches for `pcent` / `unsafe` / `threshold` in its `README.md`,
`docs/configuration.rst`, or `docs/getting-started.rst`. The only rationale in the repo is the
exception name and message (`TooMuchChange`, *"Too many updates, X% is over Y% (n/m), force
required"*) and one CHANGELOG line: *"Configurable `UnsafePlan` thresholds to allow modification
of how many..."*, plus a telling earlier entry: *"Relax UnsafePlan checks a bit, more to come here"*
-- i.e. the guard shipped too tight and had to be walked back.

The one genuinely informative design detail is `MIN_EXISTING_RECORDS = 10`: **the ratio check is
skipped entirely below 10 existing records**, because a percentage is meaningless at small N.
Kubernetes encodes the same insight with opposite polarity (`--large-cluster-size-threshold: 50`
-- below it, secondary eviction rate drops to 0). Any ratio guard needs an explicit small-N
answer; both prior-art implementations have one.

### The asymmetry -- stated plainly

**Volume guards are absent from retention/backup tooling, and they are NOT common in
infra-as-code either.** octoDNS is an outlier, not the norm.

- Backup/retention (restic, borg): **zero** volume guards. Policy completeness + scope
  narrowing, both aborting on a *config* defect, never on an *outcome* count.
- Infra-as-code: Terraform has **no** count/percentage refusal at all; external-dns has **no**
  volume guard, only a policy enum + an ownership scope. Only octoDNS -- one tool out of three
  -- has one, and it is undocumented and historically had to be relaxed.
- Where volume/ratio thresholds *are* genuinely idiomatic is **rate control of ongoing
  automated destruction** (Kubernetes node eviction, PDB, gh-ost load throttling) -- a different
  problem from "is this retention config correct". In that family the response is almost always
  to **slow down**, not to abort.
- File-sync (rsync, rclone) is the mixed case: both have absolute-count delete caps, both
  **default off**, and they disagree on the response (rsync degrades + warns + exit 25; rclone
  aborts).

This asymmetry directly corroborates the LOCKED retention-floor decision: for a
*retention-policy* problem, the prior art is unanimously a policy guard, and the CONTEXT.md
choice is on the well-trodden path.

### Is there prior art for a NON-ABORTING volume signal?

**Partially -- and the closest match is rsync `--max-delete`.** rsync is the only surveyed tool
that, on breach, *finishes the operation*, emits a **counted warning**, and signals via a
**dedicated exit code (25)** reserved for exactly that condition. It does stop deleting past the
cap, so it degrades rather than proceeding blindly -- but it never aborts the run, and the signal
is machine-visible without being fatal. `--max-delete=0` as a documented pure-warning mode is the
same idea taken to its limit.

Kubernetes node eviction is the other non-aborting shape: a ratio breach (`0.55`) throttles the
destructive rate from `0.1/s` to `0.01/s` rather than stopping.

**A tool that proceeds with the full destructive operation AND emits an anomaly warning: not
found.** Every non-aborting example degrades the destruction in some way.

**Is it good practice or a smell?** The survey contains a direct, upstream-documented warning
about the *aborting* variant. Kubernetes' eviction-API page has a section titled
**"Troubleshooting stuck evictions"**: *"the Eviction API will only return `429` or `500`
responses until you intervene"*, with the recommended remedies being *"Abort or pause the
automated operation causing the issue"* or *"directly delete the Pod... instead of using the
Eviction API"* -- i.e. **bypass the guard**. That is precisely the hazard CONTEXT.md names in
rejecting a ratio breaker (a guard that silently disables the operation indefinitely), documented
by Kubernetes itself as a known operational failure mode of its own volume guard.

By contrast, no source found argues *against* the non-aborting signal. It is a strictly weaker,
strictly safer construct: it cannot wedge the operation, because it does not gate it.

### What this means for finding #7 (invisible skip/degrade in a green job)

The right shape is **not** a new ratio mechanism -- it is the observability pattern already in
this codebase. `publish-mirror.ts` already does exactly the rsync-style thing:

- counts outcomes (`mirrored` / `skipped` / `failed` / `readMisses`),
- emits a targeted `core.warning` for the anomalous-but-legitimate case
  (`publish-mirror.ts:257-264`, the all-restore-MISS signal), and
- `core.setFailed`s on the aggregate hard-failure count (`:272-274`).

The proportionate close for #7 is to give `cleanup` the same treatment -- return counts, emit a
`core.warning` naming the count when the gate skips or the run degrades, so the skip is visible
as an annotation on a job that still goes green. No threshold, no ratio, no new config knob, no
new way for retention to stop running. That is rung 2 of the ladder: reuse the OBS-01 pattern
already proven three files over.

If a volume signal is still wanted on top, the defensible version is the rsync shape: an absolute
count, **default off**, non-aborting, surfaced as a counted `core.warning`. A ratio-keyed
*aborting* breaker has thin prior art (one undocumented, historically-relaxed implementation), a
documented wedge failure mode, and is already rejected in CONTEXT.md.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `proper-lockfile` is the current maintained Node advisory-lock default | Q2 | Low -- the recommendation is not to use a lock at all; only matters if the planner overrides Q2 |
| A2 | Adding `.d.ts.map` exclusion is safe for consumer editor tooling | Q4 | Low -- the maps already resolve to non-shipped `src/` paths; worst case is a dangling sourceMappingURL comment |
| A3 | `plugin-throttling`'s `minTime: 1000` write pacing is acceptable for the publish job | Q1 | Medium -- adds up to ~16 min on a full 1000-asset shard; a deliberate call, not a defect |

## Verified this session (tool-confirmed)

- `npm pack --dry-run --json` current file list (88 files) and the negated-`files` result (51 files)
- `npx tsc -p tsconfig.action.json` clean pass, `--listFiles` reachability set, and a negative
  (deliberate-error -> `TS2322`, exit 2) test. Probe files removed; `git status` clean.
- `nx show project` for both `@op-nx/github-cache` and `@op-nx/source` (root has zero targets)
- `rg` over `dist/` confirming no shipped module imports `action/`, `roundtrip/`, or `test/`
- registry metadata + published source for `@octokit/plugin-retry@8.1.0`,
  `@octokit/plugin-throttling@11.0.3`, and `octokit@5.0.5`
- raw source for octoDNS, external-dns, restic, rsync, rclone, gh-ost, and the Kubernetes
  controller-manager / eviction-API reference docs
