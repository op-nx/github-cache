import { pathToFileURL } from 'node:url';

/**
 * True when the module at `moduleUrl` (pass your own `import.meta.url`) is the
 * process entrypoint -- launched directly (`node <file>`) rather than imported. A
 * helper cannot read the caller's module meta, so the caller passes it in.
 *
 * Compares against `pathToFileURL(process.argv[1]).href`, NOT the naive
 * `'file://' + process.argv[1]`: on Windows a bare drive path is not a valid file
 * URL, so the naive form is permanently false there (Pitfall 6). This leaf is the
 * ONE home for that Windows-fragile idiom, shared by the serve / dogfood-action /
 * cleanup / round-trip entrypoints.
 */
export function isEntrypoint(moduleUrl: string): boolean {
  return !!process.argv[1] && moduleUrl === pathToFileURL(process.argv[1]).href;
}
