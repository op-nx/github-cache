#!/usr/bin/env node
// Spike 005 (CI leg): cross-OS round-trip + CI-side latency, GHCR vs Releases.
// Runs on an ubuntu + windows matrix inside GitHub Actions. Validates CORR-01 /
// Decision 6: a cross-OS HIT must never serve a wrong-OS artifact, and confirms
// OS-namespacing is the store-agnostic mitigation (neither store is safer).
//
// Env (from the workflow): GH_TOKEN=GITHUB_TOKEN, GITHUB_ACTOR, GITHUB_REPOSITORY.
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const GH_TOKEN = process.env.GH_TOKEN;
const ACTOR = (process.env.GITHUB_ACTOR || 'layzeedk').toLowerCase();
const [OWNER_RAW, REPO] = (process.env.GITHUB_REPOSITORY || 'LayZeeDK/found01-spike').split('/');
const OWNER = OWNER_RAW; // repo owner, original case for REST
const REG = 'https://ghcr.io', API = 'https://api.github.com', UPLOADS = 'https://uploads.github.com';
const OS = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
const PKG = 'found01-crossos';
const NAME = `${ACTOR}/${PKG}`;
const TAG_REL = 'spike-crossos';
const SOURCE = `https://github.com/${OWNER}/${REPO}`;

const sha256 = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
const hex = (s) => createHash('sha256').update(s).digest('hex');
const ms = () => Number(process.hrtime.bigint() / 1000000n);

// ---------- GHCR ----------
async function ghToken(scope) {
  const basic = Buffer.from(`${ACTOR}:${GH_TOKEN}`).toString('base64');
  return (await (await fetch(`${REG}/token?scope=${encodeURIComponent(scope)}&service=ghcr.io`, { headers: { authorization: `Basic ${basic}` } })).json()).token;
}
async function ghPushBlob(bearer, buf) {
  const digest = sha256(buf);
  if ((await fetch(`${REG}/v2/${NAME}/blobs/${digest}`, { method: 'HEAD', headers: { authorization: `Bearer ${bearer}` } })).status === 200) return { digest, size: buf.length };
  const open = await fetch(`${REG}/v2/${NAME}/blobs/uploads/`, { method: 'POST', headers: { authorization: `Bearer ${bearer}` } });
  let loc = open.headers.get('location'); if (loc.startsWith('/')) loc = REG + loc;
  const put = await fetch(`${loc}${loc.includes('?') ? '&' : '?'}digest=${encodeURIComponent(digest)}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/octet-stream' }, body: buf });
  if (put.status !== 201) throw new Error(`ghcr blob PUT ${put.status}: ${await put.text()}`);
  return { digest, size: buf.length };
}
async function ghPush(bearer, tag, buf) {
  const layer = await ghPushBlob(bearer, buf);
  const cfg = await ghPushBlob(bearer, Buffer.from('{}'));
  const manifest = {
    schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json',
    config: { mediaType: 'application/vnd.oci.image.config.v1+json', digest: cfg.digest, size: cfg.size },
    layers: [{ mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', digest: layer.digest, size: layer.size }],
    annotations: { 'org.opencontainers.image.source': SOURCE }, // auto-link package -> repo (C11)
  };
  const r = await fetch(`${REG}/v2/${NAME}/manifests/${tag}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': manifest.mediaType }, body: Buffer.from(JSON.stringify(manifest)) });
  if (r.status !== 201) throw new Error(`ghcr manifest PUT ${r.status}: ${await r.text()}`);
  return r.headers.get('docker-content-digest');
}
async function ghRead(bearer, tag) {
  const mr = await fetch(`${REG}/v2/${NAME}/manifests/${tag}`, { headers: { authorization: `Bearer ${bearer}`, accept: 'application/vnd.oci.image.manifest.v1+json' } });
  if (!mr.ok) return null;
  const man = await mr.json();
  const br = await fetch(`${REG}/v2/${NAME}/blobs/${man.layers[0].digest}`, { headers: { authorization: `Bearer ${bearer}` } });
  return Buffer.from(await br.arrayBuffer());
}

// ---------- Releases ----------
const RH = { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };
async function relEnsure() {
  const g = await fetch(`${API}/repos/${OWNER}/${REPO}/releases/tags/${TAG_REL}`, { headers: RH });
  if (g.ok) return g.json();
  const c = await fetch(`${API}/repos/${OWNER}/${REPO}/releases`, { method: 'POST', headers: { ...RH, 'content-type': 'application/json' }, body: JSON.stringify({ tag_name: TAG_REL, name: TAG_REL }) });
  return c.json();
}
async function relPush(relId, name, buf) {
  const r = await fetch(`${UPLOADS}/repos/${OWNER}/${REPO}/releases/${relId}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { ...RH, 'content-type': 'application/octet-stream' }, body: buf });
  return r.status; // 201 or 422 exists
}
async function relRead(relId, name) {
  const assets = await (await fetch(`${API}/repos/${OWNER}/${REPO}/releases/${relId}/assets?per_page=100`, { headers: RH })).json();
  const a = assets.find((x) => x.name === name);
  if (!a) return null;
  return Buffer.from(await (await fetch(`${API}/repos/${OWNER}/${REPO}/releases/assets/${a.id}`, { headers: { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/octet-stream' } })).arrayBuffer());
}

function summary(md) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}

async function main() {
  const out = { os: OS, actor: ACTOR, repo: `${OWNER}/${REPO}`, ghcr: {}, releases: {}, corr01: {}, latency_ms: {} };

  // OS-invariant input: same input hash AND same bytes on every OS -> safe to share.
  const invHash = hex('found01-os-invariant-input');
  const invContent = Buffer.from('os-invariant-output-bytes-v1'); // identical on all OSes
  // OS-sensitive: SAME Nx input hash on both OSes (Nx omits OS by default) but the
  // OUTPUT differs by OS -> the wrong-OS-hit hazard. OS-namespaced key isolates it.
  const sensHash = hex('found01-os-sensitive-input');
  const sensContent = Buffer.from(`os-sensitive-output-for-${OS}`);
  const nsKey = `${sensHash}-${OS}`; // OS-namespaced (CORR-01 mitigation)

  // ----- GHCR arm -----
  const ghPushBearer = await ghToken(`repository:${NAME}:pull,push`);
  let t = ms();
  await ghPush(ghPushBearer, invHash, invContent);
  await ghPush(ghPushBearer, nsKey, sensContent);
  out.latency_ms.ghcr_push = ms() - t;
  const ghPullBearer = await ghToken(`repository:${NAME}:pull`);
  t = ms();
  const ghInv = await ghRead(ghPullBearer, invHash);
  const ghNs = await ghRead(ghPullBearer, nsKey);
  out.latency_ms.ghcr_read = ms() - t;
  out.ghcr.invariant_ok = ghInv && Buffer.compare(ghInv, invContent) === 0;
  out.ghcr.namespaced_ok = ghNs && Buffer.compare(ghNs, sensContent) === 0;

  // ----- Releases arm -----
  const rel = await relEnsure();
  t = ms();
  await relPush(rel.id, `${invHash}.bin`, invContent);
  await relPush(rel.id, `${nsKey}.bin`, sensContent);
  out.latency_ms.releases_push = ms() - t;
  t = ms();
  const relInv = await relRead(rel.id, `${invHash}.bin`);
  const relNs = await relRead(rel.id, `${nsKey}.bin`);
  out.latency_ms.releases_read = ms() - t;
  out.releases.invariant_ok = relInv && Buffer.compare(relInv, invContent) === 0;
  out.releases.namespaced_ok = relNs && Buffer.compare(relNs, sensContent) === 0;

  // ----- CORR-01 collision demo (deterministic, GHCR; store-agnostic point) -----
  // Non-namespaced key written by "the other OS" first, then a wrong-OS read.
  const collideKey = `${sensHash}-collide`;
  await ghPush(ghPushBearer, collideKey, Buffer.from('os-sensitive-output-for-OTHEROS'));
  const wrongRead = await ghRead(ghPullBearer, collideKey);
  out.corr01 = {
    non_namespaced_serves_last_writer: wrongRead && wrongRead.toString() === 'os-sensitive-output-for-OTHEROS',
    namespaced_isolates_by_os: out.ghcr.namespaced_ok === true,
    note: 'Neither store prevents the wrong-OS hit; OS-namespacing the key is the mitigation (identical for both stores).',
  };

  console.log(JSON.stringify(out, null, 2));
  summary(`### FOUND-01 cross-OS (${OS})\n\n\`\`\`json\n${JSON.stringify(out, null, 2)}\n\`\`\``);

  const ok = out.ghcr.invariant_ok && out.ghcr.namespaced_ok && out.releases.invariant_ok && out.releases.namespaced_ok;
  if (!ok) process.exit(2);
}
main().catch((e) => { console.error('CI SPIKE FAILED:', e.message); process.exit(1); });
