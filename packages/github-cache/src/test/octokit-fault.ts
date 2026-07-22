/**
 * Shared Octokit-shaped fault factory for the injected-client specs (RESEARCH:600,
 * 04-PATTERNS.md "No Analog Found"). Octokit's RequestError carries a NUMERIC `status`
 * and a `response.data` body; the publish (04-04) and cleanup (04-03) engines
 * discriminate faults by duck-typing `error.status` (never `instanceof RequestError`,
 * never stderr text), so a plain object carrying those two fields exercises every
 * fault branch faithfully.
 *
 * Spec-only helper: NO product imports, so it stays a pure test utility (it lives in
 * the lib build but imports nothing and is referenced only by *.spec.ts files). A real
 * Error is returned so it can be thrown and asserted with `rejects.toThrow`, while the
 * added `status` / `response.data` fields satisfy the duck-typed discrimination.
 *
 * Imported by `cleanup.spec.ts` and `publish-mirror.spec.ts`. ASCII only.
 */
export type OctokitFault = Error & {
  status: number;
  response: { data: unknown };
};

/**
 * Build an Octokit-shaped fault for a given HTTP status. Pass `body` to shape the
 * `response.data` payload (e.g. `{ errors: [{ code: 'already_exists' }] }`) so a
 * duplicate-asset 422 can be distinguished from a generic validation 422.
 */
export function octokitFault(status: number, body?: unknown): OctokitFault {
  const error = new Error(
    `github-cache test: octokit fault (status ${status})`,
  ) as OctokitFault;
  error.status = status;
  error.response = { data: body };

  return error;
}
