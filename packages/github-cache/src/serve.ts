import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { createWritableMemoryBackend } from './backend/memory-backend.js';
import { createCacheServer, generateToken } from './server/server.js';

export interface ServeOptions {
  /** Loopback port to bind; invalid/omitted values resolve to an OS-assigned port. */
  readonly port?: number | string;
  /** Bearer token clients must present; a blank/omitted value mints a fresh CSPRNG one. */
  readonly token?: string;
}

export interface RunningServer {
  readonly server: Server;
  readonly url: string;
  readonly token: string;
  readonly port: number;
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
 * token, wire the writable in-process backend into the Nx-contract server
 * (D-01/D-03), and bind `127.0.0.1` only (SRV-01). Returns the listening server
 * plus its resolved url/port/token so a caller (or test) can drive it.
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
  const server = createCacheServer(createWritableMemoryBackend(), token);

  await new Promise<void>((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    token,
    port: address.port,
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
