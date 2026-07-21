import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as http from 'node:http';
import { parseHash, type Hash } from '../lib/cache-key.js';
import {
  isWritableBackend,
  type PutResult,
  type ReadableBackend,
  type WritableBackend,
} from '../backend/types.js';

const ROUTE = /^\/v1\/cache\/([^/]*)$/;

// The SRV-03 hash guard shares HASH_PATTERN with the TRUST-08 key filter; its
// single home is the cache-key.ts leaf (one bounded lowercase-hex space).

/** Max PUT body (SRV-04): 2 GiB = 2,147,483,648 bytes. */
export const MAX_CACHE_BODY_BYTES = 2 * 1024 * 1024 * 1024;

/** Per-process CSPRNG bearer token (SRV-02); never Math.random or a timestamp. */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Constant-time bearer-token gate (SRV-02). Both the expected and presented
 * tokens are hashed to fixed 32-byte SHA-256 digests before timingSafeEqual, so
 * lengths always match: no ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH throw and no
 * length side-channel. Never a `===` compare.
 */
function makeAuthGate(expectedToken: string): (header?: string) => boolean {
  const expected = createHash('sha256').update(expectedToken).digest();

  return (header) => {
    if (!header?.startsWith('Bearer ')) {
      return false;
    }

    const presented = createHash('sha256').update(header.slice(7)).digest();

    return timingSafeEqual(expected, presented);
  };
}

/**
 * node:http protocol layer speaking the Nx self-hosted-cache contract
 * (GET/PUT /v1/cache/{hash}).
 *
 * The backend is injected at construction (the D-04 RW/RO seam) -- there is no
 * caller-facing mode flag (TRUST-05). The handler is a fixed guard-clause ladder
 * whose order is load-bearing: route/method (404) -> auth (401) -> hash validate
 * (400, before any backend call, SRV-03) -> PUT body cap (413, SRV-04) ->
 * backend -> status map. Reads are best-effort (any get fault degrades to a 404
 * MISS, never a 5xx); writes fail closed (a put fault surfaces as 500, never a
 * silent 200) -- SRV-05/D-06. maxBodyBytes is injectable so tests can drive the
 * streaming abort quickly; it defaults to the 2 GiB ceiling.
 */
export function createCacheServer(
  backend: ReadableBackend | WritableBackend,
  token: string,
  maxBodyBytes: number = MAX_CACHE_BODY_BYTES,
): http.Server {
  // Fail closed at the trust boundary (WR-03/SRV-02): an empty or whitespace-only
  // token would make expected = sha256('') and let `Authorization: Bearer `
  // (empty credential) authenticate against an open cache. serve() never passes
  // an empty token, but this factory is a public export a consumer can misconfigure.
  // This construction-time guard leaves makeAuthGate's per-request constant-time
  // compare untouched (no length side-channel for non-empty tokens).
  if (!token || !token.trim()) {
    throw new Error(
      'createCacheServer: a non-empty bearer token is required (SRV-02)',
    );
  }

  const authGate = makeAuthGate(token);

  return http.createServer(async (req, res) => {
    const match = req.url ? ROUTE.exec(req.url) : null;

    if (!match || (req.method !== 'GET' && req.method !== 'PUT')) {
      res.statusCode = 404;
      res.end();

      return;
    }

    if (!authGate(req.headers.authorization)) {
      res.statusCode = 401;
      res.end();

      return;
    }

    // Mint the validated Hash at the trust boundary (SRV-03): parseHash returns
    // undefined for anything outside HASH_PATTERN, so nothing past this point can
    // reach a backend with an unvalidated route param.
    const hash = parseHash(match[1]);

    if (hash === undefined) {
      res.statusCode = 400;
      res.end();

      return;
    }

    if (req.method === 'GET') {
      return handleGet(backend, hash, res);
    }

    // PUT to a read-only backend -> the Nx contract's 403 ("read-only token used to
    // write"). A ReadableBackend has no put, so the server (the protocol boundary)
    // owns this response; the body is never read. Answered here, after auth (401)
    // and hash validation, so a valid-but-read-only token maps to 403, not 401.
    if (!isWritableBackend(backend)) {
      res.statusCode = 403;
      res.end();

      return;
    }

    return handlePut(backend, hash, req, res, maxBodyBytes);
  });
}

/**
 * GET sub-handler (SRV-05 best-effort read): a hit yields 200 + bytes, a miss
 * 404, and any backend.get fault degrades to a 404 MISS -- never a
 * build-breaking 5xx. Extracted from the inline handler (WR-02) with no
 * behavioral change; dispatched only after the top-level route/auth/hash guards.
 */
async function handleGet(
  backend: ReadableBackend,
  hash: Hash,
  res: http.ServerResponse,
): Promise<void> {
  try {
    const got = await backend.get(hash);

    if (got.kind === 'hit') {
      res.statusCode = 200;
      res.end(got.bytes);
    } else {
      res.statusCode = 404;
      res.end();
    }
  } catch {
    res.statusCode = 404;
    res.end();
  }
}

/**
 * PUT sub-handler. Guard order is load-bearing and preserved verbatim from the
 * former inline handler (WR-02): (1) Content-Length fast-path 413 (SRV-04),
 * (2) the streaming drain try/catch -- mid-stream 413 and a fail-closed
 * 400/res.destroy on a stream fault (CR-01), (3) the SEPARATE backend.put
 * try/catch -> 500 (never merged with the drain catch -- merging would
 * mistranslate a backend fault into a 400 or swallow it), (4) the status map
 * 200/409/403/500. Writes fail closed (SRV-05/D-06). Dispatched only after the
 * top-level route/auth/hash guards.
 */
async function handlePut(
  backend: WritableBackend,
  hash: Hash,
  req: http.IncomingMessage,
  res: http.ServerResponse,
  maxBodyBytes: number,
): Promise<void> {
  const declared = Number(req.headers['content-length']);

  if (Number.isFinite(declared) && declared > maxBodyBytes) {
    res.statusCode = 413;
    res.end();
    req.destroy();

    return;
  }

  // ponytail: the whole body is buffered in memory (up to the 2 GiB cap) before
  // backend.put. withHashLock serializes same-hash puts, but distinct hashes run
  // concurrently (serve.ts), so N concurrent distinct-hash PUTs hold up to N x 2 GiB
  // resident. Fine for the documented single-tenant loopback sidecar (one Nx client);
  // if a multi-client deployment ever appears, stream to a temp file instead of
  // Buffer.concat rather than raising the count ceiling.
  let bytes: Buffer;

  try {
    const chunks: Buffer[] = [];
    let total = 0;

    for await (const chunk of req) {
      total += chunk.length;

      if (total > maxBodyBytes) {
        res.statusCode = 413;
        res.end();
        req.destroy();

        return;
      }

      chunks.push(chunk);
    }

    bytes = Buffer.concat(chunks);
  } catch {
    // A stream fault mid-upload (client abort, dropped connection, a
    // Content-Length that overstates the body -> ERR_STREAM_PREMATURE_CLOSE,
    // or a malformed chunked body) rejects this async handler. Fail closed on
    // the single request -- never crash the process (CR-01). No silent 200.
    if (res.headersSent) {
      res.destroy();
    } else {
      res.statusCode = 400;
      res.end();
    }

    return;
  }

  let result: PutResult;

  try {
    result = await backend.put(hash, bytes);
  } catch {
    res.statusCode = 500;
    res.end();

    return;
  }

  switch (result) {
    case 'stored': {
      res.statusCode = 200;
      break;
    }

    case 'conflict': {
      res.statusCode = 409;
      break;
    }

    default: {
      // Exhaustiveness guard: PutResult is 'stored' | 'conflict'. The read-only 403
      // is handled by the server BEFORE handlePut (a ReadableBackend has no put), so
      // it never reaches this switch.
      const _exhaustive: never = result;
      res.statusCode = 500;
      void _exhaustive;
    }
  }

  res.end();
}
