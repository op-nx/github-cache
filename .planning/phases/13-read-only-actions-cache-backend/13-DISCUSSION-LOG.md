# Phase 13: Read-Only Actions-Cache Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-08-02
**Phase:** 13-read-only-actions-cache-backend
**Mode:** `--analyze --auto --chain` -- every option auto-resolved to the recommended choice
EXCEPT the one rated HIGH-IMPACT x NOT-HIGH-CONFIDENCE. That one was ESCALATED to the maintainer
(a human was in the loop, so an UNRESOLVED record was not the terminal action), who reframed its
axis and locked half of it. See the escalated area below.
**Areas discussed:** Backend shape, Read-only selection signal, Leg conversion and gating, Gate
threshold, Stale-rationale correction, Gate pinning, Adjacent-stance confirmation, Do-nothing
baseline

---

## Backend shape (D-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared read core; writable composes it and adds `put` | One `get` and one `restoreCache` call site; RO factory returns `ReadableBackend` so a write is unrepresentable | (recommended, research-gated) |
| Narrowing adapter over the writable backend | Construct the writable backend, expose only `get` -- literally one implementation, zero refactor | |
| Copy-paste second backend | -- | REJECTED (reintroduces the Phase 9 root cause) |
| Do nothing | Keep counts as diagnostics | see D-09 |

**Auto-selection:** `[auto] Backend shape -- Q: "What shape makes cache-version drift
unrepresentable?" -> Recorded: shared read core + composing writable (recommended default), but
LEFT RESEARCH-GATED rather than locked.`
**Notes:** IMPACT HIGH; CONFIDENCE HIGH on the criterion, MEDIUM on the final shape. The ROADMAP
mandates a research comparison of these exact candidates, so auto-mode locked the ACCEPTANCE
CRITERION (exactly one `cache.restoreCache` read call site survives) and recorded a
recommendation, rather than pre-empting the gate the phase was created to enforce. The narrowing
adapter was not rejected -- it is the runner-up and research may prefer it; it is weaker only in
that the hidden object remains writable at runtime.

---

## Read-only selection signal -- ESCALATED TO THE MAINTAINER, then partly LOCKED

`--auto` declined to lock this (HIGH IMPACT x NOT-HIGH CONFIDENCE -- the trap quadrant), and
because a human was in the loop it was ESCALATED rather than left terminal. The maintainer then
reframed the axis: the original framing asked env-knob-vs-internal-route, but the real axis is
**EVENT-derived vs ROLE-derived**.

| Option | Description | Selected |
|--------|-------------|----------|
| By ROLE (per-leg) | Consumer legs read-only, ubuntu producer still writes; keeps the pre-merge gate and `dogfood-seed`'s PUT | check (maintainer, 2026-08-02) |
| By EVENT (RW only on write-eligible `{push,schedule}` + default branch) | Dissolves the signal question entirely -- no knob at all | REJECTED |
| Event band PLUS role signal | Presented as a hybrid | REJECTED -- not actually a hybrid |
| Construction-time factory flag | -- | REJECTED (TRUST-05, see D-03) |

**Maintainer's decision:** by ROLE, keep the pre-merge gate. D-02 stays open on SHAPE only.
**Notes / corrections to the analysis as presented:**

- The event-derived option and the "hybrid" both die on the same fact, and the maintainer's
  statement of it is sharper than the one offered: **TRUST-05's asymmetry is a one-way ratchet.**
  A signal may only narrow RW -> RO, never widen RO -> RW. So a read-only `pull_request` base can
  never be widened back for `dogfood-seed` (`action/index.ts:320,336`). The hybrid is therefore
  not a hybrid at all -- it inherits the `dogfood-seed` break UNFIXABLY. Both were presented with
  the collision noted; the ratchet is why the collision has no escape.
- The ROLE signal buys a property neither alternative can: **inductive**, not per-run. If the
  consumer legs never write, no Windows-produced entry for those hashes can ever exist, so any HIT
  is necessarily Linux-produced. The analysis as presented rested D-04's soundness on the XOS-08
  `needs:` edge; that was weaker than what the phase actually delivers, and CONTEXT.md was
  corrected to separate liveness (`needs:`) from correctness (read-only-ness).
- **How the open shape question must be weighed** (maintainer instruction): a narrowing knob IS
  TRUST-05-compatible, because TRUST-05 forbids REQUESTING write, not DECLINING it. Rejecting
  option (a) on TRUST-05 grounds is a MISREAD and must not be made or accepted. Its real and only
  cost is public API surface on a shipped package for a dogfooding-only need.
- A further candidate the maintainer added for research to CARRY: the witness / `created_at`
  variant, with its defect pre-recorded -- it does not close laundering (a previous run's
  Windows-written entry predates the current leg and passes the witness), and tightening it to
  "created within this run" reddens every PR that does not rotate a hash.

---

## Construction-time flag (D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Add a `readOnly` argument to `createActionsCacheBackend()` | Trivial to write | |
| Reject it, and record WHY | TRUST-05: RW-vs-RO is which factory constructs, never a caller-facing mode flag | done |

**Auto-selection:** `[auto] Construction-time flag -- Q: "Is a factory flag acceptable?" ->
Selected: "Reject, and record why" (recommended default).`
**Notes:** Settled project law, not a judgement call -- the ROADMAP itself says "rejected on
sight ... but record WHY so it is not re-raised." The recorded WHY also names the line that makes
D-02 legitimate while this is not: D-02's signal is read from the env bag by the SELECTOR; this
one is an argument to the FACTORY.

---

## Leg conversion and gating (D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Convert all three legs, gate `count >= 1` each | The phase goal and CR-18's original ask | check |
| Convert a subset | Leaves a launderable path open and invites "consistency" fixes in the wrong direction | |
| Convert but keep counts recorded | Delivers the backend, delivers no gate | |

**Auto-selection:** `[auto] Leg conversion -- Q: "Which legs, and does the gate land in this
phase?" -> Selected: "All three, gated at >= 1" (recommended default).`
**Notes:** Soundness rests on XOS-08's `needs:` edge making each leg INTRA-run: the ubuntu
producer runs earlier in the same run, so the entry exists whether ubuntu HIT or MISSed-and-SAVEd.
A read-only leg reporting zero therefore means cross-OS restore is genuinely dead.

---

## Gate threshold (D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| `>= 1` floor per leg | Sound minimum; per-target counts stay printed diagnostics | check |
| Exact pin per target (1 / 2 / 1) | Phase 12's `RENDERED_DISCRIMINATOR_SITES` precedent | |

**Auto-selection:** `[auto] Gate threshold -- Q: ">= 1 or exact pin?" -> Selected: ">= 1 floor"
(recommended default).`
**Notes:** Phase 12's exact-pin lesson deliberately NOT transferred, and the reason recorded: that
guard counted authored SITES in a file we control, while these counts come from Nx's task graph
and legitimately vary with it.

---

## Stale-rationale correction (D-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Correct every stale comment in the same commit that gates | The laundering rationale becomes FALSE the moment the legs cannot write | check |
| Leave the comments, fix later | A comment carrying a false reason is a documented argument for undoing the work | |

**Auto-selection:** `[auto] Stale rationale -- Q: "Same commit or follow-up?" -> Selected: "Same
commit" (recommended default).`
**Notes:** Four prior corrections of this same class on this branch: `fd75d83`, `7e777b3`,
`9e949e4`, and quick task `260801-vyy` itself.

---

## Gate pinning (D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Pin the semantic change in `dogfood-cross-os.spec.ts` | House idiom; that file already pins CI job shape from disk | check |
| New spec file | | |
| No pin | A silent revert to a writable sidecar reopens CR-18 with every other clause green | |

**Auto-selection:** `[auto] Gate pinning -- Q: "Pin it, and where?" -> Selected: "Yes, in the
existing dogfood-cross-os.spec.ts" (recommended default).`

---

## Adjacent-stance confirmation (D-08)

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm against PROJECT.md Out of Scope, CORR-01 and TRUST-05, and record the reasoning | The ROADMAP explicitly demands this check before planning | check |
| Assume no conflict | | |

**Auto-selection:** `[auto] Adjacent stances -- Q: "Does CI read-only-against-the-same-store
contradict a locked stance?" -> Selected: "Confirm and record: no contradiction" (recommended
default).`
**Notes:** The Out of Scope line bans LOCAL WRITE; this phase moves strictly toward LESS
capability. CORR-01 is about OS-namespacing and is already superseded. TRUST-05 holds so long as
D-02's signal can only narrow.

---

## Do-nothing baseline (D-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Build it; keep the roadmap's conditional escape hatch | Maintainer added the phase by instruction | check |
| Do nothing outright | | |

**Auto-selection:** `[auto] Do-nothing baseline -- Q: "Is 'do nothing' still live?" -> Selected:
"Build it, with the conditional shrink-to-decision hatch" (recommended default).`
**Notes:** The hatch is narrow and conditional: it fires only if research cannot find a shape
satisfying D-01's criterion. Research must state which outcome it reached, explicitly.

---

## Claude's Discretion

- Names for the new factory and (if D-02 lands on option (a)) the env knob.
- Whether the new spec clauses live in `dogfood-cross-os.spec.ts` or a sibling.
- Exact comment wording for the D-06 corrections.
- Whether the shared read core keeps the construction-time `mkdirSync(CACHE_ARCHIVE_DIR)` or it
  moves into `put`.

## Deferred Ideas

- A consumer-facing read-only-sidecar adoption recipe in `docs/` (a DOCS phase, not this one).
- Applying the read-only backend to fork PRs -- fork `pull_request` behaviour has never been
  reproduced in this repo.
- A read-only Releases-mirror position -- already read-only by construction; nothing to do.
