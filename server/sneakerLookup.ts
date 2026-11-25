import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

interface FirebaseConfigSubset {
  projectId?: string;
}

function getFirebaseProjectId(): string {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as FirebaseConfigSubset;
    if (parsed.projectId) return parsed.projectId;
  } catch {
    // Fallback to env if file missing
  }
  return process.env.FIREBASE_PROJECT_ID || 'kempt-oven-6drm3';
}

// --- Google Public X509 Cert Cache for Firebase ID Token Verification ---
let cachedCerts: Record<string, string> = {};
let certsExpiry = 0;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (now < certsExpiry && Object.keys(cachedCerts).length > 0) {
    return cachedCerts;
  }
  const res = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!res.ok) {
    throw new Error('Falha ao obter certificados públicos de autenticação.');
  }
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = (await res.json()) as Record<string, string>;
  certsExpiry = now + maxAgeSec * 1000;
  return cachedCerts;
}

function base64UrlDecode(str: string): Buffer {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

export async function verifyFirebaseBearerToken(authHeader: string | undefined): Promise<{
  uid: string;
  email: string;
}> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Autenticação obrigatória.');
  }
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Token de autenticação inválido.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = JSON.parse(base64UrlDecode(headerB64).toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean;
  };

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Cabeçalho de token inválido.');
  }

  const projectId = getFirebaseProjectId();
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    payload.aud !== projectId ||
    payload.iss !== `https://securetoken.google.com/${projectId}` ||
    !payload.sub ||
    !payload.exp ||
    payload.exp <= nowSec ||
    payload.email_verified !== true ||
    !payload.email
  ) {
    throw new Error('Sessão administrativa inválida ou expirada.');
  }

  const certs = await getGooglePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error('Chave de verificação do token não encontrada.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  const signatureValid = verifier.verify(cert, base64UrlDecode(signatureB64));
  if (!signatureValid) {
    throw new Error('Assinatura do token inválida.');
  }

  return { uid: payload.sub, email: payload.email };
}

// --- SSRF Protection Helpers ---
function isPrivateOrBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
  if (lower.startsWith('::ffff:')) {
    const mappedV4 = lower.replace('::ffff:', '');
    if (net.isIPv4(mappedV4)) return isPrivateOrBlockedIp(mappedV4);
  }
  return false;
}

async function assertSafePublicHttpsUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('Apenas URLs HTTPS são permitidas.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new Error('Host não permitido.');
  }
  if (net.isIP(hostname)) {
    if (isPrivateOrBlockedIp(hostname)) {
      throw new Error('Endereço IP privado bloqueado.');
    }
    return parsed;
  }
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length || records.some((r) => isPrivateOrBlockedIp(r.address))) {
    throw new Error('Destino resolve para rede interna.');
  }
  return parsed;
}

async function extractOgImagesFromPage(pageUrl: string): Promise<string[]> {
  try {
    const safeUrl = await assertSafePublicHttpsUrl(pageUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(safeUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SamukaTenisCatalogBot/1.0)',
        Accept: 'text/html',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return [];

    const html = (await res.text()).slice(0, 220000);
    const found = new Set<string>();
    const metaRegex =
      /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
    const metaRegexAlt =
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["']/gi;

    let m: RegExpExecArray | null;
    while ((m = metaRegex.exec(html)) !== null) {
      if (m[1]?.startsWith('https://')) found.add(m[1]);
    }
    while ((m = metaRegexAlt.exec(html)) !== null) {
      if (m[1]?.startsWith('https://')) found.add(m[1]);
    }
    return Array.from(found).slice(0, 3);
  } catch {
    return [];
  }
}

async function verifyReachableImage(imageUrl: string): Promise<boolean> {
  try {
    const safeUrl = await assertSafePublicHttpsUrl(imageUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(safeUrl.toString(), {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    return ct.startsWith('image/');
  } catch {
    return false;
  }
}

export interface SneakerLookupResult {
  name: string;
  brandName: string;
  description: string;
  details: string;
  gender: 'masculino' | 'feminino' | 'infantil' | 'unissex';
  type: 'corrida' | 'academia' | 'casual' | 'dia_a_dia' | 'trabalho' | 'ocasioes_especiais';
  occasion: string;
  colors: string[];
  suggestedPrice: number;
  imageUrls: string[];
  sources: { title: string; uri: string }[];
}

export async function lookupSneakerWithGemini(query: string): Promise<SneakerLookupResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = `Você é um especialista em catálogos de calçados esportivos no Brasil.
Pesquise na web informações reais sobre o tênis: "${query}".

Retorne APENAS um objeto JSON válido (sem markdown, sem crases) com a seguinte estrutura exata:
{
  "name": "Nome oficial completo do modelo",
  "brandName": "Marca principal (ex: Nike, Adidas, New Balance, Puma, Mizuno, Asics, Olympikus, Converse, Vans, Fila, Reebok)",
  "description": "Descrição comercial clara e atraente em português do Brasil (2 a 3 frases sobre conforto, estilo e tecnologia do modelo).",
  "details": "Especificações técnicas resumidas em português separadas por ' · ' (ex: Cabedal em mesh e sintético · Amortecimento em colunas · Solado de borracha)",
  "gender": "masculino | feminino | infantil | unissex",
  "type": "corrida | academia | casual | dia_a_dia | trabalho | ocasioes_especiais",
  "occasion": "Ocasião de uso curta em português (ex: Corrida e Uso Urbano)",
  "colors": ["Lista", "de", "cores", "principais"],
  "suggestedPrice": 0,
  "candidateImageUrls": ["URLs diretas HTTPS de imagens do tênis encontradas se disponíveis"]
}

Regras:
- "gender" deve ser exatamente um de: masculino, feminino, infantil, unissex.
- "type" deve ser exatamente um de: corrida, academia, casual, dia_a_dia, trabalho, ocasioes_especiais.
- "suggestedPrice": número em reais (0 se não houver preço médio claro; nunca invente valores absurdos).
- "description" e "details" devem estar em português do Brasil natural e profissional.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const rawText = (response.text || '').trim();
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Não foi possível extrair os dados estruturados do tênis pesquisado.');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    name?: string;
    brandName?: string;
    description?: string;
    details?: string;
    gender?: string;
    type?: string;
    occasion?: string;
    colors?: string[];
    suggestedPrice?: number;
    candidateImageUrls?: string[];
  };

  // Extract grounding sources
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources: { title: string; uri: string }[] = [];
  for (const chunk of chunks) {
    if (chunk.web?.uri && chunk.web.uri.startsWith('https://')) {
      sources.push({
        title: chunk.web.title || 'Fonte externa',
        uri: chunk.web.uri,
      });
    }
  }

  // Extract real product images from grounding pages + candidate URLs
  const candidateImages = new Set<string>();
  for (const url of parsed.candidateImageUrls || []) {
    if (typeof url === 'string' && url.startsWith('https://')) {
      candidateImages.add(url);
    }
  }

  const pageImageResults = await Promise.all(
    sources.slice(0, 4).map((s) => extractOgImagesFromPage(s.uri))
  );
  pageImageResults.flat().forEach((imgUrl) => candidateImages.add(imgUrl));

  const candidateList = Array.from(candidateImages).slice(0, 8);
  const reachabilityChecks = await Promise.all(
    candidateList.map(async (url) => ({ url, ok: await verifyReachableImage(url) }))
  );
  const verifiedImages = reachabilityChecks.filter((r) => r.ok).map((r) => r.url);

  const validGenders = ['masculino', 'feminino', 'infantil', 'unissex'] as const;
  const validTypes = [
    'corrida',
    'academia',
    'casual',
    'dia_a_dia',
    'trabalho',
    'ocasioes_especiais',
  ] as const;

  const gender = validGenders.includes(parsed.gender as (typeof validGenders)[number])
    ? (parsed.gender as SneakerLookupResult['gender'])
    : 'unissex';

  const type = validTypes.includes(parsed.type as (typeof validTypes)[number])
    ? (parsed.type as SneakerLookupResult['type'])
    : 'casual';

  return {
    name: (parsed.name || query).slice(0, 120),
    brandName: (parsed.brandName || 'Nike').slice(0, 64),
    description: (parsed.description || '').slice(0, 2000),
    details: (parsed.details || '').slice(0, 1000),
    gender,
    type,
    occasion: (parsed.occasion || 'Dia a dia').slice(0, 80),
    colors: Array.isArray(parsed.colors)
      ? parsed.colors.map((c) => String(c).slice(0, 32)).slice(0, 8)
      : [],
    suggestedPrice:
      typeof parsed.suggestedPrice === 'number' && parsed.suggestedPrice > 0
        ? Number(parsed.suggestedPrice.toFixed(2))
        : 0,
    imageUrls: verifiedImages.slice(0, 6),
    sources: sources.slice(0, 5),
  };
}

export async function fetchSafeRemoteImage(imageUrl: string): Promise<{
  mimeType: string;
  base64Data: string;
}> {
  const safeUrl = await assertSafePublicHttpsUrl(imageUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const res = await fetch(safeUrl.toString(), {
    signal: controller.signal,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  clearTimeout(timeout);
  if (!res.ok) {
    throw new Error('Não foi possível baixar a imagem externa.');
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase().split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('Formato de imagem não suportado (use JPG, PNG ou WebP).');
  }
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > 2 * 1024 * 1024) {
    throw new Error('Imagem externa excede o limite de 2MB.');
  }
  return {
    mimeType: contentType,
    base64Data: Buffer.from(arrayBuffer).toString('base64'),
  };
}
