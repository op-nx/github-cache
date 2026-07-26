---
must_haves:
  truths:
    - "`typecheck.inputs` must start from `default`, NOT `production` + re-added spec globs.
      Research PROVED the re-add is a no-op by executed probe: Nx partitions a fileset's patterns
      into included/excluded buckets by a leading `!`, DISCARDS position, and sorts the array
      (`hash_project_files.rs` `project_file_set_cache_key()` calls `sorted_file_sets.sort()`), so a
      later positive pattern can never undo an earlier negation."
    - "`{workspaceRoot}/nx.json` MUST join `test.inputs` in the SAME commit as the guard. VERIFIED
      from `hash_project_config.rs`: a target's `inputs` array and nx.json's root `namedInputs` are
      NOT part of the ProjectConfiguration hash node. Without the wiring, reopening the hole leaves
      the `test` hash unmoved and Nx replays the guard's cached PASS -- the same bug class, one
      level up. A guard without that wiring is worthless."
    - "The guard pins the INVARIANT, not the spelling. It must resolve the globs through Nx's own
      exported resolver, never assert `inputs[0] === 'default'`."
    - "`tsconfig.spec.json` needs NO separate input entry -- `default` covers it. It was silently
      broken by the same `production` exclusion (`nx.json:8`) and is fixed by the same one-token
      change."
    - "U1 is RESOLVED and CORROBORATED. The composite-action `background:` claim at
      `docs/advanced.md:127-132` and `start-cache-server/action.yml:29` stays EXACTLY as written --
      no soften, no probe, no drop."
    - "A5's premise was INVERTED by research. The `06-RESEARCH.md:508` annotation says
      \"corroborated 2026-07-26\" WITH the URL. It must never say \"not reproducible\". The
      10-concurrent-background-step limit still does NOT enter any consumer doc."
    - "`timeout-minutes` is generic hang insurance, NOT the containment control for a failing step.
      A bare `cancel:` provably runs after a failing step (run 30172032003, red in 8s). No
      continue-on-error / fail-gate dance reaches adopters -- rk4 measured it as unnecessary AND
      fail-open on drift. Keep this DISTINCT in the prose from the hang caused by OMITTING
      `cancel:`."
    - "The readiness poll demands exactly 404-or-200, and the reasoning ships with the shape.
      Accepting \"any status but 000\" would pass a 401 -- a token-handshake mismatch -- after which
      every Nx request 401s, best-effort read degradation kicks in, and the job goes GREEN having
      cached nothing. `curl --max-time 10` bounds EACH attempt, so the worst case is ~5.5 min, NOT
      30s. Never restate a \"30s bound\"."
    - "The full 8-command battery passes at EVERY commit, not just the last: `format:check`,
      `build`, `typecheck`, `typecheck:action`, `test`, `fallow:ci`, `check:action`, `pack:check`."
    - "`workflow.tdd_mode` is true: Task 1 observes a real RED before GREEN, inside its one atomic
      commit."
    - "Keep the existing `::add-mask::` lines in README.md, docs/advanced.md and
      docs/examples/minimal-ci.yml (`docs-adoption.spec.ts:87-113`). Keep `operation:` and
      `matrix:` OUT of minimal-ci.yml (`:156-166`) -- rephrase ported ci.yml comment text, never
      copy it. Add NO input to `start-cache-server/action.yml` (`public-surface.spec.ts:150-155`
      asserts the key set is exactly `['port']`)."
    - "ASCII only in every written file: `--` not an em dash, `->` not an arrow glyph, `[OK]` /
      `[WARN]` not emoji, `...` not an ellipsis character, straight quotes only."
  artifacts:
    - "nx.json -- `targetDefaults.typecheck.inputs[0]`: `production` -> `default`; `test.inputs`
      gains `{workspaceRoot}/nx.json`."
    - "packages/github-cache/src/nx-target-inputs.spec.ts -- NEW. Resolves `typecheck.inputs`
      through Nx's exported `splitInputsIntoSelfAndDependencies` +
      `extractPatternsFromFileSets` + `filterUsingGlobPatterns` and asserts a spec path and
      `tsconfig.spec.json` survive; plus the `test.inputs` self-wiring assertion."
    - "README.md, docs/advanced.md, docs/examples/minimal-ci.yml,
      start-cache-server/action.yml, .github/workflows/ci.yml -- `openssl rand -hex 32` -> the
      proven node one-liner at all 5 sites."
    - "README.md + docs/examples/minimal-ci.yml -- the readiness poll block and `timeout-minutes`,
      with the reasoning; docs/advanced.md + start-cache-server/action.yml POINT at it rather than
      duplicating it."
    - ".github/workflows/ci.yml -- the stale doc-lag comment at :128-132 corrected."
    - ".planning/milestones/v0.0.1-phases/06-distribution-docs-governance/06-RESEARCH.md -- line
      508 annotated as corroborated, with the URL."
    - "Four atomic bisect-safe commits, each independently green on the full 8-command battery."
  key_links:
    - ".planning/quick/260726-gok-resolve-typecheck-stale-cache-false-pass/260726-gok-RESEARCH.md
      -- AUTHORITATIVE. Q2's negation proof, Q3's precondition, Q4's copy-site table and guard
      hazards."
    - ".planning/quick/260726-gok-resolve-typecheck-stale-cache-false-pass/260726-gok-CONTEXT.md
      -- LOCKED decisions A1-A8. U1 is RESOLVED (corroborated). A5's premise is inverted by
      research; its ACTION stands."
    - ".planning/STATE.md -- the two Deferred Items rows this task closes (`CI hygiene`, line 197;
      the consumer-doc row alongside it)."
    - ".github/workflows/ci.yml:179-227 -- the proven node one-liner and the hardened readiness
      poll, both measured on ubuntu-24.04-arm and windows-11-arm."
---

# Quick Task 260726-gok: Resolve the typecheck stale-cache false-pass and the consumer-doc defects - Plan

**Planned:** 2026-07-26
**Branch:** `gsd/quick-260726-gok-typecheck-inputs-consumer-docs` (forked off `origin/main` at `e56e5d2`)
**Mode:** `quick-full`
**Shape:** four tasks, four atomic commits, in this order. Task 1 is the CI-correctness half; tasks
2-4 are the docs/citation half. A bisect can isolate a CI-config regression from a docs edit.

---

## Per-task gate (applies to EVERY task, no exceptions)

Run from the repo root, in this order, and require all eight green BEFORE committing:

```
npm run format:check
npm run build
npm run typecheck
npm run typecheck:action
npm run test
npm run fallow:ci
npm run check:action
npm run pack:check
```

Notes:

- **`check:action`** regenerates `start-cache-server/index.js` and diffs it. NO bundle drift is
  expected in any of the four tasks: the bundle entry is `start-cache-server/entry.ts`, which
  imports `serve()` only, and nothing here touches a `serve()`-reachable source (Task 1 touches
  nx.json + a new spec; tasks 2-4 touch docs, YAML comments and a `run:` body). If it ever fails,
  stage the regenerated `start-cache-server/index.js` in the SAME commit -- a drifted bundle in its
  own commit breaks bisect.
- **`format:check`** covers markdown and YAML. Match each file's existing wrap style rather than
  reflowing (README.md and docs/advanced.md wrap prose by hand). If it complains, run
  `npm run format` and re-stage the same named files.
- **`typecheck` from Task 1 onward re-runs on a spec edit.** That is the fix working. Expect one
  extra cache MISS per spec-touching commit; it is a one-project workspace, so the cost is noise.
- **`fallow:ci` contingency (Task 1 only).** The new spec imports from `nx`, which no existing spec
  does. `nx` is a root devDependency and fallow credits root devDependencies the same way it
  credits `vitest`, so no finding is expected. If `fallow:ci` reports `nx` as unlisted or unused,
  add `"nx", // deep-imported by nx-target-inputs.spec.ts to resolve target input globs` to
  `ignoreDependencies` in `.fallowrc.jsonc` in the SAME commit.

**Committing.** `git commit -m` FAILS in this repo (COMMIT_EDITMSG "Invalid argument", D: is a ReFS
Dev Drive). Write each message to the session scratchpad and use `-F`:

```
git add <specific files by name>
git commit -F "C:/Users/LARSGY~1/AppData/Local/Temp/claude/D--projects-github-op-nx-github-cache/70dece54-dc1c-4b90-8ffa-84ba4e93917e/scratchpad/commit-<n>.txt"
```

Never `git add .` / `-A` / `-u`. Stage only the files each task names. Never the Grep tool or the
`grep` command -- `git grep` for tracked files, `rg` otherwise, `| rg` in pipes.

---

## TASK 1 -- Hash the spec sources in `typecheck.inputs`, and guard the hole shut

**Lands FIRST.** It is the CI-correctness half, and it makes `npm run typecheck` -- one of the eight
gates the remaining three tasks are measured against -- trustworthy after a spec-only edit.

### files

- `nx.json`
- `packages/github-cache/src/nx-target-inputs.spec.ts` (NEW)
- `.fallowrc.jsonc` (contingency only, see the gate note)

### action

TEST first, observe the RED, then the config edit. One commit.

**Step 1a -- RED: add the guard.** Write `packages/github-cache/src/nx-target-inputs.spec.ts`. This
exact body was probe-compiled against the installed `nx@23.1.0` under this repo's `nodenext` +
`customConditions` tsconfig, and probe-executed under Node ESM (the bare-specifier named import
from Nx's CJS module resolves and interops):

```ts
import { readFileSync } from 'node:fs';
import type { NxJsonConfiguration } from 'nx/src/config/nx-json.js';
import {
  extractPatternsFromFileSets,
  filterUsingGlobPatterns,
  splitInputsIntoSelfAndDependencies,
} from 'nx/src/hasher/task-hasher.js';
import { describe, expect, it } from 'vitest';

/**
 * The `typecheck` target's command is `tsc --build tsconfig.json
 * --emitDeclarationOnly`, and `packages/github-cache/tsconfig.json` references
 * `./tsconfig.spec.json`, so the command DOES compile the spec files. Its inputs
 * used to start from the `production` named input, which excludes both
 * `*.spec.ts` and `tsconfig.spec.json` -- so a spec-only edit left the task hash
 * unchanged and Nx replayed a cached success. `npm run typecheck` exited 0 while
 * the REPLAYED output itself contained "Found 1 error.", and exit 0 is what any
 * `&&` chain or CI gate reads. Same false-pass class as T-06-03-02.
 *
 * This guard pins the INVARIANT (the spec sources are in the hashed fileset),
 * not the spelling. It delegates every glob decision to Nx's own resolver -- the
 * same three functions Nx's hasher uses (`getTargetInputs` composes
 * `splitInputsIntoSelfAndDependencies` + `extractPatternsFromFileSets`
 * identically) -- so it cannot drift from Nx's behaviour and it does not care
 * whether the fix is spelled `default`, a new named input, or an explicit
 * pattern list.
 *
 * Two limits of that delegation, both deliberate. `filterUsingGlobPatterns`
 * substitutes `{projectRoot}` ONLY, so probe paths must be project-relative -- a
 * `{workspaceRoot}` pattern survives literally and matches nothing here. And an
 * EMPTY pattern list makes it return every file it was handed, which is why the
 * non-vacuity control below is a negative assertion rather than another
 * toContain().
 *
 * `nx/src/*` is an internal subpath with no semver guarantee. An Nx major could
 * move it and break this file at IMPORT time. That is the desired failure mode:
 * loud and immediate, never a silent pass.
 *
 * Reading nx.json from a spec is only safe because `{workspaceRoot}/nx.json` is
 * a `test` input (asserted below). A target's `inputs` array and nx.json's root
 * `namedInputs` are NOT part of the ProjectConfiguration hash, so without that
 * wiring Nx would replay this guard's cached PASS after someone reopened the
 * hole -- the same bug, one level up.
 */
type TargetInputs = NonNullable<NxJsonConfiguration['namedInputs']>[string];

const nxJson = JSON.parse(
  readFileSync(new URL('../../../nx.json', import.meta.url), 'utf8'),
) as {
  namedInputs: Record<string, TargetInputs>;
  targetDefaults: Record<string, { inputs: TargetInputs }>;
};

const PROJECT_ROOT = 'packages/github-cache';

// Probe paths, not file-existence assertions: `filterUsingGlobPatterns` is a
// pure glob filter over the list it is handed, so these represent the three
// classes of file the fix is about -- a lib source, a spec source, and the spec
// tsconfig. They deliberately do not name a real spec file, so renaming one
// cannot make this guard vacuous.
const PROBE_FILES = [
  `${PROJECT_ROOT}/src/index.ts`,
  `${PROJECT_ROOT}/src/index.spec.ts`,
  `${PROJECT_ROOT}/tsconfig.spec.json`,
];

function hashedFilesFor(target: string): string[] {
  const { selfInputs } = splitInputsIntoSelfAndDependencies(
    nxJson.targetDefaults[target].inputs,
    nxJson.namedInputs,
  );

  return filterUsingGlobPatterns(
    PROJECT_ROOT,
    PROBE_FILES.map((file) => ({ file, hash: 'probe' })),
    extractPatternsFromFileSets(selfInputs),
  ).map((entry) => entry.file);
}

describe('typecheck hashes everything its command compiles', () => {
  it('hashes the spec sources', () => {
    expect(hashedFilesFor('typecheck')).toContain(
      `${PROJECT_ROOT}/src/index.spec.ts`,
    );
  });

  it('hashes tsconfig.spec.json', () => {
    expect(hashedFilesFor('typecheck')).toContain(
      `${PROJECT_ROOT}/tsconfig.spec.json`,
    );
  });

  // Presence control: the lib sources must survive the fix, not just the specs.
  it('still hashes the lib sources', () => {
    expect(hashedFilesFor('typecheck')).toContain(`${PROJECT_ROOT}/src/index.ts`);
  });

  // NON-VACUITY control, and it must be a NEGATIVE one. filterUsingGlobPatterns
  // starts with `if (positive.length === 0 && negative.length === 0) return files`
  // -- an empty pattern list returns the WHOLE probe list untouched. So every
  // toContain() above would pass together on a resolver that resolved nothing,
  // which is the same class of silent false pass this guard exists to prevent.
  // `build` is the discriminator: its inputs genuinely exclude specs, so this
  // assertion is true today and false the instant the filter stops filtering.
  it('does NOT hash the spec sources for build, proving the filter filters', () => {
    expect(hashedFilesFor('build')).not.toContain(
      `${PROJECT_ROOT}/src/index.spec.ts`,
    );
  });
});

describe('the guard cannot replay a stale pass', () => {
  // This one DOES pin a literal, deliberately: there is no resolver to delegate
  // to for a `{workspaceRoot}` entry, and the wiring IS the invariant. Its
  // limitation is honest -- if the entry is removed, this test only fires once
  // some other input busts the `test` hash. That is still the next unrelated
  // source edit, and stating the requirement in code beats leaving it implicit.
  it('nx.json is a test input, so editing it re-runs this file', () => {
    expect(nxJson.targetDefaults.test.inputs).toContain(
      '{workspaceRoot}/nx.json',
    );
  });
});
```

Run `npm run test`. Expect a **3-failure RED out of 5 assertions**, measured on the tree as committed.
Note the count is assertion-sites = cases here: five plain `it()` blocks, zero `it.each`, so vitest's
case count cannot exceed the site count (the previous quick task predicted 9 and got 10 precisely
because an `it.each` block contributed three cases from two sites).

| assertion | current resolved fileset | outcome |
| --- | --- | --- |
| hashes the spec sources | `[src/index.ts]` | FAIL |
| hashes tsconfig.spec.json | `[src/index.ts]` | FAIL |
| still hashes the lib sources | `[src/index.ts]` | pass (presence control) |
| does NOT hash spec sources for build | `[src/index.ts]` | pass (non-vacuity control) |
| nx.json is a test input | `test.inputs` lacks it | FAIL |

The two controls pass on BOTH sides of the fix by design -- that is what makes them controls. If either
ever FAILS, stop: a passing-control failure means the resolver itself changed shape, not that the fix is
wrong.

**Step 1b -- GREEN: the one-token fix.** In `nx.json`, `targetDefaults.typecheck.inputs`, replace
`"production"` with `"default"`. Change nothing else in that array -- in particular leave the
`dependentTasksOutputFiles` entry, the `{ dependencies: true }` fileset and the
`externalDependencies` entry untouched (Nx routes all three out of the self-input glob group, so the
swap cannot interact with them), and do NOT add `^production`.

Do NOT add a new named input, and do NOT add a `tsconfig.spec.json` entry. `default` already IS the
spec-inclusive named input, and it resolves `tsconfig.spec.json` via `{projectRoot}/**/*`.

**Step 1c -- GREEN: the mandatory wiring.** In `nx.json`, add `"{workspaceRoot}/nx.json"` to
`test.inputs`, alongside the doc entries already there (the T-06-03-02 precedent). Put it next to
`"{workspaceRoot}/package.json"` so the root-config entries sit together. Cost: every nx.json edit
busts the `test` hash -- the same trade already accepted for README.md et al.

Re-run `npm run test`: all four assertions pass (`typecheck` now resolves to all three probe files,
`test.inputs` contains the entry).

### verify

- `npm run test` shows the 3-failure RED at step 1a and GREEN after 1b+1c. Record both.
- `npx nx show project github-cache --json` -- confirm `typecheck.options.command` is still
  `tsc --build tsconfig.json --emitDeclarationOnly` (the reason specs must be hashed at all).
- Independent end-to-end confirmation, no cast and no papering over: introduce a deliberate type
  error in any existing spec file, run `npm run typecheck` twice, confirm it exits **non-zero both
  times** (before this fix the second run exited 0 with `Cache: 2/2 hit (100%)` while the replayed
  output contained "Found 1 error."), then revert the deliberate error and confirm
  `npm run typecheck` is green again. Do NOT commit the deliberate error.
- Full 8-command battery green.
- `git -c core.pager=cat diff --stat` shows exactly `nx.json` and the new spec (plus
  `.fallowrc.jsonc` only if the contingency fired).

### done

`nx.json` `typecheck.inputs` starts from `default`; `test.inputs` carries `{workspaceRoot}/nx.json`;
`nx-target-inputs.spec.ts` exists and passes; a spec-only type error can no longer be masked by a
cache HIT; one atomic commit.

### commit message (write to `scratchpad/commit-1.txt`)

```
fix(nx): hash spec sources in the typecheck target's inputs

targetDefaults.typecheck.inputs started from the `production` named input,
which excludes `*.spec.ts` AND `tsconfig.spec.json`. But the target's command
is `tsc --build tsconfig.json --emitDeclarationOnly`, and the project's
tsconfig.json references tsconfig.spec.json, so the command DOES compile the
specs. A spec-only edit therefore left the task hash unchanged and Nx replayed
a cached success: `npm run typecheck` exited 0 while the REPLAYED output itself
contained "Found 1 error." and "exited with non-zero status code". Exit 0 is
what any `&&` chain or CI gate reads. Same false-pass class as T-06-03-02.

Switch to `default`, the spelling test.inputs already uses. Keeping
`production` and re-adding the two excluded patterns would NOT work: Nx
partitions a fileset's patterns into included/excluded buckets by a leading
`!`, discards position, and sorts the array, so a later positive pattern can
never undo an earlier negation. `default` also covers tsconfig.spec.json,
which the same exclusion had silently broken and which needs no separate
entry.

The guard resolves the input globs through Nx's own exported resolver rather
than asserting the literal string, so it pins the invariant and cannot drift
from Nx's glob semantics.

`{workspaceRoot}/nx.json` joins test.inputs in the same commit, and that is
load-bearing rather than tidy: a target's `inputs` array and nx.json's root
`namedInputs` are not part of the ProjectConfiguration hash node, so without
the wiring the `test` hash would not move when someone reopens the hole and Nx
would replay the guard's cached pass -- the same bug class, one level up.
```

---

## TASK 2 -- Mint the bearer token with node, not openssl (5 sites)

### files

- `README.md` (line 39)
- `docs/advanced.md` (line 98)
- `docs/examples/minimal-ci.yml` (line 35)
- `start-cache-server/action.yml` (line 15)
- `.github/workflows/ci.yml` (line 523)

### action

Use the spelling already proven in this repo's CI at `ci.yml:183`, **verbatim**:

```bash
token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
```

Byte-for-byte equivalent to `openssl rand -hex 32` (32 random bytes -> 64 hex chars).
`process.stdout.write` rather than `console.log` emits no trailing newline. The `-e` payload is
single-quoted and contains no `$`, no backtick and no single quote, so the CLAUDE.md
outer-shell-expansion trap cannot fire; it sits inside a `run: |` literal block scalar and contains
no `${{`, so neither YAML nor Actions expression interpolation engages.

Per site:

| file:line | current | replacement |
| --- | --- | --- |
| `README.md:39` | `token="$(openssl rand -hex 32)"` | the line above, verbatim |
| `docs/examples/minimal-ci.yml:35` | `token="$(openssl rand -hex 32)"` | the line above, verbatim |
| `start-cache-server/action.yml:15` | `#       token="$(openssl rand -hex 32)"     # mask BEFORE writing $GITHUB_ENV` | same comment shape, node payload; keep the trailing `# mask BEFORE writing $GITHUB_ENV` note |
| `.github/workflows/ci.yml:523` | `token="$(openssl rand -hex 32)"` | the line above, verbatim |
| `docs/advanced.md:98` | `export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="$(openssl rand -hex 32)"` | **adapt, do not blind-replace**: keep the `export VAR="$(...)"` shape, swap only the command substitution's body |

`start-cache-server/action.yml:15` sits inside a `#` comment block. If the node one-liner pushes the
line past the file's comment width, drop the trailing inline note to its own comment line rather
than wrapping the command -- a wrapped shell line in a copy-paste recipe is worse than an extra
comment line.

Add the WHY once per surface, adapted from `ci.yml:179-182` (do not repeat it five times):

- `README.md`, `docs/examples/minimal-ci.yml`, `start-cache-server/action.yml`: one short clause
  next to the line, e.g. `# node, not openssl: openssl may be absent from a Windows runner's Git
  Bash, while node is guaranteed present wherever the sidecar runs.`
- `docs/advanced.md`: same clause, adapted to the `&`-fallback block's existing comment voice.
- `.github/workflows/ci.yml:523`: no new comment needed -- `:179-182` already states the reasoning
  and `:352` references it. Optionally point at it in one clause.

Leave `ci.yml:179` and `ci.yml:352` (both existing prose ABOUT node-not-openssl) untouched -- they
are already correct and are the reason this inconsistency was findable.

### verify

- `git grep -n "openssl" -- ':!.planning'` returns exactly the two ci.yml PROSE mentions
  (`:179`, `:352`) and **no** `openssl rand` invocation anywhere.
- `git grep -c "::add-mask::" -- README.md docs/advanced.md docs/examples/minimal-ci.yml` returns
  **`README.md:2`, `docs/advanced.md:1`, `docs/examples/minimal-ci.yml:1`** -- UNCHANGED from
  `origin/main`, so the `docs-adoption.spec.ts:87-113` guard still has its token in each file.
  README's count is 2 because it carries a PROSE mention at `:37` ("from the moment the
  `::add-mask::` command is processed") in ADDITION to the command at `:40`. Both are legitimate.
  Do NOT "fix" the prose sentence to make the counts uniform -- expecting 1 for each would read a
  perfectly healthy tree as a regression. Prefer `git diff origin/main -- <file>` over the raw count
  if there is any doubt.
- `npm run test` passes, including `docs-adoption.spec.ts` and `public-surface.spec.ts` (the
  action.yml edit is at line 15, above `inputs:` at line 38; the input key set is untouched).
- `python -c` is not needed; just confirm by eye that no file gained a non-ASCII character.
- Full 8-command battery green.

### done

Zero `openssl` invocations remain in tracked, non-`.planning` files; all four consumer surfaces plus
`consumer-smoke` mint the token with node; the two correct ci.yml prose mentions survive; one atomic
commit.

### commit message (write to `scratchpad/commit-2.txt`)

```
fix(docs): mint the loopback bearer token with node, not openssl

openssl may be absent from a Windows runner's Git Bash, while node is
guaranteed present wherever the sidecar runs -- start-cache-server is a node24
JS action, and an Nx workflow needs setup-node regardless. Every documented
snippet that minted the token with `openssl rand -hex 32` handed adopters a
recipe that breaks the moment they move the job to a Windows runner.

Use the spelling this repo's own CI has run on both ubuntu-24.04-arm and
windows-11-arm since the dogfood work. 32 random bytes rendered as 64 hex
characters -- byte-for-byte equivalent in entropy and format.
process.stdout.write rather than console.log emits no trailing newline.

The consumer-smoke job is included even though it is internal and
ubuntu-only: it is the job whose whole purpose is to demonstrate the consumer
surface, and it contradicted the node-not-openssl reasoning stated 344 lines
above it in the same file. An inconsistency, not a live break.
```

---

## TASK 3 -- Document the readiness poll and `timeout-minutes` for adopters

Both controls exist in this repo's CI and in NO consumer doc, so the documented quickstart races the
sidecar and has no bound on a hang.

### files

- `README.md`
- `docs/examples/minimal-ci.yml`
- `docs/advanced.md`
- `start-cache-server/action.yml`

### action

**Placement rule (research's recommendation, adopted).** The FULL block lands in the two
copy-paste surfaces only -- `README.md` and `docs/examples/minimal-ci.yml`. `docs/advanced.md` and
`start-cache-server/action.yml` POINT at it. Four copies of a 25-line block is four things to drift.

**3a -- the poll, in README.md and minimal-ci.yml.** Insert between the `start-cache-server` step
and the `npx nx affected` step. Port the shape AND the reasoning from `ci.yml:193-227`, trimmed to
the load-bearing half. Match each file's existing style: a leading `#` comment block and a bare
`- run: |` (neither file uses `name:` keys).

```yaml
      # Wait for the sidecar before the first Nx task, and demand exactly 404 or
      # 200. An authed GET on an unknown hash MISSes with 404 on every backend the
      # sidecar can select, and 200 needs a pre-existing entry -- either one proves
      # reachability AND that the bearer token matches. Accepting "any status but
      # 000" would pass a 401, i.e. a token mismatch, after which every Nx request
      # 401s, read faults degrade to a cache MISS, and the job goes GREEN having
      # cached nothing. 404 also rejects a squatter process on the port answering
      # with its own status.
      - run: |
          set -euo pipefail
          auth="Authorization: Bearer ${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
          code=000
          for _ in $(seq 1 30); do
            # curl already prints 000 and exits non-zero on connection-refused, so
            # swallow the exit with `|| true` -- NEVER `|| echo 000`, which appends
            # a second 000 and makes the status unparseable. --max-time bounds EACH
            # attempt, so the loop's worst case is 30 x (10 + 1), about 5.5 minutes
            # -- not 30 seconds.
            code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H "${auth}" "${NX_SELF_HOSTED_REMOTE_CACHE_SERVER}/v1/cache/deadbeef" || true)
            if [ "${code}" = "404" ] || [ "${code}" = "200" ]; then
              break
            fi
            sleep 1
          done
          if [ "${code}" != "404" ] && [ "${code}" != "200" ]; then
            echo "sidecar not ready on ${NX_SELF_HOSTED_REMOTE_CACHE_SERVER} after 30 attempts (last status ${code}, wanted 404 or 200)" >&2
            exit 1
          fi
```

**3b -- `timeout-minutes`, in README.md and minimal-ci.yml.** Add `timeout-minutes: 15` to the
`build` job in each snippet, with a comment adapted from `ci.yml:159-165` that keeps the two hangs
DISTINCT:

```yaml
    # Generic hang insurance, NOT a teardown workaround and NOT the containment
    # control for a failing step. `cancel:` needs no help: a cancel: step is not
    # subject to skip-on-failure, so it still tears the sidecar down when an
    # earlier step fails. The hang warned about below is the one caused by
    # OMITTING cancel: -- a different thing. This bound only caps a genuine hang
    # (a stalled npm ci, a wedged test run) at minutes instead of the
    # 360-minute default.
    timeout-minutes: 15
```

Do NOT introduce any `continue-on-error`, `if:` gate, or fail-gate step. rk4 measured that
mechanism as unnecessary AND fail-open on drift, and rejected shipping it to adopters.

**3c -- the Windows-shell note.** Both snippets pin `runs-on: ubuntu-latest`, where `shell: bash` is
a no-op, so do NOT sprinkle redundant `shell:` keys through a beginner quickstart. Instead add ONE
sentence covering the whole snippet, in README.md prose and as a comment in minimal-ci.yml:

> On a Windows runner, add `shell: bash` to every `run:` step above -- the default there is `pwsh`,
> which does not understand `$GITHUB_ENV` or `$(...)`.

**3d -- README.md prose.** Extend the `cancel:` bullet region in "How it works" with one sibling
bullet, keeping the two hangs distinct:

> - **Wait for the sidecar, and bound the job.** The first Nx task can reach the loopback port
>   before the server binds it, so poll until an authed GET returns 404 or 200 (see the quickstart).
>   `timeout-minutes` on the job is separate: generic hang insurance, not the containment control
>   for a failing step -- a `cancel:` step is not subject to skip-on-failure.

**3e -- the two pointers.**

- `docs/advanced.md`, in the `&`-fallback block: one comment line inside the snippet plus one
  sentence after it, pointing at the README quickstart's poll. The `&` form has the same race (the
  next step's Nx run can beat the backgrounded server), so the pointer is substantive, not
  cosmetic. Use a relative link: `[the quickstart](../README.md#quickstart-5-minutes)`.
- `start-cache-server/action.yml`, in the usage-recipe comment block (between the `uses:` entry at
  `:18-22` and the `npx nx affected` line at `:23`): two comment lines, e.g.

  ```
  #   - run: ...                            # poll until an authed GET on an unknown
  #                                         # hash returns 404 or 200 (see README.md)
  ```

  Add NO input to the action (`public-surface.spec.ts:150-155` asserts the key set is exactly
  `['port']`). Keep every edit ABOVE `inputs:`.

**Guard hazard, encoded.** When porting comment text from `ci.yml`, REPHRASE. `ci.yml:144-146`
mentions "the integration matrix's windows-11-arm leg"; `docs-adoption.spec.ts:156-166` asserts
`minimal-ci.yml` does not match `/matrix:/` and does not contain `operation:`. The prose above is
already rephrased and carries neither token -- keep it that way.

### verify

- `npm run test` passes. Specifically `docs-adoption.spec.ts`: the three LIFECYCLE_TOKENS
  (`start-cache-server`, `background:`, `cancel:`) are still present in README.md and
  minimal-ci.yml, and minimal-ci.yml still contains neither `operation:` nor `matrix:`.
- `git grep -n -e "operation:" -e "matrix:" -- docs/examples/minimal-ci.yml` returns nothing.
- `git grep -n "max-time 10" -- README.md docs/examples/minimal-ci.yml` returns one hit in each.
- `git grep -n "timeout-minutes" -- README.md docs/examples/minimal-ci.yml` returns one hit in each.
- `git grep -n "30s" -- README.md docs/examples/minimal-ci.yml docs/advanced.md` returns nothing --
  the ~5.5-minute worst case must not be restated as a 30-second bound.
- `git grep -n -e "continue-on-error" -- README.md docs/ start-cache-server/` returns nothing.
- Read the two snippets end to end as an adopter would: checkout -> setup-node -> npm ci -> pre-set
  vars -> sidecar -> poll -> nx -> cancel. The poll must sit AFTER the sidecar step and BEFORE the
  Nx step.
- Full 8-command battery green.

### done

Both copy-paste surfaces carry the poll (with the 404-or-200 reasoning and the ~5.5-min bound) and
`timeout-minutes` (framed as hang insurance, distinct from the omitted-`cancel:` hang);
`docs/advanced.md` and `start-cache-server/action.yml` point at it; no continue-on-error mechanism
reaches adopters; one atomic commit.

### commit message (write to `scratchpad/commit-3.txt`)

```
docs(adoption): document the sidecar readiness poll and timeout-minutes

Two robustness controls this repo's own CI has carried since the dogfood work
were absent from every consumer surface, so the documented quickstart raced
the sidecar and had no bound on a hang.

Readiness poll. The first Nx task can reach the loopback port before serve()
binds it. The poll demands exactly 404 or 200, and that specificity is the
point: an authed GET on an unknown hash MISSes with 404 on every backend
selectBackend can return, and 200 needs a pre-existing entry -- either proves
reachability AND that the bearer token matches. Accepting "any status but 000"
would pass a 401, i.e. a token-handshake mismatch, after which every Nx
request 401s, read faults degrade to a cache MISS, and the job goes GREEN
having cached nothing. `curl --max-time 10` bounds each attempt, so the loop's
worst case is 30 x (10 + 1), about 5.5 minutes -- not 30 seconds.

timeout-minutes. Generic hang insurance, capping a stalled install or a wedged
test run at minutes instead of the 360-minute default. It is NOT the
containment control for a failing step and not a `cancel:` workaround -- a
cancel: step is not subject to skip-on-failure. The hang the README already
warns about is the one caused by OMITTING cancel:, which is a different thing.
No continue-on-error dance ships to adopters.

The full block lands in the two copy-paste surfaces. docs/advanced.md and
start-cache-server/action.yml point at it rather than carrying a fourth and
fifth copy that could drift.
```

---

## TASK 4 -- Correct the doc-lag comment and annotate the citation

Both halves are the same correction from the same primary source, so they share one commit.

### files

- `.github/workflows/ci.yml` (lines 128-132)
- `.planning/milestones/v0.0.1-phases/06-distribution-docs-governance/06-RESEARCH.md` (line 508)

### action

**4a -- `ci.yml:128-132`.** The comment currently asserts the keyword family ships documented "ONLY
in the 2026-06-25 changelog ... and the workflow-syntax reference it links to does not mention them
at all". That is now false: the reference documents the whole family (`background` x40, `wait-all`
x10, plus `cancel:` and `parallel:` sections, measured 2026-07-26). Rewrite that clause to say the
reference NOW documents the family and independently corroborates what this repo measured, while
keeping every measurement and every run id below it verbatim. Suggested replacement for the false
clause, preserving the surrounding structure:

```
  #   * `cancel: cache-server` is MANDATORY (Pitfall 3). All three facts below were
  #     MEASURED here first: when they were established, the keywords shipped
  #     documented only in the 2026-06-25 changelog
  #     (https://github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel).
  #     The workflow-syntax reference has since documented the whole family
  #     (background:/wait:/wait-all:/cancel:/parallel:, corroborated 2026-07-26) and
  #     independently confirms all three, so they are now citable as well as measured.
```

Do NOT touch the three measured bullets at `:133-143` (runs 30172888579, 30172032003, 30171349564)
or the `shell: bash` note at `:144-146`. The measurements were right; only the doc-lag premise was
stale.

**4b -- `06-RESEARCH.md:508`.** Append a nested annotation directly under that bullet. It must say
CORROBORATED -- research inverted A5's premise, and "not reproducible" would now be the false
statement:

```
  - ANNOTATION 2026-07-26 (quick 260726-gok): the two claims on this line that the 260725-rk4
    review flagged as unreproducible -- the composite-action `background:` restriction and the
    10-concurrent-background-step limit -- are both CORROBORATED. Each is documented verbatim under
    `#jobsjob_idstepsbackground` at
    https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax, confirmed a
    second time against the versioned github/docs source
    (content/actions/reference/workflows-and-actions/workflow-syntax.md:918-919). The composite note
    landed via docs PR #61978 on 2026-06-30, three weeks BEFORE this line's 2026-07-20 fetch, so the
    citation was legitimate when written; the "unreproducible" flag is best explained as a FETCH
    failure (docs.github.com blocks the agent user agent), not a factual finding. The 10-step limit
    is deliberately NOT propagated into any consumer doc -- none asserts it, and an adopter runs one
    background step.
```

Keep the existing bullet's text byte-identical, including its em dash (it is pre-existing content,
not new writing). Every character you ADD is ASCII.

**Do not touch** `docs/advanced.md:127-132` or `start-cache-server/action.yml:29`. U1 is RESOLVED:
the composite-`background:` claim is corroborated and ships as written. No soften, no probe, no
drop.

### verify

- `git grep -n "does not mention them at all" -- .github/workflows/ci.yml` returns nothing.
- `git grep -n "30172888579" -- .github/workflows/ci.yml` still returns its line -- the
  measurements survived the rewrite.
- `git grep -n "not reproducible" -- .planning/milestones/v0.0.1-phases/06-distribution-docs-governance/06-RESEARCH.md`
  returns nothing. NOTE this check is VACUOUS on its own -- neither "not reproducible" nor
  "unreproducible" is in that file today, so it passes before any edit. Keep it as a
  wrote-the-wrong-thing tripwire, but the substantive checks are the two POSITIVE ones below.
- `git grep -n "CORROBORATED" -- .planning/milestones/v0.0.1-phases/06-distribution-docs-governance/06-RESEARCH.md`
  returns the NEW annotation line (positive proof the flip actually landed).
- `git grep -c "docs.github.com/en/actions/reference" -- .planning/milestones/v0.0.1-phases/06-distribution-docs-governance/06-RESEARCH.md`
  increases by exactly one versus `origin/main` -- the URL shipped with the annotation.
- `git grep -c "composite" -- docs/advanced.md start-cache-server/action.yml` is unchanged from
  `origin/main` -- the corroborated claim was not edited. Cross-check with
  `git -c core.pager=cat diff origin/main -- docs/advanced.md` showing only the Task 2 and Task 3
  edits.
- `git grep -n "10 background steps" -- ':!.planning'` returns nothing -- the count limit stayed out
  of every consumer doc.
- Full 8-command battery green. (`.planning/**` is not a `test` input, but `ci.yml` is not either --
  so this task's battery is a regression check, not a content check.)

### done

`ci.yml`'s doc-lag clause is corrected with every measurement intact; `06-RESEARCH.md:508` carries
a corroborated-with-URL annotation; the composite-`background:` claim is untouched in both shipped
files; the 10-step limit is in no consumer doc; one atomic commit.

### commit message (write to `scratchpad/commit-4.txt`)

```
docs(citations): record that workflow-syntax now documents the background-step family

Two in-repo artifacts asserted a documentation lag that no longer holds.

ci.yml's dogfood comment said the background-step keywords ship documented
"ONLY in the 2026-06-25 changelog ... and the workflow-syntax reference it
links to does not mention them at all". The reference now documents the whole
family. That sentence is the stated justification for "all three facts below
were MEASURED", so a future reader would re-derive from a false premise. The
measurements stay untouched -- they were right, and they are now independently
citable too.

06-RESEARCH.md's primary-source line was flagged as unreproducible during the
rk4 review. Both of its doubted claims are in fact corroborated from primary
sources: the composite-action `background:` restriction and the
10-concurrent-background-step limit are each documented verbatim on the
reference page, confirmed a second time against the versioned github/docs
source. The note documenting the restriction landed 2026-06-30, three weeks
before that line was written, so the citation was legitimate at the time; the
"unreproducible" flag is best explained as a fetch failure, not a factual
finding.

Annotation only. The 10-step limit stays out of every consumer doc: none
asserts it, and an adopter runs one background step.
```

---

## Plan-check amendments (applied 2026-07-26 after `260726-gok-PLAN-CHECK.md`)

The gate returned **0 BLOCKING, 5 ADVISORY**. Four advisories are already folded into the task bodies
above; two need recording here because they change what a reader should trust.

**AMENDED -- the non-vacuity control is now a NEGATIVE assertion (was ADVISORY 2, the significant one).**
The original control (`toContain` on the lib source) proved nothing: `filterUsingGlobPatterns` opens with
`if (positive.length === 0 && negative.length === 0) { return files; }`, so an empty pattern list returns
the WHOLE probe list and every `toContain()` in that describe would pass together on a resolver that
resolved nothing -- the same silent-false-pass class this guard exists to prevent. Task 1 now also asserts
`hashedFilesFor('build')` does NOT contain the spec path. `build`'s inputs genuinely exclude specs
(measured), so it is true today and false the instant the filter stops filtering. The RED table is 3 of 5,
with two controls that pass on both sides by design.

**DO NOT "restore" RESEARCH.md item 7 -- it is WRONG.** RESEARCH.md's Q3 sketch recommends
`expandSingleProjectInputs` + `filterUsingGlobPatterns`. That pair THROWS on this repo's inputs:
`expandSingleProjectInputs` rejects any entry carrying `dependencies` or `projects`, and
`typecheck.inputs` contains `{ "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}", "dependencies": true }`
(`nx.json:123-126`) -- error `namedInputs definitions can only refer to other namedInputs definitions
within the same project.` Research's probe only ever fed a bare `["production"]`, which is why it never
hit this. The plan's trio (`splitInputsIntoSelfAndDependencies` -> `extractPatternsFromFileSets` ->
`filterUsingGlobPatterns`) is the ONLY correct composition here, and it mirrors Nx's own `getTargetInputs`
(`task-hasher.js:130-131`) exactly. The plan's divergence from research was a correction, not a drift.

**STATE.md is the ORCHESTRATOR's job, not a task (was ADVISORY 4).** `must_haves.key_links` cites the two
Deferred Items rows this task closes (`CI hygiene` at `.planning/STATE.md:197`, `Docs` at `:196`), but no
task touches STATE.md -- deliberately. Per GSD quick-task convention the orchestrator owns STATE.md
outside the plan's task list, and it did so on the immediately preceding task. The executor must NOT edit
STATE.md; the orchestrator closes both rows and adds the Quick Tasks row in the final docs commit.

## Out of scope -- do not touch

- The cache engine, the trust / sync gates, `releaseAssetName`, `cacheArchivePath`, the D-04 public
  surface.
- The cross-OS namespacing question -- separately deferred, and a design change to a LOCKED
  requirement (CORR-01), not a patch.
- Softening, probing or dropping the composite-`background:` claim. U1 is RESOLVED: CORROBORATED.
- Propagating the "max 10 concurrent background steps" limit into any consumer doc.
- Any new consumer env knob or action input.
- `ci.yml:179` and `ci.yml:352` -- existing, correct node-not-openssl prose.

## Deliberately not doing (named, with the lazier alternative)

- **Adding `start-cache-server/action.yml` to `DOCS_WITH_ENV_WRITE`** in
  `docs-adoption.spec.ts:95-99`. Research flagged it as a real GAP: that file's comment block
  contains the token, `GITHUB_ENV` and `::add-mask::`, yet is unguarded, and it is already a `test`
  input (`nx.json:50`) so the wiring is free. It is one line -- add `'start-cache-server/action.yml'`
  to that array -- but it widens a doc guard rather than fixing either deferred item, so it stays
  out of this PR. Worth a one-line follow-up.
- **A live composite-action `background:` probe.** Unnecessary: the claim is settled from two
  primary sources.
- **Sprinkling `shell: bash` through the consumer snippets.** Both pin `runs-on: ubuntu-latest`
  where the key is a no-op; Task 3c covers the Windows case in one sentence instead.
