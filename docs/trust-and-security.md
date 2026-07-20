# Trust and Security

This document renders the SETTLED trust model shipped across phases 1-5. It is a
rendering of the single sources listed below, never a re-typed paraphrase. If
this document and the code disagree, the code wins -- and the `docs-trust` guard
(`packages/github-cache/src/docs-trust.spec.ts`) fails the build until this file
is brought back in sync with the allowlists.

## Single sources of truth

| Concern                                        | Source                                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Write-trust allowlist (which events may WRITE) | `packages/github-cache/src/lib/trust.ts` (`TRUSTED_EVENTS`, `HOST_GATED_EVENTS`, `isWriteTrusted`) |
| Sync/publish gate (which events may PUBLISH)   | `packages/github-cache/src/lib/sync-gate.ts` (`SYNC_EVENTS`, `isSyncTrusted`)                      |
| CREEP control ledger (C1-C18)                  | `.planning/ARCHITECTURE-DECISION.md`                                                               |
| The audited, settled model                     | `.planning/phases/05-trust-widening-ppe-gate/05-SECURITY.md` and `05-VERIFICATION.md`              |

The threat this model defends is CVE-2025-36852 (CREEP): cache poisoning at
construction, before hashing, by any pull-request-privileged contributor.
Content signing does not help (a trusted producer signs poisoned bytes); the
defense is write-scope isolation aligned to version-control trust.

## 1. Which events may write

Two allowlists, both authored once in `trust.ts`, both default-deny (an
unrecognised or unset trigger is never trusted):

```ts
export const TRUSTED_EVENTS = ['push', 'schedule'] as const;
export const HOST_GATED_EVENTS = ['pull_request', 'release'] as const;
```

- `TRUSTED_EVENTS` (`push`, `schedule`) are the host-INDEPENDENT base writers.
  They are trusted on any host.
- `HOST_GATED_EVENTS` (`pull_request`, `release`) are trusted ONLY where GitHub's
  2026-06-26 server-side read-only-default-branch cache guard exists.

The host is inferred structurally from `GITHUB_SERVER_URL`:

- host is `github.com` or a real `*.ghe.com` Data Residency subdomain -> widened
  write-trust ON.
- every GitHub Enterprise Server (GHES) host, and any malformed or missing value
  -> OFF, fail-closed.

Detection is a `new URL(...).hostname` parse and an exact compare, never a
substring match, so `github.com.attacker.com`, bare `ghe.com`, and `notghe.com`
are all rejected.

**The in-code host gate is fork-spoofable DEFENSE-IN-DEPTH only.** A fork trigger
can, in principle, inject a spoofed `GITHUB_SERVER_URL`, so this gate is
explicitly NOT the load-bearing control. The load-bearing control is GitHub's
server-side read-only-cache-token guard plus the Actions-cache version-control
scope isolation -- the actual CREEP defense. The in-code gate exists so trust is
not falsely widened on GHES where that guard is absent; it is a conservative
fail-closed default, not the boundary (ADR C1; accepted residual T-05-01-01).

## 2. The sync/publish gate is SEPARATE

`sync-gate.ts` declares its OWN allowlist and additionally requires the current
ref to be the repository default branch:

```ts
export const SYNC_EVENTS = ['push', 'schedule'] as const;
```

This is NOT the write allowlist. Publishing or mirroring into the shared Releases
store is gated by `isSyncTrusted`, never by `isWriteTrusted` -- two trust
boundaries that look alike but are distinct.

The two allowlists coincide today (`push`, `schedule`), which makes reuse
tempting and wrong. Widening WRITE to `pull_request`/`release` must NEVER widen
SYNC: syncing a pull-request- or dispatch-influenced entry into a shared store
recreates the exact CREEP precondition. `trust.ts` imports nothing from
`sync-gate.ts`; they stay two separate declarations by design (ADR C2).

## 3. The github.com-only backstop and the GHES floor

The server-side guard that makes `pull_request`/`release` writes safe ships to
**github.com and Data Residency (`*.ghe.com`) only**. No generally-available GHES
release carries it yet, and the floor version is **unpublished**.

Therefore: **do not enable pull-request/release writes on GHES below the floor.**
This document deliberately states github.com-only and does NOT guess a GHES
version number -- the floor is not published, and guessing one would be a false
security claim (ADR C14). On GHES the host gate fails closed, so
`pull_request`/`release` are read-only there automatically; do not attempt to
override that.

## 4. Never enable fork-pull-request write tokens or secrets

Do NOT configure workflows to send write-scoped tokens or secrets to fork pull
requests. Fork pull requests run untrusted contributor code; handing them a write
token or a secret defeats the entire trust model and re-opens CREEP regardless of
the gates above (ADR C14).

## 5. Adopter prerequisites (where containment actually lives)

The load-bearing CREEP containment is the `{push, schedule}` sync gate PLUS two
deployment prerequisites you MUST provide -- default-branch protection and
ephemeral single-tenant runners:

- **Default-branch protection.** The sync gate trusts default-branch code; branch
  protection is what makes that trust meaningful.
- **Ephemeral, single-tenant runners.** The in-process hash lock and predictable
  temp paths are safe only on runners that are not shared or persistent.

The shipped PPE-hygiene gate (`ppe/action.yml`) is ADVISORY defense-in-depth only
-- heuristic linters cannot catch novel evasions. Containment is the sync gate
plus branch protection, NOT the advisory gate (ADR C4).

## 6. Retention is one coupled knob

`CACHE_MIRROR_MAX_AGE_DAYS` is the ONE retention setting (default 30 days). It
drives BOTH the read-lookback window AND the cleanup window through the same
resolver, so retained assets stay readable and expired ones stay cleanable. There
is never a second knob; read window equals cleanup window by construction (see
`packages/github-cache/src/lib/retention.ts`).

## 7. Retention is storage hygiene, NOT poison-containment

Cleanup exists to bound storage growth. It is **storage hygiene, not a security
control** -- do not rely on age-based cleanup to contain a poisoned entry.
Poisoning is contained at the write and sync gates (sections 1-2), never by
waiting for an entry to age out (ADR C15).

## 8. Read-only local by design

There is no local write path. Locally the selected backend is read-only by
construction: a local `put()` always returns 403. Only CI on a trusted trigger
may write. This is not a mode flag a caller can get wrong -- read-write versus
read-only is derived from runtime context (`selectBackend`), never from a
caller-facing option.

## 9. Mirrored keys are anonymously public on public repos

Mirrored Release assets inherit the repository's visibility. On a PUBLIC repo,
every mirrored cache key is **anonymously public** (world-readable) -- treat
anything you mirror on a public repo as published. Do not mirror cache entries
that embed secrets or private build outputs on a public repository. The mirror
filter admits only server-produced keys (`nx-cache-` plus a valid hash), never
arbitrary hex, so unrelated CI artifacts are not swept in (ADR C16).

## 10. Freshness and staleness caveats

Local and read-only reads are best-effort and point-in-time -- they are bounded
by a freshness window and are subject to mid-session staleness:

- **Freshness window.** The reader only walks month-shards within
  `CACHE_MIRROR_MAX_AGE_DAYS`. An entry older than the window is a MISS even if
  the asset still exists.
- **Mid-session staleness.** A long-running session may observe an entry
  disappear at a month boundary or after a scheduled cleanup; a read that hit
  earlier may MISS later.

Every read fault degrades to a MISS -- never a wrong result and never a broken
build (Core Value). A MISS costs a rebuild; a wrong result would be a correctness
violation.

---

_Rendered from the single sources above. The `docs-trust` guard
(`packages/github-cache/src/docs-trust.spec.ts`) asserts every event string in
`TRUSTED_EVENTS`, `HOST_GATED_EVENTS`, and `SYNC_EVENTS` appears verbatim here, so
a future allowlist change trips the build until this file is updated._
