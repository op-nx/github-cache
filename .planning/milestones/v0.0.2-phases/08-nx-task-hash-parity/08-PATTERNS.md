# Phase 8: Nx Task-Hash Parity - Pattern Map

**Mapped:** 2026-07-28
**Files analyzed:** 9 (4 new, 5 modified)
**Analogs found:** 8 / 9 (one file is genuinely new: the CI artifact plumbing)

The single most useful discovery in this pass: **`packages/github-cache/src/roundtrip/` is a
4-for-4 structural analog for `src/hash-parity/`** -- a `src/` subdirectory holding a CI-invoked
bin, excluded from the tarball via a `!dist/<subtree>` entry in `files`, asserted absent by a
matching `pack-check.cjs` FORBIDDEN predicate, and run by `ci.yml` as
`node packages/github-cache/dist/<subtree>/<file>.js` after a `npm run build` step. Copy that
subtree wholesale. Its one gap -- `read-back.ts` has no co-located spec, and D-19 requires one --
is filled by `src/lib/sync-gate.{ts,spec.ts}`.

The second: **`nx.json`'s `targetDefaults.lint.outputs: []` (nx.json:148) is the ONLY existing
`outputs` key in `targetDefaults`, and its rationale lock already lives in a guard spec**
(`nx-target-inputs.spec.ts:229-234`). That is a 1:1 precedent for D-13's displacement -- the
`typecheck.outputs` fix and its pinning spec have an exact shape to copy.

---

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `capture-hashes.mjs` (root, exact name at Claude's discretion) | new | dev-tool script / instrument | batch measure -> file-I/O (JSON out) | `esbuild.action.mjs` (form) + `nx-target-inputs.spec.ts:1-44` (Nx-internals posture) + `pack-check.cjs` (fail-loud CLI) | composite: exact on form, exact on posture, role-match on CLI |
| `packages/github-cache/src/hash-parity/compare.ts` | new | pure comparator / verdict function | transform (records -> verdict) | `packages/github-cache/src/lib/sync-gate.ts` | exact |
| `packages/github-cache/src/hash-parity/compare.spec.ts` | new | unit spec (co-located) | transform, fixture-driven | `packages/github-cache/src/lib/sync-gate.spec.ts` + non-vacuity controls from `nx-target-inputs.spec.ts:123-134, 191-203` | exact |
| `packages/github-cache/src/hash-parity/<loader>.ts` (thin CI entry) | new | CI bin / entrypoint | file-I/O -> transform -> exit | `packages/github-cache/src/roundtrip/read-back.ts` | exact |
| `packages/github-cache/package.json` `files` | mod | package manifest | config | same file, lines 26-33 (`!dist/action`, `!dist/roundtrip`, `!dist/test`) | exact (in-file) |
| `packages/github-cache/pack-check.cjs` FORBIDDEN | mod | guard script | batch validation | same file, lines 104-119 (the three existing `dist/<subtree>/` predicates) | exact (in-file) |
| `.github/workflows/ci.yml` capture matrix job | mod | CI job | request-response (per-leg measure + artifact upload) | `ci.yml:409-457` (`integration` two-leg matrix) for the skeleton; **NO analog** for `upload-artifact` | partial -- see `## No Analog Found` |
| `.github/workflows/ci.yml` compare job | mod | CI job | batch verdict / gate | `ci.yml:749-769` (`publish-verify`: `needs:` + build + `node dist/<subtree>/*.js`) and `ci.yml:66-72` (`lint`: assert on printed CONTENT, not exit code) | role-match |
| `nx.json` `targetDefaults.typecheck.outputs` | mod | build config | config | same file, `targetDefaults.lint.outputs: []` (nx.json:147-148) + its lock at `nx-target-inputs.spec.ts:229-234` | exact (in-file) |
| `packages/github-cache/src/nx-target-inputs.spec.ts` (extend) | mod | cross-cutting drift guard | config assertion | same file, `describe('lint declares its full input set (LINT-04)')` at :206-261 | exact (in-file) |
| `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` | new | evidence doc | doc | `.planning/phases/07-.../07-EVIDENCE.md` | exact |

---

## Pattern Assignments

### `capture-hashes.mjs` (root-level dev-only ESM instrument, D-01)

Three analogs contribute; none covers it alone.

**Analog A -- form and placement: `esbuild.action.mjs`** (the only root-level dev-only `.mjs` in
the repo).

Its whole shape, lines 1-11 and 31-43:

```javascript
// Bundles the consumer JS action entry (start-cache-server/entry.ts) into ONE
// committed, dependency-inlined CJS file (start-cache-server/index.js) that
// external repos resolve via `uses:` from the git ref -- npm ci never runs for a
// `uses:` action, so every runtime dep (@actions/core + the @actions/cache +
// Azure SDK graph pulled in through serve()) must be inlined (Pitfall 1). Kept a
// node script rather than an inline `esbuild ...` npm command because the
// import.meta.url shim below needs a computed banner, which is not expressible in
// a cross-platform npm-script flag without fragile shell quoting. Deterministic output (fixed
// esbuild pin + banner + inputs) so `npm run check:action` can git-diff it.
import { build } from 'esbuild';

await build({ /* ... */ });
```

Load-bearing observations, all of which the planner should decide about explicitly rather than
inherit by reflex:

- **No shebang.** Invoked as `node esbuild.action.mjs`, never `./esbuild.action.mjs`.
- **No arg parsing, no explicit `process.exit`.** It relies on top-level `await` rejecting to
  produce a non-zero exit. The instrument DOES need args (`--graph-state`, `--out`,
  `--install-mode` with no default per RESEARCH Pitfall 6), so this analog runs out here --
  fall through to Analog C.
- **Header comment states WHY the script exists as a script**, names the rejected alternative
  ("kept a node script rather than an inline `esbuild ...` npm command because ..."), and cites
  the requirement/pitfall ID. The instrument's header must carry D-01(a) and D-01(b) in the same
  form -- especially D-01(b), "an Nx-cached instrument would replay a stale record instead of
  measuring", which is the non-obvious half.
- **It is wired as an npm script**, `package.json:15`: `"build:action": "node esbuild.action.mjs"`.
  A `"capture:hashes": "node capture-hashes.mjs"` entry matches house style. Note the root
  `package.json` has `"nx": { "includedScripts": [] }` (package.json:50-52), so adding a script
  does NOT create an Nx target -- D-01(b) is satisfied structurally, not by discipline.

**Two scope facts the planner MUST record rather than discover late:**

1. **A root-level `.mjs` is NOT linted.** `eslint.config.mjs:29-38`:
   ```
   // SCOPE, recorded rather than papered over (D-07). `lint` is project-scoped: `eslint .`
   // with `cwd` at `packages/github-cache`. The workspace root gets NO lint target, so
   // `esbuild.action.mjs`, `start-cache-server/entry.ts`, `vitest.workspace.ts` and the
   // `.planning/spikes/*.mjs` scripts are NOT linted.
   ```
   The instrument inherits that. It is an accepted, already-recorded deviation -- not a gap for
   Phase 8 to close, and NOT a reason to move the instrument into `src/`.
2. **A root-level `.mjs` is NOT typechecked either** (`tsconfig.action.json` covers only the
   esbuild-reachable action graph). This is precisely D-19's stated reason for putting the
   comparator in `src/`. Say it once in the plan so nobody re-litigates it.

**Analog B -- reaching into `nx/src/*`: `packages/github-cache/src/nx-target-inputs.spec.ts`.**

The import block, lines 1-8 (note: type-only import separated, `.js` extension on the internal
subpath, `nx/src/...` not `nx/dist/src/...`):

```typescript
import { readFileSync } from 'node:fs';
import type { NxJsonConfiguration } from 'nx/src/config/nx-json.js';
import {
  extractPatternsFromFileSets,
  filterUsingGlobPatterns,
  splitInputsIntoSelfAndDependencies,
} from 'nx/src/hasher/task-hasher.js';
import { describe, expect, it } from 'vitest';
```

The posture paragraph the instrument's header must restate, lines 35-37:

```
 * `nx/src/*` is an internal subpath with no semver guarantee. An Nx major could
 * move it and break this file at IMPORT time. That is the desired failure mode:
 * loud and immediate, never a silent pass.
```

And the delegate-to-Nx principle at :20-26 ("delegates every glob decision to Nx's own resolver
... so it cannot drift from Nx's behaviour"). Applied to the instrument: compute the hash with
`createTaskHasher(...).hashTask(...)`, never re-derive it.

**Analog C -- fail-loud CLI shape: `packages/github-cache/pack-check.cjs`.**

The problems-list + stderr + exit pattern, lines 126-169 (condensed):

```javascript
function main() {
  const files = packFileList();
  const problems = [];

  for (const required of REQUIRED) {
    if (!files.includes(required)) {
      problems.push(`MISSING: ${required} is not in the tarball`);
    }
  }

  if (problems.length > 0) {
    process.stderr.write(
      `pack-check: the ${PACKAGE_NAME} tarball file list is WRONG:\n` +
        problems.map((m) => '  - ' + m).join('\n') + '\n\n...\n',
    );
    process.exit(1);
  }

  process.stdout.write(`pack-check: ${PACKAGE_NAME} tarball ships ${files.length} files -- ...\n`);
  process.exit(0);
}

main();
```

And its JSON shape-check-before-index, lines 56-64 -- the exact defensive move the security
domain (V5) demands of the comparator:

```javascript
  const parsed = JSON.parse(raw);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!entry || !Array.isArray(entry.files)) {
    throw new Error('pack-check: unexpected `npm pack --json` output shape');
  }

  // Normalize to forward slashes so the path predicates are OS-independent.
  return entry.files.map((file) => file.path.replace(/\\/g, '/'));
```

Note the OS-normalisation line -- a cross-OS guard in a repo whose thesis is cross-OS parity.
The instrument writes paths into `meta` (`workspaceDataDirectory`, `nativeFileCacheDirectory`
per RESEARCH); decide deliberately whether those are normalised or recorded raw. Raw is probably
right here (the record is evidence, and a backslash IS the Windows fact), but it must be a
decision, not an accident.

RESEARCH's Pattern 1 error (`no task ${PROJECT}:${target} in the task graph ...`) is the same
error style as `read-back.ts:50-57`: state what failed, then name the suspects.

---

### `packages/github-cache/src/hash-parity/compare.ts` (pure comparator, D-19)

**Analog:** `packages/github-cache/src/lib/sync-gate.ts`

This is the closest thing in the repo to "a pure typed predicate over untrusted input that
returns a verdict WITH its reason". Four transferable pieces.

**Discriminated verdict union with a named reason type** (lines 51-61) -- the exact shape D-20's
four clauses want:

```typescript
/**
 * Why a sync-trust check refused to publish. Surfaced so a skipped mirror is
 * observable with its cause rather than an opaque `false` (type-design #6).
 */
export type SyncUntrustedReason =
  'not-ci' | 'untrusted-event' | 'not-default-branch';

/** Discriminated sync-trust result: trusted, or not-trusted WITH the reason. */
export type SyncTrust =
  | { readonly trusted: true }
  | { readonly trusted: false; readonly reason: SyncUntrustedReason };
```

For the comparator, the same shape with a reason union covering the four clauses -- e.g.
`'wrong-record-count' | 'missing-target-hash' | 'integration-not-divergent' |
'invariant-target-diverged'` -- plus the offending target/leg names. D-23 (assert on content) and
the "one job further from the cause than necessary" note in RESEARCH's CI-mechanics section both
argue for carrying the diverging target name in the reason, not just the clause.

**Early-return guard chain, one condition per return, each with an inline why** (lines 63-92):

```typescript
export function isSyncTrusted(
  env: NodeJS.ProcessEnv = process.env,
  readDefaultBranch: (e: NodeJS.ProcessEnv) => string | undefined = defaultBranch,
): SyncTrust {
  if (env.GITHUB_ACTIONS !== 'true') {
    return { trusted: false, reason: 'not-ci' }; // not CI -> never sync
  }

  if (!(SYNC_EVENTS as readonly string[]).includes(env.GITHUB_EVENT_NAME ?? '')) {
    // rejects pull_request/release/dispatch/merge_group/delete/etc.
    return { trusted: false, reason: 'untrusted-event' };
  }
  // ...
}
```

Note the blank line before and after every `if` and `return` -- house style, enforced by the
global JS/TS convention.

**Default-deny fail-closed narrowing of untrusted JSON** (lines 24-40) -- directly reusable for
the comparator's V5 shape validation of a downloaded artifact:

```typescript
function defaultBranch(env: NodeJS.ProcessEnv): string | undefined {
  const path = env.GITHUB_EVENT_PATH;

  if (!path) {
    return undefined;
  }

  try {
    const payload = JSON.parse(readFileSync(path, 'utf8')) as {
      repository?: { default_branch?: string };
    };

    return payload.repository?.default_branch;
  } catch {
    return undefined;
  }
}
```

The inline cast to an all-optional shape plus `?.` is this repo's idiom for untrusted JSON --
see also `nx-target-inputs.spec.ts:243-255`, whose comment explains WHY a `?.` is kept even when
the declared type says the field is required:

```
          // `?.` even though the type declares `inputs` required. nx.json is
          // parsed from disk with a CAST, so that type is an ASSERTION about
          // the file, not a check of it. ... -- a crash where a comprehensible
          // assertion failure belongs
```

That paragraph is worth near-verbatim reuse in the comparator: a `TypeError` from a malformed
record is exactly the "crash where a comprehensible assertion failure belongs" the security
domain flags as a DoS/blame-misdirection pattern.

**Header comment density and the `ponytail:` marker** (lines 3-15):

```typescript
/**
 * Trusted triggers for the sync/publish gate (TRUST-02 / D-01). This is a
 * SEPARATE source of truth from the write gate's allowlist in lib/trust.ts: a
 * NEW declaration, never an import of it. The two sets coincide today, which
 * makes reuse tempting and wrong -- ...
 * That divergence is precisely why
 * these must remain two separate declarations. The content-pin in
 * sync-gate.spec.ts fails the build if this widens.
 * ponytail: array .includes is fine at n=2.
 */
export const SYNC_EVENTS = ['push', 'schedule'] as const;
```

The four elements every module header here carries: requirement ID, the invariant, why the
tempting alternative is wrong, and which spec pins it. The comparator's header must name D-19,
D-20, D-21, D-22, and point at `compare.spec.ts` as the lock.

Also note the `as const` + exported constant with a deep-equality content pin in the spec. The
comparator's expected-target list (`['build', 'typecheck', 'test', 'integration', 'lint']`) is
exactly that shape, and RESEARCH Pitfall 4 requires it be an explicit expected list rather than
`Object.keys(record.targets)`.

---

### `packages/github-cache/src/hash-parity/<loader>.ts` (thin CI entry, D-19)

**Analog:** `packages/github-cache/src/roundtrip/read-back.ts` -- the repo's only other
"CI runs `node dist/<subtree>/<file>.js` and it must fail loud" bin.

**Direct-invocation guard** (lines 76-84) -- copy this verbatim in shape:

```typescript
// Direct-invocation guard: run() only when this module is the entrypoint (the built
// dist/roundtrip/read-back.js invoked by ci.yml's publish-verify job), never when
// imported. isEntrypoint owns the Windows Pitfall-6 idiom. A whole-run fault reaches
// core.setFailed (non-zero exit) so the round-trip fails loud (OBS-01/D-15).
if (isEntrypoint(import.meta.url)) {
  run().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
```

`isEntrypoint` is at `src/lib/is-entrypoint.ts:14-16` and exists precisely because the naive
`'file://' + process.argv[1]` form is permanently false on Windows (its header calls this
"Pitfall 6"). Both hash-parity legs matter here -- do not hand-roll the comparison.

**Fail-loud error text that names the suspects** (lines 50-57):

```typescript
  if (result.kind !== 'hit') {
    throw new Error(
      `github-cache round-trip read-back: cache MISS for ${hash} on ${process.platform}. ` +
        'The real Releases reader did not resolve the asset the per-OS publish matrix ' +
        'mirrored this run -- suspect the month-shard tag, the OS asset-name discriminator, ' +
        'or a publish leg that never uploaded.',
    );
  }
```

Direct model for D-20(a): "fewer than two records" should name the suspects (a leg that failed
before upload, `if-no-files-found` defaulting to `warn`, a `merge-multiple` collision), not just
report the count.

**Imports use explicit `.js` extensions on relative paths under `nodenext`** (lines 2-8):
`'../backend/releases-backend.js'`, `'../lib/cache-key.js'`, `'../lib/is-entrypoint.js'`.

**One deliberate divergence to decide:** `read-back.ts` uses `@actions/core` (`core.setFailed`,
`core.info`). `@actions/core` is a runtime **dependency** of the published package
(`packages/github-cache/package.json:42`), so importing it from `src/hash-parity/` is safe for
consumers -- but the compare job is a plain `run:` step, not a JS action, so `core.setFailed`'s
only effect there is a non-zero exit plus an `::error::` annotation. Plain `console.error` +
`process.exitCode = 1` is the lazier equivalent. Either is defensible; pick once and say why.

---

### `packages/github-cache/src/hash-parity/compare.spec.ts` (co-located spec, D-19/D-22)

**Analog A -- structure: `packages/github-cache/src/lib/sync-gate.spec.ts`**

**A fixture builder with per-test single-field overrides** (lines 35-45) -- exactly what D-22's
"fixture-driven negative cases per clause" needs, and the mechanism that keeps each negative
isolated to one clause:

```typescript
// A fully-trusted sync env bag: push, on the default branch, inside Actions.
// Override one field per test to isolate the single condition under test.
function syncEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_REF_NAME: 'main',
    ...overrides,
  };
}
```

For the comparator: `validRecordPair(overrides)` returning the two-leg pair that PASSES all four
clauses; each negative test mutates exactly one field. That gives the positive control
(RESEARCH's test map row "A genuinely-correct record pair PASSES") for free.

**A negative that isolates a specific guard, with the isolation stated in the comment**
(lines 100-110):

```typescript
  it('refuses a tag ref whose name matches the default branch (isolates the refs/heads/ guard) (TRUST-02)', () => {
    // Non-vacuous refs/heads/ guard: the ref name equals the default branch, so
    // the branch-equality check would pass -- only the refs/heads/ prefix guard
    // can reject this (a tag push also sets GITHUB_REF_NAME).
    const result = syncTrusted(
      syncEnv({ GITHUB_REF: 'refs/tags/main', GITHUB_REF_NAME: 'main' }),
      readMain,
    );

    expect(result).toBe(false);
  });
```

**A named anti-fail-closed proof** (lines 162-174) -- the test whose job is to prove the guard
does NOT fire in a case where a plausible over-strict implementation would:

```typescript
  it('CANNOT fail-closed: trusts schedule with NO GITHUB_EVENT_PATH / no repository.default_branch (RETAIN-03 anti-fail-closed proof)', () => {
```

D-21's `lint` fallback needs the mirror of this: if `lint` diverges and the clause is downgraded,
the downgrade must be a test that says so by name -- "recorded-with-a-named-finding" -- never a
deleted `it`.

**Explicit content pin, never a snapshot** (lines 208-217):

```typescript
describe('SYNC_EVENTS', () => {
  // Content pin (TRUST-02 / D-01 / T-04-02): the sync allowlist is default-deny
  // with exactly push + schedule. This deep-equality assertion turns any early
  // widening into a build failure ...
  it('deep-equals the two-element push/schedule allowlist (TRUST-02)', () => {
    expect([...SYNC_EVENTS]).toEqual(['push', 'schedule']);
  });
});
```

The house rule (`public-surface.spec.ts:18-23`) states it outright: explicit-assertion-list, NOT
`toMatchSnapshot()`, because a `.snap` regen is easy to rubber-stamp.

**Analog B -- the vacuity control: `nx-target-inputs.spec.ts:123-134` and `:191-203`.**

These are the repo's two concrete instances of "prove the guard CAN fail", and both are
NEGATIVE assertions chosen because the positive ones would all pass together on a broken
implementation. First instance:

```typescript
  // NON-VACUITY control, and it must be a NEGATIVE one. filterUsingGlobPatterns
  // starts with `if (positive.length === 0 && negative.length === 0) return files`
  // -- an empty pattern list returns the WHOLE probe list untouched. So every
  // toContain() above would pass together on a resolver that resolved nothing,
  // which is the same class of silent false pass this guard exists to prevent.
  // `build` is the discriminator: its inputs genuinely exclude specs, so this
  // assertion is true today and false the instant the filter stops filtering.
  it('does NOT hash the spec sources for build, proving the filter filters', () => {
    expect(hashedFilesFor('build')).not.toContain(`${PROJECT_ROOT}/src/index.spec.ts`);
  });
```

Second instance (:191-203) adds the meta-lesson: **the discriminator had to be CHOSEN, not
copied** -- `build` was unusable for `lint` because hashing a spec is what `lint` is supposed to
do, so an honest out-of-project probe path was substituted. Copying a discriminator that does not
discriminate for the new target is exactly the vacuity Phase 7 recorded.

The comparator's named vacuity control is already specified by RESEARCH Pitfall 5 and is the
direct structural twin of the excerpt above: **a record pair with an EMPTY `targets` object must
FAIL clause (a)**, because a comparator iterating `Object.keys(record.targets)` passes clauses
(b), (c) and (d) trivially on an empty map -- every positive assertion passing together on a
comparator that compared nothing.

**Spec placement** (`TESTING.md:39-54`): co-located, always -- `compare.ts` + `compare.spec.ts`
in `src/hash-parity/`. Cross-cutting drift guards go at the package-source root instead; the
comparator is a cohesive module, so the subdirectory is correct and closes CONTEXT.md's
discretion item.

**Fixtures:** RESEARCH's Wave 0 list allows inline TypeScript objects or `.json` under
`{projectRoot}` (covered by the `default` named input, so safe from the stale-cached-PASS class).
Precedent for a committed JSON fixture inside `src/`:
`src/conformance/nx-cache-openapi.v23.1.0.json`. Precedent for inline objects: `sync-gate.spec.ts`
above. Inline is lazier and equally safe; prefer it unless a fixture needs to be a real captured
record.

---

### `packages/github-cache/package.json` `files` (one `!dist/hash-parity` entry, D-19)

**Analog:** the same file, lines 26-33 -- three existing exclusions of exactly this kind:

```json
  "files": [
    "dist",
    "!dist/action",
    "!dist/roundtrip",
    "!dist/test",
    "!dist/**/*.tsbuildinfo",
    "!dist/**/*.d.ts.map"
  ],
```

Confirmed necessary, not merely tidy: `tsconfig.lib.json` is `"include": ["src/**/*.ts"]` with
`"rootDir": "src"` and excludes only `*.spec.ts`/`*.test.ts`/vite configs -- so
`src/hash-parity/compare.ts` WILL be emitted to `dist/hash-parity/compare.js` and WILL be packed
without the exclusion.

---

### `packages/github-cache/pack-check.cjs` (the matching FORBIDDEN entry, RESEARCH Pitfall 8)

**Analog:** the same file, lines 104-119 -- the three existing `dist/<subtree>/` predicates, with
the comment that explains why each one exists:

```javascript
  // dogfood-stays-local INSIDE dist/: these subtrees are built (tsc emits them so
  // the repo's own action.yml/ci.yml/specs resolve them) but must NOT ship to
  // consumers -- excluded via the `files` negated globs, asserted here so a
  // reintroduction fails the guard.
  {
    label: 'the internal dogfood action build output',
    test: (p) => p.startsWith('dist/action/'),
  },
  {
    label: 'the CI round-trip build output',
    test: (p) => p.startsWith('dist/roundtrip/'),
  },
  {
    label: 'test-support build output',
    test: (p) => p.startsWith('dist/test/'),
  },
```

The new entry is one object in the same style:
`{ label: 'the hash-parity comparator build output', test: (p) => p.startsWith('dist/hash-parity/') }`.

Two follow-on edits in the same file that the three-entry precedent implies and that a reviewer
will look for:

- The module header, lines 13-19, enumerates the subtrees by name ("dist/action ... dist/roundtrip
  ... dist/test"). It goes stale the moment a fourth is added without touching it. This repo
  treats a stale rationale comment as a defect.
- The success message, lines 163-167, also names all three
  (`'no internals leaked (dist/action, dist/roundtrip, dist/test excluded).'`). Same argument.

Whether to keep enumerating or to derive both strings from the FORBIDDEN list is a genuine
single-source-of-truth call. Deriving is the house pattern (CONVENTIONS.md's single-source +
drift-guard), and it is a two-line change here. Flag it; do not silently pick.

---

### `.github/workflows/ci.yml` -- the two-leg capture job

**Analog:** `ci.yml:409-457`, the `integration` job. Copy the skeleton exactly:

```yaml
  integration:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-24.04-arm, windows-11-arm]
    runs-on: ${{ matrix.os }}
    # Generic hang insurance -- see the build job.
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
```

Four things this analog settles, with citations for the plan:

1. **`fail-fast: false` is load-bearing here, for a NEW reason.** Its existing rationale
   (`ci.yml:392-393`, "so a Windows-only failure never hides the Ubuntu result") is joined by
   RESEARCH's: with fail-fast on, a Windows leg failure cancels the Ubuntu leg and the compare
   job reports "fewer than two records" for a reason unrelated to hash parity.
2. **`shell: bash` on every scripted step.** The rationale is recorded at `ci.yml:399-404`:
   *"GitHub's DEFAULT shell on windows-11-arm is pwsh, which fails on `$GITHUB_ENV`, `$(...)`,
   `seq` and `[ ... ]`."* Also at `:194-196`. The capture step is a scripted step (it sets the
   `NX_*` cold-recipe env vars around the `node` invocation). It needs `shell: bash`. A bare
   `- run: node capture-hashes.mjs ...` with no shell key inherits pwsh on the Windows leg.
3. **Omit the sidecar block.** All four wired jobs carry a ~35-line
   pre-set / `uses: ./start-cache-server` / poll / `cancel:` block. The capture job runs no
   cached Nx task, so it needs none -- and RESEARCH is explicit that leaving it out removes a
   whole class of flake from a gate that must be trusted. Say so in a comment, because the
   omission looks like an oversight next to four jobs that have it.
4. **No job-level `permissions` block.** `ci.yml:658-661` records the trap in full:
   *"A job-level permissions block REPLACES the workflow grant (contents: read) WHOLESALE -- it
   does NOT merge."* The workflow-level `permissions: contents: read` (`ci.yml:9-10`) is
   sufficient for checkout plus an artifact upload.

**Also copy the comment-block convention.** Every non-trivial job in this file carries a
multi-paragraph `#` header above it stating what it proves, why its shape is what it is, and
which measured run or requirement backs each claim (see `:384-408` above `integration`, or
`:459-475` above `dogfood-seed`). The new jobs are the most decision-dense in the file; they need
one. Note this is the ONLY place D-13's rationale can live for the CI half -- `ci.yml` is not a
`test` input, so no spec can hold it.

---

### `.github/workflows/ci.yml` -- the compare job

**Analog A -- `needs` + build + run-a-dist-bin: `ci.yml:749-769` (`publish-verify`):**

```yaml
  publish-verify:
    if: github.event_name == 'push'
    needs: publish
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-24.04-arm, windows-11-arm]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: node packages/github-cache/dist/roundtrip/read-back.js
```

The `- run: npm run build` before the `node dist/...` step is mandatory and easy to forget --
the comparator is TypeScript, so the compare job must build before it can run
`dist/hash-parity/<loader>.js`. `pack-check` (`ci.yml:121-131`) carries the same
build-then-guard ordering with the reason spelled out at `:119-120`.

**Analog B -- assert on printed CONTENT, not exit code (D-23): `ci.yml:66-72` (the `lint` job):**

```yaml
      - name: Lint, and prove the lint target actually ran
        env:
          NO_COLOR: '1'
        run: |
          set -euo pipefail
          npm run lint 2>&1 | tee lint.log
          grep -q 'Successfully ran target lint' lint.log
```

Its comment (`:46-65`) is the in-repo statement of D-23 and is worth citing in the plan: exit 0
is not sufficient; a gate that reads only the exit code converts a live accepted risk into a
GREEN leg. Two reusable sub-lessons:

- `set -euo pipefail` on every scripted step in this file.
- `NO_COLOR: '1'` is load-bearing whenever a plain-text match is applied to Nx output -- with
  colour on, Nx bolds the target name mid-phrase and the match never fires. If the compare job
  prints an Nx-derived string that anything greps, it needs the same env.

For the compare job the D-23 equivalent is stronger: the comparator itself must fail on record
CONTENT, and the job must not derive its verdict from `needs.*.result`.

**Analog C -- `if:` on a dependent job.** Two forms already in the file:
`ci.yml:641` uses `if: ${{ !cancelled() && github.event_name == 'push' }}`; `:502` and `:750` use
a plain `if: github.event_name == 'push'`. D-17 asks for `always()`, and RESEARCH notes
`!cancelled()` is the narrower expression that still covers failed/skipped legs. **The repo
already prefers `!cancelled()`** -- `publish` uses exactly that -- so choosing it is consistent
with house style as well as narrower. Make the choice explicitly, per RESEARCH's "the plan should
pick deliberately rather than by reflex".

**Do NOT gate the new jobs on `github.event_name == 'push'`.** Every job in this file that
carries that gate does so because it WRITES (seeds a cache entry, publishes a release asset).
The hash-parity job only measures. The `build`/`typecheck`/`test`/`integration` comment at
`:170-172` states the corresponding rule for read-side jobs: *"NOT push-gated, unlike the proof
jobs."*

---

### `nx.json` -- `targetDefaults.typecheck.outputs` (the fix, D-12/D-13)

**Analog:** the same file, `targetDefaults.lint` at nx.json:147-148 -- the ONLY `outputs` key
anywhere in `targetDefaults`, and therefore the only precedent for the shape of this edit:

```json
    "lint": {
      "outputs": [],
      "inputs": [
```

`outputs` sits FIRST in the entry, before `inputs`.

**The rationale-lock half of D-13 also already exists**, at `nx-target-inputs.spec.ts:229-234`:

```typescript
  // `eslint .` with no --output-file writes nothing, so an empty array is the
  // honest declaration -- and it drops the {options.outputFile} token from
  // hash_project_config entirely.
  it('declares no outputs', () => {
    expect(nxJson.targetDefaults.lint.outputs).toEqual([]);
  });
```

This is the complete pattern D-13 asks for, already working in this repo: `nx.json` carries the
value, the guard spec carries the comment that says WHY that value and not another. The
`typecheck.outputs` pin is the same two lines with a seven-entry array -- and RESEARCH Finding 2
plus assumption A6 give the comment its content (the list must be the CORRECT one, not merely a
stable one, or `typecheck` stops caching its `dist/` declaration output).

The spec's parse type already admits the field -- `nx-target-inputs.spec.ts:60`:
`targetDefaults: Record<string, { inputs: TargetInputs; outputs?: string[] }>` -- so no type edit
is needed.

---

### `packages/github-cache/src/nx-target-inputs.spec.ts` (extend, do not re-author)

**Analog:** the same file's `describe('lint declares its full input set (LINT-04)', ...)` block at
:206-261. RESEARCH's "Don't Hand-Roll" table is explicit that CORR-04's guard
(`:241-260`) must be EXTENDED here rather than re-authored elsewhere -- "re-authoring it creates a
second copy to drift".

Add the `typecheck.outputs` pin as an `it` in a new describe (or in the existing LINT-04-style
block renamed for the target). Do NOT put it in `src/hash-parity/compare.spec.ts`: this file is
the package's cross-cutting nx.json drift guard, and `TESTING.md:51-54` places cross-cutting
guards at the package-source root.

**The stale-cached-PASS wiring is already in place** for this file: `nx.json` is a `test` input,
asserted at :269-273:

```typescript
  it('nx.json is a test input, so editing it re-runs this file', () => {
    expect(nxJson.targetDefaults.test.inputs).toContain('{workspaceRoot}/nx.json');
  });
```

So a `typecheck.outputs` pin added to THIS file cannot serve a stale cached PASS. A pin added to
a brand-new spec file would be covered by `default` (`{projectRoot}/**/*`) but would still need
the nx.json input -- another reason to extend rather than create.

---

### `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` (D-06)

**Analog:** `.planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-EVIDENCE.md`

Its header, lines 1-13, carries every stamping element D-06 and PARITY-06 require:

```markdown
# Phase 7 - Recorded Evidence

Measurements taken during phase 7 execution. Appended to by plans 07-01, 07-02, 07-03 and
07-04. Every number here is MEASURED on this repo, never predicted; where a prediction from
`07-RESEARCH.md` exists it is quoted alongside so the divergence (or its absence) is visible.

---

## Plan 07-01

Recorded: 2026-07-27. Host: Windows 11 arm64, node v24.13.0, npm 11.6.2.
Base commit: `7b451ca`.
```

Transferable structure:

- A "MEASURED, never predicted" declaration in the preamble, with the research prediction quoted
  alongside when one exists -- exactly what CONTEXT.md's `<specifics>` demands ("re-takes it at
  its own commit rather than citing it as current") and what makes RESEARCH's Findings 1-4 usable
  as a map without becoming the record.
- A per-section stamp: date, host (OS + arch + node + npm), base commit SHA. D-07 needs this per
  OBSERVATION POINT rather than per plan, and D-07's four points map cleanly onto four
  `## Observation point N` sections each carrying its full `meta` block.
- Result tables with an explicit pass/result column (`07-EVIDENCE.md:20-26`).
- Fenced command blocks reproducing the exact invocation, including the host-specific workaround
  and why it is needed (`:48-54`).

---

## Shared Patterns

### Module header carries the decision, not just the description

**Source:** `sync-gate.ts:3-14`, `pack-check.cjs:3-30`, `esbuild.action.mjs:1-9`,
`nx-target-inputs.spec.ts:10-44`, `read-back.ts:10-32`, `public-surface.spec.ts:1-29`
**Apply to:** every new file in this phase

Four elements, present in all six: (1) the requirement/decision ID, (2) the invariant in one
sentence, (3) the tempting alternative and why it is wrong, (4) which file pins it. CONTEXT.md
records that "a stale rationale comment is treated as a defect", so a header that enumerates
siblings (as `pack-check.cjs:13-19` does) must be updated when a sibling is added.

### `ponytail:` marks a deliberate simplification

**Source:** `pack-check.cjs:27-29`, `sync-gate.ts:13`, `public-surface.spec.ts:106-107`
**Apply to:** any place the plan takes the lazy option on purpose

```javascript
 * ponytail: a fixed predicate list over the pack JSON -- no globbing library,
 * no .npmignore parsing; the allow-list (files:["dist"]) does the real work and
 * this just proves the outcome.
```

The comparator's three-bucket node diff, the hand-written shape narrowing (instead of a schema
dependency), and the fixed target list are all candidates.

### Explicit assertion lists, never `toMatchSnapshot()`

**Source:** `public-surface.spec.ts:18-23`
**Apply to:** every assertion in `compare.spec.ts` and the `nx-target-inputs.spec.ts` extension

```
 * Style: explicit-assertion-list, NOT toMatchSnapshot() (the pinned-deps.spec.ts /
 * ppe-action.spec.ts precedent, D-05). An intentional surface change is made by
 * editing the EXPECTED_* lists below, so the contract change lands as an obvious,
 * reviewable diff in THIS file -- preferred over a `.snap` whose `-u` regen is easy
 * to rubber-stamp.
```

### Every guard ships a non-vacuity control, and the control is CHOSEN per target

**Source:** `nx-target-inputs.spec.ts:123-134` and `:191-203`
**Apply to:** `compare.spec.ts` (all four D-20 clauses)

Both instances are NEGATIVE assertions. The second records that the discriminator had to be
chosen rather than copied from the first. Copying a control that does not discriminate for the
new clause is the exact vacuity Phase 7 recorded.

### Strict ESM under `nodenext`: explicit `.js`, `import type` split out

**Source:** `nx-target-inputs.spec.ts:1-8`, `read-back.ts:1-8`, `sync-gate.spec.ts:1-2`
**Apply to:** every new `.ts` file

```typescript
import type { NxJsonConfiguration } from 'nx/src/config/nx-json.js';
import { ... } from 'nx/src/hasher/task-hasher.js';
```

Relative imports carry `.js` even from a `.ts` source (`'./sync-gate.js'`,
`'../lib/is-entrypoint.js'`).

### Blank lines around control flow and returns

**Source:** `sync-gate.ts:63-92`, `pack-check.cjs:126-169`, `read-back.ts:33-74`,
`public-surface.spec.ts:106-135`
**Apply to:** all new JS/TS

Uniform across the codebase; also a global user convention. Every `if`/`return` gets a blank line
before and after unless it is first/last in its block, and every control-flow body uses braces.

### PARITY-07 / D-16: the public-surface guard passes unchanged -- verified, not assumed

**Source:** `public-surface.spec.ts:137-188`
**Apply to:** the whole phase

Checked against the planned changes. It asserts exactly four things:
`Object.keys(barrel).sort()` deep-equals `['createCacheServer']` (:138-142); the
`export type { ... }` names parsed out of `src/index.ts` (:144-148); the `inputs:` keys of
`start-cache-server/action.yml` (:150-156); and a fixed env-knob list (:158-169) cross-checked
against a FIXED `KNOB_SOURCE_FILES` array (:65-72).

**None of them enumerates `dist/` or `src/`.** So `src/hash-parity/` passes unchanged provided
it is never re-exported from `src/index.ts` and adds no env knob. No edit to
`public-surface.spec.ts` or `src/test/consumer-contract.ts` is needed or wanted. `pack-check.cjs`
is the guard that DOES need the new entry.

### `ci.yml` is NOT a `test` input -- no Phase 8 spec may read it

**Source:** `nx.json:68` (only `{workspaceRoot}/.github/workflows/cleanup.yml` is listed);
`ci.yml:298-301` states the hazard inline
**Apply to:** the whole phase

```
      # cleanup-workflow.spec.ts is the precedent for asserting on a workflow from a
      # spec if that ever becomes worth enforcing -- note ci.yml is NOT in nx.json's
      # test inputs (only cleanup.yml is), so such a guard would need ci.yml added
      # there or it goes stale behind a cache hit.
```

Registering `ci.yml` is PARITY-08, deferred to Phase 9. A Phase 8 spec asserting on `ci.yml`
content would serve a stale cached PASS. `cleanup-workflow.spec.ts` exists and is safe only
because `cleanup.yml` IS an input -- do not read it as a green light.

---

## No Analog Found

| File / capability | Role | Data Flow | Reason |
|-------------------|------|-----------|--------|
| `actions/upload-artifact` step in the capture job | CI | file-I/O across jobs | **Genuinely new.** Verified independently this pass: `git grep -ln "upload-artifact\|download-artifact"` across the whole tracked repo returns ONLY `08-RESEARCH.md` itself. The complete third-party action inventory across both workflows (`ci.yml`, `cleanup.yml`), `ppe/`, `start-cache-server/` and `packages/github-cache/action.yml` is `actions/checkout@v7`, `actions/setup-node@v6`, plus a doc-only `actions/checkout@v4` in an adoption example. There is no in-repo major to match and no precedent to copy. Use RESEARCH's `## CI mechanics` section (v7 upload / v8 download, `if-no-files-found: error`, unique per-leg names, `pattern` + `merge-multiple`) and say in the plan that no precedent exists so a reviewer does not go looking. |
| `actions/download-artifact` step in the compare job | CI | file-I/O across jobs | Same. |
| A cross-job matrix-fan-in job | CI | batch verdict | Partial only. Every `needs:` in `ci.yml` today fans in from a single job (`dogfood-verify` needs `dogfood-seed`; `consumer-smoke` needs `action-bundle-drift`) or is itself a matrix consuming a matrix leg-by-leg (`publish-verify` needs `publish`, and both are two-leg matrices that pair up by OS). **No existing job collapses a matrix's legs into ONE downstream job that sees both.** `publish-verify` is the nearest and is structurally different -- it is deliberately per-OS so each leg reads back only its own asset (`ci.yml:735-748`). The comparator job is the opposite shape by construction (D-17: "a single job cannot see both legs"). |

---

## Metadata

**Analog search scope:** repo root (`*.mjs`, `*.json`), `.github/workflows/`,
`packages/github-cache/` (`src/**`, `pack-check.cjs`, `package.json`, `tsconfig.*.json`),
`.planning/phases/07-*/`, `.planning/codebase/TESTING.md`
**Files read in full:** 13 -- `esbuild.action.mjs`, `pack-check.cjs`, `nx-target-inputs.spec.ts`,
`packages/github-cache/package.json`, `package.json`, `nx.json`, `.github/workflows/ci.yml`,
`src/lib/sync-gate.ts`, `src/lib/sync-gate.spec.ts`, `src/public-surface.spec.ts`,
`src/roundtrip/read-back.ts`, `src/lib/is-entrypoint.ts`, plus targeted ranges of
`eslint.config.mjs`, `07-EVIDENCE.md` and `TESTING.md`
**Verified this pass (not inherited from RESEARCH):**
zero `upload-artifact`/`download-artifact` references in tracked files;
`tsconfig.lib.json` emits `src/hash-parity/**` to `dist/hash-parity/**` (so both the `files`
exclusion and the pack-check entry are required, not optional);
`public-surface.spec.ts` cannot be tripped by a non-exported `src/` subtree;
`targetDefaults.lint.outputs` is the only existing `outputs` key in `nx.json`
**Pattern extraction date:** 2026-07-28
