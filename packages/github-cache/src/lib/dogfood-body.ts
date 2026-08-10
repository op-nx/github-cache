import type { CacheOs } from './release-asset-name.js';

/**
 * Deterministic dogfood payload for a given cache hash AND the OS that produced it.
 * The seed job PUTs it and the verify / read-back jobs GET it and assert an exact byte
 * match, so both jobs agree on the expected bytes without passing anything between
 * them -- the only shared input is the workflow run id used as the hash.
 *
 * A leaf on purpose: the writer (action/index.ts) and the reader (roundtrip/
 * read-back.ts) both import it from here so they cannot disagree on the payload.
 * read-back must NOT import action/index.ts -- that would pull Octokit into the
 * round-trip bin for one string template.
 *
 * `CacheOs` is imported `import type` so this module stays a RUNTIME leaf even though
 * release-asset-name.ts imports HASH_PATTERN from cache-key.js at runtime: the type
 * erases at compile time. Type-only, and one OS vocabulary rather than two (D-18).
 *
 * `producerOs` IS REQUIRED, WITH NO DEFAULT -- comment-locked (D-18, VER-06). This
 * rule used to be justified BY CONTRAST with the sibling module's defaulted platform
 * parameter; CORR-02 DELETED that parameter, so the contrast case no longer exists and
 * the rule now stands on its own ground, which was always the stronger half of the
 * argument: a default here would be actively wrong. The verify leg's whole job is to
 * assert the body came from a DIFFERENT OS than its own, and a default resolving to the
 * running platform would let it silently compare against ITSELF -- passing on every
 * runner while proving nothing. That silent self-comparison is the vacuity trap VER-06
 * exists to close, so the ABSENCE of the default IS the control, not an omission.
 * `dogfood-body.spec.ts` pins it structurally via `dogfoodBody.length === 2` (the
 * selectBackend.length precedent), because Function.length counts parameters before the
 * first default. The sibling helper is now pinned by the same mechanism for the
 * opposite reason -- its arity is asserted to be 1, so its deleted parameter cannot
 * return behind a default either.
 *
 * `producerOs` REACHES THE BYTES, and that is load-bearing rather than incidental. A
 * parameter that only sat in the signature would make the verify leg's provenance
 * claim true of every body regardless of who produced it -- indistinguishable from the
 * presence-only check VER-06 rejects. `dogfood-body.spec.ts` asserts the two OS values
 * produce DIFFERENT bytes for exactly this reason.
 *
 * The template is pinned in TWO files by design: `dogfood-body.spec.ts` and a
 * hand-authored literal in `action/index.spec.ts`. Changing the template is therefore
 * intentionally a two-file edit -- the pinned-literal discipline, not duplication to
 * be tidied away.
 */
export function dogfoodBody(hash: string, producerOs: CacheOs): Buffer {
  return Buffer.from(`nx-github-cache-dogfood:${producerOs}:${hash}`);
}
