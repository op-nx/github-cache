# Quick Task 260803-fcd: burned-name skip, then the nx-cache namespace - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** `--full --auto`. Gray areas were NOT auto-decided here -- the maintainer answered them
directly, so everything below is LOCKED by instruction rather than by the two-axis heuristic.

<domain>
## Task Boundary

Two changes, in a STRICT order, each verified on its own `main` window:

**PHASE A -- the burned-name skip.** `ensureShardRelease` must treat one specific `createRelease`
422 -- GitHub reporting that the tag name was used by an immutable release -- as a non-fatal skip
with a loud warning, instead of failing the whole `publish` job. Every other 422 stays fatal.

**PHASE B -- the namespace change.** `SHARD_TAG_PREFIX` goes from `cache-mirror-` to `nx-cache-`,
so month shards become `nx-cache-YYYYMM`.

**PHASE C -- after B verifies green.** Delete the legacy `cache-mirror-202607` release and its 155
assets by hand.

</domain>

<decisions>
## Locked by maintainer instruction

### D1: ORDER IS A AND THEN B, and the reason is that the burn is PERISHABLE

Phase A must be implemented and verified BEFORE Phase B. `cache-mirror-202608` is burned RIGHT NOW
and `shardTag()` still returns it, so the skip path has a real live subject. Change the prefix
first and `nx-cache-202608` is fresh, the skip path becomes unexercisable, and Phase A would ship a
guard that was never seen to fire -- which this project treats as no evidence at all.

The maintainer identified this; the orchestrator had the order backwards.

### D2: Namespace REUSE is deliberate, and the collision objection is RETRACTED

Shards become `nx-cache-YYYYMM`, sharing the `nx-cache-` prefix with the Actions-cache key
namespace. The orchestrator objected on collision grounds and was WRONG. Recorded so the objection
is not re-raised:

- `isServerProducedKey` is applied ONLY to `entry.key` from the Actions-cache enumeration
  (`publish-mirror.ts:264`). `isShardTag` is applied ONLY to `release.tag_name` from the Releases
  enumeration (`cleanup.ts:78`). Those are the only non-test call sites of each. **A release tag is
  never tested with `isServerProducedKey` and a cache key is never tested with `isShardTag`** --
  two different GitHub APIs, two disjoint keyspaces.
- The codebase already made this call explicitly: `release-asset-name.ts:101` documents that its
  filter is "NOT ALIASED to `isServerProducedKey` ... even though the body is" identical. The
  duplication is intentional because these namespaces are independent.
- It is true that `isServerProducedKey('nx-cache-202608')` returns true (`202608` is valid
  lowercase hex within `HASH_PATTERN`'s 1..512). It is also IRRELEVANT, because nothing ever asks
  that question about a release tag.

**Maintainer's forward-looking rationale, which is the real argument:** a future milestone may add a
READ-WRITE Releases backend, at which point "mirror" is a misnomer permanently baked into every tag
ever created. `nx-cache-` is the durable name; `cache-mirror-` encodes a temporary property.

### D3: The env knob `CACHE_MIRROR_MAX_AGE_DAYS` is NOT renamed -- explicitly OUT

The tag scheme and the consumer knob are different contracts. `CACHE_MIRROR_MAX_AGE_DAYS` is a
published consumer-facing env knob; renaming it is a BREAKING change for consumers and is not part
of this task. Note `git grep` is case-sensitive, so the knob's `CACHE_MIRROR` spelling does not
appear in the lowercase `cache-mirror` sweep -- do not "helpfully" include it.

### D4: Phase B DRIFTS THE ACTION BUNDLE -- regenerate in the SAME commit

`start-cache-server/index.js` contains `cache-mirror` (measured: 1 occurrence). `SHARD_TAG_PREFIX`
lives in `lib/retention.ts`, which is `serve()`-reachable via `releases-backend.ts`. So Phase B
MUST regenerate the bundle in the same commit, or `action-bundle-drift` fails that commit. Run
`npm run check:action` from the MAIN TREE -- a worktree false-drifts it.

### D5: Two `main` windows, authorized. Same verified sequence both times.

Non-negotiable per-window sequence, every step VERIFIED and not assumed:
1. Back up `main` to a remote ref; confirm the ref resolves to `main`'s pre-push SHA on the REMOTE.
2. Close PR #16 FIRST. Its head equals the tip being pushed, and a push with it open marks the PR
   permanently Merged -- a PR cannot be un-merged, and a later `main` restore would leave a public
   repo showing a merged PR that `main` does not contain. Git is restorable; PR status is not.
3. Push, observe, restore `main` with `--force-with-lease`, re-read the remote to confirm, reopen.

**Window A expected outcome, stated in advance so a partial green is not over-read:** `publish`
GREEN with the skip warning, `publish-verify` RED. That is CORRECT, not a failure -- if publish
skips the burned shard then nothing is mirrored, so the read-back has nothing to find. Window A
proves the skip fires; it cannot prove a green milestone.

**Window B expected outcome:** a fresh `nx-cache-202608` shard is created and BOTH `publish` and
`publish-verify` go green.

### D6: Phase C waits for Window B to verify green

`cache-mirror-202607` holds 155 warm assets and is the only populated shard. It stays until the new
prefix is proven end to end, so there is a working mirror to fall back on. It is mutable
(`immutable` field absent) so it deletes cleanly when the time comes. Deleting it discards warm
cache entries -- cache MISSes, not data loss.

</decisions>

<specifics>
## The exact payload -- MEASURED, use it as the fixture

Captured verbatim from run `30796967020` (both legs). This is a real measurement, not a guess, and
it is why Phase A's guard can be written tightly:

```json
{"resource":"Release","code":"custom","field":"pre_receive","message":"pre_receive Repository rule violations found\n\nCannot create ref due to creations being restricted.\n\n"}
{"resource":"Release","code":"custom","field":"tag_name","message":"tag_name was used by an immutable release"}
{"resource":"Release","code":"custom","message":"Published releases must have a valid tag"}
```

Three observations that shape the guard:

1. **`code` is `custom` on ALL THREE.** So `code` cannot discriminate -- the discriminator has to be
   the `message` (and optionally `field == "tag_name"`). This is exactly why the earlier fix was
   widened to surface `message`; a code-only reader would be useless here.
2. **The authoritative entry is the SECOND one**, `field: "tag_name"`. The first is the generic
   enforcement wording and the third is a downstream consequence.
3. **The generic `pre_receive` message is a decoy.** "Cannot create ref due to creations being
   restricted" reads exactly like a ruleset. There is NO ruleset -- measured four ways:
   `repos/.../rulesets` is `[]`, `?includes_parents=true` is `[]` (so no inherited org ruleset),
   legacy `tags/protection` 404s, and `rules/branches/main` is `[]`. Do NOT write a guard that
   matches the `pre_receive` wording -- it would fire on genuine ruleset restrictions too, which
   MUST stay fatal.

**Independently confirmed name-scoping**, paired probe, same endpoint and SHA seconds apart:

| Tag ref created | Result |
|-----------------|--------|
| `zz-probe-refcreate-260803` (fresh) | **201 Created** |
| `cache-mirror-202608` (burned) | **422 Reference update failed** |

So ref creation is not globally restricted; only the burned name is. The throwaway tag was deleted.

## Guard shape for Phase A

Match on the `tag_name`-scoped immutable-release message specifically. It must NOT match:
- a genuine ruleset restriction (the `pre_receive` decoy) -- stays FATAL;
- `already_exists` -- that remains the separate benign-race path already implemented;
- an unreadable or malformed body -- stays FATAL, per the fail-closed property just established.

The skip must be LOUD (`core.warning` naming the tag and GitHub's own message) and must leave the
run's counts honest -- do not let a skipped shard read as a successful mirror.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/debug/publish-verify-422-empty-shard.md` -- the full diagnosis chain.
- Commit `8dc0131` -- `faultReason` hoisted to `lib/octokit-fault-reason.ts`, with the two lookups
  decoupled so a `message` survives a missing `code`. Phase A builds directly on it.
- `packages/github-cache/src/lib/retention.ts:52-79` -- `SHARD_TAG_PREFIX` and the derived
  `SHARD_TAG_PATTERN` / `isShardTag`. The prefix is authored ONCE by design ("Never inline a second
  copy of this literal"), so Phase B is a one-line source change plus its dependents.
- Sweep scope for Phase B, measured (`git grep -c "cache-mirror" -- . ':!.planning'`): 10 files --
  `docs/advanced.md`, `releases-backend.spec.ts`, `cleanup.spec.ts`, `cleanup.ts`,
  `retention.spec.ts`, `retention.ts`, `publish-mirror.ts`, `read-back.spec.ts`, `read-back.ts`,
  `start-cache-server/index.js`.

</canonical_refs>

<blockers>
## None open

Both previously-unresolved items are now measured and closed:
- Why `createRelease` 422'd -- ANSWERED, three named causes, payload above.
- Whether a ruleset restricts ref creation -- ANSWERED, no. Four independent probes, plus a paired
  fresh-vs-burned tag test that isolates the block to the single burned name.

</blockers>
