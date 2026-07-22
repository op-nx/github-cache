#!/usr/bin/env node
// Spike 004: GHCR operational hazards (RETAIN-02/03, TRUST-07, C10-C13).
// Empirically characterizes:
//   1. Mutable-tag overwrite (TRUST-07: no atomic create-if-absent) - CONFIRM, don't relitigate.
//   2. Orphaned-manifest accumulation: re-pushing a tag leaves the OLD manifest untagged.
//      (For a single-blob cache, this - not multi-arch children - is the real cleanup burden.)
//   3. Cleanup-credential gap: can the current gh token (write:packages, NO delete:packages)
//      delete a version? -> reveals the minimal cleanup credential (RETAIN-03/C11).
//
// Usage: GH_TOKEN=$(gh auth token) node ghcr-hazards.mjs
import { createHash, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const GH_TOKEN = process.env.GH_TOKEN;
const USER = 'layzeedk', PKG = 'found01-hazards', NAME = `${USER}/${PKG}`;
const REG = 'https://ghcr.io', API = 'https://api.github.com';
const TAG = 'overwrite-probe';
if (!GH_TOKEN) { console.error('GH_TOKEN required'); process.exit(1); }

const sha256 = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
async function token(scope) {
  const basic = Buffer.from(`${USER}:${GH_TOKEN}`).toString('base64');
  return (await (await fetch(`${REG}/token?scope=${encodeURIComponent(scope)}&service=ghcr.io`, { headers: { authorization: `Basic ${basic}` } })).json()).token;
}
async function pushBlob(bearer, buf) {
  const digest = sha256(buf);
  if ((await fetch(`${REG}/v2/${NAME}/blobs/${digest}`, { method: 'HEAD', headers: { authorization: `Bearer ${bearer}` } })).status === 200) return { digest, size: buf.length };
  const open = await fetch(`${REG}/v2/${NAME}/blobs/uploads/`, { method: 'POST', headers: { authorization: `Bearer ${bearer}` } });
  let loc = open.headers.get('location'); if (loc.startsWith('/')) loc = REG + loc;
  await fetch(`${loc}${loc.includes('?') ? '&' : '?'}digest=${encodeURIComponent(digest)}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/octet-stream' }, body: buf });
  return { digest, size: buf.length };
}
async function pushArtifact(bearer, tag, buf) {
  const layer = await pushBlob(bearer, buf);
  const cfg = await pushBlob(bearer, Buffer.from('{}'));
  const manifest = { schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', config: { mediaType: 'application/vnd.oci.image.config.v1+json', digest: cfg.digest, size: cfg.size }, layers: [{ mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', digest: layer.digest, size: layer.size }] };
  const r = await fetch(`${REG}/v2/${NAME}/manifests/${tag}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': manifest.mediaType }, body: Buffer.from(JSON.stringify(manifest)) });
  return r.headers.get('docker-content-digest');
}
async function manifestByTag(bearer, tag) {
  const r = await fetch(`${REG}/v2/${NAME}/manifests/${tag}`, { headers: { authorization: `Bearer ${bearer}`, accept: 'application/vnd.oci.image.manifest.v1+json' } });
  return r.headers.get('docker-content-digest');
}

async function main() {
  const out = { pkg: NAME, steps: {} };
  const bearer = await token(`repository:${NAME}:pull,push`);

  // 1+2. overwrite the same tag with different content
  const a = gzipSync(Buffer.concat([randomBytes(1024), Buffer.from('A')]));
  const b = gzipSync(Buffer.concat([randomBytes(1024), Buffer.from('B')]));
  const d1 = await pushArtifact(bearer, TAG, a);
  const d2 = await pushArtifact(bearer, TAG, b);
  const current = await manifestByTag(bearer, TAG);
  out.steps.overwrite = {
    manifest_digest_after_A: d1,
    manifest_digest_after_B: d2,
    tag_now_points_to: current,
    tag_is_mutable_overwrite: d1 !== d2 && current === d2, // GHCR overwrote the tag (no atomic create)
  };

  // list versions via REST to see the orphaned (untagged) old manifest
  const versions = await (await fetch(`${API}/user/packages/container/${PKG}/versions?per_page=100`, { headers: { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' } })).json();
  const tagged = [], untagged = [];
  for (const v of Array.isArray(versions) ? versions : []) {
    const tags = v.metadata?.container?.tags || [];
    (tags.length ? tagged : untagged).push({ id: v.id, digest: (v.name || '').slice(0, 19), tags });
  }
  out.steps.versions = { tagged, untagged, orphaned_from_overwrite: untagged.length };

  // 3. cleanup-credential gap: try to DELETE an (untagged) version with the current gh token
  const victim = untagged[0] || tagged[0];
  if (victim) {
    const del = await fetch(`${API}/user/packages/container/${PKG}/versions/${victim.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    });
    out.steps.delete_with_gh_token = {
      target_id: victim.id,
      status: del.status,
      succeeded: del.status === 204,
      note: del.status === 204 ? 'gh token CAN delete (has delete:packages)' : `blocked ${del.status}: ` + (await del.text()).slice(0, 160),
    };
  }

  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error('SPIKE FAILED:', e.message); process.exit(1); });
