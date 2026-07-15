import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restoreCache, saveCache } from '@actions/cache';
import type { CacheBackend, PutResult } from '../types.js';

// @actions/cache computes its cache "version" (verified against
// actions/toolkit's cacheUtils.getCacheVersion) by hashing the exact `paths`
// strings passed in, alongside the compression method. restoreCache only
// finds an entry whose version matches -- so save and restore for the same
// hash MUST be called with byte-identical paths, not just the same key.
// Using a fresh mkdtemp() per call (as an earlier version of this file did)
// breaks that: it produces a different version each time and every restore
// silently misses (verified end-to-end via the act harness). This helper is
// the single source of truth for that path so every caller (this backend's
// get/put, and publish-mirror.ts's restoreCache call) agrees on it.
export function cacheArchivePath(hash: string): string {
  return join(tmpdir(), 'op-nx-github-cache', `${hash}.tar.gz`);
}

// @actions/cache's public saveCache()/restoreCache() are best-effort by
// design (verified against actions/toolkit source): they catch reservation
// and read/write-policy denials internally, log a warning, and return a
// sentinel (-1 / undefined) instead of a distinguishable error. So "already
// cached" and "write denied by a read-only token" both collapse to -1 here;
// only a ValidationError (malformed key/paths) is ever actually thrown.
// GitHub's own read-only-trigger enforcement (pv-5) is therefore a silent
// defense-in-depth layer, not something this code can branch on -- trust.ts's
// isWriteTrusted() gate (which runs before this backend is ever called) is
// the sole in-code write control.
export function createActionsCacheBackend(): CacheBackend {
  return {
    async get(hash: string): Promise<Buffer | null> {
      const filePath = cacheArchivePath(hash);

      await mkdir(join(filePath, '..'), { recursive: true });

      try {
        const hit = await restoreCache([filePath], hash, []);

        if (!hit) {
          return null;
        }

        return await readFile(filePath);
      } finally {
        await rm(filePath, { force: true });
      }
    },

    async put(hash: string, body: Buffer): Promise<PutResult> {
      const filePath = cacheArchivePath(hash);

      await mkdir(join(filePath, '..'), { recursive: true });

      try {
        await writeFile(filePath, body);
        const cacheId = await saveCache([filePath], hash);

        // ponytail: -1 collapses "already exists" and "write denied" into one
        // case (see module doc comment); treat as an idempotent no-op (409),
        // matching the mirror backend's own catch-and-no-op pattern.
        return cacheId === -1 ? 'conflict' : 'stored';
      } finally {
        await rm(filePath, { force: true });
      }
    },
  };
}
