import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  lookupSneakerSmart,
  verifyFirebaseBearerToken,
} from '../server/sneakerLookup.js';

interface VercelReq extends IncomingMessage {
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelRes extends ServerResponse {
  status?: (code: number) => VercelRes;
  json?: (data: unknown) => void;
}

function sendJson(res: VercelRes, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req: VercelReq): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    if (chunks.reduce((sum, b) => sum + b.length, 0) > 1024 * 1024) {
      break;
    }
  }
  if (chunks.length === 0) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    const rawAuth = req.headers.authorization;
    const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;
    await verifyFirebaseBearerToken(authHeader);

    const body = await readJsonBody(req);
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query.length < 2 || query.length > 120) {
      sendJson(res, 400, {
        error: 'Informe entre 2 e 120 caracteres para pesquisar o tênis.',
      });
      return;
    }

    const result = await lookupSneakerSmart(query);
    sendJson(res, 200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao pesquisar tênis.';
    const status = message.includes('Autenticação') || message.includes('Sessão') ? 401 : 500;
    sendJson(res, status, { error: message });
  }
}
