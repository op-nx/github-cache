# Phase 5: Trust-Widening + PPE Gate - Context

**Gathered:** 2026-07-20 (smart discuss: `--analyze --auto`)
**Status:** Ready for planning

<domain>
## Phase Boundary

Widen write-trust to `pull_request`/`release` only where GitHub's untrusted-default-branch cache
guard exists (host-detected, fail-closed on GHES), from a single-source allowlist; ship the
server-produced-key mirror filter that private-repo mirroring requires; and ship an adopter-facing
PPE-hygiene gate as a composite action. Mode: MVP.

Delivers requirements TRUST-01, TRUST-04, TRUST-06, TRUST-08.

IN SCOPE: widening `isWriteTrusted` (Phase 2) to `pull_request`/`release` gated on host detection;
the single-source allowlist + generated dependency-free action copy + `selfcheck.cjs` parity; the
`nx-cache-` server-produced-key filter promoted to a single-source function shared by publish +
validation; the installable PPE-hygiene composite action (zizmor + actionlint, advisory).

OUT OF SCOPE (later): a custom user-configured allowlist override surface (YAGNI — default implicit
is shipped; add override when an adopter needs it); the GHES version-gate knob (dormant/OFF until a
GHES floor is published); the optional `/meta` spoof cross-check; consumer docs (Phase 6 DOCS-03
documents the trust model); GHCR-conditional trust items (TRUST-09, later milestone).

</domain>

<decisions>
## Implementation Decisions

### Write-Trust Widening (TRUST-01)

- **D-01 (host-detection, fail-closed):** widen the default allowlist to admit `pull_request` and
  `release` ONLY when GitHub's untrusted-default-branch cache guard exists, detected purely from
  `GITHUB_SERVER_URL`: host `github.com` or a `*.ghe.com` suffix -> guard present -> widened trust
  ON; EVERY GHES host (anything else) -> OFF, fail-closed. Pure function of the runner-injected env
  var; NO caller/mode flag. The in-code gate stays fork-spoofable defense-in-depth; the load-bearing
  control is GitHub's server-side read-only-token guard + scope isolation (ADR C1, locked).
- **D-02 (default-only for v0.0.1):** ship the default-deny allowlist with the default IMPLICIT when
  unconfigured. Do NOT build a custom user-configured allowlist override surface this milestone
  (YAGNI; TRUST-01's "else default implicit" is satisfied by the default). If an override is added
  later it MUST route through the same validated allowlist, never a denylist.
- **D-03 (GHES version-gate dormant):** keep any version-gate knob OFF/dormant — no GA GHES has the
  guard today (floor unpublished). Do not wire a live GHES-enabling path.
- **D-04 (spoof cross-check deferred):** the optional `/meta` `installed_version` +
  `X-GitHub-Enterprise-Version` absence cross-check is NOT built this phase (optional in ADR; the
  host check is already defense-in-depth).

### Single-Source Allowlist + Action Copy (TRUST-04)

- **D-05 (single TS source):** `TRUSTED_EVENTS` in `src/lib/trust.ts` stays the ONE source of truth
  for the trusted-event allowlist. The widened `pull_request`/`release` entries and the host-gate
  live in / around it. There is exactly one authored allowlist declaration in the repo.
- **D-06 (generated action copy):** the pre-`npm ci` dependency-free CommonJS action copy is
  GENERATED from the TS single source at build time (codegen), never a hand-maintained dual root
  copy. The dependency-free copy exists because the JS actions run before `npm ci`.
- **D-07 (selfcheck parity):** a `selfcheck.cjs` parity assertion fails the build (and is wired into
  the check battery / CI) if the generated copy ever drifts from the TS source (ADR C-req, locked).

### Server-Produced-Key Filter (TRUST-08)

- **D-08 (promote nx-cache- to single-source filter):** promote the `nx-cache-` prefix already used
  by Phase 4's publish path (D-16) into a single-source filter function; the mirror publishes ONLY
  keys carrying that distinguishing namespace/prefix, never "any 1-512 hex" Actions-cache key. One
  filter function is shared by the publish path and any key validator (parity-guarded, single
  source) — the Phase 4 cheap-prefix subset becomes the full single-source filter here.
- **D-09 (sequence FIRST):** TRUST-08 ships FIRST within the phase (before any private-repo mirror
  enablement) — an unrelated hex-keyed CI artifact would otherwise leak as a world-readable asset.
  Phase 4's public dogfood publish was acceptable pre-filter only because everything is public.

### PPE-Hygiene Gate (TRUST-06)

- **D-10 (composite action form):** ship the installable PPE-hygiene gate as a COMPOSITE ACTION
  (`ppe/action.yml` or similar), consumed by adopters as a STEP inside their own job
  (`- uses: op-nx/github-cache/<ppe-path>@vX`). Chosen over a reusable workflow for step-level
  composability (adopters fold PPE-hygiene into an existing security job alongside other steps).
  Consumer supplies the runner (`runs-on`) + `actions/checkout`; the action self-installs its tools.
- **D-11 (self-installed, exact-pinned tools):** the composite action self-installs BOTH `zizmor`
  (via PyPI: `uvx`/`pipx`, or a prebuilt binary) and `actionlint` (official `download-actionlint.bash`
  prebuilt binary), each EXACT-pinned (matches the repo's pin discipline). The consumer never
  provides the tools.
- **D-12 (named patterns, advisory):** the gate runs zizmor + actionlint for the named unsafe
  patterns — no `pull_request_target` + PR-checkout; no `issue_comment`/`workflow_run` executing PR
  code. It is BEST-EFFORT/ADVISORY defense-in-depth and MUST be positioned as such (never as the
  containment control — that stays TRUST-02 sync gate + default-branch protection). Non-blocking by
  default for adopters; whether this repo's own CI treats it as blocking is the planner's discretion.

### Claude's Discretion
Exact file/module/function names; the codegen mechanism for the dependency-free action copy
(build script vs Nx target vs inline generator); the composite action's directory path and input
surface; zizmor/actionlint exact versions; the precise single-source filter function signature; and
whether this repo's own CI runs the PPE gate blocking or advisory — all at the planner's/executor's
discretion within the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` (Phase 5 section: goal, 4 success criteria, 3 named risks)
- `.planning/ARCHITECTURE-DECISION.md` (Decision 2 write-trust allowlist + host detection; control
  ledger C1 host-detected fail-closed widening, C4 PPE gate advisory, C16 mirror key filter)
- `.planning/REQUIREMENTS.md` (TRUST-01 line 48, TRUST-04 line 51, TRUST-06 line 53, TRUST-08 line 55)
- `.planning/PROJECT.md` (Key Decisions: write-trust allowlist-only host-detected; PPE gate advisory)
- `packages/github-cache/src/lib/trust.ts` (`TRUSTED_EVENTS` / `isWriteTrusted` — the Phase 2 write
  gate this phase WIDENS; the single source D-05 keeps)
- `packages/github-cache/src/lib/trust.spec.ts` (the existing write-gate tests to extend for the
  widened `pull_request`/`release` + host-gate matrix)
- `packages/github-cache/src/lib/sync-gate.ts` (Phase 4 — the SEPARATE sync predicate; widening the
  WRITE gate here must NOT touch the sync gate; keep them separate)
- `packages/github-cache/src/publish/publish-mirror.ts` (Phase 4 — the `nx-cache-` prefix filter
  D-16 to promote to the single-source TRUST-08 filter)
- `packages/github-cache/src/backend/actions-cache-backend.ts` (`cacheKeyFor` — the `nx-cache-`
  prefix origin)
- `packages/github-cache/src/action/index.ts` + `packages/github-cache/action.yml` (the JS action;
  the dependency-free copy pattern reference; note the pre-`npm ci` constraint)
- `packages/github-cache/src/pinned-deps.spec.ts` (the exact-pin guard pattern for D-11 tool pins)
- `.github/workflows/ci.yml` (where the selfcheck parity + PPE gate wire into the check battery)
- `.planning/phases/04-*/04-LEARNINGS.md` (Phase 4 patterns: single-source helpers, config-assertion
  tests reading tracked YAML, sequential-on-main for dep-changing plans)
- `.planning/research/PITFALLS.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `trust.ts` `TRUSTED_EVENTS` / `isWriteTrusted` (Phase 2) — the write gate to widen; the single
  source D-05 preserves. `trust.spec.ts` has the content-pin + default-deny test pattern to extend.
- `sync-gate.ts` `isSyncTrusted` (Phase 4) — the SEPARATE sync predicate; the host-detection helper
  and default-branch-payload reading there may be a template for D-01's host check (reuse, don't
  couple the two gates).
- `publish-mirror.ts` `nx-cache-` prefix filter (Phase 4 D-16) — promote to the single-source
  TRUST-08 filter.
- `pinned-deps.spec.ts` — the exact-pin guard pattern for D-11 (zizmor/actionlint version pins).
- Phase 4's config-assertion test pattern (`cleanup-workflow.spec.ts`: read tracked YAML, strip
  comments, prove non-vacuous by mutation) — directly reusable for asserting the PPE composite
  action's structure and the selfcheck parity.

### Established Patterns
- Single-source comment-locked helpers; silent-drift is the failure mode -> the selfcheck parity
  assertion (D-07) is the drift tripwire.
- Structural env-bag pure predicates (trust/sync gates) — host detection is another pure env fn.
- Exact-pinned deps guarded by `pinned-deps.spec.ts`.
- Sequential-on-main execution when a plan mutates deps (Phase 4 learning) — if the PPE action or
  codegen adds a devDependency, that plan follows the same sequencing.
- TDD mandatory (`workflow.tdd_mode: true`); MVP mode set for this phase.
- No emojis/non-ASCII; ESM `.js` imports; JS actions dependency-free CommonJS pre-`npm ci`.

### Integration Points
- Widen `isWriteTrusted` in `trust.ts` (+ host-detection); extend `trust.spec.ts`.
- New codegen for the dependency-free action-copy + `selfcheck.cjs` parity, wired into CI.
- New single-source key-filter function; refactor `publish-mirror.ts` to consume it.
- New PPE composite action directory (`action.yml` + a runner script) + its spec; wire into ci.yml.

</code_context>

<specifics>
## Specific Ideas

- **PPE gate form = composite action** (user decision, 2026-07-20): step-level composability chosen
  over a one-line reusable workflow; consumer provides runner + checkout, the action self-installs
  zizmor (PyPI/prebuilt) + actionlint (official prebuilt), both exact-pinned.
- **TRUST-08 sequence-first** is a load-bearing ordering (ROADMAP risk): the key filter must land
  before any private-repo mirror path is enabled.
- **Research pointers for the planner (gsd-phase-researcher):**
  1. zizmor distribution + exact-version install on CI (PyPI `uvx zizmor==X` / `pipx` / prebuilt
     binary via cargo-binstall or GitHub releases) and its named-audit rules for the PPE patterns
     (template-injection, dangerous-triggers, artipacked, etc.); actionlint prebuilt-binary install
     (`download-actionlint.bash`) + exact version pin.
  2. The exact `GITHUB_SERVER_URL` values on github.com vs `*.ghe.com` (Data Residency) vs GHES, and
     whether the `.ghe.com` suffix assumption is safe to trust (ADR flags "verify before trusting").
  3. The cleanest codegen for a dependency-free CommonJS action copy from a TS single source in this
     Nx/tsc setup (a build target vs a small generator script) + how selfcheck.cjs asserts parity.

</specifics>

<deferred>
## Deferred Ideas

- Custom user-configured write-trust allowlist override surface -> later (YAGNI; D-02 ships default
  implicit only).
- GHES version-gate live-enabling path + `/meta` spoof cross-check -> dormant until a GHES guard
  floor is published (D-03/D-04).
- Reusable-workflow form of the PPE gate -> not shipped (composite action chosen); could be added
  additively later if adopters want whole-job one-line adoption.
- TRUST-09 (GHCR package-visibility fail-closed assert) + other GHCR-conditional trust items -> later
  milestone (GHCR revisit trigger).
- Consumer trust/security docs -> Phase 6 (DOCS-03).

</deferred>
