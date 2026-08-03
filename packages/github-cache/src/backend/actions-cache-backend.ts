import { existsSync, mkdirSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import {
  CACHE_ARCHIVE_DIR,
  cacheArchivePath,
} from '../lib/cache-archive-path.js';
import { cacheKeyFor, type Hash } from '../lib/cache-key.js';
import { withHashLock } from '../lib/with-hash-lock.js';
import type {
  CacheBackend,
  GetResult,
  PutResult,
  ReadableBackend,
} from './types.js';

// The server-produced-key namespace + filter (prefix + HASH_PATTERN) now live in
// the cache-key.ts single-source leaf (TRUST-08 done); this backend just consumes
// cacheKeyFor so save and restore key by the one authored prefix.

/**
 * The project's first real storage backend (ROBUST-03, ROADMAP SC5): a
 * CacheBackend backed by GitHub's own Actions cache through the official,
 * exact-pinned @actions/cache toolkit. get maps to restoreCache, put maps to
 * saveCache, and every path string flows through the one cacheArchivePath helper
 * so save and restore always pass a byte-identical path (Pitfall 7).
 *
 * It takes NO parameters on purpose: nothing about RW-vs-RO is decided here --
 * that is the upstream write gate's job (D-01) -- and this factory must never
 * grow a mode argument (TRUST-05).
 *
 * This backend never returns 'forbidden' -- the value does not exist (types.ts:3-8
 * deleted it), because the read-only backend has no put at all and the SERVER
 * produces the contract's 403 at the protocol boundary. It DOES return 'conflict' on
 * one branch: an ambiguous saveCache no-op, which the contract layer maps to the Nx
 * client's benign 409 (see put).
 *
 * BOTH get and put run under withHashLock (TEST-02 / D-03), because this module is
 * the one that OWNS the shared deterministic archive path. get does
 * restore -> read -> rm and put does write -> save -> rm on the SAME path for a
 * given hash, so an unserialized get/put pair can have one leg's `rm` delete the
 * archive the other leg is about to read or save. The lock lives here rather than
 * at the serve() composition root precisely so it sits with the resource it
 * guards -- and so it is never applied twice (a nested same-hash lock
 * self-deadlocks: the inner call sees the outer call's tail as `prior`, which
 * cannot settle until the inner one resolves).
 *
 * The writable MEMORY backend is intentionally NOT serialized: it has no shared
 * temp path, so there was never anything to protect there.
 *
 * SHAPE (D-01). Two factories, exactly ONE `get`:
 * createReadOnlyActionsCacheBackend owns the construction guards and the single
 * cache.restoreCache READ call site, and createActionsCacheBackend SPREADS it and
 * adds put. They restore at a byte-identical cache version not because two copies
 * agree but because there is only one -- a second read call site is precisely the
 * drift Phase 9 existed to remove.
 *
 * BOTH FACTORIES MUST STAY IN THIS ONE FILE, and it is a hard constraint rather than
 * a style preference. actions-cache-backend.spec.ts's ordered-member scan resolves
 * its subject as `new URL('./actions-cache-backend.ts', ...)` -- a single named file
 * -- so a sibling module carrying its own restoreCache would produce ZERO failures
 * there. The VER-09 package-scope clause in the same spec closes that from the
 * outside; the file constraint is what keeps the ordered scan meaningful at all.
 */

/**
 * Read-only form of the Actions-cache backend (D-01): a ReadableBackend with NO put
 * -- a write is unrepresentable, and the SERVER (not a put() return value) answers a
 * PUT routed here with the Nx contract's 403.
 *
 * Its role is selectBackend's read-only Actions outcome: a leg that declares itself a
 * cache CONSUMER is served this backend, so no entry for that leg's hashes can be
 * produced on its OS at all, and any HIT it records is NECESSARILY produced
 * elsewhere. That property is INDUCTIVE rather than per-run (D-02a) -- it does not
 * depend on job ordering, on a `needs:` edge, or on anything being true of the
 * current run, which is what makes a `[remote cache]` count on such a leg soundly
 * gateable where a writable leg's count is launderable by a re-run. It is one of the
 * documented backend-selection outcomes; see the table in docs/advanced.md ("How the
 * backend is selected"). RW-vs-RO is which factory constructs the server, never a
 * caller-facing mode flag (TRUST-05).
 *
 * It owns the construction preamble for BOTH factories -- the two VER-04 anchor
 * guards and the VER-07 archive-directory mkdir all run here, and the writable
 * factory inherits every one of them by CALLING this one rather than repeating it.
 */
export function createReadOnlyActionsCacheBackend(): ReadableBackend {
  // VER-04. ONE assertion, ONCE, at construction -- and BEFORE the mkdirSync below, so a
  // wrong cwd fails loud instead of the mkdir silently creating a `.nx/cache` in the wrong
  // tree.
  //
  // WHY CONJUNCT 2 IS THE ONE THAT MATTERS. @actions/cache reads GITHUB_WORKSPACE for the
  // tar manifest and for `tar -C`, while glob expansion and our own readFile/writeFile use
  // process.cwd(). When the two DIVERGE the restore reports a HIT, extraction lands under
  // $GITHUB_WORKSPACE, our readFile throws ENOENT under $CWD, and server.ts's handleGet
  // converts that to a 404 -- a permanent, silent all-MISS while @actions/cache cheerfully
  // logs `Cache hit for:`. Nothing errors and nothing is slow; the cache just stops working.
  //
  // WHY AT CONSTRUCTION AND NOT PER REQUEST. A per-request check fires inside get() and is
  // eaten by the SAME catch that produces the 404 -- it would be swallowed by the exact
  // mechanism it exists to expose.
  //
  // THE ASYMMETRY, and it is the reason a green CI run is not evidence. The identical fault
  // is LOUD in publishMirror (which propagates) and SILENT in serve() (where handleGet
  // converts the ENOENT to a 404). So a green publish job says nothing about the health of
  // the serve path, and the only place to catch the divergence for BOTH is here.
  //
  // `resolve` here is a LEGITIMATE node:path use. It compares two anchors; VER-01's ban is
  // on BUILDING the archive path, which lives in cache-archive-path.ts and imports nothing.
  // Without this sentence a later reader applying VER-01 literally deletes the comparison.
  //
  // DO NOT anchor off import.meta.url. esbuild.action.mjs rewrites it to a shim pointing at
  // a NEVER-EMITTED sibling start-cache-server/index.mjs -- deliberately wrong, because
  // serve.ts's isEntrypoint guard depends on the wrongness. It therefore points at the
  // bundle directory inside the bundle and the source directory outside it, neither of which
  // is the workspace root. process.cwd() is the only sound anchor.
  //
  // Dependency-free on purpose: this module is inlined into the committed
  // start-cache-server/index.js, which external repos resolve via `uses:` with NO npm ci,
  // and `nx` is a devDependency. An upward walk for nx.json was considered and rejected --
  // it reaches no verdict the cwd probe does not already reach (a subdirectory cwd fails
  // both) and buys only a better message.
  //
  // MEASURED 2026-07-26 (research/v0.0.2/PROBE-RESULTS.md Q2): the cwd/GITHUB_WORKSPACE
  // identity HOLDS on both runners today. This is a DRIFT GUARD, not a fix for a live
  // break -- and nothing else in the system defends it.
  //
  // BOTH messages below name THIS factory, and the rename came with the D-01 move rather
  // than being cosmetic: after the split these throws come from the function the write
  // path reaches BY CALLING, so a prefix naming the WRITABLE factory would send an
  // operator to a frame that never ran the check. Naming the wrong frame costs most on a
  // read-only leg, which has no write whose failure would surface -- there, an unnamed
  // divergence presents as "cross-OS restore is broken" instead of naming its cause.
  // The rename IS mechanically checked, which is why the old prefix is not quoted anywhere
  // here: the T-13-02-R1 clause in actions-cache-backend.spec.ts scans every non-spec module
  // under src/ and fails if any carries it. That sentence was here BEFORE the clause was --
  // asserting a guard that did not exist, so the absence of the string read as evidence that
  // something enforced the absence. The clause now exists; do not restore the claim without
  // it. (Spec files are excluded by that scan: publish-mirror.spec.ts uses the same string as
  // a vi.mock export KEY, which is not a message.)
  const cwd = process.cwd();

  if (!existsSync(join(cwd, 'nx.json'))) {
    throw new Error(
      `createReadOnlyActionsCacheBackend: the process cwd must be the Nx workspace root, but no nx.json exists at ${cwd}. The archive path is workspace-relative (VER-01), so a cwd anywhere else writes and reads a different file than @actions/cache extracts (VER-04).`,
    );
  }

  // ONE condition, not two, and the simplification is deliberate: `resolve('')` IS
  // `resolve(cwd)`, so an UNSET or BLANK GITHUB_WORKSPACE passes this comparison naturally
  // and needs no special case.
  //
  // Case-fold ceiling, recorded rather than left to be discovered: lowercasing both sides is
  // what VER-04 specifies, and on a case-SENSITIVE filesystem two genuinely different paths
  // differing only in case would compare equal. Accepted -- the false-negative is a
  // pathological workspace layout, while the false-positive it prevents (Windows' own
  // inconsistent drive-letter and path casing) is routine.
  const githubWorkspace = process.env.GITHUB_WORKSPACE ?? '';

  if (resolve(githubWorkspace).toLowerCase() !== resolve(cwd).toLowerCase()) {
    throw new Error(
      `createReadOnlyActionsCacheBackend: GITHUB_WORKSPACE (${githubWorkspace}) and the process cwd (${cwd}) must be the same directory. They are not, so @actions/cache would extract under one and this backend would read under the other -- a reported HIT whose bytes are unreachable, which handleGet then converts to a silent 404 (VER-04).`,
    );
  }

  // VER-07. mkdirSync, NOT the async form: select-backend.ts comment-locks that
  // selectBackend stays SYNCHRONOUS (Function.length === 0, synchronous serve.ts call site,
  // TRUST-05), so this factory must not become async or parameterised. The directory literal
  // comes from CACHE_ARCHIVE_DIR rather than a second authored copy -- one authored `.nx/cache`
  // in the whole repo.
  //
  // Without it, put()'s writeFile ENOENTs on a fresh runner or after `nx reset` and RETHROWS
  // (it is not a ReserveCacheError) into a 500, because writes are fail-closed by design. The
  // read path self-heals through extractTar's io.mkdirP, which is exactly why the write path
  // is the one that needs this and why the bug would look intermittent.
  mkdirSync(CACHE_ARCHIVE_DIR, { recursive: true });

  return {
    get(hash: Hash): Promise<GetResult> {
      return withHashLock(hash, async () => {
        const path = cacheArchivePath(hash);

        // THE TRY OPENS BEFORE THE RESTORE, and the placement is the guarantee rather than
        // the comment on the finally. It previously opened after the miss check, so the
        // cleanup covered ONLY the hit branch: an early `return { kind: 'miss' }` skipped it,
        // and a restoreCache that threw mid-extract was never wrapped at all -- leaving
        // decrypted cache bytes at a DETERMINISTIC per-hash path. The throw then propagates
        // through withHashLock to handleGet, which degrades it to a silent 404 MISS, so
        // nothing about the leftover ever surfaces.
        //
        // WHY THE SPLIT MADE THIS REACHABLE. Before D-01, every Actions-backend instance also
        // carried put, whose own finally rm'd the identical path -- so a leftover was usually
        // swept incidentally by the next write. A CACHE_READ_ONLY leg issues ZERO puts, so
        // that sweep never happens for the rest of the job. Opening the try here is what
        // makes the finally's own claim ("remove it on every exit so nothing is left on a
        // reused or shared runner", T-2-11/WR-01) true of all three exits rather than one.
        try {
          // VER-03. `true` is enableCrossOsArchive and it is the 5TH POSITIONAL argument of
          // restoreCache -- (paths, primaryKey, restoreKeys?, options?, enableCrossOsArchive?),
          // verified against the exact-pinned @actions/cache@6.2.0 lib/cache.d.ts:58. Positions
          // 2 and 3 are FILLED with undefined on purpose: the flag is not an appended argument,
          // and shortening the call moves the flag into restoreKeys' slot.
          //
          // On LINUX this flag is a NO-OP on the cache version: cacheUtils.js:166 pushes the
          // `windows-only` component only when `process.platform === 'win32' &&
          // !enableCrossOsArchive`, so off win32 the component was never pushed at all. The flag
          // ALONE therefore rotates only WINDOWS entries. The both-legs all-MISS this commit
          // produces comes from VER-01's PATH change, whose components are pushed
          // unconditionally (cacheUtils.js:159). See
          // .planning/phases/09-os-invariant-actions-cache-version/09-ROTATION-SIGNAL.md -- an
          // ASYMMETRIC (Windows-only) signal would mean the flag landed WITHOUT the path.
          const matched = await cache.restoreCache(
            [path],
            cacheKeyFor(hash),
            undefined,
            undefined,
            true,
          );

          if (matched === undefined) {
            return { kind: 'miss' };
          }

          const bytes = await readFile(path);

          return { kind: 'hit', bytes };
        } finally {
          // Mirror the put path (T-2-11 / WR-01): a restored archive is decrypted
          // cache bytes on disk; remove it on every exit so nothing is left on a
          // reused or shared runner. ALL THREE exits, since the try above opens
          // before the restore -- hit, miss, and a restore or read that throws.
          await rm(path, { force: true });
        }
      });
    },
    // No put: read-only-ness is structural (ReadableBackend), not a runtime
    // 'forbidden'. The server answers a PUT here with the contract's 403.
  };
}

/**
 * The writable Actions-cache backend: the read-only one, plus put, and nothing else.
 *
 * The spread IS D-01's acceptance criterion in code. It carries over the single `get`
 * closure, so the package keeps exactly one cache.restoreCache READ call site and has
 * no second cache-version computation available to drift -- unrepresentable rather
 * than guarded. It also carries over the construction preamble, and that inheritance
 * is load-bearing rather than incidental: VER-07's mkdir must NOT be lost from the
 * write path (its absence is the ENOENT-into-500 defect the comment there describes),
 * and calling the read-only factory is how it stays.
 *
 * The spread is safe for the reason serve.ts:91-95 already records at its own
 * spread-a-backend site: backend factories return closures over captured state, not
 * this-bound methods.
 *
 * Zero parameters, like every backend factory. A `readOnly` argument is settled
 * project law against (D-03/TRUST-05), not a judgement call: a flagged factory has ONE
 * return type, so isWritableBackend would be true for a read-only instance and the 403
 * would have to move back into a runtime put() value that types.ts:3-8 deliberately
 * deleted.
 */
export function createActionsCacheBackend(): CacheBackend {
  return {
    ...createReadOnlyActionsCacheBackend(),

    put(hash: Hash, bytes: Buffer): Promise<PutResult> {
      return withHashLock(hash, async () => {
        const path = cacheArchivePath(hash);

        // VER-07, SECOND HALF -- and it is the write path catching up to the read path
        // rather than a new guarantee. The construction-time mkdir above establishes the
        // directory ONCE per serve() process; nothing re-establishes it if it disappears
        // while the process is alive. That is not hypothetical here: moving the archive out
        // of tmpdir() and into `.nx/cache` put it somewhere NX ITSELF DELETES, and
        // cache-archive-path.ts already names the case -- "Resetting under a running sidecar
        // deletes the directory the next put()'s writeFile needs, which ENOENTs into a 500."
        //
        // The read path never had this exposure: extractTar calls io.mkdirP, so a restore
        // recreates what it needs and self-heals. So the SAME deletion is invisible on reads
        // and fatal on writes -- which is why the bug looks intermittent, and why the fix
        // belongs on this side only.
        //
        // The consequence of leaving it at construction is silent: writeFile ENOENTs,
        // rethrows (it is not a ReserveCacheError, so the fail-closed guard below does not
        // catch it), becomes a 500, and the Nx client SKIPS the write without failing the
        // build. Green build, permanently cold cache, no error a consumer would ever see.
        //
        // Idempotent and once per put, not per process: `recursive: true` is a no-op when
        // the directory is already there, which is every call but the pathological one. The
        // sync form matches the construction-time call for the reason stated there.
        mkdirSync(CACHE_ARCHIVE_DIR, { recursive: true });

        await writeFile(path, bytes);

        try {
          // D-04 / D-06 / SRV-05: saveCache resolves a positive cache id on a
          // CONFIRMED write, or the ambiguous sentinel -1. -1 is NOT proof of a
          // benign no-op: @actions/cache (verified v6.2.0, cache.js saveCacheV1/V2
          // catch arms) swallows EVERY non-ValidationError fault -- 5xx, network
          // errors, CacheWriteDeniedError, FinalizeCacheError, over-data-cap -- via
          // core.warning/core.error and returns -1 WITHOUT throwing. The upstream
          // WRITE GATE (D-02) only gates trust; it cannot detect a cache-service
          // outage or a runtime token-scope regression. So a bare -1 would let a
          // dropped write masquerade as a silent 200 -- exactly the fail-closed
          // hole SRV-05/D-06 forbid.
          //
          // Disambiguate the two -1 causes with a lookupOnly existence probe (no
          // download): if the entry IS present, it was a benign already-exists (or
          // a concurrent job's write) and 'stored' is correct; if it is ABSENT, the
          // write did not land and the response must not be a silent 200.
          //
          // That absent branch answers 'conflict' (409), not a throw.
          // THREAT-MODEL.md control C1 states a blocked PR write is a
          // benign 409/no-op, and the Nx client treats 409 as a graceful no-op -- so
          // 409 satisfies SRV-05/D-06's actual requirement (no silent 200) without
          // the build-breaking 500 the throw produced via server.ts's put-fault
          // handler. The predecessor did exactly this
          // (`cacheId === -1 ? 'conflict' : 'stored'`). The real trigger is a
          // base-scope read-only PR activity type (for example `pull_request`
          // `[closed]`); an ordinary fork PR writes its own isolated scope and
          // succeeds.
          //
          // The warning exists because a scope denial and a genuine cache-service
          // outage are indistinguishable at this layer BY DESIGN -- @actions/cache
          // collapses both to -1. Warn, never fail the build.
          //
          // VER-03. `true` is enableCrossOsArchive and it is the 4TH POSITIONAL argument of
          // saveCache -- (paths, key, options?, enableCrossOsArchive?) -- NOT the 5th, and
          // NOT the 3rd. Position 2 (options) must be filled with undefined.
          //
          // UPSTREAM'S JSDoc IS WRONG, and it is wrong in the direction that breaks this
          // silently. Verified against the exact-pinned @actions/cache@6.2.0
          // lib/cache.d.ts: the JSDoc at :64-65 documents `enableCrossOsArchive` BEFORE
          // `options`, while the real signature at :68 is the reverse. A reader who trusts
          // the JSDoc writes `saveCache([path], key, true)` -- the boolean lands in the
          // options slot, TypeScript rejects it if you are lucky and coerces it if the type
          // ever widens, and the flag is simply never passed. restoreCache's JSDoc
          // (:53-55) happens to match its signature; only saveCache's is inverted.
          const cacheId = await cache.saveCache(
            [path],
            cacheKeyFor(hash),
            undefined,
            true,
          );

          if (cacheId > 0) {
            return 'stored';
          }

          // VER-03 / D-10. `true` is enableCrossOsArchive at the 5TH POSITIONAL, same as the
          // read above. Here it IS a pure append, which makes this the site most likely to be
          // the only one done right -- and the one most likely to be forgotten, because it
          // looks like an internal detail rather than a cache operation.
          //
          // It MUST carry the flag. This probe exists to disambiguate saveCache's ambiguous
          // -1, and the probe reads at whatever cache VERSION its own arguments imply.
          // Probing at a DIFFERENT version from the save reports "absent" for an entry that
          // is PRESENT -- so on Windows every write would take the not-stored branch and
          // answer a spurious 409, and the warning below would fire on healthy writes.
          const present = await cache.restoreCache(
            [path],
            cacheKeyFor(hash),
            [],
            {
              lookupOnly: true,
            },
            true,
          );

          if (present !== undefined) {
            return 'stored';
          }

          core.warning(
            `github-cache: saveCache reported no write (id -1) and no entry exists for key ${cacheKeyFor(hash)}; reporting a 409 no-op. Either the runner's cache scope is read-only (a base-scope PR activity type) or the cache service dropped the write.`,
          );

          return 'conflict';
        } catch (error) {
          // Defense-in-depth: if a future @actions/cache version throws a
          // ReserveCacheError instead of returning -1, a reserve conflict still
          // means another job is creating the same byte-identical entry (CORR-01).
          if (error instanceof Error && error.name === 'ReserveCacheError') {
            return 'stored';
          }

          throw error;
        } finally {
          // Cleanup runs on every exit path -- success, benign no-op, and the
          // propagating-error path -- so cache bytes are never left on a shared or
          // reused runner (T-2-11).
          await rm(path, { force: true });
        }
      });
    },
  };
}
