import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
 */
export function cacheArchivePath(hash: string): string {
  return join(tmpdir(), `nx-github-cache-${hash}.tar`);
}
