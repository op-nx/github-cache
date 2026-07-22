# External Integrations

**Analysis Date:** 2026-07-18

## Current State Notice

This workspace is a freshly torn-down Nx shell (post Phase 0): only the root `@op-nx/source` project exists, `packages/` is empty (just `packages/.gitkeep`), and there is no `src/` or application code. **There are no external integrations of any kind at this point in the codebase.** No SDK/API client dependencies are declared in `package.json` (`dependencies: {}`), no `.env` files exist, and no runtime service code exists to call out to anything. This is expected for a pre-Phase-1 greenfield shell, not a gap to fill in this document.

## APIs & External Services

None. `package.json`'s `dependencies` field is empty (`{}`); the `devDependencies` are all build/test tooling (Nx, TypeScript, Vitest, Vite, Prettier, SWC) — see `.planning/codebase/STACK.md`. No SDK or API client packages (e.g., cloud provider SDKs, HTTP clients, GitHub API clients) are present.

## Data Storage

**Databases:**
- None — no database client, ORM, or connection config present anywhere in the repo.

**File Storage:**
- Local filesystem only (implicit — no code exists yet that reads/writes files beyond the build toolchain itself).

**Caching:**
- Nx's own local task/build cache (`.nx/cache`, `.nx/workspace-data`, both gitignored per `.gitignore` and excluded from Prettier via `.prettierignore`) — this is Nx tooling cache, not an application-level cache.

## Authentication & Identity

**Auth Provider:**
- None — no auth library, provider SDK, or credential-handling code exists.

## Monitoring & Observability

**Error Tracking:**
- None.

**Logs:**
- None — no logging framework configured; CI job output (`.github/workflows/ci.yml`) is the only current "observability" surface.

## CI/CD & Deployment

**Hosting:**
- Not applicable — no deployable application exists yet.

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml`, triggered on push to `main` and on pull requests
  - `format-check` job — `ubuntu-24.04-arm`, runs `npx nx format:check --all`
  - `build` job — `ubuntu-24.04-arm`, runs `npm run build` (→ `nx run-many -t build`)
  - `typecheck` job — `ubuntu-24.04-arm`, runs `npm run typecheck` (→ `nx run-many -t typecheck`)
  - `test` job — `ubuntu-24.04-arm`, runs `npm run test` (→ `nx run-many -t test`)
  - `integration` job — matrixed across `ubuntu-24.04-arm` and `windows-11-arm` (`fail-fast: false`), runs `npm run integration` (→ `nx run-many -t integration`); currently a green no-op since no project defines an `integration` target — the matrix is deliberately kept as cross-OS scaffolding for a later phase
  - All jobs use `actions/setup-node@v6` with `node-version-file: '.node-version'` and `cache: 'npm'`, and install via `npm ci`
  - `permissions: contents: read` is set at the workflow level (no elevated GitHub token permissions requested)

## Environment Configuration

**Required env vars:**
- None detected — no `.env*` files exist in the repo, and no code references `process.env` (no source code exists yet to reference it).

**Secrets location:**
- Not applicable — no secrets are used or referenced anywhere in the current shell.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

---

*Integration audit: 2026-07-18*
