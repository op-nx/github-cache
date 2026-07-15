import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
} from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { HASH_PATTERN, type CacheBackend } from './types.js';
import { isWriteTrusted } from './trust.js';

const CACHE_PATH_PATTERN = /^\/v1\/cache\/([^/]+)$/;

export interface ServerOptions {
  backend: CacheBackend;
  token: string;
}

function isAuthorized(authHeader: string | undefined, token: string): boolean {
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const provided = Buffer.from(authHeader.slice('Bearer '.length));
  const expected = Buffer.from(token);

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}

// Default 2GB cap: generous for Nx task-output tarballs, but bounds memory
// use for a PUT body that's otherwise fully buffered before any backend call.
// Both failure modes fall back to the default (matching resolveMaxAgeDays):
// a non-numeric override would leave `total > NaN` always false (fail-open,
// cap disabled), while a zero/negative override would make `total > cap` true
// for the first byte (every non-empty PUT 413s -- a silent write outage). A
// large finite value is honored as-is: unlike the shard window it carries no
// per-unit API cost, so there's nothing to clamp.
export const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024 * 1024;

export function resolveMaxBodyBytes(envValue: string | undefined): number {
  const configured = Number(envValue);

  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  // Warn only when the operator set something we then ignored, so a typo isn't
  // silently absorbed. An unset value is the normal path -- no warning.
  if (envValue !== undefined) {
    console.warn(
      `MAX_CACHE_BODY_BYTES="${envValue}" is not a positive number; using default ${DEFAULT_MAX_BODY_BYTES}.`,
    );
  }

  return DEFAULT_MAX_BODY_BYTES;
}

const MAX_BODY_BYTES = resolveMaxBodyBytes(process.env.MAX_CACHE_BODY_BYTES);

class PayloadTooLargeError extends Error {}

// Nx's self-hosted-cache contract documents Content-Length as a required PUT
// header, but this reads the body from the stream and caps it against
// MAX_BODY_BYTES regardless of what (or whether) Content-Length declares --
// intentionally lenient, since the size cap above already bounds worst-case
// memory use without needing to trust a client-supplied header.
async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;

    if (total > MAX_BODY_BYTES) {
      throw new PayloadTooLargeError();
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export function createServer({ backend, token }: ServerOptions): Server {
  return createHttpServer((req, res) => {
    void handleRequest(req, res, backend, token);
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: import('node:http').ServerResponse,
  backend: CacheBackend,
  token: string,
): Promise<void> {
  const match = CACHE_PATH_PATTERN.exec(req.url ?? '');

  if (!match) {
    res.writeHead(404).end();

    return;
  }

  if (!isAuthorized(req.headers.authorization, token)) {
    res.writeHead(401).end();

    return;
  }

  const hash = match[1];

  if (!HASH_PATTERN.test(hash)) {
    res.writeHead(400).end();

    return;
  }

  try {
    if (req.method === 'GET') {
      let body: Buffer | null;

      try {
        body = await backend.get(hash);
      } catch (error) {
        // A remote-cache read is best-effort: any retrieval fault (rate-limit,
        // network, a TOCTOU asset-delete, a transient backend error) must
        // degrade to a cache MISS so the build continues, never a 500. Log
        // server-side for visibility, then fall through to the 404 below.
        console.error(`cache GET ${hash} failed:`, error);
        res.writeHead(404).end();

        return;
      }

      if (!body) {
        res.writeHead(404).end();

        return;
      }

      res
        .writeHead(200, {
          'Content-Length': body.length,
          'Content-Type': 'application/octet-stream',
        })
        .end(body);

      return;
    }

    if (req.method === 'PUT') {
      if (!isWriteTrusted(process.env)) {
        res.writeHead(403).end();

        return;
      }

      const body = await readBody(req);
      const result = await backend.put(hash, body);

      if (result === 'conflict') {
        res.writeHead(409).end();
      } else if (result === 'forbidden') {
        res.writeHead(403).end();
      } else if (result === 'stored') {
        res.writeHead(200).end();
      } else {
        // Exhaustiveness guard: a future PutResult variant must be mapped
        // explicitly here. Without this, a new state would fall through to a
        // 200 and tell Nx a write succeeded when it didn't. `never` turns that
        // omission into a compile error.
        const unhandled: never = result;

        console.error(`cache PUT ${req.url}: unhandled put result`, unhandled);
        res.writeHead(500).end();
      }

      return;
    }

    // RFC 7231 requires an Allow header on 405; only GET/PUT are defined here.
    res.writeHead(405, { Allow: 'GET, PUT' }).end();
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      // Don't leave unread body bytes on the socket -- a keep-alive
      // connection would otherwise misparse the next request as more body.
      req.destroy();
      res.writeHead(413).end();

      return;
    }

    // Backends only throw for input validation (e.g. @actions/cache's
    // ValidationError); anything else is an unexpected backend fault.
    const status =
      error instanceof Error && error.name === 'ValidationError' ? 400 : 500;

    // Mirror the GET path's server-side logging: a systematic write fault (a
    // saveCache internal error, an fs/stream fault) must not be invisible just
    // because Nx treats a failed store as a non-fatal warning.
    console.error(`cache ${req.method} ${req.url} failed:`, error);
    res.writeHead(status).end();
  }
}
