#!/usr/bin/env node
// Spike 001b: GitHub Releases reader round-trip (the current PoC's arm), via raw
// REST so it makes the SAME round-trips release-mirror-backend.ts does:
// getReleaseByTag -> listReleaseAssets -> getReleaseAsset(octet-stream).
// Head-to-head baseline against 001a (GHCR). Authenticated private read is the
// critical proof (FOUND-02); anon is measured in 002.
//
// Usage: GH_TOKEN=$(gh auth token) node releases-roundtrip.mjs <owner> <repo> <tag> <nonce>
import { createHash, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const OWNER = process.argv[2] || 'LayZeeDK';
const REPO = process.argv[3] || 'found01-spike';
const TAG = process.argv[4] || 'spike-found01';
const NONCE = process.argv[5] || 'n0';
const API = 'https://api.github.com';
const UPLOADS = 'https://uploads.github.com';
const GH_TOKEN = process.env.GH_TOKEN;

if (!GH_TOKEN) {
  console.error('GH_TOKEN required');
  process.exit(1);
}

const H = { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
const ms = () => Number(process.hrtime.bigint() / 1000000n);
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

async function getReleaseByTag() {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, { headers: H });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`getReleaseByTag ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function ensureRelease() {
  const existing = await getReleaseByTag();

  if (existing) {
    return existing;
  }

  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/releases`, {
    method: 'POST',
    headers: { ...H, 'content-type': 'application/json' },
    body: JSON.stringify({ tag_name: TAG, name: TAG, body: 'FOUND-01 spike shard' }),
  });

  if (!res.ok) {
    throw new Error(`create release ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

async function listAssets(releaseId) {
  // Paginate exactly as release-mirror-backend.ts does (per_page=100).
  const assets = [];
  let page = 1;

  for (;;) {
    const res = await fetch(`${API}/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?per_page=100&page=${page}`, { headers: H });

    if (!res.ok) {
      throw new Error(`listAssets ${res.status}: ${await res.text()}`);
    }

    const batch = await res.json();
    assets.push(...batch);

    if (batch.length < 100) {
      break;
    }

    page++;
  }

  return assets;
}

async function uploadAsset(releaseId, name, buf) {
  const res = await fetch(`${UPLOADS}/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { ...H, 'content-type': 'application/octet-stream', 'content-length': String(buf.length) },
    body: buf,
  });

  if (res.status === 422) {
    return { alreadyExists: true };
  }

  if (!res.ok) {
    throw new Error(`upload ${res.status}: ${await res.text()}`);
  }

  return { alreadyExists: false, asset: await res.json() };
}

async function downloadAsset(assetId) {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/releases/assets/${assetId}`, {
    headers: { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/octet-stream' },
  });

  if (!res.ok) {
    throw new Error(`download ${res.status}: ${await res.text()}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const raw = randomBytes(256 * 1024);
  const tarball = gzipSync(raw);
  const nxHash = createHash('sha256').update(tarball).update(NONCE).digest('hex');
  const assetName = `${nxHash}.tar.gz`;
  const result = { repo: `${OWNER}/${REPO}`, tag: TAG, asset: assetName, bytes: tarball.length, steps: {}, timings_ms: {} };

  // --- PUBLISH ---
  let t = ms();
  const release = await ensureRelease();
  result.timings_ms.ensure_release = ms() - t;

  t = ms();
  const up = await uploadAsset(release.id, assetName, tarball);
  result.timings_ms.upload_asset = ms() - t;
  result.steps.upload_already_existed = up.alreadyExists === true;

  // --- READ (cold reader path: getReleaseByTag -> listAssets -> download) ---
  const readSamples = [];

  for (let i = 0; i < 3; i++) {
    t = ms();
    const rel = await getReleaseByTag();
    const assets = await listAssets(rel.id);
    const asset = assets.find((a) => a.name === assetName);

    if (!asset) {
      throw new Error('asset not found after upload');
    }

    const blob = await downloadAsset(asset.id);
    const dt = ms() - t;
    readSamples.push(dt);
    result.steps[`read_${i}_bytes_identical`] = Buffer.compare(blob, tarball) === 0;
    result.steps[`read_${i}_sha_verified`] = sha256(blob) === sha256(tarball);
    result.steps[`read_${i}_asset_count`] = assets.length;
  }

  result.timings_ms.read_samples = readSamples;
  result.timings_ms.read_median = [...readSamples].sort((a, b) => a - b)[1];

  // --- ANON READ (private repo must fail without creds) ---
  const anonRel = await fetch(`${API}/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, {
    headers: { accept: 'application/vnd.github+json' },
  });
  result.steps.anon_read_status = anonRel.status;
  result.steps.anon_read_blocked = anonRel.status === 401 || anonRel.status === 404;

  const ok = result.steps.read_0_bytes_identical && result.steps.read_0_sha_verified;
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
