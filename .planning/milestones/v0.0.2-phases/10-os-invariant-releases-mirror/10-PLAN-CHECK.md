# Phase 10 Plan Check

Verdict: VERIFICATION PASSED, 2 WARNINGs (both non-blocking).

## Scope of this check

All 8 plans read in full (10-01..10-08). REQUIREMENTS.md, ROADMAP.md:338-441,
CONTEXT.md, RESEARCH.md (full), VALIDATION.md, PATTERNS.md read in full.
Cross-checked against the live tree: release-asset-name.ts, cache-key.ts,
publish-mirror.ts, read-back.ts, docs-same-os-claims.spec.ts, lint-rules.spec.ts
(CORR_05_SITES), dogfood-cross-os.spec.ts (jobBlock), ci.yml (publish/publish-verify
jobs), package.json scripts, git commit range 3327a4f..7d467e8 (measured: 51,
matches plan 10-08 own cited count exactly).

## Requirement coverage (12 IDs, REQUIREMENTS.md wording, not ROADMAP stale table)

CORR-02: 10-06 (RED) + 10-07 (GREEN, single commit). CORR-05: 10-06 + 10-07
(3 extant sites per RESEARCH C-2, not 4; site 4 moved in 10-06, sites 2/3
deleted in 10-07 same commit as CORR-02). RETAIN-04: 10-07. RETAIN-05(a)
census/disposition: 10-01. RETAIN-05(b) disjointness table: 10-07.
RETAIN-05(c) prefix 4-consumer lock: 10-06 + 10-07. OBS-03: 10-02 + 10-03
(EDITED_FILES widen). OBS-05: 10-04 + 10-05. XOS-06: 10-05. XOS-07: 10-03.
TRUST-10: 10-08. TRUST-11/12: 10-08 (INPUT only). TRUST-13: 10-08 explicitly
forbids self-certification, hands off to gsd-security-auditor, does not take
secure-phase inline short-circuit.

All 12 IDs present in some plan requirements frontmatter. Verified.

## Hard ordering rules (depends_on graph, not prose) -- all 4 confirmed as edges

1. RETAIN-04+RETAIN-05 same commit as CORR-02: plan 10-07 tasks 1-2 STAGE ONLY,
   task 3 is the single commit (verified literal DO NOT COMMIT / THE SINGLE
   COMMIT task boundaries). 10-06 is ADD-only RED, explicitly not bound by the
   same-commit rule (matches RESEARCH H-1 own reasoning: same-commit binds
   implementation, not RED).
2. CORR-05 remaining sites plus eslint-disable directives leave together:
   10-07 task 1 (release-asset-name.spec.ts, 2 sites) + task 2
   (releases-backend.spec.ts OTHER_PLATFORM + lint-rules.spec.ts CORR_05_SITES
   3 rows) all staged then committed together in task 3. Verified against
   live lint-rules.spec.ts: CORR_05_SITES currently has exactly 3 rows,
   matching the plan claim.
3. OBS-05 strictly before CORR-02: depends_on chain 10-04(wave3) -> 10-05(wave4)
   -> 10-06(wave5) -> 10-07(wave6). Confirmed via frontmatter depends_on, not prose.
4. ROBUST-04 (build:action plus staged bundle, same commit as any
   serve()-reachable edit): traced per-plan. Only 10-07 touches
   release-asset-name.ts (in the serve() graph per RESEARCH H-3); it
   explicitly runs build:action and stages start-cache-server/index.js in its
   single commit, with a tree-confirmation step (main tree, not a junctioned
   worktree) before doing so. All other plans (10-02, 10-04, 10-05, 10-08)
   explicitly prohibit running build:action and assert zero bundle diff,
   matching RESEARCH reachability table. No plan commits a serve()-reachable
   edit without the bundle rebuild in the same commit.

## Vacuity checks (the highest-value check per the brief)

- Rate-zero sampling: every OS-axis assertion in every plan is driven via
  it.each(CACHE_OS_VALUES), never a hand-authored linux literal alone (where
  literals ARE pinned, e.g. plan 10-04 feed0/1/2 literals, they are paired
  with the tuple-derived index, matching Phase 9 dual-form precedent).
- Negated matcher: plans 10-02 and 10-05 explicitly prohibit a negated matcher
  inside toHaveBeenCalledWith and require pinning the call count then
  asserting across every recorded argument array (the 09-VALIDATION G3 fix
  applied prospectively).
- CORR_05_SITES coverage cliff: plan 10-06 adds a positive assertion that the
  table is empty (as RED, replacing the empty-enumeration silent-zero), plan
  10-07 empties the table and the assertion goes GREEN. Matches RESEARCH C-2
  exactly.
- D-17 site-4 move: plan 10-06 creates the new integration spec WITHOUT
  repointing the CORR_05_SITES row (explicitly prohibited); plan 10-07 DELETES
  the row (never repoints). Matches RESEARCH C-3 trap avoidance.
- needs superset trap (XOS-07): plan 10-03 task 2 explicitly requires 4
  separate per-dependency assertions plus a named build-SURVIVES clause,
  not a single toMatch. Matches PATTERNS Tier 3 item 10 warning.
- Mutation checks: present and specific (predicted-then-run) in every plan
  touching a new guard. This is unusually thorough.

## Live-CI-only items -- correctly marked human_needed, no fake pre-merge check

Verified 3 items each in the correct owning plan human_needed block, none
asserted as satisfiable pre-merge:
1. OBS-05 per-leg own-asset read-back plus mirrored-by label -- plan 10-05.
2. Warm-mirror republish under new name (Phase 11 precondition) -- plan 10-07.
3. Post-XOS-07 full-task-set mirror -- plan 10-03.
No plan claims a pre-merge automated check satisfies any of these (publish and
publish-verify are push-gated to main per ci.yml, confirmed).

## TRUST-13 framing

Plan 10-08 10-TRUST-EVIDENCE.md explicitly frames TRUST-11/12 as QUESTIONS
with a classification labelled INPUT not conclusion (per its own acceptance
criteria requiring this framing to appear before the proposed classification).
TRUST-11 arbitration point is corrected to saveCache, not the Release
upload (matches REQUIREMENTS own corrected wording and the code citations in
publish-mirror.ts, verified: byte-identical restore-and-upload-verbatim logic
at the cited lines). Auditor required reading: 09-SECURITY.md section 1 plus
concrete Phase 9 commit range 3327a4f..7d467e8 -- VERIFIED this resolves to
51 commits via live git rev-list --count, exactly matching the plan cited
figure. Plan explicitly forbids taking secure-phase inline short-circuit,
matching this project own CLAUDE.md rule about never self-certifying gated
auditor findings.

## Wave 0 gaps (10-VALIDATION.md) -- all 10 rows map to a task

1. release-asset-name.integration.spec.ts -> 10-06.
2. mirror-seed.ts plus spec -> 10-04.
3. RETAIN-05(b) disjointness table -> 10-07.
4. publish-mirror cachePlatform-once case -> 10-02.
5. read-back mirrored-by label assertion -> 10-05.
6. action/index mirror-seed url-derivation case -> 10-04; ref-scoping case -> 10-08.
7. docs-same-os-claims new DOCS_08_SITES rows -> split across 10-03, 10-05, 10-07.
8. cleanup.spec.ts mixed-shard fixture -> 10-06.
9. jobBlock publish needs and max-parallel value guards -> 10-03 (needs) plus 10-05 (max-parallel).
10. Recording artifacts (D-08/D-25/D-26) -> 10-01 plus 10-08.
No gap found.

## Planner-claimed corrections to RESEARCH.md -- all 3 verified sound against the tree

(a) read-back.ts label read must paginate (not read inline release.assets):
CONFIRMED via action/index.ts existing comment citing Pitfall 4 --
listReleaseAssets paginates the assets endpoint, NEVER the inline
release.assets first-page snapshot -- live precedent in the tree that
RESEARCH own recommendation (citing only the tags endpoint) omitted.

(b) publish-mirror.ts has TWO byte-identity justifications needing rewrite, not
one: verified via rg -n "under CORR-01" -- exactly 2 hits (line 159 doc
block, line 261 in-loop D-05 comment). A third byte-identical mention at
line 274 does NOT cite under CORR-01 as its reason and describes a distinct
concept (name-collision benignity, not content-identity reasoning), so it
correctly falls outside the plan TWO count.

(c) releases-backend.ts carries two stale same-OS doc-block claims: verified
via rg -- OS-namespaced asset NAME (line 13) and get resolves the running
platform asset (line 57) -- both present, matching the plan claim exactly.

All three corrections are sound. Plans built on them are not undermined.

## CONTEXT.md decision coverage (D-00..D-27)

All 28 traced to an implementing plan or task. No gaps found. No Deferred Idea
(matrix collapse, manual prune, read-fallback, per-target flag, Phase 11/12
items) appears in any plan.

## Scope reduction scan (Dimension 7b)

No v1/v2/simplified/static-for-now/placeholder/stub/skip-for-now/too-complex
language found anywhere across the 8 plans task actions. No requirement is
delivered as a reduced or partial version of what CONTEXT.md or REQUIREMENTS.md
specifies.

## Architectural tier compliance (Dimension 7c, RESEARCH Architectural Responsibility Map)

Checked all 8 rows of the map against task placement: asset lookup name (pure
lib), producer attribution (Release label, stamped by publish engine), prune
eligibility (pure lib predicate plus single cleanup call site), per-leg seed
derivation (new pure lib plus action bin plus roundtrip bin), dead-publish-path
detection (CI job, not a spec), job ordering (ci.yml strategy only), trust
boundary (ref scoping plus isSyncTrusted), threat classification (auditor,
plan supplies input only). No tier mismatch found.

## Minor findings

### WARNING: RESEARCH.md Open Questions section lacks the RESOLVED
suffix and lacks per-item RESOLVED markers (Dimension 11 literal check).
Substantively this is a non-issue: each of the 5 open questions
recommendation was traced against the plans and confirmed incorporated
(XOS-07 drift guard -> 10-03 task 2 built it; RETAIN-05(b) table location and
TRUST-10 ref pin location -> land exactly where recommended, in
release-asset-name.spec.ts and action/index.spec.ts respectively; CORR_05_SITES
positive-assertion replacement -> 10-06 built it; OBS-05 non-vacuity via
offline mutation-proof plus live confirmation -> 10-05 built exactly this
shape; the tar.gz census re-take -> 10-01 re-measures live rather than
trusting the research figure). Recommend RESEARCH.md be updated to mark the
section RESOLVED for process hygiene. Does not block execution.

### WARNING (scope, non-blocking): plan 10-06 is 1 task over 6 files (explicitly
justified in-plan under its own heading explaining why the RED must land as a
single unit or lint and typecheck go inconsistent mid-plan). Plan 10-07 is 3
tasks over 13 files (the one-commit wave; explicitly justified by 5 converging
same-commit rules documented in RESEARCH H-1, and mitigated by splitting RED
(10-06) out of the commit-bearing plan to shrink the window a spend-limit kill
would lose, per Phase 9 own near-miss lesson). Both exceed the mechanical 5-8
file guideline but both carry a specific, reasoned, requirement-driven
justification tied to this phase actual same-commit constraints, not planner
convenience. Not treated as a blocker.

## Not checked / lower confidence

- Did not execute any code or run the test suite; all verification is static
  (plan content plus live tree cross-reference via rg and git), per the
  checker mandate.
- Did not independently re-derive the 1.6M-candidate randomised disjointness
  probe or the 5/5 timestamp measurements in RESEARCH.md U-01 section --
  treated as HIGH-confidence per RESEARCH own sourcing (cited gh api commands,
  reproducible), not re-run here.
- Did not check every one of PATTERNS.md roughly 14 excerpt-copy instructions
  line-for-line against the plans prose; spot-checked 4 (mirror-seed.ts
  analog, jobBlock guard, cache-key.ts composition pattern, action/index.spec.ts
  partial-mock pattern) and all matched. Did not spot-check the remaining 10.
- Did not verify plan 10-04 claim that read-back.spec.ts and
  action/index.spec.ts currently have no test pinning the seed-hash SHAPE
  (RESEARCH own claim on this point) by reading those spec files full content
  -- accepted RESEARCH own git-grep sourcing on this narrow point.
- CLAUDE.md and AGENTS.md compliance checked at the level of: npm and nx
  invocation style, git commit -F (Dev Drive EINVAL), never git add -A,
  rg-not-git-grep discipline, ASCII-only. Did not separately audit every plan
  sentence for incidental non-ASCII characters.
