---
phase: 11
slug: live-proofs-o1-o2-o3
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-29
---

# Phase 11 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `11-RESEARCH.md` `## Validation Architecture`.

**Status glyphs are ASCII by project rule** (`CLAUDE.md`: no emoji or non-ASCII in any output --
Windows cp1252 produces mojibake). `[ ]` = pending, `[OK]` = green, `[FAIL]` = red,
`[WARN]` = flaky. The machine-readable state lives in the frontmatter, not in the glyphs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest via `@nx/vitest` (plugin-inferred `test` target, `nx.json:28-32`) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit) + `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npm exec nx test github-cache` |
| **Full suite command** | `npm exec nx run-many -t test typecheck build lint` |
| **Estimated runtime** | ~60 seconds for the quick run; ~3 min for the full battery |

---

## Sampling Rate

- **After every task commit:** Run `npm exec nx test github-cache`
- **After every plan wave:** Run `npm exec nx run-many -t test typecheck build lint`
- **Before `/gsd:verify-work`:** Full suite green AND the `o3-witness` job green on the proving run
- **Max feedback latency:** ~60 seconds locally; the live-CI half is bounded by the proving run

### HARD SUSPENSION of the per-task sampling across the measurement window

**Between the TEST-10 `nx reset` and the completion of the O1/O2 measurement, the after-every-task
`npm exec nx test github-cache` sampling above is SUSPENDED.** This is a correctness rule, not a
convenience: running `test` in that window repopulates `.nx/workspace-data` and writes a `test`
entry into `.nx/cache`, which turns O1's `test` REMOTE hit into a LOCAL hit and destroys the proof
that the phase exists to produce. TEST-10 states the underlying mechanism -- a local cache hit
short-circuits before the remote is ever queried.

The hazard is live rather than theoretical: `.nx/cache` on the measurement workstation already holds
an entry for the `test` hash `11681410932071446589`. Plans `11-02` and `11-03` each carry this rule
in their own text so an executor meets it where it applies; it is restated here so a reader of the
validation contract alone does not reintroduce the sampling.

Sampling resumes at plan `11-05`, which is where the first `nx`-invoking work after the measurement
lands. `11-04` is inside the suspension window by the same rule, but it is unexposed either way: its
tasks invoke no `nx` command at all. The plans are the contract here and both `11-02-PLAN.md` and
`11-03-PLAN.md` name `11-05`; an earlier draft of this file said `11-04`.

**CRITICAL, and a real hazard in this phase:** the `o3-witness` job is a new CI job with no inferred
target behind it. `nx run-many` on a missing target exits 0 (recorded project trap), and by the same
logic a deleted CI *job* is a silently removable gate. Assert the witness job's presence by CONTENT
-- extend `docs-same-os-claims.spec.ts`'s phrase-keyed pattern (CONTEXT.md D-19) with a literal from
the witness job. That spec edit must land in wave 2 or later, because it rotates
`test`/`typecheck`/`integration` (D-10 row 2) and would otherwise expire the O1/O2 window.

---

## Per-Task Verification Map

This phase is proof-led and most of its success criteria are NOT unit-testable by construction.
Recorded explicitly, because the temptation is to manufacture one spec per requirement -- and every
such spec costs the perishable measurement window (CONTEXT.md D-10, D-11).

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01 | 1 | TEST-08 (graph premise) | see `11-01-PLAN.md` register | Read-only graph resolution; no network, no cache mutation | script assertion, output captured as evidence | `node capture-hashes.mjs --assert-graph-premise` | [NEW] wave 1 -- new mode on an existing root file | [ ] pending |
| 11-02 | 2 | XOS-01, XOS-02, TEST-10 | see `11-02-PLAN.md` register | Authorised, irreversible `nx reset` behind a decision checkpoint; warm capture taken first | manual-only (live, one-shot, perishable) | -- (captures recorded in `11-EVIDENCE.md`) | N/A -- see justification | [ ] pending |
| 11-03 | 3 | XOS-01, XOS-02, TEST-10, OBS-02, TEST-08 | see `11-03-PLAN.md` register | Local read-only; sidecar bound to 127.0.0.1; `put()` 403 off-CI | manual-only (live, one-shot) | -- (captured terminal output in `11-EVIDENCE.md`) | N/A | [ ] pending |
| 11-04 | 4 | TEST-08 (producer attribution) | see `11-04-PLAN.md` register | REST capture transcribed by field; no raw payloads (uploader identity, node ids, signed URLs) | manual-only (REST capture) | -- | N/A | [ ] pending |
| 11-05 | 5 | XOS-03, TEST-09 | see `11-05-PLAN.md` register | Guards assert job presence and comment prose; RED before GREEN | unit (Vitest) | `npm exec nx test github-cache` | [NEW] wave 5 -- two spec edits | [ ] pending |
| 11-06 | 6 | XOS-03, TEST-09 | see `11-06-PLAN.md` register | `actions: read` + `contents: read` only; exact-equality key match, never a `?key=` prefix pass; positive-control acceptance set is `{200}` alone | CI gate (live) | the `o3-witness` job's and the control step's own `exit 1` | [NEW] wave 6 -- new steps plus a new job in `ci.yml` | [ ] pending |
| 11-07 | 7 | XOS-03, TEST-09, TEST-08, OBS-02 | see `11-07-PLAN.md` register | Temporary authorised `main` push with a retained backup ref and SHA-equality restore | manual-only (live proving run) | -- (run URL and transcribed lines) | N/A | [ ] pending |

*Status: `[ ]` pending - `[OK]` green - `[FAIL]` red - `[WARN]` flaky*

**Threat refs are owned by the PLAN registers, not by this table.** The plans allocate `T-11-01`
through `T-11-23`; an earlier draft of this file invented three IDs with different meanings, and
`/gsd:secure-phase` reads the PLAN registers rather than this one. Pointing at the owning plan keeps
the two from drifting apart. Per-task rows are likewise deliberately collapsed to per-plan rows --
task IDs live in the plans and restating them here would create a second copy to maintain.

The wave column reflects the ordering lock in CONTEXT.md D-11: the hash-neutral instruments and the
O1/O2 capture come BEFORE any `packages/**` (11-05) or `ci.yml` (11-06) edit, with 11-04's blocking
sign-off between them.

**Why the manual-only rows are legitimate and not a coverage gap.** Each names a live one-shot
observation -- on a real Windows workstation, or on a real runner, against a mirror that expires
around 2026-08-28. No fixture can stand in without the substitution destroying the requirement:
TEST-10 says in as many words that a HIT recorded without a preceding reset is not accepted, and
OBS-02's evidence is the literal `[remote cache]` label, which only a real Nx run emits. The
mechanical half of each requirement -- the part a machine CAN check -- is exactly what TEST-08's
graph assertion, the `o3-witness` job and the positive control are, and all three are automated and
fail loud.

---

## Wave 0 Requirements

None. Existing test infrastructure covers everything this phase can automate. The two automatable
instruments (the `capture-hashes.mjs` mode and the `ci.yml` probes) are the phase's own deliverables,
not test-harness gaps -- no fixture work, no framework install.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local Windows HIT on `build`, `typecheck`, `test` from Linux-CI artifacts | XOS-01, TEST-10, OBS-02 | Needs a real Windows workstation, a warm mirror that expires ~2026-08-28, and a cleared local Nx cache. A fixture would prove nothing about the real read path | Warm `capture:hashes` FIRST (irrecoverable once reset), then `nx reset`, then start the sidecar, then the 401/404/200 soundness triple, then a cold `nx run-many`. Record the literal `[remote cache]` label per target |
| Local Windows HIT on `integration` from Windows-CI artifacts | XOS-02 | Same, plus a non-regression comparison against a pre-rename baseline that no longer exists to re-measure | Same session as XOS-01; compare against both halves of the pre-rename baseline (read-path 200 at `06019d4`, Nx-level HIT at `bfd5143`) |
| Producer attribution per hit hash | TEST-08 | The attribution window closes permanently when Phase 12 enables O4; `mirrored-by` cannot answer it | Capture the Actions-cache entry list and shard asset list with `created_at` and label per asset; cross-reference against job windows; add the replayed `terminalOutput` runner-path fingerprint per hit |
| Reset-before-sidecar ordering and probe-before-measurement timestamping | TEST-10 | The ordering of a one-shot session is not reproducible after the fact | Record the soundness probe's timestamp as preceding the first Nx run, in `11-EVIDENCE.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a recorded manual-only justification
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A -- no Wave 0 gaps)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for the automatable half
- [ ] The `o3-witness` job's presence is asserted by content, not assumed (the deletable-gate trap)
- [ ] Every count that would differ under the failure hypothesis is pre-registered in the PLAN (D-23)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
