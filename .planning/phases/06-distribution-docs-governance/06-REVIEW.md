---
phase: 06-distribution-docs-governance
reviewed: 2026-07-21T00:00:00Z
depth: deep
files_reviewed: 26
files_reviewed_list:
  - .github/workflows/ci.yml
  - .fallowrc.jsonc
  - .prettierignore
  - docs/advanced.md
  - docs/configuration.md
  - docs/examples/minimal-ci.yml
  - docs/examples/README.md
  - docs/trust-and-security.md
  - docs/versioning.md
  - esbuild.action.mjs
  - LICENSE
  - nx.json
  - package.json
  - packages/github-cache/LICENSE
  - packages/github-cache/package.json
  - packages/github-cache/pack-check.cjs
  - packages/github-cache/README.md
  - packages/github-cache/src/docs-adoption.spec.ts
  - packages/github-cache/src/docs-trust.spec.ts
  - packages/github-cache/src/governance-email.spec.ts
  - packages/github-cache/src/pinned-deps.spec.ts
  - packages/github-cache/src/public-surface.spec.ts
  - README.md
  - SECURITY.md
  - start-cache-server/action.yml
  - start-cache-server/entry.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-21T00:00:00Z
**Depth:** deep
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Phase 6 ships the public distribution surface (npm package `files:["dist"]`, the
`start-cache-server` JS action + its esbuild bundler), adoption/trust/versioning
docs, governance files (LICENSE, SECURITY.md), and a set of content/contract
guard specs. Cross-referenced the consumer action entry against `serve.ts`, the
esbuild `import.meta.url` shim against `serve.ts`'s direct-invocation guard, and
each guard spec against the real sources it claims to police.

Verified-clean, adversarially:

- **`start-cache-server/entry.ts` token handling is correct.** `serve()` never
  prints the token here (its `main()` is guarded off in the bundle -- see below),
  and `core.setSecret(running.token)` runs before both `exportVariable` calls, so
  there is no unmasked-token log path.
- **`esbuild.action.mjs` shim is correct.** The `define` rewrites `import.meta.url`
  to a banner constant pointing at a never-emitted sibling `index.mjs`, keeping
  `serve.ts`'s `import.meta.url === pathToFileURL(argv[1]).href` guard **false**
  under `node index.js` -- so the bundle does not spawn a second server or print
  the token. The CI `consumer-smoke` job proves the round trip live.
- **Guards mostly bite.** `pinned-deps`, `public-surface` (value exports via
  `Object.keys`, action inputs, knob-in-source cross-check), `docs-adoption`,
  `docs-trust` (imports the real allowlists), and `governance-email` all read the
  actual sources and fail on genuine drift -- not tautologies. Confirmed every
  documented env knob is present in `KNOB_SOURCE_FILES`, so those `it.each` cases
  pass rather than being silently broken.
- **No email leak.** The only email-shaped token across scanned files is the
  approved public gmail (`packages/github-cache/package.json` author). SECURITY.md
  routes disclosure through GitHub private reporting with no contact email.
  Non-ASCII scan across all 26 files: clean.
- **Trust posture not weakened by prose.** `trust-and-security.md` and
  `advanced.md` explicitly forbid fork-PR write tokens/secrets and never enable
  sub-floor-GHES writes; the `&` fallback is documented read-only.

Findings below are documentation-accuracy defects and guard-coverage gaps -- no
blockers, but two of them ship broken/misleading instructions to adopters.

## Warnings

### WR-01: minimal-ci.yml comment falsely claims the pull-request backend is read-only

**File:** `docs/examples/minimal-ci.yml:35-37`
**Issue:** The primary adopter example annotates the `GITHUB_TOKEN` env with:

```yaml
# Selects the writable Actions-cache backend on trusted triggers
# (push / schedule). On a pull request the backend is read-only.
```

This contradicts the actual code. `pull_request` is in `HOST_GATED_EVENTS`
(`lib/trust.ts:25`), and `isWriteTrusted` returns `hostSupportsWidenedTrust(env)`
for host-gated events (`lib/trust.ts:66-67`). On `github.com` (the common case)
`hostSupportsWidenedTrust` is `true`, so with a valid `GITHUB_REPOSITORY` and a
resolvable token `selectBackend` returns `createActionsCacheBackend()` -- the
**writable** backend -- on a pull request (`lib/select-backend.ts:36-63`), not a
read-only one. The workflow triggers on `pull_request`, so this is exercised.

The trust model stays safe because GitHub's server-side read-only-default-branch
cache-token guard contains PR writes (correctly documented in
`docs/trust-and-security.md` sections 3 and 5), **not** because the app selects a
read-only backend. The comment misattributes where CREEP containment lives -- the
exact confusion the trust doc's "where containment actually lives" section works
to prevent -- and could lead an adopter to believe app-level read-only makes
default-branch protection optional.
**Fix:** Align the comment with the code and the trust doc, e.g.:

```yaml
# Selects the writable Actions-cache backend on trusted triggers
# (push / schedule; also pull_request/release on github.com). Fork/PR
# cache writes are contained by GitHub's server-side read-only cache
# guard + default-branch protection, not by the app -- see
# docs/trust-and-security.md.
```

### WR-02: advanced.md `&`-fallback example cannot work as written

**File:** `docs/advanced.md:69-76`
**Issue:** The `&`-fallback snippet is a non-functional config that silently
MISSes every read (the fallback's only job):

```yaml
- run: |
    npx @op-nx/github-cache serve &
    echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://localhost:3000" >> "$GITHUB_ENV"
    echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=$MY_TOKEN" >> "$GITHUB_ENV"
```

1. **Wrong port.** `serve()` defaults to an OS-assigned ephemeral port when `PORT`
   is unset (`serve.ts:69` -> `resolvePort` returns `0` for a missing value,
   `serve.ts:45-53`). The example hardcodes `http://localhost:3000` without setting
   `PORT=3000`, so Nx points at `:3000` while the server listens on a random port
   -> connection refused -> every read MISSes. The inline comment even says "serve
   prints its loopback URL; wire the two NX_* vars", contradicting the hardcode.
2. **Unsynchronized token.** `$MY_TOKEN` is never defined, and `serve()` mints a
   fresh CSPRNG token when `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` is not in its
   env at start (`serve.ts:70-73`). Writing `$MY_TOKEN` to `GITHUB_ENV` *after*
   `serve &` affects only later steps, not the already-started server, so the token
   Nx presents will not match the server's -> auth failure even if the port were
   right.
3. **Spurious subcommand.** The bin is `github-cache` -> `dist/serve.js`
   (`packages/github-cache/package.json:23-25`), whose entry ignores argv, so the
   `serve` argument in `npx @op-nx/github-cache serve` is a no-op that implies a
   subcommand that does not exist.

**Fix:** Set a fixed port and pin the token *before* backgrounding, and read the
URL from the fixed port, e.g.:

```yaml
- run: |
    export PORT=3000
    export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="$MY_TOKEN"  # set MY_TOKEN in job env
    npx @op-nx/github-cache &
    {
      echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:${PORT}"
      echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
    } >> "$GITHUB_ENV"
- run: npx nx affected -t build test
```

### WR-03: public-surface type-export guard only inspects the first `export type` block

**File:** `packages/github-cache/src/public-surface.spec.ts:86-97`
**Issue:** `parseTypeExports` uses a non-global `.exec` with
`/export\s+type\s*\{([^}]*)\}/`, which matches only the **first**
`export type { ... }` block in `index.ts`. The spec's stated contract (docstring
lines 1-28) is that the guard "fails on any unintended change" to the public type
surface. But adding a *second* type-export statement -- a natural way to add a
port type, e.g. `export type { NewPort } from './new.js';` -- would leave the
first block (and thus the parsed set) unchanged, so the test still passes and a
new public type export lands **undetected** by the guard it is supposed to gate.
The value-export half is robust (`Object.keys(barrel)` sees every runtime export),
but the type half under-enforces its own claim.
**Fix:** Match all blocks and union their names, e.g.:

```ts
function parseTypeExports(indexSource: string): string[] {
  const names: string[] = [];

  for (const m of indexSource.matchAll(/export\s+type\s*\{([^}]*)\}/g)) {
    for (const name of m[1].split(',').map((n) => n.trim())) {
      if (name.length > 0) {
        names.push(name);
      }
    }
  }

  return names;
}
```

## Info

### IN-01: docs-trust drift guard checks common English words with `toContain`

**File:** `packages/github-cache/src/docs-trust.spec.ts:49-55`
**Issue:** The event-presence loop asserts each allowlist string via
`toContain(event)`. Several event strings (`push`, `release`) are common words
that also appear in ordinary prose in the doc. A future widening that adds an
event whose string is already a substring elsewhere in the doc (or a substring of
an existing word) would false-pass the guard, defeating its drift-detection intent
for that case. The value it currently provides is real (a genuinely novel token
like `workflow_dispatch` is caught); only common-word additions are at risk.
**Fix:** Assert on a delimited/quoted form that matches how the doc renders the
allowlists, e.g. `expect(trustDoc).toContain(\`'\${event}'\`)` (the doc embeds the
arrays as `['push', 'schedule']`), or a `\b`-anchored regex.

### IN-02: env-knob contract list is triplicated with a self-referential assertion

**File:** `packages/github-cache/src/public-surface.spec.ts:53-61,157-167`; `packages/github-cache/src/docs-adoption.spec.ts:40-48`
**Issue:** `EXPECTED_ENV_KNOBS` is declared three times: as a constant in
`public-surface.spec.ts`, again as a hardcoded literal inside the "exactly the
D-04 group-a contract list" assertion in the same file, and a third time in
`docs-adoption.spec.ts` (whose comment admits "Mirrors the DOCS-05 ...
EXPECTED_ENV_KNOBS"). The "exactly the D-04 list" test compares the constant to a
duplicated literal in the same file, so it verifies nothing external -- it only
forces a developer to edit two places in lockstep. The three copies can drift
apart without any test catching the divergence between them.
**Fix:** Export the canonical list once (e.g. from a shared spec fixture) and
import it in both specs; drop the self-referential literal-vs-constant assertion.

### IN-03: nx.json test inputs reference a nonexistent tsconfig.storybook.json

**File:** `nx.json:60-63`
**Issue:** The `test` target inputs include
`{ "fileset": "{projectRoot}/tsconfig.storybook.json", "dependencies": true }`.
This is a backend/CLI package with no Storybook; the file does not exist. It is a
leftover generator default -- harmless (Nx simply finds no matching file) but dead
config that misleads a reader about the project's shape.
**Fix:** Remove the `tsconfig.storybook.json` fileset entry.

### IN-04: README quickstart comment omits host-gated write triggers

**File:** `README.md:36-39`
**Issue:** The quickstart env comment says the writable backend is selected "on
trusted triggers (push / schedule)" and read-only "without a resolvable token." It
is not wrong, but it omits that `pull_request`/`release` are also write-trusted on
`github.com` (host-gated), so a reader may infer only push/schedule ever write.
Lower severity than WR-01 because it does not make a false positive claim about
PRs; the full model is correctly documented in `docs/trust-and-security.md`.
**Fix:** Add a short parenthetical ("also pull_request/release on github.com; see
Trust and security") or link to the trust doc for the complete gate.

---

_Reviewed: 2026-07-21T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
