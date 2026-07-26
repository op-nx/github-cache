# Quick Task 260726-gok: Research

**Researched:** 2026-07-26
**Scope:** Q1 (UNRESOLVED U1), Q2 (typecheck inputs syntax), Q3 (regression guard), Q4 (consumer-doc defects)

Confidence legend: **VERIFIED** = read from a primary source (docs.github.com / github/docs repo / nrwl/nx
source / this tree / an executed probe). **INFERRED** = reasoned from verified facts. **UNVERIFIED** = neither.

---

## Q1 (PRIMARY) -- U1 is CORROBORATED. Close it.

**Verdict: CORROBORATED. Confidence VERIFIED (two independent primary sources).**

The claim at `docs/advanced.md:127-132` and `start-cache-server/action.yml:29` is now documented
verbatim in GitHub's own workflow-syntax reference, under
`jobs.<job_id>.steps[*].background`:

> [!NOTE]
> You cannot use `background` on steps inside a composite action. A composite action can itself run
> as a background step, but it cannot declare background steps internally.

- URL: `https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax`
  (anchor `#jobsjob_idstepsbackground`). Fetched 2026-07-26 via markdown.new.
- Versioned source: `github/docs`, `content/actions/reference/workflows-and-actions/workflow-syntax.md:918-919`
  (confirmed by `gh api` code search + contents read -- a second, independent primary source).

The shipped prose in `docs/advanced.md:129-132` is a near-verbatim paraphrase of that note. It is
accurate. **Resolution: take path (a-null) -- keep the claim as-is; no softening, no probe, no drop.**
The 112-line doc patch does not need to touch it.

### Why the rk4 review's "unreproducible" flag was wrong -- and the provenance that settles it

`git log` on the docs source (via `gh api repos/github/docs/commits?path=...`) shows two commits:

| Date (UTC) | Commit |
| --- | --- |
| 2026-06-24 | `Document background steps keywords in Actions workflow syntax reference (#61865)` |
| 2026-06-30 | `Document composite-action and conditional limitations for background step keywords (#61978)` |

PR #61978 is precisely this note. It landed **2026-06-30**, i.e. three weeks BEFORE the
`06-RESEARCH.md:508` fetch on 2026-07-20. So that `VERIFIED: docs.github.com` line was legitimate at
the time it was written. The rk4 "unreproducible" flag is most plausibly a fetch failure, not a
factual finding -- `docs.github.com` blocks `WebFetch` (`Claude-User/1.0` UA), which is exactly the
symptom of "cited once, never reproducible". Confidence: VERIFIED for the commit dates; INFERRED for
the fetch-failure explanation.

### Does FOUND-03 depend on this claim?

**No -- the JS-action decision is fully carried without it. Confidence VERIFIED.** The
`ACTIONS_RUNTIME_TOKEN` rationale (Pitfall 4) is independent and sufficient: a plain `run:` step does
not receive `ACTIONS_RUNTIME_TOKEN` / `ACTIONS_RESULTS_URL`, so `@actions/cache` save/restore silently
no-ops. That is already documented at `docs/advanced.md:110-117` and is the load-bearing reason.

This is now moot for the decision (the claim is corroborated, so nothing needs dropping), but it stays
useful framing: the two bullets at `docs/advanced.md:123-132` are independently sound, not a chain.

### NEW FINDING -- three in-repo artifacts are now STALE on this. Confidence VERIFIED.

The reference page now documents the WHOLE keyword family, contradicting statements this repo ships:

1. **`.github/workflows/ci.yml:128-132`** asserts `background:`/`cancel:`/`wait:`/`parallel:` "ship
   documented ONLY in the 2026-06-25 changelog ... and the workflow-syntax reference it links to does
   not mention them at all." That is now false. Measured counts on today's page: `background` x40,
   `wait-all` x10, plus `cancel:` and `parallel:` sections. Recommend correcting this comment -- it is
   the stated justification for "everything had to be measured", and a future reader will re-derive
   from a false premise. (Not a consumer doc; comment-only, low risk.)
2. **`260726-gok-CONTEXT.md` `<unresolved>` para 2** repeats the same "changelog only" framing. Now stale.
3. **Decision A5** is premised on the `06-RESEARCH.md:508` claims being "not reproducible". Both
   claims on that line are in fact NOW corroborated:
   - "max 10 concurrent background steps" -> workflow-syntax, `#jobsjob_idstepsbackground`: *"A maximum
     of 10 background steps can run concurrently in a single job; additional background steps are
     queued until a slot is free."*
   - the composite-`background:` claim -> the note quoted above.

   **A5's ACTION still holds** (annotate `06-RESEARCH.md:508`; do NOT propagate the count limit into
   any consumer doc -- no consumer doc asserts it, and adopters run one background step). Only the
   annotation's WORDING must flip from "not reproducible" to "corroborated 2026-07-26, with URL".

**Bonus corroborations on the same page** (all previously measured-only in this repo; the measurements
were right, and now they are also citable):
- *"An implicit `wait-all` runs before any post-job cleanup."* -> confirms the hang mechanism
  (`README.md:84-86`, run 30172888579).
- *"A `wait` step always runs and does not support the `if` conditional"* -- same note for `wait-all`
  and `cancel` -> confirms the measured `if:`-rejected-on-`cancel:` finding (run 30171349564).
- *"The runner sends the step's process a termination signal (`SIGTERM`) ... and forcibly stops it
  (`SIGKILL`) if it does not exit within a short grace period."* -> confirms the `cancel:` teardown
  contract that `serve()`'s drain depends on.
- *"You cannot use `parallel` inside a composite action."* -> the same restriction covers `parallel:`.

**No live CI probe is needed.** (Not designed; the claim is settled from primary sources. If one were
ever wanted, it would be a throwaway composite action declaring `background: true` on an internal step
plus a workflow that `uses:` it -- expected outcome now: a workflow-parse or step-level rejection.)

---

## Q2 -- the exact `typecheck` inputs fix

### The key sub-question: can a later positive pattern undo an earlier `!` negation?

**NO. Negations are absolute and ORDER-INDEPENDENT within a fileset group. Confidence VERIFIED
(three independent proofs).** The "keep `production` and re-add the two excluded patterns" candidate
**does not work** -- eliminate it.

1. **Nx's Rust glob matcher** (`nrwl/nx`, `packages/nx/src/native/glob.rs`) partitions patterns into
   `included_globs` / `excluded_globs` buckets by `glob.starts_with('!')`, discarding position, then:
   ```rust
   self.included_globs.is_match(path.as_ref())
       && !self.excluded_globs.is_match(path.as_ref())
   ```
2. **Nx sorts the fileset array before use** --
   `packages/nx/src/native/tasks/hashers/hash_project_files.rs`, `project_file_set_cache_key()` does
   `sorted_file_sets.sort()`. Sorting would be a correctness bug if order carried meaning.
3. **Executed probe** against this workspace's installed `nx@23.1.0`, using Nx's own exported
   `expandSingleProjectInputs` + `filterUsingGlobPatterns` and this repo's real `namedInputs`:

   | `inputs` | files kept |
   | --- | --- |
   | `["production"]` (today) | `src/index.ts`, `tsconfig.lib.json` |
   | `["production", <spec globs re-added AFTER>]` | `src/index.ts`, `tsconfig.lib.json` -- **identical, re-add is a no-op** |
   | `["default"]` (`test.inputs` shape) | `src/index.ts`, **`src/index.spec.ts`**, **`tsconfig.spec.json`**, `tsconfig.lib.json` |
   | `[<spec globs FIRST>, "production"]` | `src/index.ts`, `tsconfig.lib.json` -- confirms order-independence |

### THE FIX (one-token change)

In `nx.json`, `targetDefaults.typecheck.inputs`, replace `"production"` with `"default"`:

```json
"typecheck": {
  "inputs": [
    "default",
    { "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts}", "transitive": true },
    { "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}", "dependencies": true },
    { "externalDependencies": ["typescript", "tslib", "@types/node"] }
  ]
}
```

This is the option decision A1 locked, in the spelling that mirrors `test.inputs` (`nx.json:44`). It is
the ONLY one of the three candidates that works given the negation semantics above. A new named input
would also work but is strictly more machinery for the same resolved set -- do not add one (`default`
already IS the named input that means "spec-inclusive").

Requirement checks:
- **Keeps specs type-checked:** yes, and this is not merely preserved, it is REAL. VERIFIED via
  `nx show project github-cache --json`: `typecheck.options.command` is
  `tsc --build tsconfig.json --emitDeclarationOnly`, and `packages/github-cache/tsconfig.json:5-12`
  references BOTH `./tsconfig.lib.json` AND `./tsconfig.spec.json`. `typecheck.outputs` even includes
  `{projectRoot}/out-tsc/vitest/tsconfig.spec.tsbuildinfo`. The spec project is genuinely built.
- **A spec-only edit busts the hash:** yes -- row 3 of the probe table puts `src/index.spec.ts` in the
  hashed fileset. Confidence VERIFIED.
- **`tsconfig.spec.json` also needs to be an input -- and `default` already covers it.** VERIFIED:
  `production` excludes it explicitly (`nx.json:8`), so today editing the spec tsconfig also fails to
  bust the hash -- a second, unreported instance of the same defect. `default` = `{projectRoot}/**/*`,
  which matches it (probe row 3 lists it). **No separate entry is needed.** Note `test.inputs:62` has
  `{ "fileset": "{projectRoot}/tsconfig.spec.json", "dependencies": true }` -- that is the
  DEPENDENCY-scoped (`^`) variant for other projects, a different concern; do not copy it into
  `typecheck`.

### Side effects

- **On the `dependentTasksOutputFiles` entry (`nx.json:119-122`): NONE. Confidence VERIFIED.** Nx's
  `splitInputsIntoSelfAndDependencies` routes `dependentTasksOutputFiles` to `depsOutputs` and any
  `{ dependencies: true }` fileset to `depsFilesets`, both separate from the `selfInputs` glob group
  that the positive/negative partition applies to. The `production` -> `default` swap cannot interact
  with either.
- **On cache hit-rate: minimal and intended.** The delta between `default` and `production` is exactly
  two patterns -- spec/test files and `tsconfig.spec.json`. Nothing else widens. So `typecheck` now
  re-runs on a spec edit, which IS the fix. One task on a one-project workspace; negligible.
- `typecheck` deliberately has no `^production`; leave it that way (unchanged by this fix).

---

## Q3 -- leaving a check behind. Recommended, with ONE mandatory precondition.

**Recommendation: ship the guard, invariant-flavoured, using Nx's own resolver. AND add
`{workspaceRoot}/nx.json` to `test.inputs` -- without that the guard is worthless.**

### The precondition is not optional: `nx.json` is NOT hashed for the `test` target

**Confidence VERIFIED (primary source).** `nrwl/nx`,
`packages/nx/src/native/tasks/hashers/hash_project_config.rs` -- the `ProjectConfiguration` hash
instruction covers only `project.root`, `tags`, per-target
`(name, executor, outputs, options, configurations, parallelism)`, and PROJECT-level `named_inputs`.

**A target's `inputs` array is NOT in that list, and neither is nx.json's root `namedInputs`.**

Consequence: editing `targetDefaults.typecheck.inputs` changes the hashed FILE LIST for `typecheck`
(so `typecheck`'s own hash moves), but changes nothing at all in the `test` task's hash. `test.inputs`
(`nx.json:44-69`) does not list `{workspaceRoot}/nx.json`. So a guard spec that reads `nx.json` would
**replay a stale pass** the moment someone reopens the hole -- the exact bug class being fixed, moved
one level up. This is the T-06-03-02 precedent applied to `nx.json`: add
`"{workspaceRoot}/nx.json"` to `test.inputs` alongside the 15 doc entries already there.

Cost of that wiring: every `nx.json` edit busts the `test` hash. Same trade already accepted for
`README.md` et al. Acceptable.

### Closest existing precedent to copy

**`pinned-deps.spec.ts`** -- it is the same shape: read a JSON config outside `src/` via
`new URL(..., import.meta.url)` (it already reaches `../../../package.json` for the workspace
manifest), assert a property, no snapshot. Follow its explicit-assertion style (D-05), matching
`public-surface.spec.ts`'s stated preference over `toMatchSnapshot()`.

### Shape: pin the INVARIANT, not the spelling

Do NOT assert `inputs[0] === 'default'` -- that pins the spelling and would fail on any equivalent
refactor. Assert the resolved outcome instead, by calling Nx's own resolver:

```ts
import {
  expandSingleProjectInputs,
  filterUsingGlobPatterns,
} from 'nx/src/hasher/task-hasher.js';
```

Then expand `targetDefaults.typecheck.inputs` against `nx.json`'s `namedInputs`, filter a
representative file list, and assert a `*.spec.ts` path and `tsconfig.spec.json` both survive.
Because it delegates the glob semantics to Nx, it cannot drift from Nx's behaviour.

- **The deep import resolves. Confidence VERIFIED** by probe: `nx`'s `package.json` exports map has
  `"./src/*": { "default": "./dist/src/*.js" }`, and `require.resolve('nx/src/hasher/task-hasher.js')`
  anchored inside the package resolves to
  `node_modules/nx/dist/src/hasher/task-hasher.js`. Both functions are exported (`exports.` lines 11-13).
- **Caveat, flag it in the plan:** `nx/src/*` is an internal subpath with no semver guarantee. An Nx
  major could move it, breaking the guard at import time. That fails LOUDLY (module-not-found), never
  silently -- an acceptable failure mode, and arguably the desired one. If that risk is unwanted, the
  lazier fallback is to assert the invariant WITHOUT Nx: assert that the resolved input strings contain
  no `!`-pattern matching `spec`. Less faithful, but zero dependency on an internal path. Recommend the
  Nx-resolver version; it pins the actual invariant.

**Is it flaky? No.** Pure file read plus pure functions, no I/O beyond `readFileSync`, no network, no
timing. Confidence INFERRED (from the probe running deterministically).

---

## Q4 -- consumer-doc defect specifics

### A2: the `node` replacement one-liner

Use the spelling **already proven in this repo's CI** at `.github/workflows/ci.yml:183`:

```bash
token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
```

**Why it is safe -- four separate reasons. Confidence VERIFIED.**

1. **Sidesteps the CLAUDE.md `-e` trap entirely.** The trap is `$(...)`/backticks/`$VAR` inside a
   DOUBLE-quoted inline script. Here the `-e` payload is wrapped in SINGLE quotes, so the outer shell
   performs no expansion inside it. Stronger still: the payload contains no `$`, no backtick, and no
   single quote at all, so there is nothing to expand even if the quoting were wrong. The only quotes
   inside are double quotes, which are inert within single quotes.
2. **Git Bash on Windows AND bash on ubuntu.** Already measured on both: this exact line runs in the
   `build` job (`ubuntu-24.04-arm`) and the integration matrix's `windows-11-arm` leg. `node` is
   guaranteed present after `setup-node`; `openssl` is not (that is the defect). Note the consumer
   snippets must carry `shell: bash` on Windows runners -- the default there is `pwsh`, which fails on
   `$GITHUB_ENV` and `$(...)` (`ci.yml:144-146`).
3. **Survives YAML embedding.** It sits inside a `run: |` literal block scalar, so YAML does no
   escaping or interpolation. It contains no `${{` sequence, so GitHub Actions expression
   interpolation never engages either.
4. `process.stdout.write` (not `console.log`) emits no trailing newline. Belt-and-braces --
   `$(...)` strips trailing newlines anyway -- but it keeps the value exact.

Replace `openssl rand -hex 32` (32 random bytes -> 64 hex chars) with this, which is byte-for-byte
equivalent in entropy and format. Port the `ci.yml:179-182` rationale comment along with it.

### Every copy site, per defect

`git grep` over all tracked files (excluding `.planning`). **Confidence VERIFIED.**

**Defect 1 -- `openssl` (5 sites; 4 consumer-facing):**

| File:line | Form | Consumer-facing? |
| --- | --- | --- |
| `README.md:39` | `token="$(openssl rand -hex 32)"` | YES -- quickstart |
| `docs/advanced.md:98` | `export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="$(openssl rand -hex 32)"` | YES -- `&` fallback |
| `docs/examples/minimal-ci.yml:35` | `token="$(openssl rand -hex 32)"` | YES -- copyable workflow |
| `start-cache-server/action.yml:15` | `#       token="$(openssl rand -hex 32)"` | YES -- header comment, the usage recipe |
| `.github/workflows/ci.yml:523` | `token="$(openssl rand -hex 32)"` | No -- internal `consumer-smoke` job |

`ci.yml:523` is worth fixing in the same PR even though it is internal: the job is `consumer-smoke`,
whose whole purpose is to demonstrate the consumer surface, and it directly contradicts the
"node, not openssl" reasoning `ci.yml:179` states 344 lines above it. It runs on `ubuntu-24.04-arm`
only, so it works today -- an inconsistency, not a live break. Flagging, not assuming: this is
arguably outside the locked consumer-doc scope, so it is the maintainer's call.

Note `docs/advanced.md:98` uses the `export VAR="$(...)"` form, not `token="$(...)"`. Do not
blind-replace by pattern -- it needs the substitution adapted to that line's shape.

**Defect 2 -- no readiness poll (0 consumer sites have one):** `git grep` for
`curl` / `Wait for` / `readiness` / `poll` across `README.md`, `docs/`, `start-cache-server/`,
`packages/github-cache/action.yml`, `ppe/` returns NO hits in any consumer doc. (Hits exist only in
`ppe/action.yml`, unrelated, and inside the vendored `start-cache-server/index.js` bundle.) So all four
consumer sites need the poll added, or -- lazier and probably better -- add it to **`README.md`** and
**`docs/examples/minimal-ci.yml`** (the two copy-paste surfaces) and have `docs/advanced.md` +
`start-cache-server/action.yml` point at it rather than duplicating a 25-line block four times. Port
the shape AND the reasoning from `.github/workflows/ci.yml:193-227` per decision A3.

**Defect 3 -- no `timeout-minutes` guidance (0 consumer sites):** every one of the 8 `timeout-minutes`
hits is in `.github/workflows/ci.yml`. No consumer doc mentions it. `README.md:84-86` warns about the
hang from OMITTING `cancel:`, which per A4 is a DIFFERENT thing -- keep them distinct in the prose
(`ci.yml:159-165` already spells out the distinction; reuse that wording).

### Guard interactions

**Will these edits trip a guard? Two real hazards, both avoidable. Confidence VERIFIED.**

1. **The `::add-mask::` guard -- `docs-adoption.spec.ts:87-113`.** For each of
   `['README.md', 'docs/advanced.md', 'docs/examples/minimal-ci.yml']`:
   ```ts
   if (!(doc.includes(TOKEN) && doc.includes('GITHUB_ENV'))) { return; }
   expect(doc).toContain('::add-mask::');
   ```
   (`TOKEN = 'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN'`.) All three files already contain
   `::add-mask::` (`README.md:40`, `docs/advanced.md:101`, `minimal-ci.yml:36`). **Answering the rk4
   hazard directly: adding the token near `GITHUB_ENV` without an `::add-mask::` WOULD trip this guard
   -- but only in those three files, and only if the mask line is deleted.** Keep the existing
   `::add-mask::` lines and you are clear. Note it is a whole-FILE presence check, not per-snippet, so
   it will NOT catch a second unmasked snippet added to a file that already masks elsewhere -- do not
   lean on it.
2. **GAP, not a trip: `start-cache-server/action.yml` is not in that list** yet its comment block
   (lines 14-17) contains the token, `GITHUB_ENV`, and `::add-mask::`. It is unguarded. Consider adding
   it to `DOCS_WITH_ENV_WRITE` while in there -- it is already a `test` input (`nx.json:50`), so the
   wiring is free.
3. **HAZARD: the dogfood-distinctness guard -- `docs-adoption.spec.ts:156-166`.**
   `expect(example).not.toContain('operation:')` and `expect(example).not.toMatch(/matrix:/)` on
   `docs/examples/minimal-ci.yml`. When porting comment text from `ci.yml`, do not carry over any
   `matrix:` or `operation:` token. Specifically `ci.yml:144-146` mentions "the integration matrix's
   windows-11-arm leg" -- that literal is safe (the regex requires the colon: `matrix:`), but rewriting
   it as `matrix:` would break the build. Rephrase rather than copy.
4. **`docs-adoption.spec.ts:143-154` LIFECYCLE_TOKENS** (`start-cache-server`, `background:`,
   `cancel:`) must remain present in `README.md` and `minimal-ci.yml`. Adding a poll step does not
   remove them. Safe.
5. **`public-surface.spec.ts:150-155` / `parseActionInputKeys`** scans
   `start-cache-server/action.yml` from `^inputs:$` to the next zero-indent line, skipping comments,
   and asserts the key set is exactly `['port']`. The openssl fix touches line 15, ABOVE `inputs:`
   (line 38) -- unaffected. Do not add an action input.
6. **`docs-trust.spec.ts`** reads only `docs/trust-and-security.md` and `docs/versioning.md`. Untouched
   by these edits. Safe.
7. **A6 is already satisfied for every doc copy site.** VERIFIED against `nx.json:52-61`: `README.md`,
   `docs/configuration.md`, `docs/advanced.md`, `docs/examples/minimal-ci.yml`,
   `docs/examples/README.md` and `start-cache-server/action.yml` are ALL already `test` inputs, so
   every edit above busts the `test` hash. The one file that needs NEW wiring is `nx.json` itself
   (Q3 precondition).

---

## Summary of actionable items

| # | Item | Confidence |
| --- | --- | --- |
| 1 | U1: keep the composite-`background:` claim as-is -- CORROBORATED, cite the workflow-syntax reference | VERIFIED |
| 2 | Flip A5's annotation wording: `06-RESEARCH.md:508`'s BOTH claims are corroborated, not unreproducible. Still do not propagate the 10-step limit to consumer docs | VERIFIED |
| 3 | Fix stale doc-lag comment at `ci.yml:128-132` -- the reference now documents the whole family | VERIFIED |
| 4 | `nx.json` `typecheck.inputs`: `"production"` -> `"default"`. The "re-add after the negation" option is dead | VERIFIED |
| 5 | `tsconfig.spec.json` needs no separate entry -- `default` covers it (and it was silently broken too) | VERIFIED |
| 6 | Add `"{workspaceRoot}/nx.json"` to `test.inputs` -- MANDATORY for any nx.json-reading guard | VERIFIED |
| 7 | Guard: new spec modelled on `pinned-deps.spec.ts`, using Nx's exported `expandSingleProjectInputs` + `filterUsingGlobPatterns`; assert the invariant, not the spelling | VERIFIED |
| 8 | openssl -> node at 4 consumer sites + optionally `ci.yml:523`; use the `ci.yml:183` one-liner verbatim | VERIFIED |
| 9 | Readiness poll + `timeout-minutes` guidance are absent from ALL consumer docs; port from `ci.yml:193-227` / `:159-165` | VERIFIED |
| 10 | Guard hazards: keep `::add-mask::` in the 3 listed docs; keep `matrix:` / `operation:` out of `minimal-ci.yml` | VERIFIED |
