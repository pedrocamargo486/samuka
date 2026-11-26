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
    const timeout = setTimeout(() => controller.abort(), 2000);
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
    const commonHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
    };

    const headController = new AbortController();
    const headTimeout = setTimeout(() => headController.abort(), 1800);
    try {
      const headRes = await fetch(safeUrl.toString(), {
        method: 'HEAD',
        signal: headController.signal,
        headers: commonHeaders,
      });
      clearTimeout(headTimeout);
      const ct = (headRes.headers.get('content-type') || '').toLowerCase();
      if (headRes.ok && ct.startsWith('image/') && !ct.includes('svg')) {
        return true;
      }
      // Some CDNs block HEAD (403/405/400) or omit content-type on HEAD: fallback to tiny ranged GET
      if (headRes.ok && !ct) {
        return /\.(jpe?g|png|webp|avif)(\?|$)/i.test(safeUrl.pathname + safeUrl.search);
      }
    } catch {
      clearTimeout(headTimeout);
    }

    const getController = new AbortController();
    const getTimeout = setTimeout(() => getController.abort(), 2200);
    try {
      const getRes = await fetch(safeUrl.toString(), {
        method: 'GET',
        signal: getController.signal,
        headers: {
          ...commonHeaders,
          Range: 'bytes=0-1024',
        },
      });
      clearTimeout(getTimeout);
      const ct = (getRes.headers.get('content-type') || '').toLowerCase();
      getController.abort();
      return getRes.ok && ct.startsWith('image/') && !ct.includes('svg');
    } catch {
      clearTimeout(getTimeout);
      return false;
    }
  } catch {
    return false;
  }
}

export interface SneakerVideoSuggestion {
  title: string;
  url: string;
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
  videoUrls: string[];
  videos: SneakerVideoSuggestion[];
  sources: { title: string; uri: string }[];
  sourceMode: 'live_catalog' | 'gemini_search';
  warning?: string;
}

// --- Live Public Brazilian Sneaker Catalog Search (100% Free, Zero Quota Limits) ---
interface VtexProductItem {
  name?: string;
  nameComplete?: string;
  complementName?: string;
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

const MODEL_BRAND_HINTS: { pattern: RegExp; brand: string }[] = [
  { pattern: /\b(9060|550|530|327|574|1906r?|2002r|990|991|992|993|480)\b/i, brand: 'New Balance' },
  { pattern: /\b(shox|air\s*max|air\s*force|af1|dunk|jordan|vapormax|pegasus|cortez|blazer|dn8|air\s*tn|tn\s*plus)\b/i, brand: 'Nike' },
  { pattern: /\b(campus|samba|gazelle|ultraboost|superstar|stan\s*smith|forum|adizero|spezial|sl\s*72)\b/i, brand: 'Adidas' },
  { pattern: /\b(palermo|suede|rs-x|rsx|clyde|velophasis|180)\b/i, brand: 'Puma' },
  { pattern: /\b(prophecy|wave|creation|sky\s*medal)\b/i, brand: 'Mizuno' },
  { pattern: /\b(gel-?kayano|gel-?nimbus|gel-?1130|gel-?nyc|quantum)\b/i, brand: 'Asics' },
  { pattern: /\b(corre\s*[1-5]|grafeno|challenger)\b/i, brand: 'Olympikus' },
  { pattern: /\b(old\s*skool|knu\s*skool|sk8-?hi|ultrarange)\b/i, brand: 'Vans' },
  { pattern: /\b(all\s*star|chuck\s*taylor|run\s*star)\b/i, brand: 'Converse' },
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

const COLOR_ALIASES: Record<string, string[]> = {
  azul: [
    'azul',
    'blue',
    'navy',
    'marinho',
    'royal',
    'cobalt',
    'indigo',
    'cyan',
    'sky',
    'turquesa',
    'slate',
    'glacier',
    'mineral',
    'celeste',
    'ice',
    'denim',
    'ocean',
  ],
  preto: ['preto', 'preta', 'black', 'noir', 'obsidian', 'phantom', 'onyx', 'carbon', 'dark'],
  branco: ['branco', 'branca', 'white', 'off-white', 'off white', 'sail', 'chalk', 'ivory', 'alabaster'],
  vermelho: [
    'vermelho',
    'vermelha',
    'red',
    'crimson',
    'bred',
    'chicago',
    'scarlet',
    'chili',
    'bordo',
    'burgundy',
    'vinho',
    'wine',
  ],
  bege: ['bege', 'beige', 'sand', 'khaki', 'tan', 'oatmeal', 'driftwood', 'taupe', 'linen', 'areia', 'cream', 'creme'],
  verde: ['verde', 'green', 'olive', 'mint', 'sage', 'emerald', 'forest', 'pine', 'musgo', 'militar', 'lime'],
  cinza: ['cinza', 'grey', 'gray', 'silver', 'prata', 'graphite', 'chumbo', 'ash', 'castlerock', 'rain cloud'],
  rosa: ['rosa', 'pink', 'rose', 'magenta', 'blush', 'salmao'],
  roxo: ['roxo', 'roxa', 'purple', 'lilac', 'lilas', 'violet', 'violeta', 'lavender'],
  amarelo: ['amarelo', 'amarela', 'yellow', 'gold', 'dourado', 'volt', 'mustard', 'mostarda'],
  laranja: ['laranja', 'orange', 'tangerine', 'coral', 'peach'],
  marrom: ['marrom', 'brown', 'mocha', 'chocolate', 'espresso', 'gum', 'caramelo'],
};

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

function enrichSneakerQuery(rawQuery: string): {
  enrichedQuery: string;
  inferredBrand: string | null;
  requestedColorGroups: string[];
  colorTokens: Set<string>;
} {
  const clean = rawQuery.trim();
  const norm = normalizeAscii(clean);

  let hasExplicitBrand = false;
  let inferredBrand: string | null = null;
  for (const b of KNOWN_BRANDS) {
    if (norm.includes(normalizeAscii(b))) {
      hasExplicitBrand = true;
      inferredBrand = b;
      break;
    }
  }

  if (!hasExplicitBrand) {
    for (const hint of MODEL_BRAND_HINTS) {
      if (hint.pattern.test(norm)) {
        inferredBrand = hint.brand;
        break;
      }
    }
  }

  const requestedColorGroups: string[] = [];
  const colorTokens = new Set<string>();
  const words = norm.split(/\s+/).filter(Boolean);

  for (const [canonical, aliases] of Object.entries(COLOR_ALIASES)) {
    for (const alias of aliases) {
      if (words.includes(alias) || (alias.includes(' ') && norm.includes(alias))) {
        if (!requestedColorGroups.includes(canonical)) {
          requestedColorGroups.push(canonical);
        }
        colorTokens.add(alias);
      }
    }
  }

  const withoutLeadingTenis = clean.replace(/^t[eê]nis\s+/i, '').trim();
  const enrichedQuery =
    !hasExplicitBrand && inferredBrand
      ? `${inferredBrand} ${withoutLeadingTenis}`
      : withoutLeadingTenis || clean;

  return {
    enrichedQuery,
    inferredBrand,
    requestedColorGroups,
    colorTokens,
  };
}

function textMatchesColorGroup(text: string, colorGroup: string): boolean {
  const norm = normalizeAscii(text);
  const aliases = COLOR_ALIASES[colorGroup] || [colorGroup];
  return aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(norm);
  });
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

interface ScoredVtexMatch {
  storeName: string;
  product: VtexProduct;
  matchedSku?: VtexProductItem;
  score: number;
  colorMatched: boolean;
  modelMatched: boolean;
}

async function queryVtexCatalog(
  storeName: string,
  baseUrl: string,
  searchTerm: string,
  requestedColorGroups: string[],
  colorTokens: Set<string>
): Promise<ScoredVtexMatch[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const url = `${baseUrl}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(
      searchTerm
    )}&_from=0&_to=15`;
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

    const allTokens = normalizeAscii(searchTerm)
      .split(/\s+/)
      .filter((t) => t.length >= 2 && t !== 'tenis');
    const nonColorTokens = allTokens.filter((t) => !colorTokens.has(t));
    const wantsSlipper = allTokens.some((t) => t === 'chinelo' || t === 'sandalia');

    const scored: ScoredVtexMatch[] = [];
    for (const p of items) {
      const nameNorm = normalizeAscii(`${p.productName || ''} ${p.brand || ''}`);
      if (
        !wantsSlipper &&
        EXCLUDED_ACCESSORY_TERMS.some((term) => nameNorm.includes(normalizeAscii(term)))
      ) {
        continue;
      }

      const modelMatched =
        nonColorTokens.length === 0 ||
        nonColorTokens.every((token) => nameNorm.includes(token));
      if (!modelMatched) continue;

      let bestSku: VtexProductItem | undefined = p.items?.[0];
      let colorMatched = requestedColorGroups.length === 0;
      let primaryColorBonus = 0;

      if (requestedColorGroups.length > 0) {
        // Check individual SKUs first for an exact colorway match
        for (const sku of p.items || []) {
          const skuColorRaw = (sku.Cor || p.Cor || [])[0] || '';
          const primaryColorOnly = skuColorRaw.split('/')[0] || '';
          const skuText = `${p.productName || ''} ${sku.name || ''} ${sku.nameComplete || ''} ${
            sku.complementName || ''
          } ${(sku.Cor || []).join(' ')} ${(p.Cor || []).join(' ')}`;

          if (requestedColorGroups.every((cg) => textMatchesColorGroup(primaryColorOnly, cg))) {
            bestSku = sku;
            colorMatched = true;
            primaryColorBonus = 15;
            break;
          }
          if (requestedColorGroups.every((cg) => textMatchesColorGroup(skuText, cg))) {
            bestSku = sku;
            colorMatched = true;
          }
        }
        if (!colorMatched) {
          const prodPrimary = ((p.Cor || [])[0] || '').split('/')[0] || '';
          if (requestedColorGroups.every((cg) => textMatchesColorGroup(prodPrimary, cg))) {
            colorMatched = true;
            primaryColorBonus = 15;
          } else {
            const prodText = `${p.productName || ''} ${(p.Cor || []).join(' ')} ${stripHtmlTags(
              p.description || ''
            ).slice(0, 220)}`;
            colorMatched = requestedColorGroups.every((cg) => textMatchesColorGroup(prodText, cg));
          }
        }
      }

      let score = 0;
      if (nameNorm.includes('tenis')) score += 3;
      for (const token of nonColorTokens) {
        if (nameNorm.includes(token)) score += 6;
      }
      if (colorMatched && requestedColorGroups.length > 0) score += 20 + primaryColorBonus;
      if (!colorMatched && requestedColorGroups.length > 0) score -= 12;
      if ((bestSku?.images?.length || 0) > 0) score += 2;
      if (p.description && p.description.length > 40) score += 1;

      scored.push({
        storeName,
        product: p,
        matchedSku: bestSku,
        score,
        colorMatched,
        modelMatched,
      });
    }
    return scored.sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

async function searchBingSneakerImages(query: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);
    const searchUrl = `https://www.bing.com/images/async?q=${encodeURIComponent(
      `tenis ${query}`
    )}&first=1&count=15&mkt=pt-BR`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const html = await res.text();
    const candidates = new Set<string>();
    const regex = /murl&quot;:&quot;(https:\/\/[^&"]+)&quot;/gi;
    const blockedDomains = [
      'bing.com',
      'microsoft.com',
      'shutterstock.com',
      'istockphoto.com',
      'alamy.com',
      'dreamstime.com',
      '123rf.com',
      'vecteezy.com',
    ];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1]?.replace(/\\u002f/gi, '/');
      if (!url || !url.startsWith('https://')) continue;
      if (/\.svg(\?|$)/i.test(url)) continue;
      if (blockedDomains.some((d) => url.toLowerCase().includes(d))) continue;
      candidates.add(url);
      if (candidates.size >= 18) break;
    }

    const checks = await Promise.all(
      Array.from(candidates).map(async (url) => ({
        url,
        ok: await verifyReachableImage(url),
      }))
    );
    return checks.filter((c) => c.ok).map((c) => c.url).slice(0, 12);
  } catch {
    return [];
  }
}

export async function searchYouTubeSneakerVideos(query: string): Promise<SneakerVideoSuggestion[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2600);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      `tenis ${query} review`
    )}&hl=pt&gl=BR`;
    const res = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const html = await res.text();
    const found: SneakerVideoSuggestion[] = [];
    const seenIds = new Set<string>();

    const richRegex =
      /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})"[\s\S]{0,800}?"title":\{"runs":\[\{"text":"([^"\\]*(?:\\.[^"\\]*)*)"\}/g;
    let m: RegExpExecArray | null;
    while ((m = richRegex.exec(html)) !== null) {
      const id = m[1];
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      const rawTitle = m[2]
        .replace(/\\"/g, '"')
        .replace(/\\u0026/gi, '&')
        .replace(/\\n/g, ' ')
        .trim();
      found.push({
        title: rawTitle.slice(0, 100) || `Vídeo ${query}`,
        url: `https://www.youtube.com/watch?v=${id}`,
      });
      if (found.length >= 4) break;
    }

    if (found.length === 0) {
      const idRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      while ((m = idRegex.exec(html)) !== null) {
        const id = m[1];
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        found.push({
          title: `Review ${query}`,
          url: `https://www.youtube.com/watch?v=${id}`,
        });
        if (found.length >= 4) break;
      }
    }

    return found;
  } catch {
    return [];
  }
}

function extractSafeVideoUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return '';
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtu.be' ||
      host === 'vimeo.com'
    ) {
      return parsed.toString().slice(0, 300);
    }
    return '';
  } catch {
    return '';
  }
}

export async function lookupSneakerFromLiveWebCatalogs(
  query: string,
  prefetchedVideos?: SneakerVideoSuggestion[]
): Promise<{
  result: SneakerLookupResult | null;
  hasExactColorMatch: boolean;
  baseMetadata?: {
    name: string;
    brandName: string;
    description: string;
    details: string;
    gender: SneakerLookupResult['gender'];
    type: SneakerLookupResult['type'];
    occasion: string;
    suggestedPrice: number;
    sources: { title: string; uri: string }[];
  };
}> {
  const { enrichedQuery, inferredBrand, requestedColorGroups, colorTokens } =
    enrichSneakerQuery(query);
  const norm = normalizeAscii(enrichedQuery);

  const catalogs: { storeName: string; baseUrl: string }[] = [
    { storeName: 'Artwalk', baseUrl: 'https://www.artwalk.com.br' },
    { storeName: 'Authentic Feet', baseUrl: 'https://www.authenticfeet.com.br' },
  ];

  if (inferredBrand === 'New Balance' || norm.includes('new balance')) {
    catalogs.unshift({ storeName: 'New Balance Brasil', baseUrl: 'https://www.newbalance.com.br' });
  }
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

  const modelOnlyQuery = normalizeAscii(enrichedQuery)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !colorTokens.has(t))
    .join(' ');

  // Query VTEX with enriched query; if color requested, also query model-only in parallel so all color SKUs are inspected
  const queriesToRun =
    requestedColorGroups.length > 0 && modelOnlyQuery.length >= 2 && modelOnlyQuery !== normalizeAscii(enrichedQuery)
      ? catalogs.flatMap((c) => [
          queryVtexCatalog(c.storeName, c.baseUrl, enrichedQuery, requestedColorGroups, colorTokens),
          queryVtexCatalog(c.storeName, c.baseUrl, modelOnlyQuery, requestedColorGroups, colorTokens),
        ])
      : catalogs.map((c) =>
          queryVtexCatalog(c.storeName, c.baseUrl, enrichedQuery, requestedColorGroups, colorTokens)
        );

  const batchResults = await Promise.all(queriesToRun);
  const ranked = batchResults.flat().sort((a, b) => b.score - a.score);

  // Require primary-color match (score >= 30) OR mix with Bing colorway images when VTEX only had secondary accent
  const colorMatchedEntries = ranked.filter((r) => r.colorMatched);
  const hasStrongPrimaryColorMatch =
    requestedColorGroups.length === 0
      ? ranked.length > 0
      : ranked.some((r) => r.colorMatched && r.score >= 30);
  const hasExactColorMatch =
    requestedColorGroups.length === 0 ? ranked.length > 0 : colorMatchedEntries.length > 0;

  const videos = prefetchedVideos ?? (await searchYouTubeSneakerVideos(enrichedQuery));
  const videoUrls = videos.map((v) => v.url);

  // Case 1: Found VTEX product matching model + requested color
  if (hasExactColorMatch && (colorMatchedEntries[0] || ranked[0])) {
    const primary = colorMatchedEntries[0] || ranked[0];
    const top = primary.product;
    const baseRawName = (top.productName || enrichedQuery).trim();
    const colorSuffix =
      requestedColorGroups.length > 0 && !requestedColorGroups.some((cg) => textMatchesColorGroup(baseRawName, cg))
        ? ` ${requestedColorGroups[0].charAt(0).toUpperCase() + requestedColorGroups[0].slice(1)}`
        : '';
    const rawName = `${baseRawName}${colorSuffix}`.trim();
    const brandName = normalizeBrandName(top.brand || '', rawName);
    const cleanDescription = stripHtmlTags(top.description || '')
      .replace(/^(características|descrição)\s*/i, '')
      .slice(0, 520);

    const imageSet = new Set<string>();
    if (!hasStrongPrimaryColorMatch) {
      const bingColorImgs = await searchBingSneakerImages(enrichedQuery);
      bingColorImgs.forEach((u) => imageSet.add(u));
    }

    const activeEntries = (colorMatchedEntries.length > 0 ? colorMatchedEntries : ranked).slice(
      0,
      2
    );
    for (const entry of activeEntries) {
      const preferredSku = entry.matchedSku;
      const skuList = preferredSku ? [preferredSku, ...(entry.product.items || [])] : entry.product.items || [];
      for (const sku of skuList) {
        for (const img of sku.images || []) {
          if (img.imageUrl && img.imageUrl.startsWith('https://')) {
            imageSet.add(img.imageUrl);
          }
          if (imageSet.size >= 15) break;
        }
        if (imageSet.size >= 15) break;
      }
    }

    if (imageSet.size < 4 && hasStrongPrimaryColorMatch) {
      const extraImgs = await searchBingSneakerImages(enrichedQuery);
      extraImgs.forEach((u) => imageSet.add(u));
    }

    const firstOffer = (primary.matchedSku || top.items?.[0])?.sellers?.[0]?.commertialOffer;
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
      `${enrichedQuery} ${rawName} ${cleanDescription}`,
      top.Cor || primary.matchedSku?.Cor
    );

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
    for (const entry of activeEntries.slice(0, 3)) {
      if (entry.product.link && entry.product.link.startsWith('https://')) {
        sources.push({
          title: `${entry.storeName} — ${entry.product.productName || rawName}`,
          uri: entry.product.link,
        });
      }
    }

    return {
      hasExactColorMatch: true,
      result: {
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
        imageUrls: Array.from(imageSet).slice(0, 15),
        videoUrls,
        videos,
        sources,
        sourceMode: 'live_catalog',
      },
    };
  }

  // Case 2: User requested a specific color (e.g. "9060 azul") and VTEX only had another color (e.g. beige),
  // OR VTEX returned nothing. Extract base model metadata from VTEX (never wrong-color photos!) and search Bing for exact colorway.
  let baseMetadata:
    | {
        name: string;
        brandName: string;
        description: string;
        details: string;
        gender: SneakerLookupResult['gender'];
        type: SneakerLookupResult['type'];
        occasion: string;
        suggestedPrice: number;
        sources: { title: string; uri: string }[];
      }
    | undefined;

  if (ranked[0]) {
    const baseProd = ranked[0].product;
    const baseBrand = normalizeBrandName(baseProd.brand || '', baseProd.productName || enrichedQuery);
    const cleanDesc = stripHtmlTags(baseProd.description || '')
      .replace(/^(características|descrição)\s*/i, '')
      .slice(0, 520);
    const detailSentences = cleanDesc
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15 && s.length < 130)
      .slice(0, 3);
    const firstOffer = baseProd.items?.[0]?.sellers?.[0]?.commertialOffer;
    const rawPrice = firstOffer?.Price || firstOffer?.ListPrice || 0;
    const combined = `${baseProd.productName || ''} ${(baseProd.categories || []).join(' ')} ${cleanDesc}`;
    const infType = inferSneakerType(combined);

    const colorLabel = requestedColorGroups
      .map((cg) => cg.charAt(0).toUpperCase() + cg.slice(1))
      .join(' / ');
    const baseNameClean = (baseProd.productName || enrichedQuery).trim();
    const formattedName =
      colorLabel && !textMatchesColorGroup(baseNameClean, requestedColorGroups[0])
        ? `${baseNameClean.replace(/\b(bege|preto|branco|cinza|azul|vermelho|verde|rosa)\b/gi, '').trim()} ${colorLabel}`.replace(/\s+/g, ' ')
        : enrichedQuery;

    baseMetadata = {
      name: formattedName.slice(0, 120),
      brandName: baseBrand,
      description: cleanDesc,
      details:
        detailSentences.length > 0
          ? detailSentences.join(' · ')
          : 'Cabedal respirável e resistente · Amortecimento anatômico · Solado de borracha aderente',
      gender: inferGender(`${enrichedQuery} ${(baseProd.categories || []).join(' ')}`),
      type: infType.type,
      occasion: infType.occasion,
      suggestedPrice:
        typeof rawPrice === 'number' && rawPrice > 0 && rawPrice < 50000
          ? Number(rawPrice.toFixed(2))
          : 0,
      sources: [],
    };
  }

  const colorwayImages = await searchBingSneakerImages(enrichedQuery);
  if (colorwayImages.length === 0) {
    return {
      result: null,
      hasExactColorMatch: false,
      baseMetadata,
    };
  }

  const brandName =
    baseMetadata?.brandName || normalizeBrandName('', enrichedQuery);
  const inferred = inferSneakerType(enrichedQuery);
  const displayName =
    baseMetadata?.name ||
    enrichedQuery
      .split(/\s+/)
      .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');

  return {
    hasExactColorMatch: true,
    baseMetadata,
    result: {
      name: displayName.slice(0, 120),
      brandName,
      description:
        baseMetadata?.description ||
        `${displayName} da marca ${brandName}, desenvolvido com foco em conforto, durabilidade e estilo marcante.`,
      details:
        baseMetadata?.details ||
        'Cabedal respirável em mesh e camurça · Entressola com amortecimento · Solado de borracha aderente',
      gender: baseMetadata?.gender || inferGender(enrichedQuery),
      type: baseMetadata?.type || inferred.type,
      occasion: baseMetadata?.occasion || inferred.occasion,
      colors: extractColorsFromText(enrichedQuery),
      suggestedPrice: baseMetadata?.suggestedPrice || 0,
      imageUrls: colorwayImages,
      videoUrls,
      videos,
      sources: [],
      sourceMode: 'live_catalog',
    },
  };
}

export async function lookupSneakerWithGemini(
  query: string,
  prefetchedVideos?: SneakerVideoSuggestion[]
): Promise<SneakerLookupResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada no servidor.');
  }

  const { enrichedQuery } = enrichSneakerQuery(query);
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const prompt = `Você é um especialista em catálogos de calçados esportivos no Brasil.
Pesquise na web informações reais sobre o tênis na colorway/cor solicitada: "${enrichedQuery}" (busca original: "${query}").
Se o usuário especificou uma cor (ex: azul, preto, vermelho, bege, verde), retorne especificamente os dados, cores e links de fotos dessa variação de cor exata, nunca de outra cor aleatória.

Retorne APENAS um objeto JSON válido (sem markdown, sem crases) com a seguinte estrutura exata:
{
  "name": "Nome oficial completo do modelo com a cor/colorway quando aplicável",
  "brandName": "Marca principal (ex: Nike, Adidas, New Balance, Puma, Mizuno, Asics, Olympikus, Converse, Vans, Fila, Reebok)",
  "description": "Descrição comercial clara e atraente em português do Brasil (2 a 3 frases sobre conforto, estilo e tecnologia do modelo).",
  "details": "Especificações técnicas resumidas em português separadas por ' · ' (ex: Cabedal em mesh e camurça · Entressola com amortecimento · Solado de borracha)",
  "gender": "masculino | feminino | infantil | unissex",
  "type": "corrida | academia | casual | dia_a_dia | trabalho | ocasioes_especiais",
  "occasion": "Ocasião de uso curta em português (ex: Uso Urbano e Casual)",
  "colors": ["Lista", "de", "cores", "da", "variante"],
  "suggestedPrice": 0,
  "candidateImageUrls": ["URLs diretas HTTPS de imagens dessa cor específica do tênis se disponíveis"],
  "candidateVideoUrls": ["URLs diretas HTTPS de vídeos/reviews do YouTube desse modelo se encontrados"]
}`;

  const [response, bingFallbackImages, videos] = await Promise.all([
    ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    }),
    searchBingSneakerImages(enrichedQuery),
    prefetchedVideos ? Promise.resolve(prefetchedVideos) : searchYouTubeSneakerVideos(enrichedQuery),
  ]);

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
    candidateVideoUrls?: string[];
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
    sources.slice(0, 3).map((s) => extractOgImagesFromPage(s.uri))
  );
  pageImageResults.flat().forEach((imgUrl) => candidateImages.add(imgUrl));

  const candidateList = Array.from(candidateImages).slice(0, 12);
  const reachabilityChecks = await Promise.all(
    candidateList.map(async (url) => ({ url, ok: await verifyReachableImage(url) }))
  );
  const verifiedGeminiImages = reachabilityChecks.filter((r) => r.ok).map((r) => r.url);

  const mergedImages = Array.from(new Set([...verifiedGeminiImages, ...bingFallbackImages])).slice(
    0,
    15
  );

  const videoMap = new Map<string, SneakerVideoSuggestion>();
  for (const v of videos) {
    videoMap.set(v.url, v);
  }
  for (const rawVid of parsed.candidateVideoUrls || []) {
    if (typeof rawVid !== 'string') continue;
    const safeVid = extractSafeVideoUrl(rawVid);
    if (safeVid && !videoMap.has(safeVid)) {
      videoMap.set(safeVid, {
        title: `${parsed.name || enrichedQuery} — Vídeo`,
        url: safeVid,
      });
    }
  }
  const mergedVideos = Array.from(videoMap.values()).slice(0, 4);

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

  const extractedColors =
    Array.isArray(parsed.colors) && parsed.colors.length > 0
      ? parsed.colors.map((c) => String(c).slice(0, 32)).slice(0, 8)
      : extractColorsFromText(enrichedQuery);

  return {
    name: (parsed.name || enrichedQuery).slice(0, 120),
    brandName: (parsed.brandName || normalizeBrandName('', enrichedQuery)).slice(0, 64),
    description: (parsed.description || '').slice(0, 2000),
    details: (parsed.details || '').slice(0, 1000),
    gender,
    type,
    occasion: (parsed.occasion || 'Uso Urbano e Casual').slice(0, 80),
    colors: extractedColors,
    suggestedPrice:
      typeof parsed.suggestedPrice === 'number' && parsed.suggestedPrice > 0
        ? Number(parsed.suggestedPrice.toFixed(2))
        : 0,
    imageUrls: mergedImages,
    videoUrls: mergedVideos.map((v) => v.url),
    videos: mergedVideos,
    sources: sources.slice(0, 5),
    sourceMode: 'gemini_search',
  };
}

export async function lookupSneakerSmart(query: string): Promise<SneakerLookupResult> {
  const { enrichedQuery, requestedColorGroups } = enrichSneakerQuery(query);

  // Run YouTube video search in parallel from the start so video discovery adds near-zero latency
  const videoPromise = searchYouTubeSneakerVideos(enrichedQuery);

  const [videos, liveLookup] = await Promise.all([
    videoPromise,
    lookupSneakerFromLiveWebCatalogs(query, []),
  ]);

  const liveResult = liveLookup.result
    ? {
        ...liveLookup.result,
        videos: liveLookup.result.videos.length > 0 ? liveLookup.result.videos : videos,
        videoUrls:
          liveLookup.result.videoUrls.length > 0
            ? liveLookup.result.videoUrls
            : videos.map((v) => v.url),
      }
    : null;

  // If live Brazilian catalogs found exact model + color photos, return fast without burning AI quota
  if (liveResult && liveLookup.hasExactColorMatch && liveResult.imageUrls.length >= 2) {
    return liveResult;
  }

  // Otherwise use Gemini Search Grounding (if configured) enriched with live catalog & Bing/YouTube results
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiResult = await lookupSneakerWithGemini(query, videos);
      const combinedImages = Array.from(
        new Set([...(geminiResult.imageUrls || []), ...(liveResult?.imageUrls || [])])
      ).slice(0, 15);

      return {
        ...geminiResult,
        description: geminiResult.description || liveResult?.description || '',
        details: geminiResult.details || liveResult?.details || '',
        suggestedPrice:
          geminiResult.suggestedPrice > 0
            ? geminiResult.suggestedPrice
            : liveResult?.suggestedPrice || liveLookup.baseMetadata?.suggestedPrice || 0,
        imageUrls: combinedImages,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      if (liveResult && liveResult.imageUrls.length > 0) {
        return {
          ...liveResult,
          warning: isQuota
            ? 'Cota do Gemini excedida; exibindo fotos e vídeos encontrados diretamente na web.'
            : undefined,
        };
      }
      if (isQuota) {
        throw new Error(
          'Nenhum resultado encontrado para essa cor nas lojas brasileiras e a cota do Gemini (429) foi atingida. Tente incluir marca e cor (ex: New Balance 9060 Azul).'
        );
      }
      if (liveResult) return liveResult;
      throw err;
    }
  }

  if (liveResult && (liveResult.imageUrls.length > 0 || liveResult.videoUrls.length > 0)) {
    return liveResult;
  }

  if (requestedColorGroups.length > 0 && liveLookup.baseMetadata) {
    return {
      ...liveLookup.baseMetadata,
      colors: extractColorsFromText(enrichedQuery),
      imageUrls: [],
      videoUrls: videos.map((v) => v.url),
      videos,
      sourceMode: 'live_catalog',
      warning:
        'Encontramos o modelo e vídeos, mas nenhuma foto direta dessa cor específica pôde ser importada automaticamente. Você pode enviar ou colar o link da foto abaixo.',
    };
  }

  throw new Error(
    'Nenhum tênis correspondente foi encontrado na busca pública. Tente informar marca, modelo e cor (ex: New Balance 9060 Azul, Nike Shox TL Preto).'
  );
}

export async function fetchSafeRemoteImage(imageUrl: string): Promise<{
  mimeType: string;
  base64Data: string;
}> {
  const safeUrl = await assertSafePublicHttpsUrl(imageUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);
  const res = await fetch(safeUrl.toString(), {
    signal: controller.signal,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      Referer: 'https://www.google.com/',
    },
  });
  clearTimeout(timeout);
  if (!res.ok) {
    throw new Error('Não foi possível baixar a imagem externa.');
  }
  const rawCt = (res.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
  const normalizedCt = rawCt === 'image/jpg' ? 'image/jpeg' : rawCt;
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(normalizedCt)) {
    throw new Error('Formato de imagem não suportado (use JPG, PNG, WebP ou AVIF).');
  }
  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
    throw new Error('Imagem externa excede o limite de 5MB.');
  }
  return {
    mimeType: normalizedCt,
    base64Data: Buffer.from(arrayBuffer).toString('base64'),
  };
}
