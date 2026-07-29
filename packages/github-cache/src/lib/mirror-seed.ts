import { CACHE_OS_VALUES, type CacheOs } from './release-asset-name.js';

// RED scaffold. The OS component is already single-sourced from the real tuple (D-12
// constraint 3), so what the failing cases isolate is the hex MARKER -- the component
// that makes the seed non-all-decimal and therefore disjoint from run ids, from Nx task
// hashes, and from ci.yml's shipped cafe<run_id> family. The full lock lands with it.
export function mirrorSeedHash(runId: string, os: CacheOs): string {
  return `${CACHE_OS_VALUES.indexOf(os)}${runId}`;
}
