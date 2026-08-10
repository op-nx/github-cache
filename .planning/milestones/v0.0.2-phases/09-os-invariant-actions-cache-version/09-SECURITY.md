---
phase: 09-os-invariant-actions-cache-version
audited_tree: 14a2f782335ee519e7f0e3ea5500fb869ec97f79
audited_range: 4296d1d..HEAD
branch: gsd/v0.0.2-os-invariant-cross-os-sharing
audited_at: 2026-07-29
auditor: gsd-security-auditor
config:
  security_enforcement: true
  security_asvs_level: 1
  security_block_on: high
status: passed
blocker: false
threats_total: 72
threats_verified: 72
threats_partial: 0
threats_open: 0
severity_breakdown:
  high: 45
  medium: 22
  low: 5
severity_open:
  critical: 0
  high: 0
  medium: 0
  low: 0
disposition_breakdown:
  mitigate: 67
  accept: 5
new_findings_total: 1
new_findings:
  - id: F-09-A
    severity: low
    category: denial-of-service
    title: publish job's shard-growth estimate rested on the removed OS partition
    state: closed_in_this_audit
    file: .github/workflows/ci.yml
hygiene_scan:
  method: allowlist-inversion
  files_scanned: 43
  disallowed_maintainer_tokens: 0
  commits_checked: 37
  commit_identity_clean: true
edits_made:
  - .github/workflows/ci.yml
battery_reverified:
  - format:check
  - test
  - lint
  - fallow:ci
  - check:action
---

# Phase 9 Security Audit -- OS-invariant `@actions/cache` cache version

**Verdict: `passed`. 72 of 72 `T-09-NN` rows verified against the implemented artifact.
Zero open threats at any severity, so nothing blocks phase advancement under
`security_block_on: high`.**

One NEW finding outside the register (`F-09-A`, low, DoS/capacity) was found by the
cross-OS-assumption sweep and closed in this audit with a comment correction to
`.github/workflows/ci.yml`. It was never a `high`, so it was not a blocker either way.

Method: for each row I read the stated mitigation and then read the artifact it names --
source, spec, workflow, config, or git history. No row was credited on a SUMMARY's claim.
Twelve rows were additionally confirmed by RUNNING something (the test suite,
`check:action`, `format:check`, `lint`, `fallow:ci`, `git merge-base --is-ancestor`,
`git log -S`) rather than by reading. Re-measured at HEAD plus my edit: **671/671 tests
across 38 files**, and `format:check`, `test`, `lint`, `fallow:ci`, `check:action` all
exit 0 with an empty bundle diff.

---

## 1. The highest-value question: did any OTHER site depend on the OS partition?

This was the brief's priority, because the phase found one such site
(`roundtrip/read-back.ts`) only via a live CI failure on run `30400231720`. I swept the
repo for the whole class rather than for the symptom, in two directions.

### 1a. Prose / doc-block claims

`git grep -n -i -e "same OS" -e "same-OS" -e "own OS" -e "own-OS" -e "by construction"`
over `packages/`, `.github/`, `docs/`, `README.md`, `start-cache-server/`. Every hit
resolves to one of five buckets, and all five are accounted for:

| Site | State |
|---|---|
| `docs/advanced.md` (x2), `README.md`, `docs/trust-and-security.md`, `ci.yml` publish matrix (`:990-995`), `ci.yml` `integration` comment (`:388`, `:409`) | CORRECTED, and phrase-pinned by `docs-same-os-claims.spec.ts:50-151` (6 rows / 4 files, 3 corrections + 3 additive) |
| `roundtrip/read-back.ts:71-137` | CORRECTED by plan 09-08, now spec-covered by `read-back.spec.ts` |
| `publish-mirror.ts:146` ("a foreign-OS or evicted entry MISSes its same-OS restore") and `:159`, plus `publish-mirror.spec.ts:410`'s matching comment | STALE, but a RECORDED deferral to Phase 10, named in `09-RESEARCH.md:804-805`, `09-06-PLAN.md:129,178,509` and `09-06-SUMMARY.md:317-319` |
| `ci.yml:1103-1105` (`publish-verify` job comment, "proves the same-OS publisher->reader contract") | STALE, but a RECORDED deferral to Phase 10 / TRUST-11, called out by name -- and called FLATLY FALSE -- in `read-back.ts:128-137` |
| `ci.yml:1051-1058` (publish job shard-growth estimate) | **NOT recorded anywhere. This is `F-09-A` below.** |

So the phase's own sweep was more complete than the brief's framing suggests: two stale
sites survive deliberately, with a named owner, and neither is a security control. The
sixth site is the one nobody had.

### 1b. Executable logic

The read-back regression shipped because a same-OS premise sat in a `//` comment above
the comparison it justified, in code, where DOCS-08's documentation-scoped sweep could
not see it. So I enumerated every site that makes an INFERENCE from a restore outcome or
from a producer identity:

- `roundtrip/read-back.ts:138-140` -- the fixed site. Now scans `CACHE_OS_VALUES`.
- `action/index.ts:328` -- hardcodes `expectedProducerOs = 'linux'`. **Correct, and must
  stay hardcoded**: `dogfood-seed` is single-leg ubuntu by construction, structurally
  pinned by `dogfood-cross-os.spec.ts:97-108`'s no-matrix clause. The asymmetry against
  `read-back.ts` is intentional and locked in both directions (`read-back.ts:110-120`).
- `publish-mirror.ts:290-330` -- the all-restore-MISS warning. Reads counts, infers no
  correctness property; reworded by 09-06. Not a partition dependency.
- `backend/releases-backend.ts` + `lib/release-asset-name.ts` -- resolve the reader's
  OWN-OS asset NAME. Deliberately same-OS, and unaffected: the asset name is a Releases
  concern, not an `@actions/cache` cache-version concern. `read-back.ts:30-38` states
  exactly this distinction.
- `cleanup/` -- swept for `platform` / `windows` / `linux` / `OS`. **Zero OS dependence**;
  the single `Windows` hit (`cleanup/index.ts:120`) is an unrelated entrypoint-idiom
  comment. Cleanup keys on age and on `isServerProducedKey`, never on producer OS.
- `hash-parity/compare.ts` -- the `integration` exclusion rides the Nx TASK hash's
  `{ "runtime": "node -p process.platform" }` discriminator (`nx.json:102`), a DIFFERENT
  axis that this phase did not touch (`nx.json` diff is exactly +1 line).

**No trust or isolation control depended on the OS partition.** That is a substantive
conclusion, not an absence of effort: the Actions-cache read/write boundary is GitHub's
per-ref scope plus this repo's own write gate (`selectBackend` / `isTrustedSyncEvent`),
and both are OS-blind. The OS partition was an accident of the version hash, never a
security boundary. Two runners in the same scope were already mutually trusted; the phase
did not widen who can write, only which of an already-trusted writer's bytes a reader
will accept.

### F-09-A -- shard-growth estimate rested on the removed partition (LOW, closed)

`.github/workflows/ci.yml:1051-1058` read:

> expect ~5 real ones per input-changing push: 4 from the ubuntu leg (build, typecheck,
> test, integration-linux) and 1 from the windows leg (integration-win32, **which only the
> Windows leg can restore**). So roughly 125 default-branch pushes inside ONE calendar
> month before that month's shard reaches RELEASE_ASSET_CAP

The bolded premise is exactly the claim VER-01 + VER-03 falsified. Traced through:

1. `integration` carries a per-OS Nx task hash (`nx.json:102`), so `nx-cache-<linuxhash>`
   and `nx-cache-<win32hash>` are distinct KEYS. `getActionsCacheList` enumerates all of
   them on either leg -- enumeration was never OS-scoped.
2. Pre-phase, the windows leg could RESTORE only its own save, so it mirrored 1 of 5.
3. Post-phase each leg restores all ~5 and uploads under its OWN `<hash>-<os>` suffix
   (`releaseAssetName`), so per-push real assets go **~5 -> ~10** and the headroom before
   `RELEASE_ASSET_CAP = 1000` (`publish-mirror.ts:28`) goes **~125 -> ~75 pushes/month**.

Why LOW and not higher: the cap degrades to skip-and-warn, never a hard failure
(`publish-mirror.ts:251-253`, D-11), and retention prunes shards past the 30-day window.
So this is a wrong number in maintainer prose with a real capacity consequence, not an
availability break -- and the block sits in the four jobs the docs present as the
reference implementation adopters copy.

**Closed in this audit.** I corrected the comment in place: it now states the doubling,
names VER-01 + VER-03 as the cause, gives ~10 per push and ~75 pushes, and routes the
duplicate-pair-per-hash cost to its existing owner (OBS-05). Comment only -- no logic,
no YAML structure, no new assertion. Re-verified after the edit: `format:check` 0,
671/671 tests, `lint` 0, `fallow:ci` 0, `check:action` 0 with an empty bundle diff. In
particular `docs-same-os-claims.spec.ts`'s two `ci.yml` rows and its
`/whose byte[s]/i` retraction guard all still pass.

**Deliberately NOT done:** I did not add a seventh row to `DOCS_08_SITES`. That table's
count is comment-locked at six with an explicit D-32 reconciliation
(`docs-same-os-claims.spec.ts:19-28`); silently making it seven would break the record it
exists to keep. Recommendation instead: fold this site into Phase 10's TRUST-11 / OBS-05
work, which already owns the other two surviving stale sites, and pin all three together
then.

---

## 2. The five audit questions the brief raised

**(2) Rotation windows -- does anything fail OPEN?** No. The rotation is a restore MISS,
and every consumer of a MISS is fail-CLOSED or fail-loud: `get()` returns `{kind:'miss'}`
-> Nx rebuilds; `publishMirror` counts `readMisses` and skips (never mirrors garbage);
`dogfood-verify` and `read-back` treat a MISS as a hard failure
(`action/index.ts:333-345`, `read-back.ts:57-64`). The only softened path is the all-MISS
WARNING, and that softness is the deliberate D-28b decision (a tripwire that fires on
correct work gets disabled) with a reading instruction in place of persisted state. The
41-on-both-legs symmetric MISS measured on run `30400231720` is itself the evidence the
PATH rotated rather than the flag alone.

**(3) Path handling -- traversal, symlink, guard conjunction.**

- *Traversal: closed twice over.* `cacheArchivePath(hash)` interpolates a `Hash`, a
  branded type mintable ONLY through `parseHash` (`lib/cache-key.ts:37-39`) against
  `HASH_PATTERN = /^[a-f0-9]{1,512}$/`. Lowercase hex admits no `/`, `\`, `.`, `..` or
  `:`. Every non-spec call site routes through `parseHash`: `server.ts:111` (the HTTP
  trust boundary), `publish-mirror.ts:197`, `read-back.ts:44`. The only `as Hash` casts in
  the repo are in spec files. Incidentally the move IMPROVED Windows path length --
  `.nx/cache/` is ~30 chars shorter than the runner's absolute `tmpdir()`.
- *Symlink: considered, dismissed with reasoning.* `.gitignore` covers `.nx/cache`
  specifically, not `.nx/` wholesale, so `.nx` is nominally committable as a symlink that
  `mkdirSync('.nx/cache', {recursive:true})` would follow. Not a real boundary: the write
  path only constructs at all in a write-trusted context (a PR gets the read-only memory
  backend from `selectBackend`), and any workflow that has already run `npm ci` +
  `npm run build` on checked-out code has handed that code strictly MORE capability than a
  symlink redirect. Recording the reasoning rather than the row.
- *The VER-04 conjunction is a real conjunction, and each conjunct is independently
  proven.* `actions-cache-backend.ts:86-109`: conjunct 1 is `existsSync(join(cwd,
  'nx.json'))`, conjunct 2 is a case-folded `resolve()` comparison of `GITHUB_WORKSPACE`
  against `cwd`. Both are separate `if`/`throw` statements, not a single `&&` that could
  short-circuit past one. Both are observed THROWING, separately, at
  `actions-cache-backend.spec.ts:594-600` (conjunct 1) and `:602-607` (conjunct 2), with a
  happy path at `:587-592` -- so a suite that still passed with the guard deleted is
  excluded. The guard runs BEFORE the `mkdirSync` (`:121`), which is the ordering that
  stops a wrong cwd from silently creating `.nx/cache` in the wrong tree. Two ceilings are
  recorded rather than hidden: the case-fold false-negative on a case-sensitive
  filesystem (`:98-102`) and the cross-PROCESS archive-path invariant that `withHashLock`
  cannot cover (`cache-archive-path.ts:57-70`).

**(4) `resolveCompressionMethod()` subprocess.** Injection-safe and the `?? ''` cannot
mask an error into a misleading verdict.
`spawnSync('zstd', ['--quiet','--version'], {shell:false, windowsHide:true,
encoding:'utf8'})` -- file and both args are hardcoded literals, zero interpolation, zero
caller input, and the function takes no parameters at all
(`lib/compression-method.ts:96-110`). The whole options object AND the argv array are
pinned by `toStrictEqual` (`compression-method.spec.ts:188-198`), so an added or reordered
flag fails the build. On the `?? ''`: it is load-bearing exactly as claimed --
`@types/node` declares `stdout`/`stderr` non-nullable but a real ENOENT delivers both as
`null`, and without the coalesce this would THROW where upstream swallowed. It cannot
mislead a reader, because the resulting verdict (`gzip`) is byte-for-byte what upstream's
caught throw produces at `cacheUtils.js:115-117`, and that equivalence is the subject of a
dedicated test with a real ENOENT-shaped fixture (`:142-156`). The genuinely dangerous
inversion -- reporting `gzip` for a broken-but-present zstd -- is closed by the control
test at `:126-140` (non-zero exit + output -> zstd). `status` is structurally never read.
Six discrimination cases plus two invocation-shape cases. And the value is **surfaced,
never gated**: `compressionMethod` is read at exactly two places, `action/index.ts:187`
(`core.info`) and `:207` (summary), with no branch anywhere.

**(5) `dogfoodBody` / `read-back.ts` trust relaxation -- the bound genuinely holds.**
Acceptance is `CACHE_OS_VALUES.find((os) => result.bytes.equals(dogfoodBody(hash, os)))`.
`CACHE_OS_VALUES` is a closed 3-member `as const` tuple
(`lib/release-asset-name.ts:8`); `dogfoodBody` folds BOTH the producer OS and the hash
into the bytes (`lib/dogfood-body.ts:41`). So for a fixed hash, exactly 3 byte strings are
accepted where 1 was before -- **+2, exactly as intended**. The map is injective: no OS
label contains a `:`, and `hash` is lowercase hex, so
`nx-github-cache-dogfood:<os>:<hash>` cannot alias across a different (os, hash) pair. And
the hash is not attacker-chosen -- it comes from runner-injected `GITHUB_RUN_ID` through
`parseHash` (`read-back.ts:44-50`). What an attacker who can write a cache entry gains is
therefore: nothing beyond having the OTHER two OS labels accepted for the SAME hash. Every
rejection path still bites, and each is test-enforced at `read-back.spec.ts:103-139`:
garbage bytes, truncation (`Buffer.equals` compares length first), a neighbouring
same-length hash (the cross-run collision class), and a MISS. `dogfoodBody`'s two
parameters are structurally pinned default-free by `dogfoodBody.length === 2`
(`dogfood-body.spec.ts:48-50`) -- so the vacuity trap where the verify leg compares
against itself is closed by a test, not by review. The known loss (a dead Windows publish
path) is T-09-63: accepted, named, and owned by OBS-05.

**(6) `09-EVIDENCE.md` leaks nothing.** Scanned for `ghp_` / `ghs_` / `gho_` /
`github_pat_` / `X-Amz-` / `Signature=` / `sig=` / `Authorization` / `uploader` /
`node_id` / `login`: **one** hit, line 71 -- the sentence asserting those fields were
deliberately NOT captured. Exactly one URL in 948 lines, a public Actions run link
(`:467`); no signed asset URLs. The only long opaque tokens are `actions/setup-node` cache
keys of the form `node-cache-<OS>-arm64-npm-<sha256 of the lockfile>`, which are
non-secret and already public in every run log. The tables carry only the named fields.

---

## 3. Public-repo email hygiene (allowlist-inversion)

Detection was by allowlist inversion throughout: assert the only email-shaped token is
`larsbrinknielsen@gmail.com` and flag everything else. **The forbidden value is written
nowhere in this report, and was never used as a search needle.**

**Phase files: clean.** All 43 files in `git diff --name-only 4296d1d..HEAD`, scanned with
`/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g`. Exactly one non-approved token, in
`start-cache-server/index.js:68963` -- inside the esbuild `Bundled license information`
banner, an upstream `ws` maintainer's own contact address. **Out of scope by project rule
and correctly so**: outside contributors' own contact details are theirs.

**Commit identity: clean, verified independently.** All **37** commits in
`4296d1d..HEAD`; `%ae` and `%ce` reduce to a single distinct value, the approved gmail.

**Untracked / gitignored paths: clean.** Because `git grep` returns a FALSE ZERO on
untracked and gitignored paths, I re-ran the sweep with `rg -uu` across the working tree
(excluding `node_modules`, `.git`, the lockfile and the bundle). Every hit falls into one
of three benign classes, and the literals are deliberately not reproduced here so this
report does not itself become a scan target: SSH remote forms in `local-context.ts` and
its spec, `example.com`-style test fixtures in specs and vendored GSD templates, and one
documented GitHub bot address in a v0.0.1 research note. Nothing maintainer-identity-
bearing. `git status --porcelain` shows only the pre-existing `.planning/config.json`
modification -- no untracked file at all.

### The `governance-email.spec.ts` coverage question -- and why the answer is NOT "widen it"

The brief asked whether the guard covers this phase's new files. **It does not**, by
design: `governance-email.spec.ts:31-41` scans a fixed four-file list (`SECURITY.md`,
`LICENSE`, and the two `package.json` manifests) and its doc block says so explicitly. So
`compression-method.ts`, `read-back.spec.ts`, `dogfood-cross-os.spec.ts`,
`docs-same-os-claims.spec.ts` and the `.planning` artifacts are outside it. The phase's
own mitigation for that (T-09-53) was a one-time acceptance check at plan 09-07, not a
standing guard -- and I re-ran that check independently above, clean.

**I am NOT reporting the narrow scope as a finding, and I recommend against a repo-wide
widening.** My own scan is the proof: a blanket allowlist over all committed content would
fail the build on `start-cache-server/index.js:68963` -- an upstream maintainer's own
address in a vendored license banner that the bundler regenerates on every
`build:action`. Blocking a third party's own contact detail is precisely what this
project's maintainer-scoped rule forbids, and a `test`-target guard that fights the
bundler would get disabled, which is worse than the narrow scope it replaced.

If broader coverage is ever wanted, the only shape that stays maintainer-scoped is an
opt-in path list of maintainer-AUTHORED prose (for example `.planning/**`, `docs/**`,
`README.md`) with generated artifacts -- `start-cache-server/index.js`, lockfiles -- and
third-party license banners excluded by construction. That is a requirement-sized change,
not an audit fix, so I did not make it. Bare-domain detection stays out of scope for the
documented reason: ordinary URLs make a domain allowlist impractical.

---

## 4. Row-by-row verdicts

All 72 rows `verified`. Evidence is the artifact read, not the SUMMARY's claim.

### Plan 09-01 -- `ci.yml` as a `test` input (7 rows, all verified)

| ID | Sev | Evidence |
|---|---|---|
| T-09-01 | high | `nx.json:69` carries `{workspaceRoot}/.github/workflows/ci.yml`. Effective on its own commit `884e231`, which is an ANCESTOR of the version-changing `47597a6` (`git merge-base --is-ancestor`), so no window exists in which a later spec replays a pre-registration pass. |
| T-09-02 | high | `nx-target-inputs.spec.ts:610` pins the literal; `:652` re-reads through Nx's merge functions; `:675` asserts the entry DISAPPEARS under a hostile project-layer copy -- so the merge is proven to consult the project layer. |
| T-09-03 | high | The `:675` clause IS the cannot-fail proof: a fixture-only assertion could not distinguish a working merge from an unreachable assertion. |
| T-09-04 | medium | Comment lock present at `nx-target-inputs.spec.ts:537-609`, including the `{ env: 'CI' }` finding and the explicit-path-not-glob reason (`:589`). |
| T-09-05 | low | ACCEPTED. `test` is a single ubuntu-only target; measured 2.0s for 671 tests / 38 files at this audit -- cheaper than the plan's 3.4s estimate. |
| T-09-06 | high | `git diff 4296d1d..HEAD -- nx.json` is exactly ONE added line. `nx.json:102`'s `{ "runtime": "node -p process.platform" }` is byte-unchanged. |
| T-09-SC | high | No dependency change: `git diff --stat` over both `package.json`s and `package-lock.json` is EMPTY. |

### Plan 09-02 -- rotation-signal record (7 rows, all verified)

| ID | Sev | Evidence |
|---|---|---|
| T-09-07 | high | Ordering proven from HISTORY, not asserted: `e7018d0` (the record) is an ancestor of `47597a6` (the version change). |
| T-09-08 | high | `09-ROTATION-SIGNAL.md:157` -- "The bundle coupling, because it produces a signal that LOOKS like this one". |
| T-09-09 | high | `:176` tripwire + the two-consecutive-pushes gate (not a push counter); three-window table present. |
| T-09-10 | medium | `:192` "Rejected alternatives, with the reason" -- no marker, no repo variable, no cache entry, no scheduled job. |
| T-09-11 | medium | `:149` "Maintenance instruction, explicit" -- rewrite-and-enumerate if the merge splits. |
| T-09-12 | low | ACCEPTED and holds: scanned for drive letters, `/home/`, `/Users/`, `C:/` and `gh api` -- ZERO hits. |
| T-09-SC | high | One markdown file, no package, no script. |

### Plan 09-03 -- the OS-invariant version itself (14 rows, all verified)

| ID | Sev | Evidence |
|---|---|---|
| T-09-13 | high | Construction-time guard at `actions-cache-backend.ts:86-109`, before the backend object exists; per-request rejected for the documented `handleGet`-eats-it reason (`:57-60`). |
| T-09-14 | high | Per-call whole-argument-array `toStrictEqual` at `actions-cache-backend.spec.ts:451`, `:464`, `:476`. The inverted upstream JSDoc is comment-locked with the file cited (`actions-cache-backend.ts:206-214`). |
| T-09-15 | high | Ordered multiset `['restoreCache','saveCache','restoreCache']` over comment-stripped source (`spec:517-531`) PLUS namespace-import equality (`:533-543`) closing the destructured-import evasion. |
| T-09-16 | high | Four-clause guard in `cache-archive-path.spec.ts`: literal (`:102`), 11-needle source scan (`:119`), import-list equality (`:135`), and a THREE-part scanner-fires control (`:149`, `:153`, `:169`) proving both that the regex bites and that the comment strip is real. |
| T-09-17 | high | `git log --name-only` shows `start-cache-server/index.js` in EXACTLY ONE commit in the range -- `47597a6`, the same commit as the source change. `npm run check:action` exits 0 with an empty diff at HEAD. |
| T-09-18 | high | `mkdirSync(CACHE_ARCHIVE_DIR, { recursive: true })` at `:121`, after the guard, before any write. VER-07 non-vacuity test at `spec:611-625`. |
| T-09-19 | medium | ONE module returning a restore closure (`test/workspace-root-cwd.ts:71-84`), cwd captured FIRST; four numbered locks including the measured pool shape and the chdir-immunity-is-luck note. |
| T-09-20 | medium | ACCEPTED with the measurement AND the Nx version recorded beside it (`cache-archive-path.ts:44-51`): `getCacheSize()` returned 2,974,242 bytes and EXCLUDED a 5,242,880-byte tar, with a positive control that DID move the hash. |
| T-09-21 | high | `rm(path, { force: true })` in a `finally` on BOTH paths -- `:157-162` (get) and `:264-269` (put), the latter covering success, benign no-op and the propagating-error path. Untouched by the move. |
| T-09-22 | high | **Checked closely, because `spec:618` literally reads `rmSync(CACHE_ARCHIVE_DIR, ...)`.** It is preceded by `process.chdir(fixtureAbsolute)` at `:613`, and `CACHE_ARCHIVE_DIR` is RELATIVE, so it resolves inside the `mkdtempSync('.nx/cache/ver04-')` fixture -- not the real directory. Confirmed empirically: `git status --porcelain` after a full run shows no `.nx` path. Residual fragility noted in section 5. |
| T-09-23 | medium | Relative `mkdtempSync` prefix (`spec:564`), no `node:os` import in any spec: the only `node:os` occurrences are RuleTester source STRINGS in `lint-rules.spec.ts:374-436`. |
| T-09-24 | medium | `CORR_05_SITES` is now THREE rows (`lint-rules.spec.ts:729-753`); row 1 deleted with its site. The ROADMAP SC3 miscount lock is preserved as historical at `:724-727`. |
| T-09-25 | high | `createActionsCacheBackend()` is zero-parameter and non-async; reads only `process.cwd()` and `GITHUB_WORKSPACE`. `public-surface.spec.ts`, `index.ts` and `test/consumer-contract.ts` are UNMODIFIED in the range -- the claimed proof, confirmed by `git diff --name-only`. |
| T-09-SC | high | Only `node:fs`, `node:path`, `node:url` builtins. No dependency change. |

### Plan 09-04 -- compression-method probe (9 rows, all verified)

| ID | Sev | Evidence |
|---|---|---|
| T-09-26 | high | `status` structurally unread; the non-zero-exit-still-returns-zstd CONTROL at `compression-method.spec.ts:126-140`. `promisify(execFile)` named actively wrong at `:37-46`. |
| T-09-27 | high | `shell: false` + hardcoded argv, zero interpolation; argv AND the whole options object pinned by `toStrictEqual` (`:188-198`). |
| T-09-28 | medium | Only the derived two-value enum is surfaced (`action/index.ts:187`, `:207`); the concatenated version string is used solely for the emptiness test and never logged (`compression-method.ts:112-119`). |
| T-09-29 | high | `@actions/cache` 6.2.0 pinned with file-and-line citations throughout the doc block; `pinned-deps.spec.ts:24` carries the re-read instruction. |
| T-09-30 | medium | ACCEPTED. No timeout, and asserted structurally at `spec:201-225` so the decision cannot decay into an apparent oversight. |
| T-09-31 | medium | Verified exhaustively: `git grep` finds `compressionMethod` at only `action/index.ts:184`, `:187`, `:207`. No branch reads it. |
| T-09-32 | high | `rg -c "resolveCompressionMethod" start-cache-server/index.js` -> **0**. Exactly one import site (`action/index.ts:16`). `check:action` exits 0 with an empty diff. |
| T-09-33 | medium | `action/index.spec.ts:50-51` module-mocks the probe; `compression-method.spec.ts:59` mocks `node:child_process`. Neither spec spawns. |
| T-09-SC | high | `spawnSync` is a builtin; no `semver`. No dependency change. |

### Plan 09-05 -- the live cross-OS proof (10 rows, all verified)

| ID | Sev | Evidence |
|---|---|---|
| T-09-34 | high | `dogfoodBody` folds `producerOs` into the bytes (`dogfood-body.ts:41`); the verify branch compares against the literal `'linux'` (`action/index.ts:328-329`). |
| T-09-35 | high | `dogfood-cross-os.spec.ts:97-108` asserts `dogfood-seed` declares no `strategy:` and no `matrix`, with the one-key-per-run reason in the failure message; the vacuity condition is ALSO in the job comment (`ci.yml:832-838`). Non-vacuity control at `:80-85` proves the job-block extraction is non-empty. |
| T-09-36 | high | Closed by a TEST, not by review: `dogfoodBody.length === 2` (`dogfood-body.spec.ts:48-50`). |
| T-09-37 | medium | Two physically separate call sites, one inside each branch (`action/index.ts:286`, `:329`), with the do-not-simplify lock at `:267-273`. |
| T-09-38 | medium | `action/index.ts:364-368` names the expected producer and never interpolates the received buffer; the reason is comment-locked at `:358-363`. |
| T-09-39 | medium | `:333-342` names BOTH hypotheses -- cross-OS extraction failing vs. the archive version still differing -- as different repairs. |
| T-09-40 | medium | `ci.yml:847-852` states a green `dogfood-verify` is NOT ROBUST-04 evidence and names `action-bundle-drift` as the only tie. |
| T-09-41 | high | Recorded as `human_needed`, then closed by OBSERVATION, not by an acceptance check: `09-VERIFICATION.md:470` records VER-06 "Verified, closed live -- real Windows runner read-back, log line captured". No pre-merge check pretends otherwise. |
| T-09-42 | high | No job-level `permissions` block on either dogfood job (`ci.yml:799-876`); no new action input. `public-surface.spec.ts` UNMODIFIED. |
| T-09-SC | high | `git diff ... -- ci.yml \| rg "^\+.*uses:"` yields no new `uses:` line. No dependency change. |

### Plan 09-06 -- correct the same-OS claims (10 rows, all verified)

| ID | Sev | Evidence |
|---|---|---|
| T-09-43 | high | Warning reworded at `publish-mirror.ts:315-329`; positive assertions on the axis and both causes at `publish-mirror.spec.ts:456-475`, absence assertion on the removed clause at `:497-499`. |
| T-09-44 | high | Content assertions plus the three retained `restored as a MISS` anchors proving the branch is REACHED (`spec:448-451` states this explicitly). |
| T-09-45 | high | `ci.yml:990-995` supplies the NEW two-legged reason in the same sentence, and `keep BOTH legs` survives -- all three phrase-pinned by `docs-same-os-claims.spec.ts:81-84`. |
| T-09-46 | medium | Site 3 corrected NARROWLY: `ci.yml:388` and `:409` keep the still-true claims; only the attribution changes. Sites 4-6 additive with sentences retained verbatim (`docs-same-os-claims.spec.ts:105-150`). |
| T-09-47 | high | `docs-same-os-claims.spec.ts:194-207` asserts `/whose byte[s]/i` matches NONE of the four edited files, written with a character class so the spec does not spell it. |
| T-09-48 | high | The `nx.json:69` entry is in place and its commit precedes 09-06's `474c1b5`. |
| T-09-49 | medium | Every row's failure message carries the update-the-ROW-in-the-same-commit instruction (`:172`, `:186`). |
| T-09-50 | low | The `ci.yml` line-number drift and Phase 8's `hash-parity` insertions as its cause are recorded at `docs-same-os-claims.spec.ts:30-34`. |
| T-09-51 | high | OBS-04 recorded as `human_needed`, then sampled with an honestly-recorded PARTIAL mismatch rather than reframed as a full match (`09-VERIFICATION.md:234`, `:473`). |
| T-09-SC | high | Prose, one message string, one spec file. No dependency change. |

### Plan 09-07 -- evidence and open items (8 rows, all verified)

| ID | Sev | Evidence |
|---|---|---|
| T-09-52 | high | Only the named fields, rendered as tables. Credential-shape scan over 948 lines returns ONE hit -- line 71, the sentence stating the sensitive fields were not captured. One URL, a public run link. |
| T-09-53 | high | Re-verified independently: 43 phase files by allowlist inversion, zero maintainer tokens; 37 commits, author and committer both the approved gmail. Detection by inversion; the forbidden value appears nowhere. |
| T-09-54 | high | Both recorded OPEN / `human_needed` with the `main`-only push filter and both `if:` gates cited; no plan authors a check either could satisfy. |
| T-09-55 | high | The prediction was already committed (`e7018d0`, provably an ancestor), and the record names where and when to read it plus its once-only nature. |
| T-09-56 | medium | `09-EVIDENCE.md:60-68` states plainly that this is NOT the O1 proof, that TEST-08 is a Phase 11 requirement, and names T-09-56 as the register entry for the drift. `:91-94` refuses to derive which version belongs to which OS. |
| T-09-57 | medium | `## Recorded corrections` present, including the `ci.yml` drift attributed to Phase 8's insertions. |
| T-09-58 | low | `09-EVIDENCE.md:125` -- "The shard release did NOT 404. Had it, that result would have been recorded verbatim rather than" widening the query. Honest either way. |
| T-09-SC | high | Two read-only `gh api` calls, one markdown file. No dependency change. |

### Plan 09-08 -- the gap closure (7 rows, all verified)

| ID | Sev | Evidence |
|---|---|---|
| T-09-59 | high | Bound independently re-derived (section 2.5): closed 3-member `CACHE_OS_VALUES`, hash folded into every candidate, injective template, exact `Buffer.equals`. Exactly +2 accepted byte strings per hash. Group B's four rejection tests at `read-back.spec.ts:103-139`. |
| T-09-60 | medium | `read-back.ts:152-156` names the matched producer in the success line; asserted at `read-back.spec.ts:90-92`. |
| T-09-61 | high | Never-weaken rule comment-locked at `read-back.ts:84-89`; Group B is the test-enforced half. |
| T-09-62 | medium | Both unification directions spelled out at `read-back.ts:110-120`, keyed on JOB and CLAUSE names, never line numbers. Downward direction is test-enforced: `it.each(CACHE_OS_VALUES)` means hardcoding `'linux'` reddens two of three Group A cases. |
| T-09-63 | medium | ACCEPTED and NAMED with an owner (ROADMAP Phase 10 item 3 / OBS-05), recorded at `read-back.ts:91-108`. `F-09-A` above is a further consequence of the same accepted relaxation. |
| T-09-64 | low | `read-back.spec.ts:44-47` mocks the whole backend module, so no client is constructed, no token resolved, no request made. The bin's messages carry only hash, platform and OS enum -- never bytes, URLs or headers (`read-back.ts:59-62`, `:144-149`, `:153-155`). |
| T-09-SC | high | `CACHE_OS_VALUES` from the module that already supplied `cachePlatform`; vitest already the runner. No dependency change. Exactly TWO commits as planned: `acd37d0` then `fc37f0f`. |

---

## 5. Residual notes (no action required for this phase)

1. **`actions-cache-backend.spec.ts:611-625` is order-fragile.** The `rmSync` is safe ONLY
   because `process.chdir(fixtureAbsolute)` runs two lines above it; moving the `rmSync`
   up would delete the real workspace `.nx/cache`. The comment at `:614-617` explains the
   ordering, and nothing enforces it. Consequence is a local cache wipe, recoverable and
   not a security property, so I left it. Cheapest hardening if ever wanted: assert
   `process.cwd() === fixtureAbsolute` immediately before the `rmSync`.
2. **Three stale same-OS sites now survive into Phase 10**, not two: `publish-mirror.ts:146`
   / `:159` (+ `publish-mirror.spec.ts:410`), `ci.yml:1103-1105`, and -- newly identified
   here -- the `ci.yml` publish-job capacity block, whose FACTUAL claim I corrected but
   whose GUARD coverage is still absent. TRUST-11 / OBS-05 should pin all three together.
3. **`ci.yml:1013`** ("Per-OS isolation is unchanged ... mirrors only the entries IT can
   restore") is now misleading in framing though not literally false -- its subject is the
   WR-01 asset-cap race, not restore. Informational; folding it into the same Phase 10
   pass would be tidy.
4. **`governance-email.spec.ts` should NOT be widened repo-wide.** See section 3 for why,
   and for the only shape that would stay maintainer-scoped.

## 6. Edits made in this audit

`.github/workflows/ci.yml` -- publish job shard-growth comment (`F-09-A`). Corrected the
false "only the Windows leg can restore" premise and the two numbers derived from it
(~5 -> ~10 assets per push; ~125 -> ~75 pushes per month before the cap), naming
VER-01 + VER-03 as the cause and routing the duplicate-pair cost to OBS-05.
Comment text only -- no logic, no YAML structure, no assertion changed.

Re-verified after the edit: `format:check` 0, `test` 671/671 across 38 files, `lint` 0,
`fallow:ci` 0 issues, `check:action` 0 with an EMPTY bundle diff. `git status --porcelain`
shows only this file plus the pre-existing `.planning/config.json` modification.
