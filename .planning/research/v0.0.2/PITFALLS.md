# Pitfalls Research -- v0.0.2 OS-invariant cross-OS sharing

**Domain:** removing OS partitioning from a SHIPPED remote cache (Actions-cache version + Releases
asset name), while keeping one declared Nx input as the sole separation mechanism
**Researched:** 2026-07-26
**Confidence:** HIGH for everything marked [VERIFIED] (read from this tree, this commit, at
`@actions/cache` 6.2.0 / `nx` 23.1.0 / the local `actions/cache` clone). MEDIUM where marked.

This is a SUBSEQUENT-milestone pitfalls doc. It assumes v0.0.1 shipped and deliberately does NOT
re-derive greenfield hazards. Its subject is the specific failure surface of *taking two working
barriers out of a running cache*.

## How to read this

Every pitfall carries a **Silence** rating. This project's signature defect class is the green
build that is wrong:

| Rating | Meaning |
|--------|---------|
| **SILENT-3** | No log line, no warning, no failing check. Only a later measurement reveals it. |
| **SILENT-2** | Logged at `core.debug` or buried in a count that conflates causes. Invisible without `ACTIONS_STEP_DEBUG` or a log dive. |
| **SILENT-1** | Warns, but the warning is expected/noisy enough to be ignored. |
| **LOUD** | Fails a check. Listed only when the failure is easy to misdiagnose. |

Weight SILENT-3 above everything else. Two of the three v0.0.1 production defects were SILENT-3.

---

# Section A -- Carry-forward audit of `.planning/research/PITFALLS.md`

Every v0.0.1 claim that v0.0.2 touches, re-verified against the current tree. **Nothing here was
copied forward unchecked.** The verdict column is the actionable part.

## A.1 -- Pitfall 7, the MUST-NOT-REOPEN block: claim-by-claim

| v0.0.1 claim | Verdict | Evidence |
|---|---|---|
| **P7.1** `.gitattributes` `* text=auto eol=lf` keeps content hashes cross-OS identical | **STANDS, unchanged, MORE load-bearing than before** | `.gitattributes` still holds exactly `* text=auto eol=lf` with its "why" comment [VERIFIED]. v0.0.2 removes two other barriers, so CRLF becomes a larger share of the remaining risk. Deleting it now costs a wrong-*shape* MISS on every target, not just `integration`. |
| **P7.2a** `@actions/cache` version-hashes the LITERAL path strings; `cacheArchivePath()` must stay the single source and save/restore must pass byte-identical paths | **STANDS, and TIGHTENS** | `getCacheVersion(paths, compressionMethod, enableCrossOsArchive)` does `crypto.createHash('sha256').update(components.join('|'))` over `paths.slice()` + method + optional `'windows-only'` + `'1.0'` salt (`node_modules/@actions/cache/lib/internal/cacheUtils.js:157-172`) [VERIFIED]. v0.0.2 upgrades the requirement from "byte-identical across CALL SITES" to "byte-identical across CALL SITES **and across OSes**". |
| **P7.2b** "the version is still OS-distinct through the OS temp path ... so a cross-OS restore still MISSes" | **STALE BY DESIGN -- v0.0.2 inverts it** | This is the *outcome* VER-01/VER-03 exist to remove. The MECHANISM statement is correct; the CONSEQUENCE must be rewritten, not deleted. The comment lock in `cache-archive-path.ts:5-33` and `release-asset-name.ts:33-48` must be REWRITTEN in the same commit as the change -- a stale comment lock that says the opposite of the code is worse than none. |
| **P7.2c** compression parenthetical ("windows-11-arm lacks zstd") | **ALREADY CORRECTED** in `PITFALLS.md:159` by the `windows-publish-one-asset` debug (E9 Correction 1). No further action. | -- |
| **P7.3** per-OS publish matrix is load-bearing; collapsing it silently drops the other OS's entries | **RATIONALE DIES, MATRIX SURVIVES FOR DIFFERENT REASONS** | After VER-03 a single leg CAN restore every OS's entries, so the original justification evaporates. The matrix must still be retained -- for `max-parallel: 1`'s shard-race protection (XOS-06) and for OBS-05's per-leg liveness proof. Collapsing it is explicitly out of scope until XOS-05 is proven. **Re-justify the comment; do not leave the dead reason in place.** |
| **P7.3 symbol** `uploadHash` | **STALE (already noted).** Current site is the `restored.kind === 'miss'` branch at `publish-mirror.ts:218` [VERIFIED] -- note this has MOVED again since the debug doc cited `:184-189`, because the hash dedup landed. Cite the branch by name, never by line. | -- |

## A.2 -- `PITFALLS.md:361`, the trailing carry-forward paragraph

> "...Pitfall 7's cross-OS `@actions/cache` version hashing incl. zstd-vs-gzip - and note
> `enableCrossOsArchive` does NOT rescue a compression-method mismatch (actions/cache#1622), so
> OS-partition rather than rely on the flag..."

**Split verdict. The mechanism is TRUE; the recommendation is STALE.**

- **TRUE and still true [VERIFIED]:** `compressionMethod` is pushed into the version components
  **unconditionally**, before and independent of the `enableCrossOsArchive` branch
  (`cacheUtils.js:162-168`). The flag ONLY suppresses the `'windows-only'` component, and only
  when `process.platform === 'win32'`. So the flag cannot and does not rescue a compression
  mismatch. Upstream's own docs agree: *"If you are using a self-hosted Windows runner, GNU tar
  and zstd are **required** for Cross OS caching to work"* (`actions/cache` README, local clone)
  [VERIFIED].
- **STALE:** "so OS-partition rather than rely on the flag". v0.0.2 relies on the flag on purpose,
  under a documented precondition (both sides resolve the same compression method). Rewrite as:
  *"the flag makes the version OS-invariant only while the compression method matches on both
  sides -- so compression is a third, runtime-sensed version component that must be observed
  (VER-05), not assumed."*

**Corollary worth writing down explicitly, because it is not obvious from the flag's name
[VERIFIED]:** on non-Windows platforms `enableCrossOsArchive` has *zero* effect on the version.
Setting it is a no-op on Linux and macOS. Consequences:

1. The version rotation caused by VER-03 alone is **asymmetric** -- Windows entries rotate, Linux
   entries do not. Only VER-01 (the path change) rotates both. Plan the OBS-04 expected-signal
   record around that: the first post-change push all-MISSes on **both** legs because of the PATH,
   not because of the flag.
2. macOS already shares a version with Linux today (no `'windows-only'`, same salt). If a macOS
   consumer ever appears, the OS-invariance is already there and the Nx discriminator (CORR-04) is
   already the only thing separating them.

## A.3 -- Other v0.0.1 pitfalls, status for v0.0.2

| # | Status for v0.0.2 | Phase |
|---|---|---|
| **P1** CREEP / wrong trigger set | Unchanged. TRUST-10 must **verify** the allowlist and sync gate rather than assume them. | 10 |
| **P2** mirror as the cross-trust bridge | **SHARPENED, not unchanged.** See B7. The Actions-cache OS-version barrier was an accidental second filter on what a publish leg could pull into the public mirror; VER-03 removes it. `listCacheEntries`' `ref` scoping (`action/index.ts:40-43`) becomes the sole in-repo control. | 10 |
| **P3** GHES read-only-token floor | Untouched by v0.0.2. Do not let DOCS-08's README edits drop the existing caveat. | 9 (docs only) |
| **P4/P5/P6** LRU-via-manifest | Still out of scope. RETAIN-04 is a filter widening, not retention state. | -- |
| **P8** fault-as-absence in cleanup | Unchanged and directly re-exercised: RETAIN-04 edits the cleanup DELETE filter. `cleanupMirror`'s list-then-delete structure and the `Number.isNaN(createdMs)` never-delete-on-unknown branch are intact [VERIFIED, `cleanup.ts:74-115`]. Widening the filter must not weaken either. | 10 |
| **P9** MISS-only, never wrong result | **The invariant most affected by this milestone.** v0.0.1 had three overlapping barriers (Nx hash divergence, `@actions/cache` version, `<hash>-<os>` asset name). v0.0.2 deliberately removes two and *fixes the third's accidental version so it can no longer be a barrier either*. Afterwards, P9 rests on exactly ONE declared input (CORR-04) plus the CORR-05 platform-agnosticism claim. Every phase 8-12 gate is ultimately a P9 gate. | all |

---

# Section B -- New pitfalls, ordered by silence then blast radius

## B1. The three-anchor split-brain: `cwd` vs `GITHUB_WORKSPACE` vs glob base

**Silence: SILENT-3. Phase 9 (VER-01, VER-04). Highest-priority item in this document.**

**What goes wrong.** Today the archive path is absolute (`join(tmpdir(), ...)`) and tar stores it
with `-P`, so *where the process runs* is irrelevant. VER-01 makes it **relative**. A relative path
is resolved against three DIFFERENT anchors inside `@actions/cache` 6.2.0 [all VERIFIED]:

| Step | Anchor | Source |
|---|---|---|
| `saveCache` -> `resolvePaths` -> `glob.create` expands the pattern | `process.cwd()` | `@actions/glob/lib/internal-pattern.js:132,160` |
| `resolvePaths` relativizes each match for the tar manifest | `process.env.GITHUB_WORKSPACE ?? process.cwd()` | `cacheUtils.js:62` |
| `createTar` / `extractTar` run `tar -C <dir>` | `process.env.GITHUB_WORKSPACE ?? process.cwd()` | `tar.js:125-128, 228` |

They coincide only when `process.cwd() === GITHUB_WORKSPACE`. When they do not:

- **Save** globs one tree and writes manifest entries relative to another (`../../...` escapes).
- **Restore** returns a **HIT**, extracts the file under `$GITHUB_WORKSPACE/.nx/cache/...`, and then
  `actions-cache-backend.ts:53` does `readFile(path)` -- resolved against `process.cwd()` -- and
  throws ENOENT.
- `server.ts` `handleGet` catches every `backend.get` fault and returns **404 MISS** [VERIFIED,
  `server.ts:141-160`]. So the whole cache degrades to a permanent all-MISS with **no log line
  anywhere**, while `@actions/cache` cheerfully logs `Cache hit for: nx-cache-<hash>`.

**Why it happens.** VER-04 is written as *"assert its cwd is the Nx workspace root"*. That is the
wrong variable. `@actions/cache` never reads "the Nx workspace root" -- it reads `GITHUB_WORKSPACE`.
A container action, a `working-directory:` on the step, a monorepo sub-package invocation, or a
consumer running the sidecar from a subdirectory all break the identity while cwd is still "a"
workspace root.

**Prevention.**
- Assert the **conjunction**: cwd is the Nx workspace root **AND** (`GITHUB_WORKSPACE` is unset OR
  `resolve(GITHUB_WORKSPACE) === resolve(cwd)`). Fail loud on either half. Compare resolved,
  case-normalised paths -- on Windows `D:\a\r\r` and `d:\a\r\r` are the same directory and
  different strings.
- Assert it **once at process start**, not per-request. A per-request check that fires inside
  `get()` gets swallowed by `handleGet`'s catch and becomes another silent MISS.
- Add an asymmetry note: the SAME fault is **loud** in `publishMirror` (nothing catches around
  `actionsCache.get(hash)`, so the run throws) and **silent** in `serve`. Do not let a green
  publish job be read as evidence the serve path is healthy.

**Warning signs.** `@actions/cache` logs `Cache hit for:` but the Nx run shows no `[remote cache]`
label. A `.tar` appears under `$GITHUB_WORKSPACE/.nx/cache/` and is never deleted (the `rm` in the
`finally` also misses).

---

## B2. The relative path's directory: must exist, must stay gitignored, must survive `nx reset`

**Silence: SILENT-3 (hash instability) / LOUD-then-silent (ENOENT). Phases 9 and 11.**

Three distinct traps in one decision (D2-04, `.nx/cache/<literal>`).

**(a) The directory is no longer guaranteed to exist.** `os.tmpdir()` always exists; `.nx/cache`
does not. `put()` does `writeFile(path, bytes)` **before** anything creates it
(`actions-cache-backend.ts:68`). On a fresh runner or after `nx reset`, that is ENOENT -> the
`catch` rethrows (not a `ReserveCacheError`) -> `handlePut` -> **500**, which fails the build
(writes fail closed by design). Cheap prevention: `mkdir` with `recursive: true` immediately before
the write, in `cacheArchivePath`'s caller or a one-line helper. Note this ALSO matters for the read
path in an unexpected way -- `extractTar` runs `io.mkdirP(workingDirectory)` and GNU tar creates
intermediate dirs, so the read path self-heals and the write path does not. Asymmetric.

**(b) The literal MUST stay under a gitignored path.** `.gitignore` ignores `.nx/cache`,
`.nx/workspace-data`, `.nx/polygraph`, `.nx/self-healing`, `.nx/migrate-runs` -- **it does NOT ignore
`.nx/` wholesale** [VERIFIED]. So an innocent "tidy" from `.nx/cache/nx-github-cache-<hash>.tar` to
`.nx/github-cache/<hash>.tar` puts a transient multi-megabyte file into Nx's workspace file map.
The result is a **self-referential, intermittent task-hash perturbation**: whether a task's hash
changes depends on whether an archive happened to be on disk at hash time. That is a flaky
cross-OS MISS with no error and no reproducible repro. **Comment-lock the literal with "this path
is chosen because it is gitignored", not just "because it is workspace-relative".**

**(c) `nx reset` deletes `.nx/cache`.** TEST-10 *mandates* `nx reset` before the O1/O2 proofs. If
the sidecar is already running, the reset deletes the directory out from under it and the next PUT
500s. **Ordering for the Phase 11 proof script: `nx reset` FIRST, then start the sidecar, then
run.** Also worth checking whether Nx 23's own local-cache size eviction can remove foreign files
from `.nx/cache` (unverified; treat the archive as deletable-at-any-time and never assume it
survives between two of our own calls -- the existing `withHashLock` already assumes this).

**Adopter note for DOCS-07:** a consumer whose `default` named input is `{workspaceRoot}/**/*`
(not Nx's default, but a common hand-roll) gets trap (b) even with our gitignored literal, unless
their `.gitignore` covers it. Say so.

---

## B3. `nx show target inputs` cannot see the node that most likely diverges

**Silence: SILENT-3. Phase 8 (PARITY-01). This will waste a whole root-cause pass if not planned around.**

**What goes wrong.** The natural capture command for PARITY-01's "node-by-node" record is Nx 23's
`nx show target inputs <project>:<target>` (a real, documented subcommand -- `nx show` registers
`target inputs [target]` with `--check`, `command-object.js:172-196`) [VERIFIED]. It routes through
`HashPlanInspector.inspectInputs`, whose own API doc says:

> *"TsConfiguration is resolved to the root tsconfig file path. JsonFileSet is resolved to the
> matched JSON file paths ... **ProjectConfiguration is skipped for now. Cwd is skipped as it's
> ambient.**"* -- `node_modules/nx/dist/src/native/index.d.ts:83-86` [VERIFIED]

Two blind spots, and v0.0.1's own research named both as the leading divergence sources:

1. **`ProjectConfiguration` is not reported at all.** `PITFALLS.md:329` states *"Nx folds a built-in
   ProjectConfiguration node into every task hash, and inference plugins can make that node
   OS-dependent"*. The instrument cannot see it. (The node name is real -- `ProjectConfiguration`,
   `TsConfig`, `AllExternalDependencies` and the symbol `hash_project_config` are all present in the
   Nx native binary [VERIFIED by binary string probe].)
2. **It reports file PATHS, not file HASHES** (`HashInputs { files: Array<string>, runtime,
   environment, depOutputs, external }`) [VERIFIED]. So a CRLF divergence, a `.tsbuildinfo`
   case-normalisation divergence, or any content-level difference shows up as **two identical
   input lists with two different task hashes**.

The failure mode is a researcher diffing two `nx show target inputs` dumps, finding them
byte-identical, and concluding "no divergence" or "must be a bug in Nx".

**Prevention.** PARITY-01 must name an instrument that emits the **per-node `details` map**, not
the structured inputs. The hasher populates `task.hashDetails` = `TaskHashDetails.details`
(`Record<string, string>`, node -> hash) via `hashTask` / `hashTasks`
(`nx/dist/src/hasher/hash-task.js:74-86,159`) [VERIFIED], and nothing in the CLI prints it -- so a
small script is required. **The repo already has the precedent for reaching into `nx/src/hasher/*`
from committed code** (`packages/github-cache/src/nx-target-inputs.spec.ts` imports
`nx/src/hasher/task-hasher.js` and documents the no-semver-guarantee trade-off) [VERIFIED]. Reuse
that shape, and record the same loud-import-failure rationale.

Use `nx show target inputs` as a *secondary* diff (it is genuinely good for file-set questions),
but state in PARITY-01 that it is blind to `ProjectConfiguration` and to content hashes, so a
"no difference" result from it is not evidence.

---

## B4. Graph-state freshness reproduces the entire "cross-OS" divergence on ONE machine

**Silence: SILENT-3. Phases 8 and 11. This can make CORR-03 green while XOS-01 misses.**

**What goes wrong.** Already measured in this repo and easy to forget:
`.planning/quick/260725-w3s-.../260725-w3s-RESULTS.md` section 4 shows that on **one Windows box,
one commit**, varying only `.nx/workspace-data` freshness, **all four cacheable targets compute a
different hash** [VERIFIED from the artifact]:

| target | COLD (fresh workspace-data) | WARM-GRAPH |
|---|---|---|
| build | 13655686526929222562 | 14522047022641658505 |
| typecheck | 3381254060286801611 | 17612203514283256006 |
| test | 5027851155743781967 | 12332927989897543193 |
| integration | 13758457399293023985 | 18311993323643153366 |

Both of the values `STATE.md` attributes to "ubuntu CI" vs "windows CI" are reproducible on the one
Windows machine by varying nothing but graph freshness.

**Why this bites v0.0.2 specifically.** CORR-03 is a **CI job comparing two runners**. CI runners
are always COLD. XOS-01's consumer is a **native Windows workstation**, which is WARM by default
(that is what "established local box" means). So:

- CORR-03(c) can be permanently green -- cold-ubuntu == cold-windows -- while the O1 proof MISSES,
  because the warm local box computes a fourth value that CI never produced.
- Nothing fails. `Cache: 0/4 hit (0%)` prints, and that line is non-discriminating (see D1).

**Prevention.**
- PARITY-02's three observation points must each **record the graph state**, and at least the
  Windows-workstation point must be taken in BOTH states. Warm-vs-cold is a *fourth* axis alongside
  the three observation points, not a nuisance variable.
- Treat "the hash a warm local box computes equals the hash cold CI published" as a **separate,
  named acceptance question** from PARITY-02's cross-OS parity. If the answer is no, O1 is
  unreachable regardless of OS parity, and the honest fix is either "make the graph deterministic"
  or "the documented O1 recipe includes a cold-graph step".
- Do NOT resolve this by making `nx reset` part of the recipe without saying so: `nx reset` clears
  BOTH `.nx/cache` and `.nx/workspace-data`, so TEST-10's mandated reset silently forces the local
  box into the COLD state. That is convenient for the proof and **misleading as evidence for the
  everyday developer experience**. Record which question the proof answers.
- Root-cause the freshness sensitivity itself in Phase 8. It is almost certainly the same
  inference-plugin / external-dependency-graph class as `PITFALLS.md:329-331`, which means fixing
  it also fixes part of the OS axis.

---

## B5. Verdict artifacts: what a `test` cache entry actually is

**Silence: SILENT-3. Phases 10 (record) and 12 (mitigate). See also Section C.**

**What goes wrong.** Nx's remote-cache contract stores `{ code: number, terminalOutput?: string,
outputsPath: string }` [VERIFIED: `CachedResult`, `nx/dist/src/native/index.d.ts:277-282`; the
store signature is literally `store(hash, cacheDirectory, terminalOutput, code)`]. For `test` and
`typecheck`, which declare no `outputs`, the artifact IS the exit code plus the replayed log.

So enabling O4 means: **Windows CI stops executing `build`, `typecheck` and `test` entirely** and
replays Linux's exit 0. Any Windows-only regression -- in the *code under test*, not in the spec --
is then invisible forever, and the CI page shows a green Windows job with `[remote cache]`.

**What CORR-06's lint rule does and does not cover.** LINT-02 bans **ambient platform reads in
`**/*.spec.ts`**. That catches the three known violations and future ones of the same shape. It
does NOT catch:

- platform sensitivity in `src/**` (e.g. `cache-archive-path.ts` uses `node:path` today);
- Node/libuv behavioural differences the spec never mentions (case-insensitive FS, path length,
  `EPERM` on rename over an open handle, socket/`ECONNRESET` timing, `EOL` in a snapshot);
- toolchain differences (`tsc` resolving a mis-cased import on a case-insensitive FS -- partially
  closed by `forceConsistentCasingInFileNames: true` in both tsconfigs, which REQUIREMENTS.md
  already relies on);
- architecture and libc, which `process.platform` does not distinguish at all and which this repo
  cannot exercise (every machine here is arm64) -- DOCS-07 already commits to naming these.

**Prevention (proportionate, and cheap).** The requirement set deliberately puts "executor
portability classification" and "an empirical divergence-detection subsystem" out of scope, with
the residual risk recorded in TRUST-11. That is a defensible call, but it leaves *no* detector at
all. The lazy version of a detector already has a home in this repo: the workspace already runs a
**scheduled** workflow (`cleanup.yml`). Add one scheduled Windows job that runs the three targets
with `--skip-nx-cache`. Cost: one job, once a day/week. Benefit: a Windows-only regression is
caught within one schedule tick instead of never. Recommend it in Phase 12 alongside XOS-05's
"whether the Windows legs also WRITE" recorded decision; if that decision is "they write", the
scheduled no-cache run stops being optional.

**Warning sign.** A Windows job's wall time collapses to the sidecar overhead and every target
carries `[remote cache]`. That is the SUCCESS signal for O4 and the RISK signal for B5 -- they are
the same observation, which is exactly why it needs a separate detector.

---

## B6. First-write-wins now arbitrates between payloads that are NOT byte-identical

**Silence: SILENT-3. Phase 10 (TRUST-11), and it is a code comment, not only a threat-model entry.**

TRUST-11 records the premise change. The concrete follow-through that is easy to miss: the claim is
written into the **code**, and the code comment becomes false in the same commit.

`publish-mirror.ts:159` currently reads:

> `*   First-write-wins (D-05/TRUST-07): a name already present is a benign no-op (the shard`
> `*   asset set is byte-identical under CORR-01); a duplicate-upload race returning 422 is`
> `*   likewise benign.`

[VERIFIED]. After CORR-02 both legs derive the SAME name for the same hash, and the two legs'
payloads differ because the cached artifact embeds captured terminal output with OS-specific paths.
So "benign because byte-identical" becomes "benign because we assert the two payloads are
*semantically* interchangeable" -- a materially weaker claim that a reader must not inherit
unexamined.

**Prevention.**
- Rewrite that comment and the 422 branch's comment in the SAME commit as CORR-02. A comment lock
  that survives the change it describes is how a false premise gets re-adopted three milestones
  later.
- The reader's shard walk is **newest-shard-first**, so if a hash is mirrored into two month shards
  (e.g. the rename push straddles a month boundary) the winner is shard-dependent, not
  first-write-dependent. TRUST-11 says this; make sure the Phase 11 proofs are not run within a day
  or two of a month rollover, or add the shard tag to the recorded evidence.
- OBS-03's producing-OS `label` is what makes this recoverable after the fact. It is doing more work
  than "nice-to-have attribution" -- it is the only way to answer "whose bytes did the developer
  get" once the namespaces collapse. Treat it as load-bearing, not observability garnish.

---

## B7. The mirror's cross-trust bridge widens (P2, sharpened)

**Silence: SILENT-3 for the exposure; the code change itself is loud. Phase 10 (TRUST-10, TRUST-12, TRUST-13).**

Before v0.0.2, a publish leg could only pull entries its OWN OS had saved -- the measured 4/1 split
in `windows-publish-one-asset.md`. That was an *accidental* second filter on what could enter the
world-readable Releases mirror. VER-03 removes it: after the change, the ubuntu leg can restore and
mirror **every** OS's entries, and therefore every OS's captured terminal output.

The concrete consequences a planner must handle:

1. **`listCacheEntries`' `ref` scoping (`action/index.ts:40-43`) becomes the sole in-repo control**
   keeping non-default-branch trusted writes out of the public mirror. `TRUSTED_EVENTS` includes
   `push` with no ref check, so the server writes on any pushed branch; the sync gate
   (`isSyncTrusted`) gates *whether publish runs*, and the `ref` scoping gates *what it can see*.
   TRUST-10 pins this by spec and comment-lock -- do not let it be simplified as "redundant with the
   sync gate".
2. **Both legs now mirror the same set, so the Windows leg's `mirrored` count collapses toward 0
   permanently** (ubuntu runs first under `max-parallel: 1` and wins every name). This is the
   mechanism that makes OBS-05 load-bearing: without a leg-distinguishable seed, a completely dead
   Windows publish path presents identically to a healthy one.
3. Conversely, the all-restore-MISS warning becomes MORE meaningful (a full miss is no longer
   legitimately explained by "different OS"), which is exactly what OBS-04 codifies. Keep the
   warning; it just changes meaning.

---

## B8. `publish-verify` and `dogfood-verify` both go vacuous under an OS-invariant name

**Silence: SILENT-3. Phases 9 (VER-06) and 10 (OBS-05).**

OBS-05 names the `publish-verify` half. The **VER-06 half has the mirror-image trap and it is not
spelled out anywhere**:

- `dogfood-seed` and `dogfood-verify` are both `ubuntu-24.04-arm` today, `dogfood-verify` has
  `needs: dogfood-seed`, and both are `if: github.event_name == 'push'` [VERIFIED,
  `ci.yml:428-468`].
- VER-06 adds a windows-11-arm `dogfood-verify` leg reading back the ubuntu-seeded entry. **That is
  a valid cross-OS proof only while there is NO Windows `dogfood-seed` leg.** The seed key is
  `nx-cache-<GITHUB_RUN_ID>` -- one key per run, not per OS -- so the moment a Windows seed leg
  exists, the Windows verify restores the Windows-written entry and passes even if cross-OS restore
  is completely broken.
- Same shape as `read-back.ts:37`'s `GITHUB_RUN_ID` seed, which OBS-05 already flags for the
  Releases side [VERIFIED].

**Prevention.** Write the vacuity condition into the job comment ("this leg proves nothing if a
Windows seed leg is ever added"), and add a mechanical guard: the verify leg should assert the
restored entry's *provenance*, not just its presence -- e.g. seed a body that encodes the producing
OS (`dogfoodBody` already gives a deterministic body per hash; extend it or add a second field) and
assert the Windows leg read a **linux**-produced body. A presence-only assertion cannot distinguish
the two worlds.

---

## B9. `getCompressionMethod` is not exported, so VER-05 must re-implement it

**Silence: SILENT-2. Phase 9 (VER-05).**

`@actions/cache` 6.2.0's exports map is exactly `{".": {"types": "./lib/cache.d.ts", "import":
"./lib/cache.js"}}` [VERIFIED]. `getCompressionMethod` lives in `lib/internal/cacheUtils.js` and is
therefore unreachable -- the same `ERR_PACKAGE_PATH_NOT_EXPORTED` wall VER-02 already documents for
`getCacheVersion`.

So VER-05's "surface the resolved compression method" means **re-implementing upstream's probe**,
and a re-implementation can silently disagree with the value `@actions/cache` actually used. The
exact upstream rule is subtle [VERIFIED, `cacheUtils.js:100-136`]:

- it runs `zstd --quiet --version`, collecting **stdout AND stderr** into one string;
- `exec` runs with `ignoreReturnCode: true`, and a thrown error is caught and swallowed to `''`;
- the branch is **`versionOutput === '' ? Gzip : ZstdWithoutLong`** -- the parsed semver is computed
  and then **not used** for the decision;
- so a *broken but present* zstd that prints anything at all still selects zstd, and the failure
  surfaces later as a tar error, which `saveCache` swallows into a warning and `-1`.

**Prevention.** Mirror the command, the stdout+stderr capture, and the empty-string rule exactly;
comment-lock it against the pinned `@actions/cache` version with a pointer to `cacheUtils.js`; and
keep it **advisory** as VER-05 already specifies -- a mismatch between our reported value and the
real one must not gate a build. Add a line to the `@actions/cache` bump checklist: *"re-read
`getCompressionMethod`; VER-05 duplicates it."*

---

## B10. The cleanup filter: two name families are not the whole population

**Silence: SILENT-2 (unbounded growth toward the asset cap). Phase 10 (RETAIN-04).**

RETAIN-04 admits `nx-cache-<hash>` and legacy `<hash>-<os>`. Three things it does not say:

1. **The shard already holds ~50 PoC-era `<hash>.tar.gz` assets that NO filter matches**
   [VERIFIED from `260725-w3s-RESULTS.md`: "50 are PoC-era `<hash>.tar.gz`"]. They have never been
   prunable and RETAIN-04 does not change that. They are permanent occupants of the 1000-asset
   per-release cap. Decide explicitly: prune them once by hand, add a third accept branch, or
   record them as accepted dead weight with a count. Do not leave the question unasked -- the cap's
   skip-and-warn degradation makes the eventual failure a *warning*, not an error (SILENT-1).
2. **The two branches must be mutually exclusive and both individually tested.** The current
   function splits on the **last** `-` [VERIFIED, `release-asset-name.ts:69-83`]. `nx-cache-<hash>`
   fails that parse (`os` half would be the hash), so the branches happen not to overlap -- but that
   is a property of the current split, not of the design. Assert non-overlap directly.
3. **The new `CACHE_KEY_PREFIX` coupling is a NEW single point of failure.** D2-03 single-sources
   the asset name from `CACHE_KEY_PREFIX = 'nx-cache-'` (`cache-key.ts:18`) [VERIFIED], which is
   *also* the Actions-cache key prefix and the `isServerProducedKey` filter's prefix. After CORR-02
   one literal governs: the cache key, the enumeration filter, the asset name, and the cleanup
   filter. Changing it silently orphans the entire mirror -- and RETAIN-04's legacy branch would
   NOT cover the orphans, because it only knows `<hash>-<os>`. Comment-lock `CACHE_KEY_PREFIX` as
   now quadruply load-bearing and pin the literal by spec.

---

## B11. Two one-time all-MISS windows that can collide

**Silence: SILENT-1 turning into a FALSE RED. Phases 9 and 10.**

VER-01 rotates the Actions-cache version (one full MISS wave). CORR-02 rotates the Releases asset
name (one full mirror republish). OBS-04 records the expected signal in advance and makes a
**second consecutive** all-miss push a FAILURE.

The trap: if the Phase 10 rename lands inside Phase 9's rotation window, a correct implementation
produces two consecutive all-miss pushes and trips the tripwire. The ROADMAP already flags this
("Sequence Phase 10's warming push after the rotation push has been observed"). Reinforce it in the
tripwire's own definition: gate on **"two consecutive all-miss pushes with no version-affecting
change in between"**, not on a raw push counter. A tripwire that fires on correct work gets
disabled, and then it is not a tripwire.

---

## B12. TEST-08's producer attribution: "which targets a job runs" != "which hashes a job produces"

**Silence: SILENT-3 (a false-positive O1 proof). Phase 11.**

TEST-08 already requires the premise be asserted *mechanically against the resolved Nx task graph,
not assumed from the job list*. The reason that wording is load-bearing, made concrete: the
`windows-publish-one-asset` investigation found the ubuntu **`typecheck` job runs 2 Nx tasks**, the
second being `build`, satisfied from cache (E2) [VERIFIED from the debug artifact]. A job that
"runs typecheck" therefore touches the `build` hash.

Today `integration`'s `dependsOn: ["^build"]` resolves to nothing (single-project workspace), which
is why the Windows leg produced exactly one entry. That is a property of the current project graph,
not of the config. Add a second project, or change `^build` to `build`, and the Windows
`integration` job starts producing the `build` hash -- destroying O1's attribution *without anyone
touching the job list*.

**Prevention.** Resolve the task graph for the Windows leg's actual command (`nx run-many -t
integration ... --graph` or the equivalent programmatic call) and assert the produced hash set does
not intersect `{build, typecheck, test}`. Capture the assertion output as part of the TEST-08
evidence, not as a pre-flight check whose result is discarded.

---

## B13. `max-parallel: 1` is doing three unrelated jobs

**Silence: SILENT-2. Phase 10 (XOS-06).**

XOS-06 says it is retained for shard-race reasons and must never become a correctness control. Two
additions:

- It is ALSO what makes ubuntu the deterministic first-writer, which is precisely the rejected
  ordering argument. The comment must say "ubuntu wins every race today, and no requirement may
  depend on that" -- naming the coincidence is stronger than only forbidding the dependency,
  because the coincidence is what a future reader will notice first.
- After B7, serializing also means the Windows leg's work is almost entirely `skipped`. If someone
  later removes `max-parallel: 1` for speed, the two legs race the shard **and** race the same asset
  names, turning the currently-benign 422 branch into the hot path. The 422 branch is correct
  today; it has never been exercised at volume.

---

# Section C -- Verdict-vs-file artifacts: what the ecosystem knows

Answering "what are the known hazards of sharing a verdict across machines".

**In Nx, first-party and verified.** The remote-cache artifact is `{ code, terminalOutput?,
outputsPath }` and the store call is `store(hash, cacheDirectory, terminalOutput, code)`
[VERIFIED, `nx/dist/src/native/index.d.ts:97-101, 277-282`]. A restored task does **not execute**;
its exit code and its log are replayed. Two consequences specific to this milestone:

1. **The proof of portability cannot come from the green CI run.** REQUIREMENTS.md already rejects
   "O4's green CI is the portability evidence" as circular. That rejection is correct and the
   mechanism above is why: a restored task produces a green result by definition. It is worth
   restating in DOCS-07, because it is the single most natural wrong argument an adopter will make.
2. **The verdict carries OS-specific text.** The `terminalOutput` embeds absolute paths, separators,
   and timing. That is what makes B6's "byte-identical" premise false, and it is also the public-repo
   exposure TRUST-12 records.

**Comparable systems -- the same class, different mitigations** (MEDIUM confidence; stated as
patterns, not as citations, since these were not re-verified against primary sources this session):

- **Bazel** puts platform properties into the action key and leans on *hermeticity* (sandboxing,
  declared toolchains) so that an action's result is a function of its declared inputs. The known
  failure is the non-hermetic action: an undeclared dependency on the host makes a cache hit
  *incorrect*, not merely stale. Nx has no sandbox, so the entire burden lands on the declared
  `inputs` -- which is exactly what CORR-04 is.
- **Gradle** caches `Test` task results and documents that a cacheable task must declare every
  input, with `org.gradle.caching.debug` to dump the cache-key components. Its canonical bug report
  is "my test passed from cache on a machine where it fails" traced to an undeclared environmental
  input.
- **Turborepo** caches and *replays the logs*, which makes the replay visually indistinguishable
  from a real run -- the same trap as Nx's `terminalOutput`.

The transferable lesson is uniform across all four: **when the artifact is a verdict, the only
defence is the completeness of the declared input set, and the only detector is a periodic run with
the cache disabled.** That is the argument for B5's scheduled `--skip-nx-cache` Windows job.

---

# Section D -- Proof hazards: how teams fool themselves

## D1. `Cache: n/m hit (p%)` is non-discriminating in BOTH directions

**Already burned this repo once.** Recorded twice in-tree [VERIFIED]:

- `Cache: 0/1 hit (0%)` printed identically on run 30169158892, which had **no sidecar at all** --
  so a 0% line is not evidence a remote was consulted.
- A **non-zero** hit counts LOCAL hits identically; `260725-w3s` produced a `4/4` with **zero**
  remote consults (warm `.nx/workspace-data` served everything locally).

OBS-02 already mandates the `[remote cache]` label as the evidence. Reinforce the negative half in
the phase plans: **record the `Cache:` line, mark it non-discriminating, and never conclude from
it.** Nx 23.1's end-of-run performance report has the same defect and OBS-02 already demotes it to
"supporting context".

## D2. A HIT without a preceding reset proves nothing (TEST-10) -- and neither does a reset alone

TEST-10 mandates `nx reset`. Two ways the reset can still leave a false proof:

- **Copying `.nx/workspace-data` back** (or restoring it from a backup, or an editor/daemon
  recreating it) carries `cache_outputs` rows, and Nx then serves tasks locally from an artifact
  directory containing no artifacts, **never consulting the remote at all** [VERIFIED, w3s
  "A warm-graph copy masks the remote entirely"]. The run looks like a 4/4 success.
- **The reset changes the hash under test** (B4). The proof then answers "does a cold Windows box
  hit" and not "does my everyday box hit". Both are legitimate questions; record which one was
  asked.

## D3. An all-MISS is indistinguishable from a broken measurement

The Releases reader degrades **every** fault to a MISS by design (`releases-backend.ts:88-99`
[VERIFIED]) and warns at most **once per process** with only a numeric status. A mistyped port, a
token mismatch, a failed `gh auth token`, a rate limit and a genuine absence all render identically.

**Prevention (the w3s pattern, and it worked):** prove the measurement sound BEFORE running the
thing being measured -- a 401-vs-404 readiness pair on a known-absent hash proves auth AND
reachability, and a differential control against a dead port proves the requests actually left the
process. `ci.yml`'s readiness poll already demands exactly 404 or 200 for this reason
[VERIFIED, `ci.yml:320-332`]. Do the same locally before every Phase 11 proof, and record the
ordering (soundness probe timestamp before first Nx run).

## D4. Restore MISSes are invisible, and partial misses are silent by construction

`@actions/cache` logs a restore MISS at **`core.debug`**
(`cache.js` v2 path: `core.debug('Cache not found for version ...')`) [VERIFIED]. With
`ACTIONS_STEP_DEBUG` unset, every miss is absent from the job log. The publish summary now reports
`scanned` and `readMisses` (the `windows-publish-one-asset` proposal 1 has landed -- `publishMirror`
returns `{ scanned, mirrored, skipped, readMisses, failed }` [VERIFIED]), which closes the worst of
it. The residual: the all-miss **warning** still only fires on a TOTAL miss, so a partial regression
stays silent. For the Phase 9/11 live closes, **turn `ACTIONS_STEP_DEBUG` on for the specific
proving run** rather than reasoning from a normal log.

## D5. Green legs prove less than they look like they prove

From the same investigation: run 30181729913's Windows publish leg **mirrored zero task-hash
assets, MISSed 13 of 27, and exited green**. A leg whose Actions-cache read scope had fully
regressed would present identically. Any Phase 9-12 evidence of the form "the job was green" must be
paired with a **count** that would differ under the failure hypothesis. Name the count in the plan,
not after the run.

## D6. Attribution evidence is perishable and the window closes earlier than Phase 12

TEST-08 correctly captures producer attribution before Phase 12 enables O4. Note that Phase 9
already moves the boundary a little: once the Actions-cache version is OS-invariant, the ubuntu
publish leg starts mirroring the **Windows** `integration` entry too, so the shard gains
Windows-produced assets before Phase 11. `build`/`typecheck`/`test` attribution survives (Windows
runs none of them -- assert it, per B12), but the shard is no longer "everything here is ubuntu's".
Capture `created_at` and the OBS-03 `label` per asset, not just the asset list.

---

# Section E -- ESLint adoption in an Nx 23 workspace with no linter

## E1. Verified facts (so nobody re-litigates them)

| Claim | Verdict |
|---|---|
| Nx 23.1 requires ESLint v9+ | **CONFIRMED.** `@nx/eslint@23.1.0` peer: `eslint: "^9.0.0 \|\| ^10.0.0"` [VERIFIED via registry]. v8 is out of range. LINT-01's "v9 is mandatory, not preference" stands. |
| typescript-eslint supports this repo's TypeScript | **CLEARED -- not a pitfall.** `typescript-eslint@8.65.0` peer: `typescript: ">=4.8.4 <6.1.0"` [VERIFIED via registry]; this repo pins `typescript ~6.0.3`. No unsupported-version warning to plan around. |
| `@nx/eslint-plugin` pulls extra peers | **YES.** `@nx/eslint-plugin@23.1.0` peers `@typescript-eslint/parser ^8.0.0` and `eslint-config-prettier ^10.0.0`, and depends on `@typescript-eslint/utils` + `@typescript-eslint/type-utils` [VERIFIED]. |
| The project has no `nx` block today | **CONFIRMED.** `packages/github-cache/package.json` has no `nx` key [VERIFIED]; all four targets are inferred or come from `targetDefaults`. |

## E2. The graph-perturbation question, and the lazier answer

**The pitfall as stated is real.** `@nx/eslint/plugin` is an inference plugin. Adding it changes the
project's resolved target set, which changes the `ProjectConfiguration` hash node, which is folded
into every task hash -- so it invalidates any hash measurement taken before it. That is why the
ROADMAP puts Phase 7 first. Worse, an inference plugin is *exactly* the mechanism that produced the
`@nx/js/typescript` / atomizer OS-divergence class (`PITFALLS.md:329-330`), so a new inference
plugin is a new opportunity for an OS-divergent target inference.

**The lazier alternative, worth one sentence in the Phase 7 plan before it is dismissed:** a `lint`
target declared explicitly (in `nx.json` `targetDefaults` plus the project's own `nx.targets`, or as
a plain script target) needs **no inference plugin at all**. ESLint's flat config already knows what
to lint; `@nx/eslint`'s value here is target inference and a `@nx/eslint:lint` executor, neither of
which LINT-01..06 requires. Choosing the explicit target:

- removes the inference-plugin OS-divergence risk entirely;
- makes the `lint` target's `inputs` and `outputs` fully hand-controlled, which is what LINT-04
  needs anyway;
- **dissolves the Phase 7 -> Phase 8 ordering constraint**, since nothing about the project graph
  changes beyond one declared target (which still changes `ProjectConfiguration`, so keep the
  ordering -- but the *risk* it exists to manage shrinks a lot).

If `@nx/eslint` is adopted anyway (reasonable -- it is the ecosystem norm and the generator does the
wiring), then **verify the inferred `lint` target is byte-identical on Windows and Linux as part of
Phase 8's CORR-03 job**, treating it as a fourth target. It is the newest and least-tested inference
in the workspace.

## E3. `lint`'s own stale-cache false PASS (LINT-04) -- the specifics

This repo has already shipped this exact defect once (`typecheck` compiled specs its inputs
excluded). Three `lint`-specific instances:

1. **The flat config file must be an input.** `eslint.config.*` lives at the workspace root, so
   `{workspaceRoot}/eslint.config.mjs` (and any file it imports) must be listed explicitly. Editing
   a rule otherwise replays a cached PASS -- and the RED-before-GREEN proof (LINT-03) is exactly the
   activity that edits rules, so the false PASS will show up during LINT-03 itself and be
   misread as "the rule does not fire".
2. **Every file ESLint actually reads must be hashed.** ESLint lints more than `src/**`: config
   files (`vitest.config.mts`, `esbuild.action.mjs`), `start-cache-server/entry.ts`, and `*.cjs`
   helpers. If the `lint` inputs are narrower than the lint *scope*, the same bug returns.
3. **Do NOT enable type-aware linting unless a rule needs it.** `parserOptions.projectService` /
   `project` makes ESLint build a TypeScript program, so `lint` becomes sensitive to every file in
   that program plus the tsconfigs -- a much wider input set to declare correctly, and a much bigger
   stale-cache blast radius. None of LINT-02/05/06's rules are type-aware
   (`no-restricted-syntax` is syntactic; `ban-ts-comment` and `require-description` are
   comment/AST-level). Skip `projectService`.

**Reuse the existing guard.** `packages/github-cache/src/nx-target-inputs.spec.ts` already delegates
glob decisions to Nx's own resolver (`splitInputsIntoSelfAndDependencies` +
`extractPatternsFromFileSets` + `filterUsingGlobPatterns`) so it cannot drift from Nx's behaviour
[VERIFIED]. Extend it with `lint` probe files rather than writing a new mechanism. Note its own
recorded caveat: reading `nx.json` from a spec is only safe because `{workspaceRoot}/nx.json` is a
`test` input -- and **only `test` declares that input** (`build`, `typecheck` and `integration` do
not) [VERIFIED]. Do not move the guard to another target without moving the input.

## E4. The ban rule is an AST matcher, so it has evasions

`no-restricted-syntax` matches selectors, not semantics. All of these read the running machine and
none matches a naive `MemberExpression[object.name='process'][property.name='platform']`:

```
const { platform } = process;             // ObjectPattern destructuring
const p = process; p.platform;            // aliased object
import { platform } from 'node:os';       // named import, no member expression
import * as os from 'node:os'; os.tmpdir();
const key = 'platform'; process[key];     // computed member
```

LINT-03 requires the rule be proven RED. **Make the RED fixture cover the evasion shapes, not just
the three known violations**, or the rule is proven only against the cases that already exist. Two
of the three current violations are member expressions; the third
(`releases-backend.spec.ts` "derives a wrong-OS fixture from `process.platform`") may already be an
evasion shape -- check its actual expression before writing the selector.

Add `no-restricted-imports` for `node:os`/`os` in the unit-spec scope alongside the syntax rules;
it closes the whole import family in one line, which `no-restricted-syntax` cannot.

## E5. The scope split mirrors vitest by convention, not by construction

LINT-02 scopes with `files: ['**/*.spec.ts']` + `ignores: ['**/*.integration.spec.ts']` to mirror
`vitest.config.mts` / `vitest.integration.config.mts`. The integration config's include is
`['{src,tests}/**/*.integration.spec.{ts,mts,cts}'] ` [VERIFIED] -- note **`.mts` and `.cts` are in
the vitest include but would NOT match the lint `ignores: ['**/*.integration.spec.ts']`**. An
integration spec written as `.integration.spec.mts` would be linted as a UNIT spec and its
legitimate `process.platform` read would fail lint. Mirror the extension set, and add a spec that
asserts the two globs agree (the repo already does this class of drift guard for
`trust.ts`/`sync-gate.ts` allowlists).

## E6. The pin guard is name-scoped, not blanket

LINT-01 says new dev dependencies are "covered by the `pinned-deps` guard". **The guard does not
work that way.** `pinned-deps.spec.ts` asserts an exact-semver specifier for a **hard-coded list of
names** (`@actions/cache`, `@actions/core`, `@octokit/rest`, `@octokit/plugin-retry`,
`@octokit/plugin-throttling`, `esbuild`) [VERIFIED]. It does not enforce "every dependency is
exact", and indeed the workspace already carries ranges (`typescript ~6.0.3`, `vitest ~4.1.0`,
`prettier ^3.8.1`, `@types/node ^24.0.0`).

So "add the deps exact-pinned" and "the guard covers them" are two separate tasks. **Adding
exact-pinned ESLint deps without adding their names to `pinned-deps.spec.ts` leaves them
unguarded**, and a later `npm install eslint@latest` widening the specifier passes every check.
Decide deliberately whether ESLint deps are in the ROBUST-03 supply-chain class at all -- they are
build tooling, like `esbuild`, which IS in the list; `prettier`, comparable tooling, is NOT. Whatever
the answer, write it down in the spec's comment, which is where every other such decision lives.

---

# Section F -- "Looks done but isn't" checklist

- [ ] **VER-01/VER-04:** the cwd assertion covers `GITHUB_WORKSPACE`, not just "the Nx workspace
      root", and compares resolved case-normalised paths (B1).
- [ ] **VER-01:** `.nx/cache` is created before the first `writeFile`, and the literal's comment
      lock says *"gitignored"* as a reason, not only *"workspace-relative"* (B2).
- [ ] **VER-03:** the argument-position spec asserts index 3 for `saveCache(paths, key, options,
      enableCrossOsArchive)` and index 4 for `restoreCache(paths, key, restoreKeys, options,
      enableCrossOsArchive)` [both VERIFIED]. `saveCache`'s own JSDoc lists `@param
      enableCrossOsArchive` **before** `@param options` and is WRONG [VERIFIED, `cache.js:334-339`]
      -- assert against the implementation, never the doc comment.
- [ ] **VER-05:** the compression probe mirrors upstream's stdout+stderr capture and its
      empty-string rule, and is comment-locked to the pinned version (B9).
- [ ] **VER-06:** the Windows `dogfood-verify` leg asserts *provenance*, not presence, and its
      vacuity condition (no Windows seed leg) is written into the job (B8).
- [ ] **PARITY-01:** the named capture command emits per-node hash **details**, and the record says
      in one line why `nx show target inputs` is not sufficient (B3).
- [ ] **PARITY-02:** every recorded hash carries its graph state (cold / warm `.nx/workspace-data`)
      alongside Nx version, Node version and install mode (B4).
- [ ] **CORR-02/RETAIN-04:** the two filter branches are asserted mutually exclusive; the ~50
      PoC-era `.tar.gz` orphans have an explicit disposition; `CACHE_KEY_PREFIX` is pinned by spec
      and comment-locked as now governing four things (B10).
- [ ] **CORR-02:** `publish-mirror.ts:159`'s "byte-identical under CORR-01" comment is rewritten in
      the SAME commit (B6).
- [ ] **CORR-05:** the removals are verified against the LINT-02 rule *before* removal, and the RED
      fixture covers evasion shapes, not only the three known violations (E4).
- [ ] **LINT-04:** editing `eslint.config.*` re-runs `lint` -- proven by differential, not by
      reading the config; and the lint input set covers everything ESLint actually reads (E3).
- [ ] **LINT-01:** every new dev dependency name is ADDED to `pinned-deps.spec.ts`, not merely
      pinned in `package.json` (E6).
- [ ] **OBS-04:** the "second consecutive all-miss" tripwire is qualified by "with no
      version-affecting change in between" (B11).
- [ ] **TEST-08:** the Windows-produces-no-hash premise is asserted against the RESOLVED task graph
      for the Windows leg's actual command, and the assertion output is captured as evidence (B12).
- [ ] **TEST-10:** `nx reset` runs BEFORE the sidecar starts, and the proof records which question
      the cold state answers (B2c, D2).
- [ ] **All Phase 9-12 live closes:** `ACTIONS_STEP_DEBUG` on for the proving run; every "job was
      green" claim paired with a count that would differ under the failure hypothesis (D4, D5).
- [ ] **Comment locks:** `cache-archive-path.ts` and `release-asset-name.ts` headers rewritten, not
      left asserting the inverted invariant (A.1 P7.2b).

---

# Section G -- Pitfall-to-phase map

| # | Pitfall | Silence | Phase(s) |
|---|---|---|---|
| B1 | cwd / `GITHUB_WORKSPACE` / glob three-anchor split-brain | SILENT-3 | **9** |
| B2 | `.nx/cache` existence, gitignore-dependence, `nx reset` | SILENT-3 / LOUD | **9**, 11 |
| B3 | `nx show target inputs` blind to `ProjectConfiguration` and to content hashes | SILENT-3 | **8** |
| B4 | `.nx/workspace-data` freshness reproduces the divergence | SILENT-3 | **8**, 11 |
| B5 | Verdict sharing: a restored task never executes | SILENT-3 | **12**, record in 10 |
| B6 | First-write-wins over non-identical payloads; stale code comment | SILENT-3 | **10** |
| B7 | Cross-trust bridge widens; `ref` scoping becomes sole control | SILENT-3 | **10** |
| B8 | `publish-verify` and `dogfood-verify` vacuity | SILENT-3 | **9**, **10** |
| B9 | `getCompressionMethod` unexported; VER-05 duplicates it | SILENT-2 | **9** |
| B10 | Cleanup filter population; `CACHE_KEY_PREFIX` coupling | SILENT-2 | **10** |
| B11 | Two rotation windows colliding into a false red | SILENT-1 | **9**, **10** |
| B12 | Task graph vs job list for producer attribution | SILENT-3 | **11** |
| B13 | `max-parallel: 1` doing three jobs at once | SILENT-2 | **10** |
| D1 | `Cache: n/m hit` non-discriminating both ways | SILENT-3 | 8, **11**, 12 |
| D2 | Reset-related false proofs | SILENT-3 | **11** |
| D3 | All-MISS == broken measurement | SILENT-3 | **11** |
| D4 | Restore MISSes at `core.debug`; partial misses silent | SILENT-2 | 9, **11** |
| D5 | Green leg proves less than it looks | SILENT-3 | 9, 10, **11**, 12 |
| D6 | Attribution window closes at Phase 9, not Phase 12 | SILENT-3 | 9, **11** |
| E2 | Inference-plugin graph perturbation (and the explicit-target alternative) | LOUD | **7**, verify in 8 |
| E3 | `lint` stale-cache false PASS; no type-aware linting | SILENT-3 | **7** |
| E4 | AST-selector evasions | SILENT-3 | **7** |
| E5 | Lint scope vs vitest scope drift (`.mts`/`.cts`) | SILENT-2 | **7** |
| E6 | `pinned-deps` guard is name-scoped | SILENT-2 | **7** |
| A.1 P7.2b | Comment locks left asserting the inverted invariant | SILENT-3 | **9**, **10** |
| A.3 P2/P9 | Sole-mechanism collapse; MISS-not-wrong-result | SILENT-3 | all |

---

# Verification log

Everything marked [VERIFIED] was read this session from the paths below at the current `main`
(`fe25a3f`). No source, workflow, config, or GitHub state was modified.

**This tree**
- `node_modules/@actions/cache/lib/internal/cacheUtils.js:57-94` (`resolvePaths`), `:100-136`
  (`getVersion`/`getCompressionMethod`), `:157-172` (`getCacheVersion`)
- `node_modules/@actions/cache/lib/cache.js:118-144` (`restoreCache` signature + JSDoc), `:245-310`
  (`restoreCacheV2`, the `core.debug` miss), `:334-382` (`saveCache` signature + WRONG JSDoc order)
- `node_modules/@actions/cache/lib/internal/tar.js:56-100`, `:125-128` (`getWorkingDirectory`),
  `:228`
- `node_modules/@actions/cache/package.json` (exports map: `"." ` only)
- `node_modules/@actions/glob/lib/internal-pattern.js:132,160` (`process.cwd()` base)
- `node_modules/nx/dist/src/native/index.d.ts:76-101` (`HashPlanInspector`, `HttpRemoteCache`),
  `:277-282` (`CachedResult`), `:450-480` (`TaskHashDetails`, `HashInputs`)
- `node_modules/nx/dist/src/hasher/hash-task.js:26-172`,
  `node_modules/nx/dist/src/command-line/show/command-object.js:129-230`,
  `node_modules/nx/dist/src/command-line/show/show-target/inputs.js:34-55`
- Binary string probe of `@nx/nx-win32-arm64-msvc` for `ProjectConfiguration`, `TsConfig`,
  `AllExternalDependencies`, `hash_project_config`
- `packages/github-cache/src/backend/actions-cache-backend.ts:41-143` (three `@actions/cache` call
  sites at `:46`, `:101`, `:107`)
- `packages/github-cache/src/lib/cache-archive-path.ts`, `lib/release-asset-name.ts`,
  `lib/cache-key.ts:18-21`
- `packages/github-cache/src/publish/publish-mirror.ts:150-320` (dedup, `:159` byte-identical
  comment, `:218` miss branch, `:226` name derivation, all-miss warning, returned
  `{scanned, mirrored, skipped, readMisses, failed}`)
- `packages/github-cache/src/cleanup/cleanup.ts:60-115`,
  `src/backend/releases-backend.ts:1-105`, `src/server/server.ts:141-160`,
  `src/roundtrip/read-back.ts:1-60`
- `packages/github-cache/src/pinned-deps.spec.ts`, `src/nx-target-inputs.spec.ts`
- `nx.json`, `package.json`, `packages/github-cache/package.json`, `.gitattributes`, `.gitignore`,
  `packages/github-cache/vitest.integration.config.mts`
- `.github/workflows/ci.yml:320-332, 335-345, 361-366, 428-468, 577-615, 640-665`,
  `docs/advanced.md:40-70`

**Planning artifacts**
- `.planning/research/PITFALLS.md` (the v0.0.1 baseline audited in Section A)
- `.planning/debug/windows-publish-one-asset.md` (E1-E9; the measured 4/1 split, the `core.debug`
  miss, the summary blind spots, the two Pitfall 7 corrections)
- `.planning/quick/260725-w3s-.../260725-w3s-RESULTS.md` section 4 + `-LEARNINGS.md`
  (the graph-freshness table, the 50 PoC-era `.tar.gz` assets, `Cache: n/m` non-discrimination,
  the warm-graph masking)
- `.planning/quick/260725-rk4-.../260725-rk4-SUMMARY.md` (the `[remote cache]` label, the
  near-false-positive, the cross-OS probe)
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`,
  `.planning/RETROSPECTIVE.md`

**External (registry, read-only)**
- `registry.npmjs.org/@nx/eslint/23.1.0` -- peer `eslint ^9.0.0 || ^10.0.0`
- `registry.npmjs.org/@nx/eslint-plugin/23.1.0` -- peers `@typescript-eslint/parser ^8.0.0`,
  `eslint-config-prettier ^10.0.0`
- `registry.npmjs.org/typescript-eslint` -- latest 8.65.0, peer `typescript >=4.8.4 <6.1.0`

**Local clone**
- `D:/projects/github/actions/cache/tips-and-workarounds.md#cross-os-cache` and `README.md`
  (absolute paths / `~` / `${{ github.workspace }}` forbidden cross-OS; GNU tar + zstd required on
  Windows; symlinks and file compatibility caveats)

**NOT re-verified this session (stated at MEDIUM confidence where used)**
- `actions/cache#1622` itself was not fetched; the claim it supports is instead established
  directly from `getCacheVersion`'s source, which is stronger evidence than the issue.
- The Bazel / Gradle / Turborepo comparisons in Section C are pattern-level, from background
  knowledge, not re-checked against primary docs. They are used as corroboration, never as the
  basis for a recommendation.
- Whether Nx 23's own local-cache eviction can delete foreign files from `.nx/cache` (B2).

---
*Pitfalls research for: v0.0.2 OS-invariant cross-OS sharing*
*Researched: 2026-07-26*
</content>
</invoke>
