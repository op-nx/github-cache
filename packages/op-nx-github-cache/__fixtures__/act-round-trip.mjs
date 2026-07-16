#!/usr/bin/env node
// Test-only: driven by act-workflow.yml under `npm run test:act`. Spawns the
// real server (selecting the real @actions/cache backend, since GITHUB_ACTIONS
// is set by act), reads the URL/token act's emulated $GITHUB_ENV received, and
// exercises a GET/PUT round-trip -- expecting a 403 refusal instead when the
// injected event is pull_request_target (trust-gate check).
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

function assertStatus(response, expected, label) {
  if (response.status !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${response.status}`);
  }
}

async function main() {
  const server = spawn('node', ['dist/bin/serve.js'], {
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const envFileContent = await readFile(process.env.GITHUB_ENV, 'utf-8');
  const url = envFileContent
    .match(/NX_SELF_HOSTED_REMOTE_CACHE_SERVER=(.*)/)?.[1]
    ?.trim();
  const token = envFileContent
    .match(/NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=(.*)/)?.[1]
    ?.trim();

  if (!url || !token) {
    server.kill();
    throw new Error('Cache server did not report a URL/token via $GITHUB_ENV.');
  }

  try {
    const hash = `${Date.now().toString(16)}deadbeef`;
    const headers = { authorization: `Bearer ${token}` };

    const miss = await fetch(`${url}/v1/cache/${hash}`, { headers });

    assertStatus(miss, 404, 'GET before PUT');

    const put = await fetch(`${url}/v1/cache/${hash}`, {
      method: 'PUT',
      headers,
      body: Buffer.from('act-fixture-payload'),
    });

    if (process.env.GITHUB_EVENT_NAME === 'pull_request_target') {
      assertStatus(put, 403, 'PUT under an untrusted trigger');
      console.log('Trust gate correctly refused an untrusted write (403).');

      return;
    }

    assertStatus(put, 200, 'PUT under a trusted trigger');

    const hit = await fetch(`${url}/v1/cache/${hash}`, { headers });

    assertStatus(hit, 200, 'GET after PUT');
    console.log('Trusted round-trip succeeded (404 -> 200 -> 200).');
  } finally {
    server.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
