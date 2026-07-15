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
const MAX_BODY_BYTES = Number(
  process.env.MAX_CACHE_BODY_BYTES ?? 2 * 1024 * 1024 * 1024,
);

class PayloadTooLargeError extends Error {}

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
      const body = await backend.get(hash);

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
      } else {
        res.writeHead(200).end();
      }

      return;
    }

    // RFC 7231 requires an Allow header on 405; only GET/PUT are defined here.
    res.writeHead(405, { Allow: 'GET, PUT' }).end();
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      res.writeHead(413).end();

      return;
    }

    // Backends only throw for input validation (e.g. @actions/cache's
    // ValidationError); anything else is an unexpected backend fault.
    const status =
      error instanceof Error && error.name === 'ValidationError' ? 400 : 500;

    res.writeHead(status).end();
  }
}
