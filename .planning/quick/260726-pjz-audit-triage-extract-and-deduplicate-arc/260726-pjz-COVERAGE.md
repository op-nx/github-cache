# Quick Task 260726-pjz: Coverage proof for the ARCHITECTURE-DECISION.md slimming

**Measured:** 2026-07-26, against the PRE-removal tree (HEAD `fe25a3f`).
**Unit of proof:** a DISTINCTIVE CLAIM, not a section.

Three dispositions, and RETENTION IS THE DEFAULT for anything not proven elsewhere:

- **COVERED** - proven present in a NAMED artifact outside `.planning/ARCHITECTURE-DECISION.md`
  by the executed assertion in the row. Safe to delete.
- **RESIDUE** - proven absent everywhere else, therefore RETAINED in the slimmed ADR under
  `## Residual notes`. This is the KEEP criterion ("keep only what has no canonical home") doing
  its job, not an escape hatch.
- **SPENT** - obsolete by a recorded event, evidenced by that event's record.

Every positive assertion below was EXECUTED individually (36/36 exit 0) and then re-executed as
the single chained battery in the plan's Task 1 `<verify><automated>` block. Every negative probe
below was EXECUTED with the three mandated exclusions - the ADR itself, this task's `quick/`
directory, and archived `.planning/milestones/` (an archived record is history, not a canonical
home, D-04).

Negative probes are abbreviated in the table as `NEG(<term>)`, which expands to:

```
git grep -q -F "<term>" -- . ':!.planning/ARCHITECTURE-DECISION.md' ':!.planning/quick' ':!.planning/milestones'
```

exiting NON-ZERO (no match = no home).

## Disposition table

| Section | Claim | Disposition | Home | Executed assertion |
|---------|-------|-------------|------|--------------------|
| Framing | The shipped implementation is a spike/PoC with sunk cost zero, so it may be rebuilt | SPENT | The rebuild happened; `MILESTONES.md` records v0.0.1 shipped | `git grep -q -F "v0.0.1" -- .planning/MILESTONES.md` |
| Decision 1 | One backend per process, selected by runtime context; no composite/registry | COVERED | `.planning/PROJECT.md` Key Decisions row | `git grep -q -F "One backend per process, context-selected" -- .planning/PROJECT.md` |
| Decision 1 | The selection function is `selectBackend(env)` | COVERED | `.planning/research/ARCHITECTURE.md` | `git grep -q -F "selectBackend" -- .planning/research/ARCHITECTURE.md` |
| Decision 1 | The port is `get`/`put` and `put` returns `PutResult` (no `exists` verb) | COVERED | `.planning/research/ARCHITECTURE.md` | `git grep -q -F "PutResult" -- .planning/research/ARCHITECTURE.md` |
| Decision 1 | RW-vs-RO is context-derived, never a caller-facing flag | COVERED | `.planning/codebase/INTEGRATIONS.md:84` (substantive prose, deliberately NOT PROJECT.md's dated log footer) | `git grep -q -F "context-derived" -- .planning/codebase/INTEGRATIONS.md` |
| Decision 1 | The no-flag property is load-bearing for CREEP, not a convenience | COVERED | `.planning/research/FEATURES.md:152` (substantive prose, deliberately NOT PROJECT.md's Validated checklist tick) | `git grep -q -F "no-flag safety property" -- .planning/research/FEATURES.md` |
| Decision 1 | The publish/retention subsystem is reader-specific and sits behind no port | COVERED | `.planning/research/ARCHITECTURE.md` | `git grep -q -F "behind no port" -- .planning/research/ARCHITECTURE.md` |
| Decision 1 | Do not assume the publisher is pluggable | COVERED | `.planning/research/ARCHITECTURE.md:161`, verbatim again at `.planning/research/SUMMARY.md:58` | `git grep -q -F "do not assume it is pluggable" -- .planning/research/ARCHITECTURE.md` |
| Decision 2 | Write-trust is an allowlist (configured replaces default), default-deny, no denylist | COVERED | `.planning/PROJECT.md` Key Decisions row | `git grep -q -F "Write-trust = allowlist-only" -- .planning/PROJECT.md` |
| Decision 2 | The sync gate is a separate, narrower predicate, not the write allowlist | COVERED | `.planning/PROJECT.md` Key Decisions row | `git grep -q -F "Sync gate = a separate predicate" -- .planning/PROJECT.md` |
| Decision 2 | The backstop is inferred from the `GITHUB_SERVER_URL` host, fail-closed on GHES | COVERED | `.planning/PROJECT.md` | `git grep -q -F "GITHUB_SERVER_URL" -- .planning/PROJECT.md` |
| Decision 2 | The Data-Residency `*.ghe.com` suffix is admitted alongside github.com | COVERED | `.planning/PROJECT.md` | `git grep -q -F "ghe.com" -- .planning/PROJECT.md` |
| Decision 2 | PR scope is activity-type dependent - a `[closed]` run gets base scope, so a blocked PR write is a benign no-op | COVERED | Shipped source `packages/github-cache/src/backend/actions-cache-backend.ts` (and its spec) | `git grep -q -F "base-scope" -- packages/github-cache/src/backend/actions-cache-backend.ts` |
| Decision 3 | Reader / cross-context adapter is LOCKED = GitHub Releases | COVERED | `.planning/PROJECT.md` Key Decisions row | `git grep -q -F "Reader / cross-context adapter: **GitHub Releases**" -- .planning/PROJECT.md` |
| Decision 3 | GHCR's >5000-download undeletable wall is a public poison-remediation gap | COVERED | `.planning/PROJECT.md` | `git grep -q -F "5000" -- .planning/PROJECT.md` |
| Decision 3 | The 1000-asset-per-release cap is a Releases-side scaling constraint | COVERED | `.planning/PROJECT.md` | `git grep -q -F "1000-asset" -- .planning/PROJECT.md` |
| Decision 3 | The cap is handled by a month-shard model | COVERED | `.planning/PROJECT.md` | `git grep -q -F "month-shard" -- .planning/PROJECT.md` |
| Decision 3 | The ~2 GiB per-asset ceiling collides with the 2 GB body cap | COVERED | `.planning/MILESTONES.md:28` (the publish-engine prose, deliberately NOT PROJECT.md's Validated checklist tick) | `git grep -q -F "2 GiB" -- .planning/MILESTONES.md` |
| Decision 3 | GHCR is revisited only when Docker (FOUND-03) and cosign (PROV-01) graduate together | COVERED | `.planning/PROJECT.md` | `git grep -q -F "PROV-01" -- .planning/PROJECT.md` |
| Decision 3 | Adopting a second store later is additive, not a switch - the pick is reversible | COVERED | `.planning/PROJECT.md` | `git grep -q -F "additive" -- .planning/PROJECT.md` |
| Decision 5 | A stateful LRU manifest is out of scope (mutable retention state is security-negative) | COVERED | `.planning/PROJECT.md` Key Decisions row | `git grep -q -F "no LRU manifest" -- .planning/PROJECT.md` |
| Decision 5 | Age-based cleanup is the mandatory floor, driven by `CACHE_MIRROR_MAX_AGE_DAYS` | COVERED | `.planning/PROJECT.md` | `git grep -q -F "CACHE_MIRROR_MAX_AGE_DAYS" -- .planning/PROJECT.md` |
| Decision 5 | LRU is native on the CI tier; the read-only tier is age-only | COVERED | `.planning/PROJECT.md` | `git grep -q -F "age-only" -- .planning/PROJECT.md` |
| Decision 5 | Retention is one coupled setting - never introduce a second knob | COVERED | Six homes: `.planning/PROJECT.md:115`, `.planning/RETROSPECTIVE.md:31`, `.planning/research/ARCHITECTURE.md:132,227`, `docs/trust-and-security.md:116`, shipped code `packages/github-cache/src/lib/retention.ts:5` | `git grep -q -F "never introduce a second knob" -- .planning/PROJECT.md` |
| Decision 6 | Both branches are sanctioned - OS-namespace the store OR documented consumer OS-discrimination | COVERED | `.planning/PROJECT.md` Key Decisions row (the CORR-01 either/or row) | `git grep -q -F "or documented consumer OS-discrimination" -- .planning/PROJECT.md` |
| Decision 6 | A cross-OS hit is a wrong result, not a MISS - a Core Value violation the CREEP controls do not cover | COVERED | `.planning/PROJECT.md` Key Decisions row | `git grep -q -F "wrong result" -- .planning/PROJECT.md` |
| Consequences | The FOUND-01 spike verdict favours Releases | COVERED | `.planning/spikes/MANIFEST.md` verdict column CONTENT (not merely `test -f` on the file) | `git grep -q -F "strongest pro-Releases dim" -- .planning/spikes/MANIFEST.md` |
| Consequences | The CI sidecar is served by the GA Actions background-step pattern, not a `services:` container | COVERED | `docs/advanced.md` | `git grep -q -F "background-step" -- docs/advanced.md` |
| Consequences | A composite action cannot declare `background:` internally, so the consumption action stays a JS action | COVERED | `docs/advanced.md` | `git grep -q -F "composite" -- docs/advanced.md` |
| Consequences | `services:` is Linux-hosted-only, which is why it does not serve the cross-OS case | COVERED | `.planning/codebase/CONCERNS.md` | `git grep -q -F "services:" -- .planning/codebase/CONCERNS.md` |
| Consequences | Docker's residual niche is genuinely hermetic / non-Node CI, a later-milestone item | COVERED | `.planning/codebase/CONCERNS.md` | `git grep -q -F "hermetic" -- .planning/codebase/CONCERNS.md` |
| Consequences | Docs must show the background-step pattern with an explicit teardown, because the runner runs an implicit `wait-all` | COVERED | `docs/examples/minimal-ci.yml` | `git grep -q -F "wait-all" -- docs/examples/minimal-ci.yml` |
| Consequences | `serve` must drain gracefully on `SIGTERM` or a RW job loses its last writes at teardown | COVERED | Shipped source `packages/github-cache/src/serve.ts` | `git grep -q -F "SIGTERM" -- packages/github-cache/src/serve.ts` |
| Consequences | Governance requires a vulnerability-disclosure policy | COVERED | Shipped `SECURITY.md` at the repo root | `test -f SECURITY.md` |
| Consequences | Governance requires a licence | COVERED | Shipped `LICENSE` at the repo root | `test -f LICENSE` |
| Consequences | Governance requires a versioned consumer contract / semver statement | COVERED | `docs/versioning.md` | `git grep -q -F "semver" -- docs/versioning.md` |
| Decision 1 (residue) | The D1 YAGNI deferral list - synchronous write fan-out and multiple simultaneous stores | RESIDUE | none (retained under `## Residual notes`) | `NEG("synchronous write fan-out")` and `NEG("multiple simultaneous stores")` both exit non-zero; substance probes `NEG("second store")` also zero. See Note A |
| Decision 2 (residue) | GHES anti-spoofing cross-check - absence of `/meta` `installed_version` plus the `X-GitHub-Enterprise-Version` header, and the dormant version-gate knob held OFF until a GHES floor publishes | RESIDUE | none (retained under `## Residual notes`) | `NEG("installed_version")`, `NEG("X-GitHub-Enterprise-Version")` and `NEG("/meta")` all exit non-zero. See Note B |
| Decision 3 (residue) | Read-time integrity is store-and-verify a published `content-sha256`, explicitly NOT `sha256(blob) == {hash}` because the Nx key hashes task inputs | RESIDUE | none (retained under `## Residual notes`) | `NEG("content-sha256")` exits non-zero; substance probes `NEG("store-and-verify")`, `NEG("read-time integrity")`, `NEG("hashes task")` all exit non-zero |
| Decision 3 (residue) | Rejection rationale - git-native is out for clone bloat and no clean eviction; Actions build artifacts are out for not being content-keyed | RESIDUE | none (retained under `## Residual notes`) | `NEG("clone bloat")` and `NEG("content-keyed")` exit non-zero. CONTRADICTED at claim level - see Note C |
| Decision 3 (residue) | CREEP-orthogonality scope check - the reader choice does not move the primary threat; it is a remediation win, not a CREEP-prevention one | RESIDUE | none (retained under `## Residual notes`) | `NEG("orthogonal")` exits non-zero; substance probes `NEG("remediation win")`, `NEG("primary threat")`, `NEG("does not move the primary threat")` all exit non-zero |
| Nx contract (residue) | The Nx client hardens tarball extraction against `..`/absolute/symlink/hardlink escape, so a malicious server cannot `zip-slip` the client - inherited protection | RESIDUE | none (retained under `## Residual notes`) | `NEG("zip-slip")`, `NEG("hardlink")`, `NEG("tarball extraction")`, `NEG("symlink escape")` all exit non-zero. See Note D |
| Consequences (residue) | Residual risk - CREEP containment is single-layer at the write/sync gates, so gate correctness is load-bearing with no backstop | RESIDUE | none (retained under `## Residual notes`) | `NEG("single-layer")`, `NEG("no backstop")`, `NEG("second layer")` all exit non-zero. See Note E |
| References (residue) | The twelve-source bibliography as a block - a single reference token cannot prove a twelve-item list, so it is retained wholesale | RESIDUE | none (retained byte-identical as `## References`) | `NEG("Cacheract")`, `NEG("sccache")`, `NEG("HeroDevs")`, `NEG("CodeQL")`, `NEG("nixcache-oci")`, `NEG("tag mutability")`, `NEG("nx.app/files")` and `NEG("bazel-remote")` all exit non-zero |

**Row count:** 44 (36 COVERED/SPENT + 8 RESIDUE). No row carries any other disposition.

The Nx contract section is deliberately absent from this battery except for its orphan
parenthetical: it is MOVED, not removed, and its assertion is Task 2's post-move check.

## Notes on the residue probes

**Note A - the D1 deferral list was already narrowed by the plan, and that narrowing holds.**
The third deferred item, a local read-write store, is COVERED at `PROJECT.md ## Out of Scope:104`
("Local read-write mode - by design local is read-only only") and is therefore NOT retained. The
nearest hits for "multi-store" (`PROJECT.md:92`, `research/ARCHITECTURE.md:167`) are the GHCR-01
later-milestone ADDITIVE trigger, a different claim from "the port design defers simultaneous
stores as YAGNI"; adjacent, not equivalent. `synchronous write fan-out` is homeless outright - the
six "fan-out" hits in the tree are all about READ shard-walk API fan-out, an unrelated concept.

**Note B - the dormant version-gate knob has partial coverage the plan did not measure.**
`research/PITFALLS.md:310` reads "keep the version-gate knob dormant/OFF", and
`docs/trust-and-security.md:76` carries the github.com-only backstop plus the GHES floor. So the
"knob stays OFF until a GHES floor publishes" sub-clause is arguably COVERED. The anti-spoofing
CROSS-CHECK MECHANISM itself - probing for the absence of `/meta` `installed_version` and the
`X-GitHub-Enterprise-Version` response header - is homeless everywhere, and that mechanism is the
distinctive claim. The row is retained whole rather than split, because splitting a two-clause
sentence to delete half of it buys nothing and risks losing the mechanism's motivation.

**Note C - MEASURED DEVIATION FROM THE PLAN'S PREMISE. This row's claim IS covered.**
The plan asserts (Task 1, residue item 4) that "The MANIFEST records THAT they are out, not WHY".
That is true of `spikes/MANIFEST.md:7`, but the plan did not probe `research/STACK.md`, which
records both rejections WITH their reasons in its storage-primitive comparison table:

- `.planning/research/STACK.md:77` - git objects / refs: "Repo-bloating; no per-object expiry ...
  **Reject** - bloats history, no clean eviction". The phrase "no clean eviction" is VERBATIM the
  ADR's.
- `.planning/research/STACK.md:75` - Actions Artifacts: "No (run-scoped, not key-scoped) ...
  **Reject** - no anon read, wrong lookup shape", which is "not content-keyed" in substance plus
  one further reason.

The plan's own literal token probes (`clone bloat`, `content-keyed`) return homeless, but that is
exactly the phrasing accident the plan warns against - the probe was built from the sentence being
deleted. At CLAIM level this row is COVERED at `research/STACK.md:75,77`.

**It is nonetheless RETAINED**, for three reasons, and the choice is recorded here rather than
silently taken. First, the plan's governing criterion is that retention is the DEFAULT and
deletion is the action requiring proof; retaining something that turns out to have a home is the
LOSSLESS error, whereas deleting on a contested measurement is not. Second, Task 2's gate
requires the `content-keyed` token to be present in the slimmed file, and this executor is bound
to run gates verbatim rather than edit them to match a fresh finding. Third, unlike the two
claims the plan DID reclassify from residue to covered (the "publisher is pluggable" warning and
the retention "no second knob" invariant), this is a dead-end historical rationale for primitives
that were never built, not a live invariant - so a second copy carries essentially no drift risk,
which is the specific harm this task exists to remove. Carried to the SUMMARY as a deferred
follow-up.

**Note D - the only tree hits for this claim are generated output, and they are a different
subject.** `path traversal` matches three times inside `start-cache-server/index.js` (a 2.4 MB
vendored action bundle, generated), in a fixture table describing hostile PATH inputs to this
project's own server. That is neither a canonical home nor the same claim as the Nx CLIENT's
inherited tarball-extraction hardening. The claim is homeless in `.planning/`, `docs/` and
`packages/` source.

**Note E - the two "residual risk" hits are a different risk.** `REQUIREMENTS.md:329` and
`ROADMAP.md:509` both record the TRUST-11 executor-portability residual risk, unrelated to
single-layer CREEP containment. The containment claim itself is homeless.

## Two claims the plan reclassified out of residue, confirmed COVERED and DELETED

Both were measured, not assumed, and both are deleted rather than retained because retaining
either would rebuild the two-sources-of-truth pair this task exists to remove:

1. **"Do not assume the publisher is pluggable"** - `research/ARCHITECTURE.md:161`, verbatim again
   at `research/SUMMARY.md:58`.
2. **The retention "never introduce a second knob" invariant** - six homes, including
   `PROJECT.md:115` and SHIPPED CODE at `packages/github-cache/src/lib/retention.ts:5`. A doc-only
   copy drifting away from executable code is the worst case of the pair.
