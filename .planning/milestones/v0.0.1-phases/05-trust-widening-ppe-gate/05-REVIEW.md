---
phase: 05-trust-widening-ppe-gate
reviewed: 2026-07-20T00:00:00Z
depth: deep
files_reviewed: 10
files_reviewed_list:
  - packages/github-cache/src/lib/cache-key.ts
  - packages/github-cache/src/lib/trust.ts
  - packages/github-cache/src/action/trust.generated.cjs
  - packages/github-cache/selfcheck.cjs
  - packages/github-cache/src/backend/actions-cache-backend.ts
  - packages/github-cache/src/publish/publish-mirror.ts
  - packages/github-cache/src/server/server.ts
  - ppe/action.yml
  - ppe/fixtures/unsafe-workflow.yml
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-20T00:00:00Z
**Depth:** deep
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the trust-widening (TRUST-01/ADR C1/C2), single-source key-integrity
(TRUST-04/TRUST-08), and PPE-hygiene-gate (TRUST-06) surfaces for Phase 5,
including cross-file call chains from `trust.ts` through `select-backend.ts`
into the two backends, the `trust.ts` -> `trust.generated.cjs` generation
pipeline (`selfcheck.cjs`), and the shipped `ppe/action.yml` composite action.

**The core trust-boundary logic is correct and well-defended.**
`hostSupportsWidenedTrust` parses `GITHUB_SERVER_URL` structurally via
`new URL().hostname` and fails closed on any throw; the
`=== 'github.com' || endsWith('.ghe.com')` check correctly rejects bare
`ghe.com`, `notghe.com`, `evilghe.com`, and `github.com.attacker.com`
(verified both by static reading and by tracing `trust.spec.ts`'s adversarial
matrix, all 424 tests green). `push`/`schedule` stay host-independent; only
`pull_request`/`release` are host-gated; `trust.ts` imports nothing (so it
cannot import `sync-gate.ts`), and `sync-gate.ts` declares its own separate
`SYNC_EVENTS` allowlist rather than reusing `trust.ts`'s — ADR C2's gate
separation holds. `isWriteTrusted`/`selectBackend` both take a single
`env`-only parameter with a default (no caller/mode flag, TRUST-05).
`CACHE_KEY_PREFIX` and `HASH_PATTERN` are each declared exactly once, in
`cache-key.ts`, and `isServerProducedKey` (prefix + full-anchored
`^[a-f0-9]{1,512}$`) is applied in `publish-mirror.ts` *before* any restore,
correctly rejecting foreign and `nx-cache-<non-hex>` keys.

Confirmed via the project's authoritative signals: `npx nx test github-cache`
(424/424 green, including the 147-case `trust.generated.spec.ts` semantic
parity suite), `npx nx typecheck github-cache` (clean), and
`node packages/github-cache/selfcheck.cjs` (reports "in sync").

The issues below are real but none rise to a proven exploitable defect in the
shipped logic today — they are design/documentation gaps that weaken the
trust boundary's *long-term* self-defense (the generator's drift claim, an
unpinned install-time script fetch, and a template-injection-shaped pattern
inside the very action that scans for template injection).

## Warnings

### WR-01: `selfcheck.cjs`'s "byte-diffs on ANY drift" claim overstates its actual coverage

**File:** `packages/github-cache/selfcheck.cjs:10-12` (claim), `:80-136` (`generateTrustCjs`, the mechanism), cross-referenced with `.github/workflows/ci.yml:44-47` (the same overclaim repeated in the CI job comment) and `packages/github-cache/src/lib/trust.generated.spec.ts:5-18` (the correctly-scoped comment).

**Issue:** `generateTrustCjs()` only *extracts from `trust.ts`'s source* the two
allowlist array literals (via `extractArrayLiteral`, lines 44-66). Every other
line of the generated file — including the entire bodies of
`hostSupportsWidenedTrust` and `isWriteTrusted` (lines 100-129) — is a fixed,
hand-authored JS template string baked into `selfcheck.cjs` itself, not
derived from `trust.ts`'s actual function source at all.

Consequence: if a future change edits `trust.ts`'s *function logic* (e.g.
the host comparison, the CI/event-name guard, or the fail-closed
try/catch) without also hand-updating `selfcheck.cjs`'s hardcoded template,
running `node packages/github-cache/selfcheck.cjs --write` regenerates
**byte-identical** output to before (since the arrays didn't change), and the
committed `trust.generated.cjs` is reported `in sync` — even though it now
silently diverges from `trust.ts`'s real, changed behavior. This directly
contradicts the tool's own header claim ("byte-diffs the committed copy to
fail CI on any drift... **or a trust.ts change with no regeneration**") and
the identical claim restated in `ci.yml:44-47` ("exiting non-zero on ANY
drift... or a trust.ts change with no regeneration"). Only hand-edits *to the
`.cjs` itself* are actually caught by this mechanism — logic drift in
`trust.ts` is not.

The codebase is not unaware of this: `trust.generated.spec.ts`'s own comment
correctly scopes `selfcheck.cjs` as merely "the cheap 'no hand edits'
tripwire" and names its own semantic-parity assertions as "the load-bearing
behavioral check" — but that accurate framing lives only in the spec file's
comment, while `selfcheck.cjs`'s own header and the `ci.yml` job comment both
overclaim full drift coverage. A future maintainer who reads only the
generator or the CI job (the more discoverable places) would reasonably but
incorrectly conclude that `selfcheck` alone guarantees semantic fidelity.

This is narrowed further by a matrix gap: `trust.generated.spec.ts`'s
`SERVER_URL_VALUES` (`https://github.com`, `https://octocorp.ghe.com`,
`https://ghes.example.com`, `https://github.com.attacker.com`, `''`,
`undefined`) does not include the `https://notghe.com` / bare `https://ghe.com`
edge cases that `trust.spec.ts` exercises directly against `trust.ts`. A
hypothetical divergence between `trust.ts` and the generated `.cjs` that only
manifested for those two inputs would not be caught by the parity test either
— narrowing, but not eliminating, the practical residual risk given the
current comprehensive `trust.spec.ts` suite.

**Fix:** Either (a) have `selfcheck.cjs` extract the actual function bodies of
`hostSupportsWidenedTrust`/`isWriteTrusted` from `trust.ts`'s source (regex or
a minimal AST walk) instead of hardcoding them, so a real logic edit forces a
genuine byte diff; or, at minimum, (b) correct the overclaiming comments in
`selfcheck.cjs:10-12` and `ci.yml:44-47` to state precisely what is checked
("the two allowlist arrays plus hand-edit detection of the `.cjs`; host-gate
*logic* fidelity is verified by `trust.generated.spec.ts`, not by this byte
diff"), and add `https://notghe.com` / `https://ghe.com` to
`trust.generated.spec.ts`'s `SERVER_URL_VALUES` matrix for parity with
`trust.spec.ts`'s edge-case coverage.

### WR-02: PPE gate's actionlint installer fetches an unpinned script from `main`

**File:** `ppe/action.yml:37-41`

**Issue:**
```yaml
    - name: Install actionlint (exact-pinned 1.7.12)
      shell: bash
      run: |
        bash <(curl -sSf https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) \
          1.7.12 "${RUNNER_TEMP}/actionlint-bin"
```
The actionlint **binary** version is exact-pinned (`1.7.12`), but the
**installer script itself** is fetched from `actionlint`'s `main` branch —
an unpinned, mutable ref — and piped straight into `bash`. This is the
canonical curl-pipe-bash supply-chain pattern (the same class of issue
zizmor's own `unpinned-uses` rule flags for `uses:` refs). If that upstream
script were ever compromised, arbitrary code executes with this composite
action's job's permissions.

Severity assessment (per the task's ask to weigh it): this action is
advisory-only for its own *findings* (`--no-exit-codes`, swallowed exit) and
carries no secrets of its own — that "advisory" framing bounds the finding
that gets *reported*, but not the fact that the install step *executes
arbitrary fetched code* regardless of whether the scan result is advisory.
Because this composite action is shipped for adoption by external consumers
(`uses: op-nx/github-cache/ppe@vX` as a step inside the adopter's own job,
per the file's own header comment), a consumer that runs it in a job that
also has other steps carrying secrets/tokens would have those creds exposed
to any code this install step executes. Given `rhysd/actionlint` is an
actively maintained, reputable project, the likelihood is low, but the
mitigation is essentially free (a version tag or commit SHA is a drop-in
replacement for `main` in the URL) — this stays a Warning rather than
Critical because of the bounded blast radius in this repo's own dogfood job
(no secrets present there), but consumers embedding it in credentialed jobs
inherit the full risk.

**Fix:** Pin the script fetch to the same `1.7.12` tag (or better, a commit
SHA) instead of `main`:
```yaml
        bash <(curl -sSf https://raw.githubusercontent.com/rhysd/actionlint/v1.7.12/scripts/download-actionlint.bash) \
          1.7.12 "${RUNNER_TEMP}/actionlint-bin"
```

### WR-03: zizmor step interpolates `${{ inputs.path }}` directly into a shell `run:` step

**File:** `ppe/action.yml:47`

**Issue:**
```yaml
    - name: zizmor audit (advisory)
      shell: bash
      run: zizmor "${{ inputs.path }}" --no-exit-codes
```
`${{ inputs.path }}` is substituted as literal text into the script *before*
bash ever sees it (GitHub Actions expression interpolation is not
shell-escaped). Any input value containing a `"` followed by shell
metacharacters breaks out of the quoting and injects arbitrary commands. This
composite action's own documented contract expects `path` to be a trusted,
static string the consumer supplies (default `.`), so exploitability today
requires a consumer to carelessly wire an untrusted expression (e.g. a PR
title or another action's output) into this input — nothing in `action.yml`
validates or restricts the value. It is nonetheless the exact
template-injection shape (`${{ }}` interpolated directly into `run:`) that
this action's own zizmor scan targets in *other* workflows, and the standard
GitHub-recommended mitigation (route through an `env:` var, reference `$VAR`
in the script) is not applied here.

**Fix:**
```yaml
    - name: zizmor audit (advisory)
      shell: bash
      env:
        AUDIT_PATH: ${{ inputs.path }}
      run: zizmor "$AUDIT_PATH" --no-exit-codes
```

## Info

### IN-01: Live CI never exercises the newly-widened `pull_request`/`release` write path

**File:** `.github/workflows/ci.yml:159-201` (`dogfood-seed`/`dogfood-verify`), `:218-270` (`publish`)

**Issue:** All of the write-capable dogfood/publish jobs gate on
`github.event_name == 'push'`, and the workflow's own `on:` block never
triggers on `release`. TRUST-01's host-gated widening of `isWriteTrusted` to
`pull_request`/`release` on `github.com`/`*.ghe.com` is exhaustively unit- and
parity-tested (`trust.spec.ts`, `trust.generated.spec.ts`,
`select-backend.spec.ts`), but this repo's own CI never live-proves a real
writable cache round-trip over the new widened triggers the way it does for
`push` (dogfood-seed/verify, publish/publish-verify). Not a defect — the unit
coverage is thorough — but worth noting as a live-validation gap for the
phase's headline feature, should a live canary ever be desired.

### IN-02: `trust.generated.spec.ts` env matrix omits two edge-case hosts covered elsewhere

**File:** `packages/github-cache/src/lib/trust.generated.spec.ts:41-48`

**Issue:** `SERVER_URL_VALUES` does not include `https://notghe.com` or
`https://ghe.com` (bare), both of which `trust.spec.ts`'s
`FAIL_CLOSED_SERVER_URLS` exercises directly against `trust.ts`. Adding them
to the cross-file parity matrix would close the narrow residual gap noted in
WR-01 and make the `.cjs`/`trust.ts` parity check exercise the exact same
adversarial host set as the direct unit test.

---

_Reviewed: 2026-07-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
