// ponytail: global in-process map. Ceiling = single-process / ephemeral single-
// tenant runner (the documented deployment). A distributed lock is out of scope;
// upgrade path is a shared coordinator only if multi-process writers ever appear.
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Per-hash serialization primitive (TEST-02 / D-03). Same-hash operations queue
 * through a chained promise; different hashes run concurrently; each map entry is
 * evicted once its tail settles; a rejected operation reaches its own caller
 * without wedging the queue.
 */
export function withHashLock<T>(
  hash: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prior = inFlight.get(hash) ?? Promise.resolve();
  // Chain AFTER prior settles (resolve OR reject) so one rejection never wedges
  // the queue -- `.then(run, run)` runs `fn` in both branches.
  const run = (): Promise<T> => fn();
  const result = prior.then(run, run);
  // Store a non-rejecting tail so a failed op cannot reject a later waiter's chain.
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  inFlight.set(hash, tail);
  // Evict only if still the tail (identity check) so a concurrent re-add is safe.
  void tail.then(() => {
    if (inFlight.get(hash) === tail) {
      inFlight.delete(hash);
    }
  });

  // The caller sees the REAL resolution/rejection, never the swallowed tail.
  return result;
}

/**
 * Test-only probe for the in-flight map size. It exists so the TEST-02 eviction
 * property is directly observable; it is NOT part of the consumer contract.
 */
export function inFlightHashCount(): number {
  return inFlight.size;
}
