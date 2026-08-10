# Quick Task 260803-fcd: burned-name skip, then the nx-cache namespace - Research

**Researched:** 2026-08-03
**Domain:** GitHub Releases fault discrimination (Phase A) + a single-sourced literal rename (Phase B)
**Confidence:** HIGH on all three questions
**Labelling:** every claim below is tagged MEASURED (observed with a tool in this session or
recorded as a measurement in CONTEXT.md), DOCUMENTED (with the source), or INFERRED. An unlabelled
claim would be a defect.

## Summary

Three headline findings, one per question, plus one defect the research turned up that Phase A
cannot be written without knowing.

1. **Q1.** The rejection wording is UNDOCUMENTED by GitHub but INDEPENDENTLY CORROBORATED twice,
   byte-for-byte, from two unrelated public repositories roughly ten months apart. The narrowest
   robust guard is NOT a bare message substring: it is a `field == "tag_name"`-SCOPED entry lookup
   plus the substring `immutable release`. That combination is structurally incapable of matching
   the `pre_receive` decoy and fails CLOSED on every rewording.
2. **DEFECT that blocks the obvious Phase A implementation.** `faultReason(error).message` returns
   the FIRST `errors[]` entry carrying a message, and on the measured payload that is the
   `pre_receive` DECOY, not the `tag_name` entry. A guard written as
   `faultReason(error).message?.includes(...)` would never fire. The reader needs a field-scoped
   accessor, not a substring test against what it currently returns.
3. **Q2.** Zero second-inline violations in non-spec SOURCE - the one-home rule held. The rename's
   real hazard is the opposite of a red suite: two spec blocks go SILENTLY VACUOUS while staying
   green, because their negative fixtures (`cache-mirror-latest`, `cache-mirror-2026-07`, ...) would
   be rejected on a PREFIX mismatch instead of on the suffix-shape check they exist to test.
4. **Q3.** The tag name is NOT part of the consumer contract - `docs/versioning.md` names `shardTag`
   explicitly as out of contract. So no breaking-change note is owed. There IS a data-compatibility
   consequence (old shards become unreadable AND unprunable), which Phase C's manual delete
   mitigates in this repo.

**Primary recommendation:** Phase A's predicate is
`status == 422 && errors[] has an entry with field == "tag_name" whose message includes
"immutable release"`, composed at the single call site in `publish-mirror.ts` over a new
field-scoped accessor in `lib/octokit-fault-reason.ts`. Phase B is one source literal
(`retention.ts:52`) + a bundle regeneration + 6 spec files + 14 stale prose sites, and the
non-negotiable part is the two vacuity traps, not the red assertions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions - do not revisit

- **D1:** Order is A then B. The burn is perishable; Phase A must fire against a live subject.
- **D2:** Namespace reuse (`nx-cache-` shared with the Actions-cache key namespace) is deliberate.
  The collision objection is RETRACTED and must not be re-raised.
- **D3:** `CACHE_MIRROR_MAX_AGE_DAYS` is NOT renamed. Explicitly out of scope.
- **D4:** Phase B drifts the action bundle. Regenerate in the SAME commit, `npm run check:action`
  from the MAIN tree.
- **D5:** Two `main` windows. Window A expects `publish` GREEN with the skip warning and
  `publish-verify` RED - that is CORRECT, not a failure.
- **D6:** Phase C (deleting `cache-mirror-202607` and its 155 assets) waits for Window B green.

### Claude's Discretion

The internal shape of the Phase A guard (where the predicate lives, its exact substring, the
sentinel that stops per-entry retries) and the file-by-file disposition of the Phase B sweep.

### Deferred Ideas - OUT OF SCOPE

The immutable-releases-vs-monthly-sharding design incompatibility (debug BLOCKER D1) stays deferred
to a later milestone by maintainer decision.
</user_constraints>

## Q1 - Guard fragility for Phase A

### Q1.1 Is the rejection wording documented by GitHub?

**No. It is undocumented implementation detail.** Two independent doc surfaces were fetched and
searched this session:

- **DOCUMENTED** (`docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases`,
  fetched 2026-08-03): the page documents the BEHAVIOUR and never the API error text. Verbatim:

  > **Git tags cannot be moved**: Once an immutable release is published, its associated Git tag is
  > locked to a specific commit, cannot be changed, and cannot be deleted while the release exists.
  > If you delete the immutable release, you can delete the tag, but you cannot reuse the same tag
  > name.

  It also carries a resurrection-attack note that widens the burn beyond the repository:

  > Immutable releases include protection against repository resurrection attacks. Even if you
  > delete a repository and create a new one with the same name, you cannot reuse tags that were
  > associated with immutable releases in the original repository.

  **MEASURED:** the string `422`, the string `tag_name was used`, and any error wording are ABSENT
  from that page.

- **MEASURED** (`docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28`, fetched
  2026-08-03): `immutable` appears exactly twice, both times as a boolean RESPONSE FIELD in the
  release schema. No error message, no documented 422 reason for `POST /repos/{owner}/{repo}/releases`.

**Consequence:** string-matching this message is matching an undocumented vendor string. That is
accepted, because there is no alternative - **MEASURED (CONTEXT.md):** `code` is `custom` on all
three `errors[]` entries, and `custom`'s own documented meaning (quoted in
`octokit-fault-reason.ts:16-19`) is "refer to the message property to diagnose the error". GitHub
has provided no machine-readable discriminator, so the message is the only one available. The job
of the guard design is therefore to make the FAILURE MODE of a rewording safe, not to avoid the
string.

### Q1.2 Independent corroboration of the exact wording

This is the strongest available substitute for documentation. **MEASURED** via `gh search issues`
this session - two unrelated public repositories, neither connected to this project:

**Source 1 - `github-community-projects/ospo-reusable-workflows#83`** (a GitHub-community-owned
repo), reporting the payload from `revanite-io/pvtr-github-repo` Actions run `17922846291`,
approximately 2025-09. Verbatim from the issue body:

```
Validation Failed: {"resource":"Release","code":"custom","field":"pre_receive","message":"pre_receive Repository rule violations found\n\nCannot create ref due to creations being restricted.\n\n"}, {"resource":"Release","code":"custom","field":"tag_name","message":"tag_name was used by an immutable release"}, {"resource":"Release","code":"custom","message":"Published releases must have a valid tag"}
```

That is **byte-identical to CONTEXT.md's measured payload from run `30796967020`** - same three
entries, same order, same `code: custom` on all three, same `field` values, same message strings.
Two measurements, two repositories, ~10 months apart.

**Source 2 - `crewship-ai/crewship#894`**, `gh`-rendered form of the same rejection:

```
HTTP 422: Validation Failed
Cannot create ref due to creations being restricted.
tag_name was used by an immutable release
```

Its diagnosis independently reproduces this project's own: *"once an immutable release publishes tag
`nightly`, that tag name is burned forever, even after the release is deleted"*, and *"No repo-level
tag ruleset exists ... so the 'creations restricted' line is the immutability enforcement itself"* -
the same decoy CONTEXT.md measured four ways.

**INFERRED from the pair:** the wording is stable across repositories and across time, and the entry
ORDER (pre_receive first, tag_name second) is stable too. It is still not a contract.

### Q1.3 Other wordings for the same or an adjacent condition

| Endpoint / surface | Wording | Source | Usable as a discriminator? |
|---|---|---|---|
| `POST /repos/{o}/{r}/releases` (createRelease) | `tag_name was used by an immutable release`, with `field: "tag_name"` | MEASURED (CONTEXT run 30796967020) + MEASURED (ospo#83, crewship#894) | **YES - this is the one** |
| same call, companion entry | `pre_receive Repository rule violations found\n\nCannot create ref due to creations being restricted.\n\n`, with `field: "pre_receive"` | MEASURED (same three sources) | **NO - the decoy. Must stay fatal.** |
| same call, third entry | `Published releases must have a valid tag`, NO `field` | MEASURED (CONTEXT, ospo#83) | NO - downstream consequence, no `field` to scope on |
| `POST /repos/{o}/{r}/git/refs` (create tag ref) | `422 Reference update failed` | MEASURED (CONTEXT paired probe) | **NO - far less specific, names nothing** |
| `POST .../releases/{id}/assets` (upload) | `422 Cannot upload assets to an immutable release` | MEASURED (ospo#83 scenario 2) | Not needed by Phase A, but see below |

**Bonus finding, no action required.** The last row CLOSES a blind spot the debug file recorded as
unmeasurable: `publish-verify-422-empty-shard.md` `blind_spots` says *"the exact errors[].code
GitHub returns for an immutable-release upload is NOT measured ... the spec's `code: 'immutable'`
literal is illustrative, not measured."* The ospo issue supplies the upload-endpoint wording from a
third party. It does not change any code - the upload site already treats every
non-`already_exists` 422 as fatal, which is correct for this message - but a comment there citing
the real wording would retire the blind spot. Optional, and strictly Phase-A-adjacent.

### Q1.4 DEFECT - `faultReason().message` returns the DECOY, not the tag_name entry

**MEASURED** by reading `lib/octokit-fault-reason.ts:74-79`:

```ts
message:
  errors
    .map((entry) => stringOrUndefined((entry as { message?: unknown } | null)?.message))
    .find((message) => message !== undefined) ??
  stringOrUndefined(data?.message),
```

`.find()` returns the FIRST entry carrying a string message. **MEASURED:** on the payload, entry
[0] is the `pre_receive` entry and it HAS a message. Therefore:

- `faultReason(error).message` on the burned-name 422 evaluates to
  `"pre_receive Repository rule violations found\n\nCannot create ref due to creations being restricted.\n\n"`.
- A Phase A guard written the obvious way -
  `reason.message?.includes('immutable release')` - **WOULD NEVER FIRE.** It would fail closed (the
  job stays fatal), so it is not dangerous, but it would ship a guard that cannot work, and Window A
  would read as "the guard did not fire" rather than "the guard is wrong".
- Second-order: the existing FATAL log at `publish-mirror.ts:179-181` prints
  `message ${reason.message}` - so on a burned-name rejection it already prints the DECOY, not the
  authoritative entry. That is the string a future reader would take away from the job log.

This is why the guard must be a FIELD-SCOPED entry lookup rather than a test on
`faultReason`'s current output. `faultReason`'s `{code, message}` shape and its two existing call
sites (`cleanup.ts:156`, `publish-mirror.ts:410`) need no change - the addition is additive.

### Q1.5 Recommended guard - the narrowest match that is still robust

```
statusOf(error) === 422
  AND some entry e in error.response.data.errors where
        e.field === 'tag_name'
    AND typeof e.message === 'string'
    AND e.message.includes('immutable release')
```

**Substring: `immutable release`** (case-sensitive, exactly as measured; 17 chars, two words, one
space).

Why that substring and not a neighbour:

| Candidate | Verdict |
|---|---|
| `was used by an immutable release` | Rejected. Maximally specific but buys NOTHING once `field === 'tag_name'` scopes the lookup, and breaks on any tense or voice change (`has already been used by`, `was previously used by`, `is reserved by`). |
| **`immutable release`** | **Recommended.** The load-bearing noun phrase. Survives every plausible rewording of the surrounding sentence while remaining unique to the immutability rejection. |
| `immutable` | Rejected. Would also match a hypothetical future `tag_name`-scoped message about immutability that is NOT a burn (for example a forward-looking warning). Buys no rewording tolerance the two-word phrase lacks. |

**Where the code lives (INFERRED design call, discretionary):** add a generic field-scoped accessor
to `lib/octokit-fault-reason.ts` - that file's own doctrine is *"One body reader per fault class,
shared by every call site of that class"* (`octokit-fault-reason.ts:11-12`), and a
`(error, field) -> message | undefined` reader is exactly that class. Compose the
`immutable release` substring test at the single call site in `publish-mirror.ts`. Do NOT put a
`isBurnedTagName()` helper in the lib leaf: there is exactly ONE call site, and a
publisher-specific predicate in a generic reader is an abstraction with one consumer.

### Q1.6 Fail direction - REQUIRED to be fail-closed, and it is

| Scenario | Predicate | Outcome |
|---|---|---|
| GitHub rewords past `immutable release` | false | falls through to the existing `core.error` + `throw` at `publish-mirror.ts:179-183` -> **job FAILS. FAIL-CLOSED.** |
| GitHub drops the `field: "tag_name"` entry, keeps only `pre_receive` | false | **FAIL-CLOSED** |
| GitHub renames the `field` value | false | **FAIL-CLOSED** |
| Body absent, `errors` missing or not an array, `message` not a string | false (optional chaining + `typeof`) | **FAIL-CLOSED**, consistent with the file's *"Undefined is NOT benign"* rule (`octokit-fault-reason.ts:20-26`) and with the existing spec `REJECTS a createRelease 422 whose body is UNREADABLE` (`publish-mirror.spec.ts:410`) |
| A genuine `already_exists` race | `code === 'already_exists'`, and `already_exists` is not `custom`, so the two branches are DISJOINT (INFERRED from the measured payload's uniform `code: custom`) | existing benign re-read path, unchanged |

**The single fail-OPEN path** is a DIFFERENT 422 condition that arrives with `field: 'tag_name'` AND
`immutable release` in its message. No such condition is known from any source consulted. Its blast
radius is bounded and loud anyway: no shard is created, nothing is mirrored, and
**MEASURED (CONTEXT D5)** `publish-verify` goes RED - which is the stated expected outcome of
Window A, so the downstream red gate is already the backstop.

### Q1.7 The `pre_receive` decoy cannot be caught - three independent reasons

1. **MEASURED:** the decoy entry's `field` is `pre_receive`, not `tag_name`. The field-scoped lookup
   never reads that entry's message at all. This is the primary reason and it is structural, not
   textual.
2. **MEASURED:** the decoy's message is
   `pre_receive Repository rule violations found\n\nCannot create ref due to creations being restricted.\n\n`.
   It contains no `immutable release` substring. So even with the field scope removed, the substring
   alone excludes it.
3. **INFERRED (not measured - no genuine-ruleset payload was captured by any source consulted):** a
   genuine creations-restricted ruleset emits the `pre_receive` entry ALONE, without a companion
   `tag_name` entry, because the `tag_name` entry is produced by the immutability check
   specifically. On that reading the PRESENCE of the `tag_name` entry is itself the discriminator.
   Corroborating but not proving: crewship#894 reports *"No repo-level tag ruleset exists"* while
   still seeing both lines, and CONTEXT measured no ruleset four ways while seeing both lines - so
   both entries co-occur in the immutability case, but neither source exhibits a ruleset-only case.

**So a genuine ruleset restriction stays FATAL**, on reasons 1 and 2 alone, without depending on the
inferred reason 3.

### Q1.8 Two implementation consequences the planner must handle

Both MEASURED by reading the call site.

**(a) The return type must widen.** `ensureShardRelease` returns `Promise<number>`
(`publish-mirror.ts:127-130`). A skip has no release id, so the signature has to admit absence
(`number | undefined`, or a small result union) and the caller must branch on it.

**(b) A one-shot sentinel is required, or the skip produces 32 identical warnings.** MEASURED at
`publish-mirror.ts:344-347`:

```ts
if (shard === undefined) {
  const id = await ensureShardRelease(client, tag);
  shard = { id, names: new Set(await client.listReleaseAssets(id)) };
}
```

The lazy resolve runs on EVERY loop iteration while `shard` is unset. A skip that simply leaves
`shard` undefined therefore issues one `createRelease` and one warning PER HASH - 32 on the measured
ubuntu leg, 33 on windows. That is precisely the noise the file's own comment argues against
(`publish-mirror.ts:166-172`: *"isolating it would produce 32 identical warnings -- noise, not
signal"*). Warn ONCE, then skip every remaining entry with no further API call.

**(c) Counts stay honest, and no other signal misfires.** Skipped entries increment `skipped`;
`mirrored` stays 0; `failed` stays 0, so `core.setFailed` at `publish-mirror.ts:461` does not fire
and the leg is GREEN - CONTEXT D5's stated Window A expectation. **MEASURED reasoning** that the
all-restore-MISS rotation warning at `publish-mirror.ts:440` cannot false-fire: the entries restore
as HITs, so `readMisses` stays 0 and `readMisses === hashes.length` is false. The burned-shard run
therefore needs its own distinct warning and does not borrow the rotation signal.

**(d) The warning is the ONLY thing separating this run from a healthy one.** The debug file's
recorded anti-pattern (`windows-publish-one-asset.md`, cited at
`publish-verify-422-empty-shard.md:67-72`) is that a leg which mirrored nothing is indistinguishable
from a healthy leg in the summary. Per CONTEXT the warning must name the tag AND GitHub's own
`tag_name`-entry message (not the decoy - see Q1.4).

### Q1.9 Test shape (tdd_mode is true - MEASURED in `.planning/config.json`)

The existing helper needs no change: **MEASURED** `octokitFault(status, body?)`
(`src/test/octokit-fault.ts`) takes an arbitrary `response.data`, so the measured three-entry
payload drops in verbatim as the fixture, exactly as CONTEXT instructs.

- **RED:** `createRelease` throws `octokitFault(422, { errors: [<the measured three entries>] })`.
  Assert `skipped === scanned`, `mirrored === 0`, `failed === 0`, `createRelease` called ONCE (this
  is what pins the sentinel from Q1.8b), ONE `core.warning` containing the tag and `immutable
  release`, and `core.setFailed` NOT called.
- **Negative twin, must stay fatal:** `createRelease` throws a 422 carrying ONLY the `pre_receive`
  entry. Assert `rejects.toThrow()` and that `core.error` was called. This is the decoy test and it
  is the load-bearing half.
- **Must stay green unchanged:** `re-reads the shard by tag when the createRelease 422 body
  EXPLICITLY says already_exists` (`publish-mirror.spec.ts:384`) and `REJECTS a createRelease 422
  whose body is UNREADABLE` (`publish-mirror.spec.ts:410`).

## Q2 - Phase B rename sweep

**Sweep method (MEASURED):** `git grep -n -F "cache-mirror" -- . ':!.planning'` -> 10 files, 65
matching lines. Positive control: the same command against `retention.ts` alone returns 9, matching
the per-file count. Alternate-casing sweeps returned genuine zeros (exit 1) for `cachemirror` (`-i`)
and `Cache-Mirror`; `cache_mirror` returns exactly one hit, `docs/advanced.md:113`, which is the
anchor link for the `CACHE_MIRROR_MAX_AGE_DAYS` knob and is **OUT OF SCOPE per D3**.

### File-by-file classification

| # | File | Hits | Class | Disposition |
|---|---|---|---|---|
| 1 | `docs/advanced.md` | 2 (`:15`, `:65`) | prose, consumer-facing | MUST update. Both assert the scheme as `cache-mirror-YYYYMM`; both become FALSE. |
| 2 | `packages/github-cache/src/lib/retention.ts` | 9 | 1 load-bearing literal + 8 prose | `:52` is THE one-line change. `:9`, `:42`, `:43`, `:63`, `:66`, `:67`, `:72`, `:74` all become FALSE - including the comment-locked header. |
| 3 | `packages/github-cache/src/lib/retention.spec.ts` | 29 | test fixtures + prose | Mostly goes RED (good). Contains **vacuity trap 1** - see below. |
| 4 | `packages/github-cache/src/cleanup/cleanup.spec.ts` | 11 | test fixtures + prose | Goes RED at `:47`/`:82`/`:83`. Contains **vacuity trap 2** at `:148`/`:149`. |
| 5 | `packages/github-cache/src/backend/releases-backend.spec.ts` | 6 | 3 assertion literals + 3 prose | `:491`, `:494`, `:513` pin `releases/tags/cache-mirror-2026xx` -> RED. `:79`, `:465`, `:469` prose. |
| 6 | `packages/github-cache/src/cleanup/cleanup.ts` | 2 (`:47`, `:54`) | prose only | MUST update. Both say the engine enumerates `cache-mirror-*` releases; after the rename that is FALSE and invisible to every guard. |
| 7 | `packages/github-cache/src/roundtrip/read-back.ts` | 3 (`:122`, `:207`, `:217`) | prose, historical measurement | Judgement - see "historical record" below. |
| 8 | `packages/github-cache/src/publish/publish-mirror.ts` | 1 (`:118`) | prose, historical measurement | Judgement. Also collides with Phase A - see sequencing. |
| 9 | `packages/github-cache/src/roundtrip/read-back.spec.ts` | 1 (`:363`) | prose, historical measurement | Judgement. No assertion; cannot go red. |
| 10 | `start-cache-server/index.js` | 1 (`:68503`) | GENERATED artifact | **Regeneration ONLY.** See below. |

### The "never inline a second copy" audit - the rule HELD in source

**MEASURED:** zero violations in non-spec source. Every source consumer routes through the helpers:

- `cleanup.ts:5,78` imports and calls `isShardTag`
- `releases-backend.ts:7,342` imports and calls `shardTagsForWindow`
- `read-back.ts:19,138` imports and calls `shardTagsForWindow`
- `publish-mirror.ts:13,245` imports and calls `shardTag`
- `retention.ts:69` builds `SHARD_TAG_PATTERN` FROM `SHARD_TAG_PREFIX` rather than restating it

The literal appears a second time only in SPECS, and there the picture splits in two:

- **Correct-by-design pinning:** `retention.spec.ts` pins the produced tags deliberately -
  **MEASURED** at `retention.spec.ts:12` (*"retention.ts is now the single home ... so its exact
  produced tags are pinned here"*) and `:66` (`expect(SHARD_TAG_PREFIX).toBe('cache-mirror-')`). A
  spec that DERIVED its expectation from the constant under test would be vacuous, so these pins
  are the tripwire working as intended. They go RED, loudly, which is the desired behaviour.
- **The latent drift the rename exposes:** `releases-backend.spec.ts:491`/`:494`/`:513` and
  `cleanup.spec.ts:47`/`:82`/`:83`/`:148`/`:149` restate the literal in files that are NOT the
  tag scheme's home. Contrast **MEASURED** `publish-mirror.spec.ts:64`, which documents the opposite
  choice - the tag is *"`shardTag(NOW)` rather than spelled as a literal, so the month-shard scheme
  lives in [one place]"* - with the result that `publish-mirror.spec.ts` has **zero**
  `cache-mirror` hits and needs **no Phase B edit at all**. That file is the proof the
  derive-don't-restate pattern works.

  **Optional, discretionary:** converting those two spec files to derive via
  `shardTag(new Date(...))` would drop them out of every future rename sweep permanently. It is
  scope creep for Phase B and they would stop being independent cross-module pins. Presented
  neutrally; either choice is defensible.

### THE TWO VACUITY TRAPS - the most important Q2 finding

These are worse than a red suite, because the suite stays GREEN and the coverage silently
evaporates. This project's recurring CRITICAL is a stale artefact surviving a rename; this is that
class, in test form.

**Trap 1 - `retention.spec.ts:44-55`.** **MEASURED** the rejection list:

```
'cache-mirror-', 'cache-mirror-2026', 'cache-mirror-20260', 'cache-mirror-2026070',
'cache-mirror-latest', 'cache-mirror-backup', 'cache-mirror-2026-07'
```

asserted with `expect(isShardTag(tag)).toBe(false)`. Rename ONLY the source and every one of these
is still rejected - but on a **PREFIX** mismatch, not on the `\d{6}` suffix check the block exists
to test. The assertions stay green and stop testing anything. The `\d{6}` exactness that Pitfall 4
depends on (excluding `-latest` / `-backup` from the cleanup scope) would be UNCOVERED with a fully
green suite.

**Trap 2 - `cleanup.spec.ts:140-155`.** **MEASURED** the test *"skips a non-shard `cache-mirror-*`
release entirely (exact `isShardTag`, not a loose prefix)"* with fixtures
`{ tag_name: 'cache-mirror-latest' }` and `{ tag_name: 'cache-mirror-backup' }`, asserting
`listAllAssets` and `deleteAsset` were not called. Identical failure: after the rename both
fixtures miss on the prefix, the assertions still pass, and the test no longer exercises exactness
at all. Its own comment (`:141-143`) explicitly names what it is guarding - *"The loose
`startsWith(SHARD_TAG_PREFIX)` matched these; the exact `isShardTag` does not"* - so the comment
would survive as a claim the test no longer backs.

**Both traps must be fixed in the SAME commit as the source rename**, by re-basing the fixtures onto
the new prefix (`nx-cache-latest`, `nx-cache-2026-07`, ...). Nothing in the suite, the typechecker,
lint, or `check:action` will tell anyone otherwise.

### Assertions that go RED (these are self-announcing, low risk)

| Site | Why it reddens |
|---|---|
| `retention.spec.ts:18`, `:22-26` | `shardTag(...)` exact-output pins |
| `retention.spec.ts:36-42` | the ACCEPT list (`isShardTag(tag) === true`) |
| `retention.spec.ts:66-68` | `SHARD_TAG_PREFIX` / `SHARD_TAG_PATTERN` direct pins |
| `retention.spec.ts:164-199` | `shardTagsForWindow` exact-array pins, four cases |
| `cleanup.spec.ts:47`, `:82`, `:83` | shard fixtures stop being scoped, so pruned/scanned counts and the fault-abort assertion all fail |
| `releases-backend.spec.ts:491`, `:494`, `:513` | pinned request URLs `releases/tags/cache-mirror-2026xx` |

### The generated bundle - regeneration ONLY, no second source fix

**MEASURED** via `rg -n -F "SHARD_TAG" start-cache-server/index.js`:

```
68503:var SHARD_TAG_PREFIX = "cache-mirror-";
68507:  return `${SHARD_TAG_PREFIX}${year}${month}`;
68509:var SHARD_TAG_PATTERN = new RegExp("^" + SHARD_TAG_PREFIX + "\\d{6}$");
```

The bundle preserves the derivation - both `shardTag` and `SHARD_TAG_PATTERN` read the constant
rather than restating the literal. So the single `retention.ts:52` edit plus
`npm run build:action` fully updates it. **Per D4, run `npm run check:action` from the MAIN TREE**
(a worktree false-drifts it).

### Prose that becomes FALSE - the sub-question that matters as much as the code

14 prose sites across 6 files. Split into two kinds, and the distinction is what the plan needs:

**Kind 1 - CURRENT-SCHEME claims. These become FALSE and MUST be rewritten.**

| Site | The false claim after the rename |
|---|---|
| `retention.ts:9` | *"The `cache-mirror-YYYYMM` month-shard tag scheme lives HERE"* - inside a block labelled *"LOAD-BEARING, comment-locked (Pitfall 7)"*. The most important single prose fix in the task. |
| `retention.ts:42-43` | *"`cache-mirror-` plus the UTC year and zero-padded month (e.g. cache-mirror-202607)"* |
| `retention.ts:63` | *"(equivalent to `/^cache-mirror-\d{6}$/`)"* - a restated regex, now wrong |
| `retention.ts:66-67` | *"it only excludes non-shard `cache-mirror-*` tags such as `cache-mirror-latest` / `cache-mirror-backup`"* |
| `retention.ts:72`, `:74` | *"a genuine `cache-mirror-YYYYMM` month shard"*, *"so a `cache-mirror-latest` ... is never scoped"* |
| `cleanup.ts:47` | *"materialize the COMPLETE cache-mirror-* release + asset set"* |
| `cleanup.ts:54` | *"Cleanup enumerates EVERY cache-mirror-* release"* |
| `cleanup.spec.ts:45-46`, `:122`, `:140`, `:142` | *"the cache-mirror-* scope filter"*, *"considers ONLY cache-mirror-* releases"* - two of these are TEST NAMES, which are prose that shows up in CI output |
| `releases-backend.spec.ts:79`, `:465`, `:469` | the pinned-window narrative naming both shard tags |
| `retention.spec.ts:12`, `:35` | *"the single home for the cache-mirror-YYYYMM tag scheme"* |
| `docs/advanced.md:15`, `:65` | the consumer-facing statement of the scheme, twice |

**Kind 2 - HISTORICAL MEASUREMENT records. Do NOT blanket-rename these; renaming them would
FALSIFY the record.**

| Site | What it records |
|---|---|
| `publish-mirror.ts:118` | run 30773689490's measured evidence - *"there was NO `cache-mirror-202608` release ... with `cache-mirror-202607` as a passing positive control"*. Those tags are what was actually probed. |
| `read-back.ts:122` | the measured month-boundary incident - a 404 on `cache-mirror-202608` |
| `read-back.ts:207`, `:217` | *"the live cache-mirror-202607 shard (122 assets)"* as the justification for `MAX_ASSET_PAGES` and for paginating |
| `read-back.spec.ts:363` | *"MEASURED: all 122 assets in the live cache-mirror-202607 shard carry an empty label"* |

**Recommendation for Kind 2 (INFERRED, discretionary):** keep the historical tag names verbatim and
add a short marker that they are the PRE-RENAME scheme, so a reader cannot mistake them for the
current one. Blanket-renaming them creates a worse defect than leaving them: a comment claiming a
measurement was taken against a tag that never existed. Two of them get stale a second way after
Phase C - `read-back.ts:207`/`:217` and `read-back.spec.ts:363` describe `cache-mirror-202607` as
"live", and D6 deletes it. That is a Phase C follow-up, not a Phase B blocker; flagging it so it is
not lost.

### Sequencing note - Phase A and Phase B both edit the same block

**MEASURED:** Phase A rewrites `ensureShardRelease` and its doc block, `publish-mirror.ts:110-185`.
Phase B's single prose hit in that file is `:118`, inside that same block. Because D1 fixes the order
as A then B, Phase B rebases onto Phase A's text - the plan should not treat `:118` as pointing at a
line number that will still exist.

**MEASURED:** `.github/workflows` is CLEAN. `git grep -n -F "cache-mirror" -- .github/workflows`
returns exit 1, with a positive control of 12 `nx-cache` hits in `ci.yml` proving `git grep` reaches
those files. No workflow edit is needed.

## Q3 - Does anything OUTSIDE the repo depend on the tag name?

**Answer: NO. The shard tag name is purely internal. It is not part of the consumer contract, and
the rename is not a breaking change under this project's own published definition.**

Four independent confirmations:

1. **DOCUMENTED** (`docs/versioning.md:9-24`): the versioned contract is *"the CONSUMER surface only
   -- exactly three groups (decision D-04)"* - (1) package exports from `index.ts`, (2) the
   `start-cache-server` JS action inputs, (3) the consumer env knobs. The shard tag name is in NONE
   of the three.
2. **DOCUMENTED** (`docs/versioning.md:31-38`), and this is decisive because it names the helper
   explicitly:

   > Internal module exports (for example `withHashLock`, `shardTag`, `octokitFault`,
   > `isWriteTrusted`, and the other internals not re-exported from `index.ts`) ... are NOT part of
   > the consumer contract. They MAY change in any release, without a version signal.

3. **MEASURED** (`packages/github-cache/src/index.ts`): the barrel exports `createCacheServer` plus
   six port types. `SHARD_TAG_PREFIX`, `shardTag`, `isShardTag`, and `shardTagsForWindow` are absent,
   so the exact-equality barrel assertion in `public-surface.spec.ts` structurally excludes them.
4. **MEASURED** (`public-surface.spec.ts:50`): `EXPECTED_ACTION_INPUTS = ['port']`. The
   `uses:`-consumable action has exactly one input and it is unrelated to the tag.

**There is no `action.yml` at the repo root** (MEASURED - `rg` exit 2, file not found). The two
`action.yml` files are `start-cache-server/action.yml` (the consumer action, one input: `port`) and
`packages/github-cache/action.yml`, which `docs/versioning.md:36-38` names as the internal dogfood
action and places explicitly OUTSIDE the contract.

**D3 confirmed and separate:** `CACHE_MIRROR_MAX_AGE_DAYS` and
`CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION` ARE contractual - **DOCUMENTED** at
`docs/versioning.md:19-23`, which lists them among the consumer env knobs. That is exactly why D3
excludes them and why the tag name is a different question with a different answer. Not renaming
them is correct and this research proposes no change to them.

### The one real consequence: a DATA compatibility break, not an API one

**INFERRED** (mechanism traced through measured code, not observed in a run):

- The reader walks `shardTagsForWindow` (`releases-backend.ts:342`), which derives every tag from
  `SHARD_TAG_PREFIX`. After the rename it looks ONLY under `nx-cache-*`, so every asset already
  mirrored under `cache-mirror-*` becomes unreachable. That is a cache MISS, not data loss.
- `cleanup.ts:78` scopes on `isShardTag(release.tag_name)`, which also derives from the prefix.
  After the rename the old shards are no longer scoped, so cleanup will **never prune them** - they
  are orphaned permanently.

**The tension the plan must record.** `cleanup.ts` already reasons about exactly this hazard one
level down, for ASSET names (MEASURED, inside the asset loop):

> The widening is purely ADDITIVE ... It had to land in the SAME COMMIT as the rename: a publisher
> writing the new name against an unwidened filter silently stops pruning, with no error anywhere.

The TAG rename creates the identical hazard one level up, and Phase B does NOT widen `isShardTag`.
The locked answer is Phase C's manual delete of `cache-mirror-202607` (D6) - which is legitimate,
since **MEASURED (CONTEXT D6)** it is the only populated legacy shard and it is mutable. But a future
reader will find that comment stating same-commit widening as a rule, and find a tag rename that did
not widen. **Recommendation:** state in the Phase B commit body, and in one line near
`isShardTag`, WHY the precedent does not apply here (a single hand-deleted shard, no adopters, D6).
Cheap, and it is precisely the stale-comment-survives-rename class this project keeps hitting.
This does NOT reopen D6.

## Validation Architecture

**MEASURED** (`.planning/config.json`): `workflow.nyquist_validation: true`, `workflow.tdd_mode: true`.

### Test framework

| Property | Value |
|---|---|
| Framework | Vitest via `@nx/vitest`; config `packages/github-cache/vitest.config.mts` (MEASURED) |
| Full suite | `npx nx test github-cache` - MEASURED baseline from the debug file: 42 files, 980 tests, all pass |
| File-scoped run | `npx nx test github-cache -- src/publish/publish-mirror.spec.ts` (INFERRED - vitest positional filter passthrough; not executed this session) |
| Typecheck + lint | `npx nx run-many -t typecheck lint --projects=github-cache` (MEASURED, cited in the debug file's verification block) |
| Bundle-drift gate | `npm run check:action` = `npm run build:action && git diff --exit-code -- start-cache-server/index.js` (MEASURED in root `package.json`). **MAIN TREE ONLY per D4.** |

### Requirement -> test map

| Phase | Behaviour | Type | Command | Exists? |
|---|---|---|---|---|
| A | burned-name 422 skips loudly, once, counts honest | unit | `npx nx test github-cache -- src/publish/publish-mirror.spec.ts` | NO - new test (Q1.9 RED) |
| A | `pre_receive`-only 422 stays FATAL | unit | same | NO - new test (Q1.9 negative twin) |
| A | `already_exists` 422 still re-reads | unit | same | YES - `publish-mirror.spec.ts:384` |
| A | unreadable 422 body stays FATAL | unit | same | YES - `publish-mirror.spec.ts:410` |
| B | prefix/pattern/tag outputs | unit | `npx nx test github-cache -- src/lib/retention.spec.ts` | YES - reddens, must be updated |
| B | non-shard prefix rejection is still SUFFIX-based | unit | same + `src/cleanup/cleanup.spec.ts` | **YES but goes VACUOUS - the two traps. Fixture rebase required.** |
| B | reader requests the new tag | unit | `... src/backend/releases-backend.spec.ts` | YES - reddens |
| B | bundle carries the new prefix | guard | `npm run check:action` (main tree) | YES |

### Sampling rate

- Per commit: the touched spec file, plus `npm run check:action` for the Phase B commit.
- Per phase: `npx nx test github-cache` full suite + `typecheck` + `lint` green before the
  `main` window.

### Wave 0 gaps

None. No new test file, no new fixture helper, no framework install -
`octokitFault(status, body?)` already accepts an arbitrary body (MEASURED).

## Security Domain

**MEASURED** (`.planning/config.json`): `security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS categories

| Category | Applies | Control |
|---|---|---|
| V2 Authentication | no | no auth surface changes |
| V3 Session Management | no | none |
| V4 Access Control | no | none |
| **V5 Input Validation** | **yes** | The 422 body is UNTRUSTED input from a remote service. The predicate must validate shape, not assume it: optional chaining plus `typeof x === 'string'`, per the doctrine already in `octokit-fault-reason.ts:20-26`. An unreadable body must NOT reach the benign branch. |
| V6 Cryptography | no | none |

### Threat patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| A fail-open write guard masks a permissions regression | Repudiation / Tampering | The predicate requires 422 AND `field == "tag_name"` AND the substring. A token-scope regression is 403 (MEASURED reasoning in the debug file's Eliminated list: *"a scope fault is 403, not 422"*), so it cannot take the skip path. |
| Secret leakage through the new warning | Information Disclosure | The skip warning logs only the tag, the numeric status, and GitHub's own message - the same rule already stated at `publish-mirror.ts:177-178`. Never a token, never a raw workflow-command string. |
| A silent skip reads as a healthy mirror | Repudiation | The warning is mandatory and loud (CONTEXT), counts stay honest, and `publish-verify` is the downstream backstop (D5). |
| Substring match over-triggers on an unrelated condition | Tampering | Bounded: field-scoped, and the only fail-open path leaves nothing mirrored, which reddens `publish-verify`. |

## Side finding - OUT OF SCOPE, recorded because it closes a documented blind spot

**DOCUMENTED** (`docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28`, fetched 2026-08-03):

```
GET    /repos/{owner}/{repo}/immutable-releases   -> { enabled: boolean, enforced_by_owner: boolean }
PUT    /repos/{owner}/{repo}/immutable-releases   -> 204
DELETE /repos/{owner}/{repo}/immutable-releases   -> 204
```

plus an org-level `GET /orgs/{org}/settings/immutable-releases`.

This directly contradicts debug evidence E8's "clean negative" - *"no read-only repo surface
reachable with this token exposes an immutable-releases flag ... D1 cannot be answered by probing at
all. It needs a human to read repo Settings"* - and the `enforced_by_owner` field answers E8's other
open question (repo-owned versus org-enforced). It is relevant to the DEFERRED standing exposure
(*"anyone re-enabling the setting silently kills the mirror again"*), which a single GET could now
turn into a tripwire.

**No action in this task.** Phases A/B/C are unchanged by it. Recorded so it is not re-derived.

## Package Legitimacy Audit

**Not applicable.** This task installs no packages. No `package.json` or lockfile change is in scope
for either phase (MEASURED: Phase A touches `publish-mirror.ts`, `octokit-fault-reason.ts`, and one
spec; Phase B touches one literal, six specs, prose, one doc, and the generated bundle).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | A genuine creations-restricted ruleset emits the `pre_receive` entry WITHOUT a companion `tag_name` entry | Q1.7 reason 3 | LOW. Reasons 1 and 2 (field scope, substring absence) exclude the decoy independently, so the guard is correct even if A1 is false. A1 only strengthens the argument; nothing depends on it. |
| A2 | `already_exists` and the burned-name branch are mutually exclusive | Q1.6 | LOW. If both somehow appeared, the `already_exists` branch runs first and takes the re-read path, which then 404s and throws the annotated error - still fail-closed, just with a less precise message. |
| A3 | `npx nx test github-cache -- <file>` is the file-scoped run form | Validation Architecture | LOW. Cosmetic; the full-suite command is measured. Verify before putting it in a plan step. |
| A4 | Renaming the reader/cleanup prefix orphans old shards from the prune scope | Q3 | LOW mechanism risk (traced through measured code), and it is moot in this repo because D6 hand-deletes the only populated legacy shard. The risk is documentary, not behavioural. |
| A5 | Splitting the field-scoped accessor into the lib leaf while composing the substring at the call site is the right factoring | Q1.5 | LOW. Discretionary style call within Claude's Discretion; both placements are functionally identical. |

## Open Questions

1. **Should the existing FATAL `core.error` at `publish-mirror.ts:179-181` also print the
   `tag_name`-scoped message rather than whatever `faultReason` returns first?**
   - Known: on the measured payload it prints the `pre_receive` DECOY (Q1.4). That is misleading in
     the job log for exactly the failure it is meant to diagnose.
   - Unclear: whether changing it is in scope for Phase A or is a separate diagnostic-quality fix.
   - Recommendation: fix it in Phase A. The field-scoped accessor is already being added; using it
     on both the skip and the fatal path is a one-line delta and it removes a comment-invisible
     trap. Present it explicitly rather than folding it in silently.

2. **Do the two non-home spec files convert to derived tags, or just get their literals rebased?**
   - Known: rebasing is minimal and keeps them as independent cross-module pins. Deriving removes
     them from every future rename sweep.
   - Recommendation: rebase for Phase B (smallest diff, no behaviour question), and leave the
     derive-conversion as a separate candidate. Do not bundle a refactor into a rename that already
     has two silent-vacuity traps to get right.

## Sources

### Primary (HIGH confidence)

- **This repository, read directly this session:** `packages/github-cache/src/lib/retention.ts`,
  `lib/octokit-fault-reason.ts`, `publish/publish-mirror.ts`, `cleanup/cleanup.ts`,
  `roundtrip/read-back.ts`, `index.ts`, `public-surface.spec.ts`, `test/octokit-fault.ts`,
  `docs/versioning.md`, `docs/advanced.md`, root `package.json`, `.planning/config.json`.
- **`.planning/quick/260803-fcd-.../260803-fcd-CONTEXT.md`** - the measured three-entry 422 payload
  from run `30796967020`, the paired fresh-vs-burned ref probe, the locked decisions.
- **`.planning/debug/publish-verify-422-empty-shard.md`** - E1 through E10, the addendum, and the
  recorded blind spots.
- **`git grep` / `rg` sweeps** run this session, each with a positive control and an exit-code check.

### Secondary (HIGH confidence for the wording, MEDIUM for its stability)

- `github.com/github-community-projects/ospo-reusable-workflows/issues/83` - independent verbatim
  capture of the identical three-entry payload (from `revanite-io/pvtr-github-repo` run
  `17922846291`), plus the upload-endpoint wording `422 Cannot upload assets to an immutable release`.
- `github.com/crewship-ai/crewship/issues/894` - second independent capture, `gh`-rendered.
- `docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases` - behaviour
  documented, error wording NOT documented.
- `docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28` - `immutable` as a response
  field only; no documented 422 reason.
- `docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28` - the `immutable-releases`
  settings endpoints (side finding).

### Not consulted / unavailable

- Brave-backed websearch (no `BRAVE_API_KEY`) and the built-in WebSearch tool (API error) were both
  unavailable this session. `gh search issues` / `gh search code` plus `markdown.new` covered the
  ground; the GitHub Docs search API (`client_name` param required) resolved the correct doc URLs.

## Metadata

**Confidence breakdown:**

- Q1 wording and guard shape: **HIGH.** Two independent verbatim captures of the payload, plus the
  `faultReason` defect read directly out of the source.
- Q1.7 reason 3 (ruleset-only payload shape): **MEDIUM**, explicitly labelled INFERRED, and nothing
  depends on it.
- Q2 sweep and classification: **HIGH.** Every file opened; every count reproduced with a positive
  control.
- Q2 vacuity traps: **HIGH.** Derived from reading the fixtures and the derived-pattern semantics,
  not from running the suite post-rename (which would require the edit).
- Q3 contract status: **HIGH.** Stated explicitly in `docs/versioning.md` and confirmed
  mechanically by the barrel and the surface guard.

**Research date:** 2026-08-03
**Valid until:** the vendor string is undocumented, so treat Q1 as valid for ~30 days and re-check
if a `main` window ever shows the guard failing to fire. Q2 and Q3 are repo facts and stay valid
until the files change.
