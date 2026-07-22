import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * ROBUST-03(a): the toolkit runtime dependencies MUST stay pinned to an exact
 * version (bare `x.y.z`), never a range (`^`/`~`/`>=`). This is a security
 * control, not a style rule: `@actions/cache` version-hashes the LITERAL archive
 * path and its compression choice into the restore key, so a silent minor/patch
 * bump behind a range operator can MISS every restore with no error -- and the
 * only end-to-end verification of a bump is the CI dogfood canary (Plan 06).
 * `@actions/cache` also carried a SUS (`too-new`) legitimacy verdict at install
 * time, so its exact version was human-approved before install (Task 1 gate).
 * This spec fails the build the moment either specifier widens to a range.
 */
describe('pinned toolkit dependencies (ROBUST-03)', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { dependencies?: Record<string, string> };

  const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;

  it('@actions/cache is pinned to an exact version, never a range (ROBUST-03)', () => {
    const specifier = manifest.dependencies?.['@actions/cache'];

    expect(specifier).toMatch(EXACT_SEMVER);
  });

  it('@actions/core is pinned to an exact version, never a range (ROBUST-03)', () => {
    const specifier = manifest.dependencies?.['@actions/core'];

    expect(specifier).toMatch(EXACT_SEMVER);
  });

  // @octokit/rest is the supply-chain surface for the publish + cleanup adapters
  // (T-04-SC). It was verdict OK in the 04-RESEARCH Package Legitimacy Audit
  // (official octokit org, no postinstall), pinned to the exact audited version so
  // a range operator can never silently pull an un-audited minor/patch. This spec
  // fails the build the moment the specifier widens to a range.
  it('@octokit/rest is pinned to an exact version, never a range (T-04-SC)', () => {
    const specifier = manifest.dependencies?.['@octokit/rest'];

    expect(specifier).toMatch(EXACT_SEMVER);
  });

  // The resilience pairing (F04) is a new supply-chain surface: @octokit/plugin-retry
  // and @octokit/plugin-throttling. Both were verified against the registry (versions,
  // core 7 peer range, no install scripts) and confirmed as octokit@5.0.5's own
  // pairing, then pinned exact so a range operator can never silently pull an
  // un-audited minor/patch. This spec fails the build the moment either widens.
  it('@octokit/plugin-retry is pinned to an exact version, never a range (F04)', () => {
    const specifier = manifest.dependencies?.['@octokit/plugin-retry'];

    expect(specifier).toMatch(EXACT_SEMVER);
  });

  it('@octokit/plugin-throttling is pinned to an exact version, never a range (F04)', () => {
    const specifier = manifest.dependencies?.['@octokit/plugin-throttling'];

    expect(specifier).toMatch(EXACT_SEMVER);
  });
});

/**
 * ROBUST-03(b): esbuild bundles the committed consumer JS action entry
 * (start-cache-server/index.js) that external repos resolve via `uses:`. Its
 * output is a supply-chain input to every consumer, and the CI drift guard
 * (`npm run check:action`) only proves the committed bundle matches a rebuild
 * with the INSTALLED esbuild -- so a range specifier could silently swap the
 * audited (legitimacy verdict OK) build tool for an un-audited minor/patch and
 * change the bundle bytes. esbuild is a devDependency ONLY (never shipped to
 * consumers) and is pinned exact in the ROOT workspace manifest
 * (`../../../package.json` from here). This spec fails the build the moment the
 * specifier widens to a range (`^`/`~`/`>=`).
 */
describe('pinned build tooling (ROBUST-03)', () => {
  const workspaceManifest = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
  ) as { devDependencies?: Record<string, string> };

  const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;

  it('esbuild is pinned to an exact version in the workspace devDependencies, never a range (ROBUST-03)', () => {
    const specifier = workspaceManifest.devDependencies?.['esbuild'];

    expect(specifier).toMatch(EXACT_SEMVER);
  });
});
