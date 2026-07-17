#!/usr/bin/env node
// Spike 001a: GHCR/OCI reader round-trip via the OCI distribution HTTP API.
//
// Proves (or disproves) that GHCR can serve as the reader/cross-context store for
// an Nx remote cache: publish a cache tarball keyed by an Nx hash as an OCI
// artifact, then pull it back BY DIGEST (C6: pull-by-digest mandatory iff GHCR),
// authenticated, byte-identical. No docker daemon: raw registry API + the gh token.
//
// Usage: GH_TOKEN=$(gh auth token) node ghcr-oci-roundtrip.mjs <user> <package> <nonce>
import { createHash, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const USER = (process.argv[2] || 'layzeedk').toLowerCase();
const PKG = (process.argv[3] || 'found01-oci').toLowerCase();
const NONCE = process.argv[4] || 'n0';
const NAME = `${USER}/${PKG}`; // GHCR registry repository path
const REG = 'https://ghcr.io';
const GH_TOKEN = process.env.GH_TOKEN;

if (!GH_TOKEN) {
  console.error('GH_TOKEN required (export GH_TOKEN=$(gh auth token))');
  process.exit(1);
}

const CONFIG_TYPE = 'application/vnd.oci.image.config.v1+json';
const LAYER_TYPE = 'application/vnd.oci.image.layer.v1.tar+gzip';
const MANIFEST_TYPE = 'application/vnd.oci.image.manifest.v1+json';

const sha256 = (buf) => 'sha256:' + createHash('sha256').update(buf).digest('hex');
const ms = () => Number(process.hrtime.bigint() / 1000000n);

async function registryToken(scope) {
  const basic = Buffer.from(`${USER}:${GH_TOKEN}`).toString('base64');
  const url = `${REG}/token?scope=${encodeURIComponent(scope)}&service=ghcr.io`;
  const res = await fetch(url, { headers: { authorization: `Basic ${basic}` } });

  if (!res.ok) {
    throw new Error(`token exchange ${res.status}: ${await res.text()}`);
  }

  return (await res.json()).token;
}

async function blobExists(bearer, digest) {
  const res = await fetch(`${REG}/v2/${NAME}/blobs/${digest}`, {
    method: 'HEAD',
    headers: { authorization: `Bearer ${bearer}` },
  });

  return res.status === 200;
}

async function pushBlob(bearer, buf, mediaType) {
  const digest = sha256(buf);

  if (await blobExists(bearer, digest)) {
    return { digest, size: buf.length, reused: true };
  }

  // Two-step monolithic upload: open a session, then PUT the whole blob.
  const open = await fetch(`${REG}/v2/${NAME}/blobs/uploads/`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bearer}` },
  });

  if (open.status !== 202) {
    throw new Error(`blob upload open ${open.status}: ${await open.text()}`);
  }

  let loc = open.headers.get('location');

  if (!loc) {
    throw new Error('no Location header on upload session');
  }

  if (loc.startsWith('/')) {
    loc = REG + loc;
  }

  const sep = loc.includes('?') ? '&' : '?';
  const put = await fetch(`${loc}${sep}digest=${encodeURIComponent(digest)}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/octet-stream',
      'content-length': String(buf.length),
    },
    body: buf,
  });

  if (put.status !== 201) {
    throw new Error(`blob PUT ${put.status}: ${await put.text()}`);
  }

  return { digest, size: buf.length, reused: false, mediaType };
}

async function putManifest(bearer, manifest, reference) {
  const body = Buffer.from(JSON.stringify(manifest));
  const res = await fetch(`${REG}/v2/${NAME}/manifests/${reference}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${bearer}`,
      'content-type': MANIFEST_TYPE,
    },
    body,
  });

  if (res.status !== 201) {
    throw new Error(`manifest PUT ${res.status}: ${await res.text()}`);
  }

  return res.headers.get('docker-content-digest') || sha256(body);
}

async function getManifestByDigest(bearer, digest) {
  const res = await fetch(`${REG}/v2/${NAME}/manifests/${digest}`, {
    headers: {
      authorization: `Bearer ${bearer}`,
      accept: `${MANIFEST_TYPE}, application/vnd.oci.image.index.v1+json`,
    },
  });

  if (!res.ok) {
    throw new Error(`manifest GET ${res.status}: ${await res.text()}`);
  }

  return { manifest: await res.json(), contentDigest: res.headers.get('docker-content-digest') };
}

async function getBlob(bearer, digest) {
  const res = await fetch(`${REG}/v2/${NAME}/blobs/${digest}`, {
    headers: { authorization: `Bearer ${bearer}` },
  });

  if (!res.ok) {
    throw new Error(`blob GET ${res.status}: ${await res.text()}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  // A realistic Nx cache artifact: a gzipped tarball-ish payload. We only need
  // opaque content-addressed bytes for the round-trip, so gzip a random buffer.
  const raw = randomBytes(256 * 1024); // 256 KiB, representative small cache entry
  const tarball = gzipSync(raw);
  // Nx hash is lowercase hex; derive a deterministic 64-hex tag from content+nonce
  // (tag == hash, C6). Real Nx hashes are opaque; shape parity is what matters.
  const nxHash = createHash('sha256').update(tarball).update(NONCE).digest('hex');

  const result = { pkg: NAME, tag: nxHash, bytes: tarball.length, steps: {}, timings_ms: {} };

  // --- PUSH ---
  const pushBearer = await registryToken(`repository:${NAME}:pull,push`);
  let t = ms();
  const layer = await pushBlob(pushBearer, tarball, LAYER_TYPE);
  result.timings_ms.push_layer = ms() - t;

  const configBuf = Buffer.from('{}');
  t = ms();
  const config = await pushBlob(pushBearer, configBuf, CONFIG_TYPE);
  result.timings_ms.push_config = ms() - t;

  const manifest = {
    schemaVersion: 2,
    mediaType: MANIFEST_TYPE,
    config: { mediaType: CONFIG_TYPE, digest: config.digest, size: config.size },
    layers: [{ mediaType: LAYER_TYPE, digest: layer.digest, size: layer.size }],
  };
  t = ms();
  const manifestDigest = await putManifest(pushBearer, manifest, nxHash);
  result.timings_ms.put_manifest = ms() - t;
  result.manifest_digest = manifestDigest;
  result.timings_ms.push_total =
    result.timings_ms.push_layer + result.timings_ms.push_config + result.timings_ms.put_manifest;

  // --- PULL BY DIGEST (C6) --- fresh token, mimic a cold reader
  const pullBearer = await registryToken(`repository:${NAME}:pull`);
  const pullSamples = [];

  for (let i = 0; i < 3; i++) {
    t = ms();
    const { manifest: m, contentDigest } = await getManifestByDigest(pullBearer, manifestDigest);
    const blob = await getBlob(pullBearer, m.layers[0].digest);
    const dt = ms() - t;
    pullSamples.push(dt);
    result.steps[`pull_${i}_digest_matches`] = contentDigest === manifestDigest;
    result.steps[`pull_${i}_bytes_identical`] = Buffer.compare(blob, tarball) === 0;
    result.steps[`pull_${i}_layer_digest_verified`] = sha256(blob) === layer.digest;
  }

  result.timings_ms.pull_by_digest_samples = pullSamples;
  result.timings_ms.pull_by_digest_median = pullSamples.sort((a, b) => a - b)[1];

  // --- ANON PULL (private package must 401 without creds) ---
  const anon = await fetch(`${REG}/v2/${NAME}/manifests/${manifestDigest}`, {
    headers: { accept: MANIFEST_TYPE },
  });
  result.steps.anon_pull_status = anon.status;
  result.steps.anon_pull_blocked = anon.status === 401 || anon.status === 403;

  // --- PULL BY TAG too (proves tag==hash lookup works) ---
  t = ms();
  const byTag = await getManifestByDigest(pullBearer, nxHash);
  result.timings_ms.pull_by_tag = ms() - t;
  result.steps.tag_resolves_to_same_manifest = byTag.contentDigest === manifestDigest;

  const ok =
    result.steps.pull_0_bytes_identical &&
    result.steps.pull_0_layer_digest_verified &&
    result.steps.pull_0_digest_matches &&
    result.steps.tag_resolves_to_same_manifest;

  result.verdict = ok ? 'ROUND_TRIP_OK' : 'FAILED';
  console.log(JSON.stringify(result, null, 2));

  if (!ok) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error('SPIKE FAILED:', e.message);
  process.exit(1);
});
