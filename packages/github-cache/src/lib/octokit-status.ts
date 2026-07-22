/**
 * Duck-type the numeric HTTP status off an Octokit-shaped fault (ROBUST-01, D-04).
 * Never `instanceof RequestError` (two @octokit/request-error versions can coexist in
 * the dependency tree) and never stderr/body text: discrimination is STRUCTURAL on
 * `error.status` only.
 *
 * A `lib/` LEAF (imports nothing from the cleanup/publish engines), so both the
 * cleanup and publish-mirror engines can share it without either engine importing
 * from a sibling engine -- the single home for the 404/422/5xx status contract that
 * was previously authored byte-identically in both (I8/simplify: drift risk on a
 * fault-discrimination contract encoded twice).
 */
export function statusOf(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === 'object' &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }

  return undefined;
}
