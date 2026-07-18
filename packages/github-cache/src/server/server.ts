import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as http from 'node:http';
import type { CacheBackend, PutResult } from '../backend/types.js';

const ROUTE = /^\/v1\/cache\/([^/]*)$/;

/** Bounded lowercase-hex task hash (SRV-03); the Actions-cache key space (TRUST-08). */
const HASH_PATTERN = /^[a-f0-9]{1,512}$/;

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
function makeAuthGate(
  expectedToken: string,
): (header?: string) => boolean {
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
  backend: CacheBackend,
  token: string,
  maxBodyBytes: number = MAX_CACHE_BODY_BYTES,
): http.Server {
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

    const hash = match[1];

    if (!HASH_PATTERN.test(hash)) {
      res.statusCode = 400;
      res.end();

      return;
    }

    if (req.method === 'GET') {
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

      return;
    }

    const declared = Number(req.headers['content-length']);

    if (Number.isFinite(declared) && declared > maxBodyBytes) {
      res.statusCode = 413;
      res.end();
      req.destroy();

      return;
    }

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

      case 'forbidden': {
        res.statusCode = 403;
        break;
      }

      default: {
        const _exhaustive: never = result;
        res.statusCode = 500;
        void _exhaustive;
      }
    }

    res.end();
  });
}
