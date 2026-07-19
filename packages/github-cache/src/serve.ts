import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import type { CacheBackend } from './backend/types.js';
import { selectBackend } from './lib/select-backend.js';
import { withHashLock } from './lib/with-hash-lock.js';
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
 * path with the per-hash lock plus in-flight tracking, wire it into the
 * Nx-contract server, bind `127.0.0.1` only (SRV-01), and drain in-flight writes
 * on SIGTERM within a bounded grace (ROBUST-04).
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

  // The single composition point where BOTH the per-hash write lock (D-03/TEST-02)
  // and the SIGTERM in-flight drain (ROBUST-04) attach. Keeping the decorator here
  // is why server.ts needs no change: the server still receives a plain
  // CacheBackend. get delegates straight through; put runs under withHashLock and
  // records its promise so the drain can await it.
  const inFlightPuts = new Set<Promise<unknown>>();
  const backend = selectBackend(process.env);
  const tracked: CacheBackend = {
    get: (hash) => backend.get(hash),
    put: (hash, bytes) => {
      const op = withHashLock(hash, () => backend.put(hash, bytes));
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
  const server = createCacheServer(tracked, token);

  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve());
  });

  async function shutdown(): Promise<void> {
    if (server.listening) {
      server.close(); // stop accepting new connections
    }

    // Bounded drain: await in-flight puts but only up to graceMs, backed by an
    // unref'd timer. The runner sends SIGTERM and then SIGKILL after a short
    // grace, so an UNBOUNDED await would deadlock the implicit wait before job
    // cleanup -- a hung write must yield to the kill rather than block teardown.
    const drained = Promise.allSettled([...inFlightPuts]);
    const bounded = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, graceMs);
      timer.unref();
    });

    await Promise.race([drained, bounded]);

    process.removeListener('SIGTERM', onSigterm);
  }

  function onSigterm(): void {
    void shutdown().then(() => process.exit(0));
  }

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

// Direct-invocation guard: run main() only when this module is the entrypoint.
// Use pathToFileURL(process.argv[1]).href -- the naive 'file://' + argv[1] form
// is permanently false on Windows (Pitfall 6).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
