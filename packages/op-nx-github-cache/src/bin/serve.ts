#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { selectBackend } from '../lib/backends/index.js';
import { createServer } from '../lib/server.js';

// PORT follows the same set-but-invalid -> fall back to default contract as
// the other numeric knobs (resolveMaxBodyBytes/resolveMaxAgeDays): a
// non-integer or out-of-range value falls back to 0 -- an ephemeral free
// port, the documented default -- rather than crashing server.listen() with
// ERR_SOCKET_BAD_PORT. `Number(undefined)`/`Number('')` need distinct
// handling: unset is the normal path and must not warn, so only a set,
// non-empty, invalid value is surfaced.
export function resolvePort(envValue: string | undefined): number {
  const configured = Number(envValue);

  if (Number.isInteger(configured) && configured >= 0 && configured <= 65535) {
    return configured;
  }

  if (envValue !== undefined) {
    console.warn(
      `PORT="${envValue}" is not an integer in [0, 65535]; using an ephemeral port.`,
    );
  }

  return 0;
}

async function main(): Promise<void> {
  const port = resolvePort(process.env.PORT);
  // CSPRNG local-only shared secret: this sidecar never receives traffic
  // beyond loopback, so there's no benefit to a GitHub-issued token here.
  const token = randomBytes(32).toString('hex');
  const backend = selectBackend(process.env);
  const server = createServer({ backend, token });

  await new Promise<void>((resolve, reject) => {
    // A bind failure (EADDRINUSE, EACCES) fires 'error' on the server; without
    // a listener it becomes an uncaught exception and this promise never
    // settles. Route it to main().catch instead, then drop the listener once
    // bound so a later runtime error keeps its default (crash) behavior.
    const onError = (error: Error): void => reject(error);

    server.once('error', onError);

    // Loopback only (never 0.0.0.0/all-interfaces) -- this is a write-capable
    // CI sidecar and must not be reachable from co-tenant processes sharing
    // the runner's network namespace.
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve();
    });
  });

  const address = server.address();
  const boundPort =
    typeof address === 'object' && address !== null ? address.port : port;
  const url = `http://127.0.0.1:${boundPort}`;

  if (process.env.GITHUB_ACTIONS === 'true') {
    // Public-repo Actions logs are world-readable: mask the secret before it
    // can ever be echoed, and hand it to later steps only via $GITHUB_ENV,
    // never stdout.
    console.log(`::add-mask::${token}`);

    if (process.env.GITHUB_ENV) {
      try {
        await appendFile(
          process.env.GITHUB_ENV,
          `NX_SELF_HOSTED_REMOTE_CACHE_SERVER=${url}\nNX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}\n`,
        );
      } catch (error) {
        // The server is already listening, which keeps the event loop alive.
        // Without closing it here, main().catch's `process.exitCode = 1` never
        // takes effect -- the process hangs instead of exiting, and the CI
        // step that polls $GITHUB_ENV blocks until its own timeout. Close the
        // socket so the non-zero exit is reached.
        server.close();

        throw error;
      }
    }

    console.log(`@op-nx/github-cache listening on ${url}`);
  } else {
    // Local terminal: no public log to leak into.
    console.log(`export NX_SELF_HOSTED_REMOTE_CACHE_SERVER=${url}`);
    console.log(`export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}`);
  }
}

// Only run as a CLI entry point, not if ever imported by a test.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
