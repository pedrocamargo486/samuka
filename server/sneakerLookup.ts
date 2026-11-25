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
  sourceMode: 'live_catalog' | 'gemini_search';
  warning?: string;
}

// --- Live Public Brazilian Sneaker Catalog Search (100% Free, Zero Quota Limits) ---
interface VtexProductItem {
  images?: { imageUrl?: string }[];
  sellers?: {
    commertialOffer?: {
      Price?: number;
      ListPrice?: number;
      IsAvailable?: boolean;
    };
  }[];
  Cor?: string[];
}

interface VtexProduct {
  productId?: string;
  productName?: string;
  brand?: string;
  description?: string;
  link?: string;
  categories?: string[];
  Cor?: string[];
  Genero?: string[];
  Gênero?: string[];
  items?: VtexProductItem[];
}

const KNOWN_BRANDS = [
  'Nike',
  'Adidas',
  'New Balance',
  'Puma',
  'Mizuno',
  'Asics',
  'Olympikus',
  'Converse',
  'Vans',
  'Fila',
  'Reebok',
];

const EXCLUDED_ACCESSORY_TERMS = [
  'meia ',
  'meias ',
  'bone ',
  'boné ',
  'mochila',
  'bolsa ',
  'sacola',
  'camiseta',
  'camisa ',
  'shorts ',
  'bermuda',
  'calça ',
  'jaqueta',
  'moletom',
  'regata',
  'cadarço',
  'palmilha',
  'chinelo',
  'sandalia',
  'sandália',
];

const COLOR_DICTIONARY = [
  'Preto',
  'Branco',
  'Cinza',
  'Vermelho',
  'Azul',
  'Marinho',
  'Verde',
  'Bege',
  'Off-White',
  'Prata',
  'Dourado',
  'Rosa',
  'Roxo',
  'Laranja',
  'Amarelo',
  'Marrom',
  'Vinho',
];

function stripHtmlTags(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<\/(h[1-6]|p|li|div)>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();
}

function normalizeAscii(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeBrandName(rawBrand: string, productName: string): string {
  const combined = normalizeAscii(`${rawBrand} ${productName}`);
  for (const b of KNOWN_BRANDS) {
    if (combined.includes(normalizeAscii(b))) return b;
  }
  return rawBrand ? rawBrand.trim().slice(0, 40) : 'Nike';
}

function inferGender(rawText: string): SneakerLookupResult['gender'] {
  const n = normalizeAscii(rawText);
  if (n.includes('infantil') || n.includes('kids') || n.includes('junior') || n.includes('teen')) {
    return 'infantil';
  }
  if (n.includes('feminino') || n.includes('women')) return 'feminino';
  if (n.includes('masculino') || n.includes('men')) return 'masculino';
  return 'unissex';
}

function inferSneakerType(rawText: string): {
  type: SneakerLookupResult['type'];
  occasion: string;
} {
  const n = normalizeAscii(rawText);
  if (
    n.includes('corrida') ||
    n.includes('running') ||
    n.includes('maratona') ||
    n.includes('prophecy') ||
    n.includes('nimbus') ||
    n.includes('corre')
  ) {
    return { type: 'corrida', occasion: 'Corrida e Treino' };
  }
  if (n.includes('academia') || n.includes('treino') || n.includes('training') || n.includes('cross')) {
    return { type: 'academia', occasion: 'Academia e Treino' };
  }
  if (n.includes('trabalho') || n.includes('caminhada') || n.includes('confort')) {
    return { type: 'dia_a_dia', occasion: 'Dia a dia e Conforto' };
  }
  return { type: 'casual', occasion: 'Uso Urbano e Casual' };
}

function extractColorsFromText(rawText: string, explicitColors?: string[]): string[] {
  const found = new Set<string>();
  for (const c of explicitColors || []) {
    const clean = c.trim();
    if (clean && clean.length <= 28) found.add(clean);
  }
  const n = normalizeAscii(rawText);
  for (const color of COLOR_DICTIONARY) {
    if (n.includes(normalizeAscii(color))) {
      found.add(color);
    }
  }
  return Array.from(found).slice(0, 6);
}

async function queryVtexCatalog(
  storeName: string,
  baseUrl: string,
  query: string
): Promise<{ storeName: string; product: VtexProduct; score: number }[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const url = `${baseUrl}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(query)}&_from=0&_to=6`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);
    if (!res.ok && res.status !== 206) return [];

    const items = (await res.json()) as VtexProduct[];
    if (!Array.isArray(items)) return [];

    const queryTokens = normalizeAscii(query)
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    const wantsSlipper = queryTokens.some((t) => t === 'chinelo' || t === 'sandalia');

    const scored: { storeName: string; product: VtexProduct; score: number }[] = [];
    for (const p of items) {
      const nameNorm = normalizeAscii(`${p.productName || ''} ${p.brand || ''}`);
      if (!wantsSlipper && EXCLUDED_ACCESSORY_TERMS.some((term) => nameNorm.includes(normalizeAscii(term)))) {
        continue;
      }
      let score = 0;
      if (nameNorm.includes('tenis')) score += 3;
      for (const token of queryTokens) {
        if (nameNorm.includes(token)) score += 4;
      }
      if ((p.items?.[0]?.images?.length || 0) > 0) score += 2;
      if (p.description && p.description.length > 40) score += 1;
      scored.push({ storeName, product: p, score });
    }
    return scored.sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

async function searchBingSneakerImages(query: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(
      `tenis ${query}`
    )}&mkt=pt-BR`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const html = await res.text();
    const candidates = new Set<string>();
    const regex = /murl&quot;:&quot;(https:\/\/[^&"]+\.(?:jpg|jpeg|png|webp)[^&"]*)&quot;/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1];
      if (url && !url.includes('bing.com') && !url.includes('microsoft.com')) {
        candidates.add(url);
      }
      if (candidates.size >= 8) break;
    }

    const checks = await Promise.all(
      Array.from(candidates).map(async (url) => ({
        url,
        ok: await verifyReachableImage(url),
      }))
    );
    return checks.filter((c) => c.ok).map((c) => c.url).slice(0, 6);
  } catch {
    return [];
  }
}

export async function lookupSneakerFromLiveWebCatalogs(
  query: string
): Promise<SneakerLookupResult | null> {
  const norm = normalizeAscii(query);
  const catalogs: { storeName: string; baseUrl: string }[] = [
    { storeName: 'Artwalk', baseUrl: 'https://www.artwalk.com.br' },
    { storeName: 'Authentic Feet', baseUrl: 'https://www.authenticfeet.com.br' },
  ];

  if (norm.includes('olympikus')) {
    catalogs.unshift({ storeName: 'Olympikus Oficial', baseUrl: 'https://www.olympikus.com.br' });
  }
  if (norm.includes('mizuno')) {
    catalogs.unshift({ storeName: 'Mizuno Oficial', baseUrl: 'https://www.mizuno.com.br' });
  }
  if (norm.includes('asics')) {
    catalogs.unshift({ storeName: 'ASICS Oficial', baseUrl: 'https://www.asics.com.br' });
  }
  if (norm.includes('fila')) {
    catalogs.unshift({ storeName: 'Fila Oficial', baseUrl: 'https://www.fila.com.br' });
  }
  if (norm.includes('infantil') || norm.includes('kids') || norm.includes('junior')) {
    catalogs.unshift({ storeName: 'Magicfeet', baseUrl: 'https://www.magicfeet.com.br' });
  }

  const batchResults = await Promise.all(
    catalogs.map((c) => queryVtexCatalog(c.storeName, c.baseUrl, query))
  );
  let ranked = batchResults.flat().sort((a, b) => b.score - a.score);

  // If primary sneaker boutiques had nothing, check running/sports brand stores too
  if (ranked.length === 0) {
    const extraCatalogs = [
      { storeName: 'Olympikus Oficial', baseUrl: 'https://www.olympikus.com.br' },
      { storeName: 'Mizuno Oficial', baseUrl: 'https://www.mizuno.com.br' },
      { storeName: 'ASICS Oficial', baseUrl: 'https://www.asics.com.br' },
      { storeName: 'Fila Oficial', baseUrl: 'https://www.fila.com.br' },
    ];
    const extraResults = await Promise.all(
      extraCatalogs.map((c) => queryVtexCatalog(c.storeName, c.baseUrl, query))
    );
    ranked = extraResults.flat().sort((a, b) => b.score - a.score);
  }

  if (ranked.length === 0) {
    const fallbackImages = await searchBingSneakerImages(query);
    if (fallbackImages.length === 0) {
      return null;
    }
    const brandName = normalizeBrandName('', query);
    const inferred = inferSneakerType(query);
    return {
      name: query.trim().slice(0, 120),
      brandName,
      description: `${query.trim()} da marca ${brandName}, desenvolvido com foco em conforto, durabilidade e estilo no uso diário.`,
      details: 'Cabedal respirável · Entressola macia · Solado de borracha aderente',
      gender: inferGender(query),
      type: inferred.type,
      occasion: inferred.occasion,
      colors: extractColorsFromText(query),
      suggestedPrice: 0,
      imageUrls: fallbackImages,
      sources: [],
      sourceMode: 'live_catalog',
    };
  }

  const top = ranked[0].product;
  const rawName = (top.productName || query).trim();
  const brandName = normalizeBrandName(top.brand || '', rawName);
  const cleanDescription = stripHtmlTags(top.description || '')
    .replace(/^(características|descrição)\s*/i, '')
    .slice(0, 520);

  const imageSet = new Set<string>();
  for (const entry of ranked.slice(0, 2)) {
    for (const sku of entry.product.items || []) {
      for (const img of sku.images || []) {
        if (img.imageUrl && img.imageUrl.startsWith('https://')) {
          imageSet.add(img.imageUrl);
        }
        if (imageSet.size >= 8) break;
      }
      if (imageSet.size >= 8) break;
    }
  }

  if (imageSet.size < 2) {
    const extraImgs = await searchBingSneakerImages(rawName);
    extraImgs.forEach((u) => imageSet.add(u));
  }

  const firstOffer = top.items?.[0]?.sellers?.[0]?.commertialOffer;
  const rawPrice = firstOffer?.Price || firstOffer?.ListPrice || 0;
  const suggestedPrice =
    typeof rawPrice === 'number' && rawPrice > 0 && rawPrice < 50000
      ? Number(rawPrice.toFixed(2))
      : 0;

  const combinedText = `${rawName} ${(top.categories || []).join(' ')} ${cleanDescription}`;
  const inferredType = inferSneakerType(combinedText);
  const gender = inferGender(
    `${rawName} ${(top.categories || []).join(' ')} ${(top.Genero || top.Gênero || []).join(' ')}`
  );
  const colors = extractColorsFromText(
    `${rawName} ${cleanDescription}`,
    top.Cor || top.items?.[0]?.Cor
  );

  // Extract concise technical summary
  const detailSentences = cleanDescription
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 130)
    .slice(0, 3);
  const details =
    detailSentences.length > 0
      ? detailSentences.join(' · ')
      : 'Cabedal respirável e resistente · Amortecimento anatômico · Solado de borracha aderente';

  const sources: { title: string; uri: string }[] = [];
  for (const entry of ranked.slice(0, 3)) {
    if (entry.product.link && entry.product.link.startsWith('https://')) {
      sources.push({
        title: `${entry.storeName} — ${entry.product.productName || rawName}`,
        uri: entry.product.link,
      });
    }
  }

  return {
    name: rawName.slice(0, 120),
    brandName,
    description:
      cleanDescription ||
      `${rawName} com construção moderna, conforto prolongado e design assinado pela ${brandName}.`,
    details: details.slice(0, 1000),
    gender,
    type: inferredType.type,
    occasion: inferredType.occasion,
    colors,
    suggestedPrice,
    imageUrls: Array.from(imageSet).slice(0, 8),
    sources,
    sourceMode: 'live_catalog',
  };
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
}`;

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
    sourceMode: 'gemini_search',
  };
}

export async function lookupSneakerSmart(query: string): Promise<SneakerLookupResult> {
  // 1. Primary: 100% Free Live Brazilian Sneaker Catalogs & Bing Images (no AI quota cost)
  const liveResult = await lookupSneakerFromLiveWebCatalogs(query);
  if (liveResult && liveResult.imageUrls.length > 0) {
    return liveResult;
  }

  // 2. Fallback: Gemini Search Grounding (if live catalogs didn't return full results)
  if (process.env.GEMINI_API_KEY) {
    try {
      return await lookupSneakerWithGemini(query);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      if (liveResult) {
        return {
          ...liveResult,
          warning: isQuota
            ? 'Cota gratuita do Gemini excedida; exibindo os dados encontrados diretamente na web.'
            : undefined,
        };
      }
      if (isQuota) {
        throw new Error(
          'Nenhum resultado encontrado nas lojas brasileiras e a cota gratuita do Gemini (429) foi atingida. Verifique a chave em Settings > Secrets ou tente um termo mais específico (ex: Nike Shox TL).'
        );
      }
      throw err;
    }
  }

  if (liveResult) {
    return liveResult;
  }

  throw new Error(
    'Nenhum tênis correspondente foi encontrado na busca pública. Tente informar marca e modelo (ex: Nike Shox TL, Adidas Campus).'
  );
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
