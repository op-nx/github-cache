# Phase 9 Patterns: OS-Invariant Actions-Cache Version

**Mapped:** 2026-07-28
**Inputs:** `09-CONTEXT.md` (decisions + CORRECTIONS FROM RESEARCH), `09-RESEARCH.md`
(measured at `565f48f`)
**Method:** every analog below was READ at HEAD in this session. Line numbers were
re-derived, not carried from the inputs. Where a re-derivation disagrees with an input it
is flagged as a CORRECTION.

---

## Headline answers

| # | Question | Answer |
|---|---|---|
| 7 | Does a symmetrical process-global mutate-and-restore spec hook already exist? | **NO.** Zero `afterAll`, zero `process.chdir`, zero `vi.stubEnv`, zero save-and-restore of any process global anywhere in `packages/github-cache`. The executor is establishing a NEW pattern. See A7. |
| 8 | Where does `CORR_05_SITES` live? | `packages/github-cache/src/lint-rules.spec.ts:696-746` (doc block `:696-714`, constant `:715-746`, consuming loop `:767-789`). |

**One new CORRECTION, load-bearing for VER-04's blast radius:** RESEARCH Q3 says the guard
breaks "16 existing spec constructions" (15 in `actions-cache-backend.spec.ts` + 1 in
`serve.spec.ts`), and marks `select-backend.spec.ts` "probably". Both are undercounts.
Measured: **17 direct constructions** (16 + 1) and `select-backend.spec.ts` is **CONFIRMED,
not probable** -- 4 call sites, 5 runtime invocations. Total **21 sites**, in **THREE** spec
files. See section 3.

---

## 1. File manifest, verified against the codebase

Roles: **LEAF** = pure single-source helper, no I/O, no ambient reads. **ADAPTER** = wraps a
third-party boundary. **BIN** = process entry. **GUARD** = a spec whose subject is config /
source text rather than behaviour. **CONFIG** = strict JSON or YAML. **ARTIFACT** =
generated, never hand-edited.

### Modified production code

| File | Role | Data flow | Closest analog | Analog verdict |
|---|---|---|---|---|
| `src/lib/cache-archive-path.ts` | LEAF | `Hash` -> path string; consumed by `actions-cache-backend.ts:45,67` only | `src/lib/cache-key.ts` (A1b), `src/lib/release-asset-name.ts` (A1a) | STRONG. Same doc-block shape, same "never inline / never tidy" lock, same silent-MISS failure statement. `cache-key.ts` is the better analog for the POST-change file because it imports nothing at all. |
| `src/backend/actions-cache-backend.ts` | ADAPTER | `serve()` -> `selectBackend` -> here -> `@actions/cache`; also `publishMirror` | itself (`:71-100` is the in-file precedent for a long positional-argument comment lock); `src/lib/select-backend.ts:43-57` for a fail-closed construction guard | STRONG for the guard: `select-backend.ts:47-49` already throws at construction on a corrupt identity, with the rationale comment-locked and the "throw vs degrade" distinction spelled out at `:52-57`. Copy that discrimination style. |
| `src/lib/dogfood-body.ts` | LEAF | written by `action/index.ts`, read by `roundtrip/read-back.ts` | `src/lib/release-asset-name.ts:50-55` (`releaseAssetName(hash, platform)`) | PARTIAL and deliberately INVERTED. `releaseAssetName`'s platform parameter has a `process.platform` DEFAULT; D-18 requires `producerOs` to have NO default. Excerpt A1a so the executor sees the shape it must NOT copy. |
| `src/action/index.ts` | BIN | reads inputs, drives `serve()` or `runPublish` | `runPublish`'s own `writeCountSummary` call at `:154-168` | STRONG. The comment at `:158-161` already states the "shared renderer is NOT widened for one caller" rule D-16 depends on. |
| `src/roundtrip/read-back.ts` | BIN | `publish-verify` job entry | itself (`:52`, `:64`, `:71` already read `process.platform`) | STRONG. `cachePlatform()` at `:62` is consistent with three sibling ambient reads in the same function. |
| `src/publish/publish-mirror.ts` | ADAPTER | `runPublish` -> here -> Releases | itself (`:292-307`), and `:282-288` for the neighbouring warn-not-fail shape | STRONG. |

### New production code

| File | Role | Data flow | Closest analog | Analog verdict |
|---|---|---|---|---|
| `src/lib/compression-method.ts` (NEW) | LEAF (impure: one `spawnSync`) | imported ONLY by `runPublish` in `action/index.ts` (D-17) | `src/lib/local-context.ts:42-118` for the spawn HARDENING; `src/lib/cache-key.ts` for the leaf doc-block shape | SPLIT analog -- take hardening from one, prose shape from the other. See A5. |
| `src/lib/compression-method.spec.ts` (NEW) | spec | -- | `src/lib/dogfood-body.spec.ts` (co-located leaf spec, 3 tests, no harness) | STRONG for placement/size. But the four-case fixture matrix RESEARCH's Validation Architecture requires has NO in-repo analog -- no spec in this repo currently fakes or fixtures a child process. NEW MECHANISM, see section 4. |

### Modified specs

| File | What changes | Closest analog | Analog verdict |
|---|---|---|---|
| `src/lib/cache-archive-path.spec.ts` | REPLACED wholesale (VER-02, D-04); CORR-05 site 1 + the `:6` disable leave | `cleanup-workflow.spec.ts:16-30` / `ppe-action.spec.ts:20-35` for the comment-stripped scan (A2); its own `:13-20` header for the pinned-literal discipline | STRONG on both halves. The existing header is the right prose to CARRY FORWARD, not discard -- it already explains why the literal is hand-authored. |
| `src/backend/actions-cache-backend.spec.ts` | VER-03 clauses 1+2; the chdir/mkdir hook | its own `:334-356` (A4) -- half-built already | STRONG. See A4. |
| `src/serve.spec.ts` | the chdir/mkdir hook (`:401` constructs the real backend) | none (A7) | NO ANALOG for the hook. |
| `src/lib/dogfood-body.spec.ts` | 3 single-arg calls -> 2-arg; add the two-OS differing-bytes assertion | its own `:9-11` (`differs for different hashes`) | STRONG. The new "differs for different producerOs" test is the same shape one axis over. |
| `src/nx-target-inputs.spec.ts` | PARITY-08 clauses 1-3 + the comment lock | its own `:404-464` (A3) for the merge + negative control; `:466-529` for the literal pins | STRONG. Both halves ship already; PARITY-08 is a transplant, not an invention. |
| `src/publish/publish-mirror.spec.ts` | OBS-04 message assertions | its own `:408-440` | STRONG. |
| `src/pinned-deps.spec.ts` | VER-05's bump note into the `@actions/cache` doc block | its own `:4-13` | CONFIRMED, see section 3. |
| `src/lib/select-backend.spec.ts` | **the chdir/mkdir hook -- CONFIRMED, not "probably"** | none (A7) | See section 3. |
| `src/action/index.spec.ts` | REVIEW: the verify branch's expected body | its own `:165-213` | Likely NO edit needed; see section 3. |

### Config / workflow / docs / artifact

| File | Role | Closest analog | Analog verdict |
|---|---|---|---|
| `nx.json` `targetDefaults.test.inputs` | CONFIG (strict JSON, no comments) | the `{workspaceRoot}/.github/workflows/cleanup.yml` entry already in the same array | STRONG. Exact precedent: a workflow file already registered as a `test` input. The rationale displaces into the guard spec (Phase 8 D-13). |
| `.github/workflows/ci.yml` `dogfood-verify` | workflow | `ci.yml:384-455` `integration` (A6) | STRONG. |
| `docs/advanced.md`, `README.md`, `docs/trust-and-security.md` | docs | -- | The PATTERN here is not a file analog, it is `DOCS_08_SITES` -- see A8. |
| `start-cache-server/index.js` | **ARTIFACT** | `npm run build:action` / `npm run check:action` | Never hand-edited. Regenerated in the SAME commit as any `serve()`-reachable edit (D-25). |

---

## 2. The eight analogs, with excerpts

### A1a -- comment-locked single-source leaf WITH an injectable-platform parameter

`packages/github-cache/src/lib/release-asset-name.ts:33-55`. This is the shape
`cache-archive-path.ts` currently mirrors and the shape `dogfood-body.ts` must
deliberately NOT mirror (D-18 forbids the default).

```ts
/**
 * Single source of truth for the OS-namespaced Release asset name (CORR-01).
 * BOTH the Phase 3 reader and the Phase 4 publisher MUST derive names through this
 * one helper so a read on platform P can only ever resolve an asset produced under
 * platform P.
 *
 * LOAD-BEARING, comment-locked (Pitfall 7, D-07). A drift between the two
 * derivations is a SILENT cross-OS MISS -- no error, no crash, just a wave of
 * rebuilds when a reader looks under a name the publisher never wrote. Never
 * inline this, never "tidy" the template, and never change the separator without
 * re-verifying an end-to-end cross-OS read; the failure mode is a silent MISS, not
 * a crash. The exact produced name is pinned by release-asset-name.spec.ts.
 *
 * The platform parameter exists ONLY for test injection -- it lets one CI leg
 * assert all three OS mappings and simulate a wrong-OS reader. It is NOT a mode
 * surface: it cannot influence RW-vs-RO selection (TRUST-05 intact).
 */
export function releaseAssetName(
  hash: Hash,
  platform: NodeJS.Platform = process.platform,
): string {
  return `${hash}-${cachePlatform(platform)}`;
}
```

Three transferable elements: (1) the "Single source of truth ... BOTH X and Y MUST derive
through this one helper" opening; (2) the "LOAD-BEARING, comment-locked" paragraph naming the
failure mode as a SILENT MISS and enumerating the forbidden edits; (3) the closing sentence
pointing at the spec that pins the value. `cache-archive-path.ts:5-17` carries the identical
three-part structure -- **keep all three when rewriting it**, and add the Nx 23.1.0 U-01
measurement beside the literal (CONTEXT CORRECTIONS).

The **anti-pattern to copy from**: the `platform: NodeJS.Platform = process.platform`
default. D-18 requires `dogfoodBody(hash, producerOs)` with NO default, because the default
is what makes the vacuity trap reachable. The type is also different: `CacheOs`
(`release-asset-name.ts:17`, `'windows' | 'macos' | 'linux'`), imported `import type`, not
`NodeJS.Platform`.

### A1b -- the same pattern with ZERO imports (the better analog for the rewritten path leaf)

`packages/github-cache/src/lib/cache-key.ts:1-21`. After VER-02 clause 2b,
`cache-archive-path.ts` must import EXACTLY the type-only `{ Hash }` and nothing else. This
file is the repo's example of a leaf whose header states its own leaf-ness as a contract:

```ts
/**
 * Single-source home for the server-produced-key namespace (TRUST-08 / ADR C16).
 *
 * This is the ONE authored source for the `nx-cache-` prefix, the key builder,
 * and the bounded lowercase-hex HASH_PATTERN that the server's SRV-03 hash guard
 * and the TRUST-08 mirror filter both validate against. [...] Never inline a second
 * copy of the prefix or the pattern: a duplicate authored literal is exactly the
 * drift T-05-08-02 guards against.
 *
 * Kept a true leaf -- it imports NOTHING from ../backend, ../publish, ../server,
 * or ./select-backend -- so every consumer can adopt it without opening an import
 * cycle, matching the github-identity.ts leaf-extraction precedent (Phase 4).
 */
```

The "Kept a true leaf -- it imports NOTHING from ..." sentence is the prose form of VER-02
clause 2b. Write the archive-path version of it, and per D-05 write it WITHOUT spelling the
forbidden module names.

Its co-located pinned-literal spec discipline is at
`packages/github-cache/src/lib/cache-archive-path.spec.ts:13-20` -- and that header survives
the rewrite intact:

```ts
// ROBUST-03, non-vacuous: the expected file name below is spelled out as a string
// literal ON PURPOSE, not rebuilt from the same `nx-github-cache-${hash}.tar`
// template the implementation uses. A reconstructed expectation would still pass
// after a cosmetic rename of the path template -- which is exactly the change that
// silently MISSes every @actions/cache restore, because the toolkit version-hashes
// the literal path string (Pitfall 7). Pinning the literal here is the only
// assertion that fails on that rename instead of failing silently in CI. This is
// the same discipline as server.spec.ts's MAX_CACHE_BODY_BYTES pinned-value test.
```

Note what LEAVES with the rewrite: `:1-7` (the LINT-02 opt-out block + the
`eslint-disable-next-line no-restricted-imports` directive + the `tmpdir` import -- one edit,
D-06) and `:9` (`import { basename, dirname, isAbsolute } from 'node:path'`, which D-04 drops
as redundant once the full literal is pinned). Line `:9` matters twice: it is a `node:path`
import in the file that is about to assert `node:path` absence in its SUBJECT -- so the
scanner must scan `cache-archive-path.ts`, never the spec itself.

### A2 -- comment-stripping source scanner (three instances; take the second)

The analog whose header best explains the trap is
`packages/github-cache/src/cleanup/cleanup-workflow.spec.ts:4-30`:

```ts
/**
 * RETAIN-03 is a workflow-config requirement, not runtime logic: [...]
 *
 * Path resolved via import.meta.url (the pinned-deps.spec.ts / release-asset-name
 * .spec.ts idiom), NOT __dirname and NOT process.cwd().
 *
 * Only non-comment lines are matched: this file's own prose comments repeat
 * "contents: write" and "cancel-in-progress" verbatim while explaining the
 * rationale, so a naive substring match against the raw file would pass even if
 * the REAL YAML directive had drifted. Stripping '#'-prefixed lines first makes
 * every assertion below non-vacuous against the actual config.
 */
const workflowSource = readFileSync(
  new URL('../../../../.github/workflows/cleanup.yml', import.meta.url),
  'utf8',
);

const codeLines = workflowSource
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');
```

`packages/github-cache/src/ppe/ppe-action.spec.ts:20-35` is the same idiom with an extra
clause worth stealing -- it names that the SUBJECT file also carries `#` prose, not just the
spec ("action.yml carries its own '#' rationale header"). That is exactly the VER-02
situation: `cache-archive-path.ts`'s own comment lock will discuss the banned builders.

For a `.ts` subject the comment marker is `//`, and that variant is
`packages/github-cache/src/lint-scope-drift.spec.ts:233-238`:

```ts
function strippedConfigSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}
```

**Known ceiling of all three, and the executor must decide about it explicitly:** the filter
is line-oriented and only drops lines whose TRIM STARTS WITH the marker. A `/** ... */` block
comment's interior lines start with `*`, not `//` -- so `strippedConfigSource` does NOT strip
JSDoc bodies. `cache-archive-path.ts`'s comment lock is a `/** */` block. Either widen the
filter to also drop lines whose trim starts with `*`, `/*` or `*/`, or convert the subject's
lock to `//` lines. Widening the filter is the smaller change and keeps the subject readable;
whichever is chosen, comment-lock the choice, because a reader who later reformats the lock
back to JSDoc silently reddens or vacates the scan.

Both the VER-02 scan and the VER-03 clause-2 member scan need this function. It is used
twice in the phase, in two different spec files -- but per `.planning/codebase/TESTING.md`
the package-source root is reserved for facts spanning multiple files, and these are two
facts about two different single modules, so **duplicate the six-line helper rather than
extract it**. The repo already has it three times for exactly that reason.

### A3 -- merged-configuration guard with a NEGATIVE vacuity control (PARITY-08's transplant)

`packages/github-cache/src/nx-target-inputs.spec.ts:404-464`. This is PARITY-08 clauses 2+3
already written, one target over. The comment block is the part to transplant almost verbatim
(substituting `test` for `integration` and the `ci.yml` entry for the runtime discriminator):

```ts
describe('the discriminator survives the MERGED project configuration (CORR-04)', () => {
  // The two guards above -- and `capture-hashes.mjs`'s `readDiscriminatorCommand`
  // -- all read `nx.json`'s `targetDefaults`. None of the three reads the
  // configuration Nx actually HASHES, which is `targetDefaults` merged UNDER
  // `packages/github-cache/project.json`. That file exists and declares
  // `integration` (with `command` and `options` only), and a target key declared
  // there REPLACES the default's key wholesale rather than merging into it.
  //
  // [...] It delegates the merge to Nx's OWN two functions -- the same
  // `readTargetDefaultsForTarget` + `mergeTargetConfigurations` pair the real
  // merge uses -- for the reason the header states about the glob resolver: a
  // hand-rolled "does project.json declare inputs" check would assert the
  // SPELLING of one particular way to break it [...]
  function mergedIntegration(
    projectTarget: TargetConfiguration,
  ): TargetConfiguration {
    return mergeTargetConfigurations(
      projectTarget,
      readTargetDefaultsForTarget('integration', nxJson.targetDefaults) ??
        undefined,
    );
  }

  it('keeps the byte-identical discriminator once project.json is merged over targetDefaults', () => {
    expect(
      runtimeInputsOf(
        mergedIntegration(projectJson.targets.integration).inputs,
      ),
    ).toEqual(['node -p process.platform']);
  });

  // NON-VACUITY control, and it has to be a negative one [...] If
  // `mergeTargetConfigurations` ignored the project layer -- or if this spec merged
  // the two arguments in the wrong order -- the assertion above would pass on a
  // merge that never consulted `project.json`, and the hole it exists to close
  // would be wide open behind a green test. The mutation is applied to a LOCAL
  // copy, never to the file: this asserts what the merge does with a hostile
  // `project.json`, so it must not require one.
  it('DROPS the discriminator when project.json declares its own inputs, proving the merge merges', () => {
    const hostile: TargetConfiguration = {
      ...projectJson.targets.integration,
      inputs: ['default'],
    };

    expect(runtimeInputsOf(mergedIntegration(hostile).inputs)).toEqual([]);
  });
});
```

Three transplant deltas the executor must handle, each of which the `integration` version
does not face:

1. `projectJson.targets.test` is **ABSENT** (`project.json` declares only `integration`), so
   the first argument is `projectJson.targets.test ?? {}` and the `?? {}` is doing real work.
   RESEARCH Q8 is explicit: state that in the comment, because a reader will assume the key
   exists. The `integration` version passes a key that IS there.
2. There is no `runtimeInputsOf`-style extractor for a `{workspaceRoot}` string entry --
   assert `toContain('{workspaceRoot}/.github/workflows/ci.yml')` on `merged.inputs`
   directly, and the negative control asserts `not.toContain` the same literal.
3. The merge for `test` has **THREE** layers, not two: `@nx/vitest`'s inferred target is the
   base. RESEARCH Q8 shows it is dominated (`targetDefaults` REPLACES `inputs`), so the two
   named functions are still the whole merge that matters -- but the comment must say so,
   because the `integration` version's closing sentence ("`integration` is declared, never
   inferred, so these two layers are the whole merge for this target") is FALSE for `test`
   and must not be copied verbatim.

The literal-pin half (clause 1) copies `:466-529`, whose headers already argue why a literal
is the honest form when there is no resolver to delegate to. `:484-488` is the sentence to
extend -- it enumerates the two shipped false-pass incidents this class has produced.

The two comment-lock facts D-23 requires (inputs REPLACE rather than merge; `@nx/vitest`'s
inferred `test` target carries `{ env: 'CI' }`, so an inferred-input `test` would make O1
structurally impossible) have their prose analog at `:319-325`, which states the
REPLACE-not-merge fact for `lint` and names the resulting stale-cache hole.

### A4 -- `vi.mock('@actions/cache')` harness asserting `.mock.calls` (VER-03 clause 1, half-built)

`packages/github-cache/src/backend/actions-cache-backend.spec.ts:334-356`:

```ts
describe('createActionsCacheBackend path + key agreement (ROBUST-03)', () => {
  // Non-vacuous: the assertion below compares the RECORDED first argument of both
  // toolkit calls to each other AND to cacheArchivePath(hash) imported from the
  // helper -- so it fails if save and restore ever pass different path strings,
  // which is the silent-MISS class this backend's single-source rule exists to
  // prevent (Pitfall 7).
  it('passes exactly cacheArchivePath(hash) as the single path to both restoreCache and saveCache, with the same key (ROBUST-03)', async () => {
    restoreCache.mockResolvedValue(undefined);
    saveCache.mockResolvedValue(42);
    const backend = createActionsCacheBackend();

    await backend.get(HASH);
    await backend.put(HASH, Buffer.from('tar-bytes'));

    const restorePaths = restoreCache.mock.calls[0][0];
    const savePaths = saveCache.mock.calls[0][0];

    expect(restorePaths).toEqual([cacheArchivePath(HASH)]);
    expect(savePaths).toEqual(restorePaths);
    expect(restoreCache.mock.calls[0][1]).toBe(cacheKeyFor(HASH));
    expect(saveCache.mock.calls[0][1]).toBe(cacheKeyFor(HASH));
  });
});
```

The harness it extends is `:10-33`:

```ts
vi.mock('@actions/cache');
vi.mock('@actions/core', () => ({ warning: vi.fn() }));

const restoreCache = vi.mocked(cache.restoreCache);
const saveCache = vi.mocked(cache.saveCache);
const warning = vi.mocked(core.warning);

const HASH = 'abc123' as Hash;

afterEach(async () => {
  vi.resetAllMocks();
  await rm(cacheArchivePath(HASH), { force: true });
});
```

What VER-03 clause 1 changes: this test indexes ONE argument at a time
(`.mock.calls[0][0]`, `[0][1]`), which pins positions 0 and 1 and says nothing about
positions 2-4 -- exactly where the flag lives. D-11 requires deep equality on the WHOLE
recorded array, so position 3 (`saveCache`) and position 4 (`restoreCache`) are pinned rather
than assumed. Per-function `toHaveBeenCalledTimes` belongs in the test that exercises the
`-1` path, because that is the only path with two `restoreCache` calls (`:101-114` in the
implementation).

The three real argument shapes, from the implementation as it stands today:

- read, `actions-cache-backend.ts:46`: `cache.restoreCache([path], cacheKeyFor(hash))` --
  two arguments; the flag becomes the 5th positional, so positions 3 and 4 must be filled
  (`undefined` or `[]` / `{}`), which is a real code change, not just an appended argument.
- write, `:101`: `cache.saveCache([path], cacheKeyFor(hash))` -- the flag is the 4th, so
  position 3 (`options`) must be filled.
- probe, `:107-114`: `cache.restoreCache([path], cacheKeyFor(hash), [], { lookupOnly: true })`
  -- already four arguments; the flag simply appends as the 5th. This is the only site where
  the flag is a pure append, which makes it the site most likely to be the ONLY one done
  right. D-10 says it MUST carry the flag.

The existing in-file precedent for a long positional/semantics comment lock is
`actions-cache-backend.ts:71-100` (the `-1` disambiguation block) -- 30 lines of comment over
one call, with the upstream version verified in the text. That is the register for D-09's
"the JSDoc documents `enableCrossOsArchive` BEFORE `options` and the real signature is the
reverse" lock.

### A5 -- hardened `child_process` wrapper, excerpted because it is NOT reused

`packages/github-cache/src/lib/local-context.ts:20-118`. **Copy the two hardening options and
the comment register. Do NOT copy the discrimination logic -- VER-05 inverts both of its
axes.** Doc block first, because it states the two properties that make it wrong here:

```ts
/**
 * The single hardened spawn wrapper. Every credential/context helper call site --
 * gh auth token, git credential fill, git remote get-url -- routes through it.
 * Resolves the child's trimmed stdout on a clean exit, or undefined when the tool
 * is absent, fails, times out, or prints nothing.
 *
 * Discrimination is STRUCTURAL ONLY: a clean exit (code 0) plus non-empty trimmed
 * stdout. No stderr listener is attached at all -- helper failure stderr is
 * LOCALIZED to the system language (it came back in Danish on the probe machine),
 * so any stderr sentinel silently misfires for every non-English developer, and
 * stderr can additionally carry credential-adjacent material.
 * [...]
 */
```

The two options to borrow, with their comment locks intact (`:52`, `:65-66`):

```ts
const child = spawn(file, [...args], {
  // shell false: injection-safe. An explicit argv array is passed, never an
  // interpolated command string, and a native binary resolves from PATH with
  // no quoting even when its directory contains spaces.
  shell: false,
  // [timeout / killSignal -- REJECTED for VER-05 by D-15]
  // windowsHide: no console window flash per spawn on Windows.
  windowsHide: true,
```

The two axes VER-05 inverts, both comment-locked here as deliberate:

```ts
    // Deliberately no stderr listener (see the doc block): discrimination is
    // structural only, and stderr is localized and credential-adjacent.
```
(`:85-86` -- VER-05 must accumulate stdout AND stderr into ONE string)

```ts
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdoutText.trim() || undefined);

        return;
      }

      resolve(undefined);
    });
```
(`:94-104` -- VER-05 must never consult the exit code; `spawnSync`'s `status` simply goes
unread, which is why CONTEXT C-02 prefers `spawnSync` over `spawn`)

Also note `HELPER_TIMEOUT_MS` at `:13-18`: an exported, doc-blocked constant. D-15 rejects a
timeout for VER-05, so `compression-method.ts` has NO such constant -- and D-15 asks that the
one place hardening was deliberately declined be RECORDED. The register for a
recorded-deliberate-omission is `lint-scope-drift.spec.ts:132-141` ("NO explicit timeout
argument, and that is the considered value rather than an omission"). Reuse that phrasing.

The `runHelper` doc block also ends with a `ponytail:` line explaining a consolidation
choice. `cache-archive-path.ts:19-32` uses `ponytail:` for a documented-not-enforced ceiling.
That is the established marker for a deliberate simplification in this repo -- use it for the
no-timeout decision.

### A6 -- two-leg OS matrix job (`dogfood-verify`'s target shape)

`.github/workflows/ci.yml:409-418` (job header) is the mechanism:

```yaml
  integration:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-24.04-arm, windows-11-arm]
    runs-on: ${{ matrix.os }}
    # Generic hang insurance -- see the build job.
    timeout-minutes: 20
```

`dogfood-verify` as it stands today is at `ci.yml:817-836`: `if: github.event_name == 'push'`,
`needs: dogfood-seed`, `runs-on: ubuntu-24.04-arm`, and **no `timeout-minutes`** -- so the
matrix edit also adds the hang insurance the `integration` analog carries. `dogfood-seed`
(`:794-816`) stays single-leg (D-20).

The prose register for a load-bearing matrix comment is `ci.yml:384-406` (the `integration`
header) and `:941-950` (the `publish` matrix header). Both say, in different words, "this
matrix is LOAD-BEARING, do not collapse it to one OS, and here is why". `:943-946` is the
sentence D-31/Q10 site 2 corrects:

```
  # self-enforcing: @actions/cache folds the per-OS tmpdir path + a windows-only salt + the
  # compression method into the cache version hash, so an ubuntu leg can NEVER restore a
  # Windows-saved entry (restoreCache returns undefined and the engine skips it). Collapsing
  # this to one OS SILENTLY drops the other OS's entries (D-03) -- keep BOTH legs
```

Note the structural coupling RESEARCH Q10 flags: the false clause IS the stated reason for
keeping two legs, and the "keep BOTH legs" instruction depends on it. The replacement must
supply a NEW reason in the same sentence, or the corrected comment argues for collapsing the
matrix. Site 3's two sentences are at `:387` and `:406` within the `integration` header
excerpted above -- `:406`'s trailing "exactly the CORR-01 namespacing the store already
relies on" is the false clause; `:387`'s "a Linux cache never satisfies a Windows run" stays
true but needs its REASON restated as the Nx hash.

The vacuity condition D-21 requires in the job comment has its closest analog in
`dogfood-verify`'s existing two-line header (`:818-819`): "a real cross-job HIT is the only
way this job passes; a MISS fails the job loudly." Extend that sentence rather than adding a
second block.

### A7 -- process-global setup hook: **NO ANALOG EXISTS**

Measured across `packages/github-cache`:

| Probe | Result |
|---|---|
| `afterAll` | **0 occurrences** anywhere in the package |
| `process.chdir` | **0 occurrences** |
| `vi.stubEnv` / `vi.unstubAllEnvs` | **0 occurrences** |
| `const original... = <global>` save-and-restore | **0 occurrences** |
| `beforeAll` | 2 files -- `lint-rules.spec.ts:128`, `lint-scope-drift.spec.ts:145`. Both only `await` a module import into a `let`. Neither mutates anything process-global, so neither needs an `afterAll`. |
| `vi.restoreAllMocks()` | 1 -- `releases-backend.spec.ts:83`. Mock registry, not a process global. |

So the executor is establishing a NEW pattern, and the reason none exists is itself a
pattern: **this repo avoids process-global mutation in specs by injecting instead.**
`selectBackend(env)` takes an env bag (`select-backend.ts:29-31`), `releaseAssetName(hash,
platform)` takes a platform, `vitest.config.mts:22-25` neutralises the two consumer env vars
in CONFIG rather than in a hook. And `select-backend.spec.ts:152-159` asserts the
invariance explicitly:

```ts
  it('never mutates process.env -- every case is driven by the explicit env argument (TEST-01)', () => {
    const before = JSON.stringify(process.env);

    selectBackend({ GITHUB_REPOSITORY: 'op-nx/github-cache' });
    selectBackend({ ...trusted });

    expect(JSON.stringify(process.env)).toBe(before);
  });
```

That test is a `process.env` assertion and a `chdir` hook does not touch `process.env`, so
the two do not conflict -- but the executor should note that this file is the one asserting
process-global hygiene AND is one of the three files that needs the chdir hook. Adding an
asymmetrical hook here is the most visible possible contradiction.

**Leak hazard, spelled out because nothing in the repo demonstrates the discipline.**
`process.chdir()` is process-global and the vitest pool runs multiple spec FILES per worker
(RESEARCH Q3 measured `pool=5 isWorkerThread=true`). A leaked chdir silently changes what a
later spec's relative reads resolve against -- and this repo has at least eight specs whose
subject is a file read relative to something (`nx-target-inputs.spec.ts:59,80`,
`cleanup-workflow.spec.ts:23`, `ppe-action.spec.ts:28`, `pinned-deps.spec.ts:17`,
`lint-scope-drift.spec.ts:234`, `lint-rules.spec.ts:749`). Those all resolve via
`new URL(..., import.meta.url)`, which is chdir-IMMUNE -- which is lucky, not designed. So
the hook's requirements are:

1. capture `process.cwd()` BEFORE the chdir and restore it in `afterAll`, unconditionally;
2. resolve the target from `import.meta.url`, not from a relative `..` walk off the current
   cwd (the repo's universal path idiom, and `cleanup-workflow.spec.ts:13-14` states it as a
   rule: "NOT `__dirname` and NOT `process.cwd()`");
3. `mkdirSync` the archive directory in the SAME hook, not by relying on the code under test
   to create it (RESEARCH Q3's explicit recommendation -- `actions-cache-backend.spec.ts:38`
   pre-writes the archive BEFORE the `:40` construction that would mkdir it);
4. comment-lock the leak hazard, because there is no sibling instance to learn it from.

Do NOT use `import.meta.url` for the same purpose inside `cache-archive-path.ts` or
`actions-cache-backend.ts`: RESEARCH Q2 measured that `esbuild.action.mjs:38-39` rewrites
`import.meta.url` to a shim pointing at a never-emitted `start-cache-server/index.mjs`. It is
legitimate in a spec (the define applies only to the bundle) and broken in production code.

### A8 -- site-list constant keyed on FILE + QUOTED PHRASE, carrying a requirement miscount

`packages/github-cache/src/lint-rules.spec.ts:696-746`. This is `DOCS_08_SITES`'s exact
analog, including the miscount lock. The doc block (`:700-714`):

```ts
 * REMOVAL SCHEDULE -- comment-locked so a Phase 9 or Phase 10 executor deletes
 * the ROW together with the SITE. A row whose site is gone fails loudly at
 * `lineIndexOf` below; a site whose disable is gone fails through
 * `reportUnusedDisableDirectives`. Neither can rot silently.
 *
 * There are FOUR sites and FOUR error positions. There is NO fifth.
 * `cache-archive-path.spec.ts`'s bare `tmpdir()` CALL is not an error position
 * and must never carry a disable: [...]
 * CONTEXT.md D-22 and REQUIREMENTS.md CORR-05 both list that call alongside the
 * import -- correct as a SITE (both lines leave together in Phase 9), wrong as
 * an error position. ROADMAP SC3's "three CORR-05 violations" is likewise a
 * miscount; REQUIREMENTS, CONTEXT and RESEARCH all say FOUR.
```

The constant, with the per-row scheduling comment:

```ts
const CORR_05_SITES = [
  {
    /** Removed by VER-02, Phase 9. */
    file: 'packages/github-cache/src/lib/cache-archive-path.spec.ts',
    expression: "import { tmpdir } from 'node:os';",
    rule: 'no-restricted-imports',
  },
  // [...three more rows, each with its own /** Removed by ... */ note]
] as const;
```

And the keying mechanism that makes a line-shifting commit safe (`:748-765`):

```ts
function readSiteLines(file: string): string[] {
  return readFileSync(new URL(file, WORKSPACE_ROOT_URL), 'utf8').split('\n');
}

function lineIndexOf(lines: string[], expression: string, file: string): number {
  const index = lines.findIndex((line) => line.trim() === expression);

  expect(
    index,
    `${file} no longer contains the exact expression \`${expression}\`. This table is keyed on FILE + EXPRESSION TEXT on purpose; if the site was legitimately removed by its scheduled requirement, delete its ROW here in the same commit.`,
  ).not.toBe(-1);

  return index;
}

describe('every extant CORR-05 violation is caught while it still exists (LINT-03, D-22)', () => {
  for (const { file, expression, rule } of CORR_05_SITES) {
    // ...
```

Six transferable elements for `DOCS_08_SITES`:

1. `as const` array of objects, each with a `file` and an exact text key -- never a line
   number, because the phase's own edits shift each other's lines in one commit.
2. A per-row `/** ... */` note recording WHICH requirement owns the row and when it leaves.
   For DOCS-08 the analog is the row's BUCKET (correction vs additive) plus, for
   `docs/advanced.md:45`, D-32's reclassification.
3. The failure MESSAGE carries the maintenance instruction ("delete its ROW here in the same
   commit"). This is what makes the guard teach rather than merely fail.
4. The miscount is recorded in the doc block, attributed to the document that has it wrong,
   with the count that is right. DOCS-08's version: DOCS-08 names FOUR sites-in-scope; the
   real shape is three corrections + three additive preconditions = six sites touched, and
   `docs/advanced.md:45` fails DOCS-08's own membership criterion.
5. The loop is `for (const ... of SITES) { describe(...) }`, so each site is its own named
   test and a failure names the site.
6. `readFileSync(new URL(file, WORKSPACE_ROOT_URL), 'utf8')` with workspace-root-relative
   `file` strings -- so the rows read as repo paths, which is what a human cross-references
   against the requirement.

**Placement decision the planner owns:** `CORR_05_SITES` sits in a `src/*.spec.ts`
cross-cutting guard because it spans four sites in three files. `DOCS_08_SITES` spans six
sites in four files (three docs + `ci.yml`), so by `TESTING.md`'s rule it also belongs at the
package-source root -- a new `src/docs-same-os-claims.spec.ts` or similar, NOT inside
`nx-target-inputs.spec.ts`. Note `git ls-files` shows a `docs-trust.spec.ts`-shaped precedent
referenced by RESEARCH Q2; check whether an existing docs guard is the natural home before
adding a file.

**Hard dependency:** two of the six rows key on `ci.yml`, so this spec is a stale-cached-PASS
victim until PARITY-08 lands. That is D-35 step 1 and it is not negotiable.

---

## 3. Confirmations the orchestrator asked for

### `createActionsCacheBackend()` construction census -- RESEARCH Q3 undercounts

Measured by `git grep -c`, not inferred.

| File | Direct constructions | Lines |
|---|---|---|
| `src/backend/actions-cache-backend.spec.ts` | **16** | `:40, :52, :63, :74, :85, :106, :116, :127, :138, :147, :156, :165, :255, :289, :319, :343` |
| `src/serve.spec.ts` | **1** | `:401` |
| **Direct total** | **17** | |

RESEARCH Q3 says "15 times" for `actions-cache-backend.spec.ts` and "16 existing spec
constructions" overall, and lists sixteen line numbers under the label "15". **The list is
right, the count is off by one.** Both derived totals are one low. Same class as the
ROBUST-04 four-vs-five miscount RESEARCH itself caught -- so record it the same way
(comment-lock, do not fix silently), and use **17 direct / 21 total** in any plan that states
a number.

Indirect, via `selectBackend()` reaching `select-backend.ts:59`:

| Site | env | Reaches the factory? |
|---|---|---|
| `select-backend.spec.ts:58` | `{...trusted, GITHUB_EVENT_NAME: 'push'}` | **YES** |
| `:64` | `{...trusted, GITHUB_EVENT_NAME: 'schedule'}` | **YES** |
| `:89` | dangerous events (`it.each` x4) | no -- not write-trusted |
| `:106` | event unset | no |
| `:116`, `:145`, `:155` | local (no `GITHUB_ACTIONS`) | no -- Releases reader |
| `:156` | `{...trusted}` | **YES** |
| `:170` | `pull_request` / `release` on github.com (`it.each` x2) | **YES** (2 invocations) |
| `:183` | same events on GHES | no -- read-only |
| `:207`, `:213` | invalid `GITHUB_REPOSITORY` | no -- throws at `:47` first |

**4 call sites, 5 runtime invocations.** So `select-backend.spec.ts` is **CONFIRMED** to need
the accommodation, not "probably" (RESEARCH Q3's own table) and not "probably too"
(Hazard A). The chdir/mkdir hook lands in **THREE** spec files. Missing the third leaves a red
tree on the VER-04 commit, which is precisely the failure Hazard A exists to prevent.

`publish-mirror.spec.ts:21-26` mocks the whole backend module, so the guard never runs there
-- SAFE, as RESEARCH says. Verified at HEAD.

### `pinned-deps.spec.ts:4-13` as VER-05's bump-note home -- CONFIRMED

Read at HEAD. The block is a `describe`-level doc comment and it already names the exact
mechanism VER-05 duplicates:

```ts
/**
 * ROBUST-03(a): the toolkit runtime dependencies MUST stay pinned to an exact
 * version (bare `x.y.z`), never a range (`^`/`~`/`>=`). This is a security
 * control, not a style rule: `@actions/cache` version-hashes the LITERAL archive
 * path and its compression choice into the restore key, so a silent minor/patch
 * bump behind a range operator can MISS every restore with no error -- and the
 * only end-to-end verification of a bump is the CI dogfood canary (Plan 06).
 * `@actions/cache` also carried a SUS (`too-new`) legitimacy verdict at install
 * time, so its exact version was human-approved before install (Task 1 gate).
 * This spec fails the build the moment either specifier widens to a range.
 */
describe('pinned toolkit dependencies (ROBUST-03)', () => {
```

"its compression choice into the restore key" is already there, so the VER-05 note is a
continuation of an existing sentence rather than a new topic. One caveat: the block covers
ALL toolkit deps (`@actions/cache` AND `@actions/core`), so it is not strictly a per-package
block -- the per-package blocks are the `//` comments above the individual `it`s (`:34-38`
for `@octokit/rest`, `:45-49` for the retry/throttling pair). `@actions/cache`'s own `it` at
`:22-26` has NO preceding comment. Either extend the describe-level block or add a
per-`it` comment above `:22`; the latter matches the file's own per-package convention and
puts the note next to the assertion a bumper must edit.

### `action/index.spec.ts` -- REVIEW verdict: likely NO edit

`:165-213` drives the verify branch three times. The expected body reaches it as a literal
string, never through `dogfoodBody`:

```ts
      new Response(Buffer.from('nx-github-cache-dogfood:run-1'), { status: 200 }),
```

So it is a hand-authored literal of today's payload template. Two consequences: (a) it does
NOT break on a signature change (nothing calls `dogfoodBody` in this spec); (b) it DOES break
if the payload template changes to fold `producerOs` into the bytes. D-18 only adds a
parameter, but the parameter has to CHANGE THE BYTES or the two-OS assertion in
`dogfood-body.spec.ts` is vacuous ("assert the two OS values produce DIFFERENT bytes",
RESEARCH Validation Architecture). **So the template WILL change, and this literal WILL need
updating.** Reclassify from "review, may not need an edit" to "must change, one literal per
verify test" -- and note the literal is hand-authored on purpose, matching A1b's
pinned-literal discipline, so update it rather than replacing it with a `dogfoodBody(...)`
call.

`:180-197` and `:199-213` use `expect.stringContaining('MISS')` / `'did not match'`, which
survive unchanged.

---

## 4. Patterns with NO in-repo analog (the executor is inventing)

| Need | Nearest thing that exists | Gap |
|---|---|---|
| Symmetrical process-global mutate-and-restore hook | nothing (A7) | Whole pattern. The repo's convention is injection, not mutation, and one spec asserts that convention. |
| Faking or fixturing a child process in a spec | `local-context.spec.ts` mocks `local-context.js` at the MODULE level; `select-backend.spec.ts:24` does the same | VER-05's four-case matrix (empty output -> gzip; stderr-only -> zstd; non-zero exit -> zstd; ENOENT -> gzip) needs a spawn-level seam, not a module-level one -- module-mocking `compression-method.ts` would test nothing. Either `vi.mock('node:child_process')` (no precedent) or a real script fixture (no precedent). The non-zero-exit case is THE control: it is the only one that distinguishes a faithful port from a `runHelper`-shaped one. |
| Asserting a directory exists after construction (VER-07) | `actions-cache-backend.spec.ts:54,58` -- `existsSync(cacheArchivePath(HASH))` before/after a get | Closest analog and it is a FILE, not a directory. The non-vacuity requirement is different: remove the directory first, or the assertion passes on Nx's own `.nx/cache`. Nothing in the repo currently removes a directory to make an existence assertion mean something. |
| Appending a second `core.summary.write()` after `writeCountSummary` | `summary.ts:24` calls `core.summary.write()` once; no caller appends | D-16's mechanism is verified (RESEARCH Q6: `@actions/core/lib/summary.js:69-77` appends unless `overwrite`), but there is no in-repo instance. `action/index.ts:158-161` at least states the "renderer is NOT widened for one caller" rule that forces the append. |
| A spec that asserts the bundle does NOT contain a symbol | nothing | RESEARCH Q11 offers this to pin D-17 and then recommends AGAINST it -- rely on `check:action`'s byte-diff instead, which needs no new mechanism. Take the recommendation. |

---

## 5. Anti-patterns this phase must avoid, each with the in-repo evidence

1. **A second `no-restricted-syntax` config object.** `lint-scope-drift.spec.ts:149-164`
   `banConfigObject()` asserts EXACTLY ONE, with the message "expected exactly ONE
   eslint.config.mjs object to configure no-restricted-syntax", deliberately, because two
   means the later silently overrides the earlier. VER-02 is a spec, not a lint rule
   (CONTEXT C-07).
2. **Spelling a forbidden token in the file that claims its absence.** D-05. Use
   single-character character classes in the regex source (`/\bj[o]in\b/`) and comment-lock
   why the brackets are there -- without spelling the tokens in the lock either.
3. **A naive raw-file substring match.** Three headers in this repo name the trap
   (`cleanup-workflow.spec.ts:16-20`, `ppe-action.spec.ts:20-25`,
   `lint-scope-drift.spec.ts:228-238`). Strip comments first -- and see A2's block-comment
   ceiling.
4. **`isAbsolute()` on the archive path.** D-04 drops it: `isAbsolute('C:/x')` is `false`
   under POSIX, so it would be actively misleading, and the full-literal pin subsumes it.
5. **`import.meta.url` in production code that reaches the bundle.** `esbuild.action.mjs:38`
   rewrites it to a deliberately-wrong shim (`serve.ts:197`'s `isEntrypoint` guard depends on
   the wrongness). `process.cwd()` is the only sound anchor in `actions-cache-backend.ts`.
   Legitimate in specs.
6. **Making `createActionsCacheBackend()` async or parameterised.** `select-backend.ts:36-37`
   comment-locks that `selectBackend` "stays SYNCHRONOUS ... keeps Function.length at 0 and
   the serve.ts call site synchronous (TRUST-05)". Hence `mkdirSync`, not `mkdir` (D-02).
7. **Asserting on an exit code or a bare count a deletion satisfies.** Phase 8 D-23. VER-03's
   clause 2 must pin the ordered multiset `['restoreCache', 'saveCache', 'restoreCache']`,
   not `=== 3`; a module that deleted `saveCache` and added two probes satisfies the count.
8. **Dropping the substring `restored as a MISS`.** `publish-mirror.spec.ts:426, :438, :486`
   all assert it via `stringContaining`. OBS-04's reword must retain it (CONTEXT C-10).
9. **Editing `start-cache-server/index.js` by hand, or rebuilding it once at the end of the
   phase.** D-25/D-26: `npm run check:action` in the acceptance battery of every plan
   touching `cache-archive-path.ts` or `actions-cache-backend.ts`, with the diff INSPECTED
   (Phase 7 Q10: an 88-line drift with no source edit).
10. **Over-correcting DOCS-08 site 3.** `ci.yml:387`'s "a Linux cache never satisfies a
    Windows run" stays TRUE -- only its REASON changes from storage to the Nx hash. The false
    clause is `:406`'s "exactly the CORR-01 namespacing the store already relies on"
    (RESEARCH Q10).
11. **Writing any claim that the mirror answers "whose bytes did the developer get".**
    OBS-03's retraction binds the DOCS-08 additive edits (RESEARCH Q10, closing note).

---

*Phase: 9-OS-Invariant Actions-Cache Version*
*Patterns mapped: 2026-07-28*
