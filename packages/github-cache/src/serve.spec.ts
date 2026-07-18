import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { serve } from './serve.js';

let server: Server;

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe('serve (SC4 composition root)', () => {
  it('binds 127.0.0.1 and answers a scripted authenticated PUT then GET round-trip', async () => {
    const running = await serve();
    server = running.server;

    expect((server.address() as AddressInfo).address).toBe('127.0.0.1');

    const url = `${running.url}/v1/cache/abc123`;
    const auth = { authorization: `Bearer ${running.token}` };
    const body = Buffer.from('tar-bytes');

    const put = await fetch(url, { method: 'PUT', headers: auth, body });

    expect(put.status).toBe(200);

    const get = await fetch(url, { headers: auth });

    expect(get.status).toBe(200);
    expect(get.headers.get('content-length')).toBe(String(body.length));
    expect(Buffer.from(await get.arrayBuffer())).toEqual(body);
  });

  it('mints a CSPRNG bearer token whose absence yields 401 (unauthenticated round-trip is rejected)', async () => {
    const running = await serve();
    server = running.server;

    expect(running.token).toMatch(/^[a-f0-9]{64}$/);

    const res = await fetch(`${running.url}/v1/cache/abc123`);

    expect(res.status).toBe(401);
  });

  it('falls back to an OS-assigned port on an out-of-range port value, never throwing ERR_SOCKET_BAD_PORT', async () => {
    const running = await serve({ port: 999999 });
    server = running.server;

    expect(running.port).toBeGreaterThan(0);
    expect((server.address() as AddressInfo).address).toBe('127.0.0.1');
  });
});
