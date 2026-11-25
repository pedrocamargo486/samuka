import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  fetchSafeRemoteImage,
  verifyFirebaseBearerToken,
} from '../server/sneakerLookup';

interface VercelReq extends IncomingMessage {
  body?: { url?: string };
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
    const imageUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!imageUrl) {
      res.status(400).json({ error: 'URL da imagem obrigatória.' });
      return;
    }
    const payload = await fetchSafeRemoteImage(imageUrl);
    res.status(200).json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao importar imagem.';
    const status = message.includes('Autenticação') || message.includes('Sessão') ? 401 : 400;
    res.status(status).json({ error: message });
  }
}
