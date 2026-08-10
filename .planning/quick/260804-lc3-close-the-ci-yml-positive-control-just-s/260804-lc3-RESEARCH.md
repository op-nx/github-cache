# Quick Task 260804-lc3: Close the ci.yml positive-control "just saved" defect - Research

**Researched:** 2026-08-04
**Domain:** CI comment prose vs. the code path it describes (`integration` positive control)
**Confidence:** HIGH on every verdict. Two items flagged EXPLICITLY OPEN at the end, neither blocking.

## Summary

Q1 is SETTLED from the code, and it settles in an unexpected direction: the failure-implication
sentence has a SECOND, independent defect that has nothing to do with Case A vs Case B. **A 404
cannot mean a dead sidecar.** A dead sidecar yields `000`; a 404 means the sidecar ANSWERED. The
correct subject of the masquerade is `server.ts`'s fault degradation (SRV-05), not the sidecar.

That reframing produces one shared true sentence plus two short per-case branches, and it makes the
`:1033` and `:1040` conclusions survive on stronger ground than they currently stand on. Q3 confirms.
Q2 recommends a lock, but as two phrases on an EXISTING row rather than a new row -- because that
row's own docstring is a sixth site of the defect.

**Scope grew by three sites and one file.** The presence-premise defect has 5 ci.yml sites as
CONTEXT states. The failure-implication defect has 2 MORE ci.yml sites (`:1005-1006`, `:1030-1031`)
and both defects appear a final time in `docs-same-os-claims.spec.ts:522`, which is LIVE, not sealed.

---

## Line numbers, re-derived (not copied)

Read directly from the working tree, not from CONTEXT.md.

| Cited | Verified | Text |
|---|---|---|
| `:210` | CONFIRMED | `PR. It does not: that probe reads the same merge-ref scope its own save just` |
| `:1004` | CONFIRMED | `the service really round-tripped the entry this leg's own task just saved. A 404` |
| `:1022` | CONFIRMED | `known-present after the task's own save" holds on a fork exactly as it does on the` |
| `:1033` | CONFIRMED | `No retry loop, deliberately: the key is known-present after the task's own save,` |
| `:1040` | CONFIRMED | `Placement: AFTER the Nx run, because it is that task's own save that makes the` |
| -- | **NEW `:1030-1031`** | `...the one failure it exists to detect, a dead / sidecar masquerading as a cache MISS.` |
| -- | **NEW spec `:522`** | `docs-same-os-claims.spec.ts` -- `control on the leg's own just-saved key ... a 404 there means a dead sidecar masqueraded as a cache MISS.` |

`git grep -n "dead sidecar\|masquerad"` and `git grep -nE "just[ ]saved|own[ ]save|just[ ]wrote|known-present"`.
`:1015` also says "dead sidecar" but is the historical record of the claim being corrected -- leave it.
`:450` says "producer just wrote" but is a DIFFERENT claim (the Windows reuse legs, guaranteed by a
`needs:` edge, not by this probe). Out of scope; checked, not assumed.

Also verified: the two phrases locked by `docs-same-os-claims.spec.ts` row D sit at `:1001-1002`,
immediately ABOVE the edit zone. No planned edit touches them. Nearest other locked phrases are at
`:1094` and `:2112-2117`. **The edit zone is lock-free.**

---

## Q1 -- THE BLOCKER. VERDICT: SETTLED, and the sentence has a second defect

### The trace

`curl -H auth GET /v1/cache/${own_hash}` -> `server.ts:78-121` route/method/auth/hash ladder ->
`handleGet` (`:145-164`) -> `backend.get(hash)` -> `actions-cache-backend.ts:219-225`, an
UNCONDITIONAL `cache.restoreCache([path], cacheKeyFor(hash), undefined, undefined, true)` against
the run's whole readable scope. Nothing on that path is save-conditioned. `matched === undefined` ->
`{kind:'miss'}` -> 404 (`server.ts:157`). Any throw -> `catch` -> 404 (`server.ts:160-162`).

**The finding that reframes the whole question.** A dead sidecar cannot produce a 404. Connection
refused makes curl exit 7, `|| true` swallows it, and `-w '%{http_code}'` prints `000` -- the block's
own `|| true` paragraph at `:1046-1054` says exactly this. A 404 means the sidecar spoke HTTP.
Sharper still: the readiness poll at `:925` treats **404 as the proof-of-life signature** for the
same server. The file currently uses one status code as proof the sidecar is alive at `:925` and as
proof it is dead 80 lines later. The real subject of the masquerade is `server.ts`'s SRV-05 read
fault degradation -- every backend fault becomes a 404 MISS -- which is precisely why a MISS at the
HTTP boundary is ambiguous and why this control exists at all.

### 1. Case A (MISSED and saved): what does a 404 prove?

That the read path cannot produce a key this run itself wrote into its own scope. Causes, all real:
a token-less sidecar degraded to the EMPTY in-memory backend at `select-backend.ts:68` (404s
everything); a cache-version drift between the save and the probe; a transient service fault
degraded to 404 by `handleGet`'s catch; a save that silently did not store.

**The first cause is the load-bearing one:** a degraded backend would ALSO have manufactured the
leg's MISS. So the MISS and the 404 have one shared candidate cause, and the MISS is no longer
attributable to a genuine absence. `the whole MISS observation inadmissible` is the RIGHT
consequence for Case A. Only its stated agent is wrong.

### 2. Case B (HIT, saved nothing): what does a 404 prove?

The "dead sidecar masquerading as a MISS" framing is **not meaningful on Case B**, twice over: there
is no MISS to invalidate, and the leg observably read through that same single sidecar process
minutes earlier (`cacheStatus=remote-cache-hit`), so liveness is already established in-band. A
degraded in-memory backend is excluded by measurement on Case B -- the backend is chosen ONCE at
sidecar startup, so a HIT proves it is not the degraded one.

A 404 on Case B proves something different and still real: **NON-DETERMINISM in the read path within
one job.** The same process answered the same scope for the same key and now cannot -- a transient
service fault degraded to 404, or an entry that left the scope between the two reads. It retracts
nothing already observed; a later 404 does not un-HIT a HIT.

### 3. One sentence, or two branches?

**The presence premise: ONE sentence suffices.** "The key is present in this run's readable
Actions-cache scope by the time the probe runs, because the leg either RESTORED it from that scope
or SAVED it into that scope." True of both cases.

**The failure implication: one shared sentence plus two short branches.** The consequences differ in
KIND (invalidating a MISS vs. reporting read-path non-determinism), so no single consequence sentence
is honest for both. The shared core is: a non-200 means the read path could not produce a key this
run's own scope demonstrably holds. There is house precedent for exactly this shape 400 lines below,
at `:1456-1460`: `ON A CASE-B RUN THE DELTA IS HOURS OR DAYS ... That is CORRECT and needs no
allowance ... Do not "fix" it with an upper bound.` Model the correction on it.

### DRAFT REPLACEMENT PROSE for `:1003-1009`

Keep `:1001-1002` byte-identical (they are locked). ASCII only, `--` not em dash.

```
      # The poll proves REACHABILITY against a hash nothing creates; this probe proves the
      # service really round-tripped an entry THIS RUN'S OWN SCOPE HOLDS -- the leg either
      # RESTORED it from that scope or SAVED it into that scope, and both routes end in the
      # same place because the GET resolves through an UNCONDITIONAL cache.restoreCache
      # (actions-cache-backend.ts:219-225) that is not save-conditioned.
      #   THE DISJUNCTION IS MEASURED, not defensive: on runs 30907575624 and 30910935382
      # all four integration legs took a remote-cache HIT and saved NOTHING, and all four
      # controls returned 200. This comment previously said "the entry this leg's own task
      # just saved", which those runs falsify.
      #   A NON-200 SAYS DIFFERENT THINGS AT ITS TWO CODES. 000 is the sidecar not
      # answering at all (see the `|| true` paragraph below). A 404 means the sidecar DID
      # answer -- 404 is the readiness poll's own proof-of-life signature -- so the fault is
      # downstream of the HTTP layer: server.ts degrades EVERY backend fault to a 404 MISS
      # (SRV-05, handleGet's catch), which makes a broken read path indistinguishable from a
      # genuine absence at this boundary. That degradation is the reason this control exists.
      #   THE CONSEQUENCE DEPENDS ON THE LEG'S OUTCOME, and both branches are stated because
      # which one applies is a property of the run, not of this file.
      #   * On a MISS-then-save leg -- the load-bearing case -- a read path that cannot
      #     produce a key this run just wrote could equally have MANUFACTURED the MISS: a
      #     token-less sidecar degrades to the EMPTY in-memory backend
      #     (select-backend.ts:68) and 404s everything. The MISS observation is INADMISSIBLE.
      #   * On a HIT leg the leg's own remote-cache-hit already proved the round-trip through
      #     this same sidecar process, so a 404 retracts nothing; it reports NON-DETERMINISM
      #     in the read path inside one job. REDUNDANT as a liveness proof, not meaningless:
      #     cacheStatus is RECORDED and never GATED, so this step is the only thing in the
      #     job that FAILS on a broken read path.
      # Two probes, two acceptance sets, two questions -- collapsing them into one helper
      # with the looser set would leave both steps green while destroying the control, so do
      # not reuse the poll's deadbeef hash here either.
```

Clause coverage: paragraph 1 = both cases (presence). Paragraph 2 = provenance. Paragraph 3 = both
cases (mechanism). Bullet 1 = Case A only. Bullet 2 = Case B only.

### 4. Value on a Case-B run: REDUNDANT, not meaningless -- and the distinction is precise

Redundant as a liveness proof: the leg's own HIT already exercised sidecar + backend + service for
that exact key. Not meaningless, for three reasons, in increasing strength:

1. The leg's outcome is a property of the run. The step cannot be conditioned on a case it cannot
   know in advance, so it must be correct in both.
2. It is a second, OUT-OF-BAND observation. Its failure reports read-path non-determinism, which the
   in-band Nx read structurally cannot report.
3. **`cacheStatus` is RECORDED and never GATED** (`read-integration-hash.mjs:134`, `:141-142`;
   `ci.yml:998` does the same for the label count). This control HARD-GATES (`exit 1`). On a Case-B
   run it is therefore the ONLY thing in the job that turns a broken read path red. The redundancy
   is observational; the ENFORCEMENT is not redundant at all.

The corrected prose must say "redundant as a liveness proof" and must NOT say "redundant".

**Consequence for the plan:** Q1's BLOCKER is cleared. Correct BOTH halves -- and the
failure-implication half needs its own site list (`:1005-1006` and `:1030-1031`), not just a
rewrite of one sentence.

---

## Q2 -- the comment lock. VERDICT: ADD ONE, but as phrases on the EXISTING row D

### Shape of `docs-same-os-claims.spec.ts`: row/table-driven, and a lock is cheap

`DOCS_08_SITES` (`:91-573`) is a `const` array of `{ file, bucket, required[], forbidden[] }` rows,
iterated at `:615-642` -- one `it()` per `required` phrase (`toContain`) and one per `forbidden`
pattern. Adding a lock is one array entry, or one string in an existing entry. Mechanically trivial.

The real cost is the DOCSTRING: every one of the 18 rows carries a 6-30 line rationale, and the
file's own rules constrain the phrase -- it must fit on ONE line of the target file (`:62-66`, a rule
that has already cost a red), and `forbidden` should stay EMPTY here because an absence check on the
old wording is satisfied by deleting the whole comment (`:186-191`, `:333-339`, `:438-440`), and
because a correction-history paragraph legitimately quotes its own superseded wording.

### The finding that decides it: row D IS this step's lock, and its docstring carries the defect

`:514-543` is "Phase 11 row D -- the positive control's ACCEPTANCE SET (D-16)". Its docstring at
`:521-522` reads: *"the positive control on the leg's own just-saved key accepts 200 ALONE, because a
404 there means a dead sidecar masqueraded as a cache MISS."* That is a sixth site of the presence
defect AND a third site of the failure-implication defect, in a LIVE guard file.

Its two pinned phrases are at `ci.yml:1001-1002`, both untouched by the correction. So row D locked
the acceptance SET and left the REASONS unguarded -- which is exactly how this drifted.

### RECOMMENDATION: yes, add a lock. Two phrases on row D. No new row.

Reasoning, weighed as asked:
- The `260803-0rr` precedent does NOT transfer. It declined a guard on THIRD-PARTY behaviour that
  would redden on an unrelated bump. This subject is our own prose in a file that is already a
  declared `test` input; it reddens only when someone edits the claim, which is the point.
- The drift argument is decisive here in a way it usually is not: this block is the ONLY thing
  standing between a reader and collapsing the two probes, row D's own docstring says so at
  `:524-528`, and the prose still drifted because row D pinned the wrong two lines.
- A new row would need its own 20-line docstring and would fragment one step's lock across two rows.
  Row D already owns this step. Extend it.

**Phrases to pin** (both must be authored to sit within one ci.yml line):

1. `UNCONDITIONAL cache.restoreCache` -- pins the MECHANISM that makes the premise a disjunction.
   Renarrowing the premise to "just saved" requires deleting it. This is the invariant's cause, and
   it survives any legitimate rewording that stays true.
2. `404 means the sidecar DID answer` -- pins the failure-attribution correction. Restoring "a 404
   means a dead sidecar" requires deleting it.

Do NOT pin the disjunction's wording itself ("restored or saved") -- it is short, generic, and the
kind of phrasing that gets legitimately reworded. Pin the cause and the code discrimination.
`forbidden: []`, for the file's own recorded reason.

Row D's docstring must be corrected in the SAME commit -- it is a site, not just a lock.

---

## Q3 -- the fork-PR conclusion at `:1013-1027`. VERDICT: CONFIRMED, strengthens, does not disturb

Widening adds a second, INDEPENDENTLY SUFFICIENT route to presence that does not depend on write
permission at all. A fork PR that HITS restored the entry from a readable scope; reads from the
default branch's scope are not what GitHub's restriction limits. So:

- The original disjunct (a fork PR still CREATES its cache in the merge ref, `:1017-1021`) is
  UNCHANGED and still carries Case A.
- The new disjunct carries Case B with no reliance on the citation whatsoever.
- The 200-only acceptance set is untouched, because the MEANING of a non-200 does not change.
- The `IF A FORK PR EVER DOES REDDEN HERE` escape hatch at `:1028-1031` must STAY. Widening reduces
  the citation exposure (fork runs that HIT no longer need it) but does not eliminate it: a fork PR
  that MISSES still rests entirely on the cited, never-reproduced fork-write behaviour.

Do not overclaim this as "the fork question is closed". It is: two independent legs where there was
one. `:1030-1031`'s own "dead sidecar masquerading as a cache MISS" needs the Q1 treatment too.

---

## The five sites: four are the same claim, `:1040` is genuinely different

| Site | Same claim? | Treatment |
|---|---|---|
| `:1004` | The primary claim | Full rewrite (draft above) |
| `:1022` | Same claim, QUOTED inside the fork argument | Swap the quoted premise; add the no-write-needed strengthening |
| `:1033` | Same claim, load-bearing for the no-retry conclusion | Swap + one addition (below) |
| `:210` | Same substance, different job, and it sits INSIDE a `CORRECTED.` history paragraph | Short widening. Must not erase the correction record |
| `:1040` | **NO -- subtly different** | Needs a new REASON, not a phrase swap (below) |

### `:1033` no-retry-loop: conclusion HOLDS, and Case B strengthens it

Widened premise: the key is known-present in this run's own scope, restored or saved -- so a retry
could only paper over a real failure. Unchanged. And the naive objection ("Case-B faults are
transient, so retry") inverts: a transient fault that a retry hides IS the read-path non-determinism
this control exists to surface. Say that explicitly, or a future reader adds the retry.

### `:1040` placement: conclusion HOLDS, stated reason is FALSE for Case B, replace the reason

The brief is right: on Case B the key is present BEFORE the Nx run, so "it is that task's own save
that makes the key present" cannot justify the placement. Two reasons survive, and the stronger one
does not depend on the presence premise at all:

1. **Mechanical, premise-independent:** `own_hash` comes from `cat integration-hash.txt` (`:1061`),
   written by the run.json reader step (`:955-959`), which requires the Nx run to have produced
   `.nx/cache/run.json`. The step's INPUT does not exist before the Nx run. Lead with this.
2. **Case-A specific:** on a MISS-then-save leg the save is what makes the key present, so an
   earlier placement would 404 on every Case-A run -- breaking the control exactly where it is
   load-bearing.

On a Case-B leg the placement is merely harmless. The `BEFORE cancel: cache-server` half is
untouched by the widening (`cancel:` confirmed at `:1068`).

---

## Everything else in the tree that repeats the premise

**LIVE, needs the edit (1 file outside ci.yml):** `docs-same-os-claims.spec.ts:522`.

**LIVE and ALREADY CORRECT -- no edit, and worth recording:** `REQUIREMENTS.md:590-591` and
`ROADMAP.md:487` both say `a scripted authed GET on a known-present key`, attributing NOTHING about
how the key became present. **XOS-03 never asserted the narrow premise.** It was narrowed at
implementation time, in `11-06-PLAN.md:271,279` and `11-PATTERNS.md:269-270`, then into ci.yml. The
correction restores the requirement's own wording rather than changing it.

**SEALED -- do NOT propose edits:** `11-PATTERNS.md:269-270`, `11-06-PLAN.md:271,279`,
`11-07-PLAN.md:92`, `11-CONTEXT.md:222`, `11-EVIDENCE.md:875`, `11-REVIEW.md:518`,
`11-RESEARCH.md:389`, `research/v0.0.2/ARCHITECTURE.md:520-521`, `research/v0.0.2/SUMMARY.md:133`,
and h3b's own quick artifacts (which correctly QUOTE the defect). `STATE.md:454` records the defect
as found -- correct as written. This follows h3b's own scope boundary (`h3b-EVIDENCE.md:197-208`).

**One judgement call left for the plan, not closed here:** `11-PATTERNS.md` is a phase artifact by
location but GSD planners read PATTERNS files for enrichment, so it is arguably semi-live. h3b's
precedent says freeze it. If provenance is wanted, the ci.yml correction can name it in passing.

---

## EXPLICITLY OPEN

1. **The control's FAIL direction has never been observed.** There is no 404 on record from this
   step. `404 means the sidecar answered` is derived from the code and is airtight; `the MISS
   observation is INADMISSIBLE` is an evidentiary judgement that has never been exercised. The
   corrected prose is reasoning, like the prose it replaces -- do not present it as measured. Only
   the presence disjunction is measured (four leg-observations, two runs).
2. **Fork PR behaviour remains CITED, never reproduced.** Unchanged by this task. The `:1028-1031`
   escape hatch stays.

## Consequence for the plan, in one list

- Correct 7 ci.yml locations, not 5: add `:1005-1006` and `:1030-1031` (the failure-implication
  defect is a separate defect with its own sites).
- Correct `docs-same-os-claims.spec.ts:522`'s docstring, same commit.
- Add 2 `required` phrases to row D. No new row. `forbidden: []`.
- `:1040` gets a NEW reason (the input-does-not-exist-yet one), not a phrase swap.
- `:1033` gains the retry-hides-non-determinism sentence.
- The edit zone contains no locked phrase; `:1001-1002` must stay byte-identical.
- Two `test` inputs rotate (ci.yml and the spec). Expected, already decided.
