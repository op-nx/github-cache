#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { selectBackend } from '../lib/backends/index.js';
import { createServer } from '../lib/server.js';

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 0);
  // CSPRNG local-only shared secret: this sidecar never receives traffic
  // beyond loopback, so there's no benefit to a GitHub-issued token here.
  const token = randomBytes(32).toString('hex');
  const backend = selectBackend(process.env);
  const server = createServer({ backend, token });

  await new Promise<void>((resolve) => {
    // Loopback only (never 0.0.0.0/all-interfaces) -- this is a write-capable
    // CI sidecar and must not be reachable from co-tenant processes sharing
    // the runner's network namespace.
    server.listen(port, '127.0.0.1', resolve);
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
      await appendFile(
        process.env.GITHUB_ENV,
        `NX_SELF_HOSTED_REMOTE_CACHE_SERVER=${url}\nNX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}\n`,
      );
    }

    console.log(`@op-nx/github-cache listening on ${url}`);
  } else {
    // Local terminal: no public log to leak into.
    console.log(`export NX_SELF_HOSTED_REMOTE_CACHE_SERVER=${url}`);
    console.log(`export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
