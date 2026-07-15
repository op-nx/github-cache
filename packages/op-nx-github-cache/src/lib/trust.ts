// CREEP (CVE-2025-36852) mitigation: only these GitHub Actions trigger events
// carry a write-scoped (non-read-only) token per GitHub's own trust model
// (verified pv-5/pv-6). Everything else -- including local runs, which never
// set GITHUB_ACTIONS -- is untrusted for writes.
const TRUSTED_EVENTS = new Set([
  'push',
  'schedule',
  'workflow_dispatch',
  'repository_dispatch',
  'delete',
  'registry_package',
  'page_build',
]);

export function isWriteTrusted(env: NodeJS.ProcessEnv): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false;
  }

  const eventName = env.GITHUB_EVENT_NAME;

  return eventName !== undefined && TRUSTED_EVENTS.has(eventName);
}
