---
phase: quick/260726-pjz
verified: 2026-07-26T22:20:00Z
status: human_needed
score: 9/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Decide whether the `## Residual notes` bullet 'Why two storage primitives were rejected
      outright' stays. Read `.planning/ARCHITECTURE-DECISION.md:95-98` next to
      `.planning/research/STACK.md:75,77`."
    expected: "Independently re-measured and CONFIRMED: STACK.md:77 carries 'Reject - bloats
      history, no clean eviction' (the phrase 'no clean eviction' is verbatim the ADR's) and
      STACK.md:75 carries 'No (run-scoped, not key-scoped) ... Reject - no anon read, wrong lookup
      shape' (substantively 'not content-keyed'). This residue row HAS a canonical home, so the
      KEEP criterion ('keep only what has no canonical home') says delete it. It was retained
      because Task 2's gate hard-requires the `content-keyed` token and gates were run verbatim.
      Deleting the bullet also requires editing that gate token."
    why_human: "A deliberate, disclosed deviation from the phase's governing criterion. Whether a
      labelled duplicate of a dead-end historical rationale is acceptable is a judgment call on a
      security-adjacent document, not a grep result."
  - test: "Decide whether four removed reasoning sentences from Decision 3 / Decision 2 needed a
      COVERAGE.md row. They are absent from the 44-row table and homeless in the live tree."
    expected: "Independently probed homeless (excluding the ADR, quick/ and milestones/):
      (a) Decision 3's honesty caveat - 'total control surface is ~a wash ... Releases wins under a
      remediation/safety-weighted lens, a defensible judgment for this tool, not a raw-count fact'
      (`raw-count`, `safety-weighted`, `scaling-correctness`, `defensible judgment` all homeless);
      (b) the reversibility COST detail - 'costs a later-milestone publish/cleanup build +
      re-populate, with no consumer-contract or migration impact' (`re-populate`,
      `no consumer-contract`, `migration impact` homeless; the 'additive, not a switch' half IS
      covered at `codebase/CONCERNS.md:412`); (c) the GHES version specifics - 'GHES 3.21 GA'd
      2026-06-11 ... earliest possible is an unannounced 3.22+' (`3.21`/`3.22` homeless; the
      substance IS covered at `research/PITFALLS.md:65-79` and `PROJECT.md:148`); (d) GHCR's
      digest-pin edge being 'minor, self-inflicted' (`self-inflicted` homeless; the mild-edge
      substance IS at `spikes/003-size-ceiling` and STACK.md). Item (a) is arguably SPENT rather
      than lost: `spikes/004-ghcr-hazards/README.md:84-88` empirically supersedes it with a
      HARDER claim ('materially larger operational + security control surface than Releases')."
    why_human: "Whether a hedge on a claim is itself a 'distinctive claim' is a judgment. Nothing
      operative was lost - no control, no invariant, no constraint - but the enumeration was not
      exhaustive, and the task's own standard was that it would be."
  - test: "Confirm the uncommitted `.planning/PROJECT.md` working-tree change is unrelated and
      intended. Run `git diff -- .planning/PROJECT.md`."
    expected: "The only uncommitted hunk widens v0.0.2 requirement ID ranges (PARITY-01..04 ->
      ..05, VER-01..04 -> ..06, adds LINT-01..06/CORR-06, XOS-01..07/TEST-08..10/OBS-02..05). It
      does NOT touch the Nx contract Constraints row, the Key Decisions cadence row, or any ADR
      pointer, so it does not affect this task's result - but it means PROJECT.md on disk differs
      from commit 27e2cb6."
    why_human: "Ownership of an unrelated uncommitted edit is outside this task's scope to judge."
---

# Quick Task 260726-pjz: Audit / triage / extract / deduplicate ARCHITECTURE-DECISION.md - Verification Report

**Task Goal:** Audit, triage, extract and deduplicate `.planning/ARCHITECTURE-DECISION.md` into
canonical GSD artifacts; keep only what has no canonical home; re-describe existing inbound links;
attach a working review cadence.
**Verified:** 2026-07-26
**Status:** human_needed
**Re-verification:** No - initial verification
**Commits under review:** `4699232`, `45dd0f4`, `27e2cb6` (base `d0f5399`; the prompt's `fe25a3f`
is five milestone-setup commits earlier - those five are NOT part of this task's diff)

Every finding below was re-derived by executing probes against the tree. No claim in SUMMARY.md or
COVERAGE.md was accepted on its own authority; where this report agrees with them, it is because
the independent probe returned the same result.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every distinctive claim of every removed section classified as COVERED / RESIDUE / SPENT by an executed grep, recorded in COVERAGE.md, before the removal edit | WARNING - PARTIAL | 44 disposition rows present, 0 reading UNCOVERED/TODO. I re-ran the 36-assertion positive battery: **36/36 pass**. I re-ran every negative probe independently: 7 of 8 residue rows re-measure homeless. But the enumeration is NOT exhaustive - four removed reasoning sentences (Decision 3's weighting caveat, the reversibility cost detail, GHES 3.21/3.22 specifics, GHCR's "self-inflicted edge") have no row and no home. See Human Verification item 2 |
| 2 | Retention is the default; 8 RESIDUE rows survive in the slimmed ADR; the two mis-filed claims are COVERED and deleted | VERIFIED | All 18 residue tokens present in the ADR (checked one by one). Both reclassifications independently confirmed: "do not assume it is pluggable" at `research/ARCHITECTURE.md:162` + verbatim `research/SUMMARY.md:58`; "never introduce a second knob" at `PROJECT.md:115` + shipped `packages/github-cache/src/lib/retention.ts`. Neither appears in the slimmed ADR |
| 3 | Controls C1-C18 survive byte-identical; 18 rows hash to `bb8cd95...1ce2f` | VERIFIED | Hashed BOTH trees myself: `git show fe25a3f:...\| rg '^\| C[0-9]+ \|' \| sha256sum` = `bb8cd9515a8e1477ea557ebc3aa5ce820fbc032744b2459e9b80fa2b44d1ce2f`; same command on the working file = identical. 18 rows. The CVE preamble (`59963177...`) and the `## References` line (`2bfaa99a...`) also hash identical across both trees |
| 4 | The file keeps its name; both out-of-tree references keep resolving | VERIFIED | `docs/trust-and-security.md:15` -> `` `.planning/ARCHITECTURE-DECISION.md` ``; `packages/github-cache/src/backend/actions-cache-backend.ts:88` -> "ARCHITECTURE-DECISION.md control C1". C1 survives byte-identical. All ten `ADR C<n>` citations across `docs/`, `ppe/action.yml`, `cache-key.ts` and `actions-cache-backend.spec.ts` target surviving controls |
| 5 | No LIVE artifact cites a Decision number that no longer exists; 7 sites re-pointed; 3 sealed spike sites excluded | VERIFIED | Bare `rg 'Decision [0-9]'` over `.planning` excluding milestones/quick/ADR/spikes-005 returns **zero**. All 7 re-pointings read correctly in the diff. `.planning/spikes/005-cross-os-roundtrip/` has zero diff |
| 6 | Decision 6's alternative branch is not lost - it lives in PROJECT.md Key Decisions | VERIFIED | `PROJECT.md:151` CORR-01 row: "**OS-namespace the store by default** (or documented consumer OS-discrimination)". All three ex-Decision-6 citations (PROJECT.md:80, PROJECT.md:153, REQUIREMENTS.md:59) now name that row explicitly |
| 7 | The inbound link SET stays exactly 9 current `.planning/` files | VERIFIED | Sorted set matches the required list byte-for-byte. REQUIREMENTS.md was re-pointed WITHOUT gaining the filename (would have made ten); no file lost its pointer. The ADR contains zero self-references, so it is not a tenth match |
| 8 | The review cadence attaches to something a workflow genuinely consumes, NOT to `## Evolution` | VERIFIED | Verified against the GSD install with `rg -L`: `complete-milestone.md:293` is a hardcoded "**Key Decisions audit:**" checklist item and `:298` is "**Constraints check:**". Both new/edited rows sit under those two headings. A full `rg -L "Evolution"` over `gsd-core/` finds only WRITERS (`new-project.md:505`, `new-milestone.md:153`) - no workflow reads `## Evolution`. The PROJECT.md diff does not touch it |
| 9 | Archived milestone artifacts untouched; `gsd health` W019 not acted on | VERIFIED | `git diff d0f5399..27e2cb6 -- .planning/milestones/` is empty; `git status --porcelain` on that path is empty. The ADR records W019 in the first person at lines 45-49 and does not act on it |
| 10 | The MOVE is de-duplicated too - Constraints carries the hard floor plus a pointer, not a third copy | VERIFIED | Read `research/STACK.md:15-40` directly: it carries the full endpoint/status table, "single token; server decides read-only vs read-write", required `Content-Length`, 409, GET 200/403/404, the `202 -> 200` drift verbatim, hash-the-vendored-spec, and the hard Nx 21+ floor with `HttpRemoteCache` strict-200. The new `PROJECT.md:133` row is ONE sentence: hard floor + STACK.md section 1 pointer. `Nx 23` appears only in the Tech stack row; "Nx custom task runner API" appears exactly once |

**Score:** 9/10 truths verified (0 present, behavior-unverified; 1 partial routed to human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.planning/quick/260726-pjz-.../260726-pjz-COVERAGE.md` | Pre-removal coverage proof, one row per removed claim | VERIFIED | 150 lines, 44 disposition rows, 0 UNCOVERED/TODO, five explanatory notes (A-E) including the self-disclosed Note C deviation. Pure ASCII |
| `.planning/ARCHITECTURE-DECISION.md` | Slimmed to the C1-C18 ledger plus framing | VERIFIED | 7 headings (was 11). All 8 removed headings gone, no `## Decision N` survives. `Decision [0-9]` matches exactly one line: C10's verbatim row (line 66) |
| `.planning/PROJECT.md` | New `**Nx contract**` Constraints row + re-described Key Decisions row | VERIFIED | Line 133 (Constraints, ASCII ` - ` separator throughout, no em dash) and line 146 (Key Decisions Outcome cell with the cadence sentence and `(updated 2026-07-26)` suffix) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `PROJECT.md ## Key Decisions` row | `.planning/ARCHITECTURE-DECISION.md` | milestone checklist item 6 | WIRED | Row names the ledger by content ("the project-level CREEP control ledger C1-C18") and states the cadence. `complete-milestone.md:293` consumes it |
| `PROJECT.md ## Constraints` **Nx contract** row | `research/STACK.md` section 1 | milestone checklist item 7 | WIRED | `complete-milestone.md:298` consumes it. Pointer target verified to hold the detail |
| `docs/trust-and-security.md:15` | `.planning/ARCHITECTURE-DECISION.md` | filename unchanged | WIRED | Resolves. Confirmed no `.spec.ts` asserts the path string - the unchanged filename is the only thing holding it |
| `actions-cache-backend.ts:88` | control C1 | filename + byte-identical C1 | WIRED | C1 row hash-verified unchanged |

### Data-Flow Trace (Level 4)

Not applicable - documentation-only change, no dynamic data rendering.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Task 1 coverage battery (36 assertions) | 36 individual `git grep -q -F` / `test -f` | 36/36 pass | PASS |
| Task 2 gate (verbatim from PLAN) | full chained gate | exit 0 | PASS |
| Task 3 gate (verbatim from PLAN) | full chained gate | exit 0 | PASS |
| Ledger hash parity across trees | `sha256sum` on both `fe25a3f` and working tree | identical | PASS |
| Residue homelessness (26 tokens) | `git grep -q -F` excluding ADR/quick/milestones | 7 of 8 rows homeless; row 4 has a home | PARTIAL |
| Non-ASCII confined to preserved lines | `rg '[^\x00-\x7F]'` on the ADR | only line 53 + C1/C3/C4/C5/C6/C7/C11/C16/C18 | PASS |
| `packages/` untouched | `git diff d0f5399..27e2cb6 -- packages/` | empty | PASS |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| - | - | none introduced | - | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` in any line added by these three commits. The `**Plans**: TBD` hits in ROADMAP.md are pre-existing from `d0f5399` (milestone setup), not this task |

### The size question, answered honestly

`wc` on both trees:

| Tree | lines | words | bytes |
|------|-------|-------|-------|
| before (`fe25a3f`) | 91 | 2676 | 19611 |
| after | 117 | 1589 | 11140 |

**Lines are the wrong metric here and the +29 percent is not scope drift.** The deleted Decision
sections were single mega-paragraph lines of 800-2000 characters each; the authored replacement
wraps at ~95 columns. By the metrics that track content, the file **shrank 41 percent by words and
43 percent by bytes**. Of the 11140 remaining bytes, 4616 (41 percent) is the byte-identical
preserved core - the 18 control rows, the CVE preamble and the `## References` block. The rest is
the Status block, "Where the rest of this record went", the cadence line, the W019 note, and the
seven residual bullets. The SUMMARY's framing ("the line count went UP because the framing that
explains where everything went is new") is accurate but undersells it; the honest headline is that
the file lost 1087 words.

### The three focus items in the brief

**Focus 3 - the self-reported deviation. CONFIRMED, and the reading is correct.** I read
`research/STACK.md:75` and `:77` directly. Line 77 (git objects / refs): "Repo-bloating; no
per-object expiry ... **Reject** - bloats history, no clean eviction" - "no clean eviction" is
verbatim the ADR's phrase and "bloats history" is "clone bloat". Line 75 (Actions Artifacts): "No
(run-scoped, not key-scoped) ... **Reject** - no anon read, wrong lookup shape" - "run-scoped, not
key-scoped" is exactly "not content-keyed" in substance, plus a further reason. The literal token
probes (`clone bloat`, `content-keyed`) do return homeless, which is precisely the phrasing-accident
failure mode the plan warned against. **Retention leaves a real duplicate** - one bullet, ADR:95-98
- but a labelled one: the bullet carries its own pointer to "STACK.md section 2's
primitive-comparison table, which is the fuller treatment", and section 2 is indeed where that
table lives (STACK.md:60, table at :72-78). Low drift risk (a dead-end rationale for primitives
never built), but it does violate the phase's KEEP criterion. Routed to human.

**Focus 3, smaller sibling - the dormant version-gate knob. CONFIRMED partial.**
`research/PITFALLS.md:310` reads "keep the version-gate knob dormant/OFF", so that sub-clause is
duplicated. But the distinctive half - the anti-spoofing cross-check MECHANISM (`/meta`
`installed_version` absence plus the `X-GitHub-Enterprise-Version` header) - re-measures homeless
in every live artifact. The only full-claim hit is `.planning/milestones/v0.0.1-REQUIREMENTS.md:57`,
which D-04 rules out as a historical record rather than a canonical home. Retaining the row whole
is the right call; the leftover duplication is one clause.

**Focus 6 - the cadence. It works.** This was the whole point of the task and it landed correctly.
`## Evolution` is write-only in GSD (only `new-project.md` and `new-milestone.md` mention it, both
as writers); nothing reads it, so a cadence line there would have been the exact inert artifact the
task existed to avoid. `complete-milestone.md:293` ("Key Decisions audit") and `:298` ("Constraints
check") are hardcoded checklist steps, and both edited rows sit under those headings. Nothing was
written to `## Evolution`.

**Focus 5 - untouched-by-contract. Zero changes, confirmed three ways:** `git diff
d0f5399..27e2cb6` shows no path under `.planning/milestones/`, `.planning/spikes/005-cross-os-roundtrip/`
or `packages/`; `git status --porcelain` is empty for the first two; `git diff fe25a3f..HEAD --
packages/` is empty.

### Gaps Summary

No blockers. The destructive edit is genuinely lossless for everything that matters: the 18 controls
are byte-identical (hash-verified against the pre-change tree, not against a claim), the CVE preamble
and bibliography are byte-identical, every one of the 36 coverage assertions re-runs green, and 7 of
the 8 retained residue rows re-measure homeless under my own probes rather than the executor's.

Two loose ends, both judgment calls rather than defects:

1. **One retained residue row has a canonical home** (`STACK.md:75,77`). Retained deliberately and
   disclosed in both COVERAGE.md Note C and the SUMMARY. It is the lossless error, and the bullet
   signposts the fuller treatment, but it is a duplicate in a file whose stated criterion forbids
   duplicates.

2. **The 44-claim enumeration was not exhaustive.** Four reasoning sentences were deleted without a
   classification row and have no home. The most substantive is Decision 3's honesty caveat about
   the control-surface comparison being "a defensible judgment for this tool, not a raw-count fact"
   - and that one is arguably SPENT rather than lost, since `spikes/004-ghcr-hazards/README.md:84-88`
   empirically supersedes it with a harder claim in the same direction. None of the four is a
   control, an invariant, or an operative constraint, and the decision they hedge is recorded in
   three independent places plus the full spike records.

---
*Verified: 2026-07-26*
*Verifier: Claude (gsd-verifier)*
