import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import type { CacheBackend } from '../backend/types.js';
import {
  createReadOnlyMemoryBackend,
  createWritableMemoryBackend,
} from '../backend/memory-backend.js';
import {
  createCacheServer,
  generateToken,
  MAX_CACHE_BODY_BYTES,
} from './server.js';

let server: http.Server;

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function listen(): Promise<string> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;

  return `http://127.0.0.1:${port}`;
}

describe('createCacheServer', () => {
  it('returns 401 when the Authorization header is missing (SRV-02)', async () => {
    server = createCacheServer(createWritableMemoryBackend(), generateToken());
    const base = await listen();

    const res = await fetch(`${base}/v1/cache/abc123`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a wrong bearer token without throwing (SRV-02)', async () => {
    server = createCacheServer(createWritableMemoryBackend(), generateToken());
    const base = await listen();

    const res = await fetch(`${base}/v1/cache/abc123`, {
      headers: { authorization: 'Bearer wrong-token' },
    });

    expect(res.status).toBe(401);
  });

  it('stores a PUT then serves it on GET with Content-Length (SC2 round-trip)', async () => {
    const token = generateToken();
    server = createCacheServer(createWritableMemoryBackend(), token);
    const base = await listen();
    const url = `${base}/v1/cache/abc123`;
    const auth = { authorization: `Bearer ${token}` };
    const body = Buffer.from('tar-bytes');

    const put = await fetch(url, { method: 'PUT', headers: auth, body });

    expect(put.status).toBe(200);

    const get = await fetch(url, { headers: auth });

    expect(get.status).toBe(200);
    expect(get.headers.get('content-length')).toBe(String(body.length));
    expect(Buffer.from(await get.arrayBuffer())).toEqual(body);
  });

  it('returns 404 for a GET of an unstored hash', async () => {
    const token = generateToken();
    server = createCacheServer(createWritableMemoryBackend(), token);
    const base = await listen();

    const res = await fetch(`${base}/v1/cache/deadbeef`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
  });

  // SRV-04: the 2 GiB body-size ceiling is an exact, pinned constant.
  it('exposes MAX_CACHE_BODY_BYTES as exactly 2 GiB (SRV-04)', () => {
    expect(MAX_CACHE_BODY_BYTES).toBe(2 * 1024 * 1024 * 1024);
    expect(MAX_CACHE_BODY_BYTES).toBe(2_147_483_648);
  });

  // SRV-03: a malformed {hash} is rejected with 400 BEFORE any backend call.
  it('rejects a non-hex hash on GET with 400 and never calls the backend (SRV-03)', async () => {
    const token = generateToken();
    let called = false;
    const spy: CacheBackend = {
      get: async () => {
        called = true;

        return { kind: 'miss' };
      },
      put: async () => {
        called = true;

        return 'stored';
      },
    };
    server = createCacheServer(spy, token);
    const base = await listen();

    const res = await fetch(`${base}/v1/cache/nothex_zz`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(400);
    expect(called).toBe(false);
  });

  it('rejects a malformed hash on PUT with 400 and never calls the backend (SRV-03)', async () => {
    const token = generateToken();
    let called = false;
    const spy: CacheBackend = {
      get: async () => {
        called = true;

        return { kind: 'miss' };
      },
      put: async () => {
        called = true;

        return 'stored';
      },
    };
    server = createCacheServer(spy, token);
    const base = await listen();

    const res = await fetch(`${base}/v1/cache/NOTHEX`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      body: Buffer.from('x'),
    });

    expect(res.status).toBe(400);
    expect(called).toBe(false);
  });

  it('rejects a hash longer than 512 chars with 400 (SRV-03)', async () => {
    const token = generateToken();
    server = createCacheServer(createWritableMemoryBackend(), token);
    const base = await listen();
    const longHash = 'a'.repeat(513);

    const res = await fetch(`${base}/v1/cache/${longHash}`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(400);
  });

  it('rejects an empty hash with 400 (SRV-03)', async () => {
    const token = generateToken();
    server = createCacheServer(createWritableMemoryBackend(), token);
    const base = await listen();

    const res = await fetch(`${base}/v1/cache/`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(400);
  });

  // SRV-04: fast path -- an oversized Content-Length is rejected on the header.
  it('rejects an oversized Content-Length with 413 before buffering (SRV-04 fast path)', async () => {
    const token = generateToken();
    let putCalled = false;
    const spy: CacheBackend = {
      get: async () => ({ kind: 'miss' }),
      put: async () => {
        putCalled = true;

        return 'stored';
      },
    };
    server = createCacheServer(spy, token, 8);
    const base = await listen();

    let status: number | undefined;

    try {
      const res = await fetch(`${base}/v1/cache/abc123`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}` },
        body: Buffer.from('123456789'),
      });
      status = res.status;
    } catch {
      // socket destroyed on the oversized upload: acceptable, the abort is the point
    }

    expect(putCalled).toBe(false);

    if (status !== undefined) {
      expect(status).toBe(413);
    }
  });

  // SRV-04: streaming path -- a body that only overflows mid-stream (no
  // Content-Length, chunked transfer) is aborted without full buffering.
  it('aborts a streamed body exceeding the cap without buffering it (SRV-04 streaming)', async () => {
    const token = generateToken();
    let putCalled = false;
    const spy: CacheBackend = {
      get: async () => ({ kind: 'miss' }),
      put: async () => {
        putCalled = true;

        return 'stored';
      },
    };
    server = createCacheServer(spy, token, 8);
    const base = await listen();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(64));
        controller.close();
      },
    });

    let status: number | undefined;

    try {
      const res = await fetch(`${base}/v1/cache/abc123`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}` },
        body,
        duplex: 'half',
      } as RequestInit & { duplex: 'half' });
      status = res.status;
    } catch {
      // socket destroyed mid-stream: fetch rejects; the abort is the point
    }

    expect(putCalled).toBe(false);

    if (status !== undefined) {
      expect(status).toBe(413);
    }
  });

  // SRV-05: a read fault degrades to a 404 MISS, never a build-breaking 5xx.
  it('degrades a backend.get fault to a 404 MISS, never 5xx (SRV-05)', async () => {
    const token = generateToken();
    const faultyRead: CacheBackend = {
      get: async () => {
        throw new Error('read fault');
      },
      put: async () => 'stored',
    };
    server = createCacheServer(faultyRead, token);
    const base = await listen();

    const res = await fetch(`${base}/v1/cache/abc123`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });

    expect(res.status).toBe(404);
  });

  // SRV-05: writes fail closed -- a put fault surfaces an error, never a silent 200.
  it('surfaces an error status on a backend.put fault, never a silent 200 (SRV-05 fail-closed)', async () => {
    const token = generateToken();
    const faultyWrite: CacheBackend = {
      get: async () => ({ kind: 'miss' }),
      put: async () => {
        throw new Error('write fault');
      },
    };
    server = createCacheServer(faultyWrite, token);
    const base = await listen();

    const res = await fetch(`${base}/v1/cache/abc123`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      body: Buffer.from('tar-bytes'),
      signal: AbortSignal.timeout(3000),
    });

    expect(res.status).not.toBe(200);
    expect(res.status).toBe(500);
  });

  it('returns 409 on a second PUT of an already-stored hash (SC2 no-override)', async () => {
    const token = generateToken();
    server = createCacheServer(createWritableMemoryBackend(), token);
    const base = await listen();
    const url = `${base}/v1/cache/abc123`;
    const auth = { authorization: `Bearer ${token}` };

    const first = await fetch(url, {
      method: 'PUT',
      headers: auth,
      body: Buffer.from('one'),
    });

    expect(first.status).toBe(200);

    const second = await fetch(url, {
      method: 'PUT',
      headers: auth,
      body: Buffer.from('two'),
    });

    expect(second.status).toBe(409);
  });

  // 403: the D-04 read-only seam -- a read-only backend's put yields 'forbidden'.
  it('returns 403 on a PUT against a read-only backend (D-04 seam)', async () => {
    const token = generateToken();
    server = createCacheServer(createReadOnlyMemoryBackend(), token);
    const base = await listen();

    const res = await fetch(`${base}/v1/cache/abc123`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}` },
      body: Buffer.from('tar-bytes'),
    });

    expect(res.status).toBe(403);
  });

  // CR-01: a client that aborts mid-PUT-body destroys the request stream, which
  // rejects the async handler's body-drain loop. Unguarded, that reject becomes
  // an unhandledRejection -> process crash on Node 24 (default policy: throw).
  // The guarded handler must fail only this request and keep serving.
  it('does not crash on a client abort mid-PUT-body and keeps serving (CR-01)', async () => {
    const token = generateToken();
    server = createCacheServer(createWritableMemoryBackend(), token);
    const base = await listen();
    const { port } = server.address() as AddressInfo;

    const rejections: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      rejections.push(reason);
    };

    process.on('unhandledRejection', onUnhandled);

    try {
      // Declare more bytes than we send, then destroy the socket mid-body so the
      // server's body-drain stream rejects (ERR_STREAM_PREMATURE_CLOSE).
      await new Promise<void>((resolve) => {
        const req = http.request({
          port,
          method: 'PUT',
          path: '/v1/cache/abc123',
          headers: {
            authorization: `Bearer ${token}`,
            'content-length': '1000',
          },
        });

        req.on('error', () => resolve());
        req.on('close', () => resolve());
        req.write('partial');

        setTimeout(() => req.destroy(), 50);
      });

      // Give the server's async handler a tick to reject (or not).
      await new Promise((resolve) => setTimeout(resolve, 150));

      // The process must still be alive and the server still answering.
      const res = await fetch(`${base}/v1/cache/deadbeef`, {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(404);
      expect(rejections).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});
