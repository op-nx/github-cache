# Phase 10 SC6 -- recorded, not gated

**Status:** RECORDED. Nothing in this file is a test, nothing in it gates the phase, and nothing
in it blocks a merge. Its whole purpose is that v0.0.3 does not re-derive these facts or -- worse
-- act on the uncorrected version of the first one.
**Written:** 2026-07-29, plan 10-08.
**Source of the criterion:** ROADMAP Phase 10 success criterion 6.

Two facts (D-26a, D-26b), a prediction recorded IN ADVANCE with its own falsifier, and the
consolidated Live-CI close register.

---

## 1. D-26(a) -- the Windows publish leg's mirroring, with both research corrections applied

### The claim, as ROADMAP and CONTEXT D-26(a) state it

> After this phase the Windows publish leg mirrors ZERO real assets: under one name per hash,
> `max-parallel: 1` runs ubuntu first, ubuntu uploads every hash it can restore, and the Windows
> leg finds every name already present and takes the benign no-op `skipped` branch.

That is the version written into ROADMAP SC6 and CONTEXT D-26(a). **It is wrong in two specific
ways**, both measured by 10-RESEARCH.md correction C-1. Both corrections are mandatory, and both
are labelled as corrections below so a reader cannot pick up the uncorrected sentence by accident.

### CORRECTION 1 -- it depends on XOS-07's widened `needs:`, NOT on the rename alone

**MEASURED on run `30400231720`:** the ubuntu publish leg enumerated the Actions cache at
~`21:21:11Z`, while the Windows `integration` leg did not finish until ~`21:23:13Z` -- roughly two
minutes LATER. So ubuntu's enumeration snapshot did not contain the Windows `integration` entry at
all. The shard census carries the fingerprint: task hash **`8059758544828235640`** exists ONLY
under a `-windows` suffix, never under `-linux`.

**Consequence.** Under CORR-02 alone -- the rename, with the old narrow `needs: [build]` -- the
Windows leg would remain the SOLE mirrorer of the Windows `integration` hash. It would mirror ONE
real task asset, not zero. The claim becomes true only once XOS-07 widens `needs:` so `publish`
starts after `integration` completes. That widening landed in plan 10-03; `publish`'s `needs:` now
reads `[build, typecheck, test, integration]`.

**State this plainly, because the failure mode is a wrong decision rather than a wrong number:**
without the dependency named, v0.0.3 reads D-26(a) as a consequence of the RENAME and concludes the
matrix is collapsible on the strength of a property that actually rests on a `needs:` list. And
reverting that `needs:` list silently restores the one-real-asset case -- 10-03's own record notes
there is no guard on the `needs:` value's breadth beyond the one it added, so nothing reddens.

### CORRECTION 2 -- "ZERO assets" is false; "zero REAL TASK assets" is true

After OBS-05 the Windows leg mirrors **exactly ONE asset: its own publish seed**
(`nx-cache-<seed_windows>`, the `mirror-seed` operation's derived key). And that one asset is
precisely what makes OBS-05 non-vacuous -- it is the artifact `publish-verify (windows-11-arm)`
reads back to prove the Windows publish path is not dead.

Two consequences, both recorded because each is independently easy to get wrong:

**(a) The predicted count is `1`, not `0`, and the all-restore-MISS warning will NOT fire.**
`publish (windows)`'s OBS-01 job summary will report `mirrored: 1`. The engine's warning branch
requires `mirrored === 0` (together with `readMisses === hashes.length`), so a `mirrored` of 1 keeps
it silent. **A `0` here is the failure, not the success.** Anyone writing the expected signal down
as `0` inverts the check.

**(b) THE DEFERRED SINGLE-LEG MATRIX COLLAPSE WOULD DESTROY OBS-05.** Both halves of this argument
sit here side by side, deliberately, because a reader who finds only the first half will collapse
the matrix:

| Half | The argument |
|------|--------------|
| **FOR the collapse** (CONTEXT's `<deferred>` framing) | The Windows leg mirrors zero real task assets, so a second publish leg buys nothing. D-26(a) is named there as *the strongest argument for it*. |
| **AGAINST the collapse** (this correction) | The only thing the Windows leg publishes IS the artifact OBS-05 exists to check. Remove the leg and OBS-05's dead-Windows-publish detection has nothing to read back. So D-26(a) is now ALSO the strongest argument that the collapse cannot happen **without re-pricing OBS-05**. |

The two halves are the same fact read in two directions. Recording only the first is how a
correct-sounding simplification silently deletes a guard.

### The SECOND standing reason the collapse stays deferred

Independent of OBS-05, and it does not expire when a proof lands: **the Windows leg is still the
only leg that produces Windows-hash entries at all**, because CORR-04's platform discriminator keeps
those task hashes distinct from the Linux ones. A collapsed single-leg matrix would stop producing
them.

That distinction matters for how each reason ages. REQUIREMENTS' Out of Scope makes the collapse
safe only after XOS-05 is proven (Phase 12), so the OBS-05 objection is answerable in principle --
by re-pricing OBS-05 with a different artifact. The producer objection is not answerable that way:
it is a property of the discriminator, not of the proof state.

---

## 2. D-26(b) -- the Phase 9-to-10 window doubled shard growth

**The fact.** Between Phase 9's VER-01/VER-03 landing and CORR-02's rename landing, every
restorable hash was mirrored TWICE -- once under `-linux` by the ubuntu leg and once under
`-windows` by the Windows leg -- because each leg could restore all of them but wrote under its own
OS suffix. **Bounded, and NOT a correctness bug:** the duplicate pair is byte-identical, the
1000-asset cap is per-shard and degrades to skip-and-warn rather than a hard failure, and retention
prunes shards past the window.

**Its record, cited by SHARD TAG.** `10-EVIDENCE-PRE-RENAME.md`'s RETAIN-05(a) census, scoped to
shard **`cache-mirror-202607`** (release id `354838660`, measured 2026-07-29, re-taken with no
delta from the research figure): **122 assets total** of a 1000-asset per-shard cap, comprising 50
PoC-era `<hash>.tar.gz`, **46 `<hash>-linux`, 26 `<hash>-windows`**, 0 `<hash>-macos`, 0 anything
else. The **46 + 26 = 72** OS-suffixed assets are that window's measured record.

The shard tag is named beside every number on purpose: `cache-mirror-202607` rolls over
2026-08-01, after which nothing new is written to it and a bare count is unattributable.

**The `ci.yml` estimate has now been corrected THREE times, and the note and that comment must
agree.** The correction history is recorded in `ci.yml`'s `publish` job comment itself: (1) it first
read ~5 real assets per push, because each leg could restore only its own OS's saves; (2) Phase 9
raised it UPWARD to ~10, which is this window; (3) CORR-02 brought it back DOWN to ~5, because the
suffix is gone and a hash is mirrored once no matter how many legs restore it.

**One drift in that comment was found and fixed while writing this note** (plan 10-08, recorded as
a deviation): its Windows-leg carve-out still explained the nonzero `mirrored` by *"its own
`integration` hash, which ubuntu's enumeration snapshot predates"*, citing run `30400231720`. That
is the PRE-XOS-07 state -- correct when measured, stale once `needs:` was widened in 10-03. The
comment now says zero REAL TASK assets plus one seed, names the `needs:` dependency as the thing
that makes it true, keeps the run `30400231720` measurement as the evidence for the pre-widening
case, and points at this file for the both-halves collapse record. **The comment and this note now
state the same thing.**

---

## 3. The predicted signal for the first post-rename default-branch push

Recorded IN ADVANCE so the observation is a test of a prediction rather than a rationalisation
written after the fact.

**The mechanism.** CORR-02 rotates the ASSET NAME, not the `@actions/cache` cache VERSION. Restores
still HIT; only the Release asset names are new. So the ubuntu leg finds every name absent from the
shard and uploads the full restorable set.

**The prediction.**

| Leg | `scanned` | `mirrored` | `readMisses` | Warning |
|-----|-----------|-----------|--------------|---------|
| `publish (ubuntu-24.04-arm)` | unchanged from prior pushes | roughly the FULL restorable set (~5 real task hashes plus its own seed and the run-id seed) | **0** | none |
| `publish (windows-11-arm)` | unchanged | **1** -- its own seed, zero real task assets (see section 1) | 0 | none (requires `mirrored === 0`) |

**THE FALSIFIER, stated explicitly.** If the ubuntu leg reports **`mirrored: 0` with `readMisses`
equal to `scanned`**, this prediction is **WRONG** and must be recorded as FALSIFIED rather than
explained away. That signal would mean the restores themselves are missing -- a cache-VERSION
problem, not a naming one -- and it would point at the `@actions/cache` version axis rather than at
CORR-02. A second falsifier for the Windows leg: `mirrored: 0` there means its seed never published,
which is OBS-05's failure case, not a benign no-op.

**THIS CONTRADICTS THE ROADMAP, and the contradiction is named rather than quietly resolved.**
ROADMAP's Phase 10 Live-CI close reads:

> Expect the first such push to publish nothing if it coincides with Phase 9's rotation window
> (OBS-04).

That expectation no longer holds, for two independent reasons:

1. **Phase 9's rotation window is SPENT.** It was sampled on run `30400231720`. A later all-HIT
   merge run cannot be cited as the rotation observation -- see the register below.
2. **Different mechanism.** CORR-02 rotates the asset NAME. OBS-04's tripwire and the engine's
   all-restore-MISS warning are both about the cache VERSION. A name rotation makes every name new
   (so `mirrored` goes UP, not to zero) while leaving every restore a HIT. Predicting "publishes
   nothing" conflates the two rotations.

So where ROADMAP says nothing publishes, this note predicts a full republish. **ROADMAP's Live-CI
close line is the document being contradicted**, and if the observation matches this note rather
than ROADMAP, that line should be corrected at Phase 11's planning rather than left to mislead a
third reader.

---

## 4. The consolidated Live-CI close register

One place a reader looks. Five rows: this phase's three, plus the two Phase 9 left open at its
merge. **No row here has a pre-merge acceptance check, and that is deliberate** -- `publish` and
`publish-verify` are both gated on `github.event_name == 'push'` against the default branch, so no
pull-request run samples any of them at any rate. Any check that COULD pass pre-merge would be
passing for the wrong reason.

| # | Item | Owning plan / phase | Requirement | What a real runner must show | Falsification condition |
|---|------|--------------------|-------------|------------------------------|------------------------|
| L1 | Per-leg own-asset read-back with its label | 10-05 (row D10) | OBS-05, OBS-03 | `publish-verify (windows-11-arm)` logs a `windows`-produced payload AND the label `mirrored-by: windows`; `publish-verify (ubuntu-24.04-arm)` logs `linux` for both. Plus `nx-cache-feed0<run_id>` and `nx-cache-feed2<run_id>` present in the current shard (which also closes 10-04's row D7). | Either leg reading back the OTHER leg's asset, or a `publish-verify` MISS on a leg whose `publish` reported success. A `publish (windows)` summary of `mirrored: 0` also falsifies it -- the seed never published. |
| L2 | Post-widening full-task-set mirror | 10-03 | XOS-07 | The `publish` job starts only AFTER `integration (windows-11-arm)` completes (compare run `30400231720`, where it started ~122 s earlier). Then a shard census in which no task hash appears under only one OS's production -- i.e. the Windows `integration` hash is mirrored by the ubuntu leg. | The `publish` job starting before `integration` finishes, or a census where a hash produced only on Windows is absent from the ubuntu leg's mirrored set. |
| L3 | Warm-mirror republish under the new name (**gates Phase 11**) | 10-07 | CORR-02 | The ubuntu leg's OBS-01 summary with a nonzero `mirrored`, `readMisses` at 0, and NO all-restore-MISS warning; a shard census showing `nx-cache-*` names present and the legacy OS-suffixed names no longer growing. | `mirrored: 0` with `readMisses` equal to `scanned` -- section 3's falsifier. Until L3 is observed, a local post-rename Nx-level MISS is NOT an XOS-02 regression; it is this precondition still open (10-01's record). |
| L4 | Cross-OS `dogfood-seed` / `dogfood-verify` pair | Phase 9 | VER-06 | `dogfood-verify (windows-11-arm)` a cache HIT on the ubuntu-seeded `nx-cache-<run_id>` with bytes matching a `linux`-produced payload -- the provenance claim, not merely a presence check. | A 404 MISS on the Windows leg (cross-OS restore dead, or the archive version still differs), or a HIT whose bytes do not match the `linux` payload. |
| L5 | OBS-04's one-time cache-version rotation signal | Phase 9 | OBS-04 | **ALREADY SPENT.** Sampled on run `30400231720`. | n/a -- see the note below. |

### L5 is SPENT, and that matters for what may be cited

Phase 9's rotation observation was a ONE-TIME signal and it has been taken (run `30400231720`).
**A later all-HIT merge run must NOT be cited as the rotation observation.** An all-HIT run after the
window has closed is evidence that the cache is warm, which is a different claim entirely -- citing
it as the rotation signal would credit a check that was never re-run. The row stays in this register
as a closed item precisely so a future reader does not go looking for it and settle for the nearest
green run.

### One observation deliberately NOT requested

Whether `!cancelled()` really does run `publish` past a FAILED dependency is falsifiable only by a
deliberate experiment (one push with a failing `test` leg). **It is not requested here.** The
bounded downside is written into the workflow comment: a skipped mirror, never a wrong artifact.

Likewise: **do NOT deliberately break the Windows publish path on `main` to demonstrate L1's
detection.** It is mutation-proven offline in plan 10-05. The live run is the confirming
observation, not the proof.

---

## Anti-requirement confirmed by reading

**No claim in this file argues cross-OS safety from publish-leg ordering.** Ordering appears twice
-- in section 1 (`max-parallel: 1` runs ubuntu first, which is why the Windows leg finds names
already present) and in L2 (job start order after the widened `needs:`) -- and in both places it
carries only a COUNT prediction or a CI guard's sensitivity. Neither is a correctness claim about
what a reader receives. Cross-OS sharing rests on CORR-05's target platform-agnosticism; that
distinction is comment-locked in the `max-parallel` retention comment and in the read-back control,
and it is not re-argued here.
