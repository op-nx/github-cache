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
  // Merge-queue runs: default-branch-adjacent, write-scoped, never fork-
  // controlled. Omitting it silently disables cache writes on the merge queue
  // -- the one workflow whose entire point is fast CI.
  'merge_group',
]);

export function isWriteTrusted(env: NodeJS.ProcessEnv): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false;
  }

  const eventName = env.GITHUB_EVENT_NAME;

  return eventName !== undefined && TRUSTED_EVENTS.has(eventName);
}
