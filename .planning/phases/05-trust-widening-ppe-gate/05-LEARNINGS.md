---
phase: 5
phase_name: "Trust-Widening + PPE Gate"
project: "@op-nx/github-cache"
generated: "2026-07-20"
counts:
  decisions: 5
  lessons: 4
  patterns: 5
  surprises: 2
missing_artifacts: []
---

# Phase 5 Learnings: Trust-Widening + PPE Gate

## Decisions

### PPE-hygiene gate ships as a composite action, not a reusable workflow
The adopter-facing PPE gate (TRUST-06) is a composite action (`ppe/action.yml`) consumed as a STEP.

**Rationale:** step-level composability — adopters fold PPE-hygiene into an existing security job alongside other steps — was preferred over a reusable workflow's one-line whole-job adoption. Consumer supplies `runs-on` + `actions/checkout`; the action self-installs its tools. (User decision after clarifying that tool-provisioning is identical across both forms.)
**Source:** 05-CONTEXT.md D-10

### Host-gated write-trust from a structural GITHUB_SERVER_URL parse, fail-closed
`isWriteTrusted` admits pull_request/release only when `new URL(GITHUB_SERVER_URL).hostname === 'github.com' || endsWith('.ghe.com')` (real leading label), failing closed on GHES/malformed. push/schedule stay host-independent.

**Rationale:** the 2026-06-26 server-side read-only-token guard exists only on github.com + Data Residency (.ghe.com). The in-code gate is fork-spoofable defense-in-depth ONLY; the load-bearing control is GitHub's server-side token + scope isolation (ADR C1). Structural parse (never substring) rejects evilghe.com / github.com.attacker.com / bare ghe.com.
**Source:** 05-CONTEXT.md D-01; 05-RESEARCH.md

### Single TS source -> generated dependency-free .cjs -> two-layer drift guard
`TRUSTED_EVENTS`/`HOST_GATED_EVENTS` live once in trust.ts; a committed `trust.generated.cjs` is generated (never hand-edited) for the pre-npm-ci action; drift is guarded by BOTH a `selfcheck.cjs` byte-diff AND a `trust.generated.spec.ts` full-matrix semantic-parity spec.

**Rationale:** consumer JS actions run before `npm ci`, so the allowlist copy must be dependency-free CommonJS; a single authored source + codegen prevents the dual-copy drift hazard the Phase 0 teardown named.
**Source:** 05-CONTEXT.md D-05/D-06/D-07

### Promote nx-cache- to a cache-key.ts leaf, ship it FIRST
`isServerProducedKey` (prefix + HASH_PATTERN hex-suffix) in a `cache-key.ts` leaf is the single-source filter; both nx-cache- call sites + HASH_PATTERN route through it. Sequenced first in the phase (D-09).

**Rationale:** the mirror must publish only server-produced keys before any private-repo mirror, or unrelated hex-keyed CI artifacts leak as world-readable assets (TRUST-08/ADR C16). Follows the github-identity.ts leaf precedent.
**Source:** 05-CONTEXT.md D-08/D-09

### Deferral decisions are locked as prohibitions, not omissions
No custom write-trust override surface (D-02), no live GHES-enabling path (D-03), no /meta spoof cross-check (D-04) — each recorded as a `must_haves.prohibitions` "MUST NOT build X".

**Rationale:** a "do NOT build" decision is a real scope fence; encoding it as a prohibition both satisfies the decision-coverage gate and prevents scope creep, rather than being an untracked omission.
**Source:** 05-02-PLAN.md must_haves.prohibitions; decision-coverage gate

---

## Lessons

### A live-CI-only leg catches execution bugs a config-assertion spec structurally cannot
The PPE action's config-assertion spec (reads `action.yml` TEXT — structure, pins, advisory posture) passed locally, but the actual actionlint install FAILED on the first live run: `download-actionlint.bash` requires its target DIR to pre-exist and does not create it, so the step exited 1 ("Directory ... does not exist"). A `mkdir -p` was missing.

**Context:** the config-assertion inspects the action's text; only real execution on a runner exercises the install. This is exactly why the phase scoped a live-CI leg (like Phase 4's cross-OS round-trip). CI run 29771418344 red -> fix fe08c7c -> 29772015309 green.
**Source:** CI run 29771418344 failure; fix fe08c7c

### Advisory swallowing must wrap the SCAN, not the INSTALL
The `ppe` job is advisory (findings never fail the job: zizmor `--no-exit-codes`, actionlint `|| true`) — but a tool-INSTALL failure correctly still fails the job. That is why the missing-mkdir defect surfaced as a red job rather than being silently swallowed.

**Context:** an advisory gate that swallowed install failures too would silently stop scanning while reporting green — worse than a loud install failure.
**Source:** 05-04 ppe/action.yml; the live failure classification

### A codegen drift guard can silently overclaim its coverage
`selfcheck.cjs` extracts only the two allowlist ARRAYS from trust.ts; the host-gate function body is hardcoded in the generator template. So a host-gate LOGIC change to trust.ts regenerates byte-identical output and selfcheck falsely reports "in sync" — the `.cjs` is semantically stale but the byte-diff passes. The real backstop is the `trust.generated.spec.ts` semantic-parity suite. The lesson: scope the guard's claims accurately (the "byte-diffs on ANY drift" comment was corrected).
**Source:** 05-REVIEW.md WR-01; fix in selfcheck.cjs/ci.yml comments

### A guard you do not test can silently stop guarding
`selfcheck.cjs`'s own exit-0/exit-1/`--write` drift-detection contract was only proven by a one-time manual mutation-and-revert (prose in a SUMMARY) until the Nyquist auditor generated `selfcheck.spec.ts` (4 tests, spawning the real CLI against an isolated temp copy, mutation-proven that a broken detector would be caught). A drift tripwire with no regression test can regress into a no-op unnoticed.

**Context:** second consecutive phase where the dedicated Nyquist auditor found+filled a genuine coverage gap (Phase 4: RETAIN-03; Phase 5: the selfcheck contract) — the never-self-certify rule pays for itself.
**Source:** 05-VALIDATION.md audit trail; selfcheck.spec.ts

---

## Patterns

### Deferral decisions -> must_haves.prohibitions
Encode "MUST NOT build X" scope fences as prohibitions in the relevant plan. Satisfies the decision-coverage gate AND documents intent, rather than leaving the deferral as an invisible omission a reviewer might mistake for a miss.

**When to use:** any YAGNI/deferral decision from discuss that the phase deliberately does not implement.
**Source:** 05-02-PLAN.md

### Route action inputs through env:, never interpolate into run:
`${{ inputs.path }}` interpolated into a `run:` shell line is the classic GH Actions template-injection shape. Pass it as `env: { AUDIT_PATH: ${{ inputs.path }} }` and reference quoted `"$AUDIT_PATH"`.

**When to use:** any composite/reusable action step that consumes a caller-supplied input in a shell command. (Ironically flagged here by zizmor, the tool the action ships.)
**Source:** 05-REVIEW.md WR-03; fix in ppe/action.yml

### Pin the installer SCRIPT (tagged ref), not just the binary version
A `curl | bash` of `download-actionlint.bash` from `main` is unpinned even when the binary version arg is pinned. Fetch the script from a tagged ref (`.../v1.7.12/scripts/...`) so both the script and the binary are reproducible.

**When to use:** any curl-pipe-bash tool install, especially inside an action adopters run in credentialed jobs.
**Source:** 05-REVIEW.md WR-02; fix in ppe/action.yml

### Scanner fixtures live OUTSIDE .github/workflows
The deliberately-unsafe fixture workflow the PPE gate scans is kept at `ppe/fixtures/` so GitHub never schedules it as a real workflow — it is a scan target only.

**When to use:** any repo shipping a linter/scanner with a known-bad example workflow.
**Source:** 05-04-SUMMARY.md; T-05-06-02

### Transient main-as-CI-proving-ground, then restore
For live proofs gated on push-to-default-branch (publish, PPE advisory), push the feature branch to `main` to run them, then restore `main` to a pre-milestone backup ref (force-with-lease) so the in-progress work stays on the feature branch and main is not advanced prematurely.

**When to use:** a milestone whose live proofs require the default branch but whose work should not land on main until the milestone ships. Capture the backup ref BEFORE the first push.
**Source:** user directive (Phase 4 + Phase 5 live proofs; restore to 98da97a)

---

## Surprises

### The advisory PPE job failed red on its first live run
A job explicitly designed never to fail on findings failed anyway — on a tool-install defect (missing mkdir), not a finding. The advisory posture is scoped to findings only, which is correct, so a deterministic install bug surfaced loudly.

**Impact:** required a fix + re-push; validated that the live leg (not just the config-assertion) is load-bearing. Green on the second run (29772015309).
**Source:** CI run 29771418344

### A scripts-only package.json change carries no cross-OS npm-ci risk
Phase 5 edited package.json (added `selfcheck`/`generate:trust` scripts) but did NOT touch package-lock.json — so, unlike Phase 4's `@octokit/rest` addition, the push carried no cross-OS lockfile-drift risk. The `[DEP CHANGE]` heuristic (package.json in the diff) was a false alarm; the lockfile is the real signal.

**Impact:** confirmed the push was npm-ci-safe up front, avoiding a needless container lockfile regen.
**Source:** pre-push dep-change check
