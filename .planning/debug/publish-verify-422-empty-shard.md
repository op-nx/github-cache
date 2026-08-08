---
slug: publish-verify-422-empty-shard
status: awaiting_human_verify
trigger: "publish-verify fails on BOTH legs at the Phase 13 tip (run 30767511870: 24 success / 2 failure, both publish-verify legs failing at the round-trip read-back). It succeeded on all five prior main pushes. The job is push-gated (on.push branches: [main]) so it is structurally invisible to every PR run -- it was only found via the temporary main push in quick 260802-toz. Measured so far: the cache-mirror-202608 shard exists with ZERO assets; every asset upload returned 422 and was swallowed as benign; the seed asset is unique per run so its 422 cannot mean already-exists. The month-boundary hypothesis is UNCONFIRMED -- the shard predates the run. Mechanism NOT established. This blocks PR #16. Maintainer has authorised whatever it takes including another temporary main push window (same close-the-PR-first sequencing as 260802-toz) if read-only investigation stalls."
goal: find_and_fix
created: 2026-08-03
updated: 2026-08-03
---

# Debug: publish-verify fails on both legs; shard has zero assets and every upload 422s

## Symptoms

**Expected behavior:** On a push to `main`, each `publish` leg mirrors its OS's server-produced
Actions-cache entries into the monthly shard release (`cache-mirror-<YYYYMM>`), and
`publish-verify` then reads one back through the real read path. Both legs green. This held on all
five prior `main` pushes.

**Actual behavior:** Run `30767511870` (event `push`, head `ce197701`, 2026-08-02T21:16:28Z) is
**24 success / 2 failure**. Both `publish-verify` legs fail, both at the same step:
`Run node packages/github-cache/dist/roundtrip/read-back.js`. The `publish` legs themselves report
SUCCESS. The `cache-mirror-202608` shard exists but holds **ZERO assets**.

**Error messages:** No error from `publish` -- that is the core of it. Every asset upload returned
**422 and was swallowed as benign**. The failure only surfaces downstream, when `publish-verify`
tries to read back an asset that was never written.

**Timeline:** Regression introduced by this branch. Succeeded on all five prior `main` pushes;
fails at the Phase 13 tip, which changes this code by ~1888 insertions. Found ONLY because quick
`260802-toz` temporarily pushed the Phase 13 tip to `main` -- the job is push-gated
(`on.push` `branches: [main]`) and therefore structurally skipped on every pull request, so no PR
run could ever have caught it. This is the v0.0.1 retrospective lesson repeating.

**Reproduction:** Push to `main`. Structurally unreachable from a PR. A temporary `main` push
window is authorised (see Constraints).

## What is already MEASURED (do not re-derive; verify only if load-bearing)

1. `cache-mirror-202608` shard EXISTS and holds **zero assets**.
2. **Every** asset upload returned 422 and was swallowed as benign.
3. The **seed asset is unique per run**, so its 422 CANNOT mean already-exists. This is the
   load-bearing observation -- it breaks the benign reading of the 422.
4. The **month-boundary hypothesis is UNCONFIRMED**: the shard was created BEFORE the run, so
   "first run of a new month races shard creation" does not explain it as stated.
5. Mechanism is **NOT established**. Nothing below is a confirmed cause.

## Leading hypothesis (unconfirmed -- the 422 is being misclassified)

`publish-mirror.ts:329-331` treats a 422 on `uploadReleaseAsset` as already-exists and continues:

> "(our list and upload) returns 422 already_exists -- benign no-op (D-05)"

That reading is FALSE for a unique-per-run seed name. So either the 422 carries a different
GitHub reason (and the code cannot tell them apart), or the upload target is wrong. Candidate
sub-causes, none checked:

- The 422 is not `already_exists` at all. GitHub returns 422 from the release-asset endpoint for
  several distinct reasons; the handler branches on **status only** (`statusOf(error) === 422`),
  never on the error body's `errors[].code`. A status-only branch cannot distinguish benign from
  fatal.
- The release id / upload URL resolved by `ensureShardRelease` (`publish-mirror.ts:112-131`,
  which has its OWN 422-race branch at `:131`) points at something that rejects uploads --
  e.g. a draft release, a mismatched id, or a shard created by a different path this branch added.
- Something Phase 13 changed upstream of the upload changes the asset name, the release lookup,
  or the client.

**Anti-pattern to avoid, from the sibling session:** `publish` reporting green means nothing here.
`.planning/debug/windows-publish-one-asset.md` (root_caused, correct-by-design) established that
this job's OBS-01 summary reports only `mirrored | skipped | failed`, has no `scanned`, and folds
restore-MISS into `skipped` -- so a leg that mirrored nothing is indistinguishable from a healthy
one. Read that session before reasoning from any publish-leg summary. Its PROPOSED item 1 (report
`scanned` and `readMisses`) is directly relevant and still unapplied.

## Constraints on the investigation

- **MAINTAINER INSTRUCTION, mandatory for any `main` push window: BACK UP `main` BEFORE and
  RESTORE IT AFTER.** Capture the pre-push SHA into a remote backup ref (the precedent is
  `refs/backups/main-pre-phase13-verify`, still on the remote from `260802-toz`), verify the ref
  exists on the remote before pushing, and restore `main` to its original SHA afterwards with the
  restore VERIFIED, not assumed.
- **Close any PR whose head SHA equals the tip being pushed, FIRST.** From `260802-toz`: pushing
  with such a PR OPEN makes its SHA reachable from `main` and GitHub marks the PR permanently
  **Merged** -- a PR cannot be un-merged, and the later `main` restore would leave a public repo
  showing a merged PR that `main` does not contain. The git side is restorable; the PR status is
  not. Verify `state=CLOSED mergedAt=null` after the push AND after the restore.
- Prefer read-only investigation first (existing run logs, `gh api` GETs against the shard release
  and Actions caches, local reproduction of the publish + read-back path). Spend the `main` window
  only if read-only stalls.
- No destructive `gh api` calls: do not delete or modify mirror assets, releases, or Actions-cache
  entries while diagnosing.
- `git grep` / `rg` only -- never the Grep tool or the `grep` command. Use `| rg`, never `| grep`.
- No `cd <path> &&` prefixes. ASCII only. Temp logs to the session scratchpad, never the repo.
- `git commit -m` FAILS on this Dev Drive (ReFS, `COMMIT_EDITMSG: Invalid argument`) -- write the
  message with the Write tool and use `git commit -F <path>`.
- Editing any `serve()`-reachable source drifts `start-cache-server/index.js`; regenerate the
  bundle in the SAME commit or `action-bundle-drift` fails that commit.

## Evidence

### E1 -- The 422 response BODY is never logged, and that is structural (MEASURED)

`node_modules/@octokit/plugin-request-log/dist-src/index.js` is the sole source of the
`METHOD path - status with id <id> in Nms` lines in the publish logs. It logs `requestOptions`
only -- method, path, status, request id, duration. **The response body is never read and never
logged, on any branch.** Successes go to `octokit.log.info` (a no-op in `@octokit/core`'s default
logger) and failures to `octokit.log.error`, which is why ONLY failing requests appear in the job
log at all.

Consequences, both load-bearing:
1. `errors[].code` / `errors[].field` for these 422s **do not exist anywhere in the run
   artifacts**. Investigation priority 1 is answered: the body is not recoverable read-only.
2. The ABSENCE of a `POST /repos/op-nx/github-cache/releases` line PROVES `createRelease`
   SUCCEEDED (only failures print). Same for `listReleaseAssets`.

### E2 -- Both legs 422 on every upload into a release that provably held zero assets (MEASURED)

Job `91549048541` (`publish (ubuntu-24.04-arm)`) and `91549048531` (`publish (windows-11-arm)`),
run 30767511870:

| leg | tag lookup | uploads attempted | 422s |
|---|---|---|---|
| ubuntu | `GET .../releases/tags/cache-mirror-202608 - 404` at 21:20:04.62 | 32 | **32** |
| windows | (no 404 logged -- shard already existed) | 33 | **33** |

First ubuntu upload, verbatim:

```
2026-08-02T21:20:05.9784238Z POST /repos/op-nx/github-cache/releases/363897680/assets?name=nx-cache-feed230767511870&label=mirrored-by%3A%20linux - 422 with id 3400:1AA75C:59598D:96EF3C:6A6FB485 in 337ms
```

The ubuntu leg's GET 404 means the shard did NOT exist at 21:20:04; `createRelease` then made it
(no failure line) and every subsequent upload went to release id 363897680. **`already_exists` is
therefore impossible for the ubuntu leg's FIRST upload** -- the release was empty and brand new.

### E3 -- The shard release is healthy and NOT a draft (MEASURED)

`gh api repos/op-nx/github-cache/releases/363897680`:

```
id 363897680  tag_name cache-mirror-202608  draft false  prerelease false
created_at 2026-08-02T12:36:20Z  published_at 2026-08-02T21:20:05Z
target_commitish main  assets 0
upload_url https://uploads.github.com/repos/op-nx/github-cache/releases/363897680/assets{?name,label}
```

`published_at` = 21:20:05Z matches the ubuntu leg's create to the second. The tag
`refs/tags/cache-mirror-202608` exists and points at `ce197701` (the pushed head). Priority 3's
draft / missing-release / missing-tag candidates are all eliminated.

### E4 -- The request is well-formed and reaches uploads.github.com (MEASURED)

`node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/generated/endpoints.js:2032-2035`:

```js
uploadReleaseAsset: [
  "POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}",
  { baseUrl: "https://uploads.github.com" }
]
```

`name` and `label` are consumed by the URL template (the log confirms both landed in the query
string), `data` becomes the raw body, and the endpoint's own `baseUrl` override is not overridden
by `createResilientOctokit` (which passes only `auth` + `throttle`). The logged path is
origin-stripped because request-log does `requestOptions.url.replace(options.baseUrl, '')` against
the MERGED baseUrl -- so a path-only log line is expected and is NOT evidence of a wrong origin.
Priority 4 (an octokit-side / wrong-origin 422) is eliminated: each 422 carries a real
`x-github-request-id`, so GitHub itself validated and rejected.

### E5 -- Exactly TWO things changed on the upload call vs the last-good push (MEASURED)

`git diff origin/main...HEAD` over the publish path. The octokit stack is UNCHANGED
(`@octokit/rest` 22.0.1, `@octokit/core` 7.0.6, `@octokit/plugin-retry` 8.1.0,
`@octokit/plugin-throttling` 11.0.3; the only `package.json` additions are eslint devDeps).
`resilient-octokit.ts` and `octokit-status.ts` are byte-identical to main. The delta is:

1. **CORR-02 -- the asset NAME shape.** `releaseAssetName(hash)` is now
   `` `${CACHE_KEY_PREFIX}${hash}` `` = `nx-cache-<hash>`, replacing the previous `<hash>-<os>`.
2. **OBS-03 -- a NEW `label` query param.** `uploadReleaseAsset(releaseId, name, bytes, label)`
   gained a 4th positional and forwards `label: 'mirrored-by: <os>'`.

Confirmed against the live mirror: `cache-mirror-202607` (id 354838660) holds 155 assets, ALL in
the old shapes (`<hash>-linux`, `<hash>-windows`, `<hash>.tar.gz`), the newest uploaded
2026-07-28T21:24:42Z, and **every one has an empty label**. So no upload has ever succeeded with
either the new name shape or a non-empty label.

### E6 -- The new name shape AND the new label are both PROVEN GOOD against live GitHub (MEASURED)

This is the observation that eliminates the entire "the request shape changed" family. The live
`cache-mirror-202607` shard already holds **24 assets in the CURRENT `nx-cache-<hash>` shape, every
one carrying a non-empty `mirrored-by: <os>` label**, uploaded successfully on 2026-07-29:

```
2026-07-29T16:44:26Z  nx-cache-feed230471772954     label=[mirrored-by: linux]
2026-07-29T16:44:40Z  nx-cache-cafe30400231720      label=[mirrored-by: linux]
2026-07-29T16:48:37Z  nx-cache-feed030471772954     label=[mirrored-by: windows]
2026-07-29T23:43:59Z  nx-cache-feed230500255530     label=[mirrored-by: linux]
2026-07-29T23:47:24Z  nx-cache-feed030500255530     label=[mirrored-by: windows]
   ... 24 total, 155 assets in the shard, 24 with non-empty labels, 0 in a non-`uploaded` state
```

Shape census of that shard: 81 legacy `<hash>-<os>`, 50 PoC `<hash>.tar.gz`, **24 current
`nx-cache-<hash>`** = 155. The 24 labelled ones are exactly the 24 current-shape ones.

Cross-check against run 30767511870's ubuntu leg: of its 32 attempted uploads, **exactly 24 are
these same names** and 8 are new to this run (the seed, the run-id keys and this run's task
hashes). All 32 got 422 -- including the 8 that exist nowhere.

So CORR-02 and OBS-03 shipped to `main` in an earlier temporary push window (2026-07-29) and
**GitHub accepted both**. Neither is the trigger.

### E7 -- ROOT CAUSE: the new shard was born IMMUTABLE (MEASURED, decisive)

The only structural difference between the shard that accepts uploads and the shard that rejects
every one of them:

| field | `cache-mirror-202607` (id 354838660) | `cache-mirror-202608` (id 363897680) |
|---|---|---|
| **`immutable`** | **`false`** | **`true`** |
| created_at | 2026-07-16T02:51:16Z | 2026-08-02T12:36:20Z (= `ce197701`'s commit date) |
| published_at | 2026-07-16T02:52:07Z | 2026-08-02T21:20:05Z (this run's `createRelease`) |
| draft / prerelease | false / false | false / false |
| assets | 155 (24 in the current shape) | **0** |

`gh api repos/op-nx/github-cache/commits/ce1977016...` returns committer date
`2026-08-02T12:36:20Z`, so the shard's `created_at` is just the tag target's commit date -- there
is no hidden draft phase. The `published_at` is this run's create, to the second.

GitHub's own specification of the feature (changelog 2025-09-18 "Immutable releases are now
generally available", and
`docs.github.com/en/code-security/.../immutable-releases`), quoted verbatim:

> **Immutable assets**: Once you publish a release as immutable, its assets **can't be added**,
> modified, or deleted.

> You can enable immutable releases at the repository or organization level in your settings. Once
> enabled: **All new releases are immutable**... **Existing releases remain mutable unless you
> republish them.** Disabling immutability doesn't affect releases created while it was enabled.
> They remain immutable.

> **Release assets cannot be modified or deleted**: All files attached to the release ... are
> protected from modification or deletion.

> Once an immutable release is published, its associated Git tag is locked to a specific commit,
> cannot be changed, and cannot be deleted while the release exists. **If you delete the immutable
> release, you can delete the tag, but you cannot reuse the same tag name.**

> **Best practices** ... 1. Create the release as a draft. 2. Attach all associated assets to the
> draft release. 3. Publish the draft release.

Every observation falls out of this with zero residue:

- `cache-mirror-202607` predates the setting -> `immutable: false` -> still accepts uploads, which
  is why the 2026-07-29 pushes with the identical name+label shape succeeded (E6).
- `ensureShardRelease` called `createRelease(tag)` with no `draft: true`, so the August shard was
  created **already published** and therefore **already immutable**.
- From that instant no asset can ever be added to it. Both legs, every name, every label, every
  payload size, unique-per-run seed included: **422, deterministically, forever**. That is exactly
  32/32 and 33/33.
- `publish` still reported SUCCESS because the engine reads only `statusOf(error) === 422` and
  calls it a benign `already_exists` race.
- `publish-verify` then read back a seed asset that was never written -> MISS -> RED.

The "month-boundary" instinct in the trigger was directionally right and mechanically wrong: this
is not a race at the rollover, it is that **the first shard created after the repo/org enabled
immutable releases is born frozen and empty**, and every future month's shard will be too.

**Two consequences that are NOT fixable in this repo's source:**

1. `cache-mirror-202608` is permanently dead. Immutability cannot be lifted from an existing
   release; disabling the setting does not retroactively free it.
2. Per the docs above, even DELETING the release does not recover the tag: `cache-mirror-202608`
   **can never be reused as a tag name in this repository**. So the August shard is unrecoverable
   under the current `shardTag()` scheme.

### E8 -- The immutable-releases CONTROL is unreadable from here (MEASURED, clean negative)

The maintainer cannot weigh "disable the setting" against "reshape sharding" without knowing
whether this repo can opt out at all. Read-only probes, GETs only, 2026-08-03:

| probe | result |
|---|---|
| `gh api repos/op-nx/github-cache/rulesets` | `[]` -- no repo-level rulesets at all |
| `gh api repos/op-nx/github-cache/rules/branches/main` | `[]` -- no rules apply to `main` |
| `gh api repos/op-nx/github-cache` (whole body) | no `immutable` token (`rg` exit 1; positive control on `releases_url` exit 0, so the zero is real and not a failed command) |
| `.security_and_analysis` | only the 5 dependabot / secret-scanning switches, every one `disabled` |
| `gh api orgs/op-nx` | no `immutable` and no `release` token |
| `gh api orgs/op-nx/rulesets` | **404 + `This API operation needs the "admin:org" scope`** |

Token scopes are `gist, read:org, repo, workflow, write:packages`. **`admin:org` is absent, so the
org-level surface is unreadable from here.** As instructed, NO scope escalation, token change or
auth change was attempted -- this is where the probe stops.

What this establishes, and what it deliberately does NOT:

- The repo has ZERO rulesets, so the setting is not a repo ruleset, and no read-only repo surface
  reachable with this token exposes an immutable-releases flag.
- It does NOT follow that the control is therefore org-level. The only positive evidence of the
  setting anywhere is still the RELEASE object's own `immutable: true` (E7), which is the OUTCOME,
  not the control. A plain repo Settings toggle with no REST projection is equally consistent with
  every observation above.
- So D1 cannot be answered by probing at all. It needs a human to read repo Settings and the org
  settings in a browser. That is a clean negative, and it is the honest result.

## Eliminated

- **The asset NAME shape (CORR-02, `nx-cache-<hash>`).** ELIMINATED by direct measurement: 24
  assets in exactly that shape are live in `cache-mirror-202607`, uploaded 2026-07-29. (E6)
- **The new `label` query param (OBS-03, `mirrored-by: <os>`).** ELIMINATED by the same
  measurement: all 24 of those assets carry exactly that label. (E6)
- **A shard-creation propagation race (upload issued 0.6s after `createRelease`).** ELIMINATED.
  The windows leg uploaded into the same release id **3 minutes later** and got 422 on all 33.
- **Permissions.** ELIMINATED. The `publish` job declares `contents: write` + `actions: read`
  (ci.yml:2050-2052) and `createRelease` SUCCEEDED with that token; a scope fault is 403, not 422.
- **Empty or corrupt restored bytes.** ELIMINATED. `dogfood-verify` passed on BOTH OS legs in this
  same run, and that job asserts exact byte equality against `dogfoodBody` through the same
  `actionsCache.get` -> `readFile` path the publisher uses.
- **A JSON-serialized body instead of raw binary.** ELIMINATED.
  `node_modules/@octokit/request/dist-src/fetch-wrapper.js:16` only `JSONStringify`s a plain object
  or an array; a `Buffer` passes through untouched.
- **The 422 is `already_exists` (the benign reading the code assumes).** ELIMINATED. The ubuntu
  leg's own `GET .../tags/cache-mirror-202608 -> 404` proves the release did not exist one second
  before its first upload, so release 363897680 held zero assets when `nx-cache-feed230767511870`
  was rejected. Nothing could already exist. (E2)
- **Draft release / missing tag / wrong release id / upload-URL mismatch.** ELIMINATED. `draft:
  false`, the tag exists at `ce197701`, and the id in the failing POSTs is the same id
  `getReleaseByTag`/`createRelease` returned. (E3)
- **A 422-shaped octokit request-validation error, wrong `origin`/baseUrl, or a bad URL
  template.** ELIMINATED. Every 422 carries an `x-github-request-id`, so GitHub answered; and the
  installed endpoint definition pins `baseUrl: https://uploads.github.com` with `{?name,label}`,
  which the logged query string confirms was expanded correctly. (E4)
- **A dependency/toolchain change under the upload.** ELIMINATED. No octokit or `@actions/*`
  version moved between `origin/main` and this tip. (E5)
- **The ROBUST-05 1000-asset cap.** ELIMINATED. The target shard held 0 assets; the cap branch
  logs a `core.warning` and neither leg's log contains one.

## UNRESOLVED

Both items below are MAINTAINER DECISIONS. Both were explicitly NOT granted at the 2026-08-03
checkpoint, and neither was self-approved. **The GREEN fix resolves NEITHER of them.** Nothing in
this session changed a repo or org setting, and no release, tag, asset or Actions-cache entry was
created, modified or deleted -- every GitHub call made while closing this session was a GET.

### BLOCKER D1 -- immutable releases vs the monthly-shard scheme. State: OPEN.

Until this is decided the mirror cannot write a single asset. The monthly-shard design REQUIRES a
release that keeps accepting assets for a whole month; an immutable release accepts none after
publication (E7). The two are incompatible by construction, and this is not a one-off: every
future month rolls over into the same dead shard.

Competing options -- none chosen, listed with the grounds against each:

- **D1-a: disable immutable releases** at whichever level owns it, so next month's shard is born
  mutable. Cheapest, zero code change. Against: it gives up a supply-chain integrity control that
  someone may have enabled deliberately, and per E8 we cannot even see WHERE it is set, so we
  cannot know who set it or why. It also does nothing for August (D2).
- **D1-b: create the shard as a DRAFT, upload, then publish** -- GitHub's own documented best
  practice for immutable releases. Against: it is structurally hostile to this design. The shard
  is written INCREMENTALLY across a month and across two OS legs, so the draft would have to stay
  unpublished all month, and a draft release's assets are not reachable by the anonymous consumer
  read path. It turns "publish at month end" into a new scheduled job with its own failure modes.
- **D1-c: reshape sharding** so each publish run creates its OWN release under a per-run or
  per-day tag and publishes it once, closed -- compatible with immutability by construction.
  Against: it changes `shardTag()`, the retention-window arithmetic, the cleanup engine's shard
  enumeration AND the consumer READ contract. All four are explicitly out of scope at this
  checkpoint, and together they are milestone-scale.

Why confidence is not high enough to auto-decide: the real choice is between weakening a security
posture (D1-a) and a milestone-scale redesign that reaches the consumer read contract (D1-c), with
D1-b sitting between them and fighting the incremental-write model. E8 additionally proves the
control cannot be located read-only, so even recommending D1-a would be advice about a setting
whose owner and rationale are unknown. HIGH IMPACT plus NOT-HIGH CONFIDENCE -- the one quadrant
that must not be auto-decided.

### BLOCKER D2 -- the dead `cache-mirror-202608` shard and its burned tag name. State: OPEN.

No action taken. `cache-mirror-202608` (id 363897680) is frozen at zero assets and cannot be
un-frozen: GitHub states that disabling immutability does not affect releases created while it was
enabled. Worse, per the same docs, deleting an immutable release lets you delete its tag but the
tag name **can never be reused** -- so `cache-mirror-202608` is permanently unavailable under the
current `shardTag()` scheme no matter what is decided for D1.

Competing options -- none chosen:

- **D2-a: leave it.** August has no mirror; the scheme resumes in September, but only if D1-a
  lands first. Cost: one month of mirror coverage.
- **D2-b: delete the empty release.** A destructive call, forbidden this session. It does NOT
  recover the tag name, so it buys cosmetics only.
- **D2-c: change the tag scheme** so August gets a reachable name -- but that IS D1-c and cannot
  be decided independently of D1.

Why confidence is not high enough: D2 is strictly downstream of D1 (a tag-scheme change subsumes
it), and the only unilateral action available is destructive and irreversible on a public repo.

## Resolution

root_cause: |
  TWO defects, one environmental and one in this repo's source. They compound, and only the
  second is fixable here.

  (1) TRIGGER (environmental, NOT a code regression). The repository or its organization has
  GitHub's **immutable releases** enabled. `ensureShardRelease` creates a missing month shard with
  `createRelease(tag)` and NO `draft: true`, so the release is born PUBLISHED and therefore born
  IMMUTABLE. GitHub then refuses every `POST .../releases/{id}/assets` on it with 422, forever.
  `cache-mirror-202608` (id 363897680, `immutable: true`) was created that way by run
  30767511870's own ubuntu publish leg at 21:20:05Z and is frozen at ZERO assets. The previous
  shard `cache-mirror-202607` (id 354838660, `immutable: false`) predates the setting, which is
  why the identical code shipped 24 current-shape, labelled assets into it on 2026-07-29 (E6/E7).
  This is a design incompatibility, not a one-off: the monthly-shard scheme REQUIRES a release
  that accepts assets over the whole month, and an immutable release accepts none after
  publication. Every future month rolls over into the same dead shard.

  (2) WHY IT SHIPPED SILENT (the source defect). `publish-mirror.ts:328-336` classifies the 422
  on `uploadReleaseAsset` as a benign `already_exists` duplicate-upload race using
  `statusOf(error) === 422` -- STATUS ALONE. It never reads `error.response.data.errors[].code`,
  even though the injected-client seam and its own spec fake already carry that body. So 32 of 32
  (ubuntu) and 33 of 33 (windows) permanent, fatal upload rejections were counted as `skipped`,
  `failed` stayed 0, the aggregate `core.setFailed` never fired, and both publish legs exited
  GREEN with `mirrored: 0`. Nothing in the run artifacts named the cause: octokit's request-log
  plugin logs method/path/status/request-id only and never the response body (E1). The failure
  surfaced one job later as publish-verify's "cache MISS ... suspect the month-shard tag", which
  points at the wrong subsystem.

fix: |
  APPLIED (source defect #2 only). `publish-mirror.ts` now reads the 422 body before deciding.
  A new module-local `uploadFaultCode(error)` extracts `response.data.errors[].code`, and the
  upload catch takes the benign first-write-wins skip ONLY on
  `statusOf(error) === 422 && code === 'already_exists'` -- the sole 422 GitHub documents for
  this endpoint. Every other 422 falls through to the existing per-item fault branch: `failed++`
  plus a `core.warning` that now prints the asset name, the numeric status AND GitHub's own
  reason code, routing into the pre-existing aggregate `failed > 0 -> core.setFailed`.

  Defensive shape, deliberately: the 422 body is NOT guaranteed, and the exact code GitHub
  returns for an immutable-release upload was never measured (the body is never logged -- E1).
  A missing `response`, a missing or non-array `errors`, and a missing or non-string `code` all
  yield `undefined`, and `undefined` is counted as `failed`, never as benign. The warning prints
  `code unknown` in that case. Guessing benign is the entire defect; it is not reintroduced one
  level down.

  Also corrected: the engine doc block's stale "a duplicate-upload race returning 422 is likewise
  benign" prose, and the now-wrong "discriminated on status alone, never on body text" comment at
  the catch. The `ensureShardRelease` 422 branch is UNTOUCHED -- that one is a genuine
  create-race and is out of scope.

  WHAT THE FIX DOES NOT COVER -- state this plainly, it is easy to overstate:
  The fix makes the publish leg go RED instead of silently green while D1 is unresolved. That is
  the INTENDED signal, not a side effect: a loudly-broken mirror beats a silently-broken one. But
  it means the fix alone does NOT unblock PR #16 and does NOT repair the mirror. It converts a
  confusing downstream read-back failure in the wrong subsystem (publish-verify's "cache MISS ...
  suspect the month-shard tag") into a clear upstream one that names GitHub's own reason at the
  point of failure. Both publish legs will now FAIL on the next `main` push until D1 is decided
  and acted on. Nothing here resolves D1 or D2 -- see UNRESOLVED above.

verification: |
  TDD red -> green, then the full package suite, all in the main tree.
  - The RED test "counts a 422 that is NOT already_exists as a real fault, never a benign skip"
    now PASSES: `failed: 1, skipped: 0` with one `core.warning` and one `core.setFailed`.
  - Its positive twin "treats a 422 already_exists upload race as a benign skip" still PASSES,
    unchanged -- it already supplied `{ errors: [{ code: 'already_exists' }] }`, so the benign
    path is still exercised and is now exercised for the right reason.
  - `npx nx test github-cache`: 42 files, 980 tests, ALL PASS. NO existing test asserted the old
    swallow-as-skipped behaviour, so nothing had to be edited to accommodate the fix -- the bug
    was never encoded in a test, which is exactly why it shipped.
  - `npx nx run-many -t typecheck lint --projects=github-cache`: clean.
  - `npm run check:action` (rebuild + `git diff --exit-code -- start-cache-server/index.js`) in
    the MAIN tree: no drift. publish-mirror.ts is confirmed NOT `serve()`-reachable by RUNNING
    the guard, not by reading it, so no bundle regeneration was needed in this commit.

  NOT verified, and unverifiable read-only: that GitHub returns any particular `errors[].code`
  for an immutable-release rejection. The fix does not depend on that value -- every
  non-already_exists 422 is a fault regardless -- and the next failing run will now PRINT the
  real code, which is what finally measures it.

files_changed:
  - packages/github-cache/src/publish/publish-mirror.ts: 422 classifier reads errors[].code; only
    an explicit already_exists is a benign skip; warning now names the code; two stale comments
    corrected.
  - packages/github-cache/src/publish/publish-mirror.spec.ts: the RED-then-GREEN negative-twin
    test for a non-already_exists 422.

## Current Focus

hypothesis: CONFIRMED (E7) and the source half is now FIXED. The August shard was created
  already-published under GitHub's immutable-releases setting, so it is permanently closed to new
  assets and every upload 422s; the status-only 422 classifier in publish-mirror.ts then reported
  that total failure as green. The classifier now reads the body and only an explicit
  `already_exists` is benign.
test: TDD red -> green COMPLETE. Full package suite, typecheck, lint and the action-bundle-drift
  guard all run in the main tree and all clean.
expecting: n/a -- verification done, see Resolution.verification.
next_action: NOTHING further in this repo without a maintainer decision. Both remaining items are
  BLOCKERs recorded under UNRESOLVED above (D1 immutable-releases setting, D2 the dead
  `cache-mirror-202608` tag) and neither may be self-approved. The next `main` push will now show
  the publish legs FAILING with GitHub's own reason code printed -- that is the fix working as
  intended, NOT a new regression, and it is also the measurement that finally captures the
  unmeasured `errors[].code` for an immutable-release rejection (E1/E8 blind spot). PR #16 stays
  blocked on D1.

tdd_checkpoint:
  test_file: "packages/github-cache/src/publish/publish-mirror.spec.ts"
  test_name: "counts a 422 that is NOT already_exists as a real fault, never a benign skip"
  status: "green"
  failure_output: |
    RED (before the fix), failing for exactly the misclassification the root cause names:
    - "failed": 1,
    + "failed": 0,
      "mirrored": 0,
      "readMisses": 0,
      "scanned": 1,
    - "skipped": 0,
    + "skipped": 1,
    Test Files  1 failed (1) | Tests  1 failed | 28 passed (29)
  green_output: |
    GREEN (after the fix):
    Test Files  1 passed (1) | Tests  29 passed (29)
    Full package suite: Test Files 42 passed (42) | Tests 980 passed (980)

reasoning_checkpoint:
  hypothesis: "cache-mirror-202608 was created already-published while GitHub's immutable-releases
    setting was on, so it is permanently closed to new assets and every upload 422s; the
    status-only 422 classifier then reported that total failure as a green publish leg."
  confirming_evidence:
    - "Direct GET: the failing shard has immutable=true, the working shard immutable=false (E7)"
    - "24 assets in the exact new name shape WITH the exact new label uploaded successfully into
       the mutable shard on 2026-07-29, so neither CORR-02 nor OBS-03 is the trigger (E6)"
    - "GitHub's own spec: assets cannot be ADDED to a published immutable release; all new
       releases are immutable once the setting is on (E7, quoted verbatim)"
    - "The ubuntu leg's own tag GET returned 404 one second before its first 422, so the release
       was empty and already_exists was impossible (E2)"
  falsification_test: "An upload into a release with immutable=false, using the same name shape
    and label, would have to also 422. It measurably does NOT -- that is exactly the 2026-07-29
    upload set in E6. Conversely, if a future upload into an immutable=true release SUCCEEDS, the
    hypothesis is dead."
  fix_rationale: "The source fix targets the defect the source actually owns -- a benign-by-default
    422 classifier that converts fatal, permanent upload rejections into `skipped` and exits 0. It
    is not a workaround for immutability; it is what makes immutability (and every other
    non-already_exists 422) fail loud at the point of failure instead of surfacing one job later
    in the wrong subsystem."
  blind_spots: "The exact errors[].code GitHub returns for an immutable-release upload is NOT
    measured -- the body is never logged (E1) and reproducing it needs a write. The fix does not
    depend on that value (it treats every non-already_exists 422 as a fault), but the spec's
    `code: 'immutable'` literal is illustrative, not measured. Whether the setting is enabled at
    repo or org level is also unmeasured: /orgs/op-nx/rulesets needs admin:org, and the plain repo
    object does not expose the flag."

---

## ADDENDUM -- maintainer actions 2026-08-03, and two corrections to this session

### The branch is NOT the cause. This session's own trigger text is wrong on that point.

Recorded because both `STATE.md` and this file's `trigger` call it "a regression this branch
introduced" and cite "1888 insertions" in the publish path. **That inference does not hold.**

`createRelease` -- the call that decides the shard's born state -- is in
`action/index.ts:103-111` and is **byte-identical to `origin/main`**
(`git diff origin/main...HEAD -- packages/github-cache/src/action/index.ts` shows no change to it).
The publish path that creates the shard is the same code that produced five green `main` pushes.

What actually changed is a **repository setting**, not the branch. The two shards side by side:

| Shard | `immutable` | Assets | Created |
|-------|-------------|--------|---------|
| `cache-mirror-202607` | field **absent** | **155** | 2026-07-16 |
| `cache-mirror-202608` | **`true`** | **0** | 2026-08-02 |

Immutable releases were turned on somewhere between those two dates. The branch's only relationship
to the failure is that it happened to be the tip pushed when the first post-change shard was born.

### Correction: the immutable release WAS deletable

This session concluded "immutability cannot be lifted, and deleting the release does not free the
name". The first half is **wrong, measured**: `DELETE /releases/363897680` returned success and the
release is gone (`GET` now 404s). The leftover tag ref was then deleted too, verified by exit code
with a positive control (`cache-mirror-202607` still resolves; `cache-mirror-202608` does not; the
only remaining `cache-mirror` tag is `202607`).

Checked before deleting the tag: `ce197701` is an ancestor of the branch HEAD and present on
origin, so removing the ref could not orphan it. Confirmed still reachable afterwards.

Net: August is recoverable after all. A fresh `cache-mirror-202608` will be created by the next
`main` push, now under the corrected setting, rather than the month being written off.

### Maintainer actions taken

1. **Immutable releases DISABLED** by the maintainer in repo settings (browser; not API-reachable
   with the available token scopes).
2. **`cache-mirror-202608` release and tag DELETED.** Zero assets, so nothing was lost.
3. **The design limitation is DEFERRED to a later milestone**, by maintainer decision. Immutable
   releases and the monthly-shard mirror are structurally incompatible -- a shard must accept
   assets all month, an immutable release accepts none after publication, and the draft ->
   attach -> publish workaround is closed off because a draft release is not anonymously readable
   and anonymous read is the mirror's contract. This is a real limitation of the design, not a
   bug, and it is now a standing exposure: anyone re-enabling the setting silently kills the
   mirror again. Recorded in `STATE.md` Deferred Items.

The classifier fix in `e96670e` stands on its own merit regardless of the setting: it is what makes
this class of failure fail LOUD at the point of failure instead of surfacing one job later in the
wrong subsystem. It is not a workaround for immutability.

### Verification window RESULT -- run 30773689490. The fix WORKS. A SECOND defect is now the blocker.

Window executed and closed cleanly (see the log at the end of this section). Outcome:

| | Before (`30767511870`) | After (`30773689490`) |
|---|---|---|
| `publish` | **green**, having mirrored nothing | **RED, at the point of failure** |
| `publish-verify` | **red**, naming the wrong subsystem | `skipped` (never reached) |

**That inversion is exactly what `e96670e` was for** and it is the fix's proof: the failure stopped
laundering itself through a downstream job. The run is still red, but for an honest reason now.

### E10 -- the SAME defect class exists at a SECOND site, and this session wrongly cleared it

`publish` now dies with an UNCAUGHT `Not Found` on `get-a-release-by-tag-name`, on both legs
(ubuntu 00:11:07, windows 00:14:10 -- three minutes apart, so not a race).

`ensureShardRelease` has exactly one unguarded `getReleaseByTag`: the one INSIDE its 422 branch.
So the measured sequence is forced:

1. `getReleaseByTag('cache-mirror-202608')` -> **404** -> caught, falls through (correct)
2. `createRelease('cache-mirror-202608')` -> **422** -> caught, assumed "another leg won the race"
3. `getReleaseByTag('cache-mirror-202608')` -> **404 again** -> **UNCAUGHT** -> job dies

**Step 2's assumption is falsified by direct measurement.** After the run, all four probes agree
that nothing was created by anyone: no `cache-mirror-202608` release, no `cache-mirror-202608` tag
ref (exit 1, with `cache-mirror-202607` as a passing positive control), no draft release, and the
only `cache-mirror` tag on the remote is `202607`. A 422 meaning `already_exists` is impossible
when the resource provably does not exist -- the identical logic that broke the upload path.

This session explicitly cleared that branch in `e96670e`'s own commit body: *"The
`ensureShardRelease` 422 branch is untouched -- that one is a genuine [race]"*. **That reasoning
was wrong**, and it was wrong in precisely the way the session had just finished diagnosing one
level down: `statusOf(error) === 422` tested alone, never the body's `errors[].code`. The fix
closed one instance of the defect and left its sibling standing, then that sibling became the
blocker on the very next run.

**Why `createRelease` is rejected is NOT established.** The body is still unreadable for the same
structural reason as E1 (the octokit request-log plugin logs no response body), and `createRelease`
has no `uploadFaultCode` equivalent. Candidates, none measured: the immutable-releases setting not
actually taking effect on this path, an org-level policy the repo toggle does not cover
(`orgs/op-nx/rulesets` still needs `admin:org`), or a tag/ruleset restriction on `cache-mirror-*`.

**Next move, and it is the only one that can see the body:** apply the same `errors[].code`
discrimination to `ensureShardRelease` -- reuse `uploadFaultCode` (rename it to something
site-neutral), require an explicit `already_exists` before the re-GET, and log the real code on
every other 422. Then one more `main` window makes GitHub name its own reason.

### Window log -- every step verified, not assumed

| Step | Result |
|------|--------|
| Backup `main` | `refs/backups/main-pre-publish-verify-window` -> `fe25a3f`, confirmed present on the remote BEFORE the push |
| Close PR #16 first | `state=CLOSED mergedAt=null` (its head `1162a01` WAS the tip being pushed, so this was mandatory) |
| Push | `fe25a3f..1162a01` -> `refs/heads/main` |
| PR #16 immediately after push | still `CLOSED mergedAt=null` -- the permanent-merge trap did not fire |
| Restore `main` | `--force-with-lease` back to `fe25a3f`, re-read from the remote and confirmed |
| PR #16 after restore | `CLOSED mergedAt=null`, then reopened -> `OPEN`, `mergedAt=null` |

Also cleaned up beforehand and worth noting for the next window: the dead `cache-mirror-202608`
release and tag were both deleted, so this run exercised the create-from-scratch path for the
first time this month. That is WHY the second defect surfaced now rather than staying latent --
before the deletion, `getReleaseByTag` always succeeded and steps 2 and 3 never ran.
