# Phase 10: OS-Invariant Releases Mirror - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 11 create-or-widen targets (3 genuinely new, 8 seams)
**Analogs found:** 10 / 11 (one has no in-repo analog: a `needs:` / `max-parallel:` VALUE guard)

**Scope note.** `10-RESEARCH.md` already carries the per-requirement notes, the 33-row
drift table, the 26-row disjointness table, the C-1..C-7 corrections and the U-01
resolution. **None of that is repeated here.** This file answers only: for each file this
phase creates or whose seam it widens, WHICH existing file already solves the same shape,
and WHICH excerpt to copy.

Every line number below was read against HEAD this session. Locate by content anyway.

---

## File Classification

| New / widened target | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `packages/github-cache/src/lib/mirror-seed.ts` (NEW) | pure derivation leaf | transform | `packages/github-cache/src/lib/dogfood-body.ts` | exact (structural) |
| `packages/github-cache/src/lib/mirror-seed.spec.ts` (NEW) | unit spec of a pure leaf | transform | `packages/github-cache/src/lib/dogfood-body.spec.ts` | exact |
| `packages/github-cache/src/lib/release-asset-name.integration.spec.ts` (NEW) | integration spec of a PURE helper | none (no I/O) | `packages/github-cache/src/server/public-server.integration.spec.ts` | partial -- role only; inherit the HEADER, not the harness |
| `PublishClient.uploadReleaseAsset` + 4th `label` param (`publish/publish-mirror.ts`) | injected-client interface | request-response | itself; the `ref` widening on `createPublishClient` (`action/index.ts:38-58`) | in-place widen |
| the Octokit upload adapter (`action/index.ts:89-104`) | adapter | request-response | its sibling `listCacheEntries` adapter (`:45-58`) | in-place widen |
| the 4 `uploadReleaseAsset` fakes + 4 arg-array assertions (`publish/publish-mirror.spec.ts`) | spec fakes | request-response | `client()` factory at `publish-mirror.spec.ts:52-63` | in-place widen |
| `mirror-seed` operation branch (`action/index.ts`) | bin dispatch branch | request-response | the `seed` branch, `action/index.ts:281-305` | exact |
| `packages/github-cache/action.yml` `operation` input | config | n/a | its own `operation:` description block (`:25-32`) | in-place |
| two-branch filter (`lib/release-asset-name.ts`) | predicate leaf | transform | `isServerProducedKey`, `lib/cache-key.ts:46-57` | exact |
| D-21 comment-sweep rows | drift guard | file-I/O | `src/docs-same-os-claims.spec.ts:50-104` (`DOCS_08_SITES`) | exact (extend) |
| RETAIN-05(c) prefix pin | drift guard | file-I/O | `src/lib/cache-key.spec.ts:108-137` (`countAuthored` + `files` map) | exact (extend) |
| OBS-03 label assertions | unit spec | request-response | `src/action/index.spec.ts:84-88` + `:333-348` | exact |
| XOS-06 / XOS-07 ci.yml VALUE guard | drift guard | file-I/O | `src/dogfood-cross-os.spec.ts:49-77` (`codeLines` + `jobBlock`) | **role-match only -- no value guard exists** |

---

# TIER 1 -- genuinely NEW files

## 1. `packages/github-cache/src/lib/mirror-seed.ts` (NEW)

**Role:** pure derivation leaf. `mirrorSeedHash(runId, os) -> lowercase-hex, non-all-decimal,
per-OS seed`.

**Closest analog: `packages/github-cache/src/lib/dogfood-body.ts`.** Not `cache-key.ts`, not
`retention.ts`. The ranking:

| Candidate | Why it loses / wins |
|---|---|
| `dogfood-body.ts` | **WINS.** Same shape exactly: ONE exported pure function, TWO required params, one of them a `CacheOs` provenance axis, consumed by exactly two bins (`action/index.ts` writer + `roundtrip/read-back.ts` reader), and the whole file is a doc block whose subject is "why this parameter has NO default". `mirrorSeedHash` is `dogfoodBody` for the KEY instead of the BODY, driven by the same two bins for the same OBS-05/VER-06 non-vacuity reason. |
| `cache-key.ts` | Loses as the STRUCTURAL model -- it is a namespace module (5 exports: a literal, a pattern, a brand type, a mint, two builders) and `mirror-seed.ts` has one function. **Wins as the GUARD model:** copy its "true leaf" spec test and its authored-count discipline for the marker literal. |
| `retention.ts` | Loses. Its subject is env resolution + a clamp + a template with two derived consumers. `mirrorSeedHash` has no knob, no clamp, no env. Its only transferable asset is the `SHARD_TAG_PATTERN = new RegExp('^' + SHARD_TAG_PREFIX + ...)` idiom -- build a derived thing FROM the single-sourced literal, never re-author it (`retention.ts:61-69`). |

**Excerpt to copy -- the whole file shape** (`lib/dogfood-body.ts:1`, `:9-27`, `:40-42`):

```ts
import type { CacheOs } from './release-asset-name.js';

/**
 * A leaf on purpose: the writer (action/index.ts) and the reader (roundtrip/
 * read-back.ts) both import it from here so they cannot disagree on the payload.
 * read-back must NOT import action/index.ts -- that would pull Octokit into the
 * round-trip bin for one string template.
 *
 * `CacheOs` is imported `import type` so this module stays a RUNTIME leaf even though
 * release-asset-name.ts imports HASH_PATTERN from cache-key.js at runtime: the type
 * erases at compile time.
 *
 * `producerOs` IS REQUIRED, WITH NO DEFAULT -- comment-locked (D-18, VER-06).
 * ... a default would let it silently compare against ITSELF. That silent
 * self-comparison is the vacuity trap VER-06 exists to close, so the ABSENCE of the
 * default is the control, not an omission. `dogfood-body.spec.ts` pins it structurally
 * via `dogfoodBody.length === 2` (the selectBackend.length precedent), because
 * Function.length counts parameters before the first default.
 */
export function dogfoodBody(hash: string, producerOs: CacheOs): Buffer {
  return Buffer.from(`nx-github-cache-dogfood:${producerOs}:${hash}`);
}
```

**Import discipline to copy verbatim** (all three rules are live in the tree):
- Explicit `.js` extension on every relative import (`'./release-asset-name.js'`,
  `'./cache-key.js'`) -- NodeNext resolution, no extensionless specifiers anywhere in `src/lib/`.
- `import type` for anything that erases (`type CacheOs`, `type Hash`).
- Type + value in one statement where both are needed:
  `import { HASH_PATTERN, type Hash } from './cache-key.js';` (`release-asset-name.ts:1`).
- Leaf rule, asserted not just documented (`cache-key.spec.ts:96-106`):
  `expect(source).not.toMatch(/from '\.\.\/backend/)` and the same for `../publish`,
  `../server`, `./select-backend`.

**What must differ, and why -- three things:**

1. **The runtime edge is REAL, not type-only.** `dogfood-body.ts` gets to say "stays a
   RUNTIME leaf" because `CacheOs` erases. `mirrorSeedHash` needs `CACHE_OS_VALUES` at
   RUNTIME (`CACHE_OS_VALUES.indexOf(os)` -- D-12's third locked constraint is that the OS
   component is single-sourced from the tuple). So `mirror-seed.ts` imports
   `{ CACHE_OS_VALUES, type CacheOs }` -- one value import, one type import -- and its doc
   block must say the runtime edge is DELIBERATE and what it buys (adding an OS cannot
   silently collide), because `dogfood-body.ts:14-16` establishes the house convention that a
   runtime edge is a thing you justify.
2. **The injectivity pin is a NEW kind of assertion.** `dogfoodBody` pins
   `dogfoodBody.length === 2`. `mirrorSeedHash` additionally needs
   `expect(CACHE_OS_VALUES.length).toBeLessThan(10)` because a single-digit tuple index is
   only injective under that bound. That has no analog -- it is the one genuinely new guard in
   this file.
3. **Placement is a separate file, and it is MEASURED-cheap.** `rg -c` over the committed
   consumer bundle: `cachePlatform=2`, `releaseAssetName=2`, but `CACHE_OS_VALUES=0`,
   `dogfoodBody=0`, `isServerProducedAssetName=0` in `start-cache-server/index.js`. esbuild
   tree-shakes per export, so folding `mirrorSeedHash` into `release-asset-name.ts` would not
   necessarily grow the bundle -- but a separate `mirror-seed.ts` is unreachable from `serve()`
   entirely, so the NEW file contributes a provably ZERO bundle delta and keeps the whole
   ROBUST-04 blast radius on the `releaseAssetName` edit alone. Prefer the separate file; the
   `src/lib/` directory already holds 14 single-concern leaves.

**The comment-lock content this file owns** (nothing in the requirements supplies it; model
the tone on `cache-key.ts:1-15` and `release-asset-name.ts:33-49`): the marker word is `feed`
and it must stay DISTINCT from the shipped `cafe<run_id>` seed at `ci.yml:944-949` (C-4); the
hex-letter component is what makes disjointness from run ids and Nx task hashes STRUCTURAL
rather than probabilistic; and the failure mode of changing it is a silent MISS in
`read-back.ts`, not a crash.

---

## 2. `packages/github-cache/src/lib/mirror-seed.spec.ts` (NEW)

**Closest analog: `packages/github-cache/src/lib/dogfood-body.spec.ts`** -- same subject
class (a two-arg pure provenance derivation), and it already carries the three assertion
kinds this spec needs.

**Excerpt to copy -- the structural no-default pin** (`dogfood-body.spec.ts:43-51`):

```ts
  // Structural, mirroring select-backend.spec.ts:298's `selectBackend.length` control.
  // Function.length counts parameters BEFORE the first default, so a default on
  // `producerOs` (`= cachePlatform()`) drops this to 1 and fails here. That is the
  // whole no-default rule of D-18: a default lets the verify leg silently compare
  // against its OWN OS, which is the vacuity trap. Without this assertion the rule
  // would be enforced by review alone.
  it('structural: dogfoodBody.length is 2 -- neither parameter carries a default (D-18)', () => {
    expect(dogfoodBody.length).toBe(2);
  });
```

**Excerpt to copy -- the differing-output non-vacuity clause** (`dogfood-body.spec.ts:36-40`);
this is the assertion that separates "the OS param exists" from "the OS param reaches the
output", which is exactly OBS-05's claim:

```ts
  it('returns different bytes for different producer OSes -- the provenance claim (VER-06, D-18)', () => {
    expect(
      dogfoodBody('abc123', 'linux').equals(dogfoodBody('abc123', 'windows')),
    ).toBe(false);
  });
```

**Excerpt to copy -- the pinned-literal discipline** (`release-asset-name.spec.ts:11-19`).
The exact-value cases must SPELL the literal, not rebuild it from the template:

```ts
// CORR-01 / TEST-05, non-vacuous: the expected asset names below are spelled out
// as string literals ON PURPOSE, not rebuilt from the same `${hash}-${platform}`
// template the implementation uses. A reconstructed expectation would still pass
// after a cosmetic edit to the separator, the slot ordering, or the platform
// casing ...
```

**What must differ:**
- The OS axis is `it.each(CACHE_OS_VALUES)` over the REAL tuple, not a hand-written
  `['linux','windows']` pair as `dogfood-body.spec.ts` uses. Reason: D-12's single-sourcing
  constraint means adding an OS must automatically add a case (the
  `action/index.spec.ts:333` precedent, quoted in Tier 3 item 8).
- Add the two pins `dogfood-body.spec.ts` has no reason to carry:
  `expect(HASH_PATTERN.test(mirrorSeedHash('30401077417', os))).toBe(true)` (the D-12
  lowercase-hex constraint -- this is the constraint a planner will miss) and
  `expect(CACHE_OS_VALUES.length).toBeLessThan(10)` (injectivity of the single-digit index).
- Add a NOT-all-decimal assertion (`expect(seed).toMatch(/[a-f]/)`), which is the
  structural-disjointness claim; and a disjoint-from-`cafe` assertion.
- Do NOT add the spec to `cache-key.spec.ts`'s `files` count map -- see Tier 3 item 7.

---

## 3. `packages/github-cache/src/lib/release-asset-name.integration.spec.ts` (NEW)

**Closest analog: `packages/github-cache/src/server/public-server.integration.spec.ts`** --
and it is the ONLY `*.integration.spec.ts` in the repo (`vitest.integration.config.mts:16`
globs `{src,tests}/**/*.integration.spec.{ts,mts,cts}`), so there is no second candidate.

**Match quality is PARTIAL on purpose.** The analog is a real-socket HTTP server test with
`beforeEach`/`afterEach` lifecycle. The new file tests ONE pure function's default argument.
Inherit its HEADER; inherit nothing else.

**Excerpt to copy -- the header, which is the whole transferable asset**
(`public-server.integration.spec.ts:7-14`):

```ts
// INTEGRATION (real loopback HTTP, no mocks): exercises the PUBLIC contract a
// consumer actually calls -- createCacheServer(backend, token) -- end to end over a
// real socket. Distinct from serve.spec, which drives serve() with a MOCKED
// selectBackend; this uses the exported factory + a real backend + real fetch, so it
// proves the barrel export answers an authenticated PUT->GET round-trip, enforces
// the bearer gate, and maps a backend miss to 404. Runs on ci.yml's `integration`
// matrix (ubuntu + windows), so the socket/HTTP path is proven cross-OS -- which is
// exactly what the previously-vacuous integration job never did.
```

The transferable clauses, in order of value:
1. **`INTEGRATION (...):` opener naming WHAT IS REAL.** For the new file that is
   `INTEGRATION (real process.platform, no mocks)`.
2. **"Distinct from <unit spec>, which ... MOCKED ..."** -- the new file must state it is
   distinct from `release-asset-name.spec.ts`, which asserts the three OS mappings with an
   INJECTED platform. That sentence is what stops a future reader collapsing the two files.
3. **"Runs on ci.yml's `integration` matrix (ubuntu + windows) ... which is exactly what the
   previously-vacuous integration job never did."** This is D-17's entire justification,
   already written in the house voice. The new file's version: under the ubuntu-only `test`
   target `cachePlatform()` and `cachePlatform('linux')` are indistinguishable, so the
   assertion samples at a rate of ZERO; the two-leg `integration` matrix is what makes it bite.

**What must NOT be inherited, and why:**

| Analog element | Verdict for the new file |
|---|---|
| `import type { Server } from 'node:http'` / `AddressInfo` (`:1-2`) | DROP. No server. |
| the `listen(server)` port-0 promise helper (`:18-26`) | DROP. No sockets. |
| `beforeEach` / `afterEach` server lifecycle (`:32-41`) | DROP. Nothing to set up or tear down; a pure function needs no fixture. Importing `beforeEach`/`afterEach` and leaving them unused would also trip lint. |
| `createWritableMemoryBackend` + `createCacheServer` imports (`:4-5`) | DROP. |
| `describe(...)` + `it(...)` + `expect` from `vitest` (`:3`) | KEEP -- that is the entire import list for the new file. |
| the exported-barrel framing ("the PUBLIC contract a consumer actually calls") | REPLACE. `cachePlatform`'s default argument is an INTERNAL contract; do not borrow the public-surface language, it would imply a D2-02 public-surface claim this file does not make. |

**The one body clause, moved verbatim from `release-asset-name.spec.ts:60-63` MINUS its
directive:**

```ts
  it('resolves the running platform when called with no argument (CORR-01)', () => {
    expect(cachePlatform()).toBe(cachePlatform(process.platform));
  });
```

The `eslint-disable-next-line no-restricted-syntax` prefix at `:61` is DELETED, not carried:
LINT-02's `ignores: ['**/*.integration.spec.{ts,mts,cts}']` exempts the new path, so the
directive becomes unused and `reportUnusedDisableDirectives: 'error'` fails. Same-commit
(RESEARCH H-1). And per RESEARCH C-3 the `CORR_05_SITES` row is DELETED, not repointed.

---

# TIER 2 -- seams being WIDENED

## 4. `PublishClient.uploadReleaseAsset` gains a 4th positional `label`

**Analog is the file itself.** The transferable convention is the `ref` widening already
shipped on the sibling seam: `createPublishClient(octokit, owner, repo, ref)` added a 4th
POSITIONAL parameter for a cross-cutting scope value rather than an options bag
(`action/index.ts:38-43`). That is the precedent D-09's "positional rather than an options
object" rests on -- cite it.

**Site A -- the interface** (`publish/publish-mirror.ts:59-69`, EXACT at HEAD):

```ts
export interface PublishClient {
  listCacheEntries(): Promise<CacheEntry[]>;
  getReleaseByTag(tag: string): Promise<PublishRelease>;
  createRelease(tag: string): Promise<PublishRelease>;
  listReleaseAssets(releaseId: number): Promise<string[]>;
  uploadReleaseAsset(
    releaseId: number,
    name: string,
    bytes: Buffer,
  ): Promise<void>;
}
```
-> add `label: string,` as the 4th param. The seam's doc block is `:47-58`; it documents
per-method behaviour, so it gains one sentence for `label`.

**Site B -- the real Octokit adapter** (`action/index.ts:89-104`, EXACT at HEAD). Note the
adapter's params are UNTYPED (contextual typing from the interface), so the edit is a bare
`label` in the signature plus one property in the call object:

```ts
    async uploadReleaseAsset(releaseId, name, bytes) {
      // Explicit content-length: uploads.github.com mishandles a missing/streamed
      // length on large assets (Pitfall 5). The Buffer is passed as data as-is
      // (Octokit accepts it); the ~2 GiB pre-upload guard lives in the engine (D-12).
      await octokit.rest.repos.uploadReleaseAsset({
        owner,
        repo,
        release_id: releaseId,
        name,
        data: bytes as unknown as string,
        headers: { ... },
      });
    },
```

**Site C -- the construction site** (`publish/publish-mirror.ts:215-271`). `cachePlatform()`
is hoisted ABOVE `for (const hash of hashes)` at `:215`; the call at `:269` becomes
`await client.uploadReleaseAsset(shard.id, name, bytes, label);`. `PublishOptions` at
`:93-96` stays `{ now }` -- do not widen it.

**Site D -- the 4 fakes.** All four are shaped by ONE factory
(`publish-mirror.spec.ts:52-63`), so three of the four "fakes" are `overrides` on it:

```ts
function client(overrides: Partial<PublishClient> = {}): PublishClient {
  return {
    listCacheEntries: vi.fn(
      async () => [{ key: `nx-cache-${HASH}` }] as CacheEntry[],
    ),
    getReleaseByTag: vi.fn(async () => ({ id: SHARD_ID })),
    createRelease: vi.fn(async () => ({ id: SHARD_ID })),
    listReleaseAssets: vi.fn(async () => [] as string[]),
    uploadReleaseAsset: vi.fn(async () => {}),
    ...overrides,
  };
}
```
`vi.fn(async () => {})` is arity-agnostic, so the fake DEFINITIONS at `:60`, `:182`,
`:261-262`, `:286` need no signature change unless they read arguments. RESEARCH C-6's 8
edits are therefore almost entirely the ARGUMENT-ARRAY assertions.

**Site E -- the 4 argument-array assertions.** The shape to extend
(`publish-mirror.spec.ts:119-124`):

```ts
    expect(fake.uploadReleaseAsset).toHaveBeenCalledOnce();
    expect(fake.uploadReleaseAsset).toHaveBeenCalledWith(
      SHARD_ID,
      releaseAssetName(HASH),
      expect.anything(),
    );
```
-> append a 4th argument. D-11 forbids a separate `expect.stringContaining` for the label; it
must be a member of THIS array. Sites: `:120`, `:214`, `:237`, `:397`.

**One index read that must NOT be touched** (`publish-mirror.spec.ts:96-102`, `:132`):
`.mock.calls.map((call) => call[1])` and `.mock.calls[0][1]` read index 1 = the NAME. Index 1
stays the name after a 4th param is appended. Leave them.

**What must differ from the `ref` precedent:** `ref` reaches the wire as a QUERY scope and is
security-load-bearing (TRUST-10). `label` is free-form metadata and is NOT a control -- the
comment lock at the construction site must carry OBS-03's RETRACTION (the label is the
PUBLISHING leg's OS, never the producing OS), because `listCacheEntries` returns `{ key }`
only (`publish-mirror.ts:37-40`; adapter maps to `{ key: cache.key }` at
`action/index.ts:53-57`) so no producing-OS field exists to read.

---

## 5. A new internal `operation` value on the dogfood action

**Analog: the `seed` branch itself, `action/index.ts:281-305`.** Copy it as a THIRD SIBLING
branch, never as a modification of it.

**Excerpt -- the dispatch shape** (`action/index.ts:237-247`):

```ts
  // Read `operation` BEFORE the required `hash` input so the publish branch never
  // trips getInput's required-and-not-supplied throw (publish uses no hash).
  const operation = core.getInput('operation', { required: true });

  if (operation === 'publish') {
    await runPublish();

    return;
  }

  const hash = core.getInput('hash', { required: true });
```

**Excerpt -- the seed branch to mirror** (`action/index.ts:281-305`), including the ambient-read
exemption comment which the new branch needs verbatim in substance:

```ts
    if (operation === 'seed') {
      // cachePlatform() -- an ambient read, legitimate here because this is a bin and
      // LINT-02's ban on deriving an expectation from the running machine is scoped to
      // spec files (eslint.config.mjs:263). The seed leg is the PRODUCER, so its own
      // platform IS the correct provenance stamp.
      const body = dogfoodBody(hash, cachePlatform());

      const put = await fetch(url, { method: 'PUT', headers: { authorization }, body });

      if (put.status !== 200) {
        core.setFailed(`github-cache dogfood seed: expected PUT 200, got ${put.status}.`);

        return;
      }

      core.info(`github-cache dogfood seed: stored ${hash} (PUT 200).`);

      return;
    }
```

**The no-hoist lock the new branch must respect** (`action/index.ts:267-273`) -- quoted
because it is the reason the branch builds its OWN url instead of reusing `:265`'s:

```ts
  // The dogfoodBody call is deliberately NOT here. It lives INSIDE each branch below,
  // one per leg, because the two legs pass DIFFERENT producer-OS arguments and those
  // arguments must stay physically apart (C-01, T-09-37). Computing a conditional
  // `producerOs` above the branch -- or hoisting a shared `body` back to this line --
  // reintroduces the one-expression coupling that makes VER-06's vacuity trap
  // reachable ... Do not "simplify" the two calls back together.
```
`const url = \`${running.url}/v1/cache/${hash}\`` is at `:265`, ABOVE the branches. A
`mirror-seed` branch that reuses it PUTs at the run id, not at the derived seed
(RESEARCH's "branch trap"). Build a local `seedUrl` inside the branch.

**The stale message** (`action/index.ts:381-383`) -- no spec asserts it, which is why it is
easy to leave behind:

```ts
    core.setFailed(
      `github-cache dogfood: unknown operation '${operation}' (expected 'seed' or 'verify').`,
    );
```

**Config analog: `packages/github-cache/action.yml:25-32`.** The `operation` description
enumerates every value with its gate; extend the same sentence rather than adding an input:

```yaml
  operation:
    description: >-
      Which operation to run. 'seed' (PUT) and 'verify' (GET) drive the dogfood
      cache round-trip; 'publish' mirrors this OS's server-produced Actions-cache
      entries to the current month-shard GitHub Release, gated FIRST on
      isSyncTrusted (default-branch {push,schedule} only, D-01). None of these
      affect read-vs-write capability, which is derived from runtime context.
    required: true
```
The file header (`:1-10`) already declares this action INTERNAL, which is what keeps the new
value out of the public surface (`public-surface.spec.ts:53` reads
`start-cache-server/action.yml` only).

**What must differ:** the `seed` branch's `hash` comes from `core.getInput('hash')` and is
used raw. The `mirror-seed` branch derives `mirrorSeedHash(hash, cachePlatform())` and must
pass the DERIVED value to both the URL and `dogfoodBody`, or the read-back MISSes. Keep the
`operation`-selects-only-the-verb / TRUST-05 clause from `:274-280` -- the new value must not
look like a capability switch.

---

## 6. The two-branch cleanup filter in `lib/release-asset-name.ts`

**Analog for the COMPOSITION discipline: `isServerProducedKey`, `lib/cache-key.ts:46-57`.**
This is the sibling whose two-condition shape the new branch A must mirror, and whose doc
block shows how the house writes a filter that is deliberately NARROW.

```ts
/**
 * TRUST-08 / C16: a genuine server-produced key is the prefix followed by a valid
 * hash suffix -- never the bare prefix, never a non-hex/garbage suffix. This is
 * the full filter the Phase 4 cheap-prefix (startsWith-only) subset lacked, so a
 * foreign or `nx-cache-<garbage>` key is filtered out before it can be mirrored.
 */
export function isServerProducedKey(key: string): boolean {
  return (
    key.startsWith(CACHE_KEY_PREFIX) &&
    HASH_PATTERN.test(key.slice(CACHE_KEY_PREFIX.length))
  );
}
```

Three things to copy exactly:
1. **Two conditions `&&`-ed in a single `return`, both derived from single-sourced
   constants** -- never a regex literal re-authoring `nx-cache-` or `[a-f0-9]`.
2. **The doc block names the REJECTED weaker version** ("the cheap prefix-only subset the
   Phase 4 publish path lacked"). The new `isCurrentAssetName` must likewise name what it is
   NOT, and must name why it is not aliased to `isServerProducedKey` despite being
   byte-identical in shape (same reason D-03 forbids aliasing `cacheKeyFor`: four distinct
   consumers of one prefix, RETAIN-05c).
3. **The requirement/control ID leads the doc block** (`TRUST-08 / C16`).

**The legacy branch is today's body, preserved verbatim** (`release-asset-name.ts:69-83`) --
its `lastIndexOf` split and its `if (separator < 0) return false` guard are what make branch
B provably disjoint from branch A (RESEARCH's reason 2, the belt):

```ts
export function isServerProducedAssetName(name: string): boolean {
  const separator = name.lastIndexOf('-');

  if (separator < 0) {
    return false;
  }

  const hash = name.slice(0, separator);
  const os = name.slice(separator + 1);

  return (
    HASH_PATTERN.test(hash) &&
    (CACHE_OS_VALUES as readonly string[]).includes(os)
  );
}
```
Note the `(CACHE_OS_VALUES as readonly string[])` cast -- required because the tuple is
`as const` and `.includes` narrows to the literal union. Carry it into the renamed
`isLegacyOsSuffixedAssetName` unchanged.

**The single call site** (`cleanup/cleanup.ts:83-91`) -- its comment says `<hash>-<os>` and
must be widened, because it is the only prose a cleanup reader sees:

```ts
      // Prune only the publisher's <hash>-<os> assets, mirroring the read/write
      // side's isServerProducedKey discipline: a foreign asset dropped into a
      // genuine shard is never deleted as ours. First statement in the loop so a
      // foreign asset (even one with a malformed created_at) is skipped silently
      // and `scanned` counts only genuine mirror assets considered.
      if (!isServerProducedAssetName(asset.name)) {
        continue;
      }
```

**Spec analog for the accept/reject tables: `release-asset-name.spec.ts:66-103`.** It already
runs `it.each` over an accept list and a reject list plus a producer round-trip; the new
disjointness table extends this describe rather than opening a new file:

```ts
describe('isServerProducedAssetName server-produced <hash>-<os> guard', () => {
  it.each(['abc123-linux', 'deadbeef-windows', '0-macos', `${'a'.repeat(512)}-linux`])(
    'accepts the genuine asset name %s', (name) => {
      expect(isServerProducedAssetName(name)).toBe(true);
    });
  ...
  it('validates the OS half against the single-sourced CACHE_OS_VALUES', () => {
    expect(CACHE_OS_VALUES).toEqual(['windows', 'macos', 'linux']);
  });
});
```

**What must differ:** `isServerProducedKey` is a single exported predicate. RETAIN-05(b)
needs TWO NAMED things to assert about, so branch A and branch B are separate
module-private functions and the SPEC must import them -- which means either exporting both
(and accepting two more names on the module surface) or asserting disjointness through a
table of names with the composed export plus a structural argument. Decide this explicitly;
`cache-key.ts` gives no precedent for a module-private predicate under test.

---

# TIER 3 -- guard patterns that already ship

## 7. `src/docs-same-os-claims.spec.ts` -- the phrase-keyed `DOCS_08_SITES` table

The D-21 sweep ADDS ROWS here. One full row, including the rationale doc-comment that is the
non-obvious part of the pattern (`docs-same-os-claims.spec.ts:69-87`):

```ts
  {
    /**
     * CORRECTION, DOCS-08 site 2 -- the outright false one, AND the stated
     * justification for the `keep BOTH legs` instruction two lines below it. A bare
     * deletion would leave that instruction unsupported and a later reader would
     * collapse the matrix on the strength of the corrected text, destroying the
     * cross-OS proof VER-06 built. So the row requires BOTH the corrected claim and
     * the REPLACEMENT justification (the Windows leg is still the only producer of
     * Windows-hash entries), plus the instruction it supports.
     */
    file: '.github/workflows/ci.yml',
    bucket: 'correction',
    required: [
      'an ubuntu leg CAN now restore a Windows-saved entry',
      'the ONLY leg that produces Windows-hash entries',
      'keep BOTH legs',
    ],
    forbidden: [/per-OS tmpdi[r] path/],
  },
```

Four mechanics to reuse, all load-bearing:
- **`required` + `forbidden` per row.** `forbidden` is what stops the claim drifting BACK.
- **Self-evading `forbidden` regexes:** `/per-OS tmpdi[r] path/`, `/Restore is same-[O]S --/`.
  The bracketed single char stops the spec's OWN source matching if the file is ever scanned.
  Copy this trick or the new rows self-satisfy.
- **`bucket: 'correction' | 'additive'`**, with `forbidden: []` present-not-absent on additive
  rows (`:119-120`: `as const` would drop the property and break the destructure).
- **`file:` is repo-relative from `WORKSPACE_ROOT_URL = new URL('../../../', import.meta.url)`
  (`:4`)**, and reads are RAW (`readFileSync`, no comment stripping) -- which is exactly why
  this guard, not `dogfood-cross-os.spec.ts`, is the home for a COMMENT phrase lock.
- The header (`:6-48`) already records the requirement-miscount reconciliation and the
  line-number-drift rationale. The D-21 rows extend that header, they do not restate it.

**Hard dependency to carry** (`:36-40`): rows keyed on `.github/workflows/ci.yml` are a
stale-cached-PASS victim unless `ci.yml` is in `nx.json`'s `targetDefaults.test.inputs`. It is
(`nx.json:69`, verified). The D-21 rows inherit this for free -- but if a new sweep row keys on
a file outside the `test` inputs, it replays.

## 8. `src/lib/cache-key.spec.ts:108-137` -- the authored-occurrence counter

RETAIN-05(c) EXTENDS this; it builds no mechanism. The counter
(`cache-key.spec.ts:17-32`) strips comment lines and counts OCCURRENCES, not lines:

```ts
function countAuthored(source: string, needle: string): number {
  const code = source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();

      return (
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/*')
      );
    })
    .join('\n');

  return code.split(needle).length - 1;
}
```

The `files` map to extend (`cache-key.spec.ts:108-137`), with its per-file AND total pins:

```ts
  it('authors the prefix literal exactly ONCE across the leaf + its consumers (strict cross-file single source)', () => {
    const files = {
      'cache-key.ts': new URL('./cache-key.ts', import.meta.url),
      'actions-cache-backend.ts': new URL('../backend/actions-cache-backend.ts', import.meta.url),
      'publish-mirror.ts': new URL('../publish/publish-mirror.ts', import.meta.url),
    };

    const perFile: Record<string, number> = {};
    let total = 0;

    for (const [name, url] of Object.entries(files)) {
      const count = countAuthored(readFileSync(url, 'utf8'), CACHE_KEY_PREFIX);
      perFile[name] = count;
      total += count;
    }

    expect(total).toBe(1);
    expect(perFile['cache-key.ts']).toBe(1);
    expect(perFile['actions-cache-backend.ts']).toBe(0);
    expect(perFile['publish-mirror.ts']).toBe(0);
  });
```

**The extension:** add `'release-asset-name.ts': new URL('./release-asset-name.ts', ...)`
with `expect(perFile['release-asset-name.ts']).toBe(0)`, and keep `total` at 1. D-03 imports
the prefix; it must not re-author it.

**What must NOT change:** do not add SPEC files to the map. `release-asset-name.spec.ts`'s
post-rename pin must author `'nx-cache-abc123'` literally (the pinned-literal discipline at
`release-asset-name.spec.ts:11-19`, and `cache-key.spec.ts:36` already authors the same
literal under that exemption). Adding a spec would force the total off 1 for the wrong reason.

Also here: the leaf-import assertion (`:96-106`) is the template for `mirror-seed.ts`'s own
leaf test.

## 9. `src/action/index.spec.ts` -- mocking `cachePlatform`, keeping `CACHE_OS_VALUES` real

This is the harness for OBS-03's label assertions and the thing that avoids Phase 9's
rate-ZERO sampling defect. Two excerpts.

**The partial mock** (`action/index.spec.ts:64-88`, comment abridged):

```ts
// Partial-mock the platform mapper -- same idiom as github-identity.js above, and only
// `cachePlatform` is replaced so `CACHE_OS_VALUES` below is still the real single-sourced
// tuple.
//
// WHY, and it is a SAMPLING-RATE fix rather than a new assertion. ... on ubuntu -- the only
// OS the `test` job runs ... the ambient value IS `'linux'`, so the correct form and the
// substituted form are both green and CI samples the property at a rate of ZERO.
//
// Stubbing the ambient value is what makes the check machine-INDEPENDENT: LINT-02 bans
// reading the real platform in a spec ...
vi.mock('../lib/release-asset-name.js', async (orig) => {
  const actual = await orig<typeof import('../lib/release-asset-name.js')>();

  return { ...actual, cachePlatform: vi.fn((): CacheOs => 'linux') };
});
```
Then `const cachePlatformMock = vi.mocked(cachePlatform);` (`:95`). `publish-mirror.spec.ts`
needs this same block verbatim, at the SAME module path: `publish-mirror.ts:11` today reads
`import { releaseAssetName } from '../lib/release-asset-name.js';`, and OBS-03 adds
`cachePlatform` to that same specifier -- so `vi.mock('../lib/release-asset-name.js', ...)`
intercepts it. Import order in that file is by module PATH (`:1-12`:
`@actions/core`, `../backend/*`, `../lib/cache-key.js`, `../lib/octokit-status.js`,
`../lib/release-asset-name.js`, `../lib/retention.js`), so a new `../lib/mirror-seed.js`
import sorts between `cache-key.js` and `octokit-status.js`.

**The OS axis driven from the tuple** (`action/index.spec.ts:324-348`):

```ts
  // Reader OSes come from the real CACHE_OS_VALUES minus the seed's, so adding an OS
  // discriminator to that tuple automatically adds a case here rather than leaving one
  // reader OS unsampled.
  it.each(CACHE_OS_VALUES.filter((os) => os !== SEED_PRODUCER_OS))(
    'accepts the linux-seeded payload on a %s reader and names linux as the producer (VER-06)',
    async (readerOs) => {
      ...
      cachePlatformMock.mockReturnValue(readerOs);
```
plus the named constant that replaces "the OS this machine is not"
(`action/index.spec.ts:97-103`):

```ts
/**
 * The seed leg's OS, as a literal ... Named once here so the cross-OS cases below derive their
 * reader OSes from the real `CACHE_OS_VALUES` minus this one, rather than spelling "the OS
 * that is not this machine's" (which is the banned machine-dependent form).
 */
const SEED_PRODUCER_OS = 'linux';
```

**What must differ for OBS-03:** here the axis is `CACHE_OS_VALUES.filter(...)` because one
value is the fixed seed OS. For the label there is no fixed value -- every OS is a legitimate
PUBLISHING leg, so the axis is the UNFILTERED `it.each(CACHE_OS_VALUES)`. And per D-11 the
assertion is deep equality over the whole `uploadReleaseAsset` argument array, never
`expect.stringContaining` and never a negated matcher inside `toHaveBeenCalledWith` (which
asserts "SOME call lacks X"). Negate the quantifier, not the predicate.

## 10. A spec asserting on a `ci.yml` JOB BLOCK -- XOS-06 / XOS-07

**Confirmed: there is exactly ONE `jobBlock` helper in the repo, and NO guard asserts any
`needs:` or `max-parallel:` VALUE.** Measured this session:
`git grep -ln "workflows/ci.yml" -- packages/github-cache/src` returns three files
(`docs-same-os-claims.spec.ts`, `dogfood-cross-os.spec.ts`, `nx-target-inputs.spec.ts`);
`git grep -n "function jobBlock"` returns one hit (`dogfood-cross-os.spec.ts:62`);
`git grep -n "max-parallel"` returns only `ci.yml:1008` (comment) and `ci.yml:1017` (value)
plus planning prose and one mention in `read-back.ts:117`; and no spec matches `needs:` as a
subject. So XOS-06/XOS-07 value guards are NEW, and the only two available harnesses are:

**(a) `jobBlock` for VALUES** (`dogfood-cross-os.spec.ts:49-77`, EXACT at HEAD):

```ts
const codeLines = readFileSync(
  new URL('../../../.github/workflows/ci.yml', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'));

/**
 * One job's own block: from the `  <name>:` key (jobs are keyed at two spaces) up to
 * the next line at that same indent, exclusive. Throws rather than returning empty
 * when the job is absent, so a renamed or deleted job fails loud here instead of
 * silently satisfying the `not.toMatch` clause below.
 */
function jobBlock(name: string): string {
  const start = codeLines.findIndex((line) =>
    new RegExp(`^ {2}${name}:\\s*$`).test(line),
  );

  if (start < 0) {
    throw new Error(
      `ci.yml: no job keyed \`  ${name}:\` -- VER-06's guard cannot scope its assertions`,
    );
  }

  const rest = codeLines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));

  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}
```
and its non-vacuity control, which any new usage must copy
(`dogfood-cross-os.spec.ts:80-85`):

```ts
  it('scopes to a real, non-empty job block -- the control that makes the no-matrix clause non-vacuous', () => {
    // A `not.toMatch` against an empty string passes trivially, so prove the
    // extraction actually captured each job before asserting on absence.
    expect(jobBlock('dogfood-seed')).toMatch(/operation:\s*seed/);
    expect(jobBlock('dogfood-verify')).toMatch(/operation:\s*verify/);
  });
```
`jobBlock('publish')` therefore yields `ci.yml:1004-1101` and can assert
`/needs:\s*\[[^\]]*\bintegration\b[^\]]*\]/` and `/max-parallel:\s*1/`.

**(b) raw phrase matching for the COMMENTS.** `codeLines` STRIPS `#` lines
(`dogfood-cross-os.spec.ts:54`), so `jobBlock` structurally CANNOT see the XOS-06 or XOS-07
comment locks. Those go in `docs-same-os-claims.spec.ts`'s raw `readFileSync` rows (item 7).
This split -- `jobBlock` for the value, the phrase table for the comment -- is the whole
answer for XOS-06/XOS-07. Do not build a third harness.

**The current values, verified at HEAD** (`ci.yml:1003-1020`): `publish:` `:1003`,
`if: ${{ !cancelled() && github.event_name == 'push' }}` `:1004`, `needs: build` `:1005`,
`fail-fast: false` `:1007`, the `max-parallel` rationale comment `:1008-1016`,
`max-parallel: 1` `:1017`, `os: [ubuntu-24.04-arm, windows-11-arm]` `:1019`.

**What must differ from the analog's rationale:** `dogfood-cross-os.spec.ts` asserts a job's
shape is NARROW (single-leg seed). XOS-07 asserts a `needs:` list is WIDE. The
"positive control first" clause is even more necessary in the wide direction -- a
`toMatch` on a list is satisfied by any superset, so also pin that `build` is still present,
or a rewrite to `needs: [integration]` alone passes.

---

## Shared Patterns

### S-1. Single source + comment lock + drift guard (the triad)
**Sources:** `lib/cache-key.ts:1-15` (file-level lock) + `lib/cache-key.spec.ts:86-137`
(count + leaf guards); `lib/retention.ts:1-18` + `:61-69` (derive FROM the literal, never
re-author).
**Apply to:** `mirror-seed.ts`, the widened `CACHE_KEY_PREFIX` lock, the two-branch filter.
```ts
export const SHARD_TAG_PATTERN = new RegExp('^' + SHARD_TAG_PREFIX + '\\d{6}$');
```
The lock always names three things: what it governs, the FAILURE MODE, and the tidy-up a
future reader will propose. `release-asset-name.ts:33-49` is the canonical instance:
"the failure mode is a silent MISS, not a crash. The exact produced name is pinned by
release-asset-name.spec.ts."

### S-2. Correcting a claim requires SUPPLYING a replacement reason
**Source:** `docs-same-os-claims.spec.ts:69-77` (the row that requires BOTH the correction and
the replacement justification) and `read-back.ts:100-120` (the do-not-unify lock that D-15
UPDATES rather than deletes).
**Apply to:** D-15's lock update, D-16's `needs:` comment rewrite, D-20's byte-identity
comment, D-21's whole sweep, XOS-06's comment.

### S-3. Machine-independent OS assertions
**Source:** `action/index.spec.ts:64-88` (partial mock) + `:97-103` + `:333` (tuple-driven
`it.each`).
**Apply to:** every new OS-axis assertion in `publish-mirror.spec.ts`, `mirror-seed.spec.ts`,
`read-back.spec.ts`, `releases-backend.spec.ts`.
Never `process.platform` in a spec (LINT-02 `no-restricted-syntax`); never "the OS this
machine is not".

### S-4. Comment-stripped vs raw file reads are DIFFERENT harnesses
**Sources:** `dogfood-cross-os.spec.ts:49-54` (stripped, for YAML values);
`docs-same-os-claims.spec.ts:1-4` (raw, for comment phrases);
`cache-key.spec.ts:17-32` (`countAuthored`, stripped, for authored literals).
**Apply to:** every guard this phase adds against `ci.yml` or a source comment. Picking the
wrong one silently vacuates the guard -- a raw match against `ci.yml` is satisfied by
`ci.yml`'s own comments, and a stripped read cannot see a comment lock at all.

### S-5. Path resolution and file-read idiom
**Source:** `docs-same-os-claims.spec.ts:4`, `dogfood-cross-os.spec.ts:49-51`,
`release-asset-name.spec.ts:115-118`.
Always `readFileSync(new URL('<relative>', import.meta.url), 'utf8')`. Never `__dirname`,
never `process.cwd()`. Depth from `src/lib/` to the workspace root is `'../../../../'`
(`release-asset-name.spec.ts:116`); from `src/` it is `'../../../'`.

---

## No Analog Found

| Target | Role | Data flow | Reason |
|---|---|---|---|
| a `needs:` / `max-parallel:` VALUE guard on the `publish` job | drift guard | file-I/O | MEASURED: no spec asserts either value. `jobBlock` (item 10) is the closest HARNESS but has never been pointed at a `needs:` list or a `max-parallel:` value, and asserting a WIDE list needs a superset-proof clause the narrow-direction analog does not supply. |
| `expect(CACHE_OS_VALUES.length).toBeLessThan(10)` (index injectivity) | unit assertion | transform | No existing spec pins a tuple's LENGTH as a correctness precondition for an encoding. `release-asset-name.spec.ts:100-102` pins the tuple's CONTENTS, which is a different claim. |
| a spec importing module-private predicates for a disjointness proof | unit spec | transform | `cache-key.ts` exports every predicate it tests. RETAIN-05(b) wants two NAMED branches asserted mutually exclusive; whether they are exported (surface cost) or asserted through the composed function (weaker) has no in-repo precedent. Planner must decide explicitly. |

---

## Metadata

**Analog search scope:** `packages/github-cache/src/**` (lib, action, publish, cleanup,
backend, roundtrip, server, package-source-root drift guards),
`packages/github-cache/action.yml`, `.github/workflows/ci.yml`, `start-cache-server/index.js`.
**Files read in full or in targeted ranges:** `lib/cache-key.ts`, `lib/cache-key.spec.ts`,
`lib/dogfood-body.ts`, `lib/dogfood-body.spec.ts`, `lib/release-asset-name.ts`,
`lib/release-asset-name.spec.ts`, `lib/retention.ts`, `server/public-server.integration.spec.ts`,
`publish/publish-mirror.ts`, `publish/publish-mirror.spec.ts`, `action/index.ts`,
`action/index.spec.ts`, `cleanup/cleanup.ts`, `docs-same-os-claims.spec.ts`,
`dogfood-cross-os.spec.ts`, `nx-target-inputs.spec.ts` (header), `roundtrip/read-back.ts`,
`packages/github-cache/action.yml`, `.github/workflows/ci.yml` (publish job head).
**Absence claims made with `rg` (not `git grep`):** the `start-cache-server/index.js` bundle
probes -- `cachePlatform=2`, `releaseAssetName=2`, `dogfoodBody=0`, `CACHE_OS_VALUES=0`,
`isServerProducedAssetName=0`, `shardTag=4`. `git grep` used only over tracked `src/` paths.
**Pattern extraction date:** 2026-07-29
