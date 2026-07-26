# Quick Task 260726-gok: Resolve typecheck stale-cache false-pass and the consumer-doc defects in a single PR - Context

**Gathered:** 2026-07-26
**Mode:** `--full --auto` (gray areas auto-locked per the trap-quadrant rule; HIGH-impact + NOT-HIGH-confidence items are NOT auto-locked)
**Status:** Ready for research (1 UNRESOLVED routed to research)

<domain>
## Task Boundary

Two open follow-ups from Deferred Items, landed as ONE PR:

**A. CI correctness** -- `npm run typecheck` can exit 0 while a spec file holds a real type error, because
nx serves a stale cache HIT.

**B. Consumer-facing doc defects** -- three real defects found while dogfooding, plus two dead-citation
claims to verify or drop.

Explicitly OUT of scope: any change to the cache engine, the trust/sync gates, `releaseAssetName`, the
consumer contract's public surface (D-04), or the cross-OS namespacing question (separately deferred,
and a design change to a LOCKED requirement).
</domain>

<grounding>
## Grounding done BEFORE locking anything (this changed the task)

Read from the tree rather than from the Deferred Items prose. Three corrections:

1. **`nx.json:116-118`** -- `typecheck.inputs` starts from `production`. **`nx.json:5-9`** -- `production`
   = `default` minus `!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)` minus
   `!{projectRoot}/tsconfig.spec.json`. Meanwhile **`nx.json:42-46`** -- `test.inputs` starts from
   `default` (spec-inclusive). So the sibling target already has the shape typecheck needs; this is an
   inconsistency between two targetDefaults, not a missing concept.

2. **The implicit `wait-all` claim IS MEASURED** -- contrary to the rk4 session-continuity note calling
   it "STILL UNMEASURED". `.github/workflows/ci.yml:132-137` records run **30172888579**: a probe with a
   background sidecar, a SUCCEEDING target and NO `cancel:` caused the runner to insert a step literally
   named "Wait for all background steps", which never returned; the job died at its `timeout-minutes`
   cap (3m02s, conclusion cancelled). The claim is sound. The stale artifact is the STATE.md continuity
   line, not the docs.

3. **"max 10 concurrent background steps" is NOT in any shipped doc.** It appears ONLY at
   `06-RESEARCH.md:508` (the citation line itself) and in `260725-rk4-REVIEW.md:135` quoting it.
   `git grep` over `README.md` + `docs/` for a background-step count limit returns NOTHING. So there is
   no consumer-facing claim to correct -- only a planning-artifact citation to annotate. This shrinks
   the "two dead citations" item to ONE consumer-facing claim.
</grounding>

<decisions>
## Implementation Decisions (auto-locked -- low impact OR high confidence)

### A1. Fix the typecheck false-pass by making specs an INPUT, not by dropping spec typechecking
Two candidate fixes existed. Locked: **add the spec fileset to `targetDefaults.typecheck.inputs`**
(stop starting from bare `production` for this target).

REJECTED: stopping the `typecheck` target from building the spec project. That would silently remove
spec type coverage entirely -- vitest transpiles via esbuild and does NOT typecheck, so no other target
would catch a spec type error. Evidence it is load-bearing: quick 260726-4cc's Task 1 RED depended on
`typecheck` catching `TS2353` in `index.spec.ts`, and the plan explicitly forbade papering it over with
an `as PublishResult` cast. Confidence HIGH -- the `test` target's existing `default`-based inputs are
the in-repo precedent for the locked option.

### A2. `openssl` -> `node` in the quickstart token mint
`README.md:39` has `token="$(openssl rand -hex 32)"`. openssl is absent from the Windows runners' Git
Bash. Locked: a `node` one-liner, since the sidecar already requires node24, so node is guaranteed
present wherever this snippet runs. Confidence HIGH.

### A3. Reuse the repo's OWN proven readiness poll for the quickstart
Do NOT invent one. `.github/workflows/ci.yml:193-221` already carries a hardened poll (rk4 findings
N3a/N3b), including the reasons that shape it: it demands exactly 404-or-200 because accepting "any
status but 000" would pass a **401** -- a token-handshake mismatch, after which every Nx request 401s,
best-effort read degradation kicks in, and the job goes GREEN having cached nothing. It also bounds each
attempt with `curl --max-time 10`, making the real worst case ~5.5 min, not 30s. Port the same shape and
the same reasoning. Confidence HIGH -- it is measured, in-repo, and already survived a review round.

### A4. `timeout-minutes` is framed as generic hang insurance
Locked framing, matching what rk4 concluded when it reverted the continue-on-error mechanism: keep
`timeout-minutes` as insurance against a hang, NOT as the containment control for a failing step (a
bare `cancel:` provably runs after a failing step -- run 30172032003, red in 8s). Do not reintroduce any
continue-on-error / fail-gate dance; rk4 measured that as unnecessary AND fail-open on drift, and
rejected shipping it to adopters. Confidence HIGH.

### A5. The "max 10 concurrent background steps" citation gets annotated, never propagated
It is planning-artifact-only (see grounding 3). Locked: annotate `06-RESEARCH.md:508`, and do NOT
introduce the count limit into any consumer doc. Impact LOW (no shipped doc asserts it, and adopters run
one background step). Confidence HIGH.

**PREMISE CORRECTED 2026-07-26 by research -- the ACTION stands, the WORDING inverts.** A5 was written
believing that line's claims were "not reproducible". Research corroborated BOTH from primary sources:
the composite-`background:` note (see U1 below) and, on the same reference page, *"A maximum of 10
background steps can run concurrently in a single job; additional background steps are queued until a
slot is free."* So the annotation must say **corroborated 2026-07-26, with the URL** -- never "not
reproducible". Still do not propagate the count into consumer docs.

### A7. Newly surfaced by research: `ci.yml:128-132` now asserts something FALSE
That comment states the `background:`/`cancel:`/`wait:`/`parallel:` family ships documented "ONLY in the
2026-06-25 changelog ... and the workflow-syntax reference it links to does not mention them at all."
The reference now documents the whole family (measured on today's page: `background` x40, `wait-all` x10,
plus `cancel:` and `parallel:` sections). Locked: correct the comment. It is the stated justification for
"everything here had to be measured", so a future reader would re-derive from a false premise. Impact LOW
(comment-only, not a consumer doc), confidence HIGH -- so auto-locked. The MEASUREMENTS stay: they were
right, and they are now independently citable too.

### A8. `ci.yml:523`'s `openssl` is IN scope
Research flagged it as arguably outside the locked consumer-doc scope. Locked: fix it in the same PR.
It is the `consumer-smoke` job -- whose entire purpose is to demonstrate the consumer surface -- and it
contradicts the node-not-openssl reasoning stated 344 lines above it in the same file. It works today
(ubuntu-only), so this is an inconsistency, not a live break. Impact LOW + confidence HIGH -> auto-lock
rather than defer.

### A6. Doc-guard discipline: keep the existing guards green, wire new files if needed
`docs-adoption.spec.ts` / `docs-trust.spec.ts` assert presence tokens against repo-root docs, and those
docs are already nx `test` inputs (the T-06-03-02 stale-cache precedent). Any doc edited here must stay
covered by that wiring so an edit cannot false-pass. Confidence HIGH.

### Claude's Discretion
Exact wording of the doc prose; where in `README.md` the poll and `timeout-minutes` guidance sit; the
precise input-glob syntax for A1 (research to confirm against Nx's documented named-input semantics).
</decisions>

<unresolved>
## U1 -- RESOLVED 2026-07-26 by research. CORROBORATED; keep the claim as-is.

**Resolution: none of (a) soften / (b) live-probe / (c) drop. The claim is TRUE and now citable.**
GitHub's workflow-syntax reference documents it verbatim under `jobs.<job_id>.steps[*].background`:
*"You cannot use `background` on steps inside a composite action. A composite action can itself run as a
background step, but it cannot declare background steps internally."*
(`https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax`,
anchor `#jobsjob_idstepsbackground`; corroborated a second time against the versioned `github/docs`
source at `content/actions/reference/workflows-and-actions/workflow-syntax.md:918-919`.)

**Why rk4 thought it was unreproducible:** docs PR **#61978** ("Document composite-action and conditional
limitations for background step keywords") landed **2026-06-30** -- three weeks BEFORE the
`06-RESEARCH.md:508` fetch on 2026-07-20. So that citation was legitimate when written. The
"unreproducible" flag is best explained as a FETCH FAILURE, not a factual finding: `docs.github.com`
blocks `WebFetch` on its `Claude-User/1.0` UA, which is exactly the signature of "cited once, never
reproducible". Confidence VERIFIED on the commit dates, INFERRED on the fetch-failure explanation.

**FOUND-03 does not depend on this claim either way** (confirmed): the JS-action form is carried
independently by the proven `ACTIONS_RUNTIME_TOKEN` fact -- a plain `run:` step never receives it, so
`@actions/cache` save/restore silently no-ops (Pitfall 4, already at `docs/advanced.md:110-117`). The two
bullets at `docs/advanced.md:123-132` are independently sound, not a chain. So the trap-quadrant deferral
cost nothing and bought a real correction: had `--auto` locked "drop the claim", it would have deleted an
accurate, now-citable statement.

**Bonus:** the same reference page now independently corroborates four semantics this repo had only
MEASURED -- the implicit `wait-all` before post-job cleanup, `if:` being unsupported on
`wait`/`wait-all`/`cancel`, `cancel:` as SIGTERM-then-SIGKILL, and the same composite restriction for
`parallel:`. The measurements were right; they are now citable as well.

### U1 (original framing, retained for the record)

### "A composite action cannot declare `background:` internally"
**Where it ships:** `docs/advanced.md:127-132` as consumer-facing prose under "Why the sidecar is a JS
action, not composite", and `start-cache-server/action.yml:29` as a comment.

**Why HIGH impact:** it is the stated rationale for the entire JS-action distribution form (FOUND-03),
it is repeated in `ARCHITECTURE-DECISION.md:82`, `v0.0.1-REQUIREMENTS.md:85` (DOCS-06), and
`05-RESEARCH.md:139`, and an adopter could reasonably build their own action shape on it.

**Why NOT-HIGH confidence:** the only support is `06-RESEARCH.md:508`, a single fetched-once
`VERIFIED: docs.github.com` line from 2026-07-20 whose claims the rk4 review already flagged as
unreproducible. The `background:`/`cancel:` family ships documented ONLY in the 2026-06-25 changelog;
the workflow-syntax reference it links to does not mention these keywords at all -- which is precisely
why every other semantic in this family had to be MEASURED rather than cited (implicit wait-all,
cancel-after-failure, `if:` rejection on a `cancel:` step were each measured live).

**Why not auto-locked:** the three candidate resolutions differ materially -- (a) soften to advisory /
attribute the claim, (b) verify live with a throwaway composite-with-internal-`background:` probe, (c)
drop the claim and keep only the independently-proven `ACTIONS_RUNTIME_TOKEN` rationale. Note (c) is
attractive because the JS-action decision does NOT depend on this claim: the load-bearing reason is
already independently proven and measured -- `@actions/cache` save/restore silently no-ops without
`ACTIONS_RUNTIME_TOKEN`, which only a JS action receives (Pitfall 4, git-history-confirmed). So the
design is safe either way; only the doc's accuracy is at stake.

**Routed to research.** If research cannot corroborate the claim from a primary source, the choice
between (a)/(b)/(c) stays UNRESOLVED for the maintainer rather than being auto-decided -- per the
trap-quadrant rule, a headless `--auto` pass must not silently lock a consumer-facing factual assertion.
</unresolved>

<specifics>
## Specific Ideas

- A ready 112-line consumer-doc patch existed in a since-expired session scratchpad. Do NOT hunt for it
  -- re-derive from `260725-w3s-RESULTS.md`, the rk4 SUMMARY, and `ci.yml`'s measured poll.
- The typecheck fix should come with a check that FAILS if the hole reopens, in the spirit of the
  T-06-03-02 fix (wire the scanned files into the target's inputs so an edit busts the cache).
</specifics>

<canonical_refs>
## Canonical References

- `nx.json:5-9` (`production` named input), `:42-46` (`test.inputs`), `:116-122` (`typecheck.inputs`)
- `packages/github-cache/tsconfig.json` (references `tsconfig.lib.json` AND `tsconfig.spec.json`)
- `README.md:39` (openssl), `:60`, `:84-85` (cancel/wait-all), `docs/examples/minimal-ci.yml:57`
- `docs/advanced.md:119-132` (JS-action-not-composite rationale)
- `.github/workflows/ci.yml:132-147` (measured background-step semantics), `:193-221` (the poll)
- `.planning/milestones/v0.0.1-phases/06-distribution-docs-governance/06-RESEARCH.md:508` (the citation)
- `.planning/STATE.md` Deferred Items rows for both halves
</canonical_refs>
