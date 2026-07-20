# Phase 5: Trust-Widening + PPE Gate - Research

**Researched:** 2026-07-20
**Domain:** GitHub Actions write-trust widening (host-detected, fail-closed), single-source allowlist codegen + drift guard, server-produced-key mirror filter, adopter-facing PPE-hygiene composite action (zizmor + actionlint)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (host-detection, fail-closed):** widen the default allowlist to admit `pull_request` and
  `release` ONLY when GitHub's untrusted-default-branch cache guard exists, detected purely from
  `GITHUB_SERVER_URL`: host `github.com` or a `*.ghe.com` suffix -> guard present -> widened trust
  ON; EVERY GHES host (anything else) -> OFF, fail-closed. Pure function of the runner-injected env
  var; NO caller/mode flag. The in-code gate stays fork-spoofable defense-in-depth; the load-bearing
  control is GitHub's server-side read-only-token guard + scope isolation (ADR C1, locked).
- **D-02 (default-only for v0.0.1):** ship the default-deny allowlist with the default IMPLICIT when
  unconfigured. Do NOT build a custom user-configured allowlist override surface this milestone
  (YAGNI). If an override is added later it MUST route through the same validated allowlist, never a
  denylist.
- **D-03 (GHES version-gate dormant):** keep any version-gate knob OFF/dormant. Do not wire a live
  GHES-enabling path.
- **D-04 (spoof cross-check deferred):** the optional `/meta` `installed_version` +
  `X-GitHub-Enterprise-Version` absence cross-check is NOT built this phase.
- **D-05 (single TS source):** `TRUSTED_EVENTS` in `src/lib/trust.ts` stays the ONE source of truth
  for the trusted-event allowlist. The widened `pull_request`/`release` entries and the host-gate
  live in / around it. Exactly one authored allowlist declaration in the repo.
- **D-06 (generated action copy):** the pre-`npm ci` dependency-free CommonJS action copy is
  GENERATED from the TS single source at build time (codegen), never a hand-maintained dual root
  copy. The dependency-free copy exists because the JS actions run before `npm ci`.
- **D-07 (selfcheck parity):** a `selfcheck.cjs` parity assertion fails the build (and is wired into
  the check battery / CI) if the generated copy ever drifts from the TS source (ADR C-req, locked).
- **D-08 (promote nx-cache- to single-source filter):** promote the `nx-cache-` prefix already used
  by Phase 4's publish path (D-16) into a single-source filter function; the mirror publishes ONLY
  keys carrying that distinguishing namespace/prefix, never "any 1-512 hex" Actions-cache key. One
  filter function shared by the publish path and any key validator (parity-guarded, single source) --
  the Phase 4 cheap-prefix subset becomes the full single-source filter here.
- **D-09 (sequence FIRST):** TRUST-08 ships FIRST within the phase (before any private-repo mirror
  enablement). An unrelated hex-keyed CI artifact would otherwise leak as a world-readable asset.
- **D-10 (composite action form):** ship the installable PPE-hygiene gate as a COMPOSITE ACTION,
  consumed by adopters as a STEP inside their own job (`- uses: op-nx/github-cache/<ppe-path>@vX`).
  Consumer supplies the runner (`runs-on`) + `actions/checkout`; the action self-installs its tools.
- **D-11 (self-installed, exact-pinned tools):** the composite action self-installs BOTH `zizmor`
  (PyPI: `uvx`/`pipx`, or a prebuilt binary) and `actionlint` (official `download-actionlint.bash`
  prebuilt binary), each EXACT-pinned. The consumer never provides the tools.
- **D-12 (named patterns, advisory):** the gate runs zizmor + actionlint for the named unsafe
  patterns -- no `pull_request_target` + PR-checkout; no `issue_comment`/`workflow_run` executing PR
  code. BEST-EFFORT/ADVISORY defense-in-depth, positioned as such (never the containment control --
  that stays TRUST-02 sync gate + default-branch protection). Non-blocking by default for adopters;
  whether this repo's own CI treats it as blocking is the planner's discretion.

### Claude's Discretion
Exact file/module/function names; the codegen mechanism for the dependency-free action copy
(build script vs Nx target vs inline generator); the composite action's directory path and input
surface; zizmor/actionlint exact versions; the precise single-source filter function signature; and
whether this repo's own CI runs the PPE gate blocking or advisory.

### Deferred Ideas (OUT OF SCOPE)
- Custom user-configured write-trust allowlist override surface -> later (YAGNI; D-02 default only).
- GHES version-gate live-enabling path + `/meta` spoof cross-check -> dormant (D-03/D-04).
- Reusable-workflow form of the PPE gate -> not shipped (composite action chosen).
- TRUST-09 (GHCR package-visibility fail-closed assert) + GHCR-conditional trust -> later milestone.
- Consumer trust/security docs -> Phase 6 (DOCS-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRUST-01 | Write-trust allowlist; default-deny; `pull_request`/`release` admitted only where GitHub's guard exists, host-detected from `GITHUB_SERVER_URL` (`github.com`/`*.ghe.com` -> ON, every GHES host -> OFF fail-closed; no caller flag). | Host-detection design (Section: Architecture Patterns / Pattern 1); `GITHUB_SERVER_URL` values verified (State of the Art); structural URL parsing + fail-closed (Common Pitfalls 1-2); extends `isWriteTrusted`/`TRUSTED_EVENTS` in `trust.ts` + `trust.spec.ts`. |
| TRUST-04 | Trusted-event allowlist single source of truth; pre-`npm ci` dependency-free CommonJS action copy generated from it; `selfcheck.cjs` parity assertion fails the build on drift. | Codegen mechanism + `selfcheck.cjs` drift-guard design (Pattern 2); PoC precedent (`start-cache-server/index.cjs` + `selfcheck.cjs`, PITFALLS l.32/236); semantic-parity spec (Validation Architecture). |
| TRUST-06 | Shipped installable PPE-hygiene gate (composite action) running zizmor/actionlint for the named unsafe patterns; best-effort/advisory, NOT the containment control. | zizmor 1.27.0 + actionlint 1.7.12 install/rules/exit-codes/advisory config (Standard Stack, Pattern 3); composite action authoring (Pattern 3); division of labor (Architectural Responsibility Map). |
| TRUST-08 | Mirror publishes only server-produced keys (distinguishing prefix, never any 1-512 hex); filter ships before/with any private-repo mirror. | Promote `nx-cache-` to a single-source filter leaf reusing `HASH_PATTERN` (Pattern 4); refactor `publish-mirror.ts` + `actions-cache-backend.ts` to consume it (Integration Points). Sequenced FIRST (D-09). |
</phase_requirements>

## Summary

This phase has four independent-but-related deliverables, all extensions of code already in the
repo, none requiring a new npm runtime dependency. (1) **TRUST-01** widens the existing Phase-2 write
gate (`isWriteTrusted`/`TRUSTED_EVENTS` in `src/lib/trust.ts`) to admit `pull_request` and `release`
- but only on hosts where GitHub's 2026-06-26 server-side read-only-cache guard exists, inferred
structurally from `GITHUB_SERVER_URL` (host `github.com` or a true `*.ghe.com` subdomain), failing
closed on every GHES host and on any malformed/missing value. (2) **TRUST-04** makes that allowlist
the single source of truth and generates a dependency-free CommonJS copy from it at build time, with
a `selfcheck.cjs` drift tripwire wired into CI - directly rebuilding the PoC's
`start-cache-server/index.cjs` + `selfcheck.cjs` pattern that Phase 0 tore down. (3) **TRUST-08**
(sequenced FIRST per D-09) promotes the `nx-cache-` prefix - authored today in exactly two non-spec
places (`actions-cache-backend.ts:14`, `publish-mirror.ts:22`) - into one shared filter leaf that
also validates the hash suffix against `HASH_PATTERN`, so the mirror publishes only genuine
server-produced keys, never any hex-shaped foreign CI artifact. (4) **TRUST-06** ships an
adopter-facing PPE-hygiene **composite action** that self-installs exact-pinned `zizmor` (1.27.0) and
`actionlint` (1.7.12) and runs them for the named unsafe-trigger patterns, positioned as
best-effort/advisory defense-in-depth.

The load-bearing security truth (locked, ADR C1): the in-code host gate is **fork-spoofable
defense-in-depth only**. The real control is GitHub's server-side read-only-token guard + Actions
cache scope isolation. The host detection exists so this tool does not falsely widen trust on GHES
where that guard is absent - it is a fail-closed conservative default, not a boundary.

**Primary recommendation:** Ship in the order TRUST-08 (filter leaf) -> TRUST-01 (host-gated
widening + tests) -> TRUST-04 (codegen + selfcheck) -> TRUST-06 (PPE composite action). Reuse the
existing leaf-extraction precedent (`github-identity.ts`), the structural env-predicate shape
(`isWriteTrusted`/`isSyncTrusted`), the exact-pin guard (`pinned-deps.spec.ts`), and the
config-assertion test pattern (`cleanup-workflow.spec.ts`). Keep the WRITE gate and the SYNC gate
strictly separate - widening one must never touch the other (ADR C2; Phase 4 D-01).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Write-trust decision (pull_request/release admission) | Node lib (pure env predicate `isWriteTrusted`) | GitHub server-side read-only-token guard (load-bearing) | The in-code gate is defense-in-depth; the real boundary is GitHub's server-side token (ADR C1). |
| Host detection from `GITHUB_SERVER_URL` | Node lib (pure env fn) | -- | Structural URL parse of a runner-injected env var; no I/O, no caller flag (D-01). |
| Dependency-free action copy | Build tier (codegen target/script) + committed `.cjs` artifact | CI check battery (`selfcheck.cjs`) | Copy runs in a consumer JS action *before* `npm ci`, so it must be committed + dependency-free (D-06); drift caught in CI (D-07). |
| Server-produced-key filter | Node lib (single-source leaf) | publish path + key validator consumers | One authored prefix + one filter fn shared by backend + publish (D-08); parity-guarded. |
| PPE-hygiene linting (zizmor/actionlint) | Composite action running on the **consumer's** runner | Consumer-supplied `runs-on` + `actions/checkout` | Adopter folds it as a step into their own security job (D-10); tools self-installed on that runner (D-11). |
| PPE containment (the actual control) | GitHub (scope isolation) + adopter (default-branch protection) + TRUST-02 sync gate | -- | The PPE gate is advisory only; containment is NOT this tier (D-12, ADR C4). |

## Standard Stack

### Core (external tools self-installed by the PPE composite action - NOT npm runtime deps)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `zizmor` | `1.27.0` | Static security analysis of GitHub Actions workflows (template-injection, dangerous-triggers, cache-poisoning, artipacked, github-env). | The de-facto GitHub Actions security auditor (zizmorcore, formerly woodruffw); covers every PPE named pattern in D-12. `[VERIFIED: docs.zizmor.sh + pypi.org/pypi/zizmor/json + api.github.com/repos/zizmorcore/zizmor/releases/latest]` |
| `actionlint` | `1.7.12` | General GitHub Actions workflow linter (syntax, expression checks, glob/label validation, shellcheck-backed `run:` script-injection catch). | The standard workflow linter (rhysd); official `download-actionlint.bash` prebuilt installer with exact-version pinning. `[VERIFIED: github.com/rhysd/actionlint docs + api.github.com/repos/rhysd/actionlint/releases/latest]` |

### Supporting (already in the repo - reuse, do not add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@actions/core` | `3.0.1` (pinned) | Annotations/summary in bins; the PPE composite action uses shell `run:` steps, not this. | Already a dep; no new install for this phase. |
| Vitest | `~4.1.0` | All unit + config-assertion specs. | Every test this phase writes. |
| Node `node:url` (`URL`) | stdlib | Structural host parse of `GITHUB_SERVER_URL`. | Host detection (D-01) - global `URL`, zero deps, works in both the ESM lib and the generated CJS copy. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pipx install zizmor==1.27.0` (recommended for the composite action) | `uvx zizmor@1.27.0` | uvx is faster but needs `uv` installed first (extra `astral-sh/setup-uv` step or curl installer). pipx is pre-installed on GitHub-hosted Ubuntu/macOS runners. |
| `pipx`/`uvx` (Python) | Prebuilt zizmor binary from GitHub Releases (curl + tar for the runner's platform) | Zero-Python and fastest, but zizmor ships **no official install script** (unlike actionlint) and no aarch64-windows asset - the composite `run:` would need manual arch/OS detection. More brittle to author. |
| Composite action | Reusable workflow | Rejected by D-10: composite gives step-level composability (adopters fold PPE into an existing security job). Also a composite action **cannot** declare `background:` - irrelevant here (PPE only runs linters), but is why the *cache* consumption action stays a JS action (FOUND-03). |
| Official `zizmorcore/zizmor-action` | Self-install via `run:` (chosen) | D-11 mandates self-install of both tools exact-pinned inside our own composite; adding a third-party action inverts the "self-installs its tools" contract and adds a supply-chain hop. |

**Installation (inside the composite action's `run:` steps, NOT the package's `package.json`):**
```bash
# zizmor (recommended: pipx, exact-pinned)
pipx install zizmor==1.27.0
# actionlint (official prebuilt installer, exact-pinned to a target dir)
bash <(curl -sSf https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) 1.7.12 "${RUNNER_TEMP:-/tmp}/actionlint-bin"
```

**Version verification (run before finalizing the pins):**
```bash
curl -s https://pypi.org/pypi/zizmor/json           # confirm zizmor latest/available
curl -s https://api.github.com/repos/rhysd/actionlint/releases/latest   # confirm actionlint latest
```
Both were verified in-session on 2026-07-20: zizmor `1.27.0` (published 2026-07-14, `requires_python >=3.10`), actionlint `1.7.12` (published 2026-03-30).

## Package Legitimacy Audit

> No npm runtime dependency is added this phase. The two external tools are self-installed by the
> PPE composite action from their own ecosystems. Audited here because they are a supply-chain
> surface pinned into a shipped, adopter-consumable action (D-11).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `zizmor` | PyPI `1.27.0` | ~1.5 yrs (mature, actively released; 1.27.0 on 2026-07-14) | high (widely-adopted GHA security tool) | github.com/zizmorcore/zizmor | OK | Approved - exact-pinned, guarded by a config-assertion spec (D-11). |
| `actionlint` | GitHub Releases `v1.7.12` (Go binary; also `rhysd/actionlint` on pkg.go.dev) | ~6 yrs, stable | very high | github.com/rhysd/actionlint | OK | Approved - exact-pinned via the official download script (D-11). |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

Both are verified against authoritative sources this session (official docs + registry/release APIs).
Because they are self-installed at consumer-runtime rather than added to `package.json`, `pinned-deps.spec.ts` cannot guard them; instead the planner adds a **config-assertion spec** that reads the committed composite `action.yml` and asserts the exact `1.27.0` / `1.7.12` version strings are present (mutation-proven) - the D-11 analog of the exact-pin guard. No postinstall/network-side-effect risk applies (no npm install).

## Architecture Patterns

### System Architecture Diagram

```
                           TRUST-01 (widen WRITE gate)                    TRUST-04 (single source + codegen)
                        ┌──────────────────────────────┐            ┌───────────────────────────────────────┐
  runner env  ───────▶  │ isWriteTrusted(env)           │            │  src/lib/trust.ts (SINGLE SOURCE)      │
  GITHUB_ACTIONS        │  1. GITHUB_ACTIONS==true?      │◀───reads───│   BASE = [push, schedule]             │
  GITHUB_EVENT_NAME     │  2. event in BASE? ─▶ true     │            │   HOST_GATED = [pull_request, release]│
  GITHUB_SERVER_URL     │  3. event in HOST_GATED? ──────┼──┐         │   hostSupportsWidenedTrust(env)       │
                        │  4. else ─▶ false (deny)       │  │         └───────────────┬───────────────────────┘
                        └──────────────────────────────┘  │                         │ build-time codegen
                                                           ▼                         ▼
                                          ┌────────────────────────────┐   ┌───────────────────────────────┐
                                          │ hostSupportsWidenedTrust    │   │ trust.generated.cjs (COMMITTED,│
                                          │  URL(GITHUB_SERVER_URL).host│   │  dependency-free CommonJS)     │
                                          │   == github.com             │   │  = allowlist + gate, pre-npm-ci│
                                          │   OR endsWith('.ghe.com')   │   └───────────────┬───────────────┘
                                          │  malformed/other ─▶ false   │                   │ CI drift check
                                          │  (FAIL CLOSED)              │                   ▼
                                          └────────────────────────────┘        selfcheck.cjs (regenerate+diff)

  TRUST-08 (server-produced-key filter, ships FIRST)        TRUST-06 (PPE composite action, adopter-facing)
  ┌──────────────────────────────────────────────┐         ┌──────────────────────────────────────────────┐
  │ src/lib/cache-key.ts  (SINGLE SOURCE leaf)    │         │  <ppe-path>/action.yml  (runs.using:composite)│
  │   CACHE_KEY_PREFIX = 'nx-cache-'              │         │   consumer supplies runs-on + actions/checkout│
  │   cacheKeyFor(hash)                           │         │   step: pipx install zizmor==1.27.0           │
  │   isServerProducedKey(key)  (prefix+HASH_PATTERN)       │   step: download-actionlint.bash 1.7.12       │
  └──────────┬───────────────────────┬───────────┘         │   step: zizmor . --no-exit-codes  (advisory)  │
             │ imports               │ imports              │   step: actionlint || true        (advisory)  │
             ▼                       ▼                      └──────────────────────────────────────────────┘
   actions-cache-backend.ts   publish-mirror.ts                     ADVISORY only - containment = TRUST-02 + branch protection
   (cacheKeyFor)              (filter, replaces inline prefix)
```

### Recommended Project Structure (additions/edits only)
```
packages/github-cache/
├── src/
│   ├── lib/
│   │   ├── trust.ts               # EDIT: widen allowlist + add host gate (D-01, single source D-05)
│   │   ├── trust.spec.ts          # EDIT: add host-detection matrix + widened-event tests (TRUST-01)
│   │   ├── cache-key.ts           # NEW leaf: CACHE_KEY_PREFIX + cacheKeyFor + isServerProducedKey (TRUST-08)
│   │   └── cache-key.spec.ts      # NEW: filter unit + single-source-count assertion
│   ├── backend/
│   │   └── actions-cache-backend.ts   # EDIT: import cacheKeyFor from cache-key.ts (drop inline prefix)
│   ├── server/
│   │   └── server.ts              # OPTIONAL EDIT: export HASH_PATTERN (or move to cache-key.ts) so the filter reuses it
│   └── publish/
│       └── publish-mirror.ts      # EDIT: consume isServerProducedKey (drop inline CACHE_KEY_PREFIX)
├── <codegen>                      # NEW: generator (scripts/generate-trust-cjs.mjs OR an Nx target)
├── <action-lib>/trust.generated.cjs   # NEW committed dependency-free CJS copy (D-06); path is discretion
├── selfcheck.cjs                  # NEW dependency-free drift tripwire (D-07); wired into ci.yml
<ppe-path>/action.yml             # NEW composite action (D-10); path is discretion (recommend a short top-level path)
<ppe-path>/action.spec.ts (or under src/) # NEW config-assertion spec: pins + named rules + advisory (TRUST-06)
.github/workflows/ci.yml           # EDIT: add selfcheck job/step; optionally run the PPE gate on this repo
```

### Pattern 1: Host-gated write-trust widening (TRUST-01, D-01)
**What:** Extend the pure env predicate to admit `pull_request`/`release` only when the host carries
GitHub's guard, keeping `push`/`schedule` trusted everywhere and everything else denied.
**When to use:** the sole write-trust decision; no caller flag, no mode surface (TRUST-05 intact).
**Example (shape - authored in `trust.ts`, mirrored by codegen into the `.cjs`):**
```typescript
// Source: extends existing src/lib/trust.ts (Phase 2) + GITHUB_SERVER_URL values verified this session
export const TRUSTED_EVENTS = ['push', 'schedule'] as const;          // base: trusted on any host
export const HOST_GATED_EVENTS = ['pull_request', 'release'] as const; // widened: only where the guard exists

/** Structural, fail-closed host check. NOT substring/includes (Pitfall 2). */
function hostSupportsWidenedTrust(env: NodeJS.ProcessEnv): boolean {
  const raw = env.GITHUB_SERVER_URL ?? '';
  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return false; // malformed/missing -> fail closed (GHES-or-unknown)
  }

  return host === 'github.com' || host.endsWith('.ghe.com');
}

export function isWriteTrusted(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false;
  }

  const event = env.GITHUB_EVENT_NAME ?? '';

  if ((TRUSTED_EVENTS as readonly string[]).includes(event)) {
    return true;
  }

  if ((HOST_GATED_EVENTS as readonly string[]).includes(event)) {
    return hostSupportsWidenedTrust(env);
  }

  return false; // default-deny, no denylist
}
```
Key points: `endsWith('.ghe.com')` requires a real leading label (rejects bare `ghe.com`, `notghe.com`,
and `github.com.attacker.com`). `pull_request_target`, `issue_comment`, `workflow_run` are NOT in
either list -> permanently denied (Pitfall 1). `push`/`schedule` do NOT depend on the host (they are
the trusted writers; the host gate only guards the *widened* events).

### Pattern 2: Single-source allowlist + generated dependency-free CJS copy + drift guard (TRUST-04, D-05/06/07)
**What:** `trust.ts` is the one authored allowlist; a build-time generator emits a committed
dependency-free `.cjs` copy; `selfcheck.cjs` fails CI on any drift.
**When to use:** exactly this requirement. Rebuilds the PoC's `start-cache-server/index.cjs` +
`selfcheck.cjs` pattern that Phase 0 deleted (PITFALLS l.32/236; Phase 0 RESEARCH l.108-109).
**Mechanism (recommended - Claude's discretion allows others):**
1. `trust.ts` exports the allowlist arrays (`TRUSTED_EVENTS`, `HOST_GATED_EVENTS`) - the single
   authored source.
2. A small Node generator (`scripts/generate-trust-cjs.mjs`, run as an npm/Nx build step) extracts
   those array literals from `trust.ts` source (deterministic regex/AST extraction - no build-order
   dependency) and writes the `.cjs` from a fixed template that embeds the arrays + the host-gate
   logic in CommonJS. The `.cjs` is **committed** (a consumer JS action executes it from the pinned
   git ref, before any `npm ci`).
3. `selfcheck.cjs` (dependency-free CJS, wired into `ci.yml`) re-runs the generator into an in-memory
   buffer and byte-diffs the committed `.cjs`; non-zero exit on drift. This catches any hand edit and
   any stale regeneration.
**Why committed, not build-only:** GitHub JS actions run the action's committed code at the pinned
ref with no build step on the consumer side; a `dist/`-only artifact (gitignored) would not be
present. This is why D-06 says the copy exists "because the JS actions run before `npm ci`."
**Parity is two-layered:** the CI `selfcheck.cjs` = byte-identical regeneration (structural drift);
a Vitest spec = semantic parity (behavioral drift) - see Validation Architecture. The behavioral spec
is the load-bearing one; the byte-diff is the cheap "no hand edits" tripwire.

### Pattern 3: Advisory PPE composite action (TRUST-06, D-10/11/12)
**What:** `runs.using: composite` action; consumer supplies `runs-on` + `actions/checkout`; the
action self-installs exact-pinned zizmor + actionlint and runs them advisory (never fails the
consumer's job by default).
**When to use:** exactly this requirement.
**Example (`<ppe-path>/action.yml`):**
```yaml
# Source: docs.github.com metadata-syntax-for-github-actions (composite) + zizmor/actionlint docs
name: 'github-cache PPE hygiene (advisory)'
description: >-
  Best-effort/ADVISORY PPE-hygiene gate: self-installs pinned zizmor + actionlint and audits
  workflows for unsafe triggers. NOT a containment control (that is default-branch protection +
  the sync gate). Consumer supplies runs-on and actions/checkout.
runs:
  using: 'composite'
  steps:
    - name: Install zizmor (pinned)
      shell: bash
      run: pipx install zizmor==1.27.0
    - name: Install actionlint (pinned)
      shell: bash
      run: |
        bash <(curl -sSf https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) \
          1.7.12 "${RUNNER_TEMP}/actionlint-bin"
    - name: zizmor audit (advisory)
      shell: bash
      # --no-exit-codes -> never fails the job (D-12 advisory). --persona regular (default) covers
      # dangerous-triggers, template-injection, cache-poisoning, artipacked, github-env.
      run: zizmor . --no-exit-codes --persona regular
    - name: actionlint (advisory)
      shell: bash
      run: '"${RUNNER_TEMP}/actionlint-bin/actionlint" || true'
```
Constraints (composite-specific, verified): every `run:` step MUST set `shell:`; inputs are read via
`${{ inputs.NAME }}` (no `INPUT_*` env auto-injection for run steps); no top-level `env:` (use
`>> "$GITHUB_ENV"` inside a step). Adopters consume it as `- uses: op-nx/github-cache/<ppe-path>@vX`.
**Advisory mechanics:** zizmor `--no-exit-codes` suppresses its findings-exit-codes (11-14) so a
finding never fails the step; `actionlint || true` swallows its exit 1. Optionally add
`--format=github` to zizmor for inline annotations (note: GitHub renders only the first 10
annotations per step). For this repo's own CI, whether to drop the advisory suppression and gate
hard is the planner's discretion (D-12).

### Pattern 4: Single-source server-produced-key filter (TRUST-08, D-08)
**What:** one leaf module owns the `nx-cache-` prefix, the key builder, and the filter that validates
prefix + hash suffix; backend and publish both import it. Follows the `github-identity.ts`
leaf-extraction precedent (Phase 4).
**When to use:** exactly this requirement; ship FIRST (D-09).
**Example (`src/lib/cache-key.ts`):**
```typescript
// Source: promotes the inline prefix from actions-cache-backend.ts:14 + publish-mirror.ts:22;
// reuses the server's ^[a-f0-9]{1,512}$ space (HASH_PATTERN, server.ts:8).
export const CACHE_KEY_PREFIX = 'nx-cache-';            // the ONE authored literal
const HASH_PATTERN = /^[a-f0-9]{1,512}$/;              // or import from a shared home (see Integration)

export function cacheKeyFor(hash: string): string {
  return `${CACHE_KEY_PREFIX}${hash}`;
}

/** TRUST-08/C16: a genuine server-produced key = prefix + a valid hash, never "any hex". */
export function isServerProducedKey(key: string): boolean {
  return key.startsWith(CACHE_KEY_PREFIX)
    && HASH_PATTERN.test(key.slice(CACHE_KEY_PREFIX.length));
}
```
`publish-mirror.ts` replaces its inline `CACHE_KEY_PREFIX` + `startsWith`/`slice` with
`isServerProducedKey` (and derives the hash via `key.slice(CACHE_KEY_PREFIX.length)`);
`actions-cache-backend.ts` imports `cacheKeyFor` instead of building `nx-cache-${hash}` inline.
The "full filter" (D-08) is the *hash-suffix validation* the Phase 4 cheap-prefix subset lacked - a
`nx-cache-` + garbage key is now rejected, not mirrored.

### Anti-Patterns to Avoid
- **Sharing/coupling the WRITE gate and the SYNC gate.** Widening `isWriteTrusted` must NOT touch
  `isSyncTrusted`/`SYNC_EVENTS`. A shared predicate silently widens the mirror's publish gate to
  `pull_request`/`release` - the exact CREEP precondition ADR C2 exists to prevent (Pitfall 2; Phase
  4 D-01). Keep them separate declarations.
- **Substring host matching.** `serverUrl.includes('github.com')` or `.includes('ghe.com')` admits
  `github.com.attacker.com` and `evilghe.com`. Parse with `URL(...).hostname` and compare
  structurally; fail closed on parse error.
- **Adding `pull_request_target`/`issue_comment`/`workflow_run` to the trusted set.** These run in
  the shared default-branch context and are the actual CREEP vector (Pitfall 1).
- **A build-only (dist/) generated `.cjs`.** It must be committed - a consumer runs it pre-`npm ci`
  from the git ref (D-06).
- **A denylist for write-trust.** Default-deny allowlist only (D-02; TRUST-01).
- **Letting the PPE gate read as the containment control** in code/docs (D-12; ADR C4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub Actions security audit (unsafe triggers, template injection) | A custom YAML scanner / regex hunt for `pull_request_target` | `zizmor` (pinned) | zizmor already encodes dangerous-triggers, template-injection, cache-poisoning, artipacked, github-env with maintained heuristics; a hand-rolled scanner is exactly the "novel-evasion-blind" failure D-12 already accepts - no reason to also own it. |
| Workflow correctness + `run:` script-injection linting | A custom expression/shell checker | `actionlint` (pinned, shellcheck-backed) | actionlint + shellcheck catch untrusted-`${{ }}`-in-`run:` and workflow syntax errors that zizmor does not focus on. |
| Prebuilt-binary install of actionlint | A bespoke curl+arch-detect script | official `download-actionlint.bash <version> <dir>` | The official script handles OS/arch detection and exact-version pinning. |
| Host/URL parsing | Manual string slicing of `GITHUB_SERVER_URL` | `node:url` `URL` (global) | Correct host extraction + rejects malformed input via throw (-> fail closed). Zero deps; available in both the ESM lib and the CJS copy. |
| Hash-shape validation for the key filter | A second `^[a-f0-9]{1,512}$` literal | reuse the server's `HASH_PATTERN` | One pattern, one home - avoids the exact dual-declaration drift TRUST-04/TRUST-08 are about. |

**Key insight:** every deliverable here is a *reuse-and-extend* of an existing repo primitive (the env
predicate, the leaf-module extraction, the exact-pin guard, the config-assertion spec). The only new
external surface is two well-established, exact-pinned CLI tools installed by the composite action.

## Runtime State Inventory

> This phase is code + config + a shipped composite action; it renames nothing and migrates no
> stored data. Inventory included because TRUST-08 changes a filter and TRUST-04 introduces a
> committed generated artifact.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None - no datastore keys/collections/user_ids are renamed. The `nx-cache-` prefix is unchanged (only a new *validation* is added around it); existing `cache-mirror-YYYYMM` assets already carry valid `<hash>-<os>` names and remain readable. | None. |
| Live service config | The PPE composite action, once shipped, is consumed by *adopters'* workflows - but no adopter exists yet (Phase 6 is distribution). This repo's own `ci.yml` may add a PPE step (planner discretion). | None external this phase. |
| OS-registered state | None. | None. |
| Secrets/env vars | Reads `GITHUB_SERVER_URL` (new consumer of an existing runner-injected var) - no new secret. zizmor's online audits (e.g. `known-vulnerable-actions`) can use `GH_TOKEN`; the advisory gate can run `--offline` to avoid needing one. | None (optional: pass `GITHUB_TOKEN` for full zizmor coverage). |
| Build artifacts | NEW committed `trust.generated.cjs` - a build output that is *checked in* (unusual for this repo). Its staleness is the exact failure `selfcheck.cjs` guards. | Wire codegen into the build + `selfcheck.cjs` into CI so a stale copy fails the build (D-07). |

## Common Pitfalls

### Pitfall 1: Widening the trusted set to a dangerous shared-default-scope event
**What goes wrong:** adding `pull_request_target`/`issue_comment`/`workflow_run` alongside
`pull_request`/`release` re-opens CREEP (CVE-2025-36852). Those run in `main`'s cache scope; a fork
poisons an entry a trusted `push` later restores.
**Why it happens:** `pull_request_target` "looks like" `pull_request`; the event name looks
authoritative. It is not - it is fork-spoofable defense-in-depth.
**How to avoid:** add EXACTLY `pull_request` + `release` to `HOST_GATED_EVENTS`; test that the
dangerous trio is refused (extend `REFUSED_EVENTS` in `trust.spec.ts`). Keep the two-layer model
comment: GitHub's server-side token is load-bearing, the in-code gate is belt-and-suspenders.
**Warning signs:** a PR-triggered run's cache is restored by a `main` build; a trusted-set change
with no accompanying refusal test.

### Pitfall 2: Non-structural host matching / not failing closed
**What goes wrong:** `includes('ghe.com')` admits `evilghe.com`; a missing/malformed
`GITHUB_SERVER_URL` defaults to ON.
**Why it happens:** substring checks are easy; the "absent var" branch is easy to forget.
**How to avoid:** `new URL(raw).hostname` + `=== 'github.com' || endsWith('.ghe.com')`; wrap in
try/catch returning `false`; `?? ''` before parse. Test the malformed/empty/`http://github.com` /
`https://github.com.evil.com` / `https://x.ghe.com` / `https://ghes.example.com` matrix.
**Warning signs:** any host test that passes on a non-GitHub host; no test for empty/malformed.

### Pitfall 3: Widening the WRITE gate silently widens the SYNC/mirror gate
**What goes wrong:** the mirror publishes a `pull_request`/`release`-scoped entry as a world-readable
Release asset - the project-specific CREEP re-poisoning path.
**Why it happens:** the two gates coincide today (`{push, schedule}`), so a "shared predicate"
refactor looks like cleanup.
**How to avoid:** touch only `trust.ts`/`isWriteTrusted`. Add a regression test asserting
`isSyncTrusted` still refuses `pull_request`/`release` after the write gate widens (the Phase 4
`sync-gate.spec.ts` content-pin already guards `SYNC_EVENTS`; add an explicit cross-check).
**Warning signs:** `sync-gate.ts` imports anything from `trust.ts`; a `cache-mirror-*` release gains
assets from a PR/release run.

### Pitfall 4: The generated `.cjs` drifts from the TS source
**What goes wrong:** an edit to `trust.ts` (or a hand-edit to the `.cjs`) makes the pre-`npm ci`
action's start-gate diverge from the server's write-gate - a silent, safe-direction-or-not
divergence.
**Why it happens:** two representations of one allowlist; regeneration not run; no drift check.
**How to avoid:** `selfcheck.cjs` regenerate-and-diff wired into CI (D-07) + a Vitest semantic-parity
spec. Never hand-edit the `.cjs` (add a generated-file banner comment).
**Warning signs:** `selfcheck.cjs` not in the check battery; the `.cjs` edited in a commit that did
not run the generator.

### Pitfall 5: GHES fork-safety documented unconditionally (defer to Phase 6 docs, but do not code around it)
**What goes wrong:** treating `pull_request`/`release` as "safe everywhere" ships a hole to GHES
where the server-side guard is absent.
**How to avoid this phase:** the host gate already fails closed on GHES (that IS the mitigation).
Keep the version-gate knob dormant (D-03). The docs caveat (github.com-only backstop + GHES floor) is
Phase 6 (DOCS-03) - do not build a live GHES-enabling path here.

## Code Examples

### zizmor: advisory run covering the PPE named patterns
```bash
# Source: docs.zizmor.sh/usage + /audits (verified 2026-07-20). Regular persona (default) reports
# dangerous-triggers (pull_request_target/workflow_run), template-injection, cache-poisoning,
# artipacked, github-env. --no-exit-codes keeps it advisory (never exits 11-14 on findings).
zizmor . --no-exit-codes --persona regular            # advisory, offline-safe for these rules
zizmor . --format=github --no-exit-codes              # inline annotations (first 10 findings only)
# Exit codes: 0 none | 1 error | 2 argparse | 3 no inputs | 11 info | 12 low | 13 medium | 14 high
```

### actionlint: pinned prebuilt install + advisory run
```bash
# Source: github.com/rhysd/actionlint docs/install.md + docs/usage.md (verified 2026-07-20).
bash <(curl -sSf https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) 1.7.12 ./bin
./bin/actionlint || true      # advisory: swallow exit 1. Exit codes: 0 clean | 1 problems | 2 opts | 3 fatal
# -ignore '<RE2 regex>' to filter specific messages; -shellcheck= -pyflakes= to disable external linters
```

### Config-assertion spec for the composite action (TRUST-06) - mirrors cleanup-workflow.spec.ts
```typescript
// Source: adapts src/cleanup/cleanup-workflow.spec.ts (read tracked YAML, strip comments, assert
// non-vacuously). Pins the exact tool versions (D-11) and the named-rule/advisory posture (D-12).
const src = readFileSync(new URL('../../<ppe-path>/action.yml', import.meta.url), 'utf8');
const code = src.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
expect(code).toMatch(/using:\s*['"]?composite/);
expect(code).toMatch(/zizmor==1\.27\.0/);        // exact pin (mutation-proven)
expect(code).toMatch(/download-actionlint\.bash\D+1\.7\.12/);
expect(code).toMatch(/--no-exit-codes/);          // advisory posture (D-12)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pull_request`/`release` writes treated as unsafe (kept read-only) | GitHub issues a read-only cache token to *untrusted default-branch-scope* triggers only; `pull_request`/`release` keep read-write because they write a non-default-branch scope | 2026-06-26 (github.com + Data Residency) `[CITED: github.blog changelog 2026-06-26, via PITFALLS.md sources]` | This is the guard TRUST-01 detects; it is NOT on any GA GHES -> host-gated fail-closed. |
| `GITHUB_SERVER_URL` == `https://github.com` only | Data-residency enterprises run on a dedicated `*.ghe.com` subdomain (`https://SUBDOMAIN.ghe.com`, API `https://api.SUBDOMAIN.ghe.com`); GHES uses the appliance's own hostname | Data residency GA `[VERIFIED: docs.github.com data-residency + variables-reference]` | Confirms the `.ghe.com` suffix assumption (ADR's "verify before trusting" is now resolved: `.ghe.com` == Data Residency == has the guard). |
| PoC: two hand-maintained `TRUSTED_EVENTS` copies (`trust.ts` + `start-cache-server/index.cjs`) | One TS source + build-time codegen + `selfcheck.cjs` drift guard | This phase (TRUST-04) | Eliminates the dual-copy drift hazard the ADR framing named as a PoC hazard to fix at root. |
| zizmor under the `woodruffw` org / older 0.x | `zizmorcore/zizmor` 1.x (1.27.0) with personas + `--no-exit-codes` | org/1.0 migration | Use `zizmorcore/zizmor`; `--no-exit-codes` is the clean advisory switch. |

**Deprecated/outdated:**
- The `--json`/`--profile`/`--stdin-files` fallow CLI contract (unrelated to this phase, but note the
  repo already runs fallow 2.x/3.x - do not conflate).
- zizmor `--format=json` older exit behavior: prefer `--no-exit-codes` for the advisory switch;
  `--format=sarif` also suppresses the high exit codes if SARIF upload is ever wanted.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The GHES `GITHUB_SERVER_URL` is the appliance's own hostname (anything not `github.com`/`*.ghe.com`), so the fail-closed default catches all GHES. | Pattern 1 / State of the Art | LOW - the design fails *closed* on anything unrecognized, so an unenumerated host simply denies widening (safe direction). `[ASSUMED]` (GHES host is customer-configured; not doc-enumerated this session). |
| A2 | `--no-exit-codes` is the current zizmor 1.27.0 advisory switch and does not itself error. | Pattern 3 / Code Examples | LOW - if the flag name drifts, the executor verifies with `zizmor --help` at install time; fallback is `zizmor ... || true`. `[VERIFIED: docs.zizmor.sh/usage]` but flag stability across minor versions `[ASSUMED]`. |
| A3 | `pipx` is available on the adopter's runner (GitHub-hosted Ubuntu/macOS). | Standard Stack | MEDIUM - self-hosted/GHES runners may lack pipx; the gate is advisory so a failed install degrades to "no audit," but the planner should decide whether to add a `python -m pip install --user pipx` bootstrap or offer the prebuilt-binary path. `[ASSUMED]` for non-hosted runners. |
| A4 | The codegen extracts allowlist arrays from `trust.ts` deterministically (regex/AST) rather than importing the built module. | Pattern 2 | LOW - either mechanism works; the selfcheck diff catches any generator bug. Mechanism is explicit Claude's-discretion. `[ASSUMED]` (recommended, not mandated). |

**If this table looks short:** the security-load-bearing claims (event scope, host values, tool
versions, exit codes, composite syntax) are all `[VERIFIED]`/`[CITED]`; only the items above carry
residual uncertainty, all in the safe (fail-closed / advisory) direction.

## Open Questions (RESOLVED)

1. **PPE composite action path** (`<ppe-path>`).
   - What we know: consumers reference `uses: owner/repo/<path>@ref`; the dogfood action lives at
     `packages/github-cache` (deep path).
   - What's unclear: a short top-level `ppe/` reads cleaner for adopters than
     `packages/github-cache/ppe`.
   - Recommendation: pick a short, stable top-level path (e.g. `ppe/`) for a clean
     `op-nx/github-cache/ppe@vX`; it is Claude's discretion (D-10). Confirm at plan time.
   - RESOLVED: path = `ppe/` (top-level), so adopters consume `op-nx/github-cache/ppe@vX` (plan 05-04).

2. **This repo's own CI: advisory or blocking for the PPE gate?**
   - What we know: D-12 makes it advisory for adopters; this repo's own posture is planner discretion.
   - Recommendation: run it advisory in `ci.yml` first (annotations only), consider hard-gating this
     repo's workflows after a clean baseline. Dogfooding it at all satisfies "shipped installable."
   - RESOLVED: this repo's CI runs the PPE gate ADVISORY (annotations only, `--no-exit-codes`) (plan 05-04 Task 2).

3. **Committed `.cjs` location + who consumes it in v0.0.1.**
   - What we know: nothing in Phase 5 executes the `.cjs` yet (the consumer JS action is Phase 6);
     Phase 5 produces + drift-guards it (TRUST-04 lands here by roadmap).
   - Recommendation: place the `.cjs` where the Phase 6 consumer action will `require` it, commit it,
     and guard it now. Do NOT also build a consumer action this phase (that is Phase 6 scope).
   - RESOLVED: committed at `packages/github-cache/src/action/trust.generated.cjs`, generated + drift-guarded, no consumer action built this phase (plan 05-03).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | codegen, selfcheck, all specs | Yes | 24 (`.node-version`) | -- |
| Vitest | all specs | Yes | ~4.1.0 | -- |
| `pipx` | PPE action zizmor install (on the *consumer's* runner) | On GitHub-hosted runners | preinstalled | `uvx` (needs `uv`) or prebuilt binary |
| `curl` + `bash` | actionlint download script (consumer's runner) | Yes on hosted runners | -- | prebuilt release asset direct download |
| zizmor / actionlint | PPE action runtime only (consumer's runner) | installed at action runtime | 1.27.0 / 1.7.12 | advisory -> degrades to "no audit" if install fails |

**Missing dependencies with no fallback:** none for building/testing this phase locally (codegen +
specs are pure Node/Vitest). The zizmor/actionlint availability is a *consumer-runtime* concern for
the shipped action, not a local build blocker.
**Missing dependencies with fallback:** zizmor install method (pipx -> uvx -> prebuilt binary).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `~4.1.0` (`@nx/vitest`) |
| Config file | `packages/github-cache/vitest.config.mts` |
| Quick run command | `npx nx test github-cache` |
| Full suite command | `npm test` (`nx run-many -t test`) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRUST-01 | Host-detection matrix: `github.com` ON, `*.ghe.com` ON, GHES OFF, malformed/empty OFF (fail-closed); `pull_request`/`release` admitted only on ON hosts; dangerous trio always refused | property/boundary unit | `npx nx test github-cache` (extend `src/lib/trust.spec.ts`) | Extend existing `trust.spec.ts` |
| TRUST-01 | `push`/`schedule` still trusted on ANY host (not host-gated) | unit | `npx nx test github-cache` | Extend `trust.spec.ts` |
| TRUST-01 (guard) | Widening the WRITE gate did NOT widen the SYNC gate (`isSyncTrusted` still refuses `pull_request`/`release`) | regression unit | `npx nx test github-cache` (add cross-check in `sync-gate.spec.ts` or `trust.spec.ts`) | Extend `sync-gate.spec.ts` |
| TRUST-04 | Semantic parity: identical `isWriteTrusted` verdicts across a full env matrix between the TS source and the committed `.cjs` copy; allowlist arrays deep-equal | mutation-proven parity unit | `npx nx test github-cache` (new `trust.generated.spec.ts`, `require()`s the `.cjs`) | ❌ Wave 0 |
| TRUST-04 | Build fails on drift (`.cjs` stale vs regeneration) | drift guard (CI) | `node packages/github-cache/selfcheck.cjs` (wired into `ci.yml`) | ❌ Wave 0 |
| TRUST-08 | Filter admits `nx-cache-<valid hash>`, rejects a foreign key and `nx-cache-<non-hex/garbage>`; `cacheKeyFor` round-trips | unit | `npx nx test github-cache` (new `cache-key.spec.ts`) | ❌ Wave 0 |
| TRUST-08 (single source) | Exactly one authored `'nx-cache-'` literal remains (repo-wide count) OR backend + publish both route through the leaf | config/count assertion | `npx nx test github-cache` (assert in `cache-key.spec.ts`) | ❌ Wave 0 |
| TRUST-06 | Composite `action.yml` structure: `using: composite`, exact pins `zizmor==1.27.0` + actionlint `1.7.12`, named-rule/advisory posture present | config-assertion reading tracked `action.yml` (mutation-proven, like `cleanup-workflow.spec.ts`) | `npx nx test github-cache` (new `<ppe>.spec.ts`) | ❌ Wave 0 |
| TRUST-06 (live) | The PPE action actually runs zizmor/actionlint on a fixture workflow and produces findings | live-CI (advisory job on push) | CI run on the default branch (like the dogfood pair) | ❌ needs live-CI |

### Sampling Rate
- **Per task commit:** `npx nx test github-cache`
- **Per wave merge:** `npm test` + `node packages/github-cache/selfcheck.cjs`
- **Phase gate:** full suite green + `selfcheck.cjs` exit 0 before `/gsd:verify-work`; the live PPE
  run is a first-push closing proof (like Phase 4's mirror round-trip - expect a `human_needed`/live
  close on the actual CI run).

### Wave 0 Gaps
- [ ] `src/lib/cache-key.spec.ts` - filter unit + single-source count (TRUST-08)
- [ ] `src/lib/trust.generated.spec.ts` - semantic parity TS vs `.cjs` (TRUST-04)
- [ ] `selfcheck.cjs` - CI drift tripwire (TRUST-04) + `ci.yml` wiring
- [ ] `<ppe-path>/action.yml` config-assertion spec - pins + named rules + advisory (TRUST-06)
- [ ] Extend `trust.spec.ts` - host-detection matrix + widened events + refusal (TRUST-01)
- [ ] Cross-check in `sync-gate.spec.ts` - write-widen did not widen sync (TRUST-01 guard)
- [ ] Live-CI: an advisory PPE job (+ a small unsafe-pattern fixture workflow) to prove the action runs

Which need live-CI vs local unit: TRUST-01, TRUST-04, TRUST-08 are fully **local unit/config**
(pure predicates + committed files). TRUST-06's *structure* is local config-assertion; TRUST-06's
*behavior* (zizmor/actionlint actually flagging a fixture) needs a **live-CI** run of the composite
action.

## Security Domain

> `security_enforcement: true`, ASVS L1, `security_block_on: high`.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface added (the bearer/token paths are unchanged). |
| V3 Session Management | no | -- |
| V4 Access Control | yes | Write-trust allowlist = the access-control decision; default-deny, host-gated fail-closed (TRUST-01). The load-bearing control is GitHub's server-side token (ADR C1). |
| V5 Input Validation | yes | `GITHUB_SERVER_URL` parsed structurally + fail-closed; the key filter validates prefix + `HASH_PATTERN` (rejects foreign/garbage keys, TRUST-08); tool versions exact-pinned. |
| V6 Cryptography | no | No crypto changed. |
| V14 Config / Build | yes | Committed generated `.cjs` drift-guarded (TRUST-04); exact-pinned external tools; composite action least-surface (advisory, no secrets required). |

### Known Threat Patterns for GitHub Actions cache + workflow trust
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CREEP via widening to a shared-default-scope trigger (`pull_request_target`) | Tampering / EoP | Allowlist only `pull_request`+`release`; refuse the dangerous trio; two-layer model (GitHub server token load-bearing) - TRUST-01, Pitfall 1. |
| Widened WRITE gate silently widening the mirror/SYNC gate -> poisoned public asset | Tampering | Keep gates separate; regression test `isSyncTrusted` still refuses PR/release - Pitfall 3, ADR C2. |
| Spoofed `GITHUB_SERVER_URL` to force widening on GHES | Spoofing | Accepted residual: the in-code gate is fork-spoofable defense-in-depth; GitHub's server-side guard + scope isolation is load-bearing; `/meta` cross-check deferred (D-04). Fail-closed structural parse limits the blast radius. |
| Foreign hex-keyed CI artifact mirrored as a world-readable Release asset | Info Disclosure | `isServerProducedKey` = prefix + `HASH_PATTERN` (TRUST-08/C16); ship FIRST (D-09). |
| Generated `.cjs` drifting from the TS gate | Tampering | `selfcheck.cjs` drift guard + semantic-parity spec (TRUST-04/D-07). |
| PPE gate mistaken for the containment control | (governance) | Positioned advisory in name/description/docs; containment stays TRUST-02 + branch protection (D-12, ADR C4). |

## Sources

### Primary (HIGH confidence)
- docs.zizmor.sh/usage/ - install methods, exit codes (0/1/2/3/11-14), `--no-exit-codes`,
  `--min-severity`, `--format`, config file (`zizmor.yml`), inline ignores.
- docs.zizmor.sh/audits/ - rule names + severities: template-injection, dangerous-triggers,
  cache-poisoning, artipacked, github-env, bot-conditions, excessive-permissions, unpinned-uses,
  secrets-inherit, known-vulnerable-actions.
- github.com/rhysd/actionlint docs/install.md + docs/usage.md - `download-actionlint.bash <version>
  <dir>`, exit codes (0/1/2/3), `-ignore`, shellcheck integration.
- pypi.org/pypi/zizmor/json - zizmor `1.27.0`, `requires_python >=3.10` (2026-07-14).
- api.github.com/repos/zizmorcore/zizmor + rhysd/actionlint releases - zizmor `v1.27.0`,
  actionlint `v1.7.12` (2026-03-30).
- docs.github.com/en/actions/reference/variables-reference - `GITHUB_SERVER_URL == https://github.com`.
- docs.github.com/.../data-residency/... - data-residency enterprises on `https://SUBDOMAIN.ghe.com`
  (API `https://api.SUBDOMAIN.ghe.com`).
- docs.github.com/.../metadata-syntax-for-github-actions - composite action syntax (`using: composite`,
  per-step `shell:`, `${{ inputs.NAME }}`, no top-level env).

### Secondary (MEDIUM confidence)
- .planning/research/PITFALLS.md (first-party) - CREEP mechanics, the dual-`TRUSTED_EVENTS` PoC
  hazard, the 2026-06-26 changelog event scoping, cross-OS/mirror invariants.
- .planning/ARCHITECTURE-DECISION.md (Decision 2, C1/C4/C16) + ROADMAP Phase 5 + 04-LEARNINGS.md.

### Tertiary (LOW confidence)
- None load-bearing; the GHES host value (A1) is inferred but fail-closed by design.

## Metadata

**Confidence breakdown:**
- Standard stack (zizmor/actionlint versions, install, rules, exit codes): HIGH - verified against
  official docs + registry/release APIs in-session.
- Architecture (host gate, codegen, filter, composite action): HIGH - reuses verified repo primitives
  + verified composite syntax; codegen mechanism is a recommended (discretionary) design.
- Pitfalls: HIGH - drawn from first-party PITFALLS.md + the locked ADR/CONTEXT.
- GHES server-URL enumeration (A1): MEDIUM - inferred, but fail-closed by construction.

**Research date:** 2026-07-20
**Valid until:** ~2026-08-20 (30 days). Faster-moving items: zizmor (frequent minor releases - re-verify
the pin at plan/execute time) and the GitHub read-only-cache guard's GHES version floor (still
unpublished; keep the version-gate dormant per D-03).

## RESEARCH COMPLETE
