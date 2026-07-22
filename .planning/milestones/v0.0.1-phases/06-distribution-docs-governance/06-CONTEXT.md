# Phase 6: Distribution + Docs + Governance - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning
**Mode:** Smart discuss (`--analyze --auto` decision mechanism; one HIGH-impact/medium-confidence gray area escalated to the user, rest auto-locked)

<domain>
## Phase Boundary

Ship the consumer-facing distribution of `@op-nx/github-cache` so outside repos can
adopt the cache safely: the npm package + a JS Action (not composite), the CI
background-step consumption pattern, an enumerated + tested public surface, split
adoption docs (default quickstart vs advanced), a trust/security section, and
governance (SECURITY.md, MIT LICENSE, a versioned consumer-contract/semver statement).

Delivers DOCS-01..06 and GOV-01..03. This is a docs/distribution/governance phase on
top of the code shipped in phases 1-5 — it adds NO new cache behavior. The one hard
constraint: nothing built for THIS repo's own CI/dogfooding may leak into the consumer
contract (see [[dogfood-changes-stay-consumer-safe]]).

</domain>

<decisions>
## Implementation Decisions

### Stability posture & distribution scope (escalated gray area — user decided)
- **D-01 (USER):** Stability posture = **pre-1.0, drift-guarded**. The full consumer
  surface is enumerated + guard-tested (DOCS-05: no *accidental* drift), but GOV-03's
  semver statement follows standard 0.x semantics: the public surface MAY still evolve
  before 1.0; a breaking change bumps the MINOR version and is documented; **1.0 will
  freeze the contract**. The guard test guarantees changes are *intentional and
  reviewed*, not that they never happen. Rationale: honest for an interface built this
  milestone with no external adopters yet; still protects adopters from silent change;
  avoids locking in an unproven interface.
- **D-02:** Packaging kept **lean** (NOT PoC-parity-by-default). The default CI-RW
  quickstart path is the primary product; publish/sync/cleanup ship as advanced,
  opt-in. Exact action-vs-bin packaging is delegated to research/planning, constrained
  by: `serve` and `publish` both need the JS-action runtime for `ACTIONS_RUNTIME_TOKEN`
  (STATE 04-06), so they run as JS action(s)/operations — never plain `run:` bins;
  cleanup uses `GITHUB_TOKEN` + Octokit (`contents:write`) and may be a bin or action.
- **D-03:** Full milestone scope kept — the advanced guide (DOCS-01) and advanced
  example (DOCS-04) for opt-in store/sync/cleanup stay **in scope** (this is NOT the
  "minimal product surface" narrowing that was offered and declined).

### Public surface enumeration & guard (DOCS-05)
- **D-04:** Enumerated surface = **consumer contract only**, three groups: (a) consumer
  env knobs — the Nx client vars `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` /
  `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`, plus the runtime knobs
  `CACHE_MIRROR_MAX_AGE_DAYS`, `MAX_CACHE_BODY_BYTES`, the server port var, and
  `GH_TOKEN`/`GITHUB_TOKEN`; (b) the consumer JS action input(s); (c) the package export
  surface (today `index.ts` re-exports only `createCacheServer` + the `CacheBackend` /
  `GetHit` / `GetResult` / `PutResult` types). Internal module-level exports NOT
  re-exported from `index.ts` (`withHashLock`, `shardTag`, `octokitFault`,
  `isWriteTrusted`, ~25 others) stay OUT of the frozen surface. Locked by the ROADMAP
  risk note + [[dogfood-changes-stay-consumer-safe]].
- **D-05:** Guard mechanism = a test that fails on unintended change to the enumerated
  surface. Snapshot vs explicit-assertion-list is the planner's call; whichever, the
  diff on an intentional change must be human-readable and obviously reviewable.

### Docs organization (DOCS-01/02/03/04)
- **D-06:** Root `README.md` = the 5-minute default quickstart (Actions-cache CI-RW
  only) + landing/nav. It currently is a neutral `@op-nx/source` shell; phase 6 rewrites
  it as the consumer entry point.
- **D-07:** `docs/` dir holds: the advanced guide (opt-in RO store / sync / cleanup); a
  config reference for every `resolve*` knob + the Nx client vars, including the 10 GB
  repo-LRU note and the no-default-local-read note; the trust/security section (D-08);
  and a **minimal** example adopter config, deliberately distinct from THIS repo's
  maximal dogfood config.
- **D-08:** DOCS-03 trust/security content (prescribed by ROADMAP criterion 4): which
  events write; the CREEP posture; the github.com-only backstop + GHES floor (state
  github.com-only and "do not enable PR/release writes on GHES below the floor" — never
  a guessed version); never enable fork-PR tokens/secrets; default-branch-protection +
  ephemeral-single-tenant-runner prerequisites; the coupled `CACHE_MIRROR_MAX_AGE_DAYS`;
  read-only-local-by-design; retention-as-storage-hygiene (NOT poison-containment);
  mirrored keys are anonymously public; freshness-window / mid-session-staleness caveats.

### CI sidecar consumption pattern (DOCS-06)
- **D-09:** Document `serve` as a GitHub Actions **background step** (`background: true`
  + an explicit `cancel:` teardown) with a plain `&` fallback for GHES / older runners,
  plus the JS-action rationale (node24 runtime + `ACTIONS_RUNTIME_TOKEN` by process
  inheritance; why a composite action cannot supply that). The consumer action is
  SEPARATE from `packages/github-cache/action.yml`, which is explicitly the
  internal-dogfood action and must not be presented as the consumer surface.

### Governance (GOV-01/02/03)
- **D-10:** `SECURITY.md` — GitHub private vulnerability reporting as the primary
  channel; a supported-versions table; a coordinated-disclosure window. Required because
  this is a poisoning-class tool. **Any contact email MUST be the public gmail
  (`larsbrinknielsen@gmail.com`), never the maintainer's work domain** — prefer GitHub
  advisories so no email is needed at all.
- **D-11:** `LICENSE` = **MIT** at repo root AND bundled into the published package;
  copyright holder "Lars Gyrup Brink Nielsen" (locked by GOV-02 — not a gray area).
- **D-12:** GOV-03 semver / consumer-contract statement lives in `docs/` (e.g.
  `docs/versioning.md`) + summarized in the README; it defines "breaking" against the
  D-04 enumerated surface, under the D-01 pre-1.0 posture.

### npm publish readiness (DOCS-06 / FOUND-03)
- **D-13:** The package is currently `private: true` with no `files`/`bin`/
  `publishConfig`. Phase 6 makes it publish-READY as public `@op-nx/github-cache`
  (`publishConfig.access: public`), ships only `dist/` (+ LICENSE + consumer README) per
  [[dogfood-changes-stay-consumer-safe]], and adds the consumer bin(s)/action. Under the
  D-01 pre-1.0 posture, being publish-ready + `uses:`-consumable as a JS action is
  sufficient for v0.0.1; an actual `npm publish` can be a later release step (planner's
  discretion whether to wire a release workflow now).

### Claude's Discretion
- Exact action-vs-bin packaging within D-02's `ACTIONS_RUNTIME_TOKEN` constraint.
- Guard-test implementation (snapshot vs explicit list) within D-05.
- `docs/` file names and changelog format.
- Whether to wire an actual npm-publish release workflow now vs publish-ready only (D-13).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (WHAT to deliver)
- `.planning/ROADMAP.md` §"Phase 6: Distribution + Docs + Governance" — the 5 success
  criteria, the DOCS-01..06 / GOV-01..03 traceability table, and the two Risks (surface
  churn on dogfood changes; unpublished GHES floor).
- `.planning/REQUIREMENTS.md` — full acceptance criteria for DOCS-01..06 and GOV-01..03.
- `.planning/PROJECT.md` — vision, distribution constraints ("changes for this repo's own
  CI/hashing must never leak into the consumer contract"), FOUND-03 (npm + JS Action),
  and the Key Decisions table.

### Trust / security model (DOCS-03 source of truth)
- `.planning/ARCHITECTURE-DECISION.md` — the CREEP control ledger (C1-C18); the
  write-trust allowlist + host-gated widening + sync-gate model to be documented.
- `.planning/phases/05-trust-widening-ppe-gate/05-VERIFICATION.md` and `05-SECURITY.md` —
  the FINAL trust / RW-RO model phase 6 documents (docs describe the settled state).
- `packages/github-cache/src/lib/trust.ts`, `src/lib/sync-gate.ts`,
  `src/action/trust.generated.cjs` — the authored trust/sync allowlists (single source
  of truth; the security docs must match these, not restate a guess).

### Public surface enumeration (DOCS-02/DOCS-05 baseline)
- `packages/github-cache/src/index.ts` — the current (minimal) package export surface.
- `packages/github-cache/src/lib/select-backend.ts` — `selectBackend` + the Nx client
  `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` read; the local-read token chain wiring.
- `packages/github-cache/src/lib/retention.ts` — `resolveMaxAgeDays` +
  `CACHE_MIRROR_MAX_AGE_DAYS` (the ONE coupled retention knob).
- `packages/github-cache/src/lib/github-identity.ts` — `resolveGitHubToken`,
  `GITHUB_REPOSITORY_PATTERN`.
- `packages/github-cache/src/server/server.ts` — `MAX_CACHE_BODY_BYTES`, port resolution,
  bearer-token env.
- `packages/github-cache/action.yml` — the INTERNAL dogfood action (the anti-pattern:
  the consumer action must NOT be this; contrast documented in DOCS-06).
- `packages/github-cache/package.json` — current `private: true`, exports, exact-pinned
  deps; the publish-readiness baseline (D-13).

### External references (fold into research)
- Nx self-hosted caching usage notes: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes
- CVE-2025-36852 (CREEP): https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep
- GitHub read-only Actions cache for untrusted triggers: https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/
- Semantic Versioning (GOV-03 baseline): https://semver.org
- GitHub private vulnerability reporting (GOV-01): https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Public barrel** `packages/github-cache/src/index.ts`: already the intended single
  enumeration point — exports `createCacheServer` + 4 port types. DOCS-05's guard tests
  exactly this (plus env knobs + action inputs), not the internal module exports.
- **`serve()`** (`src/serve.ts`) is the composition root the consumer sidecar runs; the
  consumer JS action wraps it (background step). Its SIGTERM drain (STATE 02-06) is what
  makes the `cancel:` teardown safe.
- **Internal dogfood action** `packages/github-cache/action.yml` + `src/action/index.ts`
  (node24, operations seed/verify/publish) is the working reference for how a JS action
  gets `ACTIONS_RUNTIME_TOKEN` — the consumer action mirrors this runtime shape.
- **Trust/sync single sources** `src/lib/trust.ts` + `src/lib/sync-gate.ts` +
  generated `trust.generated.cjs` — the docs render these, never a re-typed copy.

### Established Patterns
- **Ports-and-adapters**: one `CacheBackend` port; the consumer export surface should
  expose the port types (already does) so an adopter *could* bring a backend — but the
  default product is the built-in Actions-cache/Releases composition via `selectBackend`.
- **Zero-runtime-dep JS actions in CommonJS** (they run before `npm ci`); the two-action
  vs one-action packaging must respect this.
- **Exact-pinned deps + `pinned-deps.spec.ts`**: a precedent for the DOCS-05 guard style
  (a spec that fails on an unintended contract change).
- **Dogfood-stays-local**: nx.json / project targets / `.github/workflows` tuning never
  enters the published package (ships only `dist/`). [[dogfood-changes-stay-consumer-safe]]

### Integration Points
- `packages/github-cache/package.json` — flip `private`, add `files`/`bin`/
  `publishConfig`, consumer `action.yml` (or a `dist/`-built consumer entry).
- Repo root — new `README.md` (rewrite), `LICENSE`, `SECURITY.md`, `docs/` tree.
- The guard test slots beside existing specs under `packages/github-cache/src` (or a
  dedicated `*-public-surface.spec.ts`).

</code_context>

<specifics>
## Specific Ideas

- The minimal example adopter config (DOCS-04) must be visibly *smaller* than this repo's
  own `nx.json` / workflow dogfood config — an adopter copies the minimal one, not ours.
- DOCS-02 config reference must include the two explicit notes: the 10 GB repo-LRU
  behavior and "no default local read" (local reads require the opt-in Releases reader +
  the developer's own GitHub auth; no anonymous default).
- Retention docs must present `CACHE_MIRROR_MAX_AGE_DAYS` as the ONE coupled knob (drives
  both read-lookback and cleanup window) and frame retention as storage hygiene, not
  poison containment. See [[retention-locked-requirement]].

</specifics>

<deferred>
## Deferred Ideas

- **Docker container distribution form** — LOCKED-deferred to a later milestone (FOUND-03).
  Not phase 6; the CI-sidecar motivation is covered by the DOCS-06 background-step pattern.
- **GHCR/OCI synced store (GHCR-01) + cosign attestation (PROV-01)** — later-milestone
  revisit trigger (with Docker). Not phase 6.
- **Actual npm publish / release automation** — may be wired now or deferred to a release
  step per D-13 (Claude's discretion); the milestone requires publish-READINESS, not a
  live publish.

None of these expand phase 6 scope.

</deferred>

---

*Phase: 6-Distribution + Docs + Governance*
*Context gathered: 2026-07-20*
