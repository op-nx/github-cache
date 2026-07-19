import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWritableMemoryBackend } from './backend/memory-backend.js';
import type { CacheBackend, PutResult } from './backend/types.js';
import { selectBackend } from './lib/select-backend.js';
import { type RunningServer, serve } from './serve.js';

// serve() derives its backend from selectBackend(process.env). The selection
// logic itself is unit-tested in select-backend.spec.ts; here we mock the module
// so each test drives serve with a controlled backend (a writable memory backend
// for the round-trip, a deferred-gated fake for the drain/concurrency proofs)
// without depending on ambient CI env. createWritableMemoryBackend stays exported
// from memory-backend.ts precisely so specs like this can feed it back in.
vi.mock('./lib/select-backend.js');

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

// A deferred lets a test drive settle order deterministically -- no timers.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

// A CacheBackend whose single put is gated by a caller-held deferred, so the
// drain is driven deterministically without a real OS signal. get always misses.
function gatedPutBackend() {
  const started = deferred<void>();
  const gate = deferred<PutResult>();
  let recorded: Buffer | undefined;

  const backend: CacheBackend = {
    get: async () => ({ kind: 'miss' }),
    put: async (_hash, bytes) => {
      recorded = bytes;
      started.resolve();

      return gate.promise;
    },
  };

  return {
    backend,
    started: started.promise,
    releasePut: (result: PutResult) => gate.resolve(result),
    recorded: () => recorded,
  };
}

// A CacheBackend that gates every put on a per-call deferred and logs entry
// order, so we can prove same-hash puts are serialized and different-hash puts
// overlap -- purely by promise signaling, no timers.
function orderTrackingBackend() {
  const order: string[] = [];
  const gates: Array<(result: PutResult) => void> = [];
  const startWaiters = new Map<number, () => void>();
  let startedCount = 0;

  function whenStarted(n: number): Promise<void> {
    if (startedCount >= n) {
      return Promise.resolve();
    }

    const gateReached = deferred<void>();
    startWaiters.set(n, gateReached.resolve);

    return gateReached.promise;
  }

  const backend: CacheBackend = {
    get: async () => ({ kind: 'miss' }),
    put: async (hash, _bytes) => {
      const gate = deferred<PutResult>();
      gates.push(gate.resolve);
      startedCount += 1;
      order.push(`start:${hash}`);
      startWaiters.get(startedCount)?.();

      return gate.promise;
    },
  };

  return { backend, order, gates, whenStarted };
}

let running: RunningServer | undefined;

beforeEach(() => {
  // Default: a fresh writable in-memory backend, so the Phase 1 round-trip and
  // bind/token/port assertions still hold. Drain/concurrency tests override this
  // with a gated fake before calling serve().
  vi.mocked(selectBackend).mockReturnValue(createWritableMemoryBackend());
});

// IN-08: guarded teardown. shutdown() both closes the server and removes the
// SIGTERM listener serve() registered, so listeners do not accumulate across the
// many serve() calls in this file. closeAllConnections() releases any socket
// still parked on a gated put (the hung-drain case) so the suite never lingers.
afterEach(async () => {
  if (running) {
    await running.shutdown?.();
    running.server.closeAllConnections();

    if (running.server.listening) {
      await new Promise<void>((resolve) =>
        running!.server.close(() => resolve()),
      );
    }

    running = undefined;
  }

  vi.resetAllMocks();
});

describe('serve (SC4 composition root)', () => {
  // SRV-01, non-vacuous: ServeOptions exposes no `host` field, so the bind
  // address below is 100% determined by serve.ts's own internal choice -- the
  // test cannot supply or influence it. This closes the false-confidence gap
  // left by server.spec.ts's SRV-01 test, which hardcodes '127.0.0.1' in its
  // own local listen() helper and then asserts that same test-chosen value
  // (a tautology; see 01-REVIEW.md WR-01). If serve.ts ever bound a routable
  // interface (e.g. '0.0.0.0') instead of loopback, this assertion fails.
  it('binds the loopback interface only, never a routable interface (SRV-01, production bind)', async () => {
    running = await serve();

    const address = running.server.address() as AddressInfo;

    expect(address.address).toBe('127.0.0.1');
    expect(address.address).not.toBe('0.0.0.0');
    expect(address.address).not.toBe('::');
  });

  it('binds 127.0.0.1 and answers a scripted authenticated PUT then GET round-trip', async () => {
    running = await serve();

    expect((running.server.address() as AddressInfo).address).toBe('127.0.0.1');

    const url = `${running.url}/v1/cache/abc123`;
    const body = Buffer.from('tar-bytes');

    const put = await fetch(url, {
      method: 'PUT',
      headers: auth(running.token),
      body,
    });

    expect(put.status).toBe(200);

    const get = await fetch(url, { headers: auth(running.token) });

    expect(get.status).toBe(200);
    expect(get.headers.get('content-length')).toBe(String(body.length));
    expect(Buffer.from(await get.arrayBuffer())).toEqual(body);
  });

  it('mints a CSPRNG bearer token whose absence yields 401 (unauthenticated round-trip is rejected)', async () => {
    running = await serve();

    expect(running.token).toMatch(/^[a-f0-9]{64}$/);

    const res = await fetch(`${running.url}/v1/cache/abc123`);

    expect(res.status).toBe(401);
  });

  it('falls back to an OS-assigned port on an out-of-range port value, never throwing ERR_SOCKET_BAD_PORT', async () => {
    running = await serve({ port: 999999 });

    expect(running.port).toBeGreaterThan(0);
    expect((running.server.address() as AddressInfo).address).toBe('127.0.0.1');
  });
});

describe('serve SIGTERM drain (ROBUST-04)', () => {
  it('shutdown() drains an in-flight put -- its bytes reach the backend -- before it resolves (ROBUST-04)', async () => {
    const fake = gatedPutBackend();
    vi.mocked(selectBackend).mockReturnValue(fake.backend);

    running = await serve();
    expect(running.shutdown).toBeTypeOf('function');

    const url = `${running.url}/v1/cache/abcdef`;
    const body = Buffer.from('drain-me');
    const putResponse = fetch(url, {
      method: 'PUT',
      headers: auth(running.token),
      body,
    });

    await fake.started; // the put has reached the backend and is in flight

    const shutdownPromise = running.shutdown();
    fake.releasePut('stored'); // let the gated put settle

    await shutdownPromise;

    expect(fake.recorded()).toEqual(body);
    expect(running.server.listening).toBe(false); // stopped accepting connections
    expect((await putResponse).status).toBe(200);
  });

  it('shutdown() resolves within the bounded grace even if a put never settles (ROBUST-04)', async () => {
    const fake = gatedPutBackend();
    vi.mocked(selectBackend).mockReturnValue(fake.backend);

    running = await serve({ shutdownGraceMs: 50 });
    expect(running.shutdown).toBeTypeOf('function');

    const url = `${running.url}/v1/cache/abcdef`;
    const hung = fetch(url, {
      method: 'PUT',
      headers: auth(running.token),
      body: Buffer.from('never-settles'),
    }).catch(() => undefined);

    await fake.started;

    // The gate is intentionally never released; shutdown must still resolve,
    // yielding to the runner's SIGKILL rather than deadlocking wait-all.
    await running.shutdown();

    running.server.closeAllConnections();
    await hung;
  });

  it('registers exactly one SIGTERM listener on serve() and removes it on shutdown() (ROBUST-04)', async () => {
    const before = process.listeners('SIGTERM').length;

    running = await serve();
    expect(running.shutdown).toBeTypeOf('function');

    expect(process.listeners('SIGTERM').length).toBe(before + 1);

    await running.shutdown();

    expect(process.listeners('SIGTERM').length).toBe(before);
  });
});

describe('serve write path is locked per hash (TEST-02 wiring)', () => {
  it('serializes two concurrent PUTs of the same hash through the per-hash lock (TEST-02)', async () => {
    const tracker = orderTrackingBackend();
    vi.mocked(selectBackend).mockReturnValue(tracker.backend);

    running = await serve();

    const putSameHash = () =>
      fetch(`${running!.url}/v1/cache/aaaaaa`, {
        method: 'PUT',
        headers: auth(running!.token),
        body: Buffer.from('x'),
      });

    const first = putSameHash();

    await tracker.whenStarted(1);

    const second = putSameHash();

    tracker.order.push('release:1');
    tracker.gates[0]('stored');

    await tracker.whenStarted(2);

    tracker.gates[1]('stored');
    await Promise.all([first, second]);

    // Non-vacuous: put #2 entered the backend only AFTER put #1 was released.
    // If the composition did not wrap put in withHashLock, put #2 would enter
    // before 'release:1' -- so this exact order is the wiring proof.
    expect(tracker.order).toEqual([
      'start:aaaaaa',
      'release:1',
      'start:aaaaaa',
    ]);
  }, 4000);

  it('runs concurrent PUTs of different hashes in parallel (TEST-02)', async () => {
    const tracker = orderTrackingBackend();
    vi.mocked(selectBackend).mockReturnValue(tracker.backend);

    running = await serve();

    const put = (hash: string) =>
      fetch(`${running!.url}/v1/cache/${hash}`, {
        method: 'PUT',
        headers: auth(running!.token),
        body: Buffer.from('x'),
      });

    const putA = put('aaaaaa');
    const putB = put('bbbbbb');

    // BOTH puts reach the backend before EITHER gate is released -- different
    // hashes are not serialized. If they were, whenStarted(2) would never
    // resolve and this test would time out.
    await tracker.whenStarted(2);

    expect(
      tracker.order.filter((entry) => entry.startsWith('start:')),
    ).toHaveLength(2);

    tracker.gates[0]('stored');
    tracker.gates[1]('stored');
    await Promise.all([putA, putB]);
  }, 4000);
});
