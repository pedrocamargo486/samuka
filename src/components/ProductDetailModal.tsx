import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
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
import { GENDER_LABELS, SNEAKER_TYPE_LABELS } from '../lib/seedData';
import {
  resolveSizeChartKey,
  SIZE_CHART_KEYS,
  SIZE_CHARTS,
} from '../lib/sizeCharts';
import { buildProductShareUrl, formatBRL, parseVideoSource, shareSneaker } from '../lib/utils';
import type { Product } from '../types';
import { SmartImage } from './SmartImage';

interface ProductDetailModalProps {
  product: Product | null;
  storeName?: string;
  isFavorite: boolean;
  cartCount: number;
  onClose: () => void;
  onToggleFavorite: (productId: string) => void;
  onAddToCart: (product: Product, size: string, color: string) => void;
  onOpenCart: () => void;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function ProductDetailModal({
  product,
  storeName = 'SAMUKA TÊNIS',
  isFavorite,
  cartCount,
  onClose,
  onToggleFavorite,
  onAddToCart,
  onOpenCart,
}: ProductDetailModalProps) {
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
    if (product) {
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
    }
  }, [product, storeName]);

  useEffect(() => {
    if (!product) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (sizeGuideOpen) {
          setSizeGuideOpen(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [product, sizeGuideOpen, onClose]);

  const images = product?.images?.length ? product.images : [''];
  const videos = (product?.videos || []).filter((v) => Boolean(v && v.trim()));
  const mediaItems: { type: 'image' | 'video'; url: string }[] = [
    ...images.map((url) => ({ type: 'image' as const, url })),
    ...videos.map((url) => ({ type: 'video' as const, url })),
  ];
  const activeMedia = mediaItems[selectedMediaIdx] || mediaItems[0] || { type: 'image' as const, url: '' };
  const sortedSizes = Object.entries(product?.sizes || {}).sort(
    ([a], [b]) => Number(a) - Number(b)
  );
  const hasAnyAvailableSize =
    Boolean(product) && !product!.outOfStock && sortedSizes.some(([, qty]) => qty > 0);
  const hasValidPromo =
    Boolean(product) &&
    product!.isPromo &&
    product!.promoPrice > 0 &&
    product!.promoPrice < product!.price;
  const displayPrice = product ? (hasValidPromo ? product.promoPrice : product.price) : 0;

  const handleAdd = () => {
    if (!product || !hasAnyAvailableSize) return;
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    setSizeError(false);
    onAddToCart(product, selectedSize, selectedColor || product.colors?.[0] || '');
    setJustAdded(true);
  };

  const handleShareClick = async () => {
    if (!product) return;
    const res = await shareSneaker(product, storeName);
    setShareUrl(res.url);
    setWhatsappShareUrl(res.whatsappShareUrl);
    if (res.outcome === 'copied') {
      setShareFeedback('copied');
      setTimeout(() => setShareFeedback('panel'), 2000);
    } else if (res.outcome === 'manual') {
      setShareFeedback('panel');
    } else if (res.outcome === 'shared') {
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
      // Ignore clipboard permission failure
    }
  };

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          key="pdp-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdp-title"
          onClick={onClose}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center p-0 sm:p-6">
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
              className="relative w-full max-w-5xl bg-white min-h-screen sm:min-h-0 sm:border sm:border-stone-200 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Modal Header */}
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-stone-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#111111] hover:text-[#C8102E] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar ao catálogo</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleShareClick()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-300 hover:border-[#111111] text-[11px] font-bold uppercase tracking-wider text-[#111111] cursor-pointer"
                    aria-label="Compartilhar este tênis"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Compartilhar</span>
                  </button>
                  {cartCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCart();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] text-white text-[11px] font-bold uppercase tracking-wider hover:bg-[#C8102E] transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Carrinho ({cartCount})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 text-stone-500 hover:text-[#111111] cursor-pointer"
                    aria-label="Fechar detalhes do produto"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left Column: Photo & Video Gallery */}
                <div className="lg:col-span-7 p-4 sm:p-6 lg:p-8 bg-[#FAFAFA] border-b lg:border-b-0 lg:border-r border-stone-200">
                  <div className="aspect-[4/3] w-full bg-[#111111] overflow-hidden mb-3 flex items-center justify-center">
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
                              className="w-full h-full border-0"
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
                      <div className="w-full h-full bg-[#F5F5F4]">
                        <SmartImage
                          src={activeMedia.url}
                          alt={`${product.name} — imagem ${selectedMediaIdx + 1}`}
                          loading="eager"
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
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
                              : 'border-transparent hover:border-stone-300'
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
                <div className="lg:col-span-5 p-5 sm:p-7 lg:p-8 flex flex-col">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-stone-500 mb-2">
                    <span className="font-bold text-[#111111]">{product.brandName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{SNEAKER_TYPE_LABELS[product.type] || product.type}</span>
                    <span aria-hidden="true">·</span>
                    <span>{GENDER_LABELS[product.gender] || product.gender}</span>
                  </div>

                  <h1
                    id="pdp-title"
                    className="font-display text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight leading-tight mb-3"
                  >
                    {product.name}
                  </h1>

                  {/* Price Block */}
                  <div className="flex items-baseline gap-3 pb-5 border-b border-stone-200 mb-5">
                    {displayPrice > 0 ? (
                      <>
                        <span className="font-mono-num text-2xl font-bold text-[#111111]">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
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

                  {/* Action Buttons: Add to Cart + Favorite + Share */}
                  <div className="flex items-stretch gap-2 mb-4">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      disabled={!hasAnyAvailableSize}
                      onClick={handleAdd}
                      className={`flex-1 py-4 px-4 sm:px-5 text-xs sm:text-sm font-bold uppercase tracking-[0.1em] flex items-center justify-center gap-2 transition-colors min-h-[50px] ${
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
                      className="px-3.5 border border-stone-300 hover:border-[#111111] flex items-center justify-center transition-colors cursor-pointer min-w-[48px]"
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
                      className={`px-3.5 border flex items-center justify-center transition-colors cursor-pointer min-w-[48px] ${
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

                  {/* Quick Share Strip (WhatsApp + Copy Link) */}
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
                            ? 'Link do tênis copiado!'
                            : 'Compartilhar este modelo:'}
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

                  {/* Non-blocking post-add flow: keep shopping OR proceed to checkout */}
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
                          Item adicionado! Você pode continuar escolhendo mais tênis ou finalizar seu
                          pedido agora.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={onClose}
                            className="py-2.5 px-3 border border-[#111111] bg-white text-[#111111] text-xs font-bold uppercase tracking-wider hover:bg-stone-100 cursor-pointer min-h-[42px]"
                          >
                            Continuar comprando
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenCart();
                            }}
                            className="py-2.5 px-3 bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#111111] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
                          >
                            <span>Finalizar pedido ({cartCount})</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Description & Technical Details */}
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
                        Indicado para:{' '}
                        <strong className="text-[#111111]">{product.occasion}</strong>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Size Guide Overlay (BR / Centimeters / US by Brand) */}
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
                    {/* Brand Switcher */}
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

                    {/* Conversion Table */}
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
                                <td className="px-4 py-2.5 font-mono-num text-stone-600">
                                  {row.us}
                                </td>
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

                    {/* How to measure */}
                    <div className="bg-[#FAFAFA] border border-stone-200 p-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                        Como medir seu pé em 3 passos
                      </p>
                      <ol className="text-xs text-stone-700 space-y-1.5 list-decimal list-inside">
                        <li>
                          Coloque uma folha de papel no chão encostada na parede e pise com o
                          calcanhar encostado na parede.
                        </li>
                        <li>
                          Marque com uma caneta o ponto mais distante dos dedos (geralmente o dedão)
                          e meça com uma régua ou fita métrica em centímetros.
                        </li>
                        <li>
                          Compare a medida na coluna <strong>Medida (cm)</strong> acima. Se ficar
                          entre dois números ou preferir folga, escolha o maior.
                        </li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
