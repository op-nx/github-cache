import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Hash } from './cache-key.js';

/**
 * Single source of truth for the temp archive path passed to @actions/cache
 * (ROBUST-03). Both the restore and the save call sites MUST resolve their path
 * through this one helper so save and restore always agree on a byte-identical
 * string.
 *
 * LOAD-BEARING, comment-locked (Pitfall 7). @actions/cache version-hashes the
 * LITERAL path string together with the compression choice, so a cosmetic edit
 * here -- inlining it, reformatting it, renaming the file stem, or "tidying" the
 * template -- silently changes the derived version and every restore MISSes, with
 * no error anywhere. Never touch this path without re-verifying an end-to-end
 * restore in CI (the Plan 06 dogfood canary); the failure mode is a silent MISS,
 * not a crash. Its exact produced file name is pinned by cache-archive-path.spec.ts.
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
 * supported deployment reaches it. A per-process unique path is NOT available --
 * see the comment lock above. Ceiling: if a colocated deployment ever becomes
 * supported, the upgrade path is a cross-process advisory lock keyed on the hash
 * (an `fs.mkdir` sentinel plus a stale-lock TTL), NOT a different path and NOT a
 * new dependency.
 */
export function cacheArchivePath(hash: Hash): string {
  return join(tmpdir(), `nx-github-cache-${hash}.tar`);
}
