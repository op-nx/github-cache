---
phase: 260809-hcr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/advanced.md
  - packages/github-cache/src/docs-same-os-claims.spec.ts
autonomous: true
requirements: [OBS-04, ROBUST-04, H-D2, H-D3]
must_haves:
  truths:
    - "docs/advanced.md no longer promises a consumer the all-MISS warning for a deliberate version bump (H-D2)."
    - "The docs state the CONDITION that decides which of the two warnings a bump produces -- whether the publish run also wrote entries of its own at the new cache version -- rather than asserting one of them unconditionally."
    - "The docs describe the partial-miss warning as PROPORTIONAL and not guaranteed: it fires once the historical cohort dominates the enumeration, and a small enumeration needs a larger majority."
    - "Every factual claim added to docs/advanced.md is traceable to a branch condition in publish-mirror.ts, to a warning message string, or to a recorded measurement -- and the plan names which (anti-recurrence for the 260809-2s6 defect class)."
    - "The existing required phrase `once per version-affecting change` survives the rewrite, so the DOCS-08 row that pins it stays green."
    - "The corrected prose is guarded by rows in docs-same-os-claims.spec.ts whose forbidden patterns are PROVEN to match the pre-edit text and whose required phrases are PROVEN not to."
  artifacts:
    - docs/advanced.md
    - packages/github-cache/src/docs-same-os-claims.spec.ts
  key_links:
    - "docs-same-os-claims.spec.ts row 1 (`file: 'docs/advanced.md'`, bucket `correction`) already requires `once per version-affecting change`; the rewrite must keep that literal or that row reddens for the wrong reason."
    - "Every `required` and `forbidden` string must fit on ONE line of the target file -- the spec reads raw text, so a phrase spanning a hard wrap silently matches nothing (the spec header states this; it has already cost one red)."
    - "No behaviour change: both branches stay core.warning (C3), the gate condition is untouched (H-D1), `listCacheEntries` is untouched (C1), no permission change (C2)."
---

# Quick 260809-hcr: correct the version-bump paragraph in docs/advanced.md

## Why this exists

`docs/advanced.md:84-93` tells an adopter that the first publish after a cache-version bump
"restores everything as a M[I]SS and mirrors nothing", and that "the warning it emits names the
axis". Both halves are wrong for the path the paragraph describes. The total gate needs
`readMisses === hashes.length && mirrored === 0`; a deliberate bump moves the sidecar and the
publish action together, so entries written during that same run restore and mirror, `mirrored`
is non-zero, and the total gate stays silent.

## The claim ledger -- every fact this plan authorises, and its source

The executor writes NOTHING into `docs/advanced.md` that is not in this table. This is the
anti-recurrence control for the defect being fixed: quick task `260809-2s6` shipped five
comments asserting constraints the code did not have, and its plan-check caught a sixth being
introduced by the fix itself.

| # | Claim licensed for the docs | Source |
|---|---|---|
| 1 | The total warning needs `readMisses === hashes.length && mirrored === 0`. | `publish-mirror.ts` total-gate condition |
| 2 | The partial warning needs `readMisses > 0` and a Wilson lower bound of the miss proportion at or above `PARTIAL_READ_MISS_WARN_RATIO` (0.5). | `publish-mirror.ts` partial branch + exported constant |
| 3 | On a bump, entries this run wrote at the new cache version restore and mirror, so `mirrored` is non-zero and the total gate is silent. | `publish-mirror.ts` partial-branch comment, "WHICH BRANCH ACTUALLY FIRES ON A ROTATION"; corroborated by measurement 5 |
| 4 | The threshold is scale-dependent, not a flat 50%: it needs ~90% of a 10-entry enumeration, ~75% of 20, ~66% of 47, ~60% of 112. | Computed from `wilsonLowerBound` as written; the ~60%-at-112 figure is also stated in that branch's comment |
| 5 | The one real recorded rotation left `mirrored 6`, `restore-MISS 41`, `scanned 47` -- non-zero mirrored, and a lower bound of 0.748, i.e. over the target rate. | `09-VALIDATION.md`, run `30400231720` |
| 6 | The all-MISS message names the axis (the `@actions/cache` cache VERSION, distinct from the Nx task hash and the Release asset name) and the two candidate causes; the partial message names the count, the enumeration size, which denominator it is over, and the SAME two candidate causes -- but not the axis. | the two message string literals |
| 7 | The all-MISS warning is what a publish run sees when it can restore nothing at all: a run with no entries of its own at the current cache version (a publish-only or scheduled workflow meeting a rotation), or a token whose Actions-cache read scope regressed. | claim 1 restated in consumer terms + the message's own second candidate cause |
| 8 | The asset-name rotation and the cache-version rotation are two mechanisms that land in the same upgrade run, so the disruption is one publish run, not two. | RE-DERIVED from the two mechanisms, not from the prose under correction: the archive-path literal drives the `@actions/cache` cache version, `lib/release-asset-name.ts` owns the asset-name shape. Ceiling: the asset-name axis is a READER-side MISS and adds no publish restore-MISS, so this row supports "one disrupted publish run" and nothing stronger |

Claim 5 is a RETROSPECTIVE computation: the partial branch did not exist at run `30400231720`,
so it was never observed to fire. It licenses "the counts on a real rotation clear the rate", it
does NOT license "the warning fired". Do not write the latter, and do not put run ids or this
repository's own counts into consumer docs at all -- `PROJECT.md`'s distribution constraint is
what made the partial message drop its vendor-internal tail in the first place.

## Two findings that change what the locked decisions ask for -- read before editing

**H-D1's DECISION stands; its RATIONALE does not, and must not reach the docs.** H-D1 says the
gate is reachable under ROBUST-04 bundle drift because "publish cannot restore ANYTHING --
including the entries this very run wrote". That is false for this repository's CI. Drift is
between the COMMITTED `start-cache-server/index.js` (what the four sidecar jobs run) and source;
but `packages/github-cache/action.yml` declares `main: dist/action/index.js`, and the publish job
runs `mirror-seed` and `publish` from that freshly built dist in the same job. So under drift the
sidecar's entries miss while the same-run seed -- written at the dist's cache version, unique per
run and leg -- still restores, leaving `mirrored >= 1` and the total gate silent. The gate stays
untouched per H-D1, and the docs get claim 7's framing instead of the drift story.

**H-D3 is already satisfied at the code, so no code edit is planned.** The distinction lives at
the branch pair in `publish-mirror.ts` under "WHICH BRANCH ACTUALLY FIRES ON A ROTATION", and it
is accurate as written -- including its "IN THIS WORKFLOW" scoping and its "the gate above covers
only a read-scope regression wide enough to hide the seed itself" clause, which the finding above
confirms rather than contradicts. Adding drift to that clause would introduce a sixth false
comment of exactly the class this task exists to remove. H-D3's remaining half -- "referenced
from the docs" -- is task 1's citation. `files_modified` therefore does not include
`publish-mirror.ts`; C4 gets a two-file diff.

## Tasks

<tasks>

<task type="auto">
  <name>Task 1: rewrite the version-bump paragraphs in docs/advanced.md</name>
  <files>docs/advanced.md</files>
  <action>
Before editing, copy the current file to the session scratchpad as `advanced.pre-hcr.md`. Task 2
needs the pre-edit text to prove its guard is load-bearing, and a commit boundary is a worse
place to recover it from.

Rewrite the paragraph at `docs/advanced.md:84-93` and the closing sentence of the paragraph at
`:94-104`. Write only claims from the ledger above, in the existing voice (second person,
bolded lead sentence, no run ids, no internal counts).

The paragraph must land four things, per H-D2:
- A bump rotates the `@actions/cache` cache version for every entry already in the Actions
  cache, so the entries that predate it restore as a MISS. This part of the current text is
  true and survives.
- WHICH warning that produces depends on whether the publish run also wrote entries of its own
  at the new version (claims 1, 3, 7). A run that did -- this repository's CI, and any workflow
  where the sidecar and publish share a run -- restores and mirrors those, so the all-MISS
  warning cannot fire and the proportional one is the live signal. A publish-only or scheduled
  run that wrote nothing of its own has an entirely historical enumeration, and that is the
  shape the all-MISS warning is for, alongside a regressed Actions-cache read scope.
  **The unit here is the RUN, never the JOB.** `:112` of this same document states in bold that
  publish must not share a JOB with a running sidecar, and this repo obeys it; a draft that slips
  to "share a job" makes the document contradict itself twenty lines apart. Write `run`, and pick
  one of task 2's three required phrases from this clause so the guard pins the word rather than
  trusting the drafter.
- The proportional warning is NOT a promise (claims 2, 4). It fires once the missing cohort
  dominates the enumeration, against a lower bound rather than the raw ratio, so a short
  enumeration needs a larger majority than a long one. Say "expect a spike in restore-MISS
  counts, and a warning once that cohort dominates" -- never "the warning it emits".
- What each message actually carries (claim 6), replacing the current promise that the emitted
  warning names the axis. Keep the two-consecutive-all-miss-with-no-version-change tripwire
  sentence attached to the all-MISS warning, where it belongs.

Retain the literal `once per version-affecting change` -- `docs-same-os-claims.spec.ts` already
requires it, and the fact it states is unchanged.

Cite the code once, per H-D3's second half: a bare reference to `publish/publish-mirror.ts`
naming that the two warnings are siblings at one branch pair there. The file is already cited
later in this document, so match that form; do not quote the comment.

Fix the tail of `:104` under claim 8: the asset-name rotation and the cache-version rotation
still land in the same run, but the outcome is one disrupted publish run, not an all-M[I]SS one.
Leave the rest of that paragraph alone -- the reader-side asset-name rotation it describes is
true and out of scope.

Do NOT touch: the gate or either branch in `publish-mirror.ts` (H-D1, C3), the backend table,
the `README.md:35` all-MISS sentence (judged unaffected -- it is the working-directory startup
check, a read path with no publish warning in it), or anything under C1/C2/C5.
  </action>
  <verify>
    <automated>npx nx test github-cache --skip-nx-cache</automated>
    Whole package suite green -- `docs-same-os-claims.spec.ts` row 1 and `docs-adoption.spec.ts`
    both read this file, so a dropped required literal or a broken markdown link reddens here.
    Then re-read the rewritten paragraphs against the claim ledger, line by line, and confirm
    every sentence maps to a numbered claim. A sentence with no claim number is the defect this
    task exists to remove -- delete it.
  </verify>
  <done>
`docs/advanced.md` no longer states that a bump produces an all-MISS publish or that the warning
it emits names the axis. It states the condition that selects between the two warnings, describes
the proportional one as proportional, and keeps `once per version-affecting change`. The pre-edit
copy is in the scratchpad. Suite green.
  </done>
</task>

<task type="auto">
  <name>Task 2: guard the corrected claims in docs-same-os-claims.spec.ts and prove the guard bites</name>
  <files>packages/github-cache/src/docs-same-os-claims.spec.ts</files>
  <action>
The house mechanism applies and is the right one: this spec already owns a `docs/advanced.md`
`correction` row keyed on FILE + QUOTED PHRASE, with `required` literals and `forbidden` regexes,
and `docs/advanced.md` is already a `test` input so the row cannot replay a stale pass. Extend
that table rather than inventing a new harness.

Add ONE row for this correction (a separate row, not extra phrases on the DOCS-08 row -- that row
records a DOCS-08 site and this is an OBS-04 correction; keeping them apart is what lets a failure
report say which claim broke). Give it a doc comment naming OBS-04, the claim numbers from the
plan's ledger it pins, and one sentence on why the phrases are clipped where they are.

`required`: three phrases, one per load-bearing claim -- the condition that selects the warning
(claim 3/7, and this is the one that must carry the word `run` per task 1's run-not-job clause),
the proportional framing of the partial warning (claims 2/4), and what the all-MISS warning is
reserved for (claim 7). Take each literally from a SINGLE line of the rewritten file; a phrase
spanning a hard wrap matches nothing and is a silent false pass.

`forbidden`: regexes for the three removed false claims -- the "restores everything as a M[I]SS"
promise, the "names the axis" promise, and `/one all-M[I]SS publish/`. Each must be a single-line
substring of the PRE-EDIT file: the first of those three wrapped across lines 87-88 in the
original, so the pattern has to stop at the wrap. Break the literal with a character class as the
existing `forbidden` entry does, so the phrase this spec proves absent is not planted in a file
that some future row might read.

THE THIRD PATTERN STOPS AT `publish`, and the tail is omitted deliberately. Measured on the
pre-edit file, that phrase occurs TWICE -- at `:104` in the sentence claim 8 corrects, and at
`:84` as the bolded lead sentence of the whole paragraph, which is the most-read statement of the
false promise. A pattern carrying the `:104` tail matches only the lesser instance, so the lead
sentence could be reintroduced with the suite green -- which would make this task's own success
criterion false for the very sentence it exists to remove. The short pattern covers both.

Also fix the shared harness's failure reporting, which is hardcoded to the same-OS claim and will
misdiagnose every failure this row produces: the `it` title says the file "no longer asserts
same-OS restore" and the message says it "has drifted BACK to a same-OS-restore claim" with
remediation about `enableCrossOsArchive`. A reader who reintroduces the all-MISS promise would be
told they reintroduced a same-OS claim -- which defeats the reason this correction gets its own
row. Make both claim-neutral: drop the same-OS wording from the title (leave the interpolated
pattern), and reduce the message to the file, the pattern, and the same-commit rule it already
carries. Do not touch the row shapes or the `required` branch's message.
  </action>
  <verify>
    <automated>npx nx test github-cache --skip-nx-cache</automated>
    Then prove the row is not vacuous, using the scratchpad copy from task 1 -- ALL THREE must
    hold, and record the observed output of each:
    (a) FORBIDDEN BITES: copy `advanced.pre-hcr.md` over `docs/advanced.md`, run
        `npx nx test github-cache --skip-nx-cache 2>&1 | tee <scratchpad>/hcr-red.log`, and confirm
        the run FAILS and the failure names each of the three new forbidden patterns. A forbidden
        pattern that does not appear in that log never matched the old prose either and is dead
        weight -- fix it, do not keep it. For the third pattern specifically, also confirm against
        `advanced.pre-hcr.md` that it matches on BOTH line 84 and line 104 -- one hit means the
        tail crept back in and the bolded lead sentence is unguarded.
    (b) REQUIRED BITES: the same red run must also report each of the three new required phrases
        as absent. If a required phrase passes against the pre-edit file, it does not distinguish
        corrected prose from uncorrected and must be re-chosen.
    (c) RESTORE AND RE-GREEN: restore the corrected `docs/advanced.md`, re-run
        `npx nx test github-cache --skip-nx-cache`, confirm green, and confirm `git status` shows
        only the two intended files modified.
  </verify>
  <done>
The new row exists with three required phrases and three forbidden patterns. The red log proves
all six discriminate between the pre-edit and corrected text. The suite is green on the corrected
file and the working tree holds exactly `docs/advanced.md` and `docs-same-os-claims.spec.ts`.
  </done>
</task>

</tasks>

## Verification

- `npx nx test github-cache --skip-nx-cache` green at the end of each task.
- The red log from task 2 is the evidence that the docs claims are locked rather than merely
  written; quote its failure lines in the SUMMARY.
- No diff in `packages/github-cache/src/publish/publish-mirror.ts`, `.github/workflows/ci.yml`,
  `README.md`, or any action bundle. `npm run check:action` is not needed and must not be run
  from a worktree with a junctioned `node_modules` -- no `serve()`-reachable source is touched.

## Success criteria

The paragraph a consumer reads before bumping this action describes the warning they will
actually get, states what decides it, and over-promises nothing. A future edit that reintroduces
either false promise reddens `docs-same-os-claims.spec.ts`.

## Output

Write `.planning/quick/260809-hcr-resolve-the-unreachable-obs-04-total-gat/260809-hcr-SUMMARY.md`
when done. Record: the claim numbers each rewritten sentence maps to, the six discriminating
phrases, the red-log excerpt, and the two findings above (H-D1's falsified rationale, H-D3
satisfied without a code edit) so the maintainer's review meets them in the artifact rather than
in the diff.

Then file ONE follow-up capture (`/gsd:capture`) so the H-D1 finding is not discoverable only by
reading this SUMMARY: `ROBUST-04` at `REQUIREMENTS.md:332-339` still states that bundle drift
surfaces "only as the all-restore-MISS warning", which the finding proves false -- under drift the
same-run seed written from the freshly built dist still restores, so `mirrored >= 1`. The
milestone is frozen (C4), so this is a capture, not an edit.
