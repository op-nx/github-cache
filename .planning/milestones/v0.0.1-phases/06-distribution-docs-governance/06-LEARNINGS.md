---
phase: 6
phase_name: "Distribution + Docs + Governance"
project: "@op-nx/github-cache"
generated: "2026-07-21"
counts:
  decisions: 6
  lessons: 6
  patterns: 6
  surprises: 3
missing_artifacts: []
---

# Phase 6 Learnings: Distribution + Docs + Governance

## Decisions

### Pre-1.0, drift-guarded stability posture (GOV-03)
The v0.0.1 consumer contract is enumerated and guard-tested (DOCS-05) so no change is
silent, but the semver statement uses standard 0.x semantics: the surface MAY evolve
pre-1.0, breaking changes bump the MINOR and are documented, 1.0 freezes it.

**Rationale:** honest for an interface built this milestone with no external adopters yet;
protects adopters from silent drift without over-committing an unproven interface. This was
the one HIGH-impact/medium-confidence gray area escalated to the maintainer (not auto-locked).
**Source:** 06-CONTEXT.md (D-01), 06-DISCUSSION-LOG.md, docs/versioning.md

### Consumer sidecar handshake = consumer-pre-sets / action-adopts (NOT action-exports)
The `start-cache-server` JS action does NOT export the server URL/token. The consumer sets
`NX_SELF_HOSTED_REMOTE_CACHE_SERVER` + `_ACCESS_TOKEN` (with a fixed `port`) in a regular
step before the `background: true` step; `serve()` adopts them.

**Rationale:** a `background: true` step's `core.exportVariable` cannot reach later steps
(see Lessons). serve() already adopts a provided token/port, so inverting the handshake was
the minimal correct fix. Proven live on CI run 29792990244.
**Source:** start-cache-server/entry.ts, 06-VERIFICATION.md (live_close), commit c47fa1c

### Committed, dependency-bundled action entry (dist/ is gitignored)
The consumer action's `main:` points at a committed esbuild single-file bundle
(`start-cache-server/index.js`), not a built `dist/`, guarded by a CI drift check
(`check:action` rebuild + `git diff --exit-code`).

**Rationale:** a `uses:` action resolves `main` from the git ref, never from npm and never
after a build; `dist/` is gitignored so it is absent on a consumer checkout.
**Source:** 06-01-SUMMARY.md, 06-RESEARCH.md, start-cache-server/action.yml

### Publish-ready, not live-publish (D-13)
The npm package is made publish-READY (public `publishConfig`, `files:["dist"]` allow-list,
`bin`, MIT license) + a `npm pack --dry-run` file-list guard, but no live `npm publish`
workflow this milestone.

**Rationale:** pre-1.0 posture; being `uses:`-consumable + publish-ready is sufficient for
v0.0.1, and a live publish is a release-time step the maintainer owns.
**Source:** packages/github-cache/package.json, pack-check.cjs, 06-CONTEXT.md (D-13)

### Distinct cache key for the consumer-smoke dogfood proof
The consumer-smoke round-trip keys on `cafe<run_id>` (valid hex, distinct), not the bare
`github.run_id` that dogfood-seed and the publish matrix use.

**Rationale:** all three ubuntu jobs share this run's Actions-cache scope; a bare run_id
collides (Actions cache is first-write-wins) and returns one job's payload to another.
**Source:** .github/workflows/ci.yml (consumer-smoke), commit 97d7d6a

### Consumer contract scope = surface only, MAX_CACHE_BODY_BYTES is fixed, minimal barrel
The DOCS-05 guard enumerates only the consumer contract (value exports = `createCacheServer`,
4 type exports, action input `[port]`, 7 env knobs); `MAX_CACHE_BODY_BYTES` is a fixed 2 GiB
const documented as a contract limit (not an env knob); `serve` stays out of the JS barrel.

**Rationale:** internal helpers must not leak into the frozen contract (dogfood-stays-safe);
the server reads MAX_CACHE_BODY_BYTES as a const, corrected from an initial mis-listing.
**Source:** public-surface.spec.ts, 06-RESEARCH.md (open questions resolved)

---

## Lessons

### A `background: true` step's core.exportVariable CANNOT propagate to later steps
The runner only processes `$GITHUB_ENV` AFTER a step completes; a background step does not
"complete" until its `cancel:` teardown, so its `exportVariable` writes never reach later
steps. Any "background action generates + exports values" handshake is broken by design.

**Context:** consumer-smoke failed with "background start-cache-server step did not export
the server url" ~6ms after the round-trip step started. Fix: consumer pre-sets the env in a
regular step (which DOES propagate). This was 06-01's explicitly-flagged unproven assumption.
**Source:** CI run 29790845037 (consumer-smoke), 06-VERIFICATION.md, commits c47fa1c/fb23e92

### Windows npm install re-prunes Linux WASM-fallback optional deps -> CI npm ci fails
A bare `npm install` on the Windows arm64 host drops the Linux-only optional subtrees
(`@oxc-resolver`/`@rolldown` binding-wasm32-wasi -> `@emnapi/core`+`runtime` 1.11.1/1.11.2)
from package-lock.json. Local stays self-consistent; only Linux `npm ci` sees "Missing from
lock file" and fails every job.

**Context:** adding the `esbuild` devDependency (06-01) re-triggered this (same class as
02-01/260719-in3). Fix: regenerate the lockfile in a linux/arm64 node:24 container with
node_modules masked; `npm ci` there must exit 0. `npm install --os=linux --cpu=arm64
--package-lock-only` is a NO-OP (does not deep-resolve the nested optional subtree).
**Source:** CI run 29790200154, commit 8b2977f (recorded as global memory)

### curl -w '%{http_code}' emits "000" on connection-refused AND exits non-zero
So `code=$(curl ... -w '%{http_code}' ... || echo 000)` double-writes ("000" from curl +
"000" from the fallback) = "000000", which is `!= "000"`, breaking a readiness poll on
iteration 1 before the server binds. Use `|| true` (curl's own "000" is enough).

**Context:** consumer-smoke round-trip died exit-7 in ~19ms with no sleep because the poll
never actually waited. Fix: `|| true` + a "never came up" diagnostic.
**Source:** CI run 29791988995 (consumer-smoke), commit 7e36937

### Jobs sharing a run-id-derived Actions-cache key collide in one workflow run
dogfood-seed, consumer-smoke, and the publish matrix all keyed on `github.run_id` -> all
wrote `nx-cache-<run_id>` in the same ubuntu Actions-cache scope. dogfood-seed/publish seed
identical bytes (benign); enabling consumer-smoke's distinct payload corrupted the shared key.

**Context:** dogfood-verify failed "cache HIT but returned wrong data" only once consumer-smoke
started working. Fix: distinct `cafe<run_id>` key for consumer-smoke.
**Source:** CI run 29792552880 (dogfood-verify), commit 97d7d6a

### Local gates + the verifier cannot catch CI-runtime / cross-OS / cross-job bugs
Every one of the three bugs above passed all local gates (build/typecheck/test/format/fallow,
474 tests) and the GSD verifier. Only a real default-branch push surfaced them, in sequence
(each masked the next). CI-only behaviors need a live-close, not a local checkmark.

**Context:** the milestone's headline deliverable (DOCS-06 consumer pattern) was only proven
correct after 5 live CI pushes.
**Source:** 06-VERIFICATION.md, CI runs 29790200154 -> 29792990244

### A guard spec that reads out-of-project files needs those files in nx.json test inputs
Otherwise the Nx test cache replays a stale PASS on an edit to those files, defeating the
guard. Applied to SECURITY.md/LICENSE/package.json (06-03), start-cache-server/* (06-02),
docs/* (06-04), and retrofitted to the trust docs (06-05).

**Context:** three of the phase's guards independently hit + fixed this; the 06-05 trust-doc
guard was fixed during close-out.
**Source:** nx.json targetDefaults.test.inputs, commits (06-02/03/04), 2ed04c4

---

## Patterns

### First-push live-close for CI-only behaviors
Behaviors that only a real GitHub-hosted runner can exercise (background-step semantics,
cross-OS restore, cross-job cache) are structurally built + locally guarded, then closed on a
real push and recorded as `human_verification` / `live_close`. Consistent across phases 4/5/6.
**When to use:** any acceptance criterion that a local unit test physically cannot reproduce.
**Source:** 06-VERIFICATION.md, phases 4/5 precedent

### Consumer sidecar handshake: pre-set env in a regular step, action adopts
For a long-lived background sidecar whose URL/token later steps need, the consumer sets the
env in a regular step (propagates via $GITHUB_ENV) and the action adopts it -- never rely on
the background action to export.
**When to use:** any `background: true` action that must hand values to later steps.
**Source:** start-cache-server/{entry.ts,action.yml}, README/docs

### Committed-bundle + drift-guard for uses:-consumable JS actions
When `dist/` is gitignored, bundle the action entry (esbuild single-file) and commit it, with
a CI job that rebuilds and `git diff --exit-code`s it (mirrors the trust.generated.cjs pattern).
**When to use:** any `uses:`-consumable action in a repo whose build output is gitignored.
**Source:** start-cache-server/index.js, esbuild.action.mjs, ci.yml (action-bundle-drift)

### Single-source drift guard for docs that mirror code
Import the real constants (`TRUSTED_EVENTS`/`HOST_GATED_EVENTS`/`SYNC_EVENTS`) and assert each
renders verbatim in the doc, so a future code change trips the guard until the doc is updated.
**When to use:** any doc that restates security/config values maintained in code.
**Source:** docs-trust.spec.ts (06-05)

### Allowlist-inversion for secret/email hygiene
Assert the ONLY email-shaped token in maintainer-authored files is the approved address; flag
everything else. Never encode the forbidden value as a search needle (that is itself the leak).
**When to use:** guarding public-repo content against private-contact/secret leakage.
**Source:** governance-email.spec.ts (06-03)

### Regenerate cross-OS lockfiles in a container matching CI's platform
A native-arm64 linux node:24 container with node_modules masked yields a platform-complete
lockfile that `npm ci` accepts on both the Windows dev host and the Linux CI runner.
**When to use:** any dependency change on a dev host whose OS/arch differs from CI.
**Source:** commit 8b2977f, [[windows-npm-install-prunes-linux-optional-deps]]

---

## Surprises

### The live proof caught THREE distinct real bugs in sequence, each masking the next
Lockfile drift (all jobs red) -> once fixed, the background-step handshake failed -> once
fixed, the readiness-poll bug + a cross-job cache-key collision surfaced together. Five live
pushes to fully close a deliverable that was 100% green locally throughout.

**Impact:** validated the "first-push live-close" discipline; a single green local suite would
have shipped a consumer pattern that fails in every adopter's CI.
**Source:** CI runs 29790200154, 29790845037, 29791988995, 29792552880, 29792990244

### npm's --os/--cpu cross-platform lockfile flags were a no-op here
`npm install --package-lock-only --os=linux --cpu=arm64 --libc=glibc` reported "up to date"
and changed nothing -- it does not deep-resolve the nested optional subtree that was missing.
Only a real full resolve in a linux container added the entries.

**Impact:** confirmed the Docker-container regen is the load-bearing fix, not a CLI flag.
**Source:** session diagnosis, commit 8b2977f

### Making a dormant test job actually work is what exposed a pre-existing latent collision
consumer-smoke never PUT successfully before this phase's fix, so its run-id key collision
with dogfood-seed/publish had been latent. Fixing the handshake activated the PUT and only
then corrupted dogfood-verify.

**Impact:** a reminder that enabling a previously-failing path can surface bugs that were
always present but never reached.
**Source:** CI run 29792552880, commit 97d7d6a
