import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createReadOnlyMemoryBackend,
  createWritableMemoryBackend,
} from '../backend/memory-backend.js';
import { createCacheServer, generateToken } from '../server/server.js';

/**
 * Documented, human-maintained Nx version this fixture is vendored from
 * (floor = Nx 21+, where PUT success became a hard 200). NEVER derived from the
 * spec's embedded `info.version` -- that stayed `1.0.0` across the 202->200
 * contract drift, so it is useless as a drift signal (Pitfall 2, D-05).
 */
const PINNED_NX_VERSION = '23.1.0';

/**
 * sha256 of the committed vendored spec file bytes. The drift signal is the FULL
 * file hash, never `info.version`.
 *
 * RE-VENDORING (on an Nx major bump): re-fetch the OpenAPI spec from the new
 * version's self-hosted-caching docs, overwrite nx-cache-openapi.v<ver>.json
 * verbatim, recompute this digest (`sha256` of the committed file), and update
 * both PINNED_NX_VERSION and this constant. A real 202->200-class contract drift
 * is caught by a human at exactly that step.
 */
const VENDORED_SPEC_SHA256 =
  '8c648a0f3c63bc496c56c255fd4be3022a892c48fd41eda099999308ccc529e5';

let server: Server | undefined;

afterEach(async () => {
  if (server) {
    const closing = server;
    server = undefined;
    await new Promise<void>((resolve) => closing.close(() => resolve()));
  }
});

async function listen(created: Server): Promise<string> {
  server = created;
  await new Promise<void>((resolve) => {
    created.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = created.address() as AddressInfo;

  return `http://127.0.0.1:${port}`;
}

describe('Nx contract conformance (TEST-07)', () => {
  describe('Layer (a): vendored-spec drift guard', () => {
    const specBytes = readFileSync(
      new URL('./nx-cache-openapi.v23.1.0.json', import.meta.url),
    );

    it('matches the pinned sha256 of the full committed spec file (drift guard)', () => {
      const digest = createHash('sha256').update(specBytes).digest('hex');

      expect(digest).toBe(VENDORED_SPEC_SHA256);
    });

    it('pins the documented Nx version, not the spec info.version', () => {
      expect(PINNED_NX_VERSION).toBe('23.1.0');
    });

    it('vendors the /v1/cache/{hash} path with put and get operations', () => {
      const spec = JSON.parse(specBytes.toString('utf8'));
      const operation = spec.paths['/v1/cache/{hash}'];

      expect(operation).toBeDefined();
      expect(operation.put).toBeDefined();
      expect(operation.get).toBeDefined();
    });
  });

  describe('Layer (b): behavioral status conformance', () => {
    it('returns exactly 200 on a successful PUT (hard 200, never any-2xx)', async () => {
      const token = generateToken();
      const base = await listen(
        createCacheServer(createWritableMemoryBackend(), token),
      );

      const res = await fetch(`${base}/v1/cache/abc123`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}` },
        body: Buffer.from('tar-bytes'),
      });

      expect(res.status).toBe(200);
    });

    it('returns 409 on a second PUT of an existing record', async () => {
      const token = generateToken();
      const base = await listen(
        createCacheServer(createWritableMemoryBackend(), token),
      );
      const url = `${base}/v1/cache/abc123`;
      const auth = { authorization: `Bearer ${token}` };

      await fetch(url, {
        method: 'PUT',
        headers: auth,
        body: Buffer.from('a'),
      });
      const res = await fetch(url, {
        method: 'PUT',
        headers: auth,
        body: Buffer.from('b'),
      });

      expect(res.status).toBe(409);
    });

    it('returns 401 on an unauthenticated request', async () => {
      const token = generateToken();
      const base = await listen(
        createCacheServer(createWritableMemoryBackend(), token),
      );

      const res = await fetch(`${base}/v1/cache/abc123`);

      expect(res.status).toBe(401);
    });

    it('returns 403 on a PUT against a read-only backend', async () => {
      const token = generateToken();
      const base = await listen(
        createCacheServer(createReadOnlyMemoryBackend(), token),
      );

      const res = await fetch(`${base}/v1/cache/abc123`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}` },
        body: Buffer.from('tar-bytes'),
      });

      expect(res.status).toBe(403);
    });

    it('returns 404 on a GET of a missing hash', async () => {
      const token = generateToken();
      const base = await listen(
        createCacheServer(createWritableMemoryBackend(), token),
      );

      const res = await fetch(`${base}/v1/cache/deadbeef`, {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(404);
    });

    it('returns 200 with a present Content-Length on a GET hit', async () => {
      const token = generateToken();
      const base = await listen(
        createCacheServer(createWritableMemoryBackend(), token),
      );
      const url = `${base}/v1/cache/abc123`;
      const auth = { authorization: `Bearer ${token}` };
      const body = Buffer.from('tar-bytes');

      await fetch(url, { method: 'PUT', headers: auth, body });
      const res = await fetch(url, { headers: auth });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-length')).toBe(String(body.length));
    });
  });
});
