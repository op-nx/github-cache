/**
 * Deterministic dogfood payload for a given cache hash. The seed job PUTs it and
 * the verify / read-back jobs GET it and assert an exact byte match, so both jobs
 * agree on the expected bytes without passing anything between them -- the only
 * shared input is the workflow run id used as the hash.
 *
 * A leaf on purpose: the writer (action/index.ts) and the reader (roundtrip/
 * read-back.ts) both import it from here so they cannot disagree on the payload.
 * read-back must NOT import action/index.ts -- that would pull Octokit into the
 * round-trip bin for one string template.
 */
export function dogfoodBody(hash: string): Buffer {
  return Buffer.from(`nx-github-cache-dogfood:${hash}`);
}
