# Stack Research - v0.0.2 OS-invariant cross-OS cache sharing

**Domain:** Cross-OS artifact sharing for a shipped self-hosted Nx remote cache
**Researched:** 2026-07-26
**Confidence:** HIGH for everything read out of the pinned local clones
(`actions/toolkit` @ `@actions/cache` 6.2.0, `nrwl/nx` @ tag `23.1.0`) and the live npm registry;
MEDIUM for the one contested upstream fact (windows-11-arm zstd, section 2.4) which is flagged as
MUST-MEASURE rather than resolved.

> **Carry-forward, not repeated.** `.planning/research/STACK.md` (v0.0.1) remains authoritative for
> the Nx OpenAPI contract, the storage-primitive selection, the `pull_request`/`release` trust
> model, the deprecated-Nx-API trap list, and the `@octokit/rest` posture. This file adds ONLY what
> cross-OS sharing needs. Where v0.0.1 said "pin `@actions/cache` exact and treat the archive path
> as load-bearing", that is now the CENTRE of the milestone, so section 2 supersedes v0.0.1
> section 5's one-paragraph treatment with mechanism-level detail.

---

## 0. Net recommendation in one table

| Add | Exact version | Where | Why |
|-----|---------------|-------|-----|
| `eslint` | `9.39.5` | root `devDependencies` | LINT-01. Latest 9.x. See 1.2 for the v9-vs-v10 call. |
| `@eslint/js` | `9.39.5` | root `devDependencies` | Core recommended rule set. Keep the version in lockstep with `eslint`. |
| `typescript-eslint` | `8.65.0` | root `devDependencies` | The single meta-package (parser + plugin + `config()` helper). Peer `typescript >=4.8.4 <6.1.0` covers our `~6.0.3`. |
| `@eslint-community/eslint-plugin-eslint-comments` | `4.7.2` | root `devDependencies` | LINT-05 `require-description`. Named in the requirement. Has a `./configs` flat-config subpath export. |
| `@nx/eslint` | `23.1.0` | root `devDependencies` | LINT-01/LINT-04. Inference plugin; must match `nx`/`@nx/js`/`@nx/vitest` exactly at 23.1.0. |

**Nothing else.** No `jiti`, no `@vitest/eslint-plugin`, no `eslint-plugin-n`, no `prettier` ESLint
bridge, no new runtime dependency of any kind. Section 4 argues each rejection.

`@actions/cache` stays at exactly `6.2.0` - v0.0.2 changes ARGUMENTS, never the version. A version
bump and a cross-OS cutover in the same milestone would make an all-MISS push un-attributable.

---

## 1. ESLint 9 flat config

### 1.1 Verified registry state (2026-07-26)

| Package | `latest` | Published | Peer ranges (verified from the registry manifest) |
|---------|----------|-----------|---------------------------------------------------|
| `eslint` | `10.8.0` | 2026-07-24 | v10 peer: `{"jiti":"*"}`, **optional**. v10 engines: `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| `eslint` (9.x head) | `9.39.5` | 2026-07-10 | engines `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` |
| `@eslint/js` | `10.0.1` | 2026-02-06 | 9.x head is `9.39.5` |
| `typescript-eslint` | `8.65.0` | 2026-07-20 | `eslint: ^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`, `typescript: >=4.8.4 <6.1.0` |
| `@eslint-community/eslint-plugin-eslint-comments` | `4.7.2` | 2026-05-26 | `eslint: ^6 \|\| ^7 \|\| ^8 \|\| ^9 \|\| ^10` |
| `@nx/eslint` | `23.1.0` | 2026-07-13 | `eslint: ^9.0.0 \|\| ^10.0.0`; `@nx/jest` and `@zkochan/js-yaml` peers are **optional** |

`@nx/eslint@23.1.0`'s own `dependencies` include `typescript: ~6.0.3` - byte-identical to this
repo's pin, so no resolution conflict.

**LINT-01's premise is VERIFIED, not assumed.** `@nx/eslint@23.1.0`'s published peer range is
`^9.0.0 || ^10.0.0`. ESLint v8 is genuinely dropped.

### 1.2 Take ESLint 9.39.5, not 10.x

Every peer range above already admits v10, and v10 is flat-config-only (which we would be anyway),
so v10 is *unblocked*. Take 9.39.5 regardless:

- LINT-01 says v9. Nothing in the milestone needs a v10 feature.
- `eslint@10.8.0` is two days old at time of writing. This milestone's whole premise is removing
  accidental correctness; adding a two-day-old major to the toolchain that gates it is the wrong
  trade.
- **Unverified risk that 9.39.5 sidesteps:** `@nx/eslint`'s `resolveESLintClass`
  (`packages/eslint/src/utils/resolve-eslint-class.ts` @ 23.1.0) calls
  `eslintModule.loadESLint({ useFlatConfig })`. Whether `loadESLint` survives ESLint 10's removal of
  the eslintrc loader is **ASSUMED-UNKNOWN** - not checked. On 9.39.5 the call is documented and
  present.

The v10 bump is a one-line change later; nothing in the config shape below differs.

### 1.3 What `@nx/eslint` inference actually adds, and its OS-variance verdict

Register it in `nx.json` `plugins` (there is no auto-registration):

```jsonc
{ "plugin": "@nx/eslint/plugin", "options": { "targetName": "lint" } }
```

The inferred target, read from `packages/eslint/src/plugins/plugin.ts` @ 23.1.0
(`buildEslintTargets`, lines 453-516):

```js
{
  command: 'eslint .',
  cache: true,
  options: { cwd: '<projectRoot>' },
  inputs: [
    'default',
    '^default',
    '{workspaceRoot}/eslint.config.mjs',
    '{workspaceRoot}/tools/eslint-rules/**/*',
    { externalDependencies: ['eslint'] },
  ],
  outputs: ['{options.outputFile}'],
  metadata: { /* technologies, description, help */ },
}
```

#### The hash mechanism the sequencing constraint rests on - CONFIRMED

`hash_project_config` (`packages/nx/src/native/tasks/hashers/hash_project_config.rs:10-66`) hashes,
for the project:

```
project.root  +  tags  +  (for each target, sorted by name:
    targetName + executor + outputs.concat() + options + configurations + parallelism)
  +  project.namedInputs
```

and `HashInstruction::ProjectConfiguration(project)` is emitted for **every** task, on both branches
of `gather_self_inputs` (`packages/nx/src/native/tasks/hash_planner.rs:643` and `:655`).

So the REQUIREMENTS.md sequencing row "LINT-01 before PARITY-01" is mechanically correct: adding a
`lint` target inserts a new entry into the sorted `targets` string, changing
`hash_project_config`, which is folded into `build`, `typecheck`, `test` and `integration` alike.

**Two rotations, not one.** `nx.json` is ALSO an explicit fileset input of `test`
(`nx.json` targetDefaults `test.inputs` -> `{workspaceRoot}/nx.json`), so registering the plugin
rotates `test` twice over. Plan for the Phase 7 default-branch push to be an **all-MISS** push, and
reconcile that with OBS-04's "a SECOND consecutive all-miss push is a FAILURE" rule - Phase 7 and
Phase 9 each legitimately produce one.

#### OS-variance audit of the inferred target - CLEAN, with two caveats

Field by field against the hashed set:

| Hashed field | Value | OS-invariant? |
|--------------|-------|---------------|
| target name | `lint` | Yes - literal |
| executor | `nx:run-commands` (from `command` sugar) | Yes |
| `outputs` | `['{options.outputFile}']` | Yes - literal token, `outputFile` is never set |
| `options.command` | `eslint .` | Yes - literal |
| `options.cwd` | `packages/github-cache` | Yes - `dirname()` from `node:path/posix` (plugin.ts:22) over Nx's forward-slash glob results |
| `options.env` | absent | Only set for eslintrc (`ESLINT_USE_FLAT_CONFIG: 'false'`); we are flat |
| `metadata` | contains `${pmc.exec}` | **Not hashed at all** - `metadata` is absent from `hash_project_config` |

The `pmc.exec` scare is a non-issue *for the hash*: `metadata` is not hashed. (`pmc.exec` DOES reach
the hash elsewhere - see 3.3.)

Two residual caveats worth naming rather than asserting away:

1. **Target EXISTENCE, not target CONTENT, is the divergence risk.** If `@nx/eslint` infers a `lint`
   target on Linux and not on Windows (or vice versa), `hash_project_config` diverges and EVERY
   target's hash diverges - a new PARITY bug of exactly the class PARITY-01 exists to find. The
   existence gate runs `eslint.isPathIgnored(join(workspaceRoot, file))` where `join` is the
   **posix** join applied to an absolute Windows root (plugin.ts:22, :105), producing mixed
   separators (`D:\...\github-cache/packages/...`). Windows `existsSync` and ESLint's internal
   `path.resolve` both tolerate this, so it SHOULD be fine - but "should" is exactly what CORR-03's
   two-leg measurement is for. Verify empirically; do not reason it closed.
2. **`existsSync(join(workspaceRoot, projectRoot, 'src'))` is case-insensitive on Windows**
   (plugin.ts:424-428). It only matters for the ROOT project. Verified: this repo's root has no
   `src` and no `lib`, so `getProjectUsingESLintConfig` returns `null` for `.` (plugin.ts:430-432)
   and the root gets **no** lint target on either OS. Do not create a root `src/` or `lib/`
   directory during this milestone.

#### `.eslintignore`: do not create one

If `packages/github-cache/.eslintignore` exists, the plugin (a) constructs a per-project `ESLint`
instance instead of the shared one and (b) appends `{workspaceRoot}/packages/github-cache/.eslintignore`
to the inputs. Flat config ignores live in the config's `ignores` key; an `.eslintignore` file adds
an OS-touching `existsSync` branch for zero benefit. Skip it.

### 1.4 LINT-04: the inferred inputs have a real stale-PASS hole

`{ externalDependencies: ['eslint'] }` covers `eslint` and nothing else. A bump of
`typescript-eslint`, `@eslint/js`, or the comments plugin would NOT invalidate the `lint` cache -
precisely LINT-04's named failure class ("`typecheck`'s inputs excluded `*.spec.ts` while its
command compiled them"). Close it in `nx.json` `targetDefaults`:

```jsonc
"lint": {
  "inputs": [
    "default",
    "^default",
    "{workspaceRoot}/eslint.config.mjs",
    "{workspaceRoot}/tools/eslint-rules/**/*",
    { "externalDependencies": [
        "eslint",
        "@eslint/js",
        "typescript-eslint",
        "@eslint-community/eslint-plugin-eslint-comments"
    ]}
  ],
  "outputs": []
}
```

Two notes on that block:

- `targetDefaults.<target>.inputs` **REPLACES** the inferred inputs; it does not merge into them.
  Verified empirically on this repo: `nx.json`'s `test.inputs` fully replaced `@nx/vitest`'s
  inferred list, including dropping the plugin's `{ env: 'CI' }` entry (see 3.4 - that is
  load-bearing good news for O1). So the block above must restate every input it wants to keep.
- Pin `outputs: []`. Empty is honest (`eslint .` with no `--output-file` writes nothing) and it
  removes the `{options.outputFile}` token from `hash_project_config` entirely.

**Keep the rule set in the single root `eslint.config.mjs`.** A helper module imported by it would
NOT be a declared input unless it lives under `tools/eslint-rules/**/*` (already an inferred input)
or inside `{projectRoot}`. One file, or `tools/eslint-rules/` - nothing else.

### 1.5 `no-restricted-syntax` scoping and the two-rule requirement

Flat config `files`/`ignores` are **per config-object array-element** globs, evaluated against the
path relative to the config file's directory. The LINT-02 scoping mirrors `vitest.config.mts`
exactly:

```js
{
  files: ['**/*.spec.ts'],
  ignores: ['**/*.integration.spec.ts'],
  rules: { /* the ban */ },
}
```

An entry in `ignores` **alongside `files`** removes those files from THIS object only - it does not
globally ignore them (that is a config object with `ignores` and no other keys). So
`*.integration.spec.ts` still gets every other rule, and only loses the platform ban. That is
exactly CORR-06's "same APIs stay ALLOWED in `integration`".

**Two core rules are needed, not one** - because the repo uses both import styles
(`import { tmpdir } from 'node:os'` in `cache-archive-path.ts:1`, and
`import * as cache from '@actions/cache'` namespace style elsewhere):

| Access shape | Rule that catches it |
|--------------|----------------------|
| `import { tmpdir, EOL } from 'node:os'` / `import { sep } from 'node:path'` | `no-restricted-imports` with `paths: [{ name: 'node:os', importNames: [...] }]` |
| `os.tmpdir()`, `path.sep`, `process.platform`, `process.arch` | `no-restricted-syntax` with `MemberExpression` selectors |

Both are **core ESLint rules** - no plugin, no dependency. `no-restricted-imports` alone cannot ban
a specific member of a namespace import; `no-restricted-syntax` alone misses destructured named
imports. Wire both, or LINT-03's RED proof will pass for one shape and silently miss the other.

Selector sketch (esquery; `MemberExpression` matches both `a.b` and the computed form when
`[computed=false]` is omitted - constrain it):

```js
"no-restricted-syntax": ["error",
  { selector: "MemberExpression[object.name='process'][property.name=/^(platform|arch)$/]",
    message: "..." },
  { selector: "MemberExpression[property.name=/^(tmpdir|EOL|platform|arch|homedir|type|release)$/][object.name=/^(os|nodeOs)$/]",
    message: "..." },
  { selector: "MemberExpression[property.name=/^(sep|delimiter|win32|posix)$/][object.name='path']",
    message: "..." },
]
```

Also cover `import('node:os')` dynamic form if any spec uses it - `git grep -n "node:os\|node:path" -- 'packages/github-cache/src/**/*.spec.ts'`
before finalising the selector set, so LINT-03's three known violations are provably in scope.

### 1.6 LINT-05 / LINT-06 wiring

- `@eslint-community/eslint-plugin-eslint-comments@4.7.2` exposes flat configs at the
  **`./configs` subpath** (verified export map: `{".": ..., "./configs": ..., "./package.json": ...}`).
  Import `from '@eslint-community/eslint-plugin-eslint-comments/configs'`, then set
  `'@eslint-community/eslint-comments/require-description': ['error', { ignore: [] }]`.
  (Note the flat-config rule prefix is the scoped `@eslint-community/eslint-comments/`, not the
  legacy bare `eslint-comments/` that LINT-05's text uses. Same rule.)
- `@typescript-eslint/ban-ts-comment` with `{ 'ts-expect-error': 'allow-with-description',
  'ts-ignore': true }` - comes free with `typescript-eslint`, no extra package.
- LINT-06: set `linterOptions.reportUnusedDisableDirectives: 'error'` **explicitly** in the flat
  config. v9's default is a non-failing `warn`; setting it explicitly makes the default irrelevant
  and is one line. (`reportUnusedInlineConfigs` is a separate, newer `linterOptions` key worth a
  glance but is NOT required by any v0.0.2 requirement - skip it.)

### 1.7 LINT-01's pinning obligation - the guard already exists

`packages/github-cache/src/pinned-deps.spec.ts` already reads the ROOT manifest via
`new URL('../../../package.json', import.meta.url)` and asserts
`devDependencies['esbuild']` matches `/^\d+\.\d+\.\d+$/`. Adding the five new dev dependencies means
adding five sibling `it()` blocks in that same `describe` - no new file, no new mechanism.

---

## 2. `@actions/cache` 6.2.0 cross-OS support

All of section 2 is read from the local clone at exactly our pinned version
(`D:\projects\github\actions\toolkit\packages\cache`, `package.json` `"version": "6.2.0"`).

### 2.1 `enableCrossOsArchive` positions - VERIFIED, and the JSDoc IS wrong

```ts
// cache.ts:148   index 4 (5th arg)
export async function restoreCache(
  paths: string[], primaryKey: string, restoreKeys?: string[],
  options?: DownloadOptions, enableCrossOsArchive = false
): Promise<string | undefined>

// cache.ts:472   index 3 (4th arg)
export async function saveCache(
  paths: string[], key: string,
  options?: UploadOptions, enableCrossOsArchive = false
): Promise<number>
```

**The public `saveCache` JSDoc (cache.ts:463-471) lists the parameters in the order
`paths, key, enableCrossOsArchive, options` - which is NOT the signature.** Anyone writing the call
from the doc comment passes `true` where `options` belongs. TypeScript catches it here
(`boolean` is not `UploadOptions`), but the private `saveCacheV2` JSDoc (cache.ts:630-638) has the
CORRECT order, so the two disagree inside one file. This is exactly the trap VER-03 names.
`restoreCache`'s JSDoc has the right order but calls the 4th param `downloadOptions` while the
signature calls it `options`.

The three call sites in `packages/github-cache/src/backend/actions-cache-backend.ts` become:

| Line | Today | v0.0.2 |
|------|-------|--------|
| `:46` | `cache.restoreCache([path], cacheKeyFor(hash))` | `cache.restoreCache([path], cacheKeyFor(hash), [], undefined, true)` |
| `:101` | `cache.saveCache([path], cacheKeyFor(hash))` | `cache.saveCache([path], cacheKeyFor(hash), undefined, true)` |
| `:107` | `cache.restoreCache([path], cacheKeyFor(hash), [], { lookupOnly: true })` | `cache.restoreCache([path], cacheKeyFor(hash), [], { lookupOnly: true }, true)` |

Note `actions-cache-backend.spec.ts:91-95` already asserts the `:107` argument list - VER-03's
"a spec asserts the argument list of each call and the call count" is an extension of an existing
assertion, not a new pattern.

### 2.2 `getCacheVersion` - the exact recipe

`internal/cacheUtils.ts:136-159`:

```ts
const versionSalt = '1.0'                       // module constant, line 16
export function getCacheVersion(paths, compressionMethod?, enableCrossOsArchive = false) {
  const components = paths.slice()              // RAW strings, not resolved, not normalised
  if (compressionMethod) components.push(compressionMethod)
  if (process.platform === 'win32' && !enableCrossOsArchive) components.push('windows-only')
  components.push(versionSalt)
  return sha256(components.join('|'))
}
```

Three consequences, each mapping to a v0.0.2 requirement:

1. **`paths` is hashed RAW.** `saveCacheV2` calls `utils.getCacheVersion(paths, ...)` at cache.ts:689
   with the caller's array - NOT the `cachePaths` that `resolvePaths()` produced two lines earlier.
   So `join(tmpdir(), ...)` really does put `C:\Users\RUNNER~1\AppData\Local\Temp\...` vs
   `/home/runner/work/_temp/...` into the version. **VER-01 is correct and load-bearing.**
2. `compressionMethod` is a **runtime probe**, not a constant - see 2.4. **VER-05.**
3. The `'windows-only'` salt is the ONLY thing `enableCrossOsArchive` suppresses. It changes
   nothing else about the version. **VER-03.**

`getCacheVersion` is genuinely not exported from the package (`exports` map in
`packages/cache/package.json` has a single `"."` entry resolving to `lib/cache.js`, which does not
re-export `cacheUtils`). VER-02's "the derived version is NOT assertable" is confirmed.

### 2.3 A relative `.nx/cache/...` path: what breaks, what does not

VER-01/D2-04 change the path to a workspace-relative forward-slash literal. Four things to get right:

**(a) `@actions/glob` accepts it.** The validator is
`literalSegments.every((x, i) => (x !== '.' || i === 0) && x !== '..')`
(`packages/glob/src/internal-pattern.ts:205-211`). A leading `.` SEGMENT is explicitly allowed at
`i === 0`; and `.nx` is a segment literally named `.nx`, not `.`. So
`.nx/cache/nx-github-cache-<hash>.tar` passes. **Upstream issue #1087 does not apply to us** - it is
about a `/./` segment appearing MID-path in an absolute path (`/home/runner/..././/dictionaries`),
which our literal never produces. #1087 is OPEN with no activity since 2024-03; treat it as
irrelevant, not as a blocker.

**(b) `saveCache` resolves the pattern against `cwd`, but relativises against `GITHUB_WORKSPACE`.**
`resolvePaths` (`internal/cacheUtils.ts:48-70`):

```ts
const workspace = process.env['GITHUB_WORKSPACE'] ?? process.cwd()
const globber = await glob.create(patterns.join('\n'), { implicitDescendants: false })
// ... path.relative(workspace, file).replace(/\\/g, '/')
```

**(c) `extractTar` extracts relative to `GITHUB_WORKSPACE`, NOT to `cwd`.**
`internal/tar.ts:164-166`: `function getWorkingDirectory() { return process.env['GITHUB_WORKSPACE'] ?? process.cwd() }`,
used for both create (`:63`) and extract (`:278`).

Combining (b) and (c): **if `process.cwd() !== GITHUB_WORKSPACE`, restore writes the archive to
`$GITHUB_WORKSPACE/.nx/cache/...` while `readFile(path)` reads `$CWD/.nx/cache/...` - an ENOENT that
today's absolute `tmpdir()` path makes impossible.** So **VER-04's cwd assertion must check BOTH**:
that `cwd` is the Nx workspace root AND that, when `GITHUB_WORKSPACE` is set, it resolves to the same
directory. A cwd-only check leaves the split-brain open. (Locally `GITHUB_WORKSPACE` is unset and
falls back to `cwd`, so this is a CI-only hazard - which is where the Actions backend lives anyway.)

**(d) The directory must exist.** `writeFile('.nx/cache/nx-github-cache-<hash>.tar', bytes)` does NOT
create `.nx/cache`. `tmpdir()` always exists; `.nx/cache` may not on a cold runner (and Nx's cache
dir is relocatable via `NX_CACHE_DIRECTORY` / `nx.json` `cacheDirectory`, so its existence is not
even implied by Nx running). Add one `mkdir(dir, { recursive: true })` at backend construction.

**Collision note, worth one line of thought at plan time.** `.nx/cache/` is also where Nx keeps its
own decimal-hash-named entry directories AND `run.json` (section 3.5). Dropping our tar files
alongside them is safe but noisy. Recommend a subdirectory - `.nx/cache/github-cache/` - which still
satisfies D2-04 ("under `.nx/cache/`") and keeps our files out of Nx's namespace. Either choice is a
byte-identical literal; pick one and never touch it again.

### 2.4 Issue #1622 - the one thing that can defeat `enableCrossOsArchive` outright

`actions/cache#1622` "windows-latest cache is not compatible with windows-11-arm" - **OPEN**, last
activity 2026-07-10. Read in full.

The mechanism: `getCompressionMethod()` (`internal/cacheUtils.ts:102-112`) shells out to
`zstd --quiet --version`; empty output -> `CompressionMethod.Gzip` (`'gzip'`), otherwise
`ZstdWithoutLong` (`'zstd-without-long'`). That string is a version component. **The windows-11-arm
image historically omitted `zstd`, so it produced `gzip` while ubuntu produced `zstd-without-long` -
different versions, cross-OS restore MISSes even with `enableCrossOsArchive: true`.** This is the
exact runner pair our CI uses (`ci.yml`: `ubuntu-24.04-arm` and `windows-11-arm`).

**The evidence is CONTRADICTORY and must be measured, not assumed:**

| Source | Says | Checked |
|--------|------|---------|
| `actions/cache#1622` last comment (Vampire, 2026-07-10) | "the arm runners now have zstd installed by default already" | 2026-07-26 |
| `actions/partner-runner-images` `images/arm-windows-11-image.md` (Image Version `20260105.41.1`) | `zstd` is STILL listed under `## Omitted software` -> "Tools that are not available on Windows 11 Arm image", line 217 | 2026-07-26 |

One of the two is stale. **Do not let a phase plan assume either.** Consequences:

- If windows-11-arm has no zstd, **O4 / XOS-05 is impossible at the library level** regardless of
  `enableCrossOsArchive`, and the milestone's Actions-cache layer stalls. O1/O2 (the Releases mirror)
  are unaffected - they do not go through `@actions/cache` at all.
- The proven workaround from the issue thread is a pre-step `choco install zstandard` on the
  windows-11-arm leg. Chocolatey **2.6.0 is present on the image** (verified in the same readme), so
  the workaround is available.
- The compression method is still NOT configurable in 6.2.0 (that is why #1622 remains open, per the
  2026-07-10 comment). Forcing gzip on both legs is not an option.

**This elevates VER-05 from observability to the tripwire for this exact regression.** Surfacing the
resolved compression method in the publish summary is how a future zstd removal (image change,
self-hosted runner, consumer runner) becomes visible instead of a silent full MISS. Keep it
surfaced-not-gated as the requirement says, and record the measured value for both legs in the
CORR-03 / VER-06 evidence.

**Recommended addition to the Phase 9 plan (cheap, high value):** before any code lands, run a
throwaway workflow on both legs that just prints `zstd --version || echo NONE` and `tar --version`.
Two minutes of CI answers whether O4 is reachable.

### 2.5 The other cross-OS axis upstream names: the tar binary

`actions/cache` README:88 - "If you are using a `self-hosted` Windows runner, `GNU tar` and `zstd`
are required for Cross-OS caching to work." `getTarPath()` (`internal/tar.ts:18-50`) prefers
`%PROGRAMFILES%\Git\usr\bin\tar.exe` (GNU) on Windows and falls back to
`%SYSTEMDRIVE%\Windows\System32\tar.exe` (BSD), which triggers a `BSD_TAR_ZSTD` two-step workaround.
The arm-windows-11 image ships Git 2.52.0.windows.1, so GNU tar SHOULD be present - **ASSUMED, not
verified**. Fold `where tar` / `tar --version` into the same two-minute probe as 2.4.

Upstream's own cross-OS guidance, which is the doc-level basis for VER-01
(`tips-and-workarounds.md:33-36`):

> - Only cache files that are compatible across OSs.
> - Be mindful when caching files from outside your github workspace directory as the directory is
>   located at different places across OS.
> - Avoid using directory pointers such as `${{ github.workspace }}` or `~` (home) which eventually
>   evaluate to an absolute path that does not match across OSs.

---

## 3. Nx 23.1.0 specifics for hash parity

### 3.1 The complete hash-instruction taxonomy (what PARITY-01 must partition by)

From `hash_planner.rs` `gather_self_inputs` + `task_hasher.rs`, the instruction kinds a task hash is
built from:

| Instruction | Source in our config | Cross-OS risk |
|-------------|----------------------|---------------|
| `ProjectFileSet` | `{projectRoot}/**/*` filesets | File CONTENT (CRLF - closed by `.gitattributes`) and the file LIST (case, presence) |
| `WorkspaceFileSet` | `{workspaceRoot}/...` entries in `test.inputs` | Same |
| `ProjectConfiguration` | ALWAYS, every task | See 3.2 - audited clean today |
| `TsConfiguration` | ALWAYS, every task | `tsconfig.base.json` compilerOptions + the `typescript` external-node hash |
| `External` | `{ externalDependencies: [...] }` | Lockfile-derived. See 3.3 |
| `Runtime` | `{ runtime: 'node -p process.platform' }` on `integration` ONLY | Deliberate - CORR-04 |
| `Environment` | none in our targetDefaults (see 3.4) | Would be a silent local-vs-CI divergence |
| `Cwd` | none | - |
| `DepsOutputs` | `dependentTasksOutputFiles` | Content of upstream outputs |

PARITY-01's root-cause record should be structured on exactly this list - it is the complete set,
and "which instruction differs" is a strictly smaller question than "why do the hashes differ".

### 3.2 `hash_project_config` - audited on this repo, on Windows, today

Ran `npx nx show project @op-nx/github-cache --json` on the native Windows workstation. Every hashed
field is already forward-slashed and `{projectRoot}`-tokenised:

```
typecheck  outputs {projectRoot}/tsconfig.tsbuildinfo, {projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}[.map],
                   {projectRoot}/dist/tsconfig.lib.tsbuildinfo,
                   {projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}[.map],
                   {projectRoot}/out-tsc/vitest/tsconfig.spec.tsbuildinfo
           options {"cwd":"packages/github-cache","command":"tsc --build tsconfig.json --emitDeclarationOnly"}
build      outputs {projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map},
                   {projectRoot}/dist/tsconfig.lib.tsbuildinfo
           options {"cwd":"packages/github-cache","command":"tsc --build tsconfig.lib.json"}
test       outputs {projectRoot}/test-output/vitest/coverage
           options {"cwd":"packages/github-cache","command":"vitest"}
integration outputs undefined
           options {"command":"vitest run --config vitest.integration.config.mts","cwd":"packages/github-cache"}
root       packages/github-cache      tags ["npm:public"]      namedInputs undefined
```

Source-level confirmation that this is by construction, not luck:

- `@nx/js/typescript` `pathToInputOrOutput` (`packages/js/src/plugins/typescript/plugin.ts:1144-1162`)
  ends every output with `joinPathFragments('{projectRoot}', normalizePath(relative(...)))`, and
  `joinPathFragments` = `normalizePath(path.join(...))` where
  `normalizePath = removeWindowsDriveLetter(p).split('\\').join('/')`
  (`packages/nx/src/utils/path.ts:12-22`). Backslashes and the drive letter are stripped.
- `@nx/vitest` `normalizeOutputPath` (`packages/vitest/src/plugins/plugin.ts:437-460`) has ONE
  OS-sensitive branch: `isAbsolute(outputPath) -> \`{workspaceRoot}/${relative(workspaceRoot, outputPath)}\``
  uses NATIVE `relative`, which yields backslashes on Windows. **We do not hit it** -
  `vitest.config.mts` sets `coverage.reportsDirectory: './test-output/vitest/coverage'` (relative,
  no leading `..`), so the `joinPathFragments('{projectRoot}', ...)` branch runs. Empirically
  confirmed above. **Never make `reportsDirectory` absolute** - that single change would diverge
  `hash_project_config` cross-OS and therefore diverge every task hash. Worth a comment lock in
  `vitest.config.mts`.

**Interim conclusion for the roadmapper: `hash_project_config` is NOT the current
`build`/`typecheck`/`test` divergence.** That is a narrowing result, not an answer - PARITY-01's
root-cause work remains genuinely open and should start from `External` and `ProjectFileSet`.

### 3.3 `External` - the strongest remaining PARITY-01 hypothesis

`build`/`typecheck` declare `{ externalDependencies: ['typescript', 'tslib', '@types/node'] }` and
`test` declares `{ externalDependencies: ['vitest'] }`. Nx hashes external nodes transitively from
the lockfile. Two reasons to look here first:

1. This repo already has a recorded incident of a Windows `npm install` pruning the Linux
   `@emnapi` WASM-fallback subtrees from `package-lock.json` (see the project memory
   `windows-npm-install-prunes-linux-optional-deps`). Any lockfile asymmetry across platform-specific
   optional dependencies - `@rollup/rollup-*`, `@swc/core-*`, `esbuild` platform packages, all
   reachable from `vitest` -> `vite` -> `rollup` - lands directly in this instruction.
2. PARITY-04 already mandates recording the install mode (`npm ci` vs `npm install`) precisely
   because of this. Honour it: a measurement taken after a bare `npm install` on Windows is not
   comparable to one taken after `npm ci`.

Also in this bucket, and relevant to DOCS-07 rather than to us: the `watch-deps` inferred target's
`options.command` is `npx nx watch ...`, where `npx` comes from `getPackageManagerCommand().exec`.
For npm that is the constant `npx`. For **pnpm** it is `modernPnpm ? 'pnpm exec' : 'pnpx'` and for
**yarn** it depends on a berry check - both resolved from the LOCALLY INSTALLED package-manager
version (`packages/nx/src/utils/package-manager.ts:185-190`, `:214`). Since `options` IS hashed by
`hash_project_config`, a pnpm/yarn consumer whose two machines have different PM versions gets a
cross-machine hash divergence on EVERY target. We are on npm so this is inert here, but it belongs
in DOCS-07's portability checklist as an axis `process.platform` does not cover.

### 3.4 `Environment` - a trap this repo has already (accidentally) avoided

`@nx/vitest`'s inferred `test` target includes `{ env: 'CI' }` in its inputs
(`packages/vitest/src/plugins/plugin.ts`, `testTarget`). `CI` is `true` on any GitHub runner and
unset on a developer workstation - **which would make O1 structurally impossible for `test`**, since
a local Windows `test` hash could never equal a CI-produced one.

**We are safe, verified empirically:** `nx.json`'s `targetDefaults.test.inputs` REPLACES the inferred
list, and the resolved `test.inputs` (printed from `nx show project --json`) contains no `env` entry.

Two obligations follow, and neither is currently written down anywhere:

- **Do not "restore" the inferred inputs** for `test` (e.g. by deleting the targetDefaults block, or
  by adding `'default', '^default'` back in a way that lets the plugin's list through). Add a
  comment in `nx.json` recording WHY the explicit list exists.
- **Apply the same discipline to the new `lint` target** (1.4). `@nx/eslint`'s inferred inputs happen
  not to include an `env` entry today, but the general rule - "an inferred input list is not audited
  until you have printed it" - is the lesson.

### 3.5 The capture command PARITY-01 asks for: `.nx/cache/run.json`

PARITY-01 requires "the capture command named". Nx 23.1.0 has **no** CLI flag that prints a task
hash - verified empirically: `NX_VERBOSE_LOGGING=true npx nx run @op-nx/github-cache:typecheck`
prints plugin-worker noise and `[local cache]` labels, and no hash.

It does write one, unconditionally. `StoreRunInformationLifeCycle`
(`packages/nx/src/tasks-runner/life-cycles/store-run-information-life-cycle.ts`) is pushed onto the
lifecycle list with **no condition** at `packages/nx/src/tasks-runner/run-command.ts:1118`, and its
`endCommand()` writes `<cacheDir>/run.json`. Verified by reading the file this repo just produced:

```json
{ "run": { "command": "nx run @op-nx/github-cache:typecheck", ... },
  "tasks": [
    { "taskId": "@op-nx/github-cache:build", "target": "build",
      "projectName": "@op-nx/github-cache", "hash": "3919282196916976507",
      "cacheStatus": "local-cache-hit", "status": 0, "startTime": ..., "endTime": ... },
    { "taskId": "@op-nx/github-cache:typecheck", "target": "typecheck",
      "hash": "12605558494450641434", "cacheStatus": "local-cache-hit", ... } ] }
```

`cacheStatus` is one of `remote-cache-hit` / `local-cache-hit` / `cache-miss`
(mapped from the task status at lines 68-75).

**This one file services five requirements at once**, with zero new tooling:

| Requirement | What `run.json` gives it |
|-------------|--------------------------|
| PARITY-01/02/03 | `hash` per `target` per leg; the named capture command is `nx run-many -t build typecheck test && cat .nx/cache/run.json` |
| CORR-03 | Both matrix legs upload their `run.json`; a comparison job asserts exactly two records, `integration` differs, the other three are identical |
| TEST-08 / TEST-09 | The recorded hash, machine-readable, per proof |
| OBS-02 | `cacheStatus === 'remote-cache-hit'` is the STRUCTURED equivalent of the `[remote cache]` terminal label - a non-zero count named per target, without scraping ANSI-coloured stdout |

Three caveats to write into the plan:

- It is **overwritten by every `nx` invocation**. Copy it out immediately after the measured run,
  before any other Nx command (including a `nx show project` in a later step) runs.
- It lands in `cacheDir`, which respects `NX_CACHE_DIRECTORY` / `nx.json` `cacheDirectory`. Resolve
  the location rather than hardcoding `.nx/cache` in the capture step if a consumer recipe ever
  quotes it.
- Only tasks that participated in THAT command appear. `nx run-many -t build typecheck test` in one
  invocation gives all three in one file; three separate invocations give three files, each
  clobbering the last.

`.nx/cache` is gitignored (`.gitignore`), so the captured copy must be written elsewhere (a CI
artifact, or the phase's evidence directory).

### 3.6 `targetDefaults` `outputs` pinning and the filtered nested-array shape (#36049)

**Pinning `outputs`.** `targetDefaults` entries become *synthetic targets* merged into the
inferred/specified target in document order
(`packages/nx/src/project-graph/utils/project-configuration/target-defaults.ts`,
`buildSyntheticTargetsForRoot`). Setting `outputs` there makes the value an authored literal instead
of a plugin computation - which is what takes the `@nx/vitest` `isAbsolute` branch (3.2) and the
`{options.outputFile}` token (1.4) permanently out of `hash_project_config`. Recommended for the new
`lint` target (`outputs: []`); **optional** for `build`/`typecheck`/`test`, whose computed values are
already verified invariant, and where restating a long generated glob list by hand is a maintenance
liability with no proven benefit. Do not pin what you have measured to be stable.

**The nested-array shape.** At 23.1.0 a `targetDefaults` value is `oneOf`:

```jsonc
"targetDefaults": {
  "test": { /* plain config object - what nx.json uses today */ },
  "lint": [                                  // NEW: ordered array of filtered entries
    { "outputs": [] },                       // no `filter` = catch-all baseline
    { "filter": { "plugin": "@nx/eslint" }, "inputs": [ /* ... */ ] }
  ]
}
```

`filter` accepts `plugin` (originating plugin), `projects` (names / globs / `tag:` selectors, via
`findMatchingProjects`) and `executor`. Entries apply in document order, **last match winning**; an
entry incompatible with the effective target shape (e.g. it sets a foreign `executor`) is dropped
individually rather than replacing the target wholesale.

**Do not use the array form in v0.0.2.** One project, one plugin per target - the filter has nothing
to narrow. The plain object form is what the existing `nx.json` uses and is what the roadmapper
should keep. The shape is documented here only so nobody reaches for it and so nobody is surprised by
a schema that permits both. Note the merge is per-entry with source-map attribution - useful for
debugging a future divergence, not needed now.

### 3.7 Two smaller Nx facts worth carrying into plans

- `@nx/js/typescript` and `@nx/vitest` each maintain their own `PluginCache` file in
  `.nx/workspace-data/` keyed by an options hash (`tsc-<n>.hash`, `vitest-<n>.hash`, and `@nx/eslint`
  will add `eslint-<n>.hash`). These are LOCAL, gitignored, and per-worktree - not hash inputs. A
  stale one can produce a confusing local-only graph; `nx reset` clears them. Say so in the PARITY
  measurement procedure so a "divergence" is never actually a stale plugin cache.
- Nx renders a task hash as an unsigned 64-bit **decimal** string (18-20 digits) - `ci.yml:666-671`
  already relies on this, and `run.json` confirms it (`3919282196916976507`). The `nx-cache-<hash>`
  asset name under CORR-02 therefore stays inside the server's `^[a-f0-9]{1,512}$` validator only
  because decimal digits are a subset of hex. Nothing to change; just do not let anyone "improve" the
  validator.

---

## 4. What NOT to add

The project ships **five** runtime dependencies and one of them (`@actions/core`) is shared with the
root. Keep it that way. Each rejection below is a thing a reasonable person will propose.

| Tempting | Why NOT |
|----------|---------|
| **`jiti`** (for `eslint.config.ts`) | Only needed if the flat config is TypeScript. Write `eslint.config.mjs`. The config is a plain object literal with two rule blocks; types buy nothing and `jiti` is an extra install plus a transpile step in the `lint` critical path. ESLint 10 lists `jiti` as an OPTIONAL peer for exactly this reason. |
| **`@vitest/eslint-plugin`** (`1.6.24`) | LINT-02's ban is about `process.platform` and `node:os`, not about Vitest idioms. Nothing in LINT-01..06 or CORR-06 needs a Vitest rule. It also declares `@typescript-eslint/eslint-plugin` as a peer, pulling a second path to the TS toolchain. (Note in passing: the OLD `eslint-plugin-vitest` is dead - last publish 2024-04-23 - so anyone who does add Vitest rules later must use the `@vitest/` scoped one.) |
| **`eslint-plugin-n`, `eslint-plugin-import`, `eslint-plugin-unicorn`** | Each would flag hundreds of pre-existing findings across a shipped codebase, turning a one-phase lint adoption into an open-ended cleanup. LINT-01's scope is "a `lint` target exists and the platform ban is enforced". Ecosystem hygiene rules are a later, separate decision. |
| **`eslint-config-prettier` / `eslint-plugin-prettier`** | The repo already runs `nx format:check` (Prettier directly). A bridge package only matters if ESLint enables stylistic rules - `@eslint/js` recommended and `typescript-eslint` recommended do not. Adding it pre-emptively is a dependency for a conflict that does not exist. |
| **A custom ESLint rule / `tools/eslint-rules/` workspace-rules project** | `no-restricted-syntax` + `no-restricted-imports` are CORE rules and cover every shape in LINT-02 (see 1.5). A custom rule means a new buildable project, its own tsconfig, its own tests, and its own place in the project graph - i.e. a fresh `hash_project_config` surface in the milestone that is trying to stabilise hashes. |
| **Bumping `@actions/cache` past 6.2.0** | The version is a cache-version input by construction (2.2). Bumping it inside this milestone makes the mandatory all-MISS push (OBS-04) impossible to attribute between "our path change" and "their compression/salt change". Bump it in a later, isolated change gated on the `test:act` end-to-end restore. |
| **A `zstd`-forcing dependency, or vendoring zstd** | Not configurable in 6.2.0 (2.4). The supported lever is the runner image (`choco install zstandard` as a workflow step), which is a workflow change, not a package. |
| **`node:path` anywhere near `cacheArchivePath()`** | VER-01 forbids it and the forbidding is the point: `join`/`resolve`/`normalize` are exactly how a forward-slash literal becomes a backslash one on Windows. The replacement is a template literal. This is a REMOVAL of an import, not an addition. |
| **An OS-separation env knob / action input** | D2-02, PARITY-05. Zero adopters. The public-surface guard already fails on a new export or input, and that guard passing unchanged is itself a v0.0.2 requirement. |
| **A cross-process lock library for the new `.nx/cache/` path** | The existing `withHashLock` is in-process and the `cacheArchivePath` comment already documents the cross-process invariant and its upgrade path (an `fs.mkdir` sentinel, no dependency). Moving the path from `tmpdir()` to `.nx/cache/` does not change the concurrency story - it is the same single deterministic path per hash. |
| **A hash-diffing tool / library for CORR-03** | `run.json` (3.5) is first-party, machine-readable JSON. Two `node -e`-free comparisons over two uploaded artifacts. No `jq` dependency needed either - Node is already installed on both legs. |
| **`@nx/jest`** | `@nx/eslint@23.1.0` declares it as a peer, but `peerDependenciesMeta` marks it **optional** (verified on the published manifest). npm will not install it and will not warn. Do not add it. |

---

## 5. Installation

```bash
# root devDependencies, exact-pinned per ROBUST-03 / LINT-01
npm i -D -E eslint@9.39.5 @eslint/js@9.39.5 typescript-eslint@8.65.0 \
           @eslint-community/eslint-plugin-eslint-comments@4.7.2 @nx/eslint@23.1.0
```

`-E` (`--save-exact`) is required - a `^` specifier fails `pinned-deps.spec.ts` (1.7).

**Regenerate the lockfile in a linux/arm64 container, not on Windows.** A bare Windows `npm install`
prunes the Linux-only optional subtrees from `package-lock.json`, which breaks CI `npm ci` and is
invisible locally (recorded project memory). This is doubly important in THIS milestone, because
lockfile asymmetry is also the leading `External`-instruction hypothesis for the parity bug (3.3).

No runtime dependency changes. `packages/github-cache/package.json` is untouched by Phase 7.

---

## 6. Version compatibility

| Package A | Compatible with | Verified how |
|-----------|-----------------|--------------|
| `eslint@9.39.5` | `@nx/eslint@23.1.0` (peer `^9 \|\| ^10`), `typescript-eslint@8.65.0` (peer `^8.57 \|\| ^9 \|\| ^10`), comments plugin `4.7.2` (peer `^6..^10`) | registry manifests, 2026-07-26 |
| `typescript-eslint@8.65.0` | `typescript@~6.0.3` (peer `>=4.8.4 <6.1.0`) | registry manifest |
| `@nx/eslint@23.1.0` | `nx`/`@nx/js`/`@nx/vitest` @ `23.1.0`; carries `typescript ~6.0.3` as a direct dep | registry manifest + `nrwl/nx` tag 23.1.0 |
| `@actions/cache@6.2.0` | Node 24; `@actions/core ^3.0.1` (we pin `3.0.1`) | local clone `packages/cache/package.json` |
| Node 24 | `eslint@9` engines `^18.18 \|\| ^20.9 \|\| >=21.1`; `eslint@10` engines `^20.19 \|\| ^22.13 \|\| >=24` | registry manifests |

---

## 7. Open items, labelled

| Item | Status |
|------|--------|
| Does windows-11-arm ship `zstd` today? | **MUST-MEASURE.** Two authoritative sources disagree (2.4). Gates O4/XOS-05. Two-minute CI probe. |
| Is GNU tar present at `%PROGRAMFILES%\Git\usr\bin\tar.exe` on windows-11-arm? | **ASSUMED** present (image ships Git 2.52.0.windows.1). Same probe. |
| Does `eslint@10`'s API still expose `loadESLint`? | **NOT CHECKED.** Irrelevant at 9.39.5; check before any v10 bump. |
| Which hash instruction actually diverges for `build`/`typecheck`/`test`? | **OPEN - this is PARITY-01.** `ProjectConfiguration` is ruled out (3.2, verified on Windows). Start at `External` (3.3), then `ProjectFileSet`. |
| Does `@nx/eslint` infer the `lint` target identically on both OSes? | **UNVERIFIED BY DESIGN.** Reads clean at source (1.3) but the mixed-separator `isPathIgnored` path is not provable by reading. CORR-03's two-leg job settles it. |
| ESLint 9's default `reportUnusedDisableDirectives` value | Moot - LINT-06 sets it explicitly to `'error'` (1.6). |

---

## Sources

Local clones, read directly (HIGHEST confidence - these are our exact pinned versions):

- `D:\projects\github\actions\toolkit\packages\cache` @ `6.2.0` - `src/cache.ts` (signatures + the
  wrong JSDoc at :463-471), `src/internal/cacheUtils.ts` (`getCacheVersion` :136-159,
  `getCompressionMethod` :102-112, `resolvePaths` :48-70), `src/internal/tar.ts`
  (`getWorkingDirectory` :164-166, `getTarPath` :18-50), `src/internal/constants.ts`
- `D:\projects\github\actions\toolkit\packages\glob\src\internal-pattern.ts:205-211` - the
  "Relative pathing" assertion that #1087 is about
- `D:\projects\github\actions\cache` - `README.md:88`, `tips-and-workarounds.md:29-36`
- `D:\projects\github\nrwl\nx` @ tag `23.1.0` -
  `packages/nx/src/native/tasks/hashers/hash_project_config.rs`,
  `packages/nx/src/native/tasks/hash_planner.rs:620-680`,
  `packages/nx/src/native/tasks/task_hasher.rs:550-556`,
  `packages/nx/src/tasks-runner/life-cycles/store-run-information-life-cycle.ts`,
  `packages/nx/src/tasks-runner/run-command.ts:1118`,
  `packages/nx/src/utils/path.ts:12-22`, `packages/nx/src/utils/package-manager.ts:139-250`,
  `packages/nx/schemas/nx-schema.json` (`targetDefaults`, `targetDefaultArrayEntry`),
  `packages/nx/src/project-graph/utils/project-configuration/target-defaults.ts`,
  `packages/eslint/{package.json,plugin.ts}` + `src/plugins/plugin.ts` +
  `src/utils/{config-file.ts,flat-config.ts,resolve-eslint-class.ts}`,
  `packages/js/src/plugins/typescript/plugin.ts:955-1162`,
  `packages/vitest/src/plugins/plugin.ts:340-460`

Live, verified 2026-07-26:

- `registry.npmjs.org` - versions, publish dates, `peerDependencies`, `peerDependenciesMeta` and
  export maps for every package in section 0 - HIGH
- `actions/cache#1622` (OPEN, last activity 2026-07-10) via `gh api` - the compression-method
  mismatch, the `choco install zstandard` workaround, the "arm runners now have zstd" claim - HIGH
  for what the thread says, MEDIUM for whether the claim is currently true
- `actions/cache#1087` (OPEN, no activity since 2024-03-25) via `gh api` - confirmed NOT applicable
  to a `.nx/cache/...` literal - HIGH
- `actions/partner-runner-images` `images/arm-windows-11-image.md` (Image Version `20260105.41.1`)
  via `gh api` - `zstd` under "Omitted software" (:217), Chocolatey 2.6.0 (:30),
  Git 2.52.0.windows.1 (:61) - HIGH for what the doc says, contradicts #1622's last comment

Empirical, run against this repo on the native Windows workstation 2026-07-26:

- `npx nx show project @op-nx/github-cache --json` - resolved targets, inputs, outputs, options
- `NX_VERBOSE_LOGGING=true npx nx run @op-nx/github-cache:typecheck` - confirms no hash is printed
- `.nx/cache/run.json` - confirms the hash/cacheStatus capture surface exists and is populated

---
*Stack research for: v0.0.2 OS-invariant cross-OS cache sharing*
*Researched 2026-07-26. Carries forward `.planning/research/STACK.md` (v0.0.1); supersedes its
section 5 treatment of `@actions/cache` cache-version sensitivity with mechanism-level detail.*
