import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
} from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import type { CacheBackend } from './types.js';
import { isWriteTrusted } from './trust.js';

// Nx hashes are lowercase hex (verified pv-1). Validated before the hash ever
// reaches a backend, temp-file path, or asset name -- closes a path-traversal
// risk that would otherwise exist at every one of those call sites.
const HASH_PATTERN = /^[a-f0-9]+$/;
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

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
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

      res.writeHead(200, { 'Content-Length': body.length }).end(body);

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

    res.writeHead(405).end();
  } catch (error) {
    // Backends only throw for input validation (e.g. @actions/cache's
    // ValidationError); anything else is an unexpected backend fault.
    const status =
      error instanceof Error && error.name === 'ValidationError' ? 400 : 500;

    res.writeHead(status).end();
  }
}
