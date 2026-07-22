#!/usr/bin/env node
// Spike 002: cold-read API fan-out, GHCR vs Releases, vs the rate-limit pools
// (60/hr anon + 5000/hr auth REST; GHCR registry appears to be a separate pool).
//
// Populates N tiny entries in each store, then measures the ACTUAL HTTP call
// count + latency for a cold read of (N hits + M misses) - the shape of an
// `nx affected` startup where most requested hashes miss. Confirms GHCR
// tags/list pagination (Link header) and which rate-limit pool each store draws.
//
// Usage: GH_TOKEN=$(gh auth token) node fanout.mjs <N> <M>
import { createHash, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const N = Number(process.argv[2] || 10); // entries to populate (hits)
const M = Number(process.argv[3] || 20); // extra requested hashes that MISS
const GH_TOKEN = process.env.GH_TOKEN;
const USER = 'layzeedk';
const PKG = 'found01-fanout';
const NAME = `${USER}/${PKG}`;
const OWNER = 'LayZeeDK';
const REPO = 'found01-spike';
const TAG = 'spike-fanout';
const REG = 'https://ghcr.io';
const API = 'https://api.github.com';
const UPLOADS = 'https://uploads.github.com';

if (!GH_TOKEN) { console.error('GH_TOKEN required'); process.exit(1); }

const sha256 = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
const hex = (b) => createHash('sha256').update(b).digest('hex');
const ms = () => Number(process.hrtime.bigint() / 1000000n);

// Instrumented fetch: count calls, tag by pool.
let calls = { ghcr_registry: 0, ghcr_token: 0, rest: 0, uploads: 0 };
async function F(url, opts, pool) {
  calls[pool]++;
  return fetch(url, opts);
}

// ---------- GHCR ----------
async function ghcrToken(scope) {
  const basic = Buffer.from(`${USER}:${GH_TOKEN}`).toString('base64');
  const r = await F(`${REG}/token?scope=${encodeURIComponent(scope)}&service=ghcr.io`, { headers: { authorization: `Basic ${basic}` } }, 'ghcr_token');
  return (await r.json()).token;
}
async function ghcrPushBlob(bearer, buf) {
  const digest = sha256(buf);
  const head = await F(`${REG}/v2/${NAME}/blobs/${digest}`, { method: 'HEAD', headers: { authorization: `Bearer ${bearer}` } }, 'ghcr_registry');
  if (head.status === 200) return { digest, size: buf.length };
  const open = await F(`${REG}/v2/${NAME}/blobs/uploads/`, { method: 'POST', headers: { authorization: `Bearer ${bearer}` } }, 'ghcr_registry');
  let loc = open.headers.get('location'); if (loc.startsWith('/')) loc = REG + loc;
  const sep = loc.includes('?') ? '&' : '?';
  await F(`${loc}${sep}digest=${encodeURIComponent(digest)}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/octet-stream' }, body: buf }, 'ghcr_registry');
  return { digest, size: buf.length };
}
async function ghcrPushArtifact(bearer, tag, buf) {
  const layer = await ghcrPushBlob(bearer, buf);
  const cfg = await ghcrPushBlob(bearer, Buffer.from('{}'));
  const manifest = { schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', config: { mediaType: 'application/vnd.oci.image.config.v1+json', digest: cfg.digest, size: cfg.size }, layers: [{ mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', digest: layer.digest, size: layer.size }] };
  await F(`${REG}/v2/${NAME}/manifests/${tag}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': manifest.mediaType }, body: Buffer.from(JSON.stringify(manifest)) }, 'ghcr_registry');
}
async function ghcrListTags(bearer, n) {
  // Walk Link-header pagination to enumerate ALL tags.
  const tags = [];
  let pages = 0;
  let url = `${REG}/v2/${NAME}/tags/list${n ? `?n=${n}` : ''}`;
  for (;;) {
    pages++;
    const r = await F(url, { headers: { authorization: `Bearer ${bearer}` } }, 'ghcr_registry');
    const body = await r.json();
    tags.push(...(body.tags || []));
    const link = r.headers.get('link');
    if (!link || !link.includes('rel="next"')) break;
    const m = link.match(/<([^>]+)>\s*;\s*rel="next"/);
    if (!m) break;
    url = m[1].startsWith('http') ? m[1] : REG + m[1];
  }
  return { tags, pages };
}
async function ghcrColdRead(requested, pageSize) {
  // Bulk strategy (mirrors the Releases shard-map amortization): 1 token,
  // enumerate tags once, then manifest+blob per HIT. Misses are free.
  const bearer = await ghcrToken(`repository:${NAME}:pull`);
  const { tags, pages } = await ghcrListTags(bearer, pageSize);
  const present = new Set(tags);
  let hits = 0, bytes = 0;
  for (const h of requested) {
    if (!present.has(h)) continue; // MISS = 0 extra calls (bulk map)
    hits++;
    const mr = await F(`${REG}/v2/${NAME}/manifests/${h}`, { headers: { authorization: `Bearer ${bearer}`, accept: 'application/vnd.oci.image.manifest.v1+json' } }, 'ghcr_registry');
    const man = await mr.json();
    const br = await F(`${REG}/v2/${NAME}/blobs/${man.layers[0].digest}`, { headers: { authorization: `Bearer ${bearer}` } }, 'ghcr_registry');
    bytes += (await br.arrayBuffer()).byteLength;
  }
  return { hits, bytes, tagListPages: pages, tagCount: tags.length };
}

// ---------- Releases ----------
const RH = { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
async function relEnsure() {
  const g = await F(`${API}/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, { headers: RH }, 'rest');
  if (g.ok) return g.json();
  const c = await F(`${API}/repos/${OWNER}/${REPO}/releases`, { method: 'POST', headers: { ...RH, 'content-type': 'application/json' }, body: JSON.stringify({ tag_name: TAG, name: TAG }) }, 'rest');
  return c.json();
}
async function relUpload(id, name, buf) {
  const r = await F(`${UPLOADS}/repos/${OWNER}/${REPO}/releases/${id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...RH, 'content-type': 'application/octet-stream' }, body: buf }, 'uploads');
  return r.status; // 201 or 422 already-exists
}
async function relLoadShardMap(id) {
  // Exactly release-mirror-backend.ts: paginate assets per_page=100.
  const map = new Map();
  let page = 1, pages = 0;
  for (;;) {
    pages++;
    const r = await F(`${API}/repos/${OWNER}/${REPO}/releases/${id}/assets?per_page=100&page=${page}`, { headers: RH }, 'rest');
    const batch = await r.json();
    for (const a of batch) map.set(a.name, a.id);
    if (batch.length < 100) break;
    page++;
  }
  return { map, pages };
}
async function relColdRead(requested) {
  const rel = await F(`${API}/repos/${OWNER}/${REPO}/releases/tags/${TAG}`, { headers: RH }, 'rest');
  const relData = await rel.json();
  const { map, pages } = await relLoadShardMap(relData.id);
  let hits = 0, bytes = 0;
  for (const h of requested) {
    const id = map.get(`${h}.tar.gz`);
    if (id === undefined) continue; // MISS = free (in map)
    hits++;
    const d = await F(`${API}/repos/${OWNER}/${REPO}/releases/assets/${id}`, { headers: { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/octet-stream' } }, 'rest');
    bytes += (await d.arrayBuffer()).byteLength;
  }
  return { hits, bytes, shardPages: pages, assetCount: map.size };
}

async function main() {
  const out = { N, M, populate: {}, ghcr: {}, releases: {}, calls_by_pool: {}, projection_K200: {} };
  // Deterministic hash set: N present + M absent.
  const present = Array.from({ length: N }, (_, i) => hex(Buffer.from(`found01-fanout-present-${i}`)));
  const absent = Array.from({ length: M }, (_, i) => hex(Buffer.from(`found01-fanout-absent-${i}`)));
  const requested = [...present, ...absent];
  const payloads = present.map((h, i) => gzipSync(Buffer.concat([randomBytes(64), Buffer.from(`${i}`)])));

  // --- populate GHCR ---
  const pushBearer = await ghcrToken(`repository:${NAME}:pull,push`);
  let t = ms();
  for (let i = 0; i < N; i++) await ghcrPushArtifact(pushBearer, present[i], payloads[i]);
  out.populate.ghcr_ms = ms() - t;

  // --- populate Releases ---
  const rel = await relEnsure();
  t = ms();
  for (let i = 0; i < N; i++) await relUpload(rel.id, `${present[i]}.tar.gz`, payloads[i]);
  out.populate.releases_ms = ms() - t;

  // reset counters before the measured cold reads
  calls = { ghcr_registry: 0, ghcr_token: 0, rest: 0, uploads: 0 };

  // --- GHCR cold read (with a forced small tag-list page size to exercise Link pagination) ---
  t = ms();
  const g = await ghcrColdRead(requested, 3);
  out.ghcr = { ...g, latency_ms: ms() - t, calls_ghcr_registry: calls.ghcr_registry, calls_token: calls.ghcr_token };

  // reset REST counters
  const ghcrCalls = calls.ghcr_registry + calls.ghcr_token;
  calls = { ghcr_registry: 0, ghcr_token: 0, rest: 0, uploads: 0 };

  // --- Releases cold read ---
  t = ms();
  const r = await relColdRead(requested);
  out.releases = { ...r, latency_ms: ms() - t, calls_rest: calls.rest };

  out.calls_by_pool = {
    ghcr_total_registry_calls: ghcrCalls,
    ghcr_consumes_REST_pool: false,
    releases_REST_calls: calls.rest,
    releases_consumes_REST_pool: true,
  };

  // --- projection to K=200 requested, H=40 hits, one 30-day window ---
  // GHCR bulk:  1 token + ceil(T/pageMax) tag-list pages + 2*H   (registry pool)
  // Releases:   1 getReleaseByTag + ceil(assets/100) per shard * shards + H  (REST pool)
  const H = 40, T = 400, assets = 400, shardsInWindow = 2, ghcrPageMax = 100;
  out.projection_K200 = {
    assumptions: { K: 200, hits: H, total_entries: T, shards_in_window: shardsInWindow },
    ghcr_registry_calls: 1 + Math.ceil(T / ghcrPageMax) + 2 * H,
    ghcr_rest_calls: 0,
    releases_rest_calls: shardsInWindow * (1 + Math.ceil(assets / 100)) + H,
    anon_60_per_hr_headroom: 'Releases: every read is a REST call vs 60/hr anon -> ~40-50 calls/session is tight; GHCR registry reads do not draw the REST 60/hr pool',
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => { console.error('SPIKE FAILED:', e.message, e.stack); process.exit(1); });
