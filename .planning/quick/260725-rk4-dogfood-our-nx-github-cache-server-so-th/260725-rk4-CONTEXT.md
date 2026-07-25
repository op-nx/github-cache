# Quick Task 260725-rk4: Dogfood our Nx GitHub cache server so that all relevant Nx tasks in CI route through it - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning
**Mode:** --full --auto (gray areas auto-decided; trap-quadrant items flagged as BLOCKER, none found)

<domain>
## Task Boundary

Make this repo's OWN cacheable Nx tasks in `.github/workflows/ci.yml` route through the shipped `@op-nx/github-cache` server (the loopback sidecar), so CI produces real cross-run remote cache hits/misses for the repo's own build/test/typecheck/lint work — not just the existing dedicated `dogfood-seed`/`dogfood-verify`/`consumer-smoke`/`publish` proof jobs (which only seed+read-back within a single run, keyed on `run_id`).

Currently `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` is set ONLY in the `consumer-smoke` job (ci.yml:270). The repo's real `build`/`typecheck`/`test`/`format-check`/`fallow` jobs run on Nx's LOCAL cache only (Phase 0 teardown deliberately made CI local-cache-only). This task reverses that for the repo's own tasks by launching the sidecar per job and pointing Nx at it.
</domain>

<decisions>
## Implementation Decisions (auto-locked; --auto)

### Sidecar launch mechanism
- **Use the shipped `./start-cache-server` JS action as a `background:` step** in each job that runs cacheable Nx tasks (the DOCS-06 pattern, already proven live by `consumer-smoke` on run 29884131798). It uses the committed, drift-guarded `start-cache-server/index.js` bundle, so it needs NO prior build step — no chicken-and-egg for the `build` job. Consumer sets `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` + `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` before the action adopts them (the corrected handshake), then `cancel:` teardown at job end. HIGH confidence.

### RW vs RO / trust  (mechanism CORRECTED by 260725-rk4-RESEARCH.md — authoritative)
- **Let `selectBackend` decide per runtime context — do NOT add any caller mode flag** (the no-flag safety property, TRUST-05). HIGH confidence.
- **CORRECTION (research, code-traced):** `selectBackend` returns the *writable* Actions-cache backend on a github.com `pull_request` too (`isWriteTrusted` is host-gated-trusted). Read-only on PRs is enforced by **GitHub's platform** (cache scope isolation + the 2026-06-26 read-only-actions-cache token), NOT by our code. Two consequences the plan MUST honor:
  1. **Every wired job — push AND pull_request — must pass `GITHUB_TOKEN` to the `./start-cache-server` step.** Without a token `selectBackend` degrades to the empty in-memory backend and the job reads/writes NOTHING.
  2. **Do NOT push-gate these jobs** (`if: github.event_name == 'push'`) — that would strip PR read benefit. The real Nx-task jobs run on both events; the platform makes PRs read-only.

### Which tasks route through it  (target list CORRECTED by research — authoritative)
- **Exactly the cacheable Nx targets `nx show project github-cache` reports `cache: true`: `build`, `typecheck`, `test`, `integration`** (integration is a 2-leg ubuntu+windows matrix). There is **no `lint` target**; `format:check` is a workspace formatter (not a cacheable task) and `fallow` is a shell tool — both OUT. Other shell jobs (pack-check, action-bundle-drift, selfcheck, ppe, publish, the dedicated dogfood/consumer proof jobs) are OUT. HIGH confidence.

### Per-job vs shared sidecar
- **Per-job background sidecar.** GitHub Actions jobs run on isolated runners; there is no cross-job shared process. Each Nx-task job gets its own sidecar + env. HIGH confidence.

### Cross-OS
- **Safe as-is.** The store is OS-namespaced (CORR-01) and the JS action runs cross-OS; the `integration` matrix (ubuntu + windows) can route through the sidecar without wrong-OS hits. HIGH confidence.

### Key-collision avoidance
- **The repo's real Nx-task cache keys (Nx-client-generated hashes) must not collide with the `nx-cache-<run_id>` dogfood/consumer/publish keys.** They are a different namespace, but a readiness-poll/cache-key collision bit us once (fixed in `consumer-smoke`). The plan MUST keep the real-task jobs' keys disjoint from the run_id-keyed proof jobs. MEDIUM confidence — call out explicitly in the plan as a risk to verify, NOT a blocker.

### Claude's Discretion (delegated to planner/executor)
- Exact per-job YAML shape (where the background step and env exports sit relative to `npm ci` and the Nx run step).
- Whether to keep the dedicated dogfood/consumer proof jobs as-is (recommended: keep — they prove distinct properties) or fold some in.
- Port selection per job (avoid clashes if two sidecars ever share a runner — they do not, one per job).
</decisions>

<specifics>
## Specific Ideas

- Reference implementation already in-repo: the `consumer-smoke` job (ci.yml:248-330) is the exact background-step + env-handshake + `cancel:` pattern to replicate for real Nx-task jobs.
- Docs: `docs/` DOCS-06 background-step sidecar pattern; README quickstart `uses: op-nx/github-cache/start-cache-server@v0`.
- Nx client vars: `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`, `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` (DOCS-02).
</specifics>

<canonical_refs>
## Canonical References

- `.github/workflows/ci.yml` (the file to modify; consumer-smoke is the template).
- `start-cache-server/action.yml` + `start-cache-server/index.js` (the sidecar action).
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md` (current shipped-tree map, just refreshed).
- `docs/configuration.md`, `docs/versioning.md` (env knobs / consumer contract).
- Nx self-hosted caching usage: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes
</canonical_refs>

<open_considerations>
## Non-blocking considerations (surfaced, not blocking)

- **Value/latency on a small workspace:** routing a tiny workspace's tasks through a loopback sidecar + Actions-cache round-trip may add latency without a cross-run speedup. The task is explicitly to DOGFOOD (prove it works on real workloads), so this is accepted; note it in the plan as an observation to measure, not a reason to narrow scope.
- **PR read usefulness:** PR jobs get RO reads of default-branch cache entries — useful only once push runs have populated them. Expected and correct.
</open_considerations>
