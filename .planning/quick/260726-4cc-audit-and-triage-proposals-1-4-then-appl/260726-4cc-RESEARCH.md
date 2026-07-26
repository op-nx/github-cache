# Quick Task 260726-4cc: Audit and triage Proposals 1-4 - Research

**Researched:** 2026-07-26
**Mode:** READ-ONLY. No source, doc, or test was modified.
**Settles:** both UNRESOLVED items in `260726-4cc-CONTEXT.md`.

---

## Q1 VERDICT: HIGH confidence -- dedup is SAFE, and NO gate adjustment is needed

**The gate condition is mathematically EQUIVALENT before and after dedup.** It does not widen,
it does not narrow, and there is no input shape where dedup makes it miss a genuine total
regression. Proposal 2 may be applied with the gate left exactly as written.

### The load-bearing fact: the restore outcome is a pure function of the hash

`publish-mirror.ts:182` calls `actionsCache.get(hash)`. That resolves to
`backend/actions-cache-backend.ts:45-46`:

    const path = cacheArchivePath(hash);
    const matched = await cache.restoreCache([path], cacheKeyFor(hash));

Both arguments are derived from `hash` alone. **The engine never sees, passes, or branches on the
`version` field.** `listCacheEntries` (`action/index.ts:37-50`) maps each API row to `{ key }`
only -- `version` is discarded before the engine is reached. So two rows sharing a key are, from
the loop's perspective, byte-identical inputs producing byte-identical outcomes.

Consequence: for a hash `h` appearing `m_h` times in `hashes`, all `m_h` iterations return the
SAME `restored.kind`. `readMisses` therefore increments either `0` or `m_h` times for `h` -- never
a partial count. **`readMisses` and `hashes.length` are the same weighted sum over the same
multiplicity vector.** That is why the equality is multiplicity-invariant.

This is confirmed by the measured run itself (debug E3): ubuntu logged **36 hits across 24
distinct keys** -- the 12 dual-version keys each hit TWICE. Duplicates do not degrade on the
second lookup; they repeat the first result exactly.

### The proof

Let `D` = distinct hashes, `m_h >= 1` the multiplicity of `h`, `M` the subset of `D` that MISSes.

| | today | after dedup |
|---|---|---|
| `readMisses` | `sum over M of m_h` | `size of M` |
| `hashes.length` | `sum over D of m_h` (= `N`) | `size of D` |

- Today: `sum_M m_h == sum_D m_h` requires `M == D`, because every `m_h >= 1` (a strict subset
  drops at least 1 from the sum). So today's gate already means exactly "every DISTINCT hash
  missed" -- the row-multiplicity cancels.
- After dedup: `size of M == size of D` also requires `M == D`.
- `hashes.length > 0` and `size of D > 0` are equivalent (`N > 0` iff `D` is non-empty).
- `mirrored === 0` is dedup-invariant (see below).

**Both forms reduce to the identical predicate: `M == D` and nothing mirrored.** Reading (a) in
CONTEXT.md is directionally right but overstates the problem: today's gate is not merely
"more correct after dedup", it is *already* immune to double-counting. Reading (b) is ruled out:
`readMisses` and the denominator move together by construction, so the ratio cannot shift.

### Worked numeric example -- the measured ubuntu leg (37 rows / 25 distinct keys / 12 dual-version)

`D` = 25, twelve hashes with `m_h = 2`, thirteen with `m_h = 1`. `N = 12*2 + 13 = 37`.
Measured: 1 distinct hash MISSed (the Windows-only task hash, single-version), 24 hit.

| | today | after dedup |
|---|---|---|
| loop iterations | 37 | 25 |
| `hashes.length` (`scanned`) | 37 | 25 |
| `readMisses` | 1 | 1 |
| `mirrored` | 6 | 6 |
| gate `readMisses === hashes.length` | `1 === 37` -> false | `1 === 25` -> false |
| warning fires | NO | NO |

Same for the windows leg (12 misses, all on single-version rows): today `12 === 37` false;
deduped `12 === 25` false. Both legs: unchanged verdict.

**Now force a genuine total regression** on the same 25-key / 37-row population (the read scope
collapses, every lookup misses):

| | today | after dedup |
|---|---|---|
| `readMisses` | 37 (12 keys x 2 + 13 x 1) | 25 |
| `hashes.length` | 37 | 25 |
| gate | `37 === 37` -> **FIRES** | `25 === 25` -> **FIRES** |

The dangerous direction does not exist: a total regression misses every distinct hash, hence
every row, hence both forms fire.

### The hunt for a divergent input shape -- none found

- **Fires today, not after dedup?** Needs `sum_M m_h == N` with `M` a strict subset of `D`.
  Impossible while every `m_h >= 1`.
- **Fires after dedup, not today?** Needs `size of M == size of D` with `M != D`. Impossible.
- **A duplicated key that MISSes on all its rows** (e.g. one key saved twice on Linux under two
  compression methods, both invisible to the Windows leg -- so `m_h = 2` and `h` is in `M`):
  contributes 2 to both `readMisses` and `N` today, 1 to both after dedup. Equality preserved.
  This is the only shape where a duplicate row is a MISS, and it is still invariant.
- **`mirrored` is dedup-invariant.** For a duplicated HIT, iteration 1 uploads and runs
  `shard.names.add(name)` (line 236) BEFORE iteration 2 reaches line 228, so iteration 2 takes
  the already-present `skipped++` branch. A duplicate can never produce a second `mirrored++`.
  Dedup only removes that redundant skip.
- **Sole caveat, negligible: mid-run non-determinism.** If a duplicated hash HIT then MISSed
  (eviction between two lookups inside one run), today records `readMisses = 1` of `2` rows;
  dedup performs one lookup and records whatever that single lookup returns. The publish loop
  writes only to Releases, never to the Actions cache, so nothing in-process can flip an
  outcome. And the divergence, if it ever occurred, moves the gate toward *more* faithful
  reporting of the single lookup actually made. Not a safety concern.

### Second-order effects the executor must handle (not gate semantics, but real)

1. **`failed` magnitude, not its sign.** An oversized entry (line 202) or a per-item upload 5xx
   (line 251) on a dual-row hash counts `failed` TWICE today, once after dedup. The
   `failed > 0` -> `setFailed` gate (line 279) is unaffected; only the reported number shrinks.
   Same for the 422-race branch (line 244), which does NOT add to `shard.names`, so today a
   dual-row hash yields two 422 skips.
2. **The warning's own MESSAGE changes meaning.** `"all ${hashes.length} server-produced cache
   entr(y|ies)"` becomes a distinct-hash count, not a row count. That is an improvement, but the
   wording "entries" now means distinct keys -- worth one word of comment.
3. **CONTEXT.md's ordering constraint is confirmed correct and load-bearing.** Proposal 1 must
   land first so `scanned` exists and is tested before its denominator moves.
4. **`scanned` in the measured run would read 25, not 37, once proposal 2 lands.** Do NOT hardcode
   37 as the expected `scanned` in a test or doc line if proposal 2 is also applied.

### Data-quality warning on the numbers CONTEXT.md asks to preserve

The debug file's E4 mirrored/skipped pairs do NOT close arithmetically and must not be treated as
ground truth in a test or doc:

- ubuntu: 37 iterations, 36 hits, 1 miss, 6 mirrored -> `skipped` must be 31 (30 already-present
  + 1 miss). E4 says 32.
- windows: 37 iterations, 25 hits, 12 misses, 2 mirrored -> `skipped` must be 35 (23
  already-present + 12 misses). E4 says 24.
- CONTEXT.md's illustrative `scanned 37 / mirrored 2 / restore-MISS 12 / skipped 12 / failed 0`
  also does not close: `skipped` INCLUDES the misses (`publish-mirror.ts:185-186` increments
  BOTH), so 2 + 35 = 37, not 2 + 12 + 12.

**The row counts DO close and are the trustworthy measured figures:** 37 rows enumerated per leg;
ubuntu 36 hits / 1 miss; windows 25 hits / 12 misses; 25 distinct keys, 12 dual-version.

Direct implication for proposal 1: because `readMisses` is a SUBSET of `skipped`, the summary
must not present them as disjoint rows or every reader will double-count. Label it
`restore-MISS (of skipped)`, or add a one-line note. This is the single design decision proposal 1
most needs to get right.

---

## Q2 WIRING STATE: already correct -- no nx.json change required

**Target doc: `docs/advanced.md`.** It owns the `## Publish / sync and cleanup` section (lines
47-76) and carries 9 of the repo's publish mentions -- the only doc where the line belongs. The
per-OS shape sentence fits after line 54's description of what publish enumerates.

| question | answer | evidence |
|---|---|---|
| Does a guard spec read it? | **YES** | `docs-adoption.spec.ts:35` (existence), `:97` (mask check), `:122` (the F11 selectBackend block reads it) |
| Is it already an nx `test` input? | **YES** | `nx.json` `targetDefaults.test.inputs` lists `{workspaceRoot}/docs/advanced.md` |
| T-06-03-02 stale-cache hazard? | **NO** | the spec's own header comment (`docs-adoption.spec.ts:16-20`) documents the wiring as the 06-02/06-03 precedent already applied |

All four `docs/*.md` files, `README.md`, and both `docs/examples/*` are already inputs. Any of
them is a safe target.

**Can the added line break a docs spec? No.** Every assertion against `advanced.md` is a presence
token (`toContain`) or a loose regex (`toMatch(/throws?/i)`, `/permanent MISS/i`) -- never
exhaustive prose, by explicit design (`docs-adoption.spec.ts:12-13`: "asserts stable topic
TOKENS (presence), never full prose"). Only two things could trip: introducing the literal
`NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` alongside `GITHUB_ENV` without an `::add-mask::`
(`:101-113`), and that is irrelevant to this line.

**Proposal 4's target has no wiring at all.** `git grep PITFALLS -- packages/github-cache/ nx.json`
returns nothing: `.planning/research/PITFALLS.md` is read by no spec and is not an nx input.
Editing it cannot break or false-pass a test, and needs no cache-bust.

---

## Q3 TEST-SAFETY: NOT additive-safe -- 8 exhaustive assertions will break (this is the RED)

**`PublishResult` is confirmed OUTSIDE the DOCS-05 public surface.** Verified independently:
`packages/github-cache/src/index.ts` exports `createCacheServer` plus a type block of
`CacheBackend | GetHit | GetResult | PutResult | ReadableBackend | WritableBackend`. No
`PublishResult`, no re-export of `publish/publish-mirror.js`. (Minor correction to CONTEXT.md
line 51: the type block is SIX types, not four. The load-bearing claim -- `PublishResult` absent
-- holds.) Adding fields is not a consumer-contract change.

**Eight exhaustive `toEqual` assertions in `publish-mirror.spec.ts` WILL fail** the moment
`PublishResult` grows a field, because `toEqual` on an object literal is exact-shape:

    :112  toEqual({ mirrored: 1, skipped: 0, failed: 0 })
    :142  toEqual({ mirrored: 0, skipped: 1, failed: 0 })
    :158  toEqual({ mirrored: 0, skipped: 1, failed: 0 })
    :171  toEqual({ mirrored: 0, skipped: 1, failed: 0 })
    :246  toEqual({ mirrored: 1, skipped: 0, failed: 1 })
    :312  toEqual({ mirrored: 1, skipped: 0, failed: 0 })
    :316  toEqual({ mirrored: 0, skipped: 1, failed: 0 })
    :376  toEqual({ mirrored: 0, skipped: 1, failed: 0 })

This is GOOD news for the TDD gate: it is a free, genuine RED across the whole branch matrix.
Each is a single-entry (or two-entry) fixture, so the correct `scanned`/`readMisses` values are
obvious per case (`scanned: 1` for the `client()` default; the MISS cases get `readMisses: 1`).
Do NOT relax these to `toMatchObject` -- exact-shape is what makes them a drift detector.

The `result.mirrored`-only assertions (`:87 :189 :212 :331 :351`) are additive-safe and need no
edit.

**No spec asserts the publish summary's ROW SET.** `action/index.spec.ts` stubs
`core.summary.addTable` (`:18`) but never inspects its argument -- there is no publish-side
equivalent of `cleanup.spec.ts:267-268`, which does assert `addTable` rows. So adding two rows in
`action/index.ts:156-160` breaks nothing, and is also **currently untested** -- meaning proposal 1
has no automated coverage of the row set at all. If the executor wants a RED for the summary half
of proposal 1, it must add that assertion (`cleanup.spec.ts:267-268` is the working precedent).

**No existing spec exercises duplicate keys**, so proposal 2 has no incidental coverage either.
Its RED is a new `listCacheEntries` fixture returning the same key twice, asserting `getMock` is
called ONCE. Note `beforeEach` sets `getMock.mockResolvedValue(...)` -- a single value for all
calls -- which conveniently matches the real "pure function of hash" invariant.

---

## Q4 PER-PROPOSAL TRIAGE

### Proposal 1 -- Report `scanned` and `readMisses`. APPLY (highest value)

Worth doing: this is the whole actionable output of the investigation. It converts the exact
ambiguity that cost a full debug session ("nothing to mirror" vs "read scope regressed") into two
numbers on the job summary, and it needs no new logic -- `readMisses` already exists at line 175.
What could go wrong: presenting `readMisses` as if it were disjoint from `skipped` (it is a strict
subset -- line 185-186 increments both), which would make the summary sum to more than `scanned`
and mislead the next reader. Smallest correct implementation: two `readonly` fields on
`PublishResult`, `scanned: hashes.length` in the return at line 283, two rows in
`action/index.ts:156-160` with the miss row labelled as a subset of skipped, update the 8
`toEqual`s, and add one `addTable`-row assertion in `action/index.spec.ts` per the
`cleanup.spec.ts:267-268` precedent.

### Proposal 2 -- Dedup `hashes`. APPLY (Q1 settles it; gate unchanged)

Worth doing, though it is efficiency and clarity, not correctness. In the measured run it removes
12 redundant Actions-cache round-trips per leg (37 lookups -> 25) and stops `skipped` being
inflated by duplicate already-present hits, which makes the proposal-1 numbers actually readable.
Q1 establishes with HIGH confidence that the all-miss gate is unaffected. What could go wrong:
landing it BEFORE proposal 1 (the bisect midpoint would have a silently redefined `scanned`) --
CONTEXT.md's ordering constraint prevents this and is confirmed correct; and forgetting that
`scanned` now means distinct hashes, not enumerated rows, in any doc or test wording. Smallest
correct implementation: `[...new Set(...)]` around the existing `.map().filter()` chain at
`publish-mirror.ts:162-168`, plus a one-line comment recording WHY it is safe (the outcome is a
pure function of the hash, so multiplicity cancels out of the gate) -- that comment is the part
that stops a future reader re-litigating this. Add the duplicate-key spec described in Q3.

### Proposal 3 -- Document the expected per-OS shape. APPLY

Worth doing and nearly free. The asymmetry is permanently confusing without it -- the debug file
exists precisely because nobody could tell 4-linux/1-windows from a bug. Q2 confirms
`docs/advanced.md` is already an nx `test` input, so there is no false-pass hazard and no
`nx.json` edit. What could go wrong: nothing mechanical; the only risk is over-claiming, e.g.
stating each leg's count "equals that OS's cacheable-task count" as an invariant, when the leg
also mirrors run-id seed keys and fixture `cafe*` keys (debug E4: the 4/1 task-hash split sits
inside a 6/2 total mirror). Smallest correct implementation: two sentences in the
`## Publish / sync and cleanup` section stating that restore is same-OS so each leg can only
mirror what actually RAN on that OS, and that a per-OS asset-count asymmetry is therefore the
expected shape -- scoped to task-hash assets, not the total.

### Proposal 4 -- Update PITFALLS Pitfall 7. APPLY

Worth doing. Both corrections were verified in the investigation and re-verified here
(`git grep uploadHash -- packages/` returns nothing). A MUST-NOT-REOPEN pitfall whose stated
mechanism is wrong is worse than useless: it points the next reader at compression when the
actual discriminators are `tmpdir()` in the literal archive path and the `windows-only` salt. What
could go wrong: the real risk is weakening the invariant while fixing the prose. Pitfall 7's job
is to stop anyone re-enabling `enableCrossOsArchive` or collapsing the OS matrix; the compression
clause was one of three supporting reasons, and deleting it outright could read as "cross-OS is
fine now". Smallest correct implementation: reword the clause to record that zstd is now on BOTH
legs so compression is no longer a discriminator -- explicitly noting the version is STILL
OS-distinct via the other two factors -- and swap the `uploadHash` reference for
`publish-mirror.ts:184-189`'s `restored.kind === 'miss'` branch. Keep every MUST-NOT sentence
verbatim. No nx wiring needed (Q2).

---

## APPLY / DROP RECOMMENDATION

| # | Proposal | Verdict | Confidence | Notes |
|---|---|---|---|---|
| 1 | `scanned` + `readMisses` in the OBS-01 summary | **APPLY** | HIGH | Lands FIRST. 8 `toEqual`s in `publish-mirror.spec.ts` are the free RED. Summary row set is currently unasserted -- add one. Label `readMisses` as a SUBSET of `skipped`. |
| 2 | Dedup `hashes` before the restore loop | **APPLY, gate UNCHANGED** | HIGH | Q1 proves the all-miss gate is equivalent: the restore outcome is a pure function of the hash, so multiplicity cancels from both sides. Lands SECOND. Needs a new duplicate-key spec + a WHY comment. |
| 3 | Document the per-OS shape in `docs/advanced.md` | **APPLY** | HIGH | Already an nx `test` input; docs specs are presence-only. Scope the claim to task-hash assets. |
| 4 | Update PITFALLS Pitfall 7 (zstd clause + `uploadHash`) | **APPLY** | HIGH | No spec reads PITFALLS, no nx wiring. Fix the explanation without softening any MUST-NOT. |

Nothing is dropped. All four earn their keep, and the one item that was genuinely at risk
(proposal 2) is cleared by a proof rather than by assumption.

**Carry-forward for the executor, beyond the proposals:** the debug file's E4 mirrored/skipped
pairs and CONTEXT.md's illustrative summary line are arithmetically inconsistent with the code
(`skipped` includes `readMisses`). Use the ROW counts (37 / 36+1 / 25+12 / 25 distinct / 12
dual-version) as ground truth and do not copy the mirrored/skipped pairs into a test or doc.
