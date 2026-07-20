// Bundles the consumer JS action entry (start-cache-server/entry.ts) into ONE
// committed, dependency-inlined CJS file (start-cache-server/index.js) that
// external repos resolve via `uses:` from the git ref -- npm ci never runs for a
// `uses:` action, so every runtime dep (@actions/core + the @actions/cache +
// Azure SDK graph pulled in through serve()) must be inlined (Pitfall 1). Kept a
// node script rather than an inline `esbuild ...` npm command because the
// import.meta.url shim below needs a computed banner, which is not expressible in
// a cross-platform npm-script flag without fragile shell quoting; this mirrors
// the selfcheck.cjs generator-script convention. Deterministic output (fixed
// esbuild pin + banner + inputs) so `npm run check:action` can git-diff it.
import { build } from 'esbuild';

// import.meta.url shim (load-bearing). esbuild's CJS output leaves `import.meta`
// empty, so `@azure/storage-common`'s crc64 module (transitively required by
// @actions/cache) crashes at load with `createRequire(undefined)`. We define
// import.meta.url to a REAL file URL in the bundle's own directory so
// createRequire (used only for the Node builtins fs/path) and fileURLToPath
// resolve; the embedded base64 crc64.wasm means no external asset is needed.
//
// The shim MUST NOT resolve to the bundle's own path: serve.ts guards its main()
// with `import.meta.url === pathToFileURL(process.argv[1]).href`, and the runner
// invokes the action as `node index.js` (argv[1] === the bundle). A matching URL
// would run serve.ts's main() -- spawning a SECOND server and printing the bearer
// token UNMASKED. Pointing at a sibling `index.mjs` (never emitted) keeps that
// guard false while still giving Azure a valid directory to resolve builtins from.
const IMPORT_META_URL_SHIM =
  'require("node:url").pathToFileURL(require("node:path").join(__dirname,"index.mjs")).href';

await build({
  entryPoints: ['start-cache-server/entry.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  outfile: 'start-cache-server/index.js',
  define: { 'import.meta.url': '__actionImportMetaUrl' },
  banner: { js: `const __actionImportMetaUrl = ${IMPORT_META_URL_SHIM};` },
  // The define replaces every import.meta.url; silence the residual advisory for
  // any bare import.meta the define does not cover (none are load-bearing here).
  logOverride: { 'empty-import-meta': 'silent' },
});
