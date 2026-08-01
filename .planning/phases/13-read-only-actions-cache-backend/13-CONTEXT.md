# Phase 13: Read-Only Actions-Cache Backend - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning -- WITH ONE BLOCKER (D-02) that research must close before planning
**Mode:** `--analyze --auto --chain` (trade-off table per gray area; recommended option auto-locked,
EXCEPT the one rated HIGH-IMPACT x NOT-HIGH-CONFIDENCE, which is recorded UNRESOLVED by policy)

<domain>
## Phase Boundary

Make **"read the Actions cache, never write it"** a representable backend, so the three Windows
reuse legs (`build-windows` / `typecheck-windows` / `test-windows`) can be **GATED** on a genuine
cross-OS HIT instead of merely recording one -- without giving the `@actions/cache` cache-version
computation a second place to drift.

**IN SCOPE:**

- A read-only Actions-cache implementer of the existing `ReadableBackend` port.
- The context signal that causes `selectBackend` to construct it (D-02, blocked).
- Rewiring the three Windows legs to that backend and GATING their `[remote cache]` counts.
- Whatever spec/doc pins keep both of the above from silently reverting.

**OUT OF SCOPE:**

- Any change to `nx.json` or anything that rotates a task hash.
- Any change to the Releases mirror, the publish/cleanup engine, or retention.
- A local read-write mode (PROJECT.md Out of Scope; this phase moves strictly toward LESS
  capability, never more).
- The other 24 findings from the PR #12 round-3 review.

</domain>

<decisions>
## Implementation Decisions

### Backend shape (the roadmap's named research gate)

- **D-01 (RESEARCH-GATED, not locked): the read-only backend must be the SAME implementation as
  the writable one's read path, not a second one.** IMPACT: HIGH. CONFIDENCE: HIGH on the
  *criterion*, MEDIUM on the *final shape* -- and the ROADMAP explicitly mandates a research
  comparison here, so auto-mode records a recommendation rather than pre-empting that gate.

  **The acceptance criterion IS locked:** the chosen shape must make cache-version drift
  **unrepresentable**, not merely guarded. There must be exactly ONE `cache.restoreCache(...)`
  read call site in the package after this phase, exactly as there is exactly one today. A second
  copy of the `(paths, primaryKey, undefined, undefined, /* enableCrossOsArchive */ true)`
  argument list is an automatic REJECT, because an OS-dependent cache version is precisely the bug
  Phase 9 existed to fix, and a copy-paste second backend would reintroduce this milestone's own
  root cause behind a guard that looks like coverage.

  **Recommended shape (research to confirm or refute):** extract the existing `get` closure into
  `createReadOnlyActionsCacheBackend(): ReadableBackend`, and let the writable factory compose it:

  ```ts
  export function createActionsCacheBackend(): CacheBackend {
    return { ...createReadOnlyActionsCacheBackend(), put(hash, bytes) { /* unchanged */ } };
  }
  ```

  This satisfies the roadmap's first two candidates simultaneously -- one version computation, two
  exports, AND literally one implementation -- while keeping the read-only return type free of
  `put`, so `isWritableBackend` is structurally false and the server answers PUT with the
  contract's 403 with no runtime `'forbidden'` anywhere. Both factories keep the VER-04
  cwd/`GITHUB_WORKSPACE` construction guards (`actions-cache-backend.ts:86-109`); those are the
  only defense against the silent all-MISS this phase would otherwise make invisible, since a
  read-only leg has no write path whose failure would surface.

- **D-02a (LOCKED by maintainer, 2026-08-02): the read-only backend is selected per-LEG by ROLE,
  never per-EVENT.** IMPACT: HIGH. CONFIDENCE: HIGH -- decided by the maintainer after the
  event-derived alternative was analysed and found unfixable.

  **The event-derived alternative and why it is REJECTED.** It is genuinely attractive at first
  glance: narrow RW to the write-ELIGIBLE band (`isSyncTrusted`'s shape -- `{push, schedule}` on
  the default branch) and give the merely-write-TRUSTED band (`pull_request`, `release`) the
  read-only Actions backend. That derives the signal from context alone and dissolves the whole
  knob question. It is rejected because **TRUST-05's asymmetry is a one-way ratchet**: a signal may
  only narrow RW -> RO, never widen RO -> RW. So a read-only `pull_request` BASE can never be
  widened back for the one job that legitimately needs to write on a PR --
  `dogfood-seed`, which drives a scripted PUT through `serve()` -> `selectBackend` and asserts a
  hard 200 (`action/index.ts:320,336`). Event-derived RO therefore reverts quick task
  `260801-vyy`'s CR-18 fix and there is no composition that restores it. This also disposes of the
  "event band PLUS role signal" hybrid: narrowing composes downward only, so the hybrid inherits
  the same break unfixably. Do not re-raise either.

  **What the ROLE signal buys that no event band or timestamp check can -- record this, it is the
  load-bearing argument.** If the consumer legs never write, then **no Windows-produced entry for
  those hashes can ever exist**, so any HIT on those legs is NECESSARILY Linux-produced. The
  property is **inductive**, not per-run: it does not depend on the XOS-08 `needs:` edge, on job
  ordering, or on anything being true of the current run. That is strictly stronger than the
  intra-run argument in D-04, and it is why this shape was chosen over the alternatives.

- **D-02b (OPEN -- research must resolve, planning must not begin with it open): what SHAPE does
  the role signal take?** IMPACT: HIGH -- a consumer-visible env knob is a frozen-ish public
  contract (`src/test/consumer-contract.ts` enumerates exactly 8 today; both
  `public-surface.spec.ts` and `docs-adoption.spec.ts` pin it). CONFIDENCE: NOT HIGH.

  Producer-vs-consumer role is not derivable from any GitHub-supplied environment fact, so a
  workflow-author-supplied signal is unavoidable. Only its shape is open.

  | Option | Pros | Cons |
  |---|---|---|
  | (a) New narrowing env knob read by `selectBackend` (e.g. a `*_READ_ONLY` var) | Env IS the existing context bag, so the "one backend per process, context-selected" model is unchanged; 8 documented knobs already establish the shape and the review diff | Grows the consumer contract for a need this repo's CI raised. PROJECT.md Constraints: "changes made for this repo's own CI/hashing must never leak into the consumer contract" |
  | (b) Project-local route -- a read-only serve entrypoint reachable only from the INTERNAL dogfood action | Zero consumer-contract change; honours the dogfood-stays-consumer-safe invariant literally | `packages/github-cache/action.yml` resolves `main` from `dist/action/index.js`, so it needs a build FIRST -- and `build-windows` exists to measure `npm run build`. Chicken-and-egg on the very leg that matters most. A second committed bundle avoids it but adds a second `check:action` drift surface |
  | (c) Input on the public `start-cache-server` action | The three legs already `uses: ./start-cache-server`, so wiring is one line | Strictly a superset of (a)'s cost: it changes `EXPECTED_ACTION_INPUTS` *and* needs a runtime channel into `serve()` anyway |
  | (d) Construction-time flag on the backend factory | -- | REJECTED ON SIGHT (see D-03) |

  **HOW TO WEIGH IT -- maintainer instruction, 2026-08-02.** The signal must be **strictly
  narrowing**. TRUST-05 forbids REQUESTING write; it does not forbid DECLINING it. A narrowing
  knob is therefore **TRUST-05-compatible**, and any argument that rejects option (a) on TRUST-05
  grounds is a MISREAD -- do not make it, and do not accept it from a reviewer. Option (a)'s real
  and only cost is **public API surface on a shipped package for a dogfooding-only need**. Weigh
  it there.

  **Resolution criterion:** the winning option is the one that (i) can only narrow, never widen,
  (ii) does not add a second cache-version computation or a second drift-guarded bundle, and
  (iii) works on `build-windows` without building the package before the measured `npm run build`.

- **D-02c (candidate to CARRY, with its defect pre-recorded): the witness / `created_at`
  variant.** Research must carry it as a comparison point rather than ignoring it -- but it does
  NOT close laundering, and the reason is recorded here so the comparison starts from the right
  place. An entry written by a PREVIOUS run's Windows leg predates the current leg and passes any
  "the entry is older than me" witness. Tightening the witness to "created within THIS run" then
  reddens every PR that does NOT rotate a hash -- the healthy case, where the ubuntu producer
  legitimately HITs and writes nothing. Both directions fail; record which one the variant would
  pick and why it is still worse than making the write unrepresentable.

- **D-03 (LOCKED, and the WHY is recorded so it is not re-raised): a construction-time
  `readOnly` argument on `createActionsCacheBackend()` is REJECTED.** IMPACT: MEDIUM.
  CONFIDENCE: HIGH -- this is settled project law, not a judgement call.

  TRUST-05: RW-vs-RO is **which factory constructs the backend**, never a caller-facing mode flag.
  The factory takes no parameters on purpose and its own comment says so
  (`actions-cache-backend.ts:46`), `selectBackend.length === 0` is asserted structurally, and
  `memory-backend.ts` already demonstrates the sanctioned pattern with two parameterless factories
  over one shared `readFrom` helper. A flag also re-opens the exact hole `PutResult` was narrowed
  to close: `'forbidden'` was DELETED from the union (`backend/types.ts:3-8`) so read-only-ness
  became structural rather than a runtime return value. Note the distinction that makes D-02
  legitimate and this one not: D-02's signal is read from the ENV BAG by the SELECTOR; D-03's is
  an argument to the FACTORY. The first is context; the second is a caller asking for a mode.

### Gating the three Windows legs (what the phase is FOR)

- **D-04 (LOCKED): all three Windows legs move to the read-only backend, and their
  `[remote cache]` counts become GATED at `>= 1` per leg.** IMPACT: HIGH. CONFIDENCE: HIGH --
  this is CR-18's original ask and the phase goal verbatim.

  **The soundness argument is INDUCTIVE, not per-run (D-02a).** Once the consumer legs cannot
  write, no Windows-produced entry for those hashes can ever exist, so any HIT on those legs is
  NECESSARILY Linux-produced -- regardless of run ordering, re-runs, or what any earlier run did.
  That is the property the role signal buys and the reason a re-run can no longer launder a zero
  into a green.

  XOS-08's `needs:` edge remains the LIVENESS argument (it is why the entry is present at all:
  the ubuntu producer runs earlier in the same run and either HIT, leaving the entry in place, or
  MISSed-and-SAVEd it). Keep the two separate -- `needs:` explains why the gate is not
  spuriously red; read-only-ness explains why a green means what it says. An earlier draft rested
  correctness on the `needs:` edge alone; that was weaker than what this phase actually delivers.

  Convert all three, not a subset: one writable leg left behind keeps a launderable path open and
  invites a future reader to "make the others consistent" in the wrong direction.

- **D-05 (LOCKED): threshold is `>= 1` per leg, not an exact pin.** IMPACT: LOW-MEDIUM.
  CONFIDENCE: HIGH. Phase 12's lesson (`RENDERED_DISCRIMINATOR_SITES` pinned at exactly 4 rather
  than a floor, because a green structural guard can sit over a wrong payload) does NOT transfer:
  that guard counted authored SITES in a file we control, while these counts are emitted by Nx's
  task graph and legitimately vary with it. Recorded counts on run `30717611910` were
  `build-windows` 1, `typecheck-windows` 2, `test-windows` 1 -- keep the per-target numbers as
  printed diagnostics, gate on the floor.

- **D-06 (LOCKED): every stale comment justifying the ungated counts must be corrected in the
  SAME commit that gates them.** IMPACT: MEDIUM. CONFIDENCE: HIGH.
  The laundering rationale is currently written into `ci.yml` at all three legs and into
  `dogfood-cross-os.spec.ts`'s `cacheObservation` reason string. Once the legs cannot write, that
  rationale is FALSE, and a comment carrying a false reason is a documented argument for undoing
  the work. This repo has corrected exactly this class of defect four times on this branch
  (`fd75d83`, `7e777b3`, `9e949e4`, and quick task `260801-vyy` itself).

- **D-07 (LOCKED): the new gate is pinned in a spec, or a silent revert to a writable sidecar
  reopens CR-18 with every other clause still green.** IMPACT: MEDIUM. CONFIDENCE: HIGH -- it is
  the house idiom (CR-17's precedent, and `dogfood-cross-os.spec.ts` already pins job shapes from
  disk). Prefer the existing `dogfood-cross-os.spec.ts`; it already owns cross-OS CI shape.
  Guard the SEMANTIC change (the legs are read-only AND their counts are asserted), not just the
  presence of a string.

### Adjacent stances confirmed before planning (roadmap asked for this explicitly)

- **D-08 (LOCKED): read-only against the SAME store CI writes does not contradict PROJECT.md's
  "Local read-write mode" Out of Scope line, CORR-01, or TRUST-05.** IMPACT: MEDIUM.
  CONFIDENCE: HIGH -- each is checkable against its own text.
  - The Out of Scope line bans LOCAL WRITE. This phase adds a CI-side READ-ONLY position: strictly
    less capability, in the same direction the stance points.
  - TRUST-05 is scoped to RW-vs-RO-by-construction. Satisfied as long as D-02's signal can only
    narrow (see D-03 for where the line actually falls).
  - CORR-01 is about OS-namespacing and is already superseded by the v0.0.2 OS-invariant decision.
    Untouched here.
  This is the confirmation the ROADMAP demanded; it is a RECORD, not a re-litigation.

- **D-09 (LOCKED): "do nothing" stays a live outcome, but only via one specific door.**
  IMPACT: MEDIUM. CONFIDENCE: HIGH. The maintainer added this phase by instruction, so the default
  is to build it. The roadmap's own escape hatch is conditional and narrow: **if research cannot
  find a shape satisfying D-01's criterion, the phase SHRINKS to a documented decision rather than
  shipping a second version computation.** The honest baseline it would fall back to is already
  recorded: the dogfood canary gates the STORAGE layer pre-merge; this phase buys the Nx-TASK
  layer. Research must state which outcome it reached, explicitly.

### Claude's Discretion

- Exact names for the new factory and (if D-02 lands on option (a)) the env knob.
- Whether the new spec clauses live in `dogfood-cross-os.spec.ts` or a sibling -- prefer the
  existing file.
- Exact comment wording for the D-06 corrections.
- Whether the shared read core keeps the construction-time `mkdirSync(CACHE_ARCHIVE_DIR)`. Note
  for the planner: `actions-cache-backend.ts:118-120` records that the READ path self-heals via
  `extractTar`'s `io.mkdirP`, so the mkdir is a write-path need. Keeping it in the shared core is
  harmless and simpler; moving it into `put` is also defensible. Do not silently drop it from the
  writable path -- its absence is the ENOENT-into-500 defect that comment describes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The backend port and the two implementations to model on

- `packages/github-cache/src/backend/types.ts` -- `ReadableBackend` (no `put`) /
  `WritableBackend`, `isWritableBackend`, and the comment recording WHY `'forbidden'` was removed
  from `PutResult`. This is the port; only an Actions-cache implementer of it is missing.
- `packages/github-cache/src/backend/actions-cache-backend.ts` -- the single existing
  `cache.restoreCache` read call site (`:141-147`), the VER-03 positional-argument comments that
  must survive the refactor verbatim, the VER-04 cwd/`GITHUB_WORKSPACE` construction guards
  (`:86-109`), and the VER-07 mkdir notes (`:111-121`, `:170-191`).
- `packages/github-cache/src/backend/memory-backend.ts` -- the EXISTING structural precedent:
  two parameterless factories over one shared `readFrom`, `createReadOnlyMemoryBackend` returning
  `ReadableBackend`. This is the pattern D-01 recommends generalising.

### The selection seam (where D-02 lands)

- `packages/github-cache/src/lib/select-backend.ts` -- the single context-derived selection point;
  four outcomes today, all parameterless factories.
- `packages/github-cache/src/lib/trust.ts` -- `isWriteTrusted`, `HOST_GATED_EVENTS`; why the
  Windows legs are TRUSTED and therefore why role is not derivable from trust.
- `packages/github-cache/src/serve.ts:89-119` -- the composition root; the writable branch wraps
  `put` in drain tracking, the read-only branch passes through unchanged. Already handles a
  `ReadableBackend` correctly -- no change expected here.

### The consumer contract D-02 option (a) would touch

- `packages/github-cache/src/test/consumer-contract.ts` -- `EXPECTED_ENV_KNOBS`, the 8 documented
  knobs, single-sourced.
- `packages/github-cache/src/public-surface.spec.ts` -- the D-04 four-group enumerated guard
  (barrel value/type exports, `start-cache-server` action inputs, env knobs).
- `packages/github-cache/src/docs-adoption.spec.ts` -- asserts each knob is documented in
  `configuration.md`.
- `start-cache-server/action.yml` -- the PUBLIC `uses:`-consumable surface (inputs: `port` only).
- `packages/github-cache/action.yml` -- the INTERNAL dogfood action; `main` resolves to
  `dist/action/index.js`, which is the build-ordering constraint that damages D-02 option (b).

### The CI legs and the gate

- `.github/workflows/ci.yml` -- `build-windows` (~474), `typecheck-windows` (~547),
  `test-windows` (~620): the sidecar block, the tee'd target run, and the RECORDED-never-GATED
  comment that D-06 must correct. Also `dogfood-seed` / `dogfood-verify` (~1619 / ~1656).
- `packages/github-cache/src/dogfood-cross-os.spec.ts` -- existing from-disk pins of the seed and
  verify job shapes, and the `cacheObservation` reason string (~685-695) naming this exact gap.

### Why this phase exists, and what it must not undo

- `.planning/ROADMAP.md` "Phase 13: Read-Only Actions-Cache Backend" -- goal, the named
  version-drift risk, the four candidate shapes, and the shrink-to-decision escape hatch.
- `.planning/quick/260801-vyy-resolve-cr-18/260801-vyy-CONTEXT.md` -- CR-18's full definition
  (the audit file is deliberately not committed, so this is its only in-repo carrier), the
  laundering argument, and why the dogfood canary is the sound gate today.
- `.planning/PROJECT.md` -- Out of Scope "Local read-write mode"; Constraints "changes made for
  this repo's own CI/hashing must never leak into the consumer contract" (the D-02 tie-breaker);
  Key Decisions rows for TRUST-05 and the v0.0.2 OS-invariance switch.
- `.planning/THREAT-MODEL.md` -- the C1-C18 CREEP control ledger; C1 (a blocked write is a benign
  409/no-op) is the control the read-only path must not contradict.
- GitHub read-only Actions cache for untrusted triggers (2026-06-26):
  https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ --
  the platform-side precedent for a read-only cache token; worth checking whether it offers a
  server-side lever that makes D-02's signal unnecessary.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`ReadableBackend` + `isWritableBackend`** (`backend/types.ts`): the port already exists and
  the server already answers a PUT to a put-less backend with the contract's 403. Nothing in the
  protocol layer needs to change.
- **`createReadOnlyMemoryBackend`** (`memory-backend.ts`): the structural precedent -- two
  parameterless factories, one shared read helper, read-only-ness expressed as an absent method.
- **`serve.ts`'s branch** (`:98-117`): already passes a `ReadableBackend` through untouched.
- **`withHashLock`**: `get` already runs under it; a shared read core inherits it for free.
- **`dogfood-cross-os.spec.ts`**: already reads `ci.yml` from disk and pins job shape -- the gate
  pin has a home and an idiom.

### Established Patterns

- **RW-vs-RO is which factory constructs, never a flag** (TRUST-05). Every backend factory takes
  zero parameters; `selectBackend.length === 0` is asserted structurally.
- **One authored copy of anything version-determining.** `cacheArchivePath` / `CACHE_ARCHIVE_DIR` /
  `cacheKeyFor` are single-sourced leaves precisely because a second copy is how cross-OS restore
  dies silently. D-01's criterion is this pattern applied to the read call site.
- **Contract changes land as a reviewable diff in an explicit list**, never a snapshot
  (`public-surface.spec.ts`, `pinned-deps.spec.ts`).
- **A guard that can pass over a wrong payload is not coverage** (Phase 12 / CR-01). Prefer
  asserting the semantic outcome over the presence of a string.

### Integration Points

- `selectBackend` gains a fifth outcome; `docs/advanced.md`'s "How the backend is selected" table
  documents four today and must be updated with it.
- `.github/workflows/ci.yml`'s three Windows legs switch sidecar wiring and gain a gate.
- If D-02 resolves to option (a): `EXPECTED_ENV_KNOBS` + `configuration.md` + `public-surface`.
- `start-cache-server/index.js` is a COMMITTED esbuild bundle that inlines every `serve()`-reachable
  source file. Editing `select-backend.ts` or `actions-cache-backend.ts` drifts it -- regenerate
  it in the SAME commit or `check:action` / `action-bundle-drift` fails that commit. Run
  `check:action` from the MAIN tree, never a junctioned worktree (a junctioned `node_modules`
  makes esbuild rewrite module paths and report false drift).

</code_context>

<specifics>
## Specific Ideas

### The one-line shape D-01 recommends

```ts
export function createReadOnlyActionsCacheBackend(): ReadableBackend {
  /* the existing VER-04 guards + mkdir, then the existing get closure, unchanged */
}

export function createActionsCacheBackend(): CacheBackend {
  return { ...createReadOnlyActionsCacheBackend(), put(hash, bytes) { /* unchanged */ } };
}
```

One `restoreCache` read call site survives; the read-only return type has no `put`, so a write is
unrepresentable rather than refused at runtime. The spread is safe -- these factories return
closures over captured state, not `this`-bound methods (`serve.ts:93-95` already relies on this).

### The second `restoreCache` call site, so nobody "fixes" it

`put`'s `lookupOnly` existence probe (`actions-cache-backend.ts:260-268`) is a SECOND
`restoreCache` call and it MUST keep `enableCrossOsArchive: true` at the 5th positional -- probing
at a different version reports "absent" for a present entry, so every Windows write would answer a
spurious 409. It lives on the WRITE path, so it does not exist in the read-only backend at all and
does not violate D-01's one-read-call-site criterion. Do not "unify" it with the read path.

### The soundness argument in one sentence, for the gate's own comment

A leg that cannot write can only get a `[remote cache]` label from a genuine restore of the ubuntu
producer's entry -- so unlike today's writable legs, a re-run cannot launder a zero into a green.

### Platform assumption research MUST confirm, not inherit

**Claim:** a PR run RESTORES from the default-branch (base) cache scope while SAVING into its own
merge-ref scope.

The three Windows legs' PR behaviour depends on the READ half: it is what makes a non-hash-rotating
PR HIT from main's entries rather than going cold. It is GitHub-documented but has never been
reproduced in this repo, and inherited-but-unreproduced platform behaviour is exactly what quick
task `260801-vyy` GA-2 refused to bet a gating check on.

The WRITE half is no longer an assumption: yesterday's dogfood run on PR #12 wrote into the merge-ref
scope, which is direct in-repo evidence. Confirm the READ half the same way -- by observation, in
this repo -- before the gate depends on it. If it does not hold, D-04's threshold and its
skip/expected-zero conditions need revisiting, not the backend shape.

### What the gate still does not cover

The three legs run the PUBLIC `./start-cache-server` committed bundle, while the dogfood pair runs
`uses: ./packages/github-cache` built in-job. `action-bundle-drift` is what ties bundle to source.
Say this in the comment rather than letting a reader over-read the new gate -- the same
over-reading is what CR-18 caught the first time.

</specifics>

<deferred>
## Deferred Ideas

- **A consumer-facing "read-only sidecar" recipe in `docs/`.** If D-02 resolves to a public env
  knob, documenting the knob is IN scope (the contract guards force it); writing an adoption
  recipe around it is a DOCS phase, not this one.
- **Applying the read-only backend to fork PRs.** Fork `pull_request` behaviour has never been
  reproduced in this repo (quick task `260801-vyy` GA-2 deliberately excluded forks for exactly
  that reason). Do not widen here; note it as a follow-up once a fork PR has actually been
  observed.
- **A read-only Releases-mirror position.** The Releases reader is already read-only by
  construction; nothing to do, and touching it would drag the mirror into a phase scoped to the
  Actions cache.

</deferred>

---

*Phase: 13-read-only-actions-cache-backend*
*Context gathered: 2026-08-02*
