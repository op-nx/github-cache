#!/usr/bin/env node
// Spike 003: per-primitive size ceiling + failure mode (ROBUST-02).
// Documented ceilings: Releases ~2 GiB/asset; GHCR blobs much larger; server
// body cap = 2 GiB (MAX_CACHE_BODY_BYTES). This probes a representative large
// INCOMPRESSIBLE artifact on both to answer the adapter-design questions:
//   - does GHCR's MONOLITHIC blob PUT scale to 100s of MB, or is chunked upload
//     required? (chunking = extra adapter complexity, a GHCR burden)
//   - measured up/down throughput -> extrapolated time-to-2GiB
//   - does an oversize upload fail LOUD or SILENT?
//
// Usage: GH_TOKEN=$(gh auth token) node size-ceiling.mjs <sizeMB>
import { createHash, randomBytes } from 'node:crypto';

const SIZE_MB = Number(process.argv[2] || 100);
const GH_TOKEN = process.env.GH_TOKEN;
const USER = 'layzeedk', PKG = 'found01-size', NAME = `${USER}/${PKG}`;
const OWNER = 'LayZeeDK', REPO = 'found01-spike', TAG = 'spike-size';
const REG = 'https://ghcr.io', API = 'https://api.github.com', UPLOADS = 'https://uploads.github.com';

if (!GH_TOKEN) { console.error('GH_TOKEN required'); process.exit(1); }
const sha256 = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
const ms = () => Number(process.hrtime.bigint() / 1000000n);
const mbps = (bytes, msDur) => ((bytes * 8) / 1e6 / (msDur / 1000)).toFixed(1);

async function ghcrToken(scope) {
  const basic = Buffer.from(`${USER}:${GH_TOKEN}`).toString('base64');
  return (await (await fetch(`${REG}/token?scope=${encodeURIComponent(scope)}&service=ghcr.io`, { headers: { authorization: `Basic ${basic}` } })).json()).token;
}

async function ghcrProbe(buf) {
  const r = { store: 'ghcr', bytes: buf.length, monolithic_put_ok: false };
  const bearer = await ghcrToken(`repository:${NAME}:pull,push`);
  const digest = sha256(buf);

  // Monolithic blob upload (whole body in one PUT) - the simple adapter path.
  let t = ms();
  const open = await fetch(`${REG}/v2/${NAME}/blobs/uploads/`, { method: 'POST', headers: { authorization: `Bearer ${bearer}` } });
  let loc = open.headers.get('location'); if (loc.startsWith('/')) loc = REG + loc;
  const sep = loc.includes('?') ? '&' : '?';
  const put = await fetch(`${loc}${sep}digest=${encodeURIComponent(digest)}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/octet-stream', 'content-length': String(buf.length) }, body: buf });
  r.put_status = put.status;
  r.monolithic_put_ok = put.status === 201;
  r.up_ms = ms() - t;
  r.up_mbps = mbps(buf.length, r.up_ms);
  if (!r.monolithic_put_ok) { r.put_error = (await put.text()).slice(0, 300); return r; }

  // config + manifest so it is a real artifact keyed by a tag
  const cfg = Buffer.from('{}');
  const cdig = sha256(cfg);
  const co = await fetch(`${REG}/v2/${NAME}/blobs/uploads/`, { method: 'POST', headers: { authorization: `Bearer ${bearer}` } });
  let cloc = co.headers.get('location'); if (cloc.startsWith('/')) cloc = REG + cloc;
  await fetch(`${cloc}${cloc.includes('?') ? '&' : '?'}digest=${encodeURIComponent(cdig)}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/octet-stream' }, body: cfg });
  const manifest = { schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', config: { mediaType: 'application/vnd.oci.image.config.v1+json', digest: cdig, size: cfg.length }, layers: [{ mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', digest, size: buf.length }] };
  await fetch(`${REG}/v2/${NAME}/manifests/${TAG}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': manifest.mediaType }, body: Buffer.from(JSON.stringify(manifest)) });

  // pull back, verify
  t = ms();
  const bearerP = await ghcrToken(`repository:${NAME}:pull`);
  const blob = Buffer.from(await (await fetch(`${REG}/v2/${NAME}/blobs/${digest}`, { headers: { authorization: `Bearer ${bearerP}` } })).arrayBuffer());
  r.down_ms = ms() - t;
  r.down_mbps = mbps(blob.length, r.down_ms);
  r.bytes_identical = Buffer.compare(blob, buf) === 0;
  return r;
}

const RH = { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
async function releasesProbe(buf) {
  const r = { store: 'releases', bytes: buf.length };
  let rel = await fetch(`${API}/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, { headers: RH });
  let relData = rel.ok ? await rel.json() : await (await fetch(`${API}/repos/${OWNER}/${REPO}/releases`, { method: 'POST', headers: { ...RH, 'content-type': 'application/json' }, body: JSON.stringify({ tag_name: TAG, name: TAG }) })).json();
  const name = `${sha256(buf).slice(7, 71)}.tar.gz`;

  let t = ms();
  const up = await fetch(`${UPLOADS}/repos/${OWNER}/${REPO}/releases/${relData.id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...RH, 'content-type': 'application/octet-stream', 'content-length': String(buf.length) }, body: buf });
  r.up_status = up.status;
  r.up_ok = up.status === 201;
  r.up_ms = ms() - t;
  r.up_mbps = mbps(buf.length, r.up_ms);
  if (!r.up_ok) { r.up_error = (await up.text()).slice(0, 300); return r; }
  const asset = await up.json();

  t = ms();
  const blob = Buffer.from(await (await fetch(`${API}/repos/${OWNER}/${REPO}/releases/assets/${asset.id}`, { headers: { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/octet-stream' } })).arrayBuffer());
  r.down_ms = ms() - t;
  r.down_mbps = mbps(blob.length, r.down_ms);
  r.bytes_identical = Buffer.compare(blob, buf) === 0;
  return r;
}

async function main() {
  console.error(`Generating ${SIZE_MB} MiB incompressible payload...`);
  const buf = randomBytes(SIZE_MB * 1024 * 1024);
  const ghcr = await ghcrProbe(buf);
  const releases = await releasesProbe(buf);
  const extrapolate = (r) => r.up_mbps ? `${((2048 * 8) / Number(r.up_mbps)).toFixed(0)}s to push 2 GiB at ${r.up_mbps} Mbps` : 'n/a';
  console.log(JSON.stringify({
    size_mb: SIZE_MB,
    ghcr,
    releases,
    extrapolation_to_2GiB: { ghcr: extrapolate(ghcr), releases: extrapolate(releases) },
    documented_ceilings: {
      releases_per_asset: '~2 GiB (collides with the 2 GB server body cap - a max artifact sits right at the boundary)',
      ghcr_blob: 'much larger than 2 GiB (registry layer limit ~10s of GiB); headroom above the body cap',
      server_body_cap: '2 GiB (MAX_CACHE_BODY_BYTES) - the binding limit for BOTH today',
    },
  }, null, 2));
}
main().catch((e) => { console.error('SPIKE FAILED:', e.message); process.exit(1); });
