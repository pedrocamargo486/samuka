import { SNEAKER_TYPE_LABELS } from './seedData';
import { slugify } from './utils';
import type { Brand, Product, ProductFilters, SneakerType } from '../types';

export type AdminTab =
  | 'produtos'
  | 'pedidos'
  | 'lucros'
  | 'marcas'
  | 'pagina_inicial'
  | 'configuracoes'
  | 'equipe';

export type CategoryRouteKey =
  | 'todos'
  | 'ofertas'
  | 'lancamentos'
  | 'mais-vendidos'
  | 'masculino'
  | 'feminino'
  | 'infantil'
  | 'favoritos'
  | 'corrida'
  | 'academia'
  | 'casual'
  | 'dia-a-dia'
  | 'trabalho'
  | 'ocasioes-especiais';

export type AppRoute =
  | { kind: 'home' }
  | { kind: 'admin'; tab: AdminTab }
  | { kind: 'brands' }
  | { kind: 'brand'; brandSlug: string }
  | { kind: 'category'; categoryKey: CategoryRouteKey }
  | { kind: 'product'; slug: string }
  | { kind: 'resolving'; path: string }
  | { kind: 'not-found'; path: string };

export const ADMIN_TAB_SLUGS: Record<AdminTab, string> = {
  produtos: 'produtos',
  pedidos: 'pedidos',
  lucros: 'lucros',
  marcas: 'marcas',
  pagina_inicial: 'banner',
  configuracoes: 'configuracoes',
  equipe: 'equipe',
};

const SLUG_TO_ADMIN_TAB: Record<string, AdminTab> = {
  produtos: 'produtos',
  pedidos: 'pedidos',
  lucros: 'lucros',
  marcas: 'marcas',
  banner: 'pagina_inicial',
  'pagina-inicial': 'pagina_inicial',
  pagina_inicial: 'pagina_inicial',
  configuracoes: 'configuracoes',
  equipe: 'equipe',
};

export interface CategoryRouteMeta {
  key: CategoryRouteKey;
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  isTypeCategory?: boolean;
  sneakerType?: SneakerType;
}

export const CATEGORY_ROUTE_META: Record<CategoryRouteKey, CategoryRouteMeta> = {
  todos: {
    key: 'todos',
    path: '/todos',
    eyebrow: 'Vitrine Multimarcas',
    title: 'TODOS OS TÊNIS',
    description: 'Explore o catálogo completo com filtros por marca, numeração, cor e ocasião.',
  },
  ofertas: {
    key: 'ofertas',
    path: '/ofertas',
    eyebrow: 'Preços Promocionais',
    title: 'OFERTAS ESPECIAIS',
    description: 'Modelos selecionados com desconto especial por tempo limitado.',
  },
  lancamentos: {
    key: 'lancamentos',
    path: '/lancamentos',
    eyebrow: 'Novidades na Vitrine',
    title: 'LANÇAMENTOS',
    description: 'Os modelos mais recentes que acabaram de chegar na loja.',
  },
  'mais-vendidos': {
    key: 'mais-vendidos',
    path: '/mais-vendidos',
    eyebrow: 'Destaques da Loja',
    title: 'MAIS VENDIDOS',
    description: 'Os pares favoritos dos clientes da Samuka Tênis.',
  },
  masculino: {
    key: 'masculino',
    path: '/masculino',
    eyebrow: 'Coleção Masculina',
    title: 'TÊNIS MASCULINOS',
    description: 'Modelos masculinos e unissex para corrida, treino, trabalho e lifestyle.',
  },
  feminino: {
    key: 'feminino',
    path: '/feminino',
    eyebrow: 'Coleção Feminina',
    title: 'TÊNIS FEMININOS',
    description: 'Modelos femininos e unissex que unem conforto, leveza e identidade.',
  },
  infantil: {
    key: 'infantil',
    path: '/infantil',
    eyebrow: 'Linha Kids',
    title: 'TÊNIS INFANTIS',
    description: 'Calçados leves e confortáveis para o dia a dia e rotina escolar.',
  },
  favoritos: {
    key: 'favoritos',
    path: '/favoritos',
    eyebrow: 'Sua Seleção Salva',
    title: 'MEUS FAVORITOS',
    description: 'Os modelos que você favoritou para comparar e pedir quando quiser.',
  },
  corrida: {
    key: 'corrida',
    path: '/categoria/corrida',
    eyebrow: 'Categoria · Performance',
    title: 'TÊNIS DE CORRIDA',
    description: 'Amortecimento, respirabilidade e resposta para treinos e corridas.',
    isTypeCategory: true,
    sneakerType: 'corrida',
  },
  academia: {
    key: 'academia',
    path: '/categoria/academia',
    eyebrow: 'Categoria · Treino',
    title: 'TÊNIS PARA ACADEMIA',
    description: 'Estabilidade e firmeza para musculação, funcional e alta intensidade.',
    isTypeCategory: true,
    sneakerType: 'academia',
  },
  casual: {
    key: 'casual',
    path: '/categoria/casual',
    eyebrow: 'Categoria · Lifestyle',
    title: 'TÊNIS CASUAIS',
    description: 'Silhuetas versáteis e urbanas para combinar com qualquer visual.',
    isTypeCategory: true,
    sneakerType: 'casual',
  },
  'dia-a-dia': {
    key: 'dia-a-dia',
    path: '/categoria/dia-a-dia',
    eyebrow: 'Categoria · Conforto Diário',
    title: 'TÊNIS PARA O DIA A DIA',
    description: 'Conforto prolongado e leveza para acompanhar toda a sua rotina.',
    isTypeCategory: true,
    sneakerType: 'dia_a_dia',
  },
  trabalho: {
    key: 'trabalho',
    path: '/categoria/trabalho',
    eyebrow: 'Categoria · Rotina Profissional',
    title: 'TÊNIS PARA TRABALHO',
    description: 'Discretos, resistentes e confortáveis para longas jornadas.',
    isTypeCategory: true,
    sneakerType: 'trabalho',
  },
  'ocasioes-especiais': {
    key: 'ocasioes-especiais',
    path: '/categoria/ocasioes-especiais',
    eyebrow: 'Categoria · Seleção Premium',
    title: 'OCASIÕES ESPECIAIS',
    description: 'Acabamento diferenciado e presença marcante para momentos especiais.',
    isTypeCategory: true,
    sneakerType: 'ocasioes_especiais',
  },
};

const CATEGORY_SLUG_ALIASES: Record<string, CategoryRouteKey> = {
  todos: 'todos',
  catalogo: 'todos',
  ofertas: 'ofertas',
  promocoes: 'ofertas',
  lancamentos: 'lancamentos',
  'mais-vendidos': 'mais-vendidos',
  mais_vendidos: 'mais-vendidos',
  masculino: 'masculino',
  feminino: 'feminino',
  infantil: 'infantil',
  favoritos: 'favoritos',
  corrida: 'corrida',
  academia: 'academia',
  casual: 'casual',
  'dia-a-dia': 'dia-a-dia',
  dia_a_dia: 'dia-a-dia',
  trabalho: 'trabalho',
  'ocasioes-especiais': 'ocasioes-especiais',
  ocasioes_especiais: 'ocasioes-especiais',
};

export const SNEAKER_TYPE_TO_CATEGORY_KEY: Record<SneakerType, CategoryRouteKey> = {
  corrida: 'corrida',
  academia: 'academia',
  casual: 'casual',
  dia_a_dia: 'dia-a-dia',
  trabalho: 'trabalho',
  ocasioes_especiais: 'ocasioes-especiais',
};

export function getBrandSlug(brand: Pick<Brand, 'id' | 'slug' | 'name'>): string {
  return slugify(brand.slug || brand.id || brand.name);
}

export function buildRoutePath(route: AppRoute): string {
  switch (route.kind) {
    case 'home':
      return '/';
    case 'admin':
      return route.tab === 'produtos' ? '/adm' : `/adm/${ADMIN_TAB_SLUGS[route.tab]}`;
    case 'brands':
      return '/marcas';
    case 'brand':
      return `/${encodeURIComponent(route.brandSlug)}`;
    case 'category':
      return CATEGORY_ROUTE_META[route.categoryKey].path;
    case 'product':
      return `/tenis/${encodeURIComponent(route.slug)}`;
    case 'resolving':
    case 'not-found':
      return route.path || '/';
  }
}

export function getFiltersForCategoryKey(
  categoryKey: CategoryRouteKey,
  baseDefaults: ProductFilters
): { filters: ProductFilters; onlyFavorites: boolean } {
  switch (categoryKey) {
    case 'todos':
      return { filters: { ...baseDefaults }, onlyFavorites: false };
    case 'ofertas':
      return {
        filters: { ...baseDefaults, vitrine: 'ofertas', onlyPromo: true },
        onlyFavorites: false,
      };
    case 'lancamentos':
      return {
        filters: { ...baseDefaults, vitrine: 'lancamentos' },
        onlyFavorites: false,
      };
    case 'mais-vendidos':
      return {
        filters: { ...baseDefaults, vitrine: 'mais_vendidos' },
        onlyFavorites: false,
      };
    case 'masculino':
    case 'feminino':
    case 'infantil':
      return {
        filters: { ...baseDefaults, gender: categoryKey },
        onlyFavorites: false,
      };
    case 'favoritos':
      return {
        filters: { ...baseDefaults },
        onlyFavorites: true,
      };
    default: {
      const meta = CATEGORY_ROUTE_META[categoryKey];
      return {
        filters: {
          ...baseDefaults,
          type: meta.sneakerType || 'todos',
        },
        onlyFavorites: false,
      };
    }
  }
}

export function parseAppRoute(
  pathname: string,
  search: string,
  brands: Brand[],
  products: Product[],
  catalogLoaded: boolean
): AppRoute {
  const cleanPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search || '');

  // Backward compatibility for shared URLs in format /?produto=slug
  const legacyProductSlug = params.get('produto');
  if (cleanPath === '/' && legacyProductSlug) {
    return { kind: 'product', slug: legacyProductSlug };
  }

  if (cleanPath === '/') {
    return { kind: 'home' };
  }

  const segments = cleanPath
    .slice(1)
    .split('/')
    .map((s) => {
      try {
        return decodeURIComponent(s).trim();
      } catch {
        return s.trim();
      }
    })
    .filter(Boolean);

  if (segments.length === 0) {
    return { kind: 'home' };
  }

  const firstLower = segments[0].toLowerCase();

  // Admin routes: /adm, /admin, /adm/pedidos, /adm/lucros, ...
  if (firstLower === 'adm' || firstLower === 'admin') {
    const subSlug = (segments[1] || '').toLowerCase();
    const tab = SLUG_TO_ADMIN_TAB[subSlug] || 'produtos';
    return { kind: 'admin', tab };
  }

  // Product routes: /tenis/:slug
  if ((firstLower === 'tenis' || firstLower === 'produto') && segments[1]) {
    return { kind: 'product', slug: segments.slice(1).join('/') };
  }

  // Brands directory: /marcas
  if (firstLower === 'marcas' && segments.length === 1) {
    return { kind: 'brands' };
  }

  // Explicit brand prefix: /marca/:brandSlug
  if (firstLower === 'marca' && segments[1]) {
    const targetSlug = slugify(segments[1]);
    const matchedBrand = brands.find(
      (b) => getBrandSlug(b) === targetSlug || slugify(b.id) === targetSlug
    );
    if (matchedBrand) {
      return { kind: 'brand', brandSlug: getBrandSlug(matchedBrand) };
    }
    return catalogLoaded
      ? { kind: 'not-found', path: cleanPath }
      : { kind: 'resolving', path: cleanPath };
  }

  // Category prefix: /categoria/:typeSlug
  if (firstLower === 'categoria' && segments[1]) {
    const catAlias = CATEGORY_SLUG_ALIASES[slugify(segments[1])];
    if (catAlias) {
      return { kind: 'category', categoryKey: catAlias };
    }
    return { kind: 'not-found', path: cleanPath };
  }

  // Single-segment friendly URLs: /ofertas, /masculino, /corrida, /nike, /tenis-1
  if (segments.length === 1) {
    const normalized = slugify(segments[0]);

    const categoryMatch = CATEGORY_SLUG_ALIASES[normalized] || CATEGORY_SLUG_ALIASES[firstLower];
    if (categoryMatch) {
      return { kind: 'category', categoryKey: categoryMatch };
    }

    const brandMatch = brands.find(
      (b) => getBrandSlug(b) === normalized || slugify(b.id) === normalized
    );
    if (brandMatch) {
      return { kind: 'brand', brandSlug: getBrandSlug(brandMatch) };
    }

    const productMatch = products.find(
      (p) =>
        p.slug === segments[0] ||
        p.id === segments[0] ||
        slugify(p.slug || p.name) === normalized
    );
    if (productMatch) {
      return { kind: 'product', slug: productMatch.slug || productMatch.id };
    }

    if (!catalogLoaded) {
      return { kind: 'resolving', path: cleanPath };
    }
  }

  return { kind: 'not-found', path: cleanPath };
}

export function getRouteDocumentTitle(
  route: AppRoute,
  storeName: string,
  brands: Brand[],
  activeProduct: Product | null
): string {
  const brandLabel = storeName || 'SAMUKA TÊNIS';
  switch (route.kind) {
    case 'home':
      return `${brandLabel} — Catálogo Oficial de Tênis Multimarcas`;
    case 'admin':
      return `Painel Administrativo · ${brandLabel}`;
    case 'brands':
      return `Marcas disponíveis · ${brandLabel}`;
    case 'brand': {
      const b = brands.find((item) => getBrandSlug(item) === route.brandSlug);
      return `${b?.name || route.brandSlug.toUpperCase()} · ${brandLabel}`;
    }
    case 'category': {
      const meta = CATEGORY_ROUTE_META[route.categoryKey];
      return `${meta.title} · ${brandLabel}`;
    }
    case 'product': {
      if (activeProduct) {
        const typeLabel = SNEAKER_TYPE_LABELS[activeProduct.type] || '';
        return `${activeProduct.name} (${activeProduct.brandName}${
          typeLabel ? ` · ${typeLabel}` : ''
        }) · ${brandLabel}`;
      }
      return `Detalhes do Tênis · ${brandLabel}`;
    }
    case 'resolving':
      return `Carregando... · ${brandLabel}`;
    case 'not-found':
      return `Página não encontrada · ${brandLabel}`;
  }
}
