import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  lookupSneakerWithGemini,
  verifyFirebaseBearerToken,
} from '../server/sneakerLookup';

interface VercelReq extends IncomingMessage {
  body?: { query?: string };
  headers: Record<string, string | undefined>;
}

interface VercelRes extends ServerResponse {
  status: (code: number) => VercelRes;
  json: (data: unknown) => void;
}

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await verifyFirebaseBearerToken(req.headers.authorization);
    const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    if (query.length < 2 || query.length > 120) {
      res.status(400).json({ error: 'Informe entre 2 e 120 caracteres para pesquisar o tênis.' });
      return;
    }
    const result = await lookupSneakerWithGemini(query);
    res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao pesquisar tênis.';
    const status = message.includes('Autenticação') || message.includes('Sessão') ? 401 : 500;
    res.status(status).json({ error: message });
  }
}
