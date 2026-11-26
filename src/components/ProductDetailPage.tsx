import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Heart,
  MessageCircle,
  Play,
  Ruler,
  Share2,
  ShoppingBag,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  buildRoutePath,
  getBrandSlug,
  SNEAKER_TYPE_TO_CATEGORY_KEY,
  type AppRoute,
} from '../lib/routes';
import { GENDER_LABELS, SNEAKER_TYPE_LABELS } from '../lib/seedData';
import {
  resolveSizeChartKey,
  SIZE_CHART_KEYS,
  SIZE_CHARTS,
} from '../lib/sizeCharts';
import { buildProductShareUrl, formatBRL, parseVideoSource, shareSneaker } from '../lib/utils';
import type { Brand, Product } from '../types';
import { ProductCard } from './ProductCard';
import { SmartImage } from './SmartImage';

interface ProductDetailPageProps {
  product: Product | null;
  allProducts: Product[];
  brands: Brand[];
  storeName?: string;
  isLoading: boolean;
  favorites: string[];
  cartCount: number;
  onNavigateRoute: (route: AppRoute) => void;
  onToggleFavorite: (productId: string) => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
  onOpenCart: () => void;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function ProductDetailPage({
  product,
  allProducts,
  brands,
  storeName = 'SAMUKA TÊNIS',
  isLoading,
  favorites,
  cartCount,
  onNavigateRoute,
  onToggleFavorite,
  onAddToCart,
  onOpenCart,
}: ProductDetailPageProps) {
  const [selectedMediaIdx, setSelectedMediaIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [sizeError, setSizeError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied' | 'panel'>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [whatsappShareUrl, setWhatsappShareUrl] = useState('');
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [activeChartKey, setActiveChartKey] = useState('nike');

  useEffect(() => {
    if (!product) return;
    setSelectedMediaIdx(0);
    setSelectedSize('');
    setSelectedColor(product.colors?.[0] || '');
    setSizeError(false);
    setJustAdded(false);
    setShareFeedback('idle');
    setSizeGuideOpen(false);
    setActiveChartKey(resolveSizeChartKey(product.brandName, product.gender));
    const url = buildProductShareUrl(product);
    setShareUrl(url);
    const hasPromo =
      product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price;
    const effective = hasPromo ? product.promoPrice : product.price;
    const priceLabel = effective > 0 ? ` por ${formatBRL(effective)}` : '';
    const text = `Confira ${product.name} (${product.brandName})${priceLabel} na ${storeName}: ${url}`;
    setWhatsappShareUrl(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }, [product, storeName]);

  useEffect(() => {
    if (!sizeGuideOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSizeGuideOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [sizeGuideOpen]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const others = allProducts.filter((p) => p.id !== product.id);
    const sameBrandOrType = others.filter(
      (p) => p.brandId === product.brandId || p.type === product.type
    );
    const pool = sameBrandOrType.length >= 4 ? sameBrandOrType : [...sameBrandOrType, ...others];
    const unique: Product[] = [];
    const seen = new Set<string>();
    for (const item of pool) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        unique.push(item);
      }
      if (unique.length >= 4) break;
    }
    return unique;
  }, [allProducts, product]);

  const handleLinkClick = (e: React.MouseEvent, route: AppRoute) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigateRoute(route);
  };

  if (isLoading && !product) {
    return (
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
        <div className="h-4 w-56 bg-stone-200 animate-pulse mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 aspect-[4/3] bg-stone-100 animate-pulse" />
          <div className="lg:col-span-5 space-y-4">
            <div className="h-4 w-32 bg-stone-200 animate-pulse" />
            <div className="h-9 w-3/4 bg-stone-200 animate-pulse" />
            <div className="h-8 w-40 bg-stone-200 animate-pulse" />
            <div className="h-32 w-full bg-stone-100 animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-24">
        <div className="max-w-xl mx-auto border border-stone-200 bg-[#FAFAFA] p-8 sm:p-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500 mb-2">
            Produto não encontrado
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111111] mb-3">
            Este tênis não está mais disponível no catálogo
          </h1>
          <p className="text-sm text-stone-600 mb-7 leading-relaxed">
            O link pode ter sido alterado ou o modelo foi removido pela loja. Explore todos os
            modelos disponíveis no momento.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/todos"
              onClick={(e) => handleLinkClick(e, { kind: 'category', categoryKey: 'todos' })}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Ver todos os tênis
            </a>
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, { kind: 'home' })}
              className="w-full sm:w-auto px-6 py-3.5 border border-stone-300 hover:border-[#111111] bg-white text-[#111111] text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Voltar para o início
            </a>
          </div>
        </div>
      </section>
    );
  }

  const isFavorite = favorites.includes(product.id);
  const matchedBrand = brands.find((b) => b.id === product.brandId);
  const brandSlug = matchedBrand ? getBrandSlug(matchedBrand) : getBrandSlug({ id: product.brandId, slug: product.brandId, name: product.brandName });
  const brandRoute: AppRoute = { kind: 'brand', brandSlug };
  const typeCategoryKey = SNEAKER_TYPE_TO_CATEGORY_KEY[product.type];
  const typeRoute: AppRoute | null = typeCategoryKey
    ? { kind: 'category', categoryKey: typeCategoryKey }
    : null;

  const images = product.images?.length ? product.images : [''];
  const videos = (product.videos || []).filter((v) => Boolean(v && v.trim()));
  const mediaItems: { type: 'image' | 'video'; url: string }[] = [
    ...images.map((url) => ({ type: 'image' as const, url })),
    ...videos.map((url) => ({ type: 'video' as const, url })),
  ];
  const activeMedia = mediaItems[selectedMediaIdx] || mediaItems[0] || { type: 'image' as const, url: '' };
  const sortedSizes = Object.entries(product.sizes || {}).sort(
    ([a], [b]) => Number(a) - Number(b)
  );
  const hasAnyAvailableSize = !product.outOfStock && sortedSizes.some(([, qty]) => qty > 0);
  const hasValidPromo =
    product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price;
  const displayPrice = hasValidPromo ? product.promoPrice : product.price;

  const handleAdd = () => {
    if (!hasAnyAvailableSize) return;
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    onAddToCart(product, selectedSize, selectedColor || product.colors?.[0] || '');
    setJustAdded(true);
  };

  const handleShareClick = async () => {
    const res = await shareSneaker(product, storeName);
    setShareUrl(res.url);
    setWhatsappShareUrl(res.whatsappShareUrl);
    if (res.outcome === 'copied') {
      setShareFeedback('copied');
      setTimeout(() => setShareFeedback('panel'), 2000);
    } else if (res.outcome === 'manual' || res.outcome === 'shared') {
      setShareFeedback('panel');
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareUrl || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback('copied');
      setTimeout(() => setShareFeedback('panel'), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="bg-white">
      {/* Breadcrumb Bar */}
      <div className="border-b border-stone-200 bg-[#FAFAFA]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Caminho de navegação" className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, { kind: 'home' })}
              className="hover:text-[#111111] font-medium transition-colors"
            >
              Início
            </a>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            <a
              href={buildRoutePath(brandRoute)}
              onClick={(e) => handleLinkClick(e, brandRoute)}
              className="hover:text-[#111111] font-medium transition-colors"
            >
              {product.brandName}
            </a>
            {typeRoute && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                <a
                  href={buildRoutePath(typeRoute)}
                  onClick={(e) => handleLinkClick(e, typeRoute)}
                  className="hover:text-[#111111] font-medium transition-colors"
                >
                  {SNEAKER_TYPE_LABELS[product.type] || product.type}
                </a>
              </>
            )}
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-[#111111] font-semibold line-clamp-1">{product.name}</span>
          </nav>

          <a
            href="/todos"
            onClick={(e) => handleLinkClick(e, { kind: 'category', categoryKey: 'todos' })}
            className="text-xs font-bold uppercase tracking-wider text-[#111111] hover:text-[#C8102E] transition-colors shrink-0"
          >
            Ver catálogo completo
          </a>
        </div>
      </div>

      {/* Main Product Content */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Sticky Photo & Video Gallery */}
          <div className="lg:col-span-7 lg:sticky lg:top-24">
            <div className="aspect-[4/3] w-full bg-[#F5F5F4] border border-stone-200 overflow-hidden mb-3 flex items-center justify-center">
              {activeMedia.type === 'video' ? (
                (() => {
                  const parsed = parseVideoSource(activeMedia.url);
                  if (parsed.kind === 'youtube' || parsed.kind === 'vimeo') {
                    return (
                      <iframe
                        src={parsed.src}
                        title={`${product.name} vídeo`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full border-0 bg-black"
                      />
                    );
                  }
                  return (
                    <video
                      key={parsed.src}
                      src={parsed.src}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain bg-black"
                    />
                  );
                })()
              ) : (
                <SmartImage
                  src={activeMedia.url}
                  alt={`${product.name} — imagem ${selectedMediaIdx + 1}`}
                  loading="eager"
                  className="w-full h-full object-cover object-center"
                />
              )}
            </div>

            {mediaItems.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pt-1">
                {mediaItems.map((media, idx) => (
                  <button
                    key={`${media.type}-${media.url}-${idx}`}
                    type="button"
                    onClick={() => setSelectedMediaIdx(idx)}
                    className={`relative w-20 h-16 shrink-0 bg-[#F5F5F4] overflow-hidden border-2 transition-colors cursor-pointer ${
                      selectedMediaIdx === idx
                        ? 'border-[#111111]'
                        : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    {media.type === 'video' ? (
                      <div className="w-full h-full bg-[#111111] text-white flex flex-col items-center justify-center gap-1">
                        <Play className="w-4 h-4 fill-white" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">
                          Vídeo
                        </span>
                      </div>
                    ) : (
                      <SmartImage
                        src={media.url}
                        alt={`${product.name} miniatura ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Contiguous Purchase Module */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-stone-500 mb-2">
              <a
                href={buildRoutePath(brandRoute)}
                onClick={(e) => handleLinkClick(e, brandRoute)}
                className="font-bold text-[#111111] hover:text-[#C8102E] transition-colors"
              >
                {product.brandName}
              </a>
              <span aria-hidden="true">·</span>
              {typeRoute ? (
                <a
                  href={buildRoutePath(typeRoute)}
                  onClick={(e) => handleLinkClick(e, typeRoute)}
                  className="hover:text-[#111111] transition-colors"
                >
                  {SNEAKER_TYPE_LABELS[product.type] || product.type}
                </a>
              ) : (
                <span>{SNEAKER_TYPE_LABELS[product.type] || product.type}</span>
              )}
              <span aria-hidden="true">·</span>
              <span>{GENDER_LABELS[product.gender] || product.gender}</span>
            </div>

            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-[#111111] tracking-tight leading-tight mb-4">
              {product.name}
            </h1>

            {/* Price Block */}
            <div className="flex items-baseline gap-3 pb-5 border-b border-stone-200 mb-6">
              {displayPrice > 0 ? (
                <>
                  <span className="font-mono-num text-2xl sm:text-3xl font-bold text-[#111111]">
                    {formatBRL(displayPrice)}
                  </span>
                  {hasValidPromo && (
                    <>
                      <span className="font-mono-num text-base text-stone-400 line-through">
                        {formatBRL(product.price)}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#C8102E]">
                        Oferta especial
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-sm font-medium text-stone-600">
                  Preço sob consulta na loja
                </span>
              )}
            </div>

            {/* Colors */}
            {product.colors && product.colors.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2">
                  Cores disponíveis: <span className="text-[#111111]">{selectedColor}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => {
                    const active = selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`px-3.5 py-2 text-xs font-semibold border transition-colors cursor-pointer min-h-[38px] ${
                          active
                            ? 'bg-[#111111] text-white border-[#111111]'
                            : 'bg-white text-[#111111] border-stone-300 hover:border-[#111111]'
                        }`}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Grid */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    Selecione a numeração
                  </p>
                  {selectedSize && (
                    <span className="font-mono-num text-xs font-semibold text-[#111111]">
                      · Tam {selectedSize}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveChartKey(resolveSizeChartKey(product.brandName, product.gender));
                    setSizeGuideOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#111111] hover:text-[#C8102E] underline underline-offset-4 transition-colors cursor-pointer"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Tabela de medidas (cm)</span>
                </button>
              </div>

              {sortedSizes.length === 0 || !hasAnyAvailableSize ? (
                <div className="p-3 bg-stone-100 text-xs font-medium text-stone-600">
                  Modelo temporariamente esgotado em todas as numerações.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {sortedSizes.map(([size, qty]) => {
                    const available = !product.outOfStock && qty > 0;
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={!available}
                        onClick={() => {
                          if (!available) return;
                          setSelectedSize(size);
                          setSizeError(false);
                          setJustAdded(false);
                        }}
                        className={`font-mono-num py-3 text-sm font-semibold border transition-colors min-h-[44px] ${
                          !available
                            ? 'bg-stone-100 text-stone-400 border-stone-200 line-through cursor-not-allowed opacity-60'
                            : isSelected
                              ? 'bg-[#111111] text-white border-[#111111] cursor-pointer'
                              : 'bg-white text-[#111111] border-stone-300 hover:border-[#111111] cursor-pointer'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              )}

              {sizeError && (
                <p className="mt-2 text-xs font-semibold text-[#C8102E]">
                  Escolha uma numeração disponível antes de adicionar ao carrinho.
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-stretch gap-2 mb-4">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={!hasAnyAvailableSize}
                onClick={handleAdd}
                className={`flex-1 py-4 px-4 sm:px-5 text-xs sm:text-sm font-bold uppercase tracking-[0.1em] flex items-center justify-center gap-2 transition-colors min-h-[52px] ${
                  !hasAnyAvailableSize
                    ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                    : justAdded
                      ? 'bg-emerald-700 text-white cursor-pointer'
                      : 'bg-[#111111] text-white hover:bg-[#C8102E] cursor-pointer'
                }`}
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>ADICIONADO AO CARRINHO</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {hasAnyAvailableSize ? 'ADICIONAR AO CARRINHO' : 'PRODUTO ESGOTADO'}
                    </span>
                  </>
                )}
              </motion.button>

              <button
                type="button"
                onClick={() => onToggleFavorite(product.id)}
                className="px-4 border border-stone-300 hover:border-[#111111] flex items-center justify-center transition-colors cursor-pointer min-w-[50px]"
                aria-label={isFavorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
              >
                <Heart
                  className={`w-5 h-5 ${
                    isFavorite ? 'fill-[#C8102E] text-[#C8102E]' : 'text-[#111111]'
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => void handleShareClick()}
                className={`px-4 border flex items-center justify-center transition-colors cursor-pointer min-w-[50px] ${
                  shareFeedback !== 'idle'
                    ? 'border-[#111111] bg-stone-100 text-[#111111]'
                    : 'border-stone-300 hover:border-[#111111] text-[#111111]'
                }`}
                aria-label="Compartilhar este tênis"
                title="Compartilhar tênis"
              >
                {shareFeedback === 'copied' ? (
                  <Check className="w-5 h-5 text-emerald-700" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Share Strip */}
            <AnimatePresence>
              {shareFeedback !== 'idle' && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className="mb-4 p-3 bg-[#FAFAFA] border border-stone-200 flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="text-xs font-semibold text-[#111111]">
                    {shareFeedback === 'copied'
                      ? 'Link copiado!'
                      : 'Compartilhar página do produto:'}
                  </span>
                  <div className="flex items-center gap-2">
                    <a
                      href={whatsappShareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] font-bold uppercase tracking-wider transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => void handleCopyShareLink()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 bg-white hover:border-[#111111] text-[11px] font-bold uppercase tracking-wider text-[#111111] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar link</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Post-Add Flow */}
            <AnimatePresence>
              {justAdded && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  className="mb-6 p-4 bg-[#FAFAFA] border border-stone-300 space-y-2.5"
                >
                  <p className="text-xs font-semibold text-[#111111]">
                    Item adicionado! Continue explorando o catálogo ou finalize seu pedido pelo
                    WhatsApp.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <a
                      href="/todos"
                      onClick={(e) =>
                        handleLinkClick(e, { kind: 'category', categoryKey: 'todos' })
                      }
                      className="py-2.5 px-3 border border-[#111111] bg-white text-[#111111] text-xs font-bold uppercase tracking-wider hover:bg-stone-100 text-center min-h-[42px] flex items-center justify-center"
                    >
                      Ver mais tênis
                    </a>
                    <button
                      type="button"
                      onClick={onOpenCart}
                      className="py-2.5 px-3 bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#111111] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
                    >
                      <span>Finalizar pedido ({cartCount})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Description & Details */}
            <div className="space-y-4 pt-5 border-t border-stone-200 text-sm text-stone-700 leading-relaxed">
              {product.description && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-1.5">
                    Sobre o modelo
                  </h2>
                  <p>{product.description}</p>
                </div>
              )}

              {product.details && (
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111] mb-1.5">
                    Informações técnicas
                  </h2>
                  <p className="text-stone-600">{product.details}</p>
                </div>
              )}

              {product.occasion && (
                <p className="text-xs text-stone-500">
                  Indicado para: <strong className="text-[#111111]">{product.occasion}</strong>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="mt-14 pt-10 border-t border-stone-200">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 mb-1">
                  Continue explorando
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#111111]">
                  MODELOS RELACIONADOS
                </h2>
              </div>
              <a
                href={buildRoutePath(brandRoute)}
                onClick={(e) => handleLinkClick(e, brandRoute)}
                className="text-xs font-bold uppercase tracking-wider text-[#111111] hover:text-[#C8102E] underline underline-offset-4"
              >
                Mais de {product.brandName}
              </a>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
              {relatedProducts.map((rel) => (
                <ProductCard
                  key={rel.id}
                  product={rel}
                  storeName={storeName}
                  isFavorite={favorites.includes(rel.id)}
                  onToggleFavorite={onToggleFavorite}
                  onSelectProduct={(p) =>
                    onNavigateRoute({ kind: 'product', slug: p.slug || p.id })
                  }
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Size Guide Modal */}
      {sizeGuideOpen && (() => {
        const activeChart = SIZE_CHARTS[activeChartKey] || SIZE_CHARTS.nike;
        return (
          <div
            className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Guia de medidas em centímetros"
            onClick={() => setSizeGuideOpen(false)}
          >
            <div
              className="w-full max-w-2xl bg-white border border-stone-200 max-h-[90vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-[#C8102E]" />
                  <h2 className="font-display text-base sm:text-lg font-extrabold text-[#111111]">
                    Guia de Medidas em Centímetros (cm)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(false)}
                  className="p-2 text-stone-500 hover:text-[#111111] cursor-pointer"
                  aria-label="Fechar guia de medidas"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
                    Escolha a marca para comparar a forma
                  </p>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {SIZE_CHART_KEYS.map((key) => {
                      const chart = SIZE_CHARTS[key];
                      const active = activeChartKey === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setActiveChartKey(key)}
                          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#111111] text-white border-[#111111]'
                              : 'bg-white text-stone-700 border-stone-300 hover:border-[#111111]'
                          }`}
                        >
                          {chart.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-[#FAFAFA] border border-stone-200 text-xs text-stone-700">
                  <strong className="text-[#111111]">{activeChart.label}:</strong>{' '}
                  {activeChart.fitNote}
                </div>

                <div className="border border-stone-200 overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#111111] text-white text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-bold">BR (Brasil)</th>
                        <th className="px-4 py-3 font-bold">Medida (cm)</th>
                        <th className="px-4 py-3 font-bold">US (EUA)</th>
                        <th className="px-4 py-3 font-bold text-right">Neste modelo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {activeChart.rows.map((row) => {
                        const qtyInStock = product.sizes?.[row.br] ?? 0;
                        const available = !product.outOfStock && qtyInStock > 0;
                        const isSelected = selectedSize === row.br;
                        return (
                          <tr
                            key={row.br}
                            className={
                              isSelected
                                ? 'bg-emerald-50/80'
                                : available
                                  ? 'hover:bg-stone-50'
                                  : 'opacity-55'
                            }
                          >
                            <td className="px-4 py-2.5 font-mono-num font-bold text-[#111111]">
                              {row.br}
                            </td>
                            <td className="px-4 py-2.5 font-mono-num font-semibold text-[#C8102E]">
                              {row.cm} cm
                            </td>
                            <td className="px-4 py-2.5 font-mono-num text-stone-600">{row.us}</td>
                            <td className="px-4 py-2.5 text-right">
                              {available ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSize(row.br);
                                    setSizeError(false);
                                    setJustAdded(false);
                                    setSizeGuideOpen(false);
                                  }}
                                  className="px-2.5 py-1 bg-[#111111] hover:bg-[#C8102E] text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                                >
                                  {isSelected ? 'Selecionado' : 'Selecionar'}
                                </button>
                              ) : (
                                <span className="text-[11px] text-stone-400">Indisponível</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-[#FAFAFA] border border-stone-200 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                    Como medir seu pé em 3 passos
                  </p>
                  <ol className="text-xs text-stone-700 space-y-1.5 list-decimal list-inside">
                    <li>
                      Coloque uma folha de papel no chão encostada na parede e pise com o calcanhar
                      encostado na parede.
                    </li>
                    <li>
                      Marque com uma caneta o ponto mais distante dos dedos e meça com uma régua em
                      centímetros.
                    </li>
                    <li>
                      Compare na coluna <strong>Medida (cm)</strong> acima. Se ficar entre dois
                      números, escolha o maior.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
