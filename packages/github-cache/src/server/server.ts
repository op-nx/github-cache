import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import * as http from 'node:http';
import type { CacheBackend } from '../backend/types.js';

const ROUTE = /^\/v1\/cache\/([^/]+)$/;

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
export function makeAuthGate(
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
 * (GET/PUT /v1/cache/{hash}) for the authenticated happy path.
 *
 * The backend is injected at construction (the D-04 RW/RO seam) -- there is no
 * caller-facing mode flag. Full hash validation (SRV-03), the body-size cap
 * (SRV-04), best-effort read swallowing (SRV-05) and the read-only 403 path are
 * Plan 01-03.
 */
export function createCacheServer(
  backend: CacheBackend,
  token: string,
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

    if (req.method === 'GET') {
      const got = await backend.get(hash);

      if (got.kind === 'hit') {
        res.statusCode = 200;
        res.end(got.bytes);
      } else {
        res.statusCode = 404;
        res.end();
      }

      return;
    }

    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const bytes = Buffer.concat(chunks);
    const result = await backend.put(hash, bytes);

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
