import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  fetchSafeRemoteImage,
  lookupSneakerWithGemini,
  verifyFirebaseBearerToken,
} from './server/sneakerLookup';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/sneaker-lookup', async (req, res) => {
    try {
      await verifyFirebaseBearerToken(req.headers.authorization);
      const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
      if (query.length < 2 || query.length > 120) {
        res.status(400).json({ error: 'Informe entre 2 e 120 caracteres para pesquisar o tênis.' });
        return;
      }
      const result = await lookupSneakerWithGemini(query);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao pesquisar tênis.';
      const status = message.includes('Autenticação') || message.includes('Sessão') ? 401 : 500;
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/fetch-image', async (req, res) => {
    try {
      await verifyFirebaseBearerToken(req.headers.authorization);
      const imageUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      if (!imageUrl) {
        res.status(400).json({ error: 'URL da imagem obrigatória.' });
        return;
      }
      const imagePayload = await fetchSafeRemoteImage(imageUrl);
      res.json(imagePayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao importar imagem.';
      const status = message.includes('Autenticação') || message.includes('Sessão') ? 401 : 400;
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`SAMUKA TÊNIS server running on port ${port}`);
  });
}

void startServer();
