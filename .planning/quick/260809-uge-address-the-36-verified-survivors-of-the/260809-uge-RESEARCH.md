# Quick Task 260809-uge - Research

**Researched:** 2026-08-09
**Scope:** ONLY the four items whose prescribed fix depended on an unverified API or behaviour
(A8/A9, C5, E1, D12). Everything else in `260809-uge-FINDINGS.md` is unexamined here and stands
as written.
**Confidence:** HIGH -- every claim below was executed against the installed toolchain
(Nx 23.1.0, TypeScript 6.0.3), not read from docs.

## Verdict

| Item | Prescribed fix | Verdict |
|------|----------------|---------|
| A8/A9 | route through `mergeTargetConfigurations` / `readTargetDefaultsForTarget` | WORKS AS WRITTEN |
| C5 | `readonly put?: never` discriminator | WORKS for the named frame; ONE residual laundering path, see below |
| E1 | shared `READ_MISS_CAUSES` constant | WORKS; exact shape below is byte-identity PROVEN |
| D12 | prose vs. capture | WORKS, but the finding's SCOPE must be pinned or the sweep is 9x too large |

Two things the executor must not miss: the C5 residual hole (C5.4) and the D12 scope (D12.1).

---

## A8/A9 -- the Nx merge layer [VERIFIED: node_modules/nx 23.1.0, executed]

### Signatures (from the installed `.d.ts`, not from memory)

```
readTargetDefaultsForTarget(
  targetName: string,
  targetDefaults: TargetDefaults | undefined,
  executor?: string,
  opts?: { projectName?; projectNode?; sourcePlugin?; command? },
): Partial<TargetConfiguration> | null

mergeTargetConfigurations(
  target: TargetConfiguration,        // HIGHER priority -- the project.json layer
  baseTarget?: TargetConfiguration,   // LOWER priority  -- the targetDefaults layer
  projectConfigSourceMap?, sourceInformation?, targetIdentifier?,
  deferSpreadsWithoutBase = true,
): TargetConfiguration
```

Argument order is project-layer FIRST. The file already gets this right at `:520-528` and
`:735-737`; copy that call shape rather than re-deriving it.

### Behaviours confirmed by execution

- **No defaults entry -> `null`**, not `undefined`. So `?? undefined` is mandatory before passing
  it as `baseTarget` (`null` is not assignable to an optional param under `strict`). The file
  already writes `?? undefined` at both existing sites.
- **`inputs` merge IS key-wise REPLACE.** `getMergeValueResult` -> `mergeArrayValue`: with no
  `'...'` element in the new array, `newValue` replaces `baseValue` entirely. Proven:
  `merge({inputs:['only']}, {inputs:['a','b']}).inputs === ['only']`. The finding's assertion is
  correct.
  - Edge worth knowing, not worth guarding: `'...'` (`NX_SPREAD_TOKEN`) in the project array
    splices the base in -- `merge({inputs:['...','x']}, {inputs:['a','b']})` gives
    `['a','b','x']`. With NO base the literal `'...'` string survives in the array; harmless
    here because `runtimeInputsOf` only matches objects.
- **Targets that inherit everything are ABSENT from `Object.keys(projectJson.targets)`.**
  Measured today: `project.json` declares exactly `['integration']`; `test`, `build`, `typecheck`
  and `lint` exist only via inferred plugins + `targetDefaults`. This is precisely why the union
  of the two key sets is required and why enumerating either alone is the bug.
- `Partial<TargetConfiguration>` is assignable to `TargetConfiguration` (every property is
  optional), and the spec's existing `nxJson` cast type is assignable to `TargetDefaults`. No
  cast churn needed.
- `projectJson.targets[name] ?? {}` already appears at `:742` and `:766` and passes typecheck +
  lint at HEAD. Reuse that spelling; do not introduce a `| undefined` index type.

### Working expression -- effective inputs for any target name

```ts
function effectiveInputsFor(target: string): TargetInputs | undefined {
  return mergeTargetConfigurations(
    projectJson.targets[target] ?? {},
    readTargetDefaultsForTarget(target, nxJson.targetDefaults) ?? undefined,
  ).inputs;
}

const ALL_TARGET_NAMES = [
  ...new Set([
    ...Object.keys(nxJson.targetDefaults),
    ...Object.keys(projectJson.targets),
  ]),
];
```

A8 becomes:

```ts
expect(
  ALL_TARGET_NAMES.filter(
    (name) => runtimeInputsOf(effectiveInputsFor(name)).length > 0,
  ),
).toEqual(['integration']);
```

A9 becomes `hashedFilesFor` calling `effectiveInputsFor(target)` in place of
`nxJson.targetDefaults[target].inputs`.

### Executed proof of both halves

- Today the filter yields exactly `['integration']`, and `effectiveInputsFor` returns the SAME
  arrays as the current `nxJson.targetDefaults[...]` reads for `typecheck` / `build` / `lint`, so
  A9 is behaviour-preserving at HEAD (no guard goes red on the refactor alone).
- Injecting the finding's attack -- `project.json` `targets.test.inputs =
  ['default', {runtime: '...'}]` -- the filter yields `['test','integration']` and the assertion
  FAILS. The hole the finding describes is real and this fix closes it.

Probe script (re-runnable): `<scratchpad>/nx-merge-probe.mjs` -- copy to the repo root to run,
it needs the workspace's `node_modules`.

### Pitfalls

1. `effectiveInputsFor` can return `undefined` for a target with neither layer declaring inputs.
   `runtimeInputsOf` already handles that (`?? []`); `splitInputsIntoSelfAndDependencies` does
   NOT -- keep A9's use restricted to the three names that have defaults, or add a guard.
2. `toEqual` on the A8 array is order-sensitive. Union order is nx.json's key order then
   project-only keys; `['integration']` is correct today.
3. Do NOT pass an `executor` argument. Without it, `readTargetDefaultsForTarget` uses catch-all
   entries only, which is exactly what this repo's plain-object `targetDefaults` are.

---

## C5 -- `readonly put?: never` [VERIFIED: tsc 6.0.3 --noEmit, repo strictness]

Probe: `<scratchpad>/c5/probe.ts` + `tsconfig.json` (mirrors `tsconfig.base.json`: `strict`,
`nodenext`, `noImplicitReturns`, `noImplicitOverride`, `isolatedModules`).

### It works. The optional-never is NOT defeated.

```
probe.ts(29,3): error TS2322: Type 'WritableBackend' is not assignable to type 'ReadOnlyBackend'.
  Types of property 'put' are incompatible.
    Type '(hash: Hash, bytes: Buf) => Promise<PutResult>' is not assignable to type 'undefined'.
```

`put?: never` resolves to `never | undefined` = `undefined`; optionality only excuses an ABSENT
property, so any source type carrying a real `put` method is rejected. Both
`function f(): ReadOnlyBackend { return createActionsCacheBackend(); }` and the plain assignment
are compile errors, exactly as the finding claims.

`readonly` contributes nothing to assignability -- keep it as documentation, it is not the
mechanism.

### Everything else still compiles (all verified, zero errors)

- Honest read-only object literal `{ get }` -> `ReadOnlyBackend`. OK.
- The `createActionsCacheBackend` spread pattern
  (`{ ...createReadOnlyActionsCacheBackend(), put(...) {...} }` returned as `CacheBackend`) --
  the literal's own `put` overrides the spread's `put?: never`. OK, no change needed at
  `actions-cache-backend.ts:283-287`.
- `isWritableBackend(backend: ReadableBackend | WritableBackend)` still accepts a
  `ReadOnlyBackend` and still narrows the widened `ReadOnlyBackend | WritableBackend` union in
  both branches. No signature change needed at `types.ts:46-50`.
- `WritableBackend` -> `ReadOnlyBackend | WritableBackend` assignment. OK.
- `serve.ts:96` (`let tracked: ReadableBackend | WritableBackend`) and `server.ts:59` accept a
  `ReadOnlyBackend` unchanged.

### C5.4 -- THE RESIDUAL HOLE. Read this before writing the fix.

`ReadableBackend` IS still assignable to `ReadOnlyBackend` (the property is merely absent). So a
wrapper annotated with the OLD base type launders a writable backend through one indirection and
compiles clean:

```ts
function wrapper(): ReadableBackend { return createActionsCacheBackend(); }   // no error
const u: ReadOnlyBackend | WritableBackend = wrapper();                       // no error
```

What the fix actually buys, stated honestly so nobody over-claims it in a comment: the three
read-only factories are annotated `ReadOnlyBackend`, so re-opening the hole requires a visible
edit that WIDENS a declared return type back to `ReadableBackend`. That is a reviewable diff
instead of a silent one. It is not a total structural proof. Any comment written at
`types.ts` should say "the frame that wrote it must change its own annotation", not "the wrapper
is unrepresentable".

### Public surface: confirmed safe

`src/index.ts` re-exports six type names; `selectBackend` is not exported from the barrel, and
`public-surface.spec.ts` / `consumer-contract.ts` assert over the BARREL's exports only. An
internal `ReadOnlyBackend` declared in `backend/types.ts` and absent from `src/index.ts` changes
nothing those specs can see. The CONTEXT.md "stays INTERNAL" decision holds.

`backend/types.ts` is serve()-reachable -- ROBUST-04 rebuild applies.

---

## E1 -- byte-identical extraction [VERIFIED: constant-folded, diffed]

### The shared span is EXACTLY 370 chars, measured

```
". Causes worth checking, and this list is not exhaustive: (1) a cache-version rotation in this
commit range -- the archive path literal or the cross-OS flag changed; (2) the sidecar that wrote
these entries and this publish step running at different versions of this action, so two cache
versions exist in one repository; (3) the runtime token's Actions-cache read scope"
```

Divergence points, which is what the wrap boundaries hide:

| | head ends | tail begins |
|---|---|---|
| `:806` (total) | `...unrelated machinery` | `. This is expected ONCE per version-affecting change...` |
| `:937` (partial) | `...not of the restores attempted` | `; (4) the first publish run against a new month shard...` |

So the constant must end at `read scope` with **no trailing punctuation** -- each site supplies
its own `.` or `;`. In the source, site A splits it `Actions-cache ` + `read scope.` and site B
splits it `Actions-cache read ` + `scope;`. That is the pair a contiguous grep cannot find.

### The exact shape, proven byte-identical

```ts
const READ_MISS_CAUSES =
  'Causes worth checking, and this list is not exhaustive: (1) a cache-version ' +
  'rotation in this commit range -- the archive path literal or the cross-OS ' +
  'flag changed; (2) the sidecar that wrote these entries and this publish ' +
  'step running at different versions of this action, so two cache versions ' +
  "exist in one repository; (3) the runtime token's Actions-cache read scope";
```

Site A (`:805-819`) tail three lines become:

```ts
        'which produces a look-alike all-MISS through unrelated machinery. ' +
        `${READ_MISS_CAUSES}. This is expected ONCE per version-affecting ` +
        'change. Two consecutive all-miss pushes with NO version-affecting change ' +
        'in between is the signal to act.',
```

Site B (`:936-949`) becomes:

```ts
        'the entries ENUMERATED on this leg, not of the restores attempted. ' +
        `${READ_MISS_CAUSES}; (4) the first publish run against a new month ` +
        'shard, where entries previously skipped as already mirrored are ' +
        're-attempted, so any of them that can no longer restore become visible ' +
        'at once and stay counted until they evict.',
```

This exact shape was applied to a scratchpad copy and the emitted strings diffed clean.

### The byte-identity oracle -- diff the EMITTED string, not the source

`<scratchpad>/emit-warnings.mjs` parses `publish-mirror.ts` with the repo's own TypeScript, finds
every `core.warning` / `core.info` argument, constant-folds it with fixed placeholder bindings
(and resolves module-level string consts, so an extracted `READ_MISS_CAUSES` folds too), and
prints one JSON-escaped line per message.

```bash
node <scratchpad>/emit-warnings.mjs <abs path to publish-mirror.ts> > before.txt
# ... apply E1 ...
node <scratchpad>/emit-warnings.mjs <abs path to publish-mirror.ts> > after.txt
diff before.txt after.txt   # must be empty
```

Notes: three of the five folded messages reference loop-locals (`tag`, `name`) and print a stable
`<<UNFOLDABLE: ...>>` marker -- constant across before/after, so the diff is still sound. Capture
`before.txt` BEFORE the edit; it cannot be reconstructed afterwards.

### Spec pins: all survive

Checked `publish-mirror.spec.ts:1284, 1288, 1456-1457, 1464, 1591-1592, 1598`. Every pinned
needle (`cache-version rotation in this commit range`, `runtime token's Actions-cache read scope`,
`this list is not exhaustive`, `different versions of this action`, `not of the restores
attempted`) lies wholly inside the shared span or inside an untouched head/tail. Note that
`Actions-cache read scope` spans a concatenation boundary in the CURRENT source and passes today
-- that is the proof the specs pin emitted bytes, not source text.

E2 rides on this: after E1, `warnOnReadMisses` extracts the same span. Run the oracle across the
E1+E2 pair too, not just E1.

---

## D12 -- prose vs. verbatim capture [VERIFIED: measured at HEAD]

### D12.1 -- SCOPE FIRST. The finding's "18 files / 326 characters" is PR-scoped, not tree-scoped.

Measured at HEAD `c7793c4`:

| Scope | Files | Non-ASCII chars |
|-------|-------|-----------------|
| PR diff (`git diff --name-only origin/main...HEAD -- .planning`) | **19** | **391** |
| Whole tracked `.planning/` tree | 90 | 3462 |

The tree-wide figure is dominated by archived v0.0.1 artifacts -- `codebase/ARCHITECTURE.md` (986)
and `codebase/STRUCTURE.md` (236) are box-drawing tree diagrams, 100% inside fences, and
`05-RESEARCH.md` alone carries 628. A blanket sweep would touch a 9x larger surface, most of it
outside this PR and all of it fenced. **Pin D12 to the PR-diff file list.** The 19-vs-18 /
391-vs-326 drift is commit drift on a moving branch, not a contradiction.

### The per-line rule (measured to partition the 391 cleanly)

Walk each file line by line, tracking a fenced-block toggle:

1. Line matches `/^\s*(```|~~~)/` -> toggle fence state, skip the line.
2. Fence state is OPEN -> **LEAVE UNTOUCHED** (verbatim tool output).
3. The non-ASCII character sits inside a backtick span on the line -> **LEAVE UNTOUCHED**
   (quoted literal or truncated captured assertion text).
4. Otherwise -> authored prose. **CONVERT.**

Measured partition of the 391 PR-scoped characters:

| Class | Chars | Codepoints | Action |
|-------|-------|-----------|--------|
| Inside fence | 5 | `U+2713 U+00D7 U+2192 U+2026` | leave -- vitest run output at `09-01-SUMMARY.md:139-142` |
| Inside backticks | 12 | `U+2026` x10, `U+2192`, `U+2713` | leave -- truncated `AssertionError: ...` fragments |
| Authored prose | 374 | `U+2014` x292, `U+2705` x31, `U+2713` x27, `U+2192` x8, `U+26A0+U+FE0F` x4, `U+00B7` x3, `U+1F512` x2, `U+00A7`, `U+2B1C`, `U+274C` | convert |

Zero box-drawing characters in PR scope, so no tree-diagram conversion is needed.

The rule biases exactly the way CONTEXT.md requires: rule 3's naive backtick toggle
over-classifies on a line with an odd backtick count, and over-classifying means LEAVING a line
alone. A false leave is a style miss; a false convert falsifies recorded evidence.

Two calls the rule gets right and a human might not:
- `08-DISCUSSION-LOG.md`'s 27 `U+2713` are markdown TABLE cells in an authored decision log, not
  fenced output. They convert (`[OK]`).
- `11-REVIEW-FIX.md:230`'s `U+2713` is inside backticks quoting a vitest line. It stays.

Conversion map (ASCII per the house rule): `U+2014`/`U+2013` -> `--`, `U+2192` -> `->`,
`U+2026` -> `...`, `U+00A7` -> `section`, `U+00B7` -> `-`, `U+2713`/`U+2705` -> `[OK]`,
`U+00D7`/`U+274C` -> `[FAIL]`, `U+26A0`+`U+FE0F` -> `[WARN]` (drop the variation selector),
`U+1F512` -> `[MANUAL]`, `U+2B1C` -> `[ ]`.

Inventory script (re-runnable, prints the fence/inline/prose class per line):
`<scratchpad>/nonascii.mjs`.

---

## Nothing in the four items contradicts the findings file

No prescribed fix is wrong or unworkable. Two additions the executor must carry forward:

- **C5.4** -- state the residual `ReadableBackend`-annotated laundering path honestly in whatever
  comment lands at `types.ts`. Do not write "unrepresentable".
- **D12.1** -- scope the sweep to the PR-diff file list, not the `.planning` tree.

## Sources

All HIGH confidence -- every claim executed locally at HEAD `c7793c4`:

- `node_modules/nx@23.1.0` `dist/src/project-graph/utils/project-configuration/{target-defaults,target-merging,utils}.{d.ts,js}` -- read, then behaviour executed.
- `node_modules/typescript@6.0.3` `tsc --noEmit` against a strictness-matched scratchpad probe.
- `packages/github-cache/src/publish/publish-mirror.ts` + `.spec.ts` -- constant-folded and diffed.
- `git ls-files` / `git diff --name-only origin/main...HEAD` over `.planning/` -- counted per line.

Scratchpad artifacts (outside the repo):
`C:\Users\LarsGyrupBrinkNielse\AppData\Local\Temp\claude\D--projects-github-op-nx-github-cache\1e947d59-5716-459d-85a5-251919ee5fd2\scratchpad\`
-- `nx-merge-probe.mjs`, `c5/probe.ts`, `c5/tsconfig.json`, `emit-warnings.mjs`,
`simulate-e1.mjs`, `nonascii.mjs`.
