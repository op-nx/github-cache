import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createServer,
  DEFAULT_MAX_BODY_BYTES,
  resolveMaxBodyBytes,
} from './server.js';
import type { CacheBackend, PutResult } from './types.js';

describe('resolveMaxBodyBytes', () => {
  it('uses the configured value when it is a finite number', () => {
    expect(resolveMaxBodyBytes('1024')).toBe(1024);
  });

  it('falls back to the default instead of failing open on a non-numeric value', () => {
    expect(resolveMaxBodyBytes('not-a-number')).toBe(DEFAULT_MAX_BODY_BYTES);
  });

  it('falls back to the default when unset', () => {
    expect(resolveMaxBodyBytes(undefined)).toBe(DEFAULT_MAX_BODY_BYTES);
  });
});

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
    expect(hitResponse.headers.get('content-type')).toBe(
      'application/octet-stream',
    );
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

  it('rejects an unsupported method with 405 and an Allow header', async () => {
    const response = await fetch(`${baseUrl}/v1/cache/${HASH}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${TOKEN}` },
    });

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, PUT');
  });
});

describe('server PUT body size cap', () => {
  it('rejects a PUT body larger than MAX_CACHE_BODY_BYTES with 413', async () => {
    const previous = process.env.MAX_CACHE_BODY_BYTES;

    process.env.MAX_CACHE_BODY_BYTES = '10';
    vi.resetModules();

    const { createServer: createLimitedServer } = await import('./server.js');
    const backend = createInMemoryBackend();
    const server = createLimitedServer({ backend, token: TOKEN });

    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );

    const address = server.address() as AddressInfo;

    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_EVENT_NAME = 'push';

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/v1/cache/${HASH}`,
        {
          method: 'PUT',
          headers: {
            authorization: `Bearer ${TOKEN}`,
            'content-type': 'application/octet-stream',
          },
          body: Buffer.alloc(1024, 'x'),
        },
      );

      expect(response.status).toBe(413);
    } finally {
      delete process.env.GITHUB_ACTIONS;
      delete process.env.GITHUB_EVENT_NAME;
      await new Promise<void>((resolve) => server.close(() => resolve()));

      if (previous === undefined) {
        delete process.env.MAX_CACHE_BODY_BYTES;
      } else {
        process.env.MAX_CACHE_BODY_BYTES = previous;
      }

      vi.resetModules();
    }
  });
});
