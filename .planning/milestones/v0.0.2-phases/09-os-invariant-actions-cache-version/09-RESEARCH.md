# Phase 9 Research: OS-Invariant Actions-Cache Version

**Researched:** 2026-07-28
**Measured at:** `565f48f` (branch `gsd/v0.0.2-os-invariant-cross-os-sharing`), working tree clean
except a pre-existing `M .planning/config.json`
**Nx:** 23.1.0 (PARITY-06 discipline -- every Nx observation below carries this version)
**Requirement list used:** the AUTHORITATIVE ELEVEN -- PARITY-08, VER-01, VER-02, VER-03, VER-04,
VER-05, VER-06, VER-07, ROBUST-04, OBS-04, DOCS-08

Every number in this file was re-derived at `565f48f` in this session. Where a prior document's
number is quoted it is labelled as such.

---

## Headline results

| # | Result | Consequence |
|---|---|---|
| 1 | **U-01 CLOSES.** Nx 23.1.0 tolerates a foreign `.tar` in `.nx/cache` on every axis measured. | D-01 stands. `.nx/cache/nx-github-cache-<hash>.tar` is the literal. |
| 2 | **NEW, load-bearing: under `nx test` the cwd is the PROJECT root, not the workspace root.** `process.cwd()` = `<repo>\packages\github-cache`; `existsSync(cwd/nx.json)` = **false**. | VER-04's guard as written in D-07 **throws in 16 existing spec constructions**. VER-04 and its spec accommodation must be ONE commit. Not a BLOCKER -- `process.chdir()` works in the vitest pool (measured). |
| 3 | **NEW: `packages/github-cache/.nx/cache/` is NOT gitignored** (`git check-ignore` exit 1) while the root path IS (`.gitignore:41`). | Under `nx test` the new literal + VER-07's `mkdirSync` create an untracked, un-ignored directory. It does NOT perturb Nx hashes (measured, with a positive control), so it is hygiene, not correctness. |
| 4 | **NEW: `action/index.ts` has ONE `dogfoodBody` call, not two.** | D-19 cannot be implemented by editing two arguments. `:224` sits BEFORE the seed/verify branch; `:276` is `received.equals(body)`, a reuse. The call must be restructured. |
| 5 | **NEW: `tools/eslint-rules/` does not exist.** | The research prompt's Q4 premise is false. An AST rule means creating the directory and a local plugin import -- a much bigger change than a spec. |
| 6 | **NEW: an ESLint `no-restricted-syntax` object for `cache-archive-path.ts` would REDDEN a Phase 7 guard.** `lint-scope-drift.spec.ts:149-164` asserts exactly ONE config object configures that rule. | Q4 answer is a spec, not a lint rule. |
| 7 | **NEW: ROBUST-04's "four `ci.yml` sidecar jobs" is a MISCOUNT -- there are FIVE sites.** | CONTEXT.md fact #10 (five) is right; REQUIREMENTS.md ROBUST-04 and ROADMAP SC1d are wrong. Same class as Phase 7's CORR-05 three-vs-four. |
| 8 | **NEW: `ci.yml` pushes are filtered to `main` (`:3-7`).** | `dogfood-seed`/`dogfood-verify`/`publish`/`publish-verify` are all `if: github.event_name == 'push'`, so **VER-06 and OBS-04 cannot be observed on this branch or on a PR at all.** Both are merge-to-`main` closes. |
| 9 | **NEW: the `@actions/cache` bump checklist VER-05/D-13 names DOES NOT EXIST** (zero hits for "checklist" anywhere in `docs/`, `packages/`, root markdown). | The planner must create a destination. Recommendation below. |
| 10 | **All ten "already measured" facts VERIFIED. None wrong.** Fact #8's line numbers needed re-derivation; the corrected table is in Q10. | D-31 needs three small corrections (Q10). |

No BLOCKER. Item 2 is the one that would have become a mid-execution surprise.

---

## Q1 -- Does Nx 23.1.0 tolerate a foreign `.tar` in `.nx/cache`? VERDICT: YES. U-01 CLOSES.

### Method

A 5,242,880-byte zero-filled file was written to `.nx/cache/nx-github-cache-abc123.tar` -- the
exact name and directory D-01 proposes, at a realistic multi-megabyte size. Two baseline
`npx nx run-many -t build` runs were taken first, then two with the file present.

### Results

| Run | Foreign `.tar` | `@op-nx/github-cache:build` hash | Cache status |
|---|---|---|---|
| A1 | absent | `17776792307406644378` | local-cache-hit |
| A2 | absent | `17776792307406644378` | local-cache-hit |
| B1 | **present** | `17776792307406644378` | local-cache-hit |
| B2 | **present** | `17776792307406644378` | local-cache-hit |

- **(a) Survival: YES.** After both runs the file was still 5,242,880 bytes with an unchanged
  content digest (sha256 prefix `c036cbb7553a909f`). Nothing truncated, moved or relinked it.
- **(b) Hash movement: NONE.** Byte-identical across all four runs. The file is invisible to the
  hasher.
- **(c) Warning: NONE**, including under `CI=true`, which is where the only relevant Nx warning
  lives (see below).

### Why, mechanically -- four independent confirmations

1. **Nx's own file map excludes `.nx` at any depth.** `.nx/workspace-data/file-map.json` holds 485
   files at this commit and **zero** entries whose path contains `.nx/`. Nx's JS ignore object is
   built from `.gitignore` + `.nxignore` (`node_modules/nx/dist/src/utils/ignore.js:9-14`), and the
   native walker additionally never surfaces `.nx`. This is what makes (b) true rather than lucky.

2. **The CI-only integrity check tolerates it.** `DbCache.init()` calls `assertCacheIsValid()`
   (`node_modules/nx/dist/src/tasks-runner/cache.js:68`), which is gated on `isCI()` at `:287` and
   emits exactly the warning U-01 feared:

   > `Nx found unrecognized artifacts in the cache directory and will not be able to use them.`
   > `Nx can only restore artifacts it has metadata about.`
   > `https://nx.dev/troubleshooting/unknown-local-cache`

   With the foreign `.tar` present, `CI=true npx nx run-many -t build` printed **no such warning**.
   Probing the predicate directly (constructing `DbCache` and calling the native method)
   returned `checkCacheFsInSync() === true`, so the silence is the predicate's verdict, not a code
   path that never ran. Note `assertCacheIsValid` is skipped entirely when a remote cache is
   configured (`cache.js:66-69`); this repo configures none, so on CI the check IS live -- and it
   passes.

3. **The foreign file does not consume the eviction budget.** `NxCache` takes a `maxCacheSize`
   (`native/index.d.ts:112`), resolved from `NX_MAX_CACHE_SIZE` / `nxJson.maxCacheSize` /
   `getDefaultMaxCacheSize()` (`cache.js:548-553`), and `removeOldCacheRecords()` runs at the end of
   every orchestrated run (`task-orchestrator.js:147`). Measured with the 5,242,880-byte tar
   present: `getCacheSize()` returned **2,974,242** bytes, and `nx report` printed
   `Cache Usage: 2.84 MB / 28.54 GB`. The accounting is metadata-driven, so a multi-hundred-megabyte
   transient archive cannot push Nx into evicting its own entries. This is the strongest of the four
   confirmations, because it is quantitative and it rules out the failure mode that would have been
   slowest to attribute.

4. **`nx reset` still clears it.** `reset.js:133-135` `cleanupCacheEntries()` does
   `rmSync(cacheDir, { recursive: true, force: true })` on the whole directory. So the archive is
   cleaned by the same command VER-07/TEST-10 already mandate -- and D-36's ordering (reset FIRST,
   then start the sidecar) is confirmed mechanically: resetting under a running sidecar deletes the
   directory the next `put()`'s `writeFile` needs, which ENOENTs into a 500.

### What Nx itself writes there (inspected)

Top level of `.nx/cache` at this commit: 24 per-hash directories named with decimal 64-bit hashes,
`run.json` (last run's task list with hashes and `cacheStatus`), and `terminalOutputs/`. Nx also
uses `.nx/workspace-data/` (a sibling, separately gitignored at `.gitignore:42`) for the graph db,
`file-map.json`, `nx_files.nxt` and the `tsc-*.hash` / `vitest-*.hash` / `eslint-*.hash` inference
caches. The archive's flat `nx-github-cache-<hash>.tar` name collides with none of these shapes.

### Honest limitation of clause (c)

**I could not force `checkCacheFsInSync()` to return `false`,** so the "no warning" clause has no
proven RED. Two adversarial shapes were tried and both were also tolerated: a directory named
`99999999999999999999` (20 digits, above u64 max) containing `outputs.tar`, and a directory named
`1234567890123456789` (in u64 range) containing `outputs/`, `code` and `terminalOutput`. The
predicate is native Rust in the `.node` addon and not readable. So clause (c) rests on an absence
with an unproven detector.

That is why confirmation 3 matters: `getCacheSize()`'s exclusion of the file is a POSITIVE,
quantitative measurement of the same underlying property (Nx accounts only for what its DB knows),
and it is the property the eviction risk actually depends on. Clauses (a) and (b) each have their
own positive control -- (a) by digest, (b) by the `zz-stray-probe.txt` control in Q3 below, which
DID move the hash and so proves the instrument can fire.

**Recommendation:** D-01 stands. Take the flat `.nx/cache/nx-github-cache-<hash>.tar` literal. Do
not re-open D2-04. Record the Nx version (23.1.0) beside the result in the comment lock, so a future
Nx major is a prompt to re-measure rather than an assumption carried forward.

---

## Q2 -- Is the dependency-free `existsSync(join(cwd,'nx.json'))` probe sound in the bundle?

### The bundling question: no wrinkle, with ONE hard constraint

`esbuild.action.mjs` runs `platform: 'node'`, `format: 'cjs'`, so node builtins are left external and
emitted as plain `require(...)`. Verified in the committed `start-cache-server/index.js` (68,938
lines): `require("node:path")` and `require("node:url")` in the banner at `:1`,
`require("node:fs/promises")` at `:29544`, `require("node:os")` at `:30476`,
`require("node:fs")` at `:63031`, `require("node:child_process")` at `:68348`. `existsSync` already
appears twice in the bundle. Adding `existsSync` from `node:fs` and `join`/`resolve` from
`node:path` therefore bundles with no new mechanism and no new dependency -- exactly what VER-04
needs, since `uses:` resolves the bundle from the git ref with no `npm ci`.

**HARD CONSTRAINT (new finding): the guard must NOT use `import.meta.url`.**
`esbuild.action.mjs:38` sets `define: { 'import.meta.url': '__actionImportMetaUrl' }`, and the banner
at `:28-29` defines that shim as a file URL for a **never-emitted sibling `index.mjs`** inside
`start-cache-server/`. The shim is deliberately wrong-on-purpose -- `serve.ts:197`'s
`isEntrypoint(import.meta.url)` guard depends on it being false. So any attempt to anchor the
workspace root off `import.meta.url` (the idiom `nx-target-inputs.spec.ts:59` and
`docs-trust.spec.ts` use) silently resolves to the bundle directory inside the bundle and to the
source directory outside it -- two different answers, neither the workspace root.

`process.cwd()` is therefore the only sound anchor. That is what D-07 already specifies; this
records WHY the alternative is not merely worse but broken.

### What `process.cwd()` is for a JS action on a runner

For a `node24` JS action the runner spawns `node <main>` with the working directory set to
`GITHUB_WORKSPACE`. Nothing in `ci.yml` sets `working-directory` on any step, and
`.planning/research/v0.0.2/PROBE-RESULTS.md` Q2 measured the identity live on `windows-11-arm`:

```
cwd              = C:\a\github-cache\github-cache
GITHUB_WORKSPACE = C:\a\github-cache\github-cache
resolved + case-normalised identity: HOLDS
```

**Is it ALWAYS `GITHUB_WORKSPACE`? No -- and that is precisely why VER-04 asserts the conjunction
rather than trusting it.** Three documented ways the two diverge, none of which this repo currently
triggers: a `defaults.run.working-directory` or step-level `working-directory` (which affects `run:`
steps, not JS actions), a container job whose volume mapping relocates the workspace, and a
self-hosted runner where the workspace path is symlinked. The requirement's framing is correct: the
identity holds today, nothing defends it, and the failure is a permanent silent all-MISS.

One addition the plan should carry: `GITHUB_WORKSPACE` on the Windows leg is a backslash path
(`C:\a\...`) while `process.cwd()` is too, so `resolve()` on both plus a case fold is the right
comparison -- and `resolve` in the GUARD is a legitimate `node:path` use, because it compares two
anchors rather than BUILDING the archive path. VER-01's ban is on the builder (D-03 keeps them
separate). The plan should comment-lock that distinction at the guard, or a later reader applying
VER-01 literally will delete the comparison.

### The cwd probe's real soundness problem is not the bundle -- see Q3

`existsSync(join(cwd, 'nx.json'))` is sound *in the bundle*. It is UNSOUND *in the unit specs*,
because the cwd there is the project root. That is Q3.

---

## Q3 -- Does the construction-time guard + `mkdirSync` break `selectBackend`/`serve()`/specs?

### `selectBackend` and `serve()`: unaffected

`selectBackend` (`packages/github-cache/src/lib/select-backend.ts:29-60`) calls
`createActionsCacheBackend()` at `:59` with no arguments and stays synchronous; `:36-37` comment-locks
that this "keeps Function.length at 0 and the serve.ts call site synchronous (TRUST-05)".
`serve()` calls `selectBackend(process.env)` at `serve.ts:90`. `mkdirSync` and a synchronous
`existsSync`/`resolve` guard preserve both properties -- `createActionsCacheBackend` stays
zero-parameter and non-async, `selectBackend.length` stays 0, and `serve()` needs no change.

`public-surface.spec.ts` is unaffected: `createActionsCacheBackend` is not in the barrel
(`src/index.ts` exports `createCacheServer` plus five types), and PARITY-07 forbids new exports
anyway. No new env knob, action input or export is introduced by VER-04 or VER-07.

`publishMirror` (`publish/publish-mirror.ts:175`) also calls `createActionsCacheBackend()`, so the
guard fires on the publish path too -- which is D-08's LOUD leg and is intended.

### MEASURED BREAKAGE: the unit-runner cwd is the PROJECT root

The merged `test` target configuration carries `options.cwd: "packages/github-cache"` (read via
`nx show project @op-nx/github-cache --json`, i.e. the merged config, not `nx.json`), and
`vitest.config.mts` sets `root: __dirname`. A temporary probe spec run under
`npx nx run @op-nx/github-cache:test --skip-nx-cache` (then deleted; tree verified clean) reported:

```
PROBE cwd=D:\projects\github\op-nx\github-cache\packages\github-cache
      nxJsonAtCwd=false
      chdir=OK (moved to D:\projects\github\op-nx\github-cache\packages)
      pool=5 isWorkerThread=true
```

Two consequences:

1. **`existsSync(join(cwd,'nx.json'))` is FALSE in every unit spec.** A naive VER-04 guard throws
   at construction. `process.chdir()` DOES work in this pool, so the fix is available.
2. **`cacheArchivePath(hash)` resolves to `packages/github-cache/.nx/cache/...` under `nx test`.**

### Every spec that needs updating

| Spec | Why | Severity |
|---|---|---|
| `src/backend/actions-cache-backend.spec.ts` | Constructs the REAL backend **15 times** (`:40,52,63,74,85,106,116,127,138,147,156,165,255,289,319,343`) and touches the REAL filesystem at `cacheArchivePath(HASH)`: `writeFile` at `:39` and the `afterEach` `rm` at `:33`. Note `:39`'s `writeFile` runs **BEFORE** the `:40` construction, so it ENOENTs on a fresh tree even after VER-07's mkdir-at-construction. | **must change** |
| `src/serve.spec.ts` | `:401` `vi.mocked(selectBackend).mockReturnValue(createActionsCacheBackend())` constructs the real backend, then drives two real same-hash PUTs through it (real `writeFile`/`rm`). `@actions/cache` is mocked at `:25`, the backend is not. | **must change** |
| `src/lib/cache-archive-path.spec.ts` | REPLACED wholesale by VER-02/D-04, and CORR-05 site 1 plus its `:6` disable leave with it. | **replaced** |
| `src/lib/dogfood-body.spec.ts` | Three single-argument calls (`:6,10,14`) against a signature gaining a required second parameter. | **must change** |
| `src/action/index.spec.ts` | Mocks `../serve.js` (`:30`), so it never constructs the backend -- safe on the guard. But it exercises `run()`'s verify branch (`:180`, `:199`), whose expected body becomes a LINUX-produced one under D-19. **Review required, may not need an edit.** | review |
| `src/nx-target-inputs.spec.ts` | PARITY-08's assertions + comment lock (Q8). | **must change** |
| `src/publish/publish-mirror.spec.ts` | `vi.mock('../backend/actions-cache-backend.js')` at `:21-26` replaces the factory entirely, so the guard never runs. SAFE on VER-04. It DOES assert the OBS-04 message at `:426,438,486` (Q9). | change for OBS-04 only |
| `src/lib/select-backend.spec.ts` | Mocks `@actions/cache` (`:16`) but NOT the backend module, so it reaches the real factory on the write-trusted branch. **Must be checked against the guard.** | review/likely change |

### Recommended shape

Give `actions-cache-backend.spec.ts` and `serve.spec.ts` a `beforeAll`/`afterAll` pair that
`process.chdir()`s to the workspace root (resolved from `import.meta.url`, which is legitimate in a
spec -- the esbuild `define` only applies to the bundle) and restores it after. This is a single
mechanism that fixes BOTH problems at once:

- the guard's first conjunct passes, because `nx.json` is then at the cwd;
- the archive lands in the ROOT `.nx/cache`, which IS gitignored (`.gitignore:41`) and IS
  Nx-invisible, so no stray directory appears under `packages/github-cache/`;
- the second conjunct passes because `GITHUB_WORKSPACE` is unset locally, and on CI the `test` job's
  `GITHUB_WORKSPACE` IS the workspace root, so the chdir makes them agree rather than diverge.

Two notes for the plan. First, `process.chdir()` is process-global and the vitest pool runs multiple
spec files per worker, so the chdir must be symmetrical and scoped -- a leaked chdir would silently
change what a later spec's relative reads resolve against. Second, `actions-cache-backend.spec.ts`
must also ensure the directory exists before `:39`'s pre-write; the cheapest correct form is to
construct the backend (which mkdirs) before the pre-write, or add an explicit `mkdirSync` in the same
hook as the chdir. The second is clearer, because it does not make one test's setup depend on the
side effect of the code under test.

### The stray-directory hazard: real but NOT a hash hazard (measured)

`git check-ignore -v packages/github-cache/.nx/cache/nx-github-cache-abc123.tar` exits **1** (not
ignored), while the root path matches `.gitignore:41`. Gitignore patterns containing an interior
slash are anchored to the file's own directory, so `.nx/cache` covers only `<root>/.nx/cache`.

VER-07's own comment predicts a self-referential task-hash perturbation from putting a transient
multi-megabyte file into Nx's file map. **Measured: it does not materialise**, with a positive
control:

| Probe | `@op-nx/github-cache:test` hash | Status |
|---|---|---|
| baseline | `13772310617450523374` | local-cache-hit |
| `packages/github-cache/.nx/cache/nx-github-cache-abc123.tar` present | `13772310617450523374` | local-cache-hit |
| **positive control:** `packages/github-cache/zz-stray-probe.txt` present | `17748502672986819151` | **cache-miss** |
| after cleanup | `13772310617450523374` | local-cache-hit |

The control moved the hash; the `.nx` path did not. So `.nx` is exempt from Nx's file map at any
depth, and the residual cost of a project-root `.nx/cache/` is only that it shows in `git status`.
Prettier is unaffected (`.tar` is not a Prettier target, and `.prettierignore` anchors `/.nx/cache`
at the root anyway).

The chdir recommendation makes the stray directory not appear at all, which is why it is preferred
over the alternative of broadening `.gitignore` to `**/.nx/cache` -- broadening would hide the
directory rather than avoid it, and it would weaken the exact `.gitignore` fact VER-07's comment
lock is built on.

---

## Q4 -- How to assert, from one OS, that a module names no path/os builder

### RECOMMENDATION: a spec-level source scan, NOT an ESLint rule. Four reasons.

1. **VER-02's own words require a spec** -- "The two version-determining inputs are pinned **by
   spec**". An ESLint rule would satisfy the intent and not the text, and coverage is audited against
   REQUIREMENTS.md's words (D-28).

2. **An ESLint `no-restricted-syntax` object would REDDEN a shipped Phase 7 guard.**
   `lint-scope-drift.spec.ts:149-164` `banConfigObject()` filters `eslint.config.mjs` for objects
   configuring `no-restricted-syntax` and asserts **exactly ONE**, with the message "expected exactly
   ONE eslint.config.mjs object to configure no-restricted-syntax" -- deliberately, because two
   objects mean the later silently overrides the earlier. Adding a second one to reach
   `cache-archive-path.ts` means editing that guard, i.e. weakening a LINT-02 control to add a
   redundant mechanism.

3. **The forbidden token set is not expressible in the existing shared lists.** `eslint.config.mjs:83`
   `BANNED_PATH_ACCESSORS = ['default','sep','delimiter','win32','posix']`. `join`, `resolve` and
   `normalize` are deliberately NOT banned -- `:274-276` comment-locks that
   `import { basename, dirname } from 'node:path'` stays legitimate. Adding the three builders to
   that shared list applies them to every spec in the repo, which is a scope change beyond this phase
   (and `hash-parity/assert-parity.ts:2` plus `cache-archive-path.spec.ts:9` show the repo uses those
   names legitimately). A narrow new object scoped to one production file also crosses a scope
   boundary the existing block does not: the LINT-02 object's `files` glob (`:263`) covers spec files
   ONLY, so `cache-archive-path.ts` is outside every current rule's reach.

4. **`tools/eslint-rules/` DOES NOT EXIST.** The prompt's premise is false.
   `nx-target-inputs.spec.ts:506-514` says so in as many words -- "The custom rule directory does not
   exist today. The entry is still declared rather than deferred" -- and asserts the input is
   pre-wired for `lint` (`:511`) and for `test` (`:526`) precisely so that the day it appears its
   authoring commit busts both hashes. `git ls-files tools` returns nothing. So an AST rule means
   creating the directory, authoring a plugin, and importing it into the root config -- which
   `eslint.config.mjs:4-6` treats as a deliberate LINT-04-sensitive step.

### The technique that survives Phase 8's trap

Phase 8's rule: a grep-verifiable ABSENCE claim must not spell the token it forbids, anywhere in the
file. Concrete technique, in order of preference:

**Single-character character classes in the regex source.** `/\bj[o]in\b/`, `/\bre[s]olve\b/`,
`/n[o]rmalize/`, `/\bs[e]p\b/`, `/tm[p]dir/`, `/n[o]de:path/`, `/n[o]de:os/`. `[o]` matches `o`, so
the regex behaves identically -- but the spec's SOURCE never contains the literal token, so a
repo-wide `git grep "join"` still returns only real occurrences. It is one bracket pair per needle,
it stays readable at a glance, and it degrades safely (a reader who "tidies" `[o]` to `o` breaks the
grep property but not the assertion, which is the harmless direction). Comment-lock WHY the brackets
are there, and comment-lock it without spelling the tokens either.

Rejected alternatives: `String.fromCharCode(...)` and base64 needles are unreadable, so the next
reader cannot tell what is being forbidden without executing it. `['jo','in'].join('')` reads well
but a formatter or a "simplify" pass collapses it, and it also spells the concatenation helper.

**Strip comments before scanning -- this is the half that is easy to miss.** The implementation's own
comment lock will need to say the path is not built with the banned builders, and a naive source scan
then reddens on `cache-archive-path.ts`'s own prose. The repo already has this exact pattern three
times: `lint-scope-drift.spec.ts:233-238` `strippedConfigSource` (drop lines whose trim starts with
`//`), plus the same idiom in `cleanup-workflow.spec.ts:16-20` and `ppe-action.spec.ts:20-25`, whose
headers name the live trap ("a config whose own prose quotes the value being asserted makes a naive
match pass even after the REAL value has drifted"). Reuse it. That leaves the implementation free to
carry a readable comment lock and removes the need to police its prose forever.

**Non-vacuity control, mandatory.** A broken regex passes silently. Assert the scanner FIRES on a
fixture string that contains the forbidden shape (built with the same bracket trick), in the same
spec. This is the `filterUsingGlobPatterns`-returns-everything lesson from
`nx-target-inputs.spec.ts:150-161`, one mechanism over.

**Scope the scan to two things, not one.** Clause 2a: the comment-stripped source contains none of
the builder names. Clause 2b: the module's import list is exactly `{ Hash }` type-only from
`./cache-key.js` and nothing else -- an exact assertion, not a `not.toContain`, so a NEW import of
any kind fails rather than only the two currently-imagined ones. 2b is what makes the claim robust
against a builder reached through a module the ban list never anticipated.

---

## Q5 -- Counting the `@actions/cache` call sites in `actions-cache-backend.ts`

### What each approach misses

| Approach | Catches | Misses |
|---|---|---|
| Mock-call-count / per-call argument arrays | The positional index of the flag, exactly, at every site the specs EXECUTE. Already half-built: `actions-cache-backend.spec.ts:334-356` compares `restoreCache.mock.calls[0][0]` and `saveCache.mock.calls[0][0]` to `cacheArchivePath(HASH)`. | A fourth site on a branch no spec reaches. It is invisible: the call count stays at what the exercised paths produce. |
| Source-level count | A fourth site anywhere in the module, exercised or not. | The ARGUMENT SHAPE. A source count is satisfied by three calls passing the flag at the wrong index -- or not at all. |
| `no-restricted-syntax` | Nothing useful here. | **It cannot express a count at all.** It is a per-node visitor: it can BAN a shape, not assert "exactly three of it". |

So VER-03's "a spec asserts the argument list of each call AND the call count, so a fourth site added
later fails" genuinely needs BOTH clauses, exactly as D-11 says. Neither is optional and neither
subsumes the other.

### Concrete recommendation

**Clause 1 -- per-call exact argument arrays, in `actions-cache-backend.spec.ts`.** Deep-equal on
`restoreCache.mock.calls` and `saveCache.mock.calls` as whole arrays, so the positional index is
PINNED rather than assumed:

- `restoreCache` read (`:46`): `[[path], key, undefined_or_[], undefined_or_{}, true]` -- the flag is
  the **5th** positional (`cache.d.ts:58`).
- `saveCache` write (`:101`): `[[path], key, options?, true]` -- the flag is the **4th**
  (`cache.d.ts:68`). Upstream's JSDoc at `:64-65` documents `enableCrossOsArchive` BEFORE `options`,
  which is the wrong order -- **VERIFIED at HEAD, D-09 is correct.**
- `restoreCache` `lookupOnly` probe (`:107`): `[[path], key, [], { lookupOnly: true }, true]`.

Assert `toHaveBeenCalledTimes` for each function in the test that exercises the -1 path, since that
is the only path with two `restoreCache` calls -- and it is the path D-10 says MUST carry the flag,
because probing at a different cache version than the save would report "absent" for a present entry
and turn every Windows write into a spurious 409.

**Clause 2 -- source-level count.** Today the module does `import * as cache from '@actions/cache'`
(`:2`) and reaches it only as `cache.restoreCache` / `cache.saveCache`. So scan the comment-stripped
source for the namespace member accesses and assert the ordered multiset is exactly
`['restoreCache', 'saveCache', 'restoreCache']` (source order pins that the probe is a
`restoreCache`, which clause 1 alone would not distinguish from a second `saveCache`).

**Close clause 2's one evasion.** A future `import { saveCache } from '@actions/cache'` reaches the
library without a `cache.` prefix and would evade the member scan. Add a third, one-line assertion
that the module's `@actions/cache` import is the NAMESPACE form and that there is exactly one such
import. Then "reaches `@actions/cache` at exactly three places" is true of the module, not just of
one spelling.

**Placement.** Clause 1 belongs in `actions-cache-backend.spec.ts`, which already owns the mock
harness. Clause 2 also belongs there rather than in a cross-cutting `src/*.spec.ts` guard:
`.planning/codebase/TESTING.md:51-56` reserves the package-source root for facts that span multiple
files, and this fact is about ONE module. Keeping both clauses in one file also means a reader sees
immediately that neither is sufficient alone.

**Assert on content, never on an exit code or a bare count a deletion satisfies (Phase 8 D-23).** A
count assertion of `=== 3` is satisfied by a module that deleted `saveCache` and added two probes,
which is why the multiset form above pins the identities too.

---

## Q6 -- Reproducing `getCompressionMethod`'s observable behaviour

### Upstream, re-read at HEAD (`node_modules/@actions/cache/lib/internal/cacheUtils.js:100-136`)

```
getVersion(app, additionalArgs = []):
  versionOutput = ''
  additionalArgs.push('--version')          // MUTATES the caller's array
  try { await exec.exec(app, additionalArgs, {
          ignoreReturnCode: true,           // exit code never inspected
          silent: true,
          listeners: { stdout: d => versionOutput += d.toString(),
                       stderr: d => versionOutput += d.toString() } }) }
  catch (err) { core.debug(err.message) }    // spawn fault swallowed
  return versionOutput.trim()

getCompressionMethod():
  versionOutput = await getVersion('zstd', ['--quiet'])   // -> `zstd --quiet --version`
  version = semver.clean(versionOutput)                   // COMPUTED AND NOT USED
  return versionOutput === '' ? Gzip : ZstdWithoutLong
```

Enum string values (`internal/constants.js:6-13`): `gzip`, `zstd-without-long`, `zstd`.
`getCacheVersion` (`:157-172`) pushes the compression method UNCONDITIONALLY at `:163`, before the
`process.platform === 'win32' && !enableCrossOsArchive` `windows-only` push at `:166-168`. **All of
D-13 and D-29 VERIFIED; no correction needed.**

The observable contract reduces to exactly one bit: **is the combined trimmed output empty?** It is
empty iff `zstd` produced nothing on either stream -- including because it does not exist. Every
other detail (interleaving order, the semver, the exit code) is unobservable downstream.

### Which node primitive reproduces it -- RECOMMENDATION: `spawnSync`

| Primitive | Verdict |
|---|---|
| `spawnSync(file, args, { shell: false, windowsHide: true, encoding: 'utf8' })` | **RECOMMENDED.** The exit code is structurally never consulted -- `status` is simply not read -- which is stronger than "we chose not to read it" and survives a later tidy. No promise to leave unsettled, no listener wiring, no `'error'` event to forget. On ENOENT it returns `{ error, status: null, stdout: null, stderr: null }`, so `(stdout ?? '') + (stderr ?? '')` yields `''` and selects gzip -- byte-for-byte the behaviour of upstream's caught throw. It also makes the function SYNCHRONOUS, so the spec needs no async plumbing and the call site needs no await. |
| `spawn` + accumulate + resolve on `'close'` regardless of code, `''` on `'error'` | Correct, and what D-14 names. Costs ~15 lines of listener wiring for no observable gain, and adds one real failure mode `spawnSync` cannot have: a promise that never settles if a handler is missed. |
| `execFile` (callback form) | Workable but a trap: on non-zero exit `err` is set AND `stdout`/`stderr` are still delivered, so the correct implementation must deliberately ignore `err`. Also imposes a 1 MiB `maxBuffer` default that upstream does not have. |
| `promisify(execFile)` | **ACTIVELY WRONG. Do not use.** It REJECTS on non-zero exit and the output is only reachable as `error.stdout`/`error.stderr`. The natural `.catch(() => '')` then reports `gzip` for a broken-but-present zstd -- the exact inversion VER-05 exists to forbid, arrived at by writing the idiomatic thing. |

Deviation to record: D-14's wording says "use `spawn` directly". Its load-bearing content is (i) do
NOT reuse `runHelper` and (ii) borrow `shell: false` + `windowsHide: true`. Both are preserved by
`spawnSync`. Recommend `spawnSync` and comment-lock the reason, flagging the wording deviation
explicitly rather than silently.

### Why `runHelper` stays unreused -- confirmed against the source

`local-context.ts:42-118` is wrong on both axes VER-05 needs, and both are comment-locked as
deliberate:

- **stdout only.** `:85-86`: "Deliberately no stderr listener ... stderr is localized and
  credential-adjacent." `zstd --version` writes to stdout on current builds, but upstream captures
  BOTH, so a build that writes to stderr would make `runHelper` report `gzip` where `@actions/cache`
  reported `zstd`.
- **exit-0 only.** `:94-104` resolves `undefined` for any non-zero code. That is the precise
  broken-but-present-zstd case VER-05 names.
- It also carries `timeout: HELPER_TIMEOUT_MS` (`:55`) and `killSignal: 'SIGKILL'` (`:64`), which
  D-15 rejects for VER-05: a timeout would make the reported value diverge from what the library
  computed. D-15's reasoning holds -- `@actions/cache` calls `getCompressionMethod()` itself on every
  restore and save in the same job, so a hanging `zstd` has already wedged the publish before this
  probe runs, and the job's `timeout-minutes` is the backstop either way.

### Surfacing it (D-16) -- premise VERIFIED

`core.summary.write()` appends by default: `@actions/core/lib/summary.js:69-77` picks
`appendFile` unless `options.overwrite` is truthy. So a second `core.summary.write()` after
`writeCountSummary` (`lib/summary.ts:13-25`) appends rather than clobbers. D-16's mechanism is sound,
and `writeCountSummary`'s `count`-headed column genuinely cannot carry `zstd-without-long`.

### The bump-checklist destination DOES NOT EXIST

VER-05 and D-13 both say to add "re-read `getCompressionMethod`; VER-05 duplicates it" to the
`@actions/cache` bump checklist. **There is no such checklist** -- zero hits for `checklist` across
`docs/`, `packages/`, `README.md`, `CONTRIBUTING.md`. Recommendation: put the note in
`pinned-deps.spec.ts`'s `@actions/cache` doc block (`:4-13`). That block is already the de-facto home
for "why this specifier is pinned and what a bump risks", it names the same silent-MISS mechanism,
and it is the one file a bumper must touch anyway because it asserts the exact specifier. Creating a
new `docs/` checklist for one line would be a document nobody reads at the moment it matters.

---

## Q7 -- VER-06's two-leg `dogfood-verify`

### (a) Does `windows-11-arm` have what `packages/github-cache` needs? YES -- already proven in-repo.

The dogfood action is `packages/github-cache/action.yml`: `using: 'node24'`,
`main: 'dist/action/index.js'`, so a consumer job must run `npm ci` + `npm run build` first. All
three already run on `windows-11-arm` today, in the `publish` job: `runs-on: ${{ matrix.os }}`
(`ci.yml:975`) over `[ubuntu-24.04-arm, windows-11-arm]` (`:974`), with `npm ci` and
`npm run build` at `:990-991` and `uses: ./packages/github-cache` at `:1039` (`operation: seed`) and
`:1045` (`operation: publish`). So the Windows leg of `dogfood-verify` reuses a combination with a
live track record; nothing new is being asked of the runner.

Supporting evidence on the same runner: `integration` (`:414`) and `hash-parity` (`:578`) are both
two-leg matrices including `windows-11-arm`, and `integration` runs the committed sidecar bundle
there (`:432`). `PROBE-RESULTS.md` Q1 additionally measured `zstd` v1.5.7 (at `C:\tools\zstd`, NOT
bundled by Git for Windows) and GNU tar 1.35 present on that image.

One thing the plan must NOT assume: the Windows verify leg will read a LINUX-produced archive
through `enableCrossOsArchive`, which requires zstd/tar on the Windows side to extract what Linux
wrote. That is the very thing VER-06 exists to prove, so a failure there is a real result, not a
setup problem -- but it means the job needs a diagnostic message good enough to distinguish "cross-OS
restore is broken" from "the archive version still differs".

### (b) `dogfoodBody` call sites -- and a CORRECTION to CONTEXT.md

`git grep dogfoodBody` over all tracked files returns exactly **two runtime call sites and one spec**:

| Site | Current shape | What must change |
|---|---|---|
| `action/index.ts:224` | `const body = dogfoodBody(hash);` | **This is the ONLY call in the file.** |
| `roundtrip/read-back.ts:62` | `if (!result.bytes.equals(dogfoodBody(hash)))` | Needs the producing OS of the asset it reads. |
| `lib/dogfood-body.spec.ts:6,10,14` | three single-argument calls | all three |

**CONTEXT.md's canonical-refs line -- "`run()`'s seed/verify `dogfoodBody` calls (`:224`, `:276`)"
-- is WRONG.** `:276` is `if (!received.equals(body))`, a reuse of the buffer produced at `:224`.
And `:224` sits BEFORE the `if (operation === 'seed')` branch at `:233` and the
`if (operation === 'verify')` branch at `:253`.

So D-19 ("the seed leg passes `cachePlatform()`, the verify leg asserts against the LITERAL
`'linux'`") **cannot be implemented by adding an argument at two sites.** The single `:224` call must
be restructured -- either moved into each branch, or the `producerOs` computed conditionally above
it. Moving the call into each branch is the better shape: it makes the asymmetry visible at the point
where it matters, keeps the two legs' arguments physically apart so a later edit cannot accidentally
unify them, and means the literal `'linux'` sits inside the verify branch where its comment lock
belongs. Computing a conditional above the branch reintroduces exactly the one-expression coupling
that makes the vacuity trap reachable.

For `read-back.ts:62`, the asset being read is this leg's OWN-OS asset (`ci.yml:1059`: "Each OS leg
reads back ONLY its own-OS asset"), and the producer is the same leg's `publish` seed. So the correct
argument is `cachePlatform()` -- an ambient read, legitimate here because `read-back.ts` is a bin and
LINT-02's ban is scoped to spec files (`eslint.config.mjs:263`). It already reads `process.platform`
at `:52`, `:64` and `:71`.

### (c) Anything else coupled to the single-argument shape? Only documentation.

`dogfoodBody` is NOT in the public barrel (`src/index.ts` exports `createCacheServer` plus five
types), so `public-surface.spec.ts` and PARITY-07 are unaffected. The only other reference is
`.planning/codebase/TESTING.md:253`, prose describing the byte-equality assertion. No fake mocks
`dogfoodBody` (it is a pure leaf), so no test double changes.

### D-18's type-only import: sound

`import type { CacheOs } from './release-asset-name.js'` erases at compile time, so
`dogfood-body.ts` stays a runtime leaf even though `release-asset-name.ts` imports `HASH_PATTERN`
from `cache-key.js` at runtime (`release-asset-name.ts:1`). `CacheOs` is
`(typeof CACHE_OS_VALUES)[number]` = `'windows' | 'macos' | 'linux'` (`:8`, `:17`).

### D-20's matrix shape: available

`integration` (`ci.yml:410-414`) is the working template -- `strategy.fail-fast: false`,
`matrix.os: [ubuntu-24.04-arm, windows-11-arm]`, `runs-on: ${{ matrix.os }}`, plus
`timeout-minutes`. `dogfood-verify` currently sits at `:817-841` with `needs: dogfood-seed` and
`if: github.event_name == 'push'`, and `dogfood-seed` at `:794-816`, ubuntu-only. Adding the matrix
to `dogfood-verify` alone is a contained edit. **`dogfood-seed` must stay single-leg** -- D-20's
reasoning is exact: the key is `nx-cache-<GITHUB_RUN_ID>`, one per RUN and not per OS, so a Windows
seed leg makes the Windows verify restore a Windows-written entry and pass even with cross-OS restore
completely dead.

### HARD CONSTRAINT on VER-06's closure -- new finding

`ci.yml:3-7` triggers on `push` to **`main` only**, plus `pull_request`. Both dogfood jobs are
`if: github.event_name == 'push'`. **So `dogfood-seed`/`dogfood-verify` do not run on this branch and
do not run on a PR.** VER-06 cannot be observed at all before the merge to `main`. Two consequences
for the plan:

- Phase 8's "prove a guard can fail on a fixture AND on a real leg" (D-22) is only half-available
  here: the fixture RED is achievable locally, the real-leg RED is not achievable pre-merge. Do not
  write an acceptance check that requires a live RED on this branch -- it cannot be satisfied.
- VER-06 is a Live-CI first-push close, alongside OBS-04's rotation signal, exactly as ROADMAP
  `:323-324` states. The plan should mark it `human_needed` at the merge rather than claim it closed.

### A gap in the proof VER-06 does NOT close

`dogfood-seed`/`dogfood-verify` use `./packages/github-cache`, which runs `dist/action/index.js`
built from source in-job. They never execute the committed `start-cache-server/index.js`. So a green
VER-06 says nothing about whether the SIDECAR bundle is at the same cache version -- and the sidecar
is what four of the five bundle sites use to write real `nx-cache-<taskhash>` entries.
`action-bundle-drift` (`ci.yml:99-116`, no `if:`, so it DOES run on PRs) is the only control tying
them together. Name this in the plan so nobody reads a green VER-06 as ROBUST-04 evidence.

---

## Q8 -- PARITY-08: `ci.yml` as a `test` input

### Is "every `ci.yml` edit re-runs `test`" acceptable? YES.

Measured: `test` is a single ubuntu-only target with a 3.4s critical path on a cache miss, running 35
spec files / 575 tests. `nx.json` `targetDefaults.test.inputs` ALREADY lists 20 `{workspaceRoot}`
entries including `cleanup.yml`, eight docs files, `ppe/action.yml`, `.gitattributes` and
`start-cache-server/entry.ts` -- so this is the established pattern, not a new cost class, and the
`.github/workflows/cleanup.yml` precedent is the exact analog. Confirmed at HEAD: the list contains
`cleanup.yml` and **not** `ci.yml` (already-measured fact #6 VERIFIED).

The cost is also strictly smaller than the alternative. Without the entry, every spec asserting on
`ci.yml` content -- DOCS-08's two `ci.yml` corrections and VER-06's job assertions -- serves a stale
cached PASS. This repo has shipped that false-pass class **twice** (`governance-email.spec.ts`, and
`typecheck`'s spec-excluding inputs), which is what `nx-target-inputs.spec.ts:466-529` exists to
prevent a third time.

### The guard technique: extend `nx-target-inputs.spec.ts`, three clauses

`nx-target-inputs.spec.ts` already has every piece. It resolves inputs through Nx's own
`splitInputsIntoSelfAndDependencies` -> `extractPatternsFromFileSets` -> `filterUsingGlobPatterns`
trio (`:117-128`), and it already reads `project.json` as its own layer (`:79-81`) and merges via
Nx's own `readTargetDefaultsForTarget` + `mergeTargetConfigurations` (`:431-439`).

**Clause 1 -- the literal pin.** `expect(nxJson.targetDefaults.test.inputs).toContain('{workspaceRoot}/.github/workflows/ci.yml')`.
This is the same shape as the four existing literal pins at `:472-529`, and it is honest about its
limit for the same reason those are: `filterUsingGlobPatterns` substitutes `{projectRoot}` ONLY
(`:31-36`), so a `{workspaceRoot}` pattern survives literally and matches no probe path. There is no
resolver to delegate to; the entry IS the invariant.

**Clause 2 -- the MERGED configuration (Phase 8 NF-02).** Transplant the `integration` merge at
`:431-447` to `test`:
`mergeTargetConfigurations(projectJson.targets.test ?? {}, readTargetDefaultsForTarget('test', nxJson.targetDefaults) ?? undefined)`,
then assert the `ci.yml` entry survives. `project.json` declares only `integration` today
(`{ command, options }`, no `inputs`), so `targets.test` is absent and the `?? {}` is doing real
work -- state that in the comment, because a reader will otherwise assume the key exists.

Precedence note the comment lock should carry: the merge has THREE layers, not two --
`@nx/vitest`'s inferred target is the BASE, `targetDefaults` merges over it (and for `inputs`,
REPLACES it), and `project.json` sits highest and replaces again. The inferred layer is therefore
dominated and cannot be the hole; `project.json` is the hole, and clause 2 is what covers it.

**Clause 3 -- the vacuity control, and it must be NEGATIVE.** Copy `:456-463`: build a LOCAL hostile
copy of the project layer declaring `inputs: ['default']` and assert the `ci.yml` entry is GONE.
Without it, clause 2 passes on a merge that never consulted `project.json` -- and Phase 8's surprise
was exactly that: adding `"inputs": ["default"]` to `project.json` reddens ONLY the merged-config
guard while both pre-existing guards stay green. The mutation is applied to a local copy, never to
the file, so the control needs no hostile `project.json` on disk.

### The comment lock (D-23), displaced into the spec

`nx.json` is strict JSON and carries no comments, so the rationale lives in the guard spec (Phase 8
D-13). It must record two things:

1. **`targetDefaults` inputs REPLACE rather than merge** -- already stated for `lint` at
   `:319-340`; restate it for `test`.
2. **`@nx/vitest`'s inferred `test` target carries `{ env: 'CI' }`** --
   `node_modules/@nx/vitest/dist/src/plugins/plugin.js:246`, **VERIFIED at HEAD** (already-measured
   fact #4 confirmed). `CI` is set on every runner and unset on a workstation, so an inferred-input
   `test` target would make **O1 structurally impossible for `test`**. The explicit list is what
   saves it, and nothing currently records that. This is the single most valuable line of the whole
   comment lock: the safety currently holds by accident.

### Ordering

PARITY-08 lands **FIRST** (D-22, and REQUIREMENTS' sequencing table `:577`). Note the mechanism: the
`nx.json` edit itself rotates the `test` hash, because `{workspaceRoot}/nx.json` is already a `test`
input (`:472-476`). So the entry becomes effective on the very run that introduces it -- there is no
window where a later spec could still replay a pre-PARITY-08 pass.

---

## Q9 -- OBS-04: is a documented reading instruction enough, and where must it live?

### Yes, a documented instruction satisfies OBS-04. The requirement says so itself.

OBS-04's own text (`REQUIREMENTS.md:549-560`) mandates three things and none of them is state: the
message drops the "different OS" explanation and names cache-version rotation; the expected
first-push signal is recorded IN ADVANCE; the tripwire is gated on "two consecutive all-miss pushes
with NO version-affecting change in between". It closes with "It stays a warning, not a hard
failure." A gate expressed as a reading instruction is the only form available without persisting
cross-push state -- and the project's Key Decisions reject mutable observability state on principle
(the LRU-manifest row: "a manifest adds mutable retention state (security-negative)"). D-28b's
rejection of a persisted marker, a repo variable, a Release asset and a scheduled diffing job is
therefore consistent with both the requirement and the project posture, and the mechanism stays
strictly additive later.

### An additional argument for the no-state choice, from this session's measurements

The three "rotation windows" D-30 counts are **three DIFFERENT mechanisms on two different axes**,
which is why no single persisted counter could gate them anyway:

| Window | Mechanism | Axis |
|---|---|---|
| 1 (Phase 7) | inferred `lint` target changes `hash_project_config`; `nx.json` is itself a `test` input | Nx TASK hash |
| 2 (Phase 9, VER-01) | the archive path literal changes `getCacheVersion` | `@actions/cache` VERSION |
| 3 (Phase 10, CORR-02) | the Releases asset name changes | Release ASSET NAME |

A tripwire keyed on "all-restore-MISS at publish" only sees window 2 directly; windows 1 and 3
produce a superficially similar all-MISS through unrelated machinery. The reworded message must
therefore say WHICH axis it is talking about, or a reader will misdiagnose window 1 or 3 as a
version-rotation event -- and D-30 forbids authoring a tripwire that fires on them.

### Every location that must carry the record, and why each is load-bearing

1. **The warning message itself** (`publish/publish-mirror.ts:300-307`). This is the only place the
   record reaches a reader at the moment they need it. It must name the two candidate causes
   (a cache-version rotation in this commit range -- the archive path or the cross-OS flag changed;
   and the runtime token's Actions-cache read scope) and carry the two-consecutive-pushes gate. It
   stays `core.warning` (`:301`), never a failure.

2. **A dated phase artifact, committed BEFORE the version-rotating commit.** "Recorded IN ADVANCE"
   is a claim about git history, and history is the only proof. The content is D-29's: all-miss on
   BOTH publish legs, `mirrored == 0`, caused by the PATH change and not the flag -- because
   `enableCrossOsArchive` alone pushes `windows-only` only when
   `process.platform === 'win32' && !enableCrossOsArchive` (`cacheUtils.js:166`, **VERIFIED**), so on
   Linux the flag is a no-op on the version. Phase 8's precedent is `08-EVIDENCE.md`. Make this a
   plan dependency, not a prose instruction (Phase 8: "a comment asking an executor to preserve
   ordering is not a control; a `depends_on` graph is").

3. **`publish-mirror.spec.ts`**, which already asserts the message at `:426`, `:438` and `:486` via
   `expect.stringContaining('restored as a MISS')`. **Two consequences.** (i) The reword MUST retain
   the substring `restored as a MISS` or all three assertions break -- keep it; it is a good anchor.
   (ii) Add positive assertions for the two new cause substrings so the reword cannot silently
   revert. For the absence half, use `expect.not.stringMatching(/differen[t] OS/)` -- a regex with a
   single-character class, so the spec never spells the phrase it forbids (Q4's technique, and Phase
   8's trap applies here too).

4. **`docs/advanced.md`'s publish/sync section.** This one is genuinely consumer-facing and is easy
   to miss: an adopter who bumps this action to a version with a different archive path gets their
   OWN one-time all-MISS publish. The same paragraph is already being edited for DOCS-08 (`:54-55`),
   so it is one edit, not two.

5. **STATE.md's decision log**, per this repo's convention of recording each plan's load-bearing
   decision there.

Not required, and worth explicitly NOT doing: a `PROJECT.md` Key Decisions row. The decision here is
"no mutable observability state", which Key Decisions already asserts; restating it per-requirement
invites the two copies to drift.

---

## Q10 -- DOCS-08 site list, re-derived BY CONTENT at HEAD

All six located by phrase search, not by the cited line numbers. Bucket per DOCS-08's own membership
criterion (does the site assert same-OS restore as a load-bearing invariant?).

| # | Cited in REQUIREMENTS/ROADMAP | ACTUAL at `565f48f` | Quoted phrase (the stable key) | Bucket |
|---|---|---|---|---|
| 1 | `docs/advanced.md:54-57` | **`docs/advanced.md:54-55`** | "Restore is same-OS -- an entry / saved on one runner OS cannot be restored on another" | **CORRECTION** |
| 2 | `ci.yml:577-583` | **`ci.yml:947-948`** | "@actions/cache folds the per-OS tmpdir path + a windows-only salt + the / compression method into the cache version hash, so an ubuntu leg can NEVER restore a" | **CORRECTION** |
| 3 | `ci.yml:356-360` | **`ci.yml:387` and `ci.yml:406`** | `:387` "a Linux cache never satisfies a Windows"; `:406` "DIFFERENT Nx task hashes, so neither leg can ever restore the other's entry -- / exactly the CORR-01 namespacing the store already relies on" | **CORRECTION (narrow -- see below)** |
| 4 | `docs/advanced.md:45` | `docs/advanced.md:45` (unchanged) | "Every read fault degrades to a MISS (a rebuild), never a wrong result." | **ADDITIVE -- D-32 CONFIRMED** |
| 5 | `README.md:125` | **`README.md:124-125`** (sentence starts at 124) | "- **Correct over clever.** Every read fault degrades to a cache MISS (a rebuild), / never a wrong result or a broken build." | **ADDITIVE** |
| 6 | `docs/trust-and-security.md:155` | **`docs/trust-and-security.md:184-185`** | "Every read fault degrades to a MISS -- never a wrong result and never a broken / build (Core Value)." | **ADDITIVE** |

### Corrections to D-31's table

D-31 is right about the drift and right about every bucket. Three refinements:

- Site 2 is at **947-948**, not "943-950". D-31's range spans the whole comment block; the false
  clause is two lines.
- Site 3 is **TWO separate sentences at `:387` and `:406`**, not one block at "384-406". They make
  different claims and need different edits.
- Site 5's sentence begins at `:124`; only its second half is at `:125`.

Drift cause confirmed: Phase 8 inserted `hash-parity` (`ci.yml:573`) and `hash-parity-compare`
(`:742`), so the cited `ci.yml:577-583` now lands inside the hash-parity job. Record this so the
verifier does not read a content-located edit as unauthorised drift.

### D-32's reclassification of `docs/advanced.md:45`: CONFIRMED

`advanced.md:45` reads "Every read fault degrades to a MISS (a rebuild), never a wrong result." That
is textually the SAME fault-degradation claim as `README.md:124-125` and
`trust-and-security.md:184-185`, both of which DOCS-08 explicitly says must NOT be "corrected as
though they were wrong" (`REQUIREMENTS.md:466-469`). It asserts nothing about same-OS restore, so it
fails DOCS-08's own membership criterion. D-32's arithmetic holds: three corrections, three additive
preconditions, six sites touched, DOCS-08's count of four sites-in-scope honoured.

Follow Phase 7's precedent and comment-lock the miscount on the site-list constant, keyed on FILE +
QUOTED PHRASE rather than line number -- these edits shift each other's lines inside one commit,
exactly as the `CORR_05_SITES` constant's key does.

### Site 3 is the subtlest edit -- correct it NARROWLY

`ci.yml:387` and `:406` are mostly TRUE and must not be over-corrected. XOS-03 is explicit: the
Linux/Windows `integration` divergence "is a statement about Nx HASHES, not about cache storage", and
after VER-01/VER-03 a storage-level probe for the Linux key from a Windows runner would HIT. So:

- The claim "the Linux and Windows hashes differ, so both matrix legs run" stays TRUE.
- "a Linux cache never satisfies a Windows run" stays TRUE, but the REASON must be stated as the
  hash, not the storage.
- `:406`'s trailing clause "**exactly the CORR-01 namespacing the store already relies on**" becomes
  FALSE -- from this phase forward the STORE does not partition by OS. That clause is the actual
  target of the edit.

Site 2 is the outright false one: the `windows-only` salt no longer applies once
`enableCrossOsArchive` is true, and the path is no longer per-OS, so "an ubuntu leg can NEVER restore
a Windows-saved entry" inverts. And it is not merely wrong prose -- it is the stated justification
for keeping the publish matrix at two legs. The replacement must supply a NEW reason the matrix stays
two-legged (the Windows leg is still the only leg that produces Windows-hash entries at all, and the
`hash-parity` / `integration` discriminator keeps those hashes distinct), or a later reader will
collapse the matrix to one OS on the strength of the corrected text.

### Out of scope, confirmed by content

`ci.yml:1059` ("Each OS leg reads back ONLY its own-OS asset ... proves the same-OS
publisher->reader contract") and `read-back.ts:10-31,52-56` are Phase 10's OBS-05/TRUST-11, per
`REQUIREMENTS.md:464-465` and CONTEXT.md's Not-in-this-phase list. Also out: `publish-mirror.ts:146`
("a foreign-OS or evicted entry MISSes its same-OS restore") and `publish-mirror.ts:159`'s CORR-01
comment -- both Phase 10. Do not touch them; `publish-mirror.spec.ts:410` carries the matching
comment.

OBS-03's retraction binds site 4/5/6's additive text: **do NOT write any claim that the mirror
answers "whose bytes did the developer get"** (`REQUIREMENTS.md:543-544`). From this phase forward
the ubuntu publish leg can mirror a Windows-produced entry and the Phase 10 `mirrored-by` label
would call it `linux`.

---

## Q11 -- ROBUST-04: what is `serve()`-reachable, and is the bundle deterministic?

### The bundle graph, traced from the esbuild entry

`esbuild.action.mjs:32` has exactly ONE entry point: `start-cache-server/entry.ts`. That imports
`@actions/core` and `serve` from `packages/github-cache/src/serve.js`, and `serve.ts` imports
`selectBackend` (`:12`) -> `lib/select-backend.ts` -> `backend/actions-cache-backend.ts` (`:1`) ->
`lib/cache-archive-path.ts` (`:4`).

| File this phase edits | In `start-cache-server/index.js`? | ROBUST-04 rebuild obligation |
|---|---|---|
| `lib/cache-archive-path.ts` | **YES** | **YES -- same commit** |
| `backend/actions-cache-backend.ts` | **YES** | **YES -- same commit** |
| `lib/compression-method.ts` (NEW) | **NO**, if imported only from `action/index.ts` | no |
| `action/index.ts` | **NO** -- not reachable from `entry.ts` | no |
| `lib/dogfood-body.ts` | **NO** -- imported by `action/index.ts` and `roundtrip/read-back.ts` only | no |
| `publish/publish-mirror.ts` | **NO** | no |
| `lib/summary.ts` | **NO** | no |
| `nx.json`, `ci.yml`, docs, specs | **NO** | no |

**D-17 CONFIRMED: a new `compression-method.ts` imported only from `runPublish` stays out of the
bundle**, structurally, because the bundle has a single entry that does not reach `action/index.ts`.
Guard it: `action/index.ts` imports `serve` from `../serve.js` (`:3`), so the reverse edge does not
exist and cannot be created by accident -- but a future import of `compression-method.ts` from
anywhere in the `serve()` graph would silently pull it in. A one-line assertion that the bundle does
not contain a distinctive `compression-method.ts` literal would pin it; the plan can also rely on
`check:action`'s byte-diff, which would show the growth. Prefer the byte-diff: it needs no new
mechanism.

Note the asymmetry that makes ROBUST-04 bite at all: `packages/github-cache/action.yml` runs
`dist/action/index.js`, BUILT FROM SOURCE in-job (`npm ci` + `npm run build` precede every
`uses: ./packages/github-cache`), so the publish/dogfood action always reflects the pushed commit.
Only `start-cache-server/index.js` is a committed artifact that can lag.

### The site count -- REQUIREMENTS.md is off by one

`uses: ./start-cache-server` appears at **`ci.yml:236` (build), `:310` (typecheck), `:357` (test),
`:432` (integration), `:895` (consumer-smoke)** -- **FIVE** sites, and `integration` is a two-leg
matrix, so six job-legs. CONTEXT.md fact #10 and D-25 say five and are RIGHT.
`REQUIREMENTS.md:335` ("four `ci.yml` sidecar jobs") and ROADMAP SC1d (`:286`, "the four sidecar
jobs") say four and are WRONG. Same requirement-miscount class as Phase 7's CORR-05 three-vs-four;
comment-lock the correction rather than fixing it silently.

### Determinism at HEAD: `npm run check:action` exits 0

Run in this session on a clean tree: `build:action` regenerated `start-cache-server/index.js` and
`git diff --exit-code -- start-cache-server/index.js` returned 0. `git status --porcelain` afterwards
showed only the pre-existing `M .planning/config.json`. So the bundle is byte-reproducible on this
machine right now (esbuild 0.28.1 exact-pinned, fixed banner, fixed inputs) and D-26's precondition
holds.

Phase 7's Q10 contingency remains live and must stay in the acceptance check, not be assumed away:
a lockfile re-resolution drifted the bundle by 88 lines with no source edit (undici 6.27.0 -> 6.28.0
through `@actions/*`'s ranged transitive deps). So `npm run check:action` goes in the acceptance
battery of EVERY plan touching a `serve()`-reachable file, and the diff is inspected rather than
assumed empty. `action-bundle-drift` (`ci.yml:99-116`) also runs `npm run typecheck:action` -- the
committed bundle's whole esbuild-reachable graph is type-checked through `tsconfig.action.json`, so
`entry.ts` and everything it reaches must compile. A new import in `cache-archive-path.ts` or
`actions-cache-backend.ts` must satisfy that config too, not just the package tsconfig.

That job carries no `if:`, so unlike VER-06 and OBS-04, **ROBUST-04's guard IS available on this
branch's PRs.**

---

## Q12 -- Sequencing: validating D-35, plus four hazards it misses

### D-35 validated against the real dependency graph

| Step | Constraint it serves | Verdict |
|---|---|---|
| 1. PARITY-08 | `REQUIREMENTS.md:577`; DOCS-08 and VER-06 both assert on `ci.yml` | **CORRECT and load-bearing.** Also self-effective on its own run (the `nx.json` edit rotates `test`). |
| 2. D-34's snapshot | TEST-08's attribution window closes at Phase 9 | **CORRECT but over-tight** -- see hazard C. |
| 3. VER-07's mkdir | `REQUIREMENTS.md:578` | **CORRECT as CODE order; wrong as COMMIT order** -- see hazard B. |
| 4. VER-01/02/03/04 + bundle | ROBUST-04 | **CORRECT, but must be ONE commit** -- see hazards A and D. |
| 5. VER-05 | independent, publish path only | **CORRECT.** Touches `action/index.ts` + a new leaf; no bundle obligation (D-17). |
| 6. VER-06 | after VER-01/03 or the Windows leg proves nothing | **CORRECT.** Note it cannot be OBSERVED pre-merge (Q7). |
| 7. OBS-04 / DOCS-08 | docs follow behaviour | **CORRECT**, with one exception: OBS-04's *recorded-in-advance artifact* must precede step 4, even though the *message reword* follows it. Split OBS-04 across two positions. |

Encode as `depends_on` frontmatter, not prose (Phase 8's learning). Verify the ordering the way Phase
8 did -- `git log <base>..<head> -- <file>` stays empty through the waves that must precede it.

### Hazard A (NEW, highest value): VER-04's guard breaks 16 existing spec constructions

Landing the guard without the spec accommodation reddens `actions-cache-backend.spec.ts` (15
constructions) and `serve.spec.ts:401` immediately, and `select-backend.spec.ts` probably too.
**VER-04 and the chdir/mkdir hook must be the SAME commit.** A plan that puts "add the guard" and
"fix the specs" in separate tasks of the same commit is fine; separate commits leave a red tree.

### Hazard B (NEW): splitting VER-07 from VER-01 creates a commit of dead code

REQUIREMENTS' "VER-07 before VER-01" is a statement about the order of operations AT CONSTRUCTION
(assert, then `mkdirSync`, then the path is used), which is what D-07 already specifies. Landing them
as two commits satisfies the letter while producing an intermediate commit where the `mkdirSync`
creates a `.nx/cache` directory that nothing writes to -- unmotivated code a reviewer would flag, and
(under `nx test`) a stray un-gitignored directory for one commit with no purpose. **Recommend
VER-07 + VER-01 in one commit**, with the code order comment-locked.

### Hazard C (NEW): D-34's snapshot does not gate the whole phase

The mirror only changes when the rotation reaches the DEFAULT branch: `publish` and `publish-verify`
are `if: !cancelled() && github.event_name == 'push'` and `ci.yml` pushes are filtered to `main`
(`:3-7`), with `isSyncTrusted` re-checking the default branch in-process. So on
`gsd/v0.0.2-os-invariant-cross-os-sharing`, VER-01 can land without the ubuntu leg starting to mirror
Windows entries. D-35 step 2 ("before any commit that rotates the cache version") is stricter than
TEST-08 requires ("before the first version-rotating DEFAULT-BRANCH push"). Prefer the looser,
correct framing so a `gh api` snapshot does not block the phase's first code commit -- but keep it
BEFORE the merge, and note `CACHE_MIRROR_MAX_AGE_DAYS` is 30, so waiting also ages the record out.

### Hazard D (answering Q12's explicit question): yes, but not the way it sounds

**Within one CI run there is no cross-version exposure**: every job checks out the same ref, so the
committed bundle and the from-source publish action are always the same commit's code. The exposure
is ACROSS runs, and it has two distinct shapes:

1. **Bundle drift (the one D-25 names).** If a `serve()`-reachable edit is pushed WITHOUT the rebuilt
   bundle, the five sidecar sites write at the old version while the publish action restores at the
   new one, and the mirror silently stops receiving -- surfacing only as the all-restore-MISS warning
   OBS-04 has just told everyone to expect once. `action-bundle-drift` catches it, but after the
   misleading signal has been rationalised. D-25 and D-26 cover this correctly.

2. **Multiple rotation windows (the one D-35 misses).** VER-01 (`cache-archive-path.ts`) and VER-03
   (`actions-cache-backend.ts`) EACH change `getCacheVersion`'s input. If they land as two separate
   commits that both reach `main`, the milestone gets FOUR all-MISS pushes, not three -- and D-30
   states three, while D-29 records the expected signal as happening once. The OBS-04 tripwire still
   behaves correctly (there IS a version-affecting change between the two all-miss pushes, so it does
   not fire), but the recorded-in-advance note becomes false, and "expected exactly once" is the
   sentence a reader will use to decide whether the second occurrence is a defect.

   **Recommendation: land VER-01 + VER-03 + VER-04 + VER-07 in ONE commit.** They are one behavioural
   change with one rotation. If the plan must split them, D-29's note must say "expected on EACH of
   the following N version-affecting commits" and enumerate them -- do not leave "once" standing.

   A related nuance worth writing into the note: `enableCrossOsArchive` alone rotates only WINDOWS
   entries (`cacheUtils.js:166`), so a VER-03-only commit produces an all-MISS on the Windows publish
   leg and a normal ubuntu leg -- an asymmetric signal that looks like a Windows-specific breakage
   rather than a rotation. That asymmetry is a second reason not to split.

### Hazard E (NEW): the three "rotation windows" are three different mechanisms

See Q9's table. The OBS-04 note and message must name the AXIS, or windows 1 and 3 read as
version-rotation events and D-30's "do not author a tripwire that fires on windows 1 or 3" is
unenforceable by a human reader.

---

## Validation Architecture

### What is unit-testable in ONE process on ONE OS

These are `test`-target specs, ubuntu-only in CI today (`ci.yml:338`; Windows legs are XOS-04, Phase
12) and on a Windows workstation locally. Sampling rate: **every `test` run**, i.e. every commit
touching any `test` input -- which after PARITY-08 includes `ci.yml`.

| Requirement | Unit-observable clause | Instrument | Non-vacuity control |
|---|---|---|---|
| VER-01 | the produced string is exactly `.nx/cache/nx-github-cache-abc123.tar` | hand-authored full-literal equality, NOT rebuilt from the template | the literal is authored, so a template rename fails it |
| VER-02 | the module names no path/os builder and imports nothing but the `Hash` type | comment-stripped source scan with bracket-class needles (Q4) | assert the scanner FIRES on a fixture containing the shape |
| VER-03 | per-call argument arrays incl. the flag's positional index, per-function call counts, and a source-level count of exactly three reaches | `vi.mock('@actions/cache')` deep-equality on `.mock.calls` + comment-stripped member scan + namespace-import assertion | clause 1 and clause 2 are each other's control: neither passes on the other's failure mode |
| VER-04 | the guard THROWS on a wrong cwd and on a diverging `GITHUB_WORKSPACE`; passes on the identity | chdir a temp dir / set `GITHUB_WORKSPACE` to a sibling; both conjuncts asserted separately | a test that passes with the guard deleted is the failure to avoid -- assert the THROW, not just the happy path |
| VER-05 | the branch is on `=== ''`, not on the parsed semver; stderr-only output selects zstd; a non-zero exit still selects zstd; ENOENT selects gzip | inject a fake spawn or point at a script fixture; four cases | the non-zero-exit case is THE control -- it is the only one that distinguishes a faithful port from a `runHelper`-shaped one |
| VER-07 | `mkdirSync` runs at construction, before any write, and is recursive | assert the directory exists after construction on a tree where it did not | remove the directory first, or the assertion passes on Nx's own directory |
| PARITY-08 | the entry survives the MERGED configuration | Nx's own `readTargetDefaultsForTarget` + `mergeTargetConfigurations` | hostile local `project.json` copy declaring `inputs: ['default']` reddens |
| ROBUST-04 | the committed bundle matches a fresh build | `npm run check:action` (`build:action` + `git diff --exit-code`) | the diff is INSPECTED, never assumed empty (Phase 7 Q10: an 88-line drift with no source edit) |
| OBS-04 | the message names the two causes and no longer names the OS one | `publish-mirror.spec.ts` `stringContaining` for the new causes + `not.stringMatching(/differen[t] OS/)` | the three existing `restored as a MISS` assertions at `:426,438,486` already prove the branch is reached |
| DOCS-08 | each of the six sites carries its edit | a `DOCS_08_SITES` constant keyed on FILE + QUOTED PHRASE, asserted against the files | requires PARITY-08 first for the two `ci.yml` sites, or a stale cached PASS |
| VER-06 (partial) | `dogfoodBody(hash, 'linux')` differs from `dogfoodBody(hash, 'windows')` and is deterministic per pair | `dogfood-body.spec.ts` | assert the two OS values produce DIFFERENT bytes -- otherwise the provenance claim is vacuous at the leaf |

### What is observable ONLY on a real runner -- and a spec CANNOT substitute

**Be explicit: a spec runs in one process on one OS and cannot observe a two-OS property.** VER-06
says so in as many words, and it is the reason the load-bearing control is a job and not a test.

| Requirement | Only-live clause | Where | Sampling rate | Pre-merge availability |
|---|---|---|---|---|
| VER-06 | a `windows-11-arm` runner reads back the entry an `ubuntu-24.04-arm` runner wrote, and the body is LINUX-produced | `dogfood-seed` (ubuntu, single leg) -> `dogfood-verify` (two-leg matrix, `fail-fast: false`) | **every push to `main`** | **NONE.** `if: github.event_name == 'push'` + `ci.yml:3-7` filters to `main`. No PR run. |
| OBS-04 | the one-time all-MISS rotation signal on both publish legs with `mirrored == 0` | `publish` matrix (`max-parallel: 1`) + its `core.summary` | **once**, on the first `main` push after VER-01 | **NONE**, same gate |
| ROBUST-04 | the committed bundle is what the five sidecar sites actually execute | `action-bundle-drift` + the four sidecar jobs' own sidecar handshake | every PR and every push | **YES** -- no `if:` on that job |
| VER-04 | the cwd/`GITHUB_WORKSPACE` identity holds on a real Windows runner | already MEASURED 2026-07-26 (`PROBE-RESULTS.md` Q2); this phase makes it enforced rather than assumed | every job that constructs the backend | YES via `integration`'s Windows leg (PR-eligible) |
| VER-05 | the resolved compression method on each real runner image | `publish` job summary, both legs | every `main` push | NONE (push-gated), but the VALUE is informational -- surfaced, never gated |

Sampling-rate consequences the plan must state rather than discover:

- **A once-only signal cannot be re-sampled.** OBS-04's rotation signal exists on exactly one run.
  If it is not recorded in advance and read at that run, it is gone -- the next push is a normal
  all-HIT push. This is what makes D-29's "recorded IN ADVANCE" a control rather than paperwork.
- **VER-06 and OBS-04 are merge-gated, so the phase closes with two `human_needed` items.** Do not
  author acceptance checks for them that a pre-merge run could satisfy; that would be a guard that
  passes for the wrong reason.
- **Nyquist floor for the cross-OS property is TWO OS legs.** One leg samples one OS and cannot
  detect an OS-partitioned store at any rate. `dogfood-verify`'s two legs are the minimum, and both
  must assert the LINUX-produced body -- trivially true on ubuntu, the whole point on Windows.
- **The vacuity condition must be in the JOB COMMENT** (VER-06, D-21), not only in the spec or the
  context file, because the person who later adds a Windows `dogfood-seed` leg reads the workflow.

### What is NOT validatable in this phase, and is correctly deferred

O1-O4 (XOS-01..03, TEST-08/09/10) are Phase 11/12. This phase produces a PRECONDITION and D-34's
evidence snapshot, never a proof. Do not let D-34 grow into the O1 proof -- TEST-08 is not in this
phase's eleven.

---

## Anti-requirements confirmed observed

- Every measurement re-derived at `565f48f`. Prior numbers appear only inside labelled quotes
  (`PROBE-RESULTS.md` Q1/Q2, Phase 7's 88-line bundle drift).
- `nx show target <t> --inputs` / `HashPlanInspector` recommended for NOTHING. Phase 8 proved
  `HashPlanInspector` skips `ProjectConfiguration` (`native/index.d.ts:86`), and the `--inputs` flag
  form is inert at 23.1.0. Where a merged configuration was needed, this file used
  `nx show project --json` (for `options.cwd`) and Nx's own merge functions (for the guard).
- No persisted-state tripwire proposed for OBS-04; Q9 addresses the Key Decisions rejection directly
  and adds a second, mechanism-level argument.
- No new consumer-facing env knob, action input or package export (D2-02, PARITY-07). `dogfoodBody`
  is not in the barrel; `compression-method.ts` is internal; the guard reads only `process.cwd()` and
  `GITHUB_WORKSPACE`, both pre-existing ambient values.
- `integration`'s `{ "runtime": "node -p process.platform" }` untouched, and
  `nx-target-inputs.spec.ts:394-401` already asserts it byte-identically. The PARITY-08 edit adds one
  entry to `targetDefaults.test.inputs` and touches no other key.
- No Phase 10 scope: the Releases asset name, `mirrored-by`, CORR-05 sites 2-4,
  `publish-mirror.ts:159`, and `publish-verify`'s same-OS claim at `ci.yml:1059` are all named as
  out-of-scope in Q10 rather than planned for.

## Cleanup performed

Every probe artifact was removed and the baselines re-verified:
`.nx/cache/nx-github-cache-abc123.tar`, `.nx/cache/99999999999999999999/`,
`.nx/cache/1234567890123456789/`, `packages/github-cache/.nx/`,
`packages/github-cache/zz-stray-probe.txt`, `packages/github-cache/src/zz-temp-cwd-probe.spec.ts`.
Final `git status --porcelain` shows only the pre-existing `M .planning/config.json`; `build` is back
to `17776792307406644378` and `test` to `13772310617450523374`; `npm run check:action` exits 0. The
full unit suite passed during the cwd probe (35 files / 575 tests), which also means `test` is green
at HEAD -- relevant to the unattributed `69bd1b7` failure carried in
`08-nx-task-hash-parity/deferred-items.md`.
