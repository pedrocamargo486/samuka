import { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowRight,
  Box,
  Check,
  ChevronLeft,
  Copy,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Share2,
  ShoppingBag,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { GENDER_LABELS, SNEAKER_TYPE_LABELS } from '../lib/seedData';
import { buildProductShareUrl, formatBRL, shareSneaker } from '../lib/utils';
import type { Product } from '../types';
import { SmartImage } from './SmartImage';

const Sneaker3DViewer = lazy(() =>
  import('./Sneaker3DViewer').then((m) => ({ default: m.Sneaker3DViewer }))
);

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
  const [viewMode, setViewMode] = useState<'photos' | '3d'>('photos');
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [sizeError, setSizeError] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<'idle' | 'copied' | 'panel'>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [whatsappShareUrl, setWhatsappShareUrl] = useState('');

  useEffect(() => {
    if (product) {
      setViewMode('photos');
      setSelectedImageIdx(0);
      setSelectedSize('');
      setSelectedColor(product.colors?.[0] || '');
      setSizeError(false);
      setJustAdded(false);
      setShareFeedback('idle');
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
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [product, onClose]);

  const images = product?.images?.length ? product.images : [''];
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
                {/* Left Column: Image Gallery OR Free Interactive 3D Viewer */}
                <div className="lg:col-span-7 p-4 sm:p-6 lg:p-8 bg-[#FAFAFA] border-b lg:border-b-0 lg:border-r border-stone-200">
                  {/* Photos vs 3D Segmented Switcher */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="inline-flex border border-stone-300 bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setViewMode('photos')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                          viewMode === 'photos'
                            ? 'bg-[#111111] text-white'
                            : 'text-stone-600 hover:text-[#111111]'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Fotos ({images.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('3d')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                          viewMode === '3d'
                            ? 'bg-[#C8102E] text-white'
                            : 'text-stone-600 hover:text-[#111111]'
                        }`}
                      >
                        <Box className="w-3.5 h-3.5" />
                        <span>Visualização 3D</span>
                      </button>
                    </div>

                    {viewMode === '3d' && (
                      <span className="text-[11px] font-medium text-stone-500 hidden sm:inline">
                        Simulação 3D nas cores do modelo
                      </span>
                    )}
                  </div>

                  {viewMode === '3d' ? (
                    <div className="space-y-2.5">
                      <Suspense
                        fallback={
                          <div className="aspect-[4/3] min-h-[320px] sm:min-h-[420px] bg-[#F4F4F2] border border-stone-200 flex items-center justify-center text-xs font-semibold uppercase tracking-wider text-stone-500">
                            Carregando estúdio 3D...
                          </div>
                        }
                      >
                        <Sneaker3DViewer product={product} selectedColor={selectedColor} />
                      </Suspense>
                      <p className="text-[11px] text-stone-500">
                        Visualização 3D interativa gratuita gerada com as cores e o perfil deste
                        tênis. Use as fotos reais ao lado para conferir acabamentos exatos da marca.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="aspect-[4/3] w-full bg-[#F5F5F4] overflow-hidden mb-3">
                        <SmartImage
                          src={images[selectedImageIdx] || images[0]}
                          alt={`${product.name} — imagem ${selectedImageIdx + 1}`}
                          loading="eager"
                          className="w-full h-full object-cover object-center"
                        />
                      </div>

                      {images.length > 1 && (
                        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pt-1">
                          {images.map((imgUrl, idx) => (
                            <button
                              key={`${imgUrl}-${idx}`}
                              type="button"
                              onClick={() => setSelectedImageIdx(idx)}
                              className={`w-20 h-16 shrink-0 bg-[#F5F5F4] overflow-hidden border-2 transition-colors cursor-pointer ${
                                selectedImageIdx === idx
                                  ? 'border-[#111111]'
                                  : 'border-transparent hover:border-stone-300'
                              }`}
                            >
                              <SmartImage
                                src={imgUrl}
                                alt={`${product.name} miniatura ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
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
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-stone-600">
                        Selecione a numeração
                      </p>
                      {selectedSize && (
                        <span className="font-mono-num text-xs font-semibold text-[#111111]">
                          Tamanho {selectedSize} selecionado
                        </span>
                      )}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
