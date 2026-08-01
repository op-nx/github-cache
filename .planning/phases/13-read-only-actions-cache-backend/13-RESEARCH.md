# Phase 13: Read-Only Actions-Cache Backend - Research

**Researched:** 2026-08-02
**Domain:** Backend capability narrowing (TypeScript ports-and-adapters) + GitHub Actions cache
scoping + CI gate soundness
**Confidence:** HIGH (Q1, Q2, Q3, Q5, Q6, Q7) / MEDIUM (Q4 read half -- doc-confirmed, not yet
reproduced in this repo)

## Summary

Both mandated gates close, and they close in the direction CONTEXT.md recommended -- but the
decisive evidence is not the one CONTEXT.md anticipated. **Q1's acceptance criterion is already
mechanically enforced in the tree** by `actions-cache-backend.spec.ts:512-546`: a comment-stripped,
FILE-SCOPED source scan asserting the ordered `cache.*` member accesses are exactly
`['restoreCache', 'saveCache', 'restoreCache']`, plus a single-namespace-import assertion. Under
D-01's composed shape that ordered array is **byte-identical** -- the guard passes with zero edits.
Under any sibling-file shape the guard goes **blind**, and a second `restoreCache` lands with every
spec green. That is exactly the drift the ROADMAP names, and it converts "put the read-only factory
in the same file" from a style preference into a hard constraint. The one gap: the guard is
file-scoped, so it cannot see a FUTURE sibling. Widening it to a package-scope scan (exactly one
non-spec file under `src/` imports `@actions/cache` -- true today) is ~6 lines and makes the drift
structurally unrepresentable rather than conventionally avoided.

**Q2 resolves to option (a)**, a strictly-narrowing env knob read by `selectBackend`. Option (b)
fails resolution criterion (iii) as CONTEXT.md predicted, and option (c) is a strict superset of
(a)'s cost. The design move that makes "can only narrow" a *fact* rather than a promise is branch
ORDER: the knob check goes **last** in `selectBackend`, after every existing narrowing branch, so
it can only convert the single writable outcome into a read-only one and can never resurrect a
branch that would otherwise be read-only or throwing. `selectBackend.length` stays 0, so the
existing TRUST-05 structural assertion passes unchanged. The public-surface cost is real (8 -> 9
env knobs) and unavoidable, but it is smaller than CONTEXT.md feared: GitHub's own caching
reference recommends exactly this posture to consumers ("switch to a restore-only cache
operation such as `actions/cache/restore`"), so a read-only opt-in is a legitimate consumer
capability with first-party precedent, not repo-local CI plumbing leaking into the contract.

**Q4's read half is confirmed by two independent sentences of authoritative GitHub documentation,
and there is a free in-repo observation that reproduces it** -- but not on this phase's own landing
commit, which rotates all three hashes and therefore exercises only the intra-run merge-ref path.
The Case-B observation must be sequenced as a separate, later PR. **The single largest execution
hazard found is a vacuity trap in the obvious spec shape**: `jobBlock('build-windows')` already
contains an `exit 1` today (the readiness poll at `ci.yml:527`), so a gate spec that matches
`/exit 1/` is green *before the phase does anything*.

**Primary recommendation:** Build it. Compose `createActionsCacheBackend()` from
`createReadOnlyActionsCacheBackend()` **inside `actions-cache-backend.ts`**, add a last-branch
`CACHE_READ_ONLY` narrowing knob to `selectBackend`, set it in each Windows leg's existing
`$GITHUB_ENV` pre-set step, gate the counts at `>= 1`, and pin the semantic change with a spec that
matches the count COMPARISON (never a bare `exit 1`). D-09's shrink-to-a-decision escape hatch is
**NOT** taken.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read-only Actions-cache implementation | Backend adapter (`backend/actions-cache-backend.ts`) | -- | The port (`ReadableBackend`) already exists; only an Actions implementer is missing |
| RW-vs-RO decision | Selection seam (`lib/select-backend.ts`) | -- | TRUST-05: RW-vs-RO is which factory constructs, decided from the env bag by the selector |
| Refusing a PUT to a read-only backend | Protocol layer (`server/server.ts:124-129`) | -- | Already implemented; the contract's 403 is owned by the server, never a `put()` return value |
| Supplying the role signal | CI workflow (`.github/workflows/ci.yml`, the pre-set step) | Consumer env (public knob) | Producer-vs-consumer role is not derivable from any GitHub-supplied env fact |
| Gating the cross-OS HIT | CI workflow step (per leg) | -- | The observation is Nx stdout on a real runner; a spec cannot observe a two-OS property |
| Preventing silent revert | Spec (`dogfood-cross-os.spec.ts`) | -- | The file already owns cross-OS CI shape and reads `ci.yml` from disk |
| Transport of the signal into the process | Env bag (`$GITHUB_ENV` write in a regular step) | -- | A background step cannot export env; a regular step's writes DO propagate |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-02a: the read-only backend is selected per-LEG by ROLE, never per-EVENT.** The event-derived
  alternative (narrow RW to `isSyncTrusted`'s `{push,schedule}` + default-branch band) is REJECTED,
  because TRUST-05's asymmetry is a ONE-WAY RATCHET: a signal may only narrow RW -> RO, never widen
  RO -> RW. A read-only `pull_request` base can never be widened back for `dogfood-seed`, which
  drives a scripted PUT through `serve()` -> `selectBackend` and asserts a hard 200
  (`action/index.ts:320,336`). The "event band PLUS role signal" hybrid inherits the same break
  unfixably. DO NOT re-raise either.
- **The load-bearing property (D-02a):** if the consumer legs never write, no Windows-produced
  entry for those hashes can ever exist, so any HIT on those legs is NECESSARILY Linux-produced.
  The property is INDUCTIVE, not per-run -- it does not depend on the XOS-08 `needs:` edge, on job
  ordering, or on anything being true of the current run. Keep this separate from liveness
  (`needs:` is why the entry is present at all).
- **D-03: a construction-time `readOnly` argument on the backend factory is REJECTED** (TRUST-05).
  RW-vs-RO is which factory constructs the backend, never a caller-facing mode flag. The
  distinction that makes D-02 legitimate and D-03 not: D-02's signal is read from the ENV BAG by
  the SELECTOR; D-03's is an argument to the FACTORY.
- **D-04: all three Windows legs convert** -- `build-windows`, `typecheck-windows`,
  `test-windows`. Not a subset: one writable leg left behind keeps a launderable path open.
- **D-05: their `[remote cache]` counts get gated at `>= 1` per leg** -- a floor, not an exact pin.
  Phase 12's `RENDERED_DISCRIMINATOR_SITES` exact-pin lesson does NOT transfer: that guard counted
  authored SITES in a file we control; these counts are emitted by Nx's task graph and legitimately
  vary with it. Keep the per-target numbers as printed diagnostics.
- **D-06: every stale comment justifying the ungated counts must be corrected in the SAME commit.**
- **D-07: the new gate is pinned in a spec** -- prefer the existing `dogfood-cross-os.spec.ts`.
  Guard the SEMANTIC change, not the presence of a string.
- **D-08: read-only-against-the-same-store does not contradict** PROJECT.md's "Local read-write
  mode" Out of Scope line, CORR-01, or TRUST-05.
- **D-09: "do nothing" stays live via ONE door only** -- if research cannot find a shape satisfying
  D-01's criterion, the phase shrinks to a documented decision. Research must state which outcome
  it reached, explicitly.

### Claude's Discretion

- Exact names for the new factory and (if D-02 lands on option (a)) the env knob.
- Whether the new spec clauses live in `dogfood-cross-os.spec.ts` or a sibling -- prefer the
  existing file.
- Exact comment wording for the D-06 corrections.
- Whether the shared read core keeps the construction-time `mkdirSync(CACHE_ARCHIVE_DIR)`.
  `actions-cache-backend.ts:118-120` records that the READ path self-heals via `extractTar`'s
  `io.mkdirP`, so the mkdir is a write-path need. Keeping it in the shared core is harmless and
  simpler. Do NOT silently drop it from the writable path.

### Deferred Ideas (OUT OF SCOPE)

- A consumer-facing "read-only sidecar" recipe in `docs/`. Documenting the knob is IN scope (the
  contract guards force it); writing an adoption recipe around it is a DOCS phase.
- Applying the read-only backend to fork PRs. Fork `pull_request` behaviour has never been
  reproduced in this repo (quick task `260801-vyy` GA-2 deliberately excluded forks).
- A read-only Releases-mirror position. The Releases reader is already read-only by construction.

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Consequence for this phase |
|-----------|---------------------------|
| Run tasks through `nx`, prefixed with the package manager (`npx nx ...` / `npm run ...`) | Verification commands use `npx nx test github-cache`, never bare `vitest` |
| Invoke the `nx-workspace` skill before exploring the workspace | Applies to the executor when it needs target/dependency facts |
| Never guess CLI flags -- check `nx_docs` or `--help` | No inferred Nx flags in plan actions |
| Deps unchanged AND plans independent -> `npm ci` per worktree, or share `node_modules` via a junction | This phase changes no dependency, so worktree isolation is available |
| `node_modules/.vite` is Vitest's cache dir -- two junctioned worktrees running tests race on it | If worktrees are used, either skip the junction or set Vite's `cacheDir` per worktree |
| `check:action` must run from the MAIN tree, never a junctioned worktree | A junctioned `node_modules` makes esbuild rewrite module paths and report FALSE drift. The bundle regeneration task must be pinned to the main tree |
| GSD workflow enforcement: no direct repo edits outside a GSD workflow | Plans are the entry point |

## Standard Stack

No new dependencies. This phase is a pure refactor + wiring change inside the existing stack.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@actions/cache` | 6.2.0 (exact-pinned) | `restoreCache` / `saveCache` | Already the only Actions-cache client; exact-pinned under ROBUST-03 because it version-hashes the literal archive path [VERIFIED: `node_modules/@actions/cache/lib/cache.d.ts:58,68`] |
| `@actions/core` | (existing pin) | `core.warning` on the ambiguous save | Unchanged; used only on the write path |
| Vitest | via `@nx/vitest` | spec runner | Existing; config at `packages/github-cache/vitest.config.mts` [VERIFIED: directory listing] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| esbuild | (existing pin) | regenerates `start-cache-server/index.js` | MANDATORY in the same commit -- see Q5 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A new env knob | GitHub's server-side read-only cache token | UNAVAILABLE -- see Q2 verdict; no per-job lever exists |
| Composed factories | `actions/cache/restore`-style separate action | Needs a second committed bundle -> second `check:action` drift surface (fails D-01's criterion by adding a second drift-guarded artefact) |

**Installation:** none. `package.json` is untouched, and that is load-bearing -- a dependency
change would rotate hashes and pull the phase outside its own OUT OF SCOPE line.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. `package.json` and
`package-lock.json` are untouched; every module used already ships in the tree and
`@actions/cache@6.2.0` is exact-pinned and guarded by `pinned-deps.spec.ts:41-42`
[VERIFIED: codebase read].

## Phase Requirements (PROPOSED -- planner must register these)

ROADMAP.md:579 says `**Requirements**: TBD (run /gsd-plan-phase 13)`, and `init.plan-phase 13`
returns `"phase_req_ids": "TBD (run /gsd-plan-phase 13)"` [VERIFIED: seam output]. Phase 13 has NO
rows in REQUIREMENTS.md or in ROADMAP.md's Traceability table, while the table asserts 44/44 mapped
across Phases 7-12. The IDs below continue each established series. Highest v0.0.2 numbers today:
`CORR-06`, `DOCS-08`, `LINT-06`, `OBS-05`, `PARITY-08`, `RETAIN-05`, `TEST-10`, `TRUST-13`,
`VER-07`, `XOS-08` [VERIFIED: `git grep -oh -E "\*\*(CORR|...)-[0-9]+" .planning/REQUIREMENTS.md`].

**Propose only. Do NOT edit REQUIREMENTS.md or ROADMAP.md from this research.**

| Proposed ID | Description | Research Support |
|----|-------------|------------------|
| **VER-08** | The read-only Actions-cache backend is the SAME implementation as the writable one's read path. Exactly ONE `cache.restoreCache(...)` READ call site survives in the package, and the writable factory composes the read-only one rather than duplicating it. The VER-04 cwd/`GITHUB_WORKSPACE` guards and the VER-07 construction-time `mkdirSync` live in the shared core; `put`'s second `mkdirSync` and its `lookupOnly` probe stay on the write path, unchanged. | Q1 verdict; `actions-cache-backend.spec.ts:517-531` already enforces the ordered member array |
| **VER-09** | The `cache.*` drift guard is widened from FILE scope to PACKAGE scope: exactly one non-spec file under `packages/github-cache/src/` imports `@actions/cache`. Closes the sibling-file evasion the existing file-scoped scan cannot see. | Q1 gap; verified true today (`actions-cache-backend.ts` is the sole importer) |
| **TRUST-14** | The role signal is a strictly-narrowing env knob read by `selectBackend` as its LAST branch. `selectBackend.length` stays 0. No env shape can make the knob widen a read-only or throwing outcome into a writable one -- proven behaviourally, not by comment. | Q2 verdict; mirrors the existing TRUST-05 widening test at `select-backend.spec.ts:307-330` |
| **XOS-09** | All three Windows legs construct the read-only backend, and their `[remote cache]` counts are GATED at `>= 1` per leg. The gate's failure message names both causes it can have (cross-OS restore broken vs. the producer never populated the entry) so a red gate is actionable. | D-04 / D-05; Q5 wiring |
| **TEST-11** | `dogfood-cross-os.spec.ts` pins the SEMANTIC change per leg: the read-only knob write is present, the count COMPARISON is present, and the literal `RECORDED, never gated` is absent. The `exit 1` vacuity trap is explicitly avoided. | D-07 / Q6; the trap is live today (`ci.yml:527`) |
| **DOCS-09** | Every stale site justifying the ungated counts is corrected in the SAME commit -- all seven, including the three `echo` strings that print the false claim into the run log. | D-06 / Q6 enumeration |
| **DOCS-10** | The new knob is documented in `docs/configuration.md` (table row AND a `### <KNOB>` resolution section), and `docs/advanced.md`'s "How the backend is selected" grows from four outcomes to five -- including the prose "`selectBackend` has FOUR outcomes" at `:21`. | Q7 guard enumeration |

*Foldable:* an `OBS-06` for the gate's diagnostic message is defensible as its own row but is folded
into **XOS-09** above, because a gate and its failure message are one artefact and splitting them
invites shipping the gate without the message.

## Architecture Patterns

### System Architecture Diagram

```
   .github/workflows/ci.yml -- build-windows / typecheck-windows / test-windows
   |
   |  (1) REGULAR step: writes to $GITHUB_ENV  ->  propagates to later steps
   |      NX_SELF_HOSTED_REMOTE_CACHE_SERVER
   |      NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN
   |      CACHE_READ_ONLY=1                       <-- NEW (the role signal)
   |
   |  (2) BACKGROUND step: uses: ./start-cache-server  (committed esbuild bundle)
   v
 start-cache-server/index.js  ==  bundle of  start-cache-server/entry.ts
   |                                            |
   |                                            v
   |                                  packages/github-cache/src/serve.ts
   |                                            |
   |                                     selectBackend(process.env)
   |                                            |
   |            +-------------------------------+-------------------------------+
   |            |                |              |              |                |
   |     not write-trusted   bad repo id   no token      CACHE_READ_ONLY set   else
   |            |                |              |              |                |
   |            v                v              v              v                v
   |     Releases reader      THROW      RO memory      RO Actions        RW Actions
   |     (ReadableBackend)             (ReadableBackend)   backend          backend
   |                                                     (NEW, no put)   (composes RO)
   |                                                          |                |
   |                                                          +--- shared -----+
   |                                                          |  read core:    |
   |                                                          |  ONE           |
   |                                                          |  restoreCache  |
   |                                                          v
   |                                                    @actions/cache
   |                                                          |
   |            +---------------------------------------------+
   |            |  restore search order (GitHub-enforced):
   |            |    1. current branch scope   (= merge ref on a PR)
   |            |    2. base branch scope      (PR only)
   |            |    3. default branch scope   (main)
   |            v
   |     an entry the ubuntu producer saved  ->  HIT
   |
   |  (3) MEASURED step:  npm run <target> 2>&1 | tee <target>-nx.log
   |         Nx MISS -> executes -> attempts PUT -> server answers 403 (no put on backend)
   |         Nx HIT  -> prints "[remote cache]"
   |
   |  (4) GATE step (was: RECORD step)
   |         count = occurrences of "[remote cache]" in the tee'd log
   |         count < 1  ->  exit 1                <-- NEW (the gate)
   v
 red job  <=>  cross-OS reuse is dead
```

### Recommended Project Structure

No new files in `src/`. Both factories live in the existing module:

```
packages/github-cache/src/
|-- backend/
|   |-- actions-cache-backend.ts       # BOTH factories -- read-only first, writable composes it
|   |-- actions-cache-backend.spec.ts  # existing VER-03 guards + the VER-09 package-scope scan
|   |-- memory-backend.ts              # the structural precedent (unchanged)
|   '-- types.ts                       # the port (unchanged)
|-- lib/
|   |-- select-backend.ts              # gains a FIFTH outcome, as its LAST branch
|   '-- select-backend.spec.ts         # gains the narrowing-only proof
'-- dogfood-cross-os.spec.ts           # gains the per-leg semantic pins
```

**A sibling `readonly-actions-cache-backend.ts` is an automatic REJECT.** Not on taste --
`actions-cache-backend.spec.ts:501-531` reads `./actions-cache-backend.ts` **by name** and asserts
the ordered `cache.*` accesses. A sibling file is invisible to it, so a second `restoreCache` would
land with the whole suite green. That is precisely the drift the ROADMAP names.

### Pattern 1: Read-only base, writable extension (D-01, CONFIRMED)

**What:** The read-only factory is the BASE. The writable factory calls it and spreads its result,
adding `put`. One `get`, one `restoreCache`, one set of construction guards.
**When to use:** Whenever a capability-narrowed variant of an adapter is needed and the narrow form
is a strict subset of the wide one.

```ts
// Source: recommended shape, confirming CONTEXT.md D-01. VERIFIED compatible with
// actions-cache-backend.spec.ts:517-531 (ordered members unchanged) and serve.ts:100-114
// (which already spreads a backend the same way).

export function createReadOnlyActionsCacheBackend(): ReadableBackend {
  // VER-04 cwd + GITHUB_WORKSPACE guards -- UNCHANGED, verbatim, comments included.
  // They belong here, not in the writable factory: a read-only leg has NO write path whose
  // failure would surface, so a cwd divergence would present as "cross-OS restore is broken"
  // (a red gate) instead of naming its actual cause.
  //   ...existing lines 86-109...

  // VER-07 construction-time mkdir -- kept in the shared core (Claude's Discretion, D-CONTEXT).
  // Idempotent under `recursive: true`, so running it on the read-only path costs nothing, and
  // keeping it here is how the writable path inherits it without a second authored call.
  mkdirSync(CACHE_ARCHIVE_DIR, { recursive: true });

  return {
    get(hash: Hash): Promise<GetResult> {
      // ...existing lines 125-163, VERBATIM, including the VER-03 positional comment lock...
    },
    // No put: read-only-ness is structural (ReadableBackend), not a runtime 'forbidden'.
  };
}

export function createActionsCacheBackend(): CacheBackend {
  return {
    ...createReadOnlyActionsCacheBackend(),
    put(hash: Hash, bytes: Buffer): Promise<PutResult> {
      // ...existing lines 167-294, VERBATIM: the second mkdirSync, saveCache,
      // the lookupOnly probe (the SECOND restoreCache, write-path only), the rm...
    },
  };
}
```

Why the spread is safe: these factories return closures over captured state, not `this`-bound
methods -- `serve.ts:93-95` records the same fact and `serve.ts:100-114` already relies on it
[VERIFIED: `serve.ts` read].

### Pattern 2: Narrowing-by-branch-order (Q2, the TRUST-05-compatible signal)

**What:** A narrowing signal is checked LAST, after every existing narrowing branch. The guarantee
"can only narrow" then follows from control flow, not from a comment or a validation rule.
**When to use:** Any context-derived capability reduction that must be provably one-way.

```ts
// Source: recommended shape for lib/select-backend.ts
export function selectBackend(
  env: NodeJS.ProcessEnv = process.env,
): ReadableBackend | WritableBackend {
  if (!isWriteTrusted(env).trusted) {
    return createReleasesReadBackend(createReleasesReadClient(env));   // narrow
  }

  if (!GITHUB_REPOSITORY_PATTERN.test(env.GITHUB_REPOSITORY ?? '')) {
    throw new Error(/* ...unchanged... */);                            // fail-closed
  }

  if (resolveGitHubToken(env) === undefined) {
    return createReadOnlyMemoryBackend();                              // narrow
  }

  // LAST, and the position is the whole guarantee (TRUST-05). Every branch above already
  // returned a read-only backend or thrown, so this check can ONLY convert the one remaining
  // writable outcome into a read-only one. It is structurally incapable of widening -- moving
  // it earlier would break that, which is why the position carries a comment lock.
  //
  // Truthiness, not `=== 'true'`, matching CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION
  // (retention.ts:118). For a NARROWING knob truthiness is the fail-SAFE direction: a typo'd
  // value still narrows, whereas an exact-string comparison would let a typo silently restore
  // the writable backend -- the wrong failure direction for a one-way ratchet.
  if (env.CACHE_READ_ONLY) {
    return createReadOnlyActionsCacheBackend();
  }

  return createActionsCacheBackend();
}
```

### Anti-Patterns to Avoid

- **A sibling module for the read-only backend.** Invisible to the file-scoped `cache.*` guard.
  See Pattern 1.
- **Unifying `put`'s `lookupOnly` probe with the read path.** It is a SECOND `restoreCache`
  (`:260-268`) that must keep `enableCrossOsArchive: true` at the 5th positional, or probing at a
  different cache version reports "absent" for a present entry and every Windows write answers a
  spurious 409. It lives on the write path only and does not exist in the read-only backend, so it
  does not violate D-01's criterion. `actions-cache-backend.spec.ts:476-482` pins its exact
  argument array.
- **A `ServeOptions.readOnly` field.** `serve.ts:22-28` carries an explicit comment lock:
  `shutdownGraceMs` "controls ONLY teardown timing -- it is NOT a mode switch and cannot influence
  RW-vs-RO selection (TRUST-05)". Adding a mode field there requires editing that lock, and it
  would push the signal from the env bag (context) toward the caller (a request). Rejected.
- **A second `selectBackend` parameter.** `select-backend.spec.ts:298-305` asserts
  `selectBackend.length === 0`. An env-bag key keeps it 0; a second parameter does not.
- **Asserting `/exit 1/` to prove the gate exists.** Vacuous -- see Q6.
- **Fixing the count comparison with `-eq 0` instead of `-lt 1`.** Equivalent here, but `-lt 1`
  states the FLOOR that D-05 locked; `-eq 0` reads as an exact pin's negation and invites a future
  reader to "tighten" it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Refusing a PUT to a read-only backend | A `put()` returning `'forbidden'` | Omit `put` entirely; `server.ts:124-129` answers 403 at the protocol boundary | `'forbidden'` was DELETED from `PutResult` (`types.ts:3-8`) precisely so read-only-ness is structural. Re-adding it reopens the closed hole |
| Detecting a writable/read-only backend at runtime | A `kind` discriminator field | `isWritableBackend` (`types.ts:46-50`) | Structural `'put' in backend` check already exists and is already used by `serve.ts:98` |
| Sharing the read implementation | A copy-paste `get` | The composed factory (Pattern 1) | A second `restoreCache` argument list is D-01's automatic reject and the root cause Phase 9 existed to fix |
| Provenance/age checking of a restored entry | A `created_at` witness | Unrepresentability (this phase) | `@actions/cache@6.2.0` exposes no provenance to a restore caller, AND the check fails in both tightening directions -- see Q3 |
| Parsing a boolean env opt-in | A custom `'true'/'1'/'yes'` parser | Truthiness on a non-empty value | The house idiom (`retention.ts:118`); for a narrowing knob it is also the fail-safe direction |
| Server-side read-only enforcement | Waiting for a GitHub lever | The author-supplied knob | No per-job lever exists -- see Q2 |

**Key insight:** every "custom solution" in this domain re-creates a second place for something
version-determining or capability-determining to live. This repo's entire v0.0.2 root cause was one
such duplication.

## Q1 -- VERDICT: what shape makes cache-version drift UNREPRESENTABLE

> **VERDICT: CONFIRM CONTEXT.md D-01's shape -- `createActionsCacheBackend()` returns
> `{ ...createReadOnlyActionsCacheBackend(), put(...) }` -- with ONE hard constraint CONTEXT.md
> did not state: BOTH factories MUST live in `packages/github-cache/src/backend/actions-cache-backend.ts`.
> D-09's shrink-to-a-documented-decision escape hatch is NOT taken.**

### Why the criterion is already mechanically enforced

`actions-cache-backend.spec.ts:501-546` reads the module from disk, strips comment lines
(markers `//`, `/*`, `*/`, `*`), and asserts [VERIFIED: file read]:

```ts
// actions-cache-backend.spec.ts:517-531
const members = [...strippedBackendSource.matchAll(/\bcache\.([A-Za-z_$][\w$]*)/g)]
  .map((match) => match[1]);

expect(members).toStrictEqual(['restoreCache', 'saveCache', 'restoreCache']);
```

plus a companion clause at `:533-546` asserting `@actions/cache` is imported exactly once, in the
namespace form -- which closes the `import { saveCache } from '@actions/cache'` evasion that would
reach the library with no `cache.` prefix.

Under the composed shape the source order is: `restoreCache` (in the read-only factory, declared
first), `saveCache`, `restoreCache` (the probe). The asserted array is **byte-identical** and the
guard passes with **zero edits**. That is the strongest available confirmation of D-01: the
acceptance criterion is not something the phase must newly establish; it is something the phase
must not break, and the recommended shape does not touch it.

### Why the file constraint is hard, not stylistic

The guard's source is `new URL('./actions-cache-backend.ts', import.meta.url)` -- a single named
file. A `readonly-actions-cache-backend.ts` sibling containing its own
`cache.restoreCache([path], key, undefined, undefined, true)` would produce **zero** test failures.
Both the ordered-member clause and the single-import clause would still pass, because neither ever
looks at the sibling. That is exactly the ROADMAP's named risk realised behind a guard that looks
like coverage.

### The gap the existing guard leaves, and the ~6-line close (VER-09)

File scope cannot see a FUTURE sibling. Verified today, exactly one non-spec file under `src/`
imports `@actions/cache` [VERIFIED: `git grep -rn "@actions/cache" packages/github-cache/src --
'*.ts' | rg -v spec` -> `backend/actions-cache-backend.ts:4` only]. Pin that:

```ts
// Source: recommended addition to actions-cache-backend.spec.ts
// Closes the one evasion the file-scoped scans above cannot see: a SIBLING module with its own
// cache.restoreCache. Neither existing clause looks outside this file, so a second version
// computation could land with the whole suite green -- the exact drift Phase 9 existed to remove.
it('is the ONLY non-spec module in the package that reaches @actions/cache (VER-09)', () => {
  const importers = globSync('packages/github-cache/src/**/*.ts', { cwd: workspaceRoot })
    .filter((file) => !file.endsWith('.spec.ts'))
    .filter((file) => readFileSync(join(workspaceRoot, file), 'utf8').includes("'@actions/cache'"));

  expect(importers).toStrictEqual(['packages/github-cache/src/backend/actions-cache-backend.ts']);
});
```

Planner note: prefer whatever workspace-root helper the repo already uses
(`src/test/workspace-root-cwd.ts` exists) over a new path-resolution idiom.

### The four candidates, compared

| Candidate | One version computation? | One implementation? | Verdict |
|---|---|---|---|
| **(a)+(b) merged -- read-only base, writable composes it** *(D-01, RECOMMENDED)* | YES -- one `restoreCache` read site, guard unchanged | YES -- one `get` closure | **ACCEPT** |
| (a) alone -- shared `readFrom`-style helper, two independent factories | YES | YES, via a third named function | Acceptable but strictly more code. Mirrors `memory-backend.ts:9-17` exactly, so it is the conservative choice if the executor is uncomfortable with the spread. Costs one extra function and one extra call site for no capability gain |
| (b) alone -- construct the writable backend, expose through a read-only adapter | YES | YES | **REJECT.** Two independent defects: (i) it CONSTRUCTS a `put` and then discards it, so the write capability exists in the process and is one property-read away -- read-only-ness becomes a wrapper convention rather than a construction fact, weakening D-02a's inductive property from "cannot write" to "does not currently write"; (ii) it runs `createActionsCacheBackend()` (the WRITABLE factory) on read-only legs, so any future write-path construction-time side effect lands there. The merged shape inverts the dependency in the direction the phase's whole stance points: strictly less capability at the base |
| (c) construction-time flag | -- | -- | **REJECT ON SIGHT** (D-03). Recorded below so it is not re-raised |
| (d) do nothing | -- | -- | **REJECT.** The escape hatch is conditional on no shape satisfying the criterion; one does, and it needs zero changes to the guard that enforces it |

### Why (c) stays rejected -- recorded per the ROADMAP's instruction

A `createActionsCacheBackend(readOnly: boolean)` fails on four independent counts, each
independently sufficient:
1. **TRUST-05 as written.** RW-vs-RO is which factory constructs the backend, never a caller-facing
   mode flag. The factory's own comment says so (`actions-cache-backend.ts:25-27`).
2. **A structural assertion already forbids the shape's selector-side twin.**
   `select-backend.spec.ts:298-305` pins `selectBackend.length === 0`.
3. **It reopens the `PutResult` hole.** `'forbidden'` was DELETED from the union
   (`types.ts:3-8`) so read-only-ness became structural. A flagged factory has one return TYPE, so
   `isWritableBackend` becomes true for a read-only instance and the 403 must move back into a
   runtime `put()` return value.
4. **The existing precedent points the other way.** `memory-backend.ts:30,63` ships two
   parameterless factories over one shared helper, with the read-only one returning
   `ReadableBackend`.

### What happens to VER-04 and VER-07 under the recommended shape

| Site | Lines today | Under the recommended shape |
|---|---|---|
| VER-04 cwd probe (`nx.json` existence) | `:86-92` | Moves VERBATIM into `createReadOnlyActionsCacheBackend()`. Runs on BOTH paths. Required on the read-only path *more* than on the writable one: a read-only leg has no write failure to surface, so the divergence would present as "cross-OS restore is broken" rather than naming its cause. The error message's `createActionsCacheBackend:` prefix should become the read-only factory's name or a shared literal -- do not leave it naming a function that no longer runs the check |
| VER-04 `GITHUB_WORKSPACE` identity | `:103-109` | Same -- moves verbatim, runs on both |
| VER-07 construction-time `mkdirSync` | `:111-121` | Stays in the shared core (Claude's Discretion, exercised). Idempotent under `recursive: true`; the writable factory inherits it through the composition call, so it is NOT dropped from the write path (which the CONTEXT explicitly forbids). Zero extra lines vs. moving it into `put` |
| VER-07 per-call `mkdirSync` in `put` | `:170-191` | UNCHANGED, stays on the write path. It re-establishes the directory when `nx reset` deletes it under a running sidecar -- a per-call need with no read-path equivalent (`extractTar`'s `io.mkdirP` self-heals reads) |
| `put`'s `lookupOnly` probe | `:260-268` | UNCHANGED, write path only. Does NOT violate D-01's criterion. Must keep `enableCrossOsArchive: true` at the 5th positional |
| VER-03 positional comment locks | `:127-140`, `:227-238`, `:250-259` | Must survive VERBATIM. The refactor moves the read block into a new function body; the comments move with it, unedited |

## Q2 -- VERDICT: what shape the ROLE signal takes

> **VERDICT: option (a) -- a new strictly-narrowing env knob read by `selectBackend` as its LAST
> branch. Recommended name: `CACHE_READ_ONLY`.**
>
> **Losers:** (b) fails resolution criterion (iii); (c) is a strict superset of (a)'s cost;
> (d) is D-03. **Weighed on public-API-surface cost, not on TRUST-05.** A narrowing knob is
> TRUST-05-COMPATIBLE and no argument below rests on TRUST-05.

### First: is the signal avoidable? No.

CONTEXT.md flagged the 2026-06-26 GitHub changelog as possibly offering a server-side lever that
makes the signal unnecessary. It does not. The changelog states verbatim
[CITED: github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/]:

> "The most common workflow triggers that write to the default-branch cache keep full read-write
> caching. These triggers are `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`,
> `delete`, `registry_package`, and `page_build`. Additionally, any trigger that uses a
> non-default-branch scope, such as `pull_request` and `release`, keeps read-write caching
> permission."

The three Windows legs run on `push` (read-write to the default-branch scope) and same-repo
`pull_request` (read-write to the merge-ref scope). **Both keep read-write.** There is no
`permissions:`-style knob, no per-job opt-in, and no documented workflow-level lever -- the
read-only token is issued from trigger + scope alone. The changelog also confirms the read half is
untouched: *"Restores are unaffected."* So an author-supplied signal is unavoidable, exactly as
D-02b framed it.

### Second: upstream precedent reframes the cost

GitHub's own caching reference recommends the author-side equivalent
[CITED: docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching]:

> "In low-trust workflows, switch to a restore-only cache operation such as `actions/cache/restore`
> to make the intended cache usage clear and avoid the warning in the workflow run logs."

Two things follow. (1) A **separate read-only entrypoint** is the first-party pattern -- GitHub
shipped `actions/cache/restore` rather than `actions/cache` with a `read-only: true` input. That is
independent confirmation of both D-03's rejection and D-01's separate-factory shape. (2) A
read-only opt-in is a **legitimate consumer capability with documented upstream demand**, not
dogfooding plumbing. That materially softens the PROJECT.md Constraints objection: the leak that
constraint forbids is one carrying no consumer value; this one carries value GitHub itself
documents.

The cost is nonetheless real and must be paid honestly: `EXPECTED_ENV_KNOBS` goes 8 -> 9, and the
knob is reachable from the shipped package and the committed public bundle. There is no way to make
it unreachable, and the house rule is that contract changes land as a reviewable diff in an
explicit list (`public-surface.spec.ts:20`), never hidden.

### Option comparison against the locked resolution criteria

| Option | (i) can only narrow | (ii) no 2nd version computation / 2nd drift-guarded bundle | (iii) works on `build-windows` without a pre-build | Verdict |
|---|---|---|---|---|
| **(a) narrowing env knob** | YES -- by branch order, structurally | YES -- one bundle, one backend module | YES -- one `echo` in the existing regular pre-set step | **WIN** |
| (b) internal-action read-only route | YES | NO if a second committed bundle is added | **NO** -- `packages/github-cache/action.yml` sets `main: 'dist/action/index.js'` [VERIFIED: file read], so the action needs `npm run build` first, and `build-windows` exists to MEASURE that build | LOSE on (iii); the escape from (iii) loses on (ii) |
| (c) input on the public `start-cache-server` action | YES | YES | YES | LOSE -- strict superset of (a): changes `EXPECTED_ACTION_INPUTS` (`public-surface.spec.ts:53`, `['port']` today) **and** still needs a runtime channel into `serve()`, which is either (a)'s env var again or a `ServeOptions` field contradicting the `serve.ts:22-28` comment lock |
| (d) construction-time flag | -- | -- | -- | LOSE -- D-03 |
| (e) *not enumerated in CONTEXT.md:* a second public action directory, `actions/cache/restore`-style | YES | **NO** -- a second esbuild bundle and a second `check:action` / `action-bundle-drift` surface | YES | LOSE on (ii). Recorded because the upstream precedent makes it tempting |

### The design that makes "can only narrow" a fact

**Branch order is the guarantee.** Placing the knob check last means every path that could have
been narrowed already returned. The knob's only reachable effect is `writable -> read-only`. It
cannot resurrect the Releases branch, the throwing branch, or the memory-degrade branch, because
control never reaches it from any of them. That is checkable by reading nine lines, and it is
testable exhaustively (see Validation Architecture).

**`selectBackend.length` stays 0.** The knob is a key in the existing env bag, not a parameter.
`select-backend.spec.ts:298-305` passes unchanged.

**The existing TRUST-05 widening test stays green and stays meaningful.**
`select-backend.spec.ts:307-330` spreads "plausible mode-switch keys" onto an UNTRUSTED env and
asserts the put is still forbidden. A narrowing knob does not affect it -- which is the point:
that test proves an env key cannot WIDEN, and the new knob does not try to.

### Wiring cost, per leg: one line

The legs already run a REGULAR step that writes to `$GITHUB_ENV` before the background sidecar
starts (`ci.yml:497-504`, `:586-593`, `:673-680`). `start-cache-server/action.yml`'s own comment
records that a regular step's `$GITHUB_ENV` writes DO propagate, while a background step's do not
[VERIFIED: file read]. So:

```yaml
      - name: Pre-set the Nx cache client vars for the sidecar
        shell: bash
        run: |
          set -euo pipefail
          echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000" >> "$GITHUB_ENV"
          token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
          echo "::add-mask::${token}"
          echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}" >> "$GITHUB_ENV"
          # ROLE, not trust. This leg is a CONSUMER of the ubuntu producer's entry, and role is
          # not derivable from any GitHub-supplied env fact -- push and same-repo pull_request are
          # both correctly write-TRUSTED. Declining the write is what makes the count gate below
          # sound: a leg that cannot write can only get a [remote cache] label from a genuine
          # restore, so no re-run can launder a zero into a green. Strictly narrowing (TRUST-05).
          echo "CACHE_READ_ONLY=1" >> "$GITHUB_ENV"
```

Zero change to `start-cache-server/action.yml`. Zero change to `start-cache-server/entry.ts`.

### Naming (Claude's Discretion, exercised)

Recommend **`CACHE_READ_ONLY`**. The project-owned prefix is `CACHE_` (`CACHE_MIRROR_MAX_AGE_DAYS`,
`CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION`); `MIRROR_` is deliberately omitted because this governs
the Actions cache, not the Releases mirror. `CACHE_ACTIONS_READ_ONLY` is more precise and equally
defensible if the planner prefers explicitness; do not use a `NX_`-prefixed name (that namespace
belongs to Nx) or a `GITHUB_`-prefixed one (that namespace belongs to the runner).

## Q3 -- the witness / `created_at` variant (carried, and rejected on two independent grounds)

> **VERDICT: REJECT. It fails at the API level before its logic is even reached, and its logic
> fails in both tightening directions. Unrepresentability is strictly better.**

### Ground 1 -- `@actions/cache@6.2.0` exposes no provenance to a restore caller

[VERIFIED: `rg` over `node_modules/@actions/cache/lib/`, exit 0]

- `restoreCache` returns `Promise<string | undefined>` -- the matched KEY string and nothing else
  (`lib/cache.d.ts:58`).
- A `creationTime?: string` field exists on `ArtifactCacheEntry`, but only in
  `lib/internal/contracts.d.ts:11`. It is **not** re-exported from `lib/cache.d.ts`, and the entry
  object is never returned to a caller.
- In the shipped v6.2.0 build the only reference is a `core.debug` line in
  `lib/internal/cacheHttpClient.js` that reads `cacheEntry.n` -- a renamed field the declaration
  file does not even describe. So it is unreachable even by reaching into internals.
- The full public surface is `ValidationError`, `ReserveCacheError`, `CacheWriteDeniedError`,
  `CacheReadDeniedError`, `FinalizeCacheError`, `isFeatureAvailable`, `restoreCache`, `saveCache`,
  plus two error-prefix constants. No list/metadata API.

Obtaining provenance would mean a separate REST call to the Actions cache list API with a different
credential and a new code path -- which is a larger surface than the whole phase.

### Ground 2 -- the logic fails in both directions (confirms CONTEXT.md D-02c)

The variant must pick a direction, and both are broken:

| Direction | Fails because |
|---|---|
| "the entry is OLDER than this leg" | An entry written by a PREVIOUS run's Windows leg predates the current leg and passes. Laundering survives -- the exact hole the phase exists to close |
| "the entry was created within THIS run" | Reddens the HEALTHY case. On a PR that does not rotate a target's hash, the ubuntu producer legitimately HITs from main's default-branch scope and writes NOTHING, so the entry predates the run. This is Case B in Q4 below, and it is the common case |

**Which direction it would have to pick, per the CONTEXT's instruction:** "created within THIS run",
because "older than me" does not close laundering at all and therefore buys nothing over today's
ungated counts. And that direction is worse than the status quo, because a gate that reddens the
healthy case gets disabled.

**Why unrepresentability beats it structurally, not just practically:** the witness is a
*detection* mechanism running after the confound exists, so it inherits the confound's ambiguity
and can only trade false-negatives against false-positives. Read-only-ness *removes* the confound
at its source, and the resulting property is inductive (D-02a) rather than per-run -- it holds for
every future run without anything having to be true of the current one.

## Q4 -- VERDICT: the PR base-scope READ half

> **VERDICT: CONFIRMED by authoritative GitHub documentation, in two independent sentences. NOT yet
> reproduced in this repo, and it CANNOT be reproduced by this phase's own landing commit. Sequence
> the reproduction as a separate, later PR.**

### The authoritative text

[CITED: docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching, section
"Restrictions for accessing a cache"]

> "Workflow runs can restore caches created in either the current branch or the default branch
> (usually `main`). If a workflow run is triggered for a pull request, it can also restore caches
> created in the base branch, including base branches of forked repositories."

> "When a cache is created by a workflow run triggered on a pull request, the cache is created for
> the merge ref (`refs/pull/.../merge`). Because of this, the cache will have a limited scope and
> can only be restored by re-runs of the pull request. It cannot be restored by the base branch or
> other pull requests targeting that base branch."

And the search order, same document, section "Cache key matching":

> "The `cache` action first searches for cache hits for `key` and the cache *version* in the branch
> containing the workflow run. ... If there are still no hits in the current branch, the `cache`
> action retries the same steps on the default branch. Please note that the scope restrictions apply
> during the search."

So: a PR run reads from **merge-ref scope, then base branch, then default branch**, and writes only
into **merge-ref scope**. Both halves confirmed; the WRITE half was already evidenced in-repo by PR
#12's dogfood run.

### Why the two cases must be separated, and why the landing commit only proves one

| Case | Trigger condition | Producer behaviour | Consumer restores from | Exercises the READ half? |
|---|---|---|---|---|
| **A** | the PR rotates the target's hash | ubuntu MISSes, executes, SAVEs into merge-ref scope | merge-ref scope (same run) | **NO** |
| **B** | the PR does NOT rotate the target's hash | ubuntu HITs from main's scope and writes nothing | base / default-branch scope | **YES** |

**This phase's landing commit is Case A for all three legs.** It edits
`packages/github-cache/src/**/*.ts`, which is a declared `build` input (`nx.json:114`) and reaches
`typecheck` and `test` the same way; and it edits `.github/workflows/ci.yml`, `docs/configuration.md`
and `docs/advanced.md`, all declared `test` inputs (`nx.json:70,62,64`) [VERIFIED: file read]. So
all three hashes rotate, the ubuntu producers MISS-and-SAVE, and the gate goes green on the
intra-run merge-ref path alone -- proving liveness, proving nothing about the base-scope read.

### The concrete in-repo observation (proposal)

The observation is **free** -- the per-leg counts are already printed, and after this phase they
are already gated. Force Case B deliberately:

1. Land Phase 13 on `main` (so main's default-branch scope holds fresh entries for all three
   targets).
2. Open a PR whose diff touches **no declared input of `build` or `typecheck`**. A `.planning/`-only
   diff qualifies: `build`'s inputs are `{projectRoot}/src/**/*.ts` plus a few configs
   (`nx.json:109-116`), and nothing under `.planning/` appears in any target's input list.
   (Deliberately exclude `test` from the claim -- its input list includes `ci.yml` and five `docs/`
   files, so it is easier to rotate by accident.)
3. Observe `build-windows` and `typecheck-windows`. Their producers should log a cache HIT and
   write nothing; the Windows legs should still report `count >= 1`.
4. **That green IS the reproduction.** It cannot be explained by the merge-ref path, because
   nothing wrote into the merge-ref scope during the run.

Record it in the phase's evidence file with the run id, the producer legs' HIT lines, and the three
counts -- the `09-EVIDENCE.md` / `11-EVIDENCE.md` idiom.

### If it does NOT hold

The **backend shape is unaffected** -- this is purely about D-04's threshold and its skip/
expected-zero conditions, exactly as CONTEXT.md predicted. The fallbacks, in preference order:

1. Gate on `push` only, and keep the counts as diagnostics on `pull_request`. Loses pre-merge
   signal but keeps the inductive property and the post-merge gate.
2. Add a documented Case-B exemption -- but note this reintroduces coupling to the producer's log
   (the gate would need to read whether the producer executed), which is the kind of cross-job
   dependency XOS-06 warns against. Prefer (1).

**Note the second-order effect either way:** once the legs are read-only, a Case-B MISS is
permanent for that hash on Windows -- no self-produced entry ever fills it. That is the intended
behaviour and the source of the gate's power, but it means a Case-B failure is a *hard* red rather
than a first-run-only red.

## Q5 -- how the three legs get wired

### Per-leg changes to `.github/workflows/ci.yml`

| Leg | Job key line | Pre-set step (add the knob) | Count step (convert to a gate) | Stale comment block |
|---|---|---|---|---|
| `build-windows` | 482 | 497-504 | 563-568 | 548-562 |
| `typecheck-windows` | 571 | 586-593 | 650-655 | 637-649 |
| `test-windows` | 658 | 673-680 | 737-742 | 724-736 |

[VERIFIED: `.github/workflows/ci.yml` read at those offsets]

**Change 1 -- the knob.** One `echo` line in the existing pre-set step (see Q2 above). Nothing else
in the sidecar block changes: `uses: ./start-cache-server` stays, `background: true` stays, the
`env: GITHUB_TOKEN` block stays (still required -- without a token `selectBackend` takes the
memory-degrade branch BEFORE reaching the knob, which is a permanent MISS and would redden the new
gate for the wrong reason).

**Change 2 -- the gate.** Replace the record step. Keep the same count computation and keep
printing the number (D-05: numbers stay diagnostics, the floor is the gate).

```yaml
      - name: Gate on the cross-OS remote-cache label count for this leg
        shell: bash
        run: |
          set -euo pipefail
          count=$({ grep -o -F '[remote cache]' build-nx.log || true; } | wc -l | tr -d '[:space:]')
          echo "remote-cache label occurrences on windows-11-arm (build): ${count}"
          if [ "${count}" -lt 1 ]; then
            echo "::error::build-windows saw ZERO [remote cache] labels. This leg runs a READ-ONLY backend, so it cannot have produced this entry itself -- a HIT here is necessarily the ubuntu producer's. Zero therefore means one of exactly two things: (1) cross-OS restore is broken (an @actions/cache regression, or a cache-version drift), or (2) the ubuntu 'build' job never populated the entry this run. Check the 'build' job's own log for a HIT or a save before assuming (1)." >&2
            exit 1
          fi
```

The `|| true` inside the substitution stays -- it keeps a legitimate zero *reaching the comparison*
instead of aborting the pipeline under `pipefail`, which is what makes the diagnostic message
reachable at all. Removing it turns a clear gate failure into an opaque one.

### The committed bundle MUST be regenerated in the same commit

`start-cache-server/index.js` is a committed esbuild bundle of `start-cache-server/entry.ts`, built
with `bundle: true` (`esbuild.action.mjs:31-43`), and `entry.ts:19` imports `serve()` from the
package source. `serve.ts:12` imports `selectBackend`; `select-backend.ts:1` imports
`createActionsCacheBackend`. So **both files this phase edits are inlined into the bundle**
[VERIFIED: import chain read].

- Regenerate with `npm run build:action` (= `node esbuild.action.mjs`).
- `npm run check:action` is `npm run build:action && git diff --exit-code -- start-cache-server/index.js`
  (`package.json:18`), and the `action-bundle-drift` job (`ci.yml:128`) runs it with no `if:`.
  Skipping the regeneration fails **that commit**.
- **Run it from the MAIN tree, never a junctioned worktree.** A junctioned `node_modules` makes
  esbuild rewrite module paths and report false drift (recorded project hazard).

Hash note: `start-cache-server/entry.ts` and `start-cache-server/action.yml` ARE declared `test`
inputs (`nx.json:59-60`), but `start-cache-server/index.js` is NOT listed -- so the regeneration
itself does not rotate `test`. The source edits do.

### What the gate still does not cover (put this in the comment, per CONTEXT)

The three legs run the PUBLIC `./start-cache-server` committed bundle; the dogfood pair runs
`uses: ./packages/github-cache`, built in-job (`ci.yml:1712`, `:1777`). `action-bundle-drift` is
what ties bundle to source. Say this explicitly rather than letting a reader over-read the new gate
-- the same over-reading is what CR-18 caught the first time.

## Q6 -- what must be pinned so this cannot silently revert

### The stale sites: SEVEN, not four

CONTEXT.md D-06 names four. There are **seven**, and the three it misses are the ones a reader
actually sees -- they are `echo` strings printed into the run log, not comments.

| # | File | Lines | The claim that becomes FALSE | Class |
|---|---|---|---|---|
| 1 | `.github/workflows/ci.yml` | 548-562 | The full 15-line `build-windows` rationale: "RECORDED, never GATED"; "Gating on a non-zero count would be a LAUNDERABLE gate rather than coverage"; "This leg writes through a WRITABLE sidecar"; "A gate a re-run can launder is worse than no gate"; "The run-scoped, provenance-checked dogfood-verify canary is the gate instead" | comment |
| 2 | `.github/workflows/ci.yml` | 637-649 | `typecheck-windows` one-line form: "A `count >= 1` gate here would be LAUNDERABLE, not coverage: the leg writes through a WRITABLE sidecar..." | comment |
| 3 | `.github/workflows/ci.yml` | 724-736 | `test-windows` one-line form, same text | comment |
| 4 | `.github/workflows/ci.yml` | 568 | `echo "... (build): ${count} -- RECORDED, never gated"` | **printed string** |
| 5 | `.github/workflows/ci.yml` | 655 | same, `(typecheck)` | **printed string** |
| 6 | `.github/workflows/ci.yml` | 742 | same, `(test)` | **printed string** |
| 7 | `packages/github-cache/src/dogfood-cross-os.spec.ts` | 774-791 | `cacheObservation`: "This clause is about the RECORD existing, never about its VALUE: the count is deliberately not gated because it is LAUNDERABLE -- this leg writes through a WRITABLE sidecar, so a broken cross-OS restore makes it MISS, execute and SAVE its own entry..." | **test failure message** |

[VERIFIED: all line numbers read directly]

**Sites 4-6 matter disproportionately.** `dogfood-cross-os.spec.ts:54` strips only `#`-prefixed
lines, so comments (1-3) are invisible to every spec -- but the `echo` strings are CODE, survive the
strip, and are the text an operator reads in the job log. A gate that prints "RECORDED, never
gated" is self-refuting.

**Also worth checking during planning (likely still TRUE, do not change reflexively):**
`ci.yml:529-542` / `:618-631` / `:705-718`, the tee'd-step rationale blocks. Their claims ("these
per-target records are the only runtime observation of THAT"; "on a fork pull request ... the only
cross-OS signal at all") survive this phase. Verify rather than assume.

### The spec pin, and the vacuity trap that will otherwise sink it

The current `cacheObservation` clause asserts only two step NAMES [VERIFIED:
`dogfood-cross-os.spec.ts:917-926`]:

```ts
expect(block, cacheObservation).toMatch(/^ {6}- name: Run the build target and tee its output$/m);
expect(block, cacheObservation).toMatch(/^ {6}- name: Record the remote-cache label occurrence count for this leg$/m);
```

That is exactly the Phase-12 / CR-01 failure mode: a step renamed to "Gate on ..." that merely
echoes would satisfy the renamed clause. The new clauses must assert the SEMANTIC change:

1. **The leg cannot write.** Match the knob's `$GITHUB_ENV` write inside the job block. Non-vacuous
   for free: `jobBlock` throws on an absent job (`:67-71`) and the file is comment-stripped
   (`:54`), so a knob named only in a comment cannot satisfy it.
2. **The count is compared, and the comparison can fail.** Match the comparison line literally.
3. **The revert marker is absent.** `expect(block).not.toContain('RECORDED, never gated')` -- the
   cheapest true revert-detector available, and it costs one line.

> **VACUITY TRAP -- verified live, and it will fire.** `jobBlock('build-windows')` spans
> `ci.yml:482-569`, and line **527** is `exit 1` inside the "Wait for the loopback sidecar" step.
> It is not a comment, so the strip does not remove it. Therefore
> `expect(block).toMatch(/exit 1/)` **passes today, before the phase changes anything.** An
> `exit 1` assertion is not evidence of a gate. The COMPARISON line is the load-bearing half and
> must be matched literally -- and the executor should prove non-vacuity the way this file's own
> `cacheClient` clause was proven (`:886-893`): mutate the gate step out, confirm the new clause
> goes red and nothing else does.

```ts
// Source: recommended shape, per leg, in dogfood-cross-os.spec.ts
it('runs the sidecar READ-ONLY, so a [remote cache] label can only come from a genuine restore', () => {
  const block = jobBlock('build-windows');

  expect(block, readOnlyLeg).toMatch(/^\s+echo "CACHE_READ_ONLY=1" >> "\$GITHUB_ENV"$/m);
});

it('GATES the remote-cache count rather than merely recording it', () => {
  const block = jobBlock('build-windows');

  // The COMPARISON, not a bare `exit 1`. This job block already contains an `exit 1` at the
  // sidecar readiness poll, so an /exit 1/ assertion is satisfied by a leg with no gate at all
  // -- it was green before this clause existed. Matching the comparison is what makes the
  // clause mean anything.
  expect(block, gatedCount).toMatch(/^\s+if \[ "\$\{count\}" -lt 1 \]; then$/m);
  // The revert marker: a writable sidecar comes back wearing this string.
  expect(block, gatedCount).not.toContain('RECORDED, never gated');
});
```

## Common Pitfalls

### Pitfall 1: The read-only factory lands in a sibling file

**What goes wrong:** A second `cache.restoreCache(...)` argument list ships with every spec green.
**Why it happens:** It looks like good separation, and `memory-backend.ts` co-locates its two
factories so quietly that the constraint reads as coincidence.
**How to avoid:** Both factories in `actions-cache-backend.ts`. Add the VER-09 package-scope scan so
the constraint is enforced rather than remembered.
**Warning signs:** A new file matching `*actions-cache*.ts`; `actions-cache-backend.spec.ts`
passing unchanged after a large backend refactor (which is correct for the composed shape and
suspicious for any other).

### Pitfall 2: The gate spec asserts `exit 1`

**What goes wrong:** The clause is green before the phase does anything, and stays green through a
full revert.
**Why it happens:** `exit 1` is the obvious needle, and the readiness poll's own `exit 1` is
~40 lines away inside the same job block.
**How to avoid:** Assert the comparison line. Prove non-vacuity by mutation.
**Warning signs:** A new spec clause that passes on the first run without any workflow edit.

### Pitfall 3: The committed bundle is not regenerated

**What goes wrong:** `check:action` / `action-bundle-drift` fails that commit.
**Why it happens:** The bundle is generated output that lives in git and looks untouched by a
`src/` edit.
**How to avoid:** `npm run build:action` in the SAME commit, from the MAIN tree.
**Warning signs:** A commit touching `select-backend.ts` or `actions-cache-backend.ts` with no
`start-cache-server/index.js` in its file list.

### Pitfall 4: `check:action` reports drift that is not real

**What goes wrong:** Hundreds of module paths rewritten with no source change; the executor
"fixes" it by committing a corrupted bundle.
**Why it happens:** A junctioned `node_modules` in a worktree makes esbuild resolve differently.
**How to avoid:** Run `build:action` / `check:action` from the main tree only. Pin this in the plan.
**Warning signs:** A bundle diff whose stat is enormous relative to a two-function refactor.

### Pitfall 5: The knob check is placed before an existing narrowing branch

**What goes wrong:** The one-way ratchet breaks silently. Placed before the token check, for
example, a set knob would bypass the memory-degrade branch -- changing behaviour on a path it has
no business touching.
**Why it happens:** "Check the explicit signal first" is a reasonable-sounding instinct.
**How to avoid:** Last branch, with a comment lock naming the position as the guarantee, plus the
exhaustive narrowing spec.
**Warning signs:** The knob check appearing above `resolveGitHubToken`.

### Pitfall 6: The VER-04 error message keeps naming the wrong function

**What goes wrong:** A cwd divergence on a read-only leg throws
`createActionsCacheBackend: the process cwd must be...` from a function that did not run, sending
the operator to the wrong place.
**Why it happens:** The message is a template literal inside the block being moved.
**How to avoid:** Rename to the read-only factory or a shared literal when the guards move.
**Warning signs:** `git grep -n "createActionsCacheBackend:" packages/github-cache/src` returning
hits inside the read-only factory body.

### Pitfall 7: Assuming the landing commit proves the base-scope read

**What goes wrong:** Q4's platform assumption is recorded as reproduced when only the intra-run
merge-ref path was exercised.
**Why it happens:** The gate is green and the run is a PR, so it looks like the PR case was proven.
**How to avoid:** Case A vs Case B (Q4). The landing commit is Case A by construction.
**Warning signs:** Evidence text claiming the READ half is reproduced, citing a run whose ubuntu
producers all executed.

### Pitfall 8: Dropping `|| true` from the count computation

**What goes wrong:** Under `set -euo pipefail`, a zero-match `grep` exits 1 and aborts the step
BEFORE the comparison, so the gate fails with an opaque non-zero instead of the diagnostic.
**Why it happens:** The `|| true` looks like leftover permissiveness once a gate exists.
**How to avoid:** Keep it, and say in the comment that it exists so a legitimate zero REACHES the
comparison.
**Warning signs:** A red gate with no `::error::` annotation in the log.

## Code Examples

### Reading the pinned `@actions/cache` signature (the VER-03 source of truth)

```ts
// Source: node_modules/@actions/cache/lib/cache.d.ts:58,68 (exact-pinned 6.2.0)
export declare function restoreCache(
  paths: string[], primaryKey: string, restoreKeys?: string[],
  options?: DownloadOptions, enableCrossOsArchive?: boolean,
): Promise<string | undefined>;

export declare function saveCache(
  paths: string[], key: string, options?: UploadOptions, enableCrossOsArchive?: boolean,
): Promise<number>;
```

`restoreCache` -> flag at the **5th** positional. `saveCache` -> flag at the **4th**. Upstream's
JSDoc for `saveCache` documents them in the reverse order and is wrong; `actions-cache-backend.ts:230-238`
already carries that comment lock and it must survive verbatim.

### The existing structural precedent (what NOT to copy literally, and why)

```ts
// Source: packages/github-cache/src/backend/memory-backend.ts:9-17,30,63
function readFrom(store: Map<string, Buffer>, hash: string): GetResult { /* ... */ }

export function createWritableMemoryBackend(): CacheBackend { /* uses readFrom */ }
export function createReadOnlyMemoryBackend(): ReadableBackend { /* uses readFrom */ }
```

Two INDEPENDENT factories over a shared helper. Valid, and the recommended fallback if the executor
is uncomfortable with the spread -- but the composed shape is fewer lines, shares the VER-04 guards
and the VER-07 mkdir with no extra plumbing, and expresses the read-only form as the BASE rather
than as a sibling. Prefer composition here; the memory backend's two stores are genuinely
independent, whereas these two share construction-time state.

### The 403 path that already exists (no change needed)

```ts
// Source: packages/github-cache/src/server/server.ts:124-129
// PUT to a read-only backend -> the Nx contract's 403 ("read-only token used to write").
res.statusCode = 403;
```

Every task that MISSes on a read-only leg will now attempt a PUT and receive a 403 instead of a 200.
This is the documented, non-fatal outcome for the two existing read-only backends
(`docs/advanced.md:26,28`: "every write a `403`, silently -- no error";
`docs/trust-and-security.md:129`), and `server.spec.ts:359-370` already covers it. No protocol-layer
change is expected. **Planner note:** confirm in the landing run's log that a MISSing task's 403
does not produce Nx noise a reader would mistake for a failure; if it does, that is a docs/comment
item, not a code one.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `actions/cache` with an implicit save-on-miss everywhere | A separate `actions/cache/restore` entrypoint for restore-only use | GitHub docs, current | First-party precedent that read-only is a SEPARATE ENTRYPOINT, not a mode input. Confirms D-03's rejection independently |
| Read-write cache tokens for every workflow event | Read-only tokens for untrusted triggers resolving to the default-branch scope | 2026-06-26 | Does NOT cover `push` or `pull_request`, so it offers this phase no lever. Its existence is why `HOST_GATED_EVENTS` widening is safe on github.com |
| OS-partitioned Actions-cache version (inherited `os.tmpdir()`) | OS-invariant workspace-relative constant + hardcoded `enableCrossOsArchive` | Phase 9, v0.0.2 | The reason a second version computation is this phase's named risk |

**Deprecated / outdated in this repo:**
- `PutResult`'s `'forbidden'` member: DELETED (`types.ts:3-8`). Do not reintroduce.
- The "OBS-04 cross-run lesson" justification for ungated counts: already corrected by quick task
  `260801-vyy`. The *current* justification (launderability) is what this phase falsifies.

## Runtime State Inventory

Not a rename/refactor of persisted identifiers, but the categories are checked because this phase
changes what a running system is ALLOWED to do, and one category is non-empty.

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | **None.** No key, prefix or namespace changes. `cacheKeyFor` and `CACHE_KEY_PREFIX` are untouched, so every existing Actions-cache entry and Releases asset stays addressable | none |
| Live service config | **None.** No external service holds config for this repo's cache behaviour; the sidecar is per-job and ephemeral | none |
| OS-registered state | **None.** No scheduled tasks, no daemons. The `windows-regression-detector.yml` schedule is untouched | none |
| Secrets / env vars | **One, additive.** `CACHE_READ_ONLY` is a NEW env var name. It is not a secret, is set inline in `ci.yml` (not from `secrets.`), and no existing name changes. `GITHUB_TOKEN` still must reach the sidecar step's `env:` on all three legs -- removing it takes the memory-degrade branch BEFORE the knob and would redden the new gate for the wrong reason | verify the `env: GITHUB_TOKEN` block survives on all three legs |
| Build artifacts | **One, and it is mandatory.** `start-cache-server/index.js` is a COMMITTED esbuild bundle inlining both edited modules. It does not auto-update from a source edit | `npm run build:action` in the SAME commit, from the MAIN tree |

**Second-order runtime effect worth recording:** once the legs are read-only, a MISS on a Windows
leg is permanent for that hash -- no self-produced entry ever backfills it. That is the intended
mechanism, but it changes the failure mode from "red once, green on re-run" to "red until the
producer side is fixed". Say so in the gate's comment.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | everything | YES | per `.node-version` | -- |
| npm | `npm run build:action`, `npm run test` | YES | bundled | -- |
| `@actions/cache` | the backend | YES (installed) | 6.2.0 exact | -- |
| esbuild | bundle regeneration | YES (installed) | existing pin | -- |
| `windows-11-arm` runner | the three legs + the gate observation | CI-only | -- | none -- the gate is unobservable locally by construction |
| A real GitHub Actions cache service | the cross-OS restore | CI-only | -- | none |

**Missing dependencies with no fallback:** none for implementation. The gate's *observation* is
CI-only, which is why the spec pins job SHAPE from disk and the behavioural proof is a run id. This
matches the file's own recorded rationale (`dogfood-cross-os.spec.ts:5-9`: "a spec runs in one
process on one OS and cannot observe a two-OS property").

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest, via `@nx/vitest` (`nx.json:28-32`, `testTargetName: "test"`) |
| Config file | `packages/github-cache/vitest.config.mts` |
| Quick run command | `npx nx test github-cache` |
| Full suite command | `npm run test` (= `nx run-many -t test`) |
| Bundle drift check | `npm run check:action` -- MAIN TREE ONLY |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| VER-08 | Exactly one `cache.restoreCache` READ site; ordered members unchanged | unit (source scan) | `npx nx test github-cache -- actions-cache-backend` | YES -- `backend/actions-cache-backend.spec.ts:517-531`, passes unchanged |
| VER-08 | The read-only factory returns a `ReadableBackend` with NO `put`; `isWritableBackend` is false | unit | `npx nx test github-cache -- actions-cache-backend` | NO -- Wave 0 |
| VER-08 | Both factories share ONE `get`: the read-only one and the writable one restore identically | unit | `npx nx test github-cache -- actions-cache-backend` | NO -- Wave 0 |
| VER-08 | VER-04 guards fire from the READ-ONLY factory too (wrong cwd throws; divergent `GITHUB_WORKSPACE` throws) | unit | `npx nx test github-cache -- actions-cache-backend` | NO -- Wave 0 |
| VER-08 | `enableCrossOsArchive` still at the 5th/4th/5th positional across all three sites | unit | `npx nx test github-cache -- actions-cache-backend` | YES -- `:431-488`, must stay green |
| VER-09 | Exactly one non-spec module under `src/` imports `@actions/cache` | unit (glob scan) | `npx nx test github-cache -- actions-cache-backend` | NO -- Wave 0 |
| TRUST-14 | `selectBackend.length === 0` unchanged | unit | `npx nx test github-cache -- select-backend` | YES -- `select-backend.spec.ts:298-305` |
| TRUST-14 | Knob set + fully write-trusted env -> read-only Actions backend (`isWritableBackend` false) | unit | `npx nx test github-cache -- select-backend` | NO -- Wave 0 |
| TRUST-14 | **Narrowing-only, exhaustive:** for every enumerated env shape, setting the knob NEVER makes a backend writable that was not writable without it | unit (table-driven) | `npx nx test github-cache -- select-backend` | NO -- Wave 0. **This is the load-bearing clause.** Enumerate at minimum: untrusted event; `pull_request_target` on a guarded host; write-trusted + malformed repo id (still throws); write-trusted + no token; write-trusted + token. Assert the implication in the correct direction -- `writable(withKnob) => writable(withoutKnob)` -- never a negated matcher inside a single call assertion |
| TRUST-14 | Truthiness semantics: a non-empty typo value still NARROWS (fail-safe direction) | unit | `npx nx test github-cache -- select-backend` | NO -- Wave 0 |
| XOS-09 | Each Windows leg writes the read-only knob to `$GITHUB_ENV` | unit (from-disk `ci.yml` pin) | `npx nx test github-cache -- dogfood-cross-os` | NO -- Wave 0 |
| XOS-09 | Each Windows leg's count is COMPARED and the comparison can fail | unit (from-disk pin) | `npx nx test github-cache -- dogfood-cross-os` | NO -- Wave 0. **Assert the comparison line, never `exit 1`** |
| XOS-09 | The gate actually reddens on a real cross-OS restore failure | **CI-only behavioural** | observed on a real `windows-11-arm` run | N/A -- record a run id |
| TEST-11 | The literal `RECORDED, never gated` is absent from all three job blocks | unit (from-disk pin) | `npx nx test github-cache -- dogfood-cross-os` | NO -- Wave 0 |
| TEST-11 | The new clauses are NON-VACUOUS (mutation-proven) | manual, recorded | mutate the gate step out; confirm the clause reddens and nothing else does | N/A -- record in the plan's verification |
| DOCS-09 | No stale site survives | manual + the TEST-11 negative | `git grep -n "RECORDED, never gated\|WRITABLE sidecar" -- .github packages` returns nothing | partially automated |
| DOCS-10 | The knob is documented in `configuration.md` | unit | `npx nx test github-cache -- docs-adoption` | YES -- `docs-adoption.spec.ts:52-54,82`, `it.each(EXPECTED_ENV_KNOBS)`; passes once the doc names it |
| DOCS-10 | `EXPECTED_ENV_KNOBS` matches the reviewed inline literal | unit | `npx nx test github-cache -- public-surface` | YES -- `public-surface.spec.ts:159-170`; **will FAIL until the literal is updated -- that failure IS the reviewable diff** |
| DOCS-10 | `advanced.md` documents FIVE outcomes, not four | unit | `npx nx test github-cache -- docs-adoption` | NO -- Wave 0 (only if a count assertion is wanted; the prose at `advanced.md:21` says "FOUR outcomes") |
| (bundle) | The committed bundle matches source | integration (CI job) | `npm run check:action` | YES -- `package.json:18`, `ci.yml:128` |

### Sampling Rate

- **Per task commit:** `npx nx test github-cache` (the whole package suite; it is fast and the
  from-disk pins are cheap).
- **Per wave merge:** `npm run test` **plus** `npm run check:action` from the main tree. The bundle
  check is NOT part of `nx test` and is the single most likely thing to be forgotten.
- **Phase gate:** full suite green + `check:action` clean + a real CI run showing all three
  gated legs green, before `/gsd:verify-work`.
- **Post-merge, separate PR:** the Q4 Case-B observation (see Q4). Do NOT fold it into the landing
  commit; the landing commit cannot exhibit Case B.

### Wave 0 Gaps

- [ ] `backend/actions-cache-backend.spec.ts` -- new describes for the read-only factory
      (no `put`; shared `get`; VER-04 guards fire from it) -- covers VER-08
- [ ] `backend/actions-cache-backend.spec.ts` -- the package-scope `@actions/cache` importer scan
      -- covers VER-09
- [ ] `lib/select-backend.spec.ts` -- the knob's read-only outcome, the exhaustive narrowing-only
      table, and the truthiness semantics -- covers TRUST-14
- [ ] `dogfood-cross-os.spec.ts` -- three new per-leg clauses (knob write, count comparison, absent
      revert marker) plus their reason strings -- covers XOS-09 / TEST-11
- [ ] Framework install: **none needed** -- Vitest is present and configured

## Security Domain

### Applicable ASVS Categories (level 1)

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | No auth surface changes. The per-process CSPRNG bearer token path is untouched |
| V3 Session Management | no | No sessions |
| V4 Access Control | **yes** | This phase IS an access-control narrowing. The control is structural: `ReadableBackend` has no `put`, so the write is unrepresentable rather than refused. The protocol boundary (`server.ts:124-129`) answers the contract's 403. Do NOT reintroduce a runtime `'forbidden'` |
| V5 Input Validation | **yes (minimal)** | One new env value, consumed only as a truthiness test -- no parsing, no interpolation into a command, a path or a URL. The fail-safe direction is narrowing, so a hostile or malformed value can only REDUCE capability |
| V6 Cryptography | no | Untouched |
| V14 Configuration | **yes** | The knob is new configuration on a shipped package. It must be documented (`configuration.md`) and enumerated in the contract guards, per the house rule that contract changes land as a reviewable diff |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation | Status in this phase |
|---|---|---|---|
| Cache poisoning (CREEP / CVE-2025-36852) | Tampering | Write-scope isolation aligned to VCS trust (C1) + the separate sync gate (C2) | **Strengthened, never weakened.** The phase removes a write position; it adds none |
| A caller requesting elevated capability via config | Elevation of Privilege | RW-vs-RO by construction, never a caller flag (TRUST-05) | Preserved by branch order + `selectBackend.length === 0` + the exhaustive narrowing test |
| A guard that passes over a wrong payload | Repudiation | Assert the semantic outcome, not the presence of a string | The live `exit 1` vacuity trap is the concrete instance -- see Q6 |
| Secret leakage through a new env channel | Information Disclosure | The knob carries no secret and is set inline, not from `secrets.` | N/A |

### C1-C18 control ledger: what this phase touches

| Control | Touched? | Assessment |
|---|---|---|
| **C1** Write-trust allowlist; "a blocked write is a benign 409/no-op" | **Adjacent, NOT contradicted** | C1's 409 describes a write BLOCKED AT THE STORE. This phase blocks one layer earlier: the backend has no `put`, so `server.ts` answers 403 at the protocol boundary and `saveCache` is never attempted. 403-on-a-read-only-backend is the ESTABLISHED behaviour of the two existing read-only outcomes (`advanced.md:26,28`), not a new one. C1's 409 path lives on the writable backend and is untouched |
| **C2** Sync gate = `{push,schedule}` only | **No** | `isSyncTrusted` is not read by `selectBackend`. The publish path is a different entrypoint (`packages/github-cache/action.yml`, `operation: publish`) and never uses the sidecar |
| **C3** No-overwrite / 409 per adapter | **No** | The writable backend's `put` is byte-identical after the refactor |
| **C5 / C7** Signing / attestation | **No** | Unaffected |
| **C8** Retention: native Actions LRU, no manifest | **Worth one recorded sentence** | The intuition runs backwards here. A read-only leg no longer refreshes an entry's clock by WRITING -- but GitHub's policy is "removed if not ACCESSED in over 7 days" [CITED: dependency-caching reference], and a restore IS an access. So a read-only consumer still refreshes the entry it restores. **No retention regression.** Record it so a future reader does not "fix" a non-problem |
| **C16** Mirror filter admits only server-produced keys | **No** | `CACHE_KEY_PREFIX` and `isServerProducedKey` untouched |
| C4, C6, C9-C15, C17, C18 | **No** | Out of this phase's blast radius |

### THREAT-MODEL.md: recommended action

**Add NO new control row. Add ONE line to `## Residual notes`, and record the no-row decision
explicitly** so the security auditor does not read the ledger's silence as an omission.

Rationale: the ledger's stated criterion is "keep only what has no canonical home"
(`THREAT-MODEL.md:86`), and this phase strictly REDUCES capability -- it opens no attack surface and
introduces no new trust boundary. The one fact without a canonical home is the knob's asymmetry:
`CACHE_READ_ONLY` is a strictly-narrowing consumer knob whose only reachable effect is to remove
`put`, and that guarantee comes from BRANCH ORDER in `selectBackend`, not from validation. One
sentence, in Residual notes, naming the position as the guarantee.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | The Nx client tolerates a PUT 403 without failing the build or producing alarming output | Q5 / Code Examples | LOW. The two existing read-only backends already 403 every write and `docs/advanced.md:28` documents it as silent. The blast radius is log noise, addressed by a comment, not by code. **Confirm on the landing run** |
| A2 | `.planning/**` is in no target's declared Nx input set, so a `.planning`-only PR rotates no hash | Q4 observation | MEDIUM for the observation's design only. If wrong, the Case-B PR silently becomes Case A and proves nothing. **Verify with `npx nx show project github-cache --json` or a `capture-hashes.mjs` run before opening that PR** -- do not assume it |
| A3 | `CACHE_READ_ONLY` is the right name (vs `CACHE_ACTIONS_READ_ONLY`) | Q2 | LOW -- explicitly Claude's Discretion, and renaming before merge is cheap. Renaming AFTER a release is not, so settle it in the plan |
| A4 | The `ci.yml:529-542` / `:618-631` / `:705-718` tee-rationale blocks remain factually TRUE after this phase | Q6 | LOW-MEDIUM. Verify line by line during planning; D-06's whole point is that a partially-corrected N-copy comment is this repo's recurring defect |
| A5 | The composed spread preserves the ordered `cache.*` member array exactly | Q1 | LOW. It follows from source order, and `npx nx test github-cache -- actions-cache-backend` proves it in seconds. Run it first |
| A6 | GitHub has not, since the 2026-06-26 changelog, added a per-job read-only cache lever | Q2 | LOW. Two sources checked (the changelog and the current dependency-caching reference); neither mentions one. If one appeared it would SIMPLIFY the phase, not break it |

## Open Questions

1. **Does the Q4 Case-B observation belong in this phase or the next?**
   - What we know: the phase's landing commit is Case A by construction and cannot exhibit Case B.
     The observation itself is free (the counts are already printed).
   - What's unclear: whether a phase may close with a `human_needed` live-CI item. Phase 12
     precedent says yes -- ROADMAP.md:571-572 records a "Live-CI close" for XOS-05 on exactly these
     grounds.
   - Recommendation: **follow the Phase 12 precedent.** Close the phase on the landing evidence and
     carry the Case-B observation as a named live-CI item with its exact procedure, rather than
     blocking the phase on a second PR.

2. **Should `docs/advanced.md`'s outcome count be spec-pinned?**
   - What we know: the prose at `advanced.md:21` hardcodes "FOUR outcomes", `memory-backend.ts:60`
     cites the table, and both are `test` inputs so they cannot go stale unnoticed *by hash* -- but
     nothing asserts the count.
   - Recommendation: **pin it.** One assertion, and it is the same defect class as the four stale
     `ci.yml` comments. Cheap insurance against a five-outcome selector documented as four.

3. **Does the read-only leg's 403 storm warrant an `OBS` requirement?**
   - What we know: every MISSing task now 403s instead of 200s. No evidence it is noisy.
   - Recommendation: **defer.** Observe on the landing run; open a follow-up only if the log is
     actually confusing. Do not pre-build an observability feature for a problem not yet seen.

## Sources

### Primary (HIGH confidence -- direct codebase verification, this session)

- `packages/github-cache/src/backend/actions-cache-backend.ts` -- the single read call site (`:141-147`),
  VER-04 guards (`:86-109`), VER-07 mkdirs (`:111-121`, `:170-191`), the `lookupOnly` probe (`:260-268`)
- `packages/github-cache/src/backend/actions-cache-backend.spec.ts:408-546` -- **the decisive finding**:
  the ordered-member scan, the single-import clause, and the whole-array positional pins
- `packages/github-cache/src/backend/types.ts` -- the port; the deleted `'forbidden'` comment (`:3-8`)
- `packages/github-cache/src/backend/memory-backend.ts:9-17,30,63` -- the structural precedent
- `packages/github-cache/src/lib/select-backend.ts` -- the four outcomes and their order
- `packages/github-cache/src/lib/select-backend.spec.ts:298-330` -- `length === 0` + the widening test
- `packages/github-cache/src/lib/trust.ts:32-34,79-100` -- why the legs are TRUSTED
- `packages/github-cache/src/lib/retention.ts:118` -- the truthiness idiom for a boolean opt-in
- `packages/github-cache/src/serve.ts:22-28,89-119` -- the `ServeOptions` comment lock; the spread precedent
- `packages/github-cache/src/server/server.ts:124-129,273` -- the 403 boundary
- `packages/github-cache/src/dogfood-cross-os.spec.ts:1-77,755-941` -- `jobBlock`, the comment strip,
  the `cacheObservation` reason string, the existing name-only clauses
- `packages/github-cache/src/test/consumer-contract.ts:12-21` -- the 8 env knobs
- `packages/github-cache/src/public-surface.spec.ts:40-53,159-173` -- `EXPECTED_ACTION_INPUTS`, the knob pin
- `packages/github-cache/src/docs-adoption.spec.ts:49-82` -- the per-knob doc assertions
- `.github/workflows/ci.yml:128,482-743,1682-1790` -- the drift job, the three legs, the dogfood pair
- `nx.json:47-116` -- the declared inputs that decide which edits rotate which hash
- `esbuild.action.mjs`, `start-cache-server/entry.ts`, `start-cache-server/action.yml`,
  `packages/github-cache/action.yml`, `package.json:6-18` -- the bundle chain and its drift guard
- `node_modules/@actions/cache/lib/cache.d.ts`, `lib/internal/contracts.d.ts` -- the exact-pinned
  6.2.0 API surface and the unreachable `creationTime`

### Secondary (MEDIUM confidence -- first-party documentation, fetched this session)

- [CITED: docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching] --
  "Restrictions for accessing a cache", "Cache key matching", "Cache access for low-trust workflow
  triggers", "Usage limits and eviction policy". Fetched via markdown.new, 2026-08-02
- [CITED: github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/] --
  the trigger lists and "Restores are unaffected". Fetched via markdown.new, 2026-08-02

*Provenance note: `gsd-tools query classify-confidence --provider webfetch` returns LOW for the
provider channel generically. Both sources above are first-party GitHub documentation quoted
verbatim from a direct fetch, which is the strongest available CITED form; MEDIUM is the honest
rating, and the CONTEXT's standing instruction stands -- doc-cited is not reproduced-in-repo, which
is exactly why Q4 carries a reproduction procedure.*

### Tertiary (LOW confidence)

None. No claim in this document rests on WebSearch or on training knowledge alone.

## Metadata

**Confidence breakdown:**
- Q1 backend shape: **HIGH** -- the acceptance criterion has an existing mechanical guard that the
  recommended shape leaves byte-identical; verified by direct source read
- Q2 signal shape: **HIGH** -- all three resolution criteria are decidable from files read this
  session; the "no server-side lever" half is settled by first-party text
- Q3 witness variant: **HIGH** -- refuted at the API level by the exact-pinned type declarations
- Q4 read half: **MEDIUM** -- doc-confirmed twice over, never reproduced here; a concrete
  reproduction is proposed and its Case A/B split is derived from this repo's own input declarations
- Q5 wiring: **HIGH** -- every line number and the full bundle import chain verified
- Q6 pins + stale sites: **HIGH** -- all seven sites read directly; the vacuity trap verified live
- Q7 threat model / public surface: **HIGH** -- every guard file and line read
- Proposed requirement IDs: **HIGH** on the numbering (grepped), **MEDIUM** on the split (a judgement
  call the planner may reasonably regroup)

**Research date:** 2026-08-02
**Valid until:** 2026-09-01 (30 days). Re-verify sooner on any `@actions/cache` bump -- `pinned-deps.spec.ts:22-34`
records that a bump requires re-reading `getCompressionMethod`, and a bump would also re-open Q3's
API finding.
