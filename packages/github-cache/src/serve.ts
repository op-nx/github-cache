#!/usr/bin/env node
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  isWritableBackend,
  type PutResult,
  type ReadableBackend,
  type WritableBackend,
} from './backend/types.js';
import type { Hash } from './lib/cache-key.js';
import { isEntrypoint } from './lib/is-entrypoint.js';
import { selectBackend } from './lib/select-backend.js';
import { createCacheServer, generateToken } from './server/server.js';

/** Production grace (ms) for the bounded SIGTERM drain (ROBUST-04). */
const DEFAULT_SHUTDOWN_GRACE_MS = 4000;

export interface ServeOptions {
  /** Loopback port to bind; invalid/omitted values resolve to an OS-assigned port. */
  readonly port?: number | string;
  /** Bearer token clients must present; a blank/omitted value mints a fresh CSPRNG one. */
  readonly token?: string;
  /**
   * Bounded grace (ms) the SIGTERM drain waits for in-flight puts before the
   * server exits (ROBUST-04). This knob controls ONLY teardown timing -- it is
   * NOT a mode switch and cannot influence RW-vs-RO selection (TRUST-05).
   * Defaults to the production grace.
   */
  readonly shutdownGraceMs?: number;
}

export interface RunningServer {
  readonly server: Server;
  readonly url: string;
  readonly token: string;
  readonly port: number;
  /**
   * Stop accepting new connections, await in-flight puts up to the bounded grace,
   * then remove the SIGTERM listener this serve() registered (ROBUST-04). It is
   * the deterministic drain seam: the ROBUST-04 spec triggers it directly without
   * a real signal, while the SIGTERM handler calls it and then exits the process.
   */
  readonly shutdown: () => Promise<void>;
}

/**
 * Resolve a listen port, falling back to `0` (OS-assigned ephemeral) on
 * NaN/negative/out-of-range input so `listen()` never throws
 * `ERR_SOCKET_BAD_PORT` synchronously (Pitfall 7).
 */
function resolvePort(value: number | string | undefined): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    return 0;
  }

  return port;
}

/**
 * SC4 composition root: resolve the port, mint (or inherit) a CSPRNG bearer
 * token, select the backend from runtime context (D-01/TRUST-05), wrap its write
 * path with in-flight tracking, wire it into the Nx-contract server, bind
 * `127.0.0.1` only (SRV-01), and drain in-flight writes on SIGTERM within a
 * bounded grace (ROBUST-04).
 *
 * The token env fallback uses `||` (not `??`) so a set-but-empty value falls
 * through to a fresh generated token rather than binding an empty secret
 * (Pitfall 8).
 */
export async function serve(
  options: ServeOptions = {},
): Promise<RunningServer> {
  const port = resolvePort(options.port ?? process.env.PORT);
  const token =
    options.token ||
    process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN ||
    generateToken();
  const graceMs = options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS;

  // The composition point where the SIGTERM in-flight drain (ROBUST-04) attaches --
  // and ONLY that. The per-hash lock is deliberately NOT here: it lives in
  // actions-cache-backend.ts, next to the shared deterministic archive path it
  // guards, where it also covers `get`. Re-adding it here would nest the same-hash
  // lock and self-deadlock. Keeping the decorator here is why server.ts needs no
  // change: the server still receives a plain CacheBackend. get delegates straight
  // through; put records its promise so the drain can await it.
  const inFlightPuts = new Set<Promise<unknown>>();
  const backend = selectBackend(process.env);
  // A writable backend gets its put wrapped in drain tracking; a read-only backend
  // (ReadableBackend, no put) is passed through unchanged -- there is no write path
  // to drain, and the server answers a PUT to it with the contract's 403. Spread is
  // safe: backend factories return closures over captured state, not this-bound
  // methods.
  let tracked: ReadableBackend | WritableBackend;

  if (isWritableBackend(backend)) {
    const writable = backend;
    tracked = {
      ...writable,
      put: (hash: Hash, bytes: Buffer): Promise<PutResult> => {
        const op = writable.put(hash, bytes);
        inFlightPuts.add(op);
        // Remove on settle in a way that cannot itself reject; return the ORIGINAL
        // promise so the caller still observes the true PutResult (or rejection).
        void op.then(
          () => inFlightPuts.delete(op),
          () => inFlightPuts.delete(op),
        );

        return op;
      },
    };
  } else {
    tracked = backend;
  }

  const server = createCacheServer(tracked, token);

  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve());
  });

  async function shutdown(): Promise<void> {
    // The executor body runs synchronously, so server.close() still lands before
    // shutdown's first await (serve.spec asserts `listening` is false the instant
    // the SIGTERM handler fires). closeIdleConnections() releases sockets parked on
    // keep-alive -- the Nx client holds one by default -- which is what lets the
    // close callback actually fire. NOT closeAllConnections(): that would kill an
    // in-flight PUT and defeat the drain below.
    const closed = new Promise<void>((resolve) => {
      if (!server.listening) {
        resolve();

        return;
      }

      server.close(() => resolve());
      server.closeIdleConnections();
    });

    // Bounded drain: await in-flight puts AND the close, but only up to graceMs,
    // backed by an unref'd timer. The runner sends SIGTERM and then SIGKILL after a
    // short grace, so an UNBOUNDED await would deadlock the implicit wait before job
    // cleanup -- a hung write must yield to the kill rather than block teardown.
    // The close is folded INTO the raced side for exactly that reason: awaiting it
    // unconditionally is the deadlock this comment warns about.
    const drained = Promise.allSettled([...inFlightPuts]).then(() => {
      // A socket carrying an in-flight PUT was ACTIVE, not idle, when the first
      // closeIdleConnections() ran, so it survived. Now that its write has settled
      // and its response is on the way out it can go, and the close can complete
      // without burning the whole grace.
      server.closeIdleConnections();
    });
    const bounded = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, graceMs);
      timer.unref();
    });

    await Promise.race([Promise.all([drained, closed]), bounded]);

    process.removeListener('SIGTERM', onSigterm);
  }

  function onSigterm(): void {
    void shutdown().then(() => process.exit(0));
  }

  // One listener per serve(), removed symmetrically in shutdown() (asserted by
  // serve.spec). The documented production deployment is ONE server per process (the
  // sidecar / dogfood bins), so these never accumulate; multiple concurrent
  // serve() instances in a single long-lived process would each add a listener until
  // their own shutdown() -- a test-only shape, not a production one.
  process.once('SIGTERM', onSigterm);

  const address = server.address() as AddressInfo;

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    token,
    port: address.port,
    shutdown,
  };
}

async function main(): Promise<void> {
  const running = await serve();

  process.stdout.write(`github-cache serve listening on ${running.url}\n`);
  process.stdout.write(`bearer token: ${running.token}\n`);
}

// Direct-invocation guard: run main() only when this module is the process
// entrypoint (see isEntrypoint -- the one home for the Windows Pitfall-6 idiom).
if (isEntrypoint(import.meta.url)) {
  void main();
}
