import type { Hash } from './cache-key.js';

/**
 * Single source of truth for the archive path passed to @actions/cache (VER-01,
 * ROBUST-03). Both the restore and the save call sites MUST take their path from this
 * one helper so save and restore always agree on a byte-identical string.
 *
 * CACHE_ARCHIVE_DIR is exported so `.nx/cache` is authored EXACTLY ONCE: the same
 * string is needed by the mkdirSync in actions-cache-backend.ts (VER-07) and by the
 * template below. Two authored copies of a path that IS the cache version is precisely
 * the drift this file's single-source rule exists to prevent. The forward slash between
 * them is hardcoded, never a separator accessor.
 *
 * Kept a true leaf -- it imports NOTHING but the type of its own parameter, and
 * cache-archive-path.spec.ts asserts that import list by EQUALITY rather than by
 * absence, so ANY added import fails the build. That is not tidiness: every module this
 * one could import is a module that could reach a platform-dependent value.
 *
 * LOAD-BEARING, comment-locked (Pitfall 7). @actions/cache sha256s the LITERAL path
 * strings, the compression method and a salt into the cache VERSION
 * (cacheUtils.js:157-172, verified against the exact-pinned 6.2.0), so a cosmetic edit
 * here -- inlining it, reformatting it, renaming the file stem, or "tidying" the
 * template -- silently changes the derived version and every restore MISSes, with no
 * error anywhere. Never touch this path without re-verifying an end-to-end restore in CI
 * (the Plan 06 dogfood canary); the failure mode is a silent MISS, not a crash.
 *
 * FORBIDDEN EDITS, and the reason the ban is on the SHAPE and not only on the value:
 * the literal is workspace-relative and forward-slash ON PURPOSE, so it is byte-identical
 * on win32 and linux. Do not rebuild it with `join`, `resolve` or `normalize`; do not
 * reach for `sep` or `delimiter`; do not read `tmpdir()`, `homedir()` or `RUNNER_TEMP`.
 * Any of those makes the string OS-dependent again, which makes the cache version
 * OS-dependent, which is the whole defect Phase 9 removed. The spec pins the value AND
 * scans this module's source for those names -- but it STRIPS COMMENTS FIRST, deliberately,
 * so this lock is free to spell them in prose and stay readable. A later reader must NOT
 * "protect" the scan by mangling this paragraph; only the spec's own regex source is
 * contorted, and it says so where it is written.
 *
 * WHY `.nx/cache` SPECIFICALLY -- it is GITIGNORED. .gitignore covers `.nx/cache`
 * exactly, NOT `.nx/` wholesale, so a later tidy into some other `.nx/` subdirectory
 * would put a transient multi-megabyte file into Nx's own workspace file map and produce a
 * self-referential, intermittent task-hash perturbation. Gitignored, not merely
 * workspace-relative, is the reason this directory and no sibling.
 *
 * Nx 23.1.0 MEASURED to tolerate a foreign archive here, four ways: the
 * `@op-nx/github-cache:build` hash was byte-identical across four runs with a
 * 5,242,880-byte foreign .tar present; `getCacheSize()` returned 2,974,242 bytes and
 * EXCLUDED it, so it cannot drive `removeOldCacheRecords` eviction; the CI-only
 * `assertCacheIsValid` warning did not fire; and `nx reset` still clears it. The
 * instrument fires -- a positive control (`zz-stray-probe.txt`) DID move the hash. The Nx
 * VERSION is recorded beside the result on purpose: a future Nx major is a prompt to
 * re-measure, not an assumption to inherit.
 *
 * `nx reset` deletes this directory, so the local proof order is RESET FIRST, THEN start
 * the sidecar (D-36 / TEST-10). Resetting under a running sidecar deletes the directory
 * the next put()'s writeFile needs, which ENOENTs into a 500.
 *
 * ponytail: CROSS-PROCESS INVARIANT, documented not enforced. This path is
 * deterministic per hash and therefore SHARED by every process using this backend.
 * `withHashLock` (actions-cache-backend.ts) is in-process only and cannot serialize
 * across processes. Callers MUST NOT run `serve()` and `publishMirror()`
 * concurrently in the same job or container: two processes on the same hash can
 * have one leg's `rm` delete the archive the other is about to save (a silently
 * dropped write), or one leg's `writeFile` overwrite the archive the other is
 * reading (wrong bytes mirrored). The documented wiring runs publish as a separate
 * sequential step (docs/advanced.md) and this repo's ci.yml does the same, so no
 * supported deployment reaches it. Moving the path in Phase 9 did NOT change any of
 * this: a per-process unique path is still NOT available -- see the comment lock above.
 * Ceiling: if a colocated deployment ever becomes supported, the upgrade path is a
 * cross-process advisory lock keyed on the hash (an `fs.mkdir` sentinel plus a stale-lock
 * TTL), NOT a different path and NOT a new dependency.
 */
export const CACHE_ARCHIVE_DIR = '.nx/cache';

export function cacheArchivePath(hash: Hash): string {
  return `${CACHE_ARCHIVE_DIR}/nx-github-cache-${hash}.tar`;
}
