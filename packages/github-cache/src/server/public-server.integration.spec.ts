import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWritableMemoryBackend } from '../backend/memory-backend.js';
import { createCacheServer } from '../index.js';

// INTEGRATION (real loopback HTTP, no mocks): exercises the PUBLIC contract a
// consumer actually calls -- createCacheServer(backend, token) -- end to end over a
// real socket. Distinct from serve.spec, which drives serve() with a MOCKED
// selectBackend; this uses the exported factory + a real backend + real fetch, so it
// proves the barrel export answers an authenticated PUT->GET round-trip, enforces
// the bearer gate, and maps a backend miss to 404. Runs on ci.yml's `integration`
// matrix (ubuntu + windows), so the socket/HTTP path is proven cross-OS -- which is
// exactly what the previously-vacuous integration job never did.

const TOKEN = 'integration-bearer-token';

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;

      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

describe('createCacheServer public contract (integration, real HTTP)', () => {
  let server: Server;
  let base: string;

  beforeEach(async () => {
    server = createCacheServer(createWritableMemoryBackend(), TOKEN);
    base = await listen(server);
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('answers an authenticated PUT then GET round-trip with matching bytes', async () => {
    const url = `${base}/v1/cache/abc123`;
    const body = Buffer.from('integration-tar-bytes');
    const headers = { authorization: `Bearer ${TOKEN}` };

    const put = await fetch(url, { method: 'PUT', headers, body });

    expect(put.status).toBe(200);

    const get = await fetch(url, { headers });

    expect(get.status).toBe(200);
    expect(Buffer.from(await get.arrayBuffer())).toEqual(body);
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await fetch(`${base}/v1/cache/abc123`);

    expect(res.status).toBe(401);
  });

  it('maps a backend miss to a 404', async () => {
    const res = await fetch(`${base}/v1/cache/deadbeef`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(res.status).toBe(404);
  });
});
