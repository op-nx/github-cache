import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createWritableMemoryBackend } from '../backend/memory-backend.js';
import { createCacheServer, generateToken } from './server.js';

let server: Server;

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function listen(): Promise<string> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const { port } = server.address() as AddressInfo;

  return `http://127.0.0.1:${port}`;
}

describe('createCacheServer', () => {
  it('binds 127.0.0.1 only (SRV-01)', async () => {
    server = createCacheServer(createWritableMemoryBackend(), generateToken());
    await listen();

    const address = server.address() as AddressInfo;

    expect(address.address).toBe('127.0.0.1');
  });

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
});
