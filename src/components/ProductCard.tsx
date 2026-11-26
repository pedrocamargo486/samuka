import { useState } from 'react';
import { Check, Heart, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import { buildRoutePath } from '../lib/routes';
import { GENDER_LABELS, SNEAKER_TYPE_LABELS } from '../lib/seedData';
import { formatBRL, shareSneaker } from '../lib/utils';
import type { Product } from '../types';
import { SmartImage } from './SmartImage';

interface ProductCardProps {
  product: Product;
  storeName?: string;
  isFavorite: boolean;
  onToggleFavorite: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function ProductCard({
  product,
  storeName = 'SAMUKA TÊNIS',
  isFavorite,
  onToggleFavorite,
  onSelectProduct,
}: ProductCardProps) {
  const [copiedShare, setCopiedShare] = useState(false);

  const productHref = buildRoutePath({
    kind: 'product',
    slug: product.slug || product.id,
  });

  const handleOpenProduct = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelectProduct(product);
  };

  const hasValidPromo =
    product.isPromo && product.promoPrice > 0 && product.promoPrice < product.price;
  const displayPrice = hasValidPromo ? product.promoPrice : product.price;
  const availableSizesCount = Object.values(product.sizes || {}).filter((qty) => qty > 0).length;
  const isSoldOut = product.outOfStock || availableSizesCount === 0;

  let statusText = '';
  if (isSoldOut) {
    statusText = 'Esgotado';
  } else if (hasValidPromo) {
    const discountPct = Math.round(((product.price - product.promoPrice) / product.price) * 100);
    statusText = discountPct > 0 ? `Oferta -${discountPct}%` : 'Oferta';
  } else if (product.isNewRelease) {
    statusText = 'Lançamento';
  }

  const handleQuickShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await shareSneaker(product, storeName);
    if (res.outcome === 'copied') {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2200);
    } else if (res.outcome === 'manual') {
      window.open(res.whatsappShareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.4, ease: EASE_OUT }}
      whileHover={{ y: -4 }}
      className="group flex flex-col bg-white border border-stone-200/80 transition-shadow duration-200 hover:border-stone-300 hover:shadow-md"
    >
      {/* Studio Image Container */}
      <div className="relative aspect-[4/3] w-full bg-[#F5F5F4] overflow-hidden">
        <a
          href={productHref}
          onClick={handleOpenProduct}
          className="w-full h-full block text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#111111]"
          aria-label={`Ver detalhes de ${product.name}`}
        >
          <SmartImage
            src={product.images?.[0] || ''}
            alt={product.name}
            className={`w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-105 ${
              isSoldOut ? 'opacity-65 grayscale-[30%]' : ''
            }`}
          />
        </a>

        {statusText && (
          <span
            className={`absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isSoldOut
                ? 'bg-stone-900 text-white'
                : hasValidPromo
                  ? 'bg-[#C8102E] text-white'
                  : 'bg-[#111111] text-white'
            }`}
          >
            {statusText}
          </span>
        )}

        {/* Favorite Toggle */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(product.id);
          }}
          className="absolute top-2 right-2 w-9 h-9 bg-white/90 hover:bg-white flex items-center justify-center rounded-full border border-stone-200 transition-colors cursor-pointer"
          aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        >
          <Heart
            className={`w-4 h-4 transition-transform duration-200 ${
              isFavorite ? 'fill-[#C8102E] text-[#C8102E] scale-110' : 'text-[#111111]'
            }`}
          />
        </motion.button>
      </div>

      {/* Product Metadata & CTA */}
      <div className="flex flex-col flex-1 p-3.5 sm:p-4">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-stone-500 mb-1 truncate">
          <span className="font-semibold text-stone-700">{product.brandName}</span>
          <span aria-hidden="true">·</span>
          <span>{SNEAKER_TYPE_LABELS[product.type] || product.type}</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span className="hidden sm:inline">
            {GENDER_LABELS[product.gender] || product.gender}
          </span>
        </div>

        <h3 className="font-display text-sm sm:text-base font-bold text-[#111111] leading-snug mb-2 line-clamp-2 min-h-[2.5rem]">
          <a
            href={productHref}
            onClick={handleOpenProduct}
            className="text-left hover:underline cursor-pointer"
          >
            {product.name}
          </a>
        </h3>

        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-2 mb-3">
            {displayPrice > 0 ? (
              <>
                <span className="font-mono-num text-sm sm:text-base font-bold text-[#111111]">
                  {formatBRL(displayPrice)}
                </span>
                {hasValidPromo && (
                  <span className="font-mono-num text-xs text-stone-400 line-through">
                    {formatBRL(product.price)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs font-medium text-stone-500">
                Consulte o valor na loja
              </span>
            )}
          </div>

          <div className="flex items-stretch gap-1.5">
            <a
              href={productHref}
              onClick={handleOpenProduct}
              className="flex-1 py-2.5 px-2 sm:px-3 bg-[#111111] text-white text-[11px] sm:text-xs font-bold uppercase tracking-[0.08em] hover:bg-[#C8102E] transition-colors cursor-pointer min-h-[40px] flex items-center justify-center text-center"
            >
              VER PRODUTO
            </a>
            <button
              type="button"
              onClick={(e) => void handleQuickShare(e)}
              title={copiedShare ? 'Link copiado!' : 'Compartilhar tênis'}
              aria-label={`Compartilhar ${product.name}`}
              className={`w-10 shrink-0 border flex items-center justify-center transition-colors cursor-pointer min-h-[40px] ${
                copiedShare
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-stone-300 text-[#111111] hover:border-[#111111]'
              }`}
            >
              {copiedShare ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
