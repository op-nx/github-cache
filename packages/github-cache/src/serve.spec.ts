import { rm } from 'node:fs/promises';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import * as cache from '@actions/cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActionsCacheBackend } from './backend/actions-cache-backend.js';
import { createWritableMemoryBackend } from './backend/memory-backend.js';
import type { CacheBackend, PutResult } from './backend/types.js';
import { cacheArchivePath } from './lib/cache-archive-path.js';
import type { Hash } from './lib/cache-key.js';
import { selectBackend } from './lib/select-backend.js';
import { type RunningServer, serve } from './serve.js';

// serve() derives its backend from selectBackend(process.env). The selection
// logic itself is unit-tested in select-backend.spec.ts; here we mock the module
// so each test drives serve with a controlled backend (a writable memory backend
// for the round-trip, a deferred-gated fake for the drain/concurrency proofs)
// without depending on ambient CI env. createWritableMemoryBackend stays exported
// from memory-backend.ts precisely so specs like this can feed it back in.
vi.mock('./lib/select-backend.js');

// The no-self-deadlock proof below drives the REAL Actions-cache backend (the one
// that now owns the per-hash lock) through serve(), so @actions/cache must be
// mocked here too -- it only works inside a JS action on real CI.
vi.mock('@actions/cache');

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

  it('closes an idle keep-alive connection and awaits the close before resolving (ROBUST-04)', async () => {
    // The Nx client holds a keep-alive socket by default. shutdown() called
    // server.close() and then never awaited it, so it resolved off the (empty)
    // drain while the listening socket was still tearing down -- reporting a
    // teardown that had not happened. closeIdleConnections() is the belt-and-braces
    // half (on the node24 runtime both actions declare, server.close() already
    // releases idle sockets); awaiting the close is the load-bearing half.
    running = await serve();

    const agent = new http.Agent({ keepAlive: true });
    const url = new URL(`${running.url}/v1/cache/abc123`);

    await new Promise<void>((resolve, reject) => {
      const request = http.request(
        url,
        { agent, headers: auth(running!.token) },
        (res) => {
          res.resume();
          res.on('end', () => resolve());
        },
      );
      request.on('error', reject);
      request.end();
    });

    const connections = () =>
      new Promise<number>((resolve) =>
        running!.server.getConnections((_error, count) => resolve(count)),
      );

    // Non-vacuous: the socket really is parked on the server before shutdown.
    expect(await connections()).toBe(1);

    let closeCompleted = false;
    running.server.on('close', () => {
      closeCompleted = true;
    });

    await running.shutdown();

    // The assertion that reddens: without the close folded into shutdown's race,
    // shutdown resolves on the drain microtask and the 'close' event has not fired
    // yet, so this reads false.
    expect(closeCompleted).toBe(true);
    expect(await connections()).toBe(0);
    expect(running.server.listening).toBe(false);

    agent.destroy();
  }, 8000);

  it('registers exactly one SIGTERM listener on serve() and removes it on shutdown() (ROBUST-04)', async () => {
    const before = process.listeners('SIGTERM').length;

    running = await serve();
    expect(running.shutdown).toBeTypeOf('function');

    expect(process.listeners('SIGTERM').length).toBe(before + 1);

    await running.shutdown();

    expect(process.listeners('SIGTERM').length).toBe(before);
  });

  it('a real SIGTERM event drains the in-flight put before process.exit is called (ROBUST-04)', async () => {
    // Non-vacuous: every OTHER case in this block calls shutdown() directly,
    // bypassing the actual process.once('SIGTERM', onSigterm) registration that
    // production relies on. A regression where onSigterm called process.exit(0)
    // without first awaiting shutdown() (e.g. `shutdown(); process.exit(0);`
    // instead of `shutdown().then(() => process.exit(0))`) would still pass every
    // test above -- they never invoke the registered listener at all. This test
    // fires the REAL 'SIGTERM' event through process.emit (safe here because
    // process.exit is stubbed) and proves exit is deferred until the drain
    // actually completes.
    //
    // A hash distinct from every other test in this file. serve() no longer
    // applies the per-hash lock (it moved into actions-cache-backend.ts), so these
    // fakes are not queued -- but the prior "never settles" case above leaves an
    // abandoned in-flight promise on 'abcdef', and keeping the hashes distinct
    // keeps each case's drain assertion about its own write only.
    const fake = gatedPutBackend();
    vi.mocked(selectBackend).mockReturnValue(fake.backend);

    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    try {
      running = await serve();

      const url = `${running.url}/v1/cache/deadbeef01`;
      const body = Buffer.from('real-sigterm-drain');
      const putResponse = fetch(url, {
        method: 'PUT',
        headers: auth(running.token),
        body,
      });

      await fake.started; // the put has reached the backend and is in flight

      process.emit('SIGTERM');

      // server.close() runs synchronously inside shutdown(), before its first
      // await -- but the drain itself is still pending on the ungated fake.
      expect(running.server.listening).toBe(false);
      expect(exitSpy).not.toHaveBeenCalled();

      fake.releasePut('stored');
      await putResponse;

      // Flush the microtask queue so shutdown()'s awaited race settles and its
      // `.then(() => process.exit(0))` continuation runs.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(fake.recorded()).toEqual(body);
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      exitSpy.mockRestore();
    }
  });
});

describe('serve write path is NOT double-locked (TEST-02 wiring)', () => {
  // The per-hash serialization proofs live in actions-cache-backend.spec.ts now:
  // the lock moved into the module that owns the shared deterministic archive
  // path, and covers `get` there too. What serve() still owns is drain tracking
  // (asserted above) and the negative property below.

  it('does not itself serialize same-hash puts -- a fake writable backend sees both concurrently (TEST-02)', async () => {
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
    const second = putSameHash();

    // If serve() still wrapped put in withHashLock, whenStarted(2) would never
    // resolve and this test would time out -- so reaching this line IS the proof
    // that the composition root no longer holds the lock. The memory backend has
    // no shared temp path, so there is nothing here to protect.
    await tracker.whenStarted(2);

    tracker.gates[0]('stored');
    tracker.gates[1]('stored');
    await Promise.all([first, second]);
  }, 4000);

  it('completes a same-hash PUT through the real Actions-cache backend -- no self-deadlock from a doubled lock (TEST-02)', async () => {
    const HASH = 'facade01' as Hash;
    vi.mocked(cache.saveCache).mockResolvedValue(42);
    vi.mocked(selectBackend).mockReturnValue(createActionsCacheBackend());

    running = await serve();

    const put = () =>
      fetch(`${running!.url}/v1/cache/${HASH}`, {
        method: 'PUT',
        headers: auth(running!.token),
        body: Buffer.from('tar-bytes'),
      });

    // Both same-hash writes go through serve()'s drain tracking AND the backend's
    // per-hash lock. If serve() re-applied the lock, the inner call would wait on
    // the outer call's tail -- which cannot settle until the inner one resolves --
    // and neither response would ever arrive.
    const [first, second] = await Promise.all([put(), put()]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    await rm(cacheArchivePath(HASH), { force: true });
  }, 4000);
});
