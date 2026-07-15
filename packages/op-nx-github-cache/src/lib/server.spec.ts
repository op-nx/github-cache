import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from './server.js';
import type { CacheBackend, PutResult } from './types.js';

const TOKEN = 'test-token';
const HASH = 'abc123';

function createInMemoryBackend(): CacheBackend & {
  store: Map<string, Buffer>;
} {
  const store = new Map<string, Buffer>();

  return {
    store,
    async get(hash: string) {
      return store.get(hash) ?? null;
    },
    async put(hash: string, body: Buffer): Promise<PutResult> {
      if (store.has(hash)) {
        return 'conflict';
      }

      store.set(hash, body);

      return 'stored';
    },
  };
}

describe('server', () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  let backend: ReturnType<typeof createInMemoryBackend>;

  beforeEach(async () => {
    backend = createInMemoryBackend();
    server = createServer({ backend, token: TOKEN });

    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );

    const address = server.address() as AddressInfo;

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function request(
    method: string,
    hash: string,
    options?: { body?: Buffer; auth?: string; trusted?: boolean },
  ) {
    const env: Record<string, string> = {};

    if (options?.trusted ?? true) {
      env.GITHUB_ACTIONS = 'true';
      env.GITHUB_EVENT_NAME = 'push';
    }

    const previousEnv = {
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
      GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME,
    };

    Object.assign(process.env, env);

    if (!('GITHUB_ACTIONS' in env)) {
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITHUB_EVENT_NAME;
    }

    return fetch(`${baseUrl}/v1/cache/${hash}`, {
      method,
      headers: {
        authorization: options?.auth ?? `Bearer ${TOKEN}`,
      },
      body: options?.body,
    }).finally(() => {
      if (previousEnv.GITHUB_ACTIONS === undefined) {
        delete process.env.GITHUB_ACTIONS;
      } else {
        process.env.GITHUB_ACTIONS = previousEnv.GITHUB_ACTIONS;
      }

      if (previousEnv.GITHUB_EVENT_NAME === undefined) {
        delete process.env.GITHUB_EVENT_NAME;
      } else {
        process.env.GITHUB_EVENT_NAME = previousEnv.GITHUB_EVENT_NAME;
      }
    });
  }

  it('round-trips GET 404 -> PUT 200 -> GET 200 -> PUT 409 (duplicate) -> PUT 403 (untrusted)', async () => {
    const missResponse = await request('GET', HASH);

    expect(missResponse.status).toBe(404);

    const putResponse = await request('PUT', HASH, {
      body: Buffer.from('payload'),
    });

    expect(putResponse.status).toBe(200);

    const hitResponse = await request('GET', HASH);

    expect(hitResponse.status).toBe(200);
    expect(await hitResponse.text()).toBe('payload');

    const duplicateResponse = await request('PUT', HASH, {
      body: Buffer.from('payload'),
    });

    expect(duplicateResponse.status).toBe(409);

    const untrustedResponse = await request('PUT', 'deadbeef', {
      body: Buffer.from('x'),
      trusted: false,
    });

    expect(untrustedResponse.status).toBe(403);
  });

  it('rejects a missing or invalid bearer token with 401', async () => {
    const response = await request('GET', HASH, { auth: 'Bearer wrong-token' });

    expect(response.status).toBe(401);
  });

  it('rejects a hash that is not lowercase hex with 400', async () => {
    const response = await fetch(`${baseUrl}/v1/cache/not-hex!`, {
      method: 'GET',
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.status).toBe(400);
  });
});
