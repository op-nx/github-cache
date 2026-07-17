#!/usr/bin/env node
// Spike 005 (CI leg): does the repo's GITHUB_TOKEN (packages: write) delete a
// version of a repo-LINKED GHCR package? This is the C11 / RETAIN-03 escape from
// 004's finding that write:packages can't delete and a user/unlinked package
// forces a classic PAT. If GITHUB_TOKEN can delete an in-repo package version,
// GHCR cleanup needs no long-lived PAT (the preferred posture).
//
// Env: GH_TOKEN=GITHUB_TOKEN, GITHUB_ACTOR, GITHUB_REPOSITORY.
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';

const GH_TOKEN = process.env.GH_TOKEN;
const ACTOR = (process.env.GITHUB_ACTOR || 'layzeedk').toLowerCase();
const [OWNER, REPO] = (process.env.GITHUB_REPOSITORY || 'LayZeeDK/found01-spike').split('/');
const REG = 'https://ghcr.io', API = 'https://api.github.com';
const PKG = 'found01-cleanup';
const NAME = `${ACTOR}/${PKG}`;
const SOURCE = `https://github.com/${OWNER}/${REPO}`;
const sha256 = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');

async function ghToken(scope) {
  const basic = Buffer.from(`${ACTOR}:${GH_TOKEN}`).toString('base64');
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
  const manifest = { schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', config: { mediaType: 'application/vnd.oci.image.config.v1+json', digest: cfg.digest, size: cfg.size }, layers: [{ mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip', digest: layer.digest, size: layer.size }], annotations: { 'org.opencontainers.image.source': SOURCE } };
  await fetch(`${REG}/v2/${NAME}/manifests/${tag}`, { method: 'PUT', headers: { authorization: `Bearer ${bearer}`, 'content-type': manifest.mediaType }, body: Buffer.from(JSON.stringify(manifest)) });
}
const RH = { authorization: `Bearer ${GH_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' };

async function main() {
  const out = { pkg: NAME, source: SOURCE, steps: {} };
  const bearer = await ghToken(`repository:${NAME}:pull,push`);

  // Create two versions so we can delete one and keep the package.
  await pushArtifact(bearer, 'keep', Buffer.from('keep-v1'));
  await pushArtifact(bearer, 'todelete', Buffer.from('todelete-v1'));

  // Confirm repo linkage (needs the package to resolve via the user endpoint).
  const pkgInfo = await fetch(`${API}/users/${ACTOR}/packages/container/${PKG}`, { headers: RH });
  if (pkgInfo.ok) {
    const p = await pkgInfo.json();
    out.steps.package_visibility = p.visibility;
    out.steps.package_repo = p.repository?.full_name || 'UNLINKED';
  } else {
    out.steps.package_lookup = `${pkgInfo.status}`;
  }

  // List versions, find the 'todelete' one.
  const versions = await (await fetch(`${API}/users/${ACTOR}/packages/container/${PKG}/versions?per_page=100`, { headers: RH })).json();
  let victim = null;
  for (const v of Array.isArray(versions) ? versions : []) {
    if ((v.metadata?.container?.tags || []).includes('todelete')) victim = v;
  }
  out.steps.version_count = Array.isArray(versions) ? versions.length : 0;

  if (victim) {
    // Try user-scoped delete with the repo GITHUB_TOKEN (the C11 question).
    const delUser = await fetch(`${API}/users/${ACTOR}/packages/container/${PKG}/versions/${victim.id}`, { method: 'DELETE', headers: RH });
    out.steps.delete_user_scope = { status: delUser.status, ok: delUser.status === 204, body: delUser.status === 204 ? '' : (await delUser.text()).slice(0, 200) };

    if (delUser.status !== 204) {
      // Fallback: the /user/... self endpoint (works only if token is a user token).
      const delSelf = await fetch(`${API}/user/packages/container/${PKG}/versions/${victim.id}`, { method: 'DELETE', headers: RH });
      out.steps.delete_self_scope = { status: delSelf.status, ok: delSelf.status === 204, body: delSelf.status === 204 ? '' : (await delSelf.text()).slice(0, 200) };
    }
  }

  out.verdict = out.steps.delete_user_scope?.ok || out.steps.delete_self_scope?.ok
    ? 'GITHUB_TOKEN_CAN_DELETE_IN_REPO_PACKAGE'
    : 'GITHUB_TOKEN_CANNOT_DELETE_PAT_REQUIRED';

  console.log(JSON.stringify(out, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### C11 cleanup-credential\n\n\`\`\`json\n${JSON.stringify(out, null, 2)}\n\`\`\`\n`);
}
main().catch((e) => { console.error('CI CLEANUP SPIKE FAILED:', e.message); process.exit(1); });
