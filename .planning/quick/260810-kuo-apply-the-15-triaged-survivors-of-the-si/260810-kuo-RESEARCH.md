# Quick Task 260810-kuo: Research -- premise verification for A1..A15

**Researched:** 2026-08-10
**Mode:** quick-task, scope ALREADY DECIDED by CONTEXT.md. This document verifies premises only.
**Repo:** `D:\projects\github\op-nx\github-cache`, branch `gsd/v0.0.2-os-invariant-cross-os-sharing`

## Verdict summary

| Item | Premise | Verdict |
|------|---------|---------|
| A1 | no spec writes into a path `readRepoFile` reads | VERIFIED |
| A2 | `jobBlock` is pure over module-scope `codeLines` | VERIFIED |
| A3 | six `nx/src/...` static imports, used by **four** functions | **PARTIAL -- there are FIVE consumers.** `resolvedTaskIds()` (sync) also uses `createTaskGraph` |
| A4 | `createTaskHasher` is constructed inside the per-target loop | VERIFIED (and the hoist matches Nx's own usage) |
| A5 | three sites route through the layer; guard stays non-vacuous | VERIFIED |
| A6 | three walk copies "differ ONLY in the filter" | **FAILED -- they differ on THREE axes.** Reshape required |
| A7 | the ```json fence is valid JSON | VERIFIED |
| A8 | both joins reproduce today's literals byte-identically | VERIFIED |
| A9 | `MIRRORED_BY_PREFIX` export can be dropped | **FAILED -- a spec pins its value.** Keep the export (CONTEXT G4 anticipated this) |
| A10 | one `probeTokenOf` is a strict superset | VERIFIED |
| A11 | two identity aliases are deletable | VERIFIED (with prose fallout) |
| A12 | the Prettier-import-shape assertion is deletable | VERIFIED (subsumed by the call assertion + typecheck) |
| A13 | the `read(ACCEPTED)` spawn is duplicated | VERIFIED (do not hoist to collection time) |
| A14 | six `paths` entries collapse to a flatMap over three pairs | VERIFIED |
| A15 | five **identical** assertions collapse to `it.each` | **PARTIAL -- they are not identical** (3 axes) and an in-code comment argues against a loop |

Full evidence below, one section per question from the brief.

---

## Q1 -- A1 safety: does any spec write into a path `readRepoFile` reads?

**No. The write set and the read set are disjoint.**

Complete inventory of filesystem writers anywhere under the package source tree:

```
$ git grep -c "writeFileSync\|mkdtempSync\|mkdirSync(\|rmSync(\|cpSync(\|appendFileSync\|renameSync" -- "packages/github-cache/src"
packages/github-cache/src/backend/actions-cache-backend.spec.ts:10
packages/github-cache/src/backend/actions-cache-backend.ts:2
packages/github-cache/src/capture-hashes-cli.spec.ts:5
packages/github-cache/src/read-integration-hash.integration.spec.ts:5
packages/github-cache/src/test/workspace-root-cwd.ts:1
```

Five files. Every write target, with its site:

| Writer | Target | In the repo tree? | Gitignored? |
|--------|--------|-------------------|-------------|
| `actions-cache-backend.spec.ts:937,939,941` | `mkdtempSync('.nx/cache/ver04-')` + `${fixtureRoot}/nx.json` | yes | yes (`.nx/cache`) |
| `actions-cache-backend.spec.ts:1040,1066` | `rmSync(CACHE_ARCHIVE_DIR)` = `.nx/cache` | yes | yes |
| `actions-cache-backend.ts:183,313` | `mkdirSync(CACHE_ARCHIVE_DIR)` = `.nx/cache` | yes | yes |
| `capture-hashes-cli.spec.ts:186,199` | `mkdtempSync('.nx/cache/diff-')` + a run.json inside it | yes | yes |
| `read-integration-hash.integration.spec.ts:94,126` | `mkdtempSync(join(tmpdir(), 'read-integration-hash-'))` | **no** -- OS temp dir | n/a |
| `workspace-root-cwd.ts:118` | `mkdirSync(CACHE_ARCHIVE_DIR)` = `.nx/cache` | yes | yes |

`CACHE_ARCHIVE_DIR` is pinned:

```
$ git grep -n "CACHE_ARCHIVE_DIR = " -- packages/
packages/github-cache/src/lib/cache-archive-path.ts:75:export const CACHE_ARCHIVE_DIR = '.nx/cache';
```

The complete read set of `readRepoFile` (from the caller enumeration in Q2): `nx.json`,
`package.json`, `packages/github-cache/package.json`, `packages/github-cache/project.json`,
`README.md`, `.gitattributes`, `ppe/action.yml`, `.github/workflows/{ci,cleanup}.yml`,
`docs/**`, and `.ts` sources under `packages/github-cache/src/`.

**Zero overlap.** Every in-tree write lands under `.nx/cache/`; nothing under `.nx/` is ever read
through `readRepoFile`. Note in particular that the one write that creates a file NAMED `nx.json`
(`actions-cache-backend.spec.ts:941`) writes `.nx/cache/ver04-XXXX/nx.json`, not the workspace-root
`nx.json` that `readRepoFile('nx.json')` resolves.

**A memoizing `Map<string, string>` with no invalidation is SOUND.** Add the comment CONTEXT G2
requires, and state the evidence: the writers are the five files above, all writing under
`.nx/cache` or `os.tmpdir()`.

**Pitfall to plan around.** The memo must key on the *relative path string*, and every caller
already passes a constant literal, so no normalisation is needed. Do NOT memo `repoFileUrl` --
it returns a mutable `URL` object and handing the same instance to two callers is a new aliasing
hazard for zero gain (each `new URL` is already trivial).

---

## Q2 -- A1/A2 blast radius

### `readRepoFile` callers (17 call sites across 13 files)

```
$ git grep -n "readRepoFile" -- packages/ | rg -v "src/test/repo-file"
```

| File | Paths read |
|------|-----------|
| `cleanup/cleanup-workflow.spec.ts:22` | `.github/workflows/cleanup.yml` |
| `docs-adoption.spec.ts:58,88,144,175,236,237,249` | `docs/configuration.md`, `docs/versioning.md`, loop over doc paths, `docs/advanced.md`, `README.md`, `docs/examples/minimal-ci.yml` (x2) |
| `docs-cross-os.spec.ts:50,52,259,277` | `docs/cross-os.md`, `nx.json`, `README.md`, `docs/advanced.md` |
| `docs-same-os-claims.spec.ts:720` | via the `read` alias -- 5 call sites, incl. `.github/workflows/ci.yml` twice |
| `dogfood-cross-os.spec.ts:50,2236` | `.github/workflows/ci.yml` **twice** |
| `hash-parity/compare.spec.ts:768` | `.github/workflows/ci.yml` |
| `lib/release-asset-name.spec.ts:368` | `.gitattributes` |
| `lint-scope-drift.spec.ts:254` | arbitrary `.ts` sources, inside a loop |
| `nx-target-inputs.spec.ts:59,79` | `nx.json`, `packages/github-cache/project.json` |
| `pinned-deps.spec.ts:17,95` | `packages/github-cache/package.json`, `package.json` |
| `ppe/ppe-action.spec.ts:27` | `ppe/action.yml` |
| `public-surface.spec.ts:84` | arbitrary `.ts` sources, inside a loop |
| `windows-regression-detector.spec.ts:53` | `.github/workflows/windows-regression-detector.yml` |
| `test/repo-file.spec.ts:161,235` | `nx.json`, plus every package `.ts` module inside a loop |

**No caller writes then re-reads.** Every call is a read-only content scan against tracked files.
The loop callers (`lint-scope-drift`, `public-surface`, `repo-file.spec`) are exactly the ones the
memo helps: they re-read the same tree from three separate specs.

`.github/workflows/ci.yml` is read at least four times across four spec files -- the single biggest
win. `nx.json` is read at three sites.

**One shape to preserve:** `readRepoFile` currently THROWS `ENOENT` on a missing path, and
`docs-same-os-claims.spec.ts:698` documents relying on that throw. A memo that caches only
successful reads preserves it (the throw re-fires on every call). A memo that caches the thrown
error would also be correct here but is more code -- do not write it.

### `jobBlock` callers

`jobBlock` is local to `dogfood-cross-os.spec.ts` and is not exported:

```
$ git grep -n "jobBlock" -- packages/ | rg -c "dogfood-cross-os.spec.ts:"
```
All call sites are in that one file (plus one prose mention in `docs-same-os-claims.spec.ts:71`).
Roughly 80 call sites, dominated by `jobBlock('o3-witness')` (approx. 20x),
`jobBlock('build-windows')` (11x), `jobBlock('typecheck-windows')` (13x),
`jobBlock('test-windows')` (13x).

**It is pure.** Its only input is the module-scope constant `codeLines`
(`dogfood-cross-os.spec.ts:49-51`), computed once at module load from
`stripYamlComments(readRepoFile('.github/workflows/ci.yml'))`. Nothing reassigns `codeLines`
(`git grep -n "codeLines =" -- packages/github-cache/src/dogfood-cross-os.spec.ts` returns only
the `const` declaration). No test writes `ci.yml`. **Memoizing is sound.**

**Two pitfalls for the plan:**

1. `jobBlock` THROWS on an absent job key, and the throw is load-bearing -- it is cited as the
   presence guard at `:625`, `:1328`, `:1504`, `:1148`, `:583-590`. A `Map`-based memo that only
   stores successful results preserves the throw on every call. **Do not cache `undefined` and
   return it.**
2. The `new RegExp` hoist must stay INSIDE `jobBlock`, because the pattern interpolates `name`.
   Hoisting it to module scope is not possible; hoisting it out of the `findIndex` callback is.
   The second regex in the function (`/^ {2}\S/`) is already a literal and is already hoisted by
   the engine -- leave it.

---

## Q3 -- A5: the exception list and the guard that enforces it

### Current content (`packages/github-cache/src/test/repo-file.spec.ts:193-200`)

```ts
const WORKSPACE_ROOT_WALK_EXCEPTIONS = [
  'capture-hashes-cli.spec.ts',
  'consumer-action-runtime.spec.ts',
  'docs-trust.spec.ts',
  'governance-docs.spec.ts',
  'hash-parity/compare.spec.ts',
  'read-integration-hash.integration.spec.ts',
];
```

### How it is enforced: DERIVED SET EQUALITY, not a hand-authored list

`repo-file.spec.ts:231-255` walks every package `.ts` module, comment-strips it, and builds a
per-file regex `new URL\(\s*(?:\`|')(?:\.\./){N}` where `N = levelsToWorkspaceRoot(file)`
(`:221-223`, `3 + depth`). It then `toEqual`s the derived set against the sorted constant. A spec
routed through the layer drops out of the derived set automatically -- so **the constant MUST be
edited in the same commit or the guard reddens.** That is the intended behaviour.

There is a dedicated non-vacuity clause at `:261-274` asserting BOTH
`packageModules().length > 0` AND `WORKSPACE_ROOT_WALK_EXCEPTIONS.length > 0`.

**Dropping three of six leaves three.** `3 > 0`, so the non-vacuity clause stays green and the
guard is NOT left vacuous. Its message explicitly instructs the opposite action only when the list
would hit zero.

### The three sites

```
$ git grep -n "new URL(" -- packages/github-cache/src/hash-parity/compare.spec.ts packages/github-cache/src/capture-hashes-cli.spec.ts packages/github-cache/src/read-integration-hash.integration.spec.ts
packages/github-cache/src/capture-hashes-cli.spec.ts:49:  new URL('../../../capture-hashes.mjs', import.meta.url),
packages/github-cache/src/hash-parity/compare.spec.ts:641:        new URL('../../../../capture-hashes.mjs', import.meta.url),
packages/github-cache/src/hash-parity/compare.spec.ts:758:    new URL('assert-parity.ts', import.meta.url),
packages/github-cache/src/read-integration-hash.integration.spec.ts:91:  new URL('../../../read-integration-hash.mjs', import.meta.url),
```

Exactly one walk each. `compare.spec.ts:758` is a SIBLING-relative `new URL` with no `../`, so the
derivation regex (which demands at least one `../`) never matched it -- leaving it alone is correct
and does not affect the set.

### `repoFileUrl` resolves a WORKSPACE-ROOT file: CONFIRMED

`WORKSPACE_ROOT_URL = new URL('../../../../', import.meta.url)` from
`packages/github-cache/src/test/repo-file.ts` walks `test/ -> src/ -> github-cache/ -> packages/ ->`
workspace root. Both instruments sit at the repo root:

```
$ git ls-files | rg -n "^(capture-hashes|read-integration-hash)\.mjs$"
615:capture-hashes.mjs
728:read-integration-hash.mjs
```

And there is an existing positive control proving the walk lands at the root
(`repo-file.spec.ts:160-162`, `expect(readRepoFile('nx.json')).toContain('targetDefaults')`).

**Rewrite shapes:**
- `compare.spec.ts:641`: `readFileSync(new URL(...), 'utf8')` -> `readRepoFile('capture-hashes.mjs')`.
  `compare.spec.ts` already imports `readRepoFile` at `:26`, so no new import.
- `capture-hashes-cli.spec.ts:49` and `read-integration-hash.integration.spec.ts:91`: both are
  `fileURLToPath(new URL(...))` -> `fileURLToPath(repoFileUrl('<name>.mjs'))`. Keep the
  `fileURLToPath` -- both feed the path to `spawnSync`.

**Watch:** dropping `readFileSync` from `compare.spec.ts` may orphan the `node:fs` import there --
check before committing, `lint`/`typecheck` will catch it.

---

## Q4 -- A6: the three walk copies (PREMISE FAILED)

**The premise "they differ ONLY in the filter" is FALSE. They differ on three axes.**

### Copy 1 -- `backend/actions-cache-backend.spec.ts:747` + `:782-790`

```ts
const PACKAGE_SOURCE_ROOT = 'packages/github-cache/src';

function nonSpecModules(): string[] {
  return readdirSync(PACKAGE_SOURCE_ROOT, {
    encoding: 'utf8',
    recursive: true,
  })
    .map((entry) => `${PACKAGE_SOURCE_ROOT}/${entry.replaceAll('\\', '/')}`)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
}
```

### Copy 2 -- `lib/cache-key.spec.ts:84,87` + `:101-109`

```ts
const SOURCE_ROOT_URL = new URL('../', import.meta.url);
const PACKAGE_SOURCE_ROOT = 'packages/github-cache/src';

function nonSpecModules(): string[] {
  return readdirSync(SOURCE_ROOT_URL, {
    encoding: 'utf8',
    recursive: true,
  })
    .map((entry) => entry.replaceAll('\\', '/'))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
}
```

### Copy 3 -- `test/repo-file.spec.ts:171` + `:211-218`

```ts
const PACKAGE_SOURCE_ROOT = 'packages/github-cache/src';

function packageModules(): string[] {
  return readdirSync(repoFileUrl(PACKAGE_SOURCE_ROOT), {
    encoding: 'utf8',
    recursive: true,
  })
    .map((entry) => entry.replaceAll('\\', '/'))
    .filter((file) => file.endsWith('.ts') && !file.startsWith('test/'));
}
```

### The three axes of difference

| Axis | Copy 1 | Copy 2 | Copy 3 |
|------|--------|--------|--------|
| Root resolution | **cwd-relative string** (needs the `workspace-root-cwd` hook) | `import.meta.url`-anchored | `repoFileUrl`-anchored |
| Returned path shape | **prefixed** `packages/github-cache/src/<rel>` | bare `<rel>` | bare `<rel>` |
| Filter | `.ts && !.spec.ts` | `.ts && !.spec.ts` | `.ts && !startsWith('test/')` |

All three roots resolve to the SAME directory (`packages/github-cache/src`); copy 2's `../` from
`src/lib/` and copy 3's `repoFileUrl('packages/github-cache/src')` are both that directory, and
copy 1's cwd-relative literal is that directory once the hook has chdir'd to the workspace root.

Copy 1's docstring makes the cwd dependency an explicit CONSTRAINT: *"A FUNCTION, not a
module-scope constant ... the workspace-root cwd hook has NOT run at collection time -- so the walk
must happen inside an `it`."*

### Consequences for the plan

1. **The extracted helper must be URL-anchored** (`repoFileUrl`), which is what copies 2 and 3
   already do. That REMOVES copy 1's cwd dependency -- an improvement, but copy 1's docstring then
   states a constraint that no longer holds and **must be corrected in the same commit**. Leaving
   the stale docstring is exactly the false-canonical-claim defect `repo-file.ts`'s own header
   was written to fix.
2. **Copy 1's callers assert on PREFIXED literals** and must keep them:
   - `:838-842` `toStrictEqual(['packages/github-cache/src/backend/actions-cache-backend.ts'])`
   - `:885-890` `toStrictEqual([])` (message names the prefix)
   - `:907-916` positive control `toContain('packages/github-cache/src/backend/actions-cache-backend.ts')`
     plus a bare `readFileSync(<prefixed path>, 'utf8')` -- which IS cwd-relative and still
     depends on the hook. **Routing the WALK through the helper does not remove copy 1's
     `readFileSync` cwd dependency.** Either leave those reads alone (smallest diff, recommended)
     or route them through `readRepoFile` too -- but that is a second decision, not this item.
   - `importsActionsCache(file)` at `:809-813` also does a cwd-relative `readFileSync(file)`.
3. **Copy 3's filter is genuinely different** (`!startsWith('test/')` excludes the layer's own
   directory, INCLUDING non-spec `.ts` such as `workspace-root-cwd.ts`, while INCLUDING every
   `.spec.ts` elsewhere). It is not a variant spelling of copy 1/2's filter -- it selects a
   disjoint set. Parameterising the predicate is correct, and the CONTEXT G1 shape covers it.

### Exact signature that covers all three

```ts
/** Every entry under the package source root, workspace-root-relative separator-normalised,
 *  filtered by the caller's own predicate. */
export function packageSourceFiles(predicate: (file: string) => boolean): string[];

/** The package source root, workspace-relative. */
export const PACKAGE_SOURCE_ROOT = 'packages/github-cache/src';
```

Return **bare, root-relative** paths (copies 2 and 3's shape -- two of three need no change).
Copy 1 then reads:

```ts
const nonSpecModules = () =>
  packageSourceFiles((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
    .map((f) => `${PACKAGE_SOURCE_ROOT}/${f}`);
```

Prefixing at the one call site that wants it is smaller and clearer than an options bag.

**Verdict: A6 is still worth doing, but the item description understates the change. Plan it as
"one walk primitive + a per-caller path shape", and budget a docstring correction in
`actions-cache-backend.spec.ts`.**

---

## Q5 -- A8 byte-identity (DECISIVE, verified)

`INVARIANT_TARGETS` (`packages/github-cache/src/hash-parity/compare.ts:82-87`):

```ts
export const INVARIANT_TARGETS = [
  'build',
  'typecheck',
  'test',
  'lint',
] as const satisfies readonly ExpectedTarget[];
```

```
$ node -e "const t=['build','typecheck','test','lint']; console.log(JSON.stringify('Successfully ran targets '+t.join(', ')+' for project')); console.log(JSON.stringify('nx run-many -t '+t.join(' ')+' --skip-nx-cache'));"
"Successfully ran targets build, typecheck, test, lint for project"
"nx run-many -t build typecheck test lint --skip-nx-cache"
```

Today's two literals in `windows-regression-detector.spec.ts`:

| Site | Literal today | Join product | Identical? |
|------|---------------|--------------|-----------|
| `:72-73` | `'Successfully ran targets build, typecheck, test, lint for project'` | `` `Successfully ran targets ${INVARIANT_TARGETS.join(', ')} for project` `` | **YES, byte-for-byte** |
| `:154` | `/nx run-many -t build typecheck test lint --skip-nx-cache/` | `` new RegExp(`nx run-many -t ${INVARIANT_TARGETS.join(' ')} --skip-nx-cache`) `` | **YES, byte-for-byte source** |

**Zero verdict change.** This is a pure no-op-today edit that converts a silent hole into a red test,
exactly as the CONTEXT `<specifics>` block requires.

**Two pitfalls:**

1. Site `:154` is a **RegExp literal**, so the derived form needs `new RegExp(...)`. The comment
   immediately above it (`:139-141`) asserts *"The literal below contains no `.` and no other
   metacharacter, so it can only match CONTIGUOUSLY"*. That claim becomes conditional on
   `INVARIANT_TARGETS`' members staying metacharacter-free. Today they are (`build`, `typecheck`,
   `test`, `lint` -- all `[a-z]+`). **Update that comment to say the property now rests on the
   imported constant**; do not silently leave a claim about a literal standing over a computed
   regex.
2. The import is new: `windows-regression-detector.spec.ts` does not currently import from
   `./hash-parity/compare.js`. Check that no `no-restricted-imports` / `no-restricted-syntax` rule
   or `lint-scope-drift` set-equality objects to a spec importing across that directory. Nothing in
   `eslint.config.mjs`'s `paths` list covers intra-repo relative specifiers (it lists only
   `node:os`/`os`/`node:path`/`path`/`node:process`/`process`), so this is expected to be clean.

---

## Q6 -- A9: every `MIRRORED_BY_PREFIX` reference (PREMISE FAILED)

```
$ git grep -n "MIRRORED_BY_PREFIX\|mirroredByLabel" -- packages/
packages/github-cache/src/action/index.spec.ts:8:import { mirroredByLabel } from '../lib/mirrored-by-label.js';
packages/github-cache/src/action/index.spec.ts:390:    const label = mirroredByLabel('windows');
packages/github-cache/src/lib/mirrored-by-label.ts:9:export const MIRRORED_BY_PREFIX = 'mirrored-by: ';
packages/github-cache/src/lib/mirrored-by-label.ts:40:export function mirroredByLabel(os: CacheOs): string {
packages/github-cache/src/lib/mirrored-by-label.ts:41:  return `${MIRRORED_BY_PREFIX}${os}`;
packages/github-cache/src/publish/publish-mirror.spec.ts:6:import { mirroredByLabel } from '../lib/mirrored-by-label.js';
packages/github-cache/src/publish/publish-mirror.spec.ts:92:const LABEL = mirroredByLabel(PUBLISHING_OS);
packages/github-cache/src/publish/publish-mirror.spec.ts:409:          mirroredByLabel(os),
packages/github-cache/src/publish/publish-mirror.ts:17:import { mirroredByLabel } from '../lib/mirrored-by-label.js';
packages/github-cache/src/publish/publish-mirror.ts:828:  const label = mirroredByLabel(cachePlatform());
packages/github-cache/src/roundtrip/read-back.spec.ts:12:  MIRRORED_BY_PREFIX,
packages/github-cache/src/roundtrip/read-back.spec.ts:13:  mirroredByLabel,
packages/github-cache/src/roundtrip/read-back.spec.ts:186:  return mirroredByLabel(os);
packages/github-cache/src/roundtrip/read-back.spec.ts:363:    expect(MIRRORED_BY_PREFIX).toBe('mirrored-by: ');
packages/github-cache/src/roundtrip/read-back.spec.ts:186:  return mirroredByLabel(os);
packages/github-cache/src/roundtrip/read-back.ts:14:import { MIRRORED_BY_PREFIX } from '../lib/mirrored-by-label.js';
packages/github-cache/src/roundtrip/read-back.ts:185:  const expected = `${MIRRORED_BY_PREFIX}${readerOs}`;
packages/github-cache/src/roundtrip/read-back.ts:501:      `leg (label '${MIRRORED_BY_PREFIX}${readerOs}'); the real publisher/reader `
```

**The export CANNOT be dropped.** `read-back.spec.ts:363` pins its VALUE:
`expect(MIRRORED_BY_PREFIX).toBe('mirrored-by: ')`. That is the constant's own value guard --
deleting the export to satisfy an unused-export lint would delete a live assertion, which the
CONTEXT `<specifics>` rule ("No guard may be weakened") forbids.

**This is exactly the outcome CONTEXT G4 pre-authorised:** *"if a spec pins it, leave the export
and say so."* The plan must record it, not treat it as a miss.

### The two `read-back.ts` rewrites

Both are inside template literals, so both are byte-identical after the change:

- `:185` `const expected = \`${MIRRORED_BY_PREFIX}${readerOs}\`;` -> `const expected = mirroredByLabel(readerOs);`
- `:501` `` `leg (label '${MIRRORED_BY_PREFIX}${readerOs}'); ...` `` -> `` `leg (label '${mirroredByLabel(readerOs)}'); ...` ``

After both, `read-back.ts:14`'s import switches from `MIRRORED_BY_PREFIX` to `mirroredByLabel`.
The module-level export in `lib/mirrored-by-label.ts` stays.

**~~PITFALL -- `read-back.ts` is a `DOCS_08_SITES` subject.~~ CORRECTED 2026-08-10, this
paragraph was WRONG.** It claimed `read-back.ts` is a row in the DOCS-08 required-phrase table
and instructed the executor to read that row before editing `read-back.ts:501`. Measured: it is
NOT a phrase-table row. `docs-same-os-claims.spec.ts:712` lists it in `EDITED_FILES`, which feeds
the producer-ATTRIBUTION retraction guard -- a NEGATIVE assertion that the file does not
co-locate a whose-bytes phrase with a producer word in one sentence. A9 introduces neither, and
the sentence splitter cannot move a boundary across either edited string because neither contains
a period or a semicolon. **No row check is required and none was performed.** Recorded in place so
a v0.0.3 reader does not re-open the question.

**Also check `fallow`:** if `MIRRORED_BY_PREFIX` becomes referenced only from a `.spec.ts` after
this change, the `fallow:ci` dead-code gate may flag it as unused-from-production. It is currently
referenced from `read-back.ts` (production). After A9 its only non-definition references are
`mirrored-by-label.ts:41` (internal) and `read-back.spec.ts:363` (spec). **Run `fallow:ci` on the
A9 commit specifically.**

---

## Q7 -- A10: the two `probeTokenOf` bodies

### `lib/cache-archive-path.spec.ts:117-123`

```ts
function probeTokenOf(needle: RegExp): string {
  return needle.source
    .replaceAll('\\b', '')
    .replaceAll('[', '')
    .replaceAll(']', '');
}
```

### `lib/compression-method.spec.ts:270-272`

```ts
function probeTokenOf(needle: RegExp): string {
  return needle.source.replaceAll('[', '').replaceAll(']', '');
}
```

**The `cache-archive-path` version is a strict superset** -- identical operations plus one extra
`replaceAll('\\b', '')` applied first.

### Does any `compression-method.spec.ts` needle contain `\b`? NO.

```
$ git grep -n "FORBIDDEN_RESULT_MEMBERS" -A5 -- packages/github-cache/src/lib/compression-method.spec.ts
const FORBIDDEN_RESULT_MEMBERS = [
  /probe[.]st[a]tus/,
  /probe[.]err[o]r/,
] as const;
```

Two needles, sources `probe[.]st[a]tus` and `probe[.]err[o]r`. Neither contains `\b`, so the extra
`replaceAll('\\b', '')` is a NO-OP on both and the superset produces byte-identical tokens
(`probe.status`, `probe.error`).

**Zero behaviour change.** The dedupe is safe in the stated direction (superset wins).

**Placement note (ponytail):** the shared home is `src/test/repo-file.ts` -- it is already the
package's spec-primitive module and already houses `stripLineComments`, which BOTH of these specs
import. No new file needed.

**Pitfall:** `cache-archive-path.spec.ts`'s own `FORBIDDEN` list bans `n[o]de:path` etc. in the
SUBJECT (`cache-archive-path.ts`), not in the spec, so an added import in the spec is harmless.
But both specs carry a "this file spells nothing verbatim" discipline -- the extracted helper's
docstring must not spell `probe.status` or `node:path` verbatim either.

---

## Q9 -- A7: the JSON fence and the replacement assertion

### The fence, read and parsed

```
$ node -e "const fs=require('fs');const doc=fs.readFileSync('docs/cross-os.md','utf8');const b=[...doc.matchAll(/^\`\`\`json\n([\s\S]*?)^\`\`\`/gm)].map(m=>m[1]);console.log('json fences:',b.length);console.log(b[0]);try{JSON.parse(b[0]);console.log('PARSES OK')}catch(e){console.log('PARSE FAIL:',e.message)}"
json fences: 1
{
  "targetDefaults": {
    "build":  { "inputs": ["...your build inputs...", { "runtime": "node --no-warnings -p process.platform" }] },
    "test":   { "inputs": ["...your test inputs...",  { "runtime": "node --no-warnings -p process.platform" }] },
    "lint":   { "inputs": ["...your lint inputs...",  { "runtime": "node --no-warnings -p process.platform" }] }
  }
}
PARSES OK
```

(reflowed for width; the on-disk fence is multi-line and parses verbatim)

**Exactly one ```json fence, and it is valid JSON.** A7's premise holds.

### The gate being replaced (`docs-cross-os.spec.ts:142`, asserted at `:153-170`)

```ts
const SNIPPET_DISCRIMINATOR_SITES = 3;
...
expect(snippets[0].split(command).length - 1, ...).toBe(SNIPPET_DISCRIMINATOR_SITES);
```

The CONTEXT critique is confirmed by inspection: `split(command).length - 1` counts occurrences in
the fence BODY as a flat string. Deleting the `lint` key and adding a second runtime input under
`build` keeps the count at 3. The gate cannot localize.

### Exact replacement shape

`runtimeInputsOf` already exists in this very file (`:61-67`) and already extracts
`{ runtime: ... }` entries from an inputs array. Reuse it -- do not author a second extractor.

```ts
it('the cross-os doc renders that exact command once per target in the config snippet', () => {
  const command = declaredDiscriminators[0];
  const snippets = fencedBodies('json');

  // extraction control, unchanged
  expect(snippets.length, `...${REWORD_ADVICE}`).toBe(1);

  const snippet = JSON.parse(snippets[0]) as {
    targetDefaults: Record<string, { inputs?: readonly unknown[] }>;
  };

  // THE TARGET KEYS, by set equality -- this is what the count could not do.
  expect(Object.keys(snippet.targetDefaults).sort(), `...${REWORD_ADVICE}`)
    .toEqual(['build', 'lint', 'test']);

  // EACH key carries the discriminator, exactly once. Per-target, so deleting `lint`
  // and doubling `build` now fails on both clauses instead of neither.
  for (const target of ['build', 'test', 'lint']) {
    expect(
      runtimeInputsOf(snippet.targetDefaults[target].inputs),
      `...${REWORD_ADVICE}`,
    ).toEqual([command]);
  }
});
```

`toEqual([command])` (not `toContain`) pins BOTH presence and the exactly-once cardinality per
target, so the "exact count, never a floor" discipline the deleted comment insists on is preserved
-- now at the level where it can localize.

**Do not delete the surrounding comment block wholesale.** `:108-141` carries the CR-01 history
and the "a green structural guard over a wrong payload" lesson. Rewrite it to state the new
invariant; the reasoning is what a future reader needs.

**Do not touch the sibling `it` at `:172-180`** (the ```bash verification fence clause). It is a
different job and A7 does not cover it.

---

## Q11 -- guards that read these very files

This is the surprise-red list. Pin these BEFORE touching code.

| Guard | What it reads | Items at risk | Why |
|-------|---------------|---------------|-----|
| `test/repo-file.spec.ts:231-255` "lists exactly the specs that author their own workspace-root walk" | comment-stripped source of **every** package `.ts` module, regex for `new URL('../../..` | **A5 (directly), and any item that adds or removes a `new URL('../` walk** | Derived set equality. Routing the three sites REQUIRES editing `WORKSPACE_ROOT_WALK_EXCEPTIONS` in the SAME commit or the guard reddens. This is the intended coupling, not a bug. |
| `test/repo-file.spec.ts:261-274` non-vacuity | `packageModules().length`, `WORKSPACE_ROOT_WALK_EXCEPTIONS.length` | A5, A6 | Both must stay `> 0`. A5 leaves 3 exceptions -- safe. A6 changes `packageModules` into `packageSourceFiles`; the non-vacuity clause must be re-pointed at the new helper in the same commit. |
| `docs-same-os-claims.spec.ts:701-760` DOCS-08 phrase table | RAW source text of 8 named files, incl. **`roundtrip/read-back.ts`**, `publish/publish-mirror.ts`, `lib/cache-key.ts`, `action/index.ts` | **A9** | Exact `toContain(phrase)` + `forbidden` regexes over raw text. A9 rewrites a string at `read-back.ts:501`. Read the `read-back.ts` row first. |
| `docs-same-os-claims.spec.ts:810,851` | `read('.github/workflows/ci.yml')` incl. a `split(phrase).length - 1` occurrence COUNT | **A11** (this file is where the `read` alias lives) | Deleting `const read = readRepoFile` renames 5 call sites. Mechanical, but the file also carries 3 PROSE mentions of `read()` at `:60`, `:435`, `:698` that become stale references. |
| `lint-scope-drift.spec.ts:115-166,288-330` | **imports `eslint.config.mjs` as a module** and asserts on the loaded object (exactly-one config object for `no-restricted-syntax`; global `ignores` by SET EQUALITY) | **A14** | It asserts on the LOADED VALUE, not source text, so a flatMap producing the same array is transparent -- as long as the number of config OBJECTS is unchanged. A14 changes only the `paths` array inside one rule, so this stays green. Verify anyway. |
| `lint-rules.spec.ts` (whole file) | instantiates the real ESLint Node API against `eslint.config.mjs` and asserts VERDICTS via `lintText` | **A14** | Behavioural, not structural. Six `paths` entries produced by a flatMap are indistinguishable from six literals. Green iff the flatMap output is deep-equal, INCLUDING `message` and `importNames` per entry. |
| `nx-target-inputs.spec.ts:734-747` | `nx.json` `test.inputs` / `lint.inputs` must contain `{workspaceRoot}/eslint.config.mjs` | A14 (indirect) | Not broken by A14 -- but it is WHY A14 rotates the `test` and `lint` hashes (CONTEXT G6). No action. |
| `nx-target-inputs.spec.ts:401,762,786,962` | prose/pins naming `eslint.config.mjs` and `capture-hashes.mjs` | A3, A14 | Comment-level. Confirm the `{workspaceRoot}/capture-hashes.mjs` `test`-input pin survives A3 (it does -- A3 edits the instrument, not `nx.json`). |
| `hash-parity/compare.spec.ts:637-664` | **reads `capture-hashes.mjs` source** and regex-extracts `^const TARGETS = \[([^\]]+)\];` | **A3, A4** | If A3/A4 reflow `capture-hashes.mjs` such that the `const TARGETS = [...]` single-line array declaration moves or wraps, the extraction empties and BOTH clauses redden -- and the file explicitly warns about that. A3/A4 touch imports and a hoist, not `TARGETS`, so this should stay green. **Assert it explicitly in the plan's verify step.** |
| `hash-parity/compare.spec.ts:667-684` | `INVARIANT_TARGETS` deep-equality, `DIVERGENT_TARGET` disjointness | **A8** | A8 CONSUMES `INVARIANT_TARGETS`; it does not change it. This guard is the reason the join products are stable. No action, but it is the anchor A8 rests on. |
| `windows-regression-detector.spec.ts:53` | `.github/workflows/windows-regression-detector.yml` | A8 | The needles are asserted against the workflow. A8 keeps both needles byte-identical, so the workflow is untouched and the clauses stay green. |
| `backend/actions-cache-backend.spec.ts:838,885,907` | derived arrays of PREFIXED module paths | **A6** | Exact `toStrictEqual` on prefixed literals. The extracted helper must return bare paths and copy 1 must re-prefix, or all three clauses redden. |
| `lib/cache-key.spec.ts:169` | `for (const file of nonSpecModules())` over BARE paths | **A6** | Bare-path shape must be preserved. |
| `test/repo-file.spec.ts:45-154` | control suite for `stripLineComments` / `stripYamlComments` | A6, A10 (both add exports to `repo-file.ts`) | Adding exports does not touch these. But if A10's shared `probeTokenOf` lands in `repo-file.ts`, it needs its OWN control -- the file's stated discipline is that a primitive without a positive control is the defect one layer down. Both existing `probeTokenOf` call sites already carry `'%s matches its own derived probe token'` non-vacuity clauses; those become the shared control. Confirm both survive. |
| `dogfood-cross-os.spec.ts:583-590` | prose claiming `jobBlock` is the only job-block extractor and "stays unexported" | **A2** | Comment-level only -- no assertion enforces it. A2 keeps `jobBlock` unexported and local, so the claim stays true. |
| `public-surface.spec.ts:78-84`, `lint-scope-drift.spec.ts:240-254` | both route reads through `readRepoFile` and carry comments SAYING so | **A1** | Memoizing inside `readRepoFile` is invisible to both. Their comments describe routing, not read freshness. Safe. |

**Cross-cutting rule:** every item that edits a `.ts` file under `packages/github-cache/src`
is itself scanned by `repo-file.spec.ts:232` (comment-stripped) and by
`lint-scope-drift.spec.ts` / `public-surface.spec.ts` source scans. None of the 15 items adds a
`new URL('../` walk, so the derived exception set only ever SHRINKS -- and only from A5.

---

## Q8 -- A3/A4: proof method, and which imports each function needs

### The six static imports (`capture-hashes.mjs:59-64`)

```
$ sed -n '59,64p' capture-hashes.mjs
import { readNxJson } from 'nx/src/config/nx-json.js';
import { createTaskHasher } from 'nx/src/hasher/create-task-hasher.js';
import { getNativeFileCacheLocation } from 'nx/src/native/native-file-cache-location.js';
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
import { createTaskGraph } from 'nx/src/tasks-runner/create-task-graph.js';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory.js';
```

Six specifiers, six bindings, one binding each.

### Exactly which function needs which (every use site, measured)

```
$ for s in readNxJson createTaskHasher getNativeFileCacheLocation createProjectGraphAsync createTaskGraph workspaceDataDirectory; do git grep -n "\b$s\b" -- capture-hashes.mjs; done
```

| Binding | Use site(s) | Enclosing function | Function is `async`? |
|---------|-------------|--------------------|----------------------|
| `readNxJson` | `:417` | `capture()` | yes |
| `createTaskHasher` | `:385` | `captureTargets()` | yes |
| `getNativeFileCacheLocation` | `:279` | `measureGraphState()` | **NO -- sync** |
| `createProjectGraphAsync` | `:425`, `:610` | `capture()`, `assertGraphPremise()` | yes, yes |
| `createTaskGraph` | `:363`, `:527` | `captureTargets()`, **`resolvedTaskIds()`** | yes, **NO -- sync** |
| `workspaceDataDirectory` | `:278` | `measureGraphState()` | **NO -- sync** |

(`:284` is `workspaceDataDirectory:` as an object KEY, not a use. `:3` and `:505` are comments.)

### PREMISE CORRECTION -- there are FIVE consumer functions, not four

The item names `capture()`, `assertGraphPremise()`, `measureGraphState()`, `captureTargets()`.
It omits **`resolvedTaskIds()` (`:522-537`), which calls `createTaskGraph` at `:527`**, and it is
**synchronous**. Its two callers are `assertGraphPremise():621,622`.

Two of the five consumers are sync (`measureGraphState`, `resolvedTaskIds`), so a bare
`await import()` inside them is not possible. The plan needs a shape decision:

| Option | Shape | Cost |
|--------|-------|------|
| **(a) recommended** | `measureGraphState()` becomes `async` (one caller, `capture():416`, already async). `resolvedTaskIds()` takes `createTaskGraph` as a third parameter, awaited once in `assertGraphPremise()` and passed to both call sites. | smallest; no hidden priming order |
| (b) | Both become `async`; `assertGraphPremise` awaits both calls. | `resolvedTaskIds` stops being a pure sync helper for no gain |
| (c) | A module-scope "prime once, read sync" cache. | subtle -- a read before priming is a silent `undefined`; rejected on ponytail grounds |

### What A3 actually buys, and the natural measurement

`capture-hashes-cli.spec.ts` spawns the instrument **7 times** for argument-rejection cases, none
of which reaches any Nx API. Today every one of those spawns pays the full `nx/src/...` module-load
cost. That spec is the measurement of the win, and it is already in the suite.

### A4 -- the hoist, and why it is the upstream-canonical shape

`capture-hashes.mjs:385` constructs `createTaskHasher(projectGraph, nxJson)` INSIDE
`for (const target of TARGETS)` (`:359`), i.e. 5 constructions per capture, both arguments
loop-invariant.

```
$ cat node_modules/nx/dist/src/hasher/create-task-hasher.js
function createTaskHasher(projectGraph, nxJson, runnerOptions) {
    if (daemonClient.enabled()) { return new DaemonBasedTaskHasher(daemonClient, runnerOptions); }
    else {
        const { rustReferences } = getFileMap();
        return new InProcessTaskHasher(projectGraph, nxJson, rustReferences, runnerOptions);
    }
}
```

With `NX_DAEMON=false` (the CI shape), each construction calls `getFileMap()` and builds a new
`NativeTaskHasherImpl` -- the expensive path, done 5x. `hashTask` then delegates straight through
and mutates no per-call state on `this`
(`node_modules/nx/dist/src/hasher/task-hasher.js:76-77`).

**Nx itself constructs ONE hasher per run and hashes every task with it:**

```
$ rg -n "createTaskHasher" node_modules/nx/dist/src/tasks-runner/run-command.js node_modules/nx/dist/src/tasks-runner/init-tasks-runner.js
node_modules/nx/dist/src/tasks-runner/run-command.js:672:    let hasher = createTaskHasher(projectGraph, nxJson, runnerOptions);
node_modules/nx/dist/src/tasks-runner/init-tasks-runner.js:23:    let hasher = createTaskHasher(projectGraph, nxJson, options);
```

The hoist makes the instrument match upstream usage. **A4 premise VERIFIED.**

### THE PROOF METHOD -- and the trap that a naive diff walks into

**`capture-hashes.mjs` IS ITSELF A HASHED `test` INPUT.** Measured:

```
$ node -e "const j=JSON.parse(require('fs').readFileSync('nx.json','utf8'));for(const [t,c] of Object.entries(j.targetDefaults)){console.log(t.padEnd(14), JSON.stringify((c.inputs||[]).filter(i=>typeof i==='string'&&(i.includes('capture-hashes')||i.includes('eslint.config')||i.includes('read-integration-hash')))))}"
test           ["{workspaceRoot}/eslint.config.mjs","{workspaceRoot}/capture-hashes.mjs"]
integration    ["{workspaceRoot}/read-integration-hash.mjs"]
build          []
typecheck      []
lint           ["{workspaceRoot}/eslint.config.mjs"]
```

So A3+A4 **MUST** rotate the `test` hash and **MUST NOT** rotate `build`, `typecheck`,
`integration` or `lint`. A `test` hash that did NOT move would itself be the defect -- it would
mean the instrument is not a hashed input, the exact stale-PASS hole
`capture-hashes-cli.spec.ts:40-46` records as CLOSED.

`meta` also varies unconditionally between two captures: `capturedAt` (timestamp),
`commit`, `workingTreeClean`, and the whole `graphState` group (`cold` on the first run,
`warm` on the second). **Do not diff whole records.**

### Exact commands

```bash
# 1. BEFORE -- at a tree whose ONLY pending delta is nothing (pre-A3/A4 commit checked out)
NX_DAEMON=false node capture-hashes.mjs --install-mode install --out /tmp/kuo-before.json

# 2. apply A3 + A4 -- and NOTHING ELSE in the working tree

# 3. AFTER
NX_DAEMON=false node capture-hashes.mjs --install-mode install --out /tmp/kuo-after.json

# 4. THE ASSERTION -- four target hashes byte-identical, `test` rotated, structure identical
node -e "
const a=require('/tmp/kuo-before.json'), b=require('/tmp/kuo-after.json');
const same=(t)=>a.targets[t].hash===b.targets[t].hash;
for (const t of ['build','typecheck','integration','lint'])
  console.log(t.padEnd(12), same(t)?'IDENTICAL (required)':'DIFFERS -- FAIL');
console.log('test'.padEnd(12), same('test')?'IDENTICAL -- FAIL, the instrument is not a hashed input':'ROTATED (required)');
console.log('projectConfiguration', JSON.stringify(a.projectConfiguration)===JSON.stringify(b.projectConfiguration)?'IDENTICAL':'DIFFERS -- FAIL');
console.log('discriminator       ', JSON.stringify(a.discriminator)===JSON.stringify(b.discriminator)?'IDENTICAL':'DIFFERS -- FAIL');
console.log('nodes-per-target    ', ['build','typecheck','test','integration','lint'].every(t=>Object.keys(a.targets[t].nodes).length===Object.keys(b.targets[t].nodes).length)?'SAME COUNTS':'DIFFERS -- inspect');
"

# 5. HUMAN-READABLE LOCALISATION (the instrument's own comparator, prints, never exits non-zero)
node capture-hashes.mjs --diff /tmp/kuo-before.json /tmp/kuo-after.json
```

**`NX_DAEMON=false` is how CI invokes it** -- `.github/workflows/ci.yml:1787` and `:1838` set it as
a step `env:`, and the instrument deliberately MEASURES `daemonEnabled` rather than forcing it
(`capture-hashes.mjs:290-292`). Reproducing the CI shape locally therefore means setting the env
var yourself. It also matters for A4: with the daemon ON, `createTaskHasher` returns the cheap
`DaemonBasedTaskHasher` and the hoist saves nothing measurable.

**SEQUENCING CONSTRAINT for the plan:** the measurement must be taken with ONLY the A3+A4 delta in
the tree. Any other item's edit to a `test`-input file (A14's `eslint.config.mjs`, or any
`packages/github-cache/src` source) rotates `test` and/or `lint` too and destroys the signal.
CONTEXT G5's atomic-commit discipline already delivers this -- just take the measurement at the
A3/A4 commit, not at the end.

### A3's own guard, to pin before touching the file

`hash-parity/compare.spec.ts:637-664` READS `capture-hashes.mjs` and regex-extracts
`/^const TARGETS = \[([^\]]+)\];/m`, asserting the extraction FIRST and then a lockstep equality
against `EXPECTED_TARGETS`. A3/A4 do not touch `TARGETS`, so it should stay green -- but it is the
one clause that reddens if the edit reflows that declaration. **Include it in the A3/A4 commit's
verify step by name.**

---

## Q10 -- gate cost per item, and the `serve()` / ROBUST-04 question

### Does ANY item touch a `serve()`-reachable source? NO.

The consumer action bundle entry is `start-cache-server/entry.ts`, which imports exactly one
internal module:

```
$ git grep -n "^import" -- start-cache-server/entry.ts
import * as core from '@actions/core';
import { serve } from '../packages/github-cache/src/serve.js';
```

Measured against the committed bundle:

```
$ for n in "round-trip read-back" "mirrored-by: " "assertPublishedByThisLeg" "MIRRORED_BY_PREFIX" "stripYamlComments" "readRepoFile" "WORKSPACE_ROOT_URL"; do printf '%-28s ' "$n"; rg -c -F "$n" start-cache-server/index.js || echo 0; done
round-trip read-back         0
mirrored-by:                 0
assertPublishedByThisLeg     0
MIRRORED_BY_PREFIX           0
stripYamlComments            0
readRepoFile                 0
WORKSPACE_ROOT_URL           0
```

**Zero hits.** The only production module any of the 15 items touches is
`packages/github-cache/src/roundtrip/read-back.ts` (A9), and it is a SEPARATE bin invoked as
`dist/roundtrip/read-back.js` by ci.yml's `publish-verify` job -- not reachable from `serve()`.
`src/test/repo-file.ts` (A1, A6, A10) is spec-only.

**ROBUST-04's "regenerate `start-cache-server/index.js` in the SAME commit" does NOT apply to any
of A1..A15.** `check:action` should report no drift for every commit in this task.

**But re-read the dispatch note in CONTEXT `<specifics>`:** run on the MAIN TREE. A junctioned
`node_modules` in a worktree makes esbuild rewrite module paths and `check:action` reports false
drift (recorded project memory). There is one plan, so nothing is lost.

### Per-item gate exposure

| Item | test | lint | typecheck | format:check | check:action | fallow:ci |
|------|:----:|:----:|:---------:|:------------:|:------------:|:---------:|
| A1 `readRepoFile` memo | yes (all 17 callers) | - | - | yes | - | - |
| A2 `jobBlock` memo | yes (`dogfood-cross-os`) | - | - | yes | - | - |
| A3 lazy nx imports | yes (`capture-hashes-cli`, `compare.spec` TARGETS extraction) | yes | - | yes | - | **yes** (entry-point file; a now-unused top-level binding is a finding) |
| A4 hasher hoist | yes | - | - | yes | - | - |
| A5 route 3 walks | **yes (the derived set-equality guard is coupled)** | yes | yes (orphaned `node:fs` import) | yes | - | - |
| A6 walk extraction | **yes (3 exact-array clauses + non-vacuity)** | yes | yes | yes | - | yes (new export, spec-only consumers) |
| A7 JSON-parse gate | yes (`docs-cross-os`) | - | yes | yes | - | - |
| A8 derived needles | yes (`windows-regression-detector`) | yes (new cross-dir import) | yes | yes | - | - |
| A9 `mirroredByLabel` | yes (`read-back.spec`, **`docs-same-os-claims` DOCS-08 table**) | - | yes (import swap) | yes | no (not bundled) | **yes** (`MIRRORED_BY_PREFIX` loses its production reference) |
| A10 dedupe `probeTokenOf` | yes (2 specs) | - | yes | yes | - | yes (new export) |
| A11 delete 2 aliases | yes (2 specs) | yes (unused-binding) | yes | yes | - | - |
| A12 delete 1 assertion | yes (`compare.spec`) | - | - | yes | - | - |
| A13 hoist a spawn | yes (`read-integration-hash.integration` -- the `integration` target, NOT `test`) | - | yes | yes | - | - |
| A14 flatMap the paths | yes + **lint** (both hash `eslint.config.mjs`) | **yes** | - | **yes -- Prettier owns the reformat; run `npm run format` after** | - | - |
| A15 `it.each` | yes (`nx-target-inputs`) | - | yes | yes | - | - |

**Note the target split for A13:** `read-integration-hash.integration.spec.ts` runs under the
`integration` target (`vitest.integration.config.mts`), not `test`. `npm run test` does not
exercise it. The plan's verify step for A13 must run `npm run integration` (or the targeted
integration config), or the change ships unverified.

**`fallow:ci` is the least-obvious gate.** Three items add or orphan an export:
- A3 -- if any lazy-loaded binding is removed from the top-level import list but a stale reference
  remains, or vice versa.
- A9 -- `MIRRORED_BY_PREFIX`'s only remaining consumers become `mirrored-by-label.ts:41` (internal)
  and `read-back.spec.ts:12` (spec). `.fallowrc.jsonc` credits test imports (its own `entry`
  comment says so), and `readRepoFile`/`stripLineComments` are already spec-only-consumed exports
  that fallow accepts today -- so the precedent is good. **Verify on the A9 commit anyway.**
- A6/A10 -- two new spec-only exports on `repo-file.ts`, same precedent.

`roundtrip/read-back.ts` is an explicit fallow **entry point** (`.fallowrc.jsonc`), so the module
itself stays reachable regardless of A9.

### Baseline measured green before any edit

```
$ npx vitest run --config packages/github-cache/vitest.config.mts src/test/repo-file.spec.ts src/docs-cross-os.spec.ts src/windows-regression-detector.spec.ts src/lib/cache-archive-path.spec.ts src/lib/compression-method.spec.ts src/nx-target-inputs.spec.ts
 Test Files  6 passed (6)
      Tests  140 passed (140)
   Duration  1.19s
```

That is the fast per-commit loop shape for most items (1.2s vs a full battery).
`--reporter=basic` is NOT available in vitest 4.1.10 -- it fails with `ERR_LOAD_URL`. Omit it.

---

## A11, A12, A13, A15 -- the remaining premises

### A11 -- two identity aliases (VERIFIED, with prose fallout)

```
$ git grep -n "const read = readRepoFile\|function mirroredBy" -- packages/
packages/github-cache/src/docs-same-os-claims.spec.ts:720:const read = readRepoFile;
packages/github-cache/src/roundtrip/read-back.spec.ts:185:function mirroredBy(os: CacheOs): string {  // returns mirroredByLabel(os)
```

| Alias | Call sites to rename | Extra fallout |
|-------|---------------------|---------------|
| `read` -> `readRepoFile` | `:728`, `:742`, `:810`, `:851`, `:893` (5) | **3 PROSE references to `read()`** at `:60`, `:435`, `:698` become stale. `:698`'s reference is load-bearing prose ("`read()` is a `readFileSync` that THROWS on a missing path"). Update all three in the same commit. |
| `mirroredBy` -> `mirroredByLabel` | `:235`, `:251`, `:374`, `:390`, `:399`, `:400`, `:438`, `:520` (8) | none; `mirroredByLabel` is already imported at `:13` |

Both aliases are pure pass-throughs with no added behaviour. Deleting them is safe.

### A12 -- delete the Prettier-import-shape assertion (VERIFIED)

`hash-parity/compare.spec.ts:824`:

```ts
).toContain('import {\n  collapseToOneLine,');
```

This pins a Prettier-produced multi-line import layout -- it reddens on a reformat that changes
nothing semantic. **The guard is NOT weakened by deleting it**, because the very next assertion
(`:825-827`) pins the CALL:

```ts
expect(assertParitySource).toContain(
  'collapseToOneLine(error instanceof Error ? error.message : String(error))',
);
```

A source containing that call cannot compile without importing `collapseToOneLine`, and
`typecheck` enforces that. The third clause (`:828-836`, the `not.toMatch` on the unsanitised
shape) is untouched. **Record that subsumption argument in the commit message and in the
surrounding comment** -- the comment at `:815-822` still describes the invariant correctly and
should stay.

### A13 -- hoist the duplicated `read(ACCEPTED)` spawn (VERIFIED, with a shape caveat)

`read-integration-hash.integration.spec.ts:145` and `:159` both call `read(ACCEPTED)` --
two full `spawnSync(node, [read-integration-hash.mjs, ...])` runs of the same fixture.

`read()` (`:121-139`) increments `caseIndex`, writes `run-N.json`/`hash-N.txt` under the
module-scope `WORKSPACE` tmpdir, spawns, and returns the result. It is deterministic for a given
fixture.

**CAVEAT -- do not hoist to a plain `describe`-scope `const`.** Vitest evaluates `describe` bodies
at COLLECTION time, so a bare `const accepted = read(ACCEPTED);` inside the describe moves a
`spawnSync` into collection. A failure there surfaces as a collection error, not as a test
failure -- which destroys the framing of the first `it`, whose title is literally
*"the control for every rejection below"*. Use a lazy memo (2 lines, no hook):

```ts
let acceptedResult: ReturnType<typeof read> | undefined;
const acceptedRun = () => (acceptedResult ??= read(ACCEPTED));
```

Fixture filenames shift by one index for every later case; nothing asserts on them (tmpdir only).

### A15 -- collapse five assertions to `it.each` (PREMISE PARTIALLY FAILED)

**They are NOT five identical assertions.** Measured:

| Line | Target list | Entry | Bespoke reason message? |
|------|-------------|-------|-------------------------|
| `:850` | `test` | `{workspaceRoot}/.github/workflows/ci.yml` | no |
| `:948` | `test` | `{workspaceRoot}/.github/workflows/windows-regression-detector.yml` | no |
| `:985` | `test` | `{workspaceRoot}/docs/cross-os.md` | **yes** |
| `:1020` | `test` | `{workspaceRoot}/capture-hashes.mjs` | **yes** |
| `:1027` | **`integration`** | `{workspaceRoot}/read-integration-hash.mjs` | **yes** |

Three axes of difference: which target list, whether a reason string is present, and its text.
All five ARE inside one `describe` (`:777-1033`), so no describe merge is forced:

```
$ git grep -n "^describe(\|^});" -- packages/github-cache/src/nx-target-inputs.spec.ts
...:777:describe('ci.yml is a test input, so no spec can assert on a replayed ci.yml (PARITY-08)', () => {
...:1033:});
```

**There is a RECORDED IN-CODE DECISION arguing against this refactor** (`:1013-1015`):

> *"Two clauses, not one parameterised loop over the pair: they key on DIFFERENT targets (`test` vs
> `integration`) and a combined failure would not say which list lost its entry."*

Under CONTEXT.md's rejection precedence #3 that would normally close the finding -- but it does NOT
apply here, because the objection is to **one `it` looping over a pair**, and `it.each` generates
**one `it` per row with the row interpolated into the title**. The localization the comment
demands is preserved. **The comment MUST be rewritten in the same commit to say so**, or the code
visibly contradicts an argument that is still sitting next to it.

**Required table shape -- three columns, not one:**

```ts
it.each([
  { target: 'test',        entry: '{workspaceRoot}/.github/workflows/ci.yml',                         reason: '...' },
  { target: 'test',        entry: '{workspaceRoot}/.github/workflows/windows-regression-detector.yml', reason: '...' },
  { target: 'test',        entry: '{workspaceRoot}/docs/cross-os.md',                                  reason: '...' },
  { target: 'test',        entry: '{workspaceRoot}/capture-hashes.mjs',                                reason: '...' },
  { target: 'integration', entry: '{workspaceRoot}/read-integration-hash.mjs',                         reason: '...' },
])('nx.json declares $entry as a $target input', ({ target, entry, reason }) => {
  expect(nxJson.targetDefaults[target].inputs, reason).toContain(entry);
});
```

**Do not drop the three bespoke reason strings.** Each names the SPECIFIC spec that would replay a
stale PASS (`docs-cross-os.spec.ts`, `capture-hashes-cli.spec.ts`,
`read-integration-hash.integration.spec.ts`). Collapsing them into one generic message is a guard
weakening -- the CONTEXT `<specifics>` rule forbids it. The two rows that have no reason today
should get one written for them (the message is what a future maintainer reads on a red).

**The real cost of A15 is the comments.** The five `it`s are separated by roughly 180 lines of
dense explanatory blocks, each arguing why THAT entry exists (`:836-849`, `:934-947`,
`:971-984`, `:1006-1019`). Those blocks are not interchangeable and must not be merged into one.
Recommended shape: leave every comment block where it is, immediately above its own table ROW.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | fallow credits spec-only imports as reachable, so A6/A9/A10's exports stay clean | Q10 | `fallow:ci` reddens on the A9/A6/A10 commits. Mitigation: run `npm run fallow:ci` per commit -- cheap, and the config's own comment states the crediting behaviour. |
| A2 | `NativeTaskHasherImpl` holds no cross-task state that would change a hash on reuse | Q8 / A4 | A hoisted hasher yields different values. **This is precisely what CONTEXT G3's mandatory byte-identity measurement catches.** Nx's own `run-command.js:672` reuses one hasher for all tasks, which is strong evidence. |
| A3 | `nx.json` `targetDefaults` is the only place `capture-hashes.mjs` / `eslint.config.mjs` enter a hash | Q8 | An unmeasured rotation. `project.json` was not inspected for a `targets.<t>.inputs` override; `nx-target-inputs.spec.ts` clauses 2 and 3 assert that the merged configuration matches, so an override would already be red. |

## Open questions

1. **A6's path shape for `actions-cache-backend.spec.ts`'s `readFileSync` calls.**
   Routing the WALK through `repoFileUrl` does not remove that file's cwd-relative
   `readFileSync(file, 'utf8')` at `:810` and `:911-915`. Recommendation: leave them
   (smallest diff, still correct under the existing cwd hook) and say so in the commit
   message. Routing them through `readRepoFile` too is a separate, larger decision.

2. **Where the shared `probeTokenOf` (A10) and `packageSourceFiles` (A6) live.**
   `src/test/repo-file.ts` is the obvious home (both consumers already import
   `stripLineComments` from it, and it is vitest-free by hard constraint). CONTEXT G1 already
   names `src/test/repo-file.ts` for A6; A10 has no stated home. Recommendation: same file, so
   the package has one spec-primitive module rather than two.

3. **Whether A15's two reason-less rows get new messages.** Recommended yes (see A15). This is
   guard strengthening, not scope creep, and it is the only way the collapse is not a net loss
   of diagnostic text.

## Sources

All findings in this document were produced by direct measurement in this session
(`git grep`, `rg`, `node -e`, `sed`, `npx vitest run`) against the working tree at
`gsd/v0.0.2-os-invariant-cross-os-sharing`. Every claim carries its command inline.
No web source was consulted; no claim rests on training knowledge.

