---
phase: 2
phase_name: "default-cache-in-ci"
project: "@op-nx/github-cache"
generated: "2026-07-19"
counts:
  decisions: 8
  lessons: 6
  patterns: 8
  surprises: 5
missing_artifacts: []
---

# Phase 2 Learnings: default-cache-in-ci

## Decisions

### Exact-pin toolkit deps behind a build-breaking guard spec (ROBUST-03)
`@actions/cache` and `@actions/core` were installed with bare `x.y.z` specifiers and locked by `pinned-deps.spec.ts`, which fails the build the moment either widens to a range (`^`/`~`/`>=`).

**Rationale:** `@actions/cache` version-hashes the literal archive path + compression choice, so an unreviewed bump behind a range operator can MISS every restore with no error. The static pin is the first line of defence; the Plan 06 CI canary is the end-to-end backstop.
**Source:** 02-01-SUMMARY.md, 02-01-PLAN.md

### Pinned `@actions/cache` 6.2.0 (latest) under a human legitimacy checkpoint
Chose the latest `6.2.0` over the plan's more-baked `6.1.0` default, with the SUS (`too-new`, ~6-day-old release) legitimacy verdict explicitly surfaced and accepted by a human before any package-manager command ran.

**Rationale:** The version string is load-bearing (it drives the archive version hash), so the exact value is a deliberate recorded choice, not a silent default. Both packages were confirmed canonical-org, not deprecated, and postinstall-script-free.
**Source:** 02-01-SUMMARY.md (Human Approval Gate)

### Write-trust = default-deny allowlist `['push','schedule']`, content-pinned by deep-equality
`isWriteTrusted(env)` trusts only `push`/`schedule` inside GitHub Actions; there is no denylist path (unrecognised/unset trigger returns `false`), and a deep-equality test freezes the allowlist content.

**Rationale:** CREEP (CVE-2025-36852) is the governing threat; neither trusted event is fork-reachable with default-branch cache scope, so the phase is safe by construction. The content pin makes an early widening a build failure, not a silent one-word edit that skips review. Widening to `pull_request`/`release` is deferred to Phase 5.
**Source:** 02-02-SUMMARY.md, 02-02-PLAN.md

### `selectBackend` derives RW/RO purely from the env bag — no caller-facing mode surface (TRUST-05)
`selectBackend(env)` takes only the environment bag (default `process.env`); no options object, second argument, or env var can request the writable backend. Proved both structurally (`selectBackend.length === 0`) and behaviorally (an untrusted bag carrying `MODE`/`FORCE_WRITABLE`/`writable` still yields a `forbidden` put).

**Rationale:** No caller can misconfigure read-write vs read-only. The behavioral half exists because this repo already shipped a tautological security test once (01-REVIEW WR-01); an identity-only assertion would not catch a smuggled flag.
**Source:** 02-05-SUMMARY.md

### Fail-closed on a corrupted repo identity; degrade (not throw) on an unresolvable token
Malformed `GITHUB_REPOSITORY` in a trusted context throws at construction; an absent/empty token degrades to read-only rather than throwing.

**Rationale:** A corrupted repository identity in a write-trusted context must fail loudly rather than resolve into some other repository's cache namespace. A merely-unwired workflow (no token) should not break the build — it just cannot write.
**Source:** 02-05-SUMMARY.md

### Ambiguous `saveCache` sentinels absorbed as a benign no-op; every other rejection propagates
`saveCache` returning `-1` and a `ReserveCacheError` reserve conflict are both read as `stored`; every other rejection propagates so the server's fail-closed write path surfaces a 500 rather than a silent success.

**Rationale:** The safety of reading those two outcomes as benign comes from the upstream write gate, not from the backend. Absorbing only those two specific outcomes keeps real faults visible.
**Source:** 02-04-SUMMARY.md, 02-04-PLAN.md (D-04)

### The JS action is the ONLY launch path for the Actions-cache backend; credentials by inheritance only
The Actions-cache backend is launched only from a `node24` JS action; `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` reach `serve` by process inheritance and are never re-exported through the workflow environment file (`GITHUB_ENV` count == 0 in both the action and the workflow).

**Rationale:** Those runtime credentials exist only inside an action runtime; the common `core.exportVariable`/`GITHUB_ENV` re-export workaround would widen their exposure. This constraint is the entire reason an action, not an ordinary shell step, is the launch path.
**Source:** 02-06-SUMMARY.md, 02-06-PLAN.md (T-2-18)

### `cacheArchivePath` ships as its own exported lib module so its filename is spec-pinnable
The archive path helper is a standalone exported module (not a private backend function); both toolkit call sites resolve through it, and its spec spells the literal `nx-github-cache-abc123.tar` out by hand rather than reconstructing it from the impl template.

**Rationale:** The module earns its keep only because a non-tautological literal-string pin exists — that pin is the sole assertion that fails on a cosmetic path rename, the exact silent-MISS class (Pitfall 7) this phase guards.
**Source:** 02-04-SUMMARY.md

---

## Lessons

### Cross-OS lockfiles must be regenerated on Linux, never via `npm install` on the Windows host
A Windows workspace-scoped `npm install` prunes the `@emnapi` WASM-fallback optional dependencies that Linux `npm ci` requires, turning every CI job red. The lockfile had to be regenerated inside Docker (`node:24`, `node_modules` masked).

**Context:** This drift blocked the entire dogfood canary run and required a separate quick task (260719-in3) to fix before Phase 2's headline capability could even be observed on CI.
**Source:** 02-UAT.md, .planning/STATE.md (HANDOFF decisions)

### A module-global lock map silently poisons LATER same-file tests that reuse a hash
`withHashLock`'s lock map is module-global, so a "hung put never settles" test (whose gate is deliberately never released) permanently poisons its hash; nothing evicts the entry, and any later test in the same file reusing that hash hangs — a timeout, not an assertion failure.

**Context:** Surfaced only during the retroactive validation audit when a new ROBUST-04 test reused `'abcdef'`. Fix was a unique per-test hash (`'deadbeef01'`) plus an inline hazard note — an implementation change was NOT warranted (the hang is a test-fixture defect, not a `serve.ts` bug).
**Source:** 02-VALIDATION.md (Validation Audit 2026-07-19)

### Parallel Vitest workers share the filesystem — reused fixture hashes race on the temp archive
Two spec files that drive a real `put` with the same fixture hash race on `/tmp/nx-github-cache-<hash>.tar` across parallel workers, intermittently failing the "removes the temp archive" assertion.

**Context:** `select-backend.spec.ts` and `actions-cache-backend.spec.ts` both used `'abc123'`; fixed by giving the newer spec a unique fixture hash and documenting the requirement. Same root cause as the lock-map lesson above: shared global state (filesystem / module map) across tests.
**Source:** 02-05-SUMMARY.md (deviation, commit 70f1edf)

### Presence-only tests miss teardown regressions — assert the real signal path
The original ROBUST-04 tests called `RunningServer.shutdown()` directly or only checked `process.listeners('SIGTERM').length`. None fired the actual `process.once('SIGTERM', onSigterm)` listener production relies on, so a regression where `onSigterm` exited BEFORE the drain settled would have passed every existing test.

**Context:** The validation audit added a real-signal test that fires the registered handler. A "wired and present" invariant needs a test that exercises the wiring, not just the presence.
**Source:** 02-VALIDATION.md (Validation Audit 2026-07-19)

### Acceptance greps that assume single-line signatures break under Prettier line-wrapping
The Task 1 acceptance grep `export function selectBackend\(env` assumed a one-line signature, but Prettier wraps it because the `CacheBackend` return type pushes past 80 columns. The property the grep proxies for (exactly one declared parameter) still holds and is proven at runtime by `selectBackend.length === 0`.

**Context:** `format:check` gates CI, so the wrapped form is the required house style — the code was not reshaped to satisfy the grep's layout assumption. Prefer a runtime/structural assertion over a layout-sensitive grep.
**Source:** 02-05-SUMMARY.md

### A comment that merely names a forbidden token trips a zero-count guard
The first draft of `src/action/index.ts` referenced `$GITHUB_ENV` by name inside an explanatory comment, tripping the plan's zero-count `GITHUB_ENV` guard even though comments are stripped on emit. Reworded to "the workflow environment file."

**Context:** Static "forbidden token count == 0" guards match source text, not compiled output — describe a forbidden mechanism rather than naming its literal token.
**Source:** 02-06-SUMMARY.md

---

## Patterns

### Exact-pin + committed guard spec for version-hash-sensitive dependencies
A dependency whose version participates in a hash/key derivation gets a bare `x.y.z` pin locked by its own build-breaking spec.

**When to use:** Any dep where a silent minor/patch bump can change behavior invisibly (cache key derivation, archive format, protocol version). A range operator there is a silent-MISS hazard, not a convenience.
**Source:** 02-01-SUMMARY.md

### Security-relevant constant = comment-locked single source of truth + deep-equality content pin
Freeze a security-load-bearing constant (an allowlist, a size cap) in exactly one declaration and pin its content by deep-equality so an accidental early widening is a build failure.

**When to use:** Any allowlist/threshold whose silent widening would bypass review (write-trust events, body-size caps). Pair with a repo-wide count assertion (== 1 declaration).
**Source:** 02-02-SUMMARY.md

### Deterministic concurrency testing with deferred promises + a shared order log
Drive settle order with `resolve()`/`reject()` on deferred promises, assert via a shared string log and a test-only size probe — never elapsed time or fake timers.

**When to use:** Testing serialization/eviction/no-wedge properties of a lock or queue. A test-only observability probe (e.g. `inFlightHashCount`) is doc-marked as NOT part of the consumer contract and kept out of the barrel export.
**Source:** 02-03-SUMMARY.md

### Non-tautological pin: spell the expected literal out by hand
Pin the exact expected value (a filename, a digest) by writing it verbatim in the spec rather than reconstructing it from the implementation template.

**When to use:** Any invariant a cosmetic refactor could silently change. Reconstructing the value from the impl produces a tautology that passes even when the impl breaks. (MAX_CACHE_BODY_BYTES / cacheArchivePath precedent.)
**Source:** 02-04-SUMMARY.md

### Prove "no caller-facing mode surface" both structurally AND behaviorally
Assert `fn.length === 0` (no extra params) AND that an override-shaped input (extra keys named `MODE`/`FORCE_WRITABLE`/...) still yields the safe result.

**When to use:** Any capability that must be derived from context, not requested by a caller. Structural-only can be defeated by a smuggled flag read from the single allowed argument.
**Source:** 02-05-SUMMARY.md

### One composition-point decorator carries the lock AND the drain, keeping the core untouched
Apply cross-cutting write concerns (per-hash lock + in-flight tracking for a bounded shutdown drain) in a single inline decorator at the composition root; leave the HTTP/server module unchanged and inject test doubles by mocking the selection module, not by adding an injection option.

**When to use:** When a cross-cutting concern would otherwise leak into a lower layer or force a caller-facing seam. Adding an injection option would itself be a write surface.
**Source:** 02-05-SUMMARY.md

### Two-job seed->verify keyed on a run id proves a real cross-context round-trip
Split the canary into two jobs (`seed` writes, `verify` reads with `needs:`), keyed on `github.run_id`, so a same-process read-back cannot masquerade as a real cache HIT. Every branch asserts an exact status/body or calls `setFailed` — a MISS is a named failure, never a skip.

**When to use:** Verifying that data genuinely crossed an external service (cache, queue, store) rather than a local echo. Fail-loud so a broken round-trip can never report green while caching nothing.
**Source:** 02-06-SUMMARY.md

### Bounded drain: race the in-flight settle against an unref'd timer
`shutdown()` races `Promise.allSettled([...inFlightPuts])` against an unref'd `setTimeout(graceMs)`, so a hung write yields to the runner's SIGKILL instead of deadlocking teardown.

**When to use:** Any graceful-shutdown drain where a wedged operation must not block process teardown. The unref'd timer is the escape hatch; the listener is removed on shutdown to avoid accumulation across restarts.
**Source:** 02-05-SUMMARY.md

---

## Surprises

### The phase's headline capability was unexercisable locally by construction
The live cross-job Actions-cache HIT could only be confirmed post-merge on real GitHub CI: `act` implements only the legacy v1 REST protocol and cannot back `@actions/cache` v2 twirp, and this arm64/QEMU dev host would emulate slowly regardless.

**Impact:** SC5 sign-off had to be deferred to an explicit end-of-phase human check; every local precondition was verified green first. Confirmed live on CI run 29685631933 (all 9 jobs green; verify logged a cache HIT with matching bytes, bearer token masked).
**Source:** 02-VERIFICATION.md, 02-UAT.md, 02-06-SUMMARY.md

### A silent cross-OS lockfile drift turned every CI job red
The lockfile regenerated on Windows dropped `@emnapi` WASM-fallback optional deps that Linux `npm ci` needs, failing `npm ci` on every job — blocking the dogfood canary entirely until a separate quick task fixed it.

**Impact:** The cache-HIT proof depended on an unrelated cross-OS packaging fix (260719-in3) landing first. A cross-platform failure that is invisible on the authoring OS.
**Source:** 02-UAT.md, .planning/STATE.md

### The module-global lock map is a latent cross-test hazard, found only in the audit
A never-settling gated put in one test silently hangs a LATER same-file test that reuses the hash. This was invisible during execution (no earlier test reused the poisoned hash) and only surfaced when the retroactive validation audit added a test reusing it.

**Impact:** A latent test-suite trap, not a production bug. Fixed with a unique per-test hash + hazard note; no implementation change.
**Source:** 02-VALIDATION.md

### WR-01: the `get` HIT path left the restored archive on disk while `put` carefully cleaned up
Deep code review found a T-2-11 hygiene ASYMMETRY: `put` removes its temp archive in a `finally` on every exit path, but `get` on a cache HIT read the restored archive and never removed it — leaving cache bytes on a reused/self-hosted runner.

**Impact:** Not a correctness bug (a leftover never produces a false HIT), but an information-exposure defect across the get/put boundary that shares one temp path. Fixed test-first (commits 4d1e580 RED / 4b5d99c GREEN) and confirmed present in the verification pass.
**Source:** 02-REVIEW.md, 02-VERIFICATION.md

### gsd-tools state verbs reject positional args
`state.record-metric` and `state.add-decision` require named flags (`--phase`/`--plan`/`--summary`/`--duration`), not positional arguments — a recurring re-invocation friction across plans 03 and 04.

**Impact:** Minor execution friction, not a code issue; noted so future plans pass named flags on the first call.
**Source:** 02-03-SUMMARY.md, 02-04-SUMMARY.md
