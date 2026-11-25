import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { StoreConfig } from '../types';
import { SmartImage } from './SmartImage';

interface HeroBannerProps {
  storeConfig: StoreConfig;
  onExplore: () => void;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function HeroBanner({ storeConfig, onExplore }: HeroBannerProps) {
  return (
    <section
      aria-label="Destaque principal"
      className="relative w-full bg-[#111111] overflow-hidden"
    >
      <div className="relative min-h-[460px] sm:min-h-[540px] lg:min-h-[620px] max-w-[1440px] mx-auto flex items-end lg:items-center">
        {/* Background Media with smooth settle */}
        <motion.div
          initial={{ opacity: 0.4, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
          className="absolute inset-0"
        >
          <SmartImage
            src={
              storeConfig.heroImageUrl ||
              '/src/assets/images/hero_samuka_sneakers_1795569255175.jpg'
            }
            alt={storeConfig.heroTitle}
            loading="eager"
            className="w-full h-full object-cover object-center"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20 lg:bg-gradient-to-r lg:from-black/85 lg:via-black/45 lg:to-transparent"
            aria-hidden="true"
          />
        </motion.div>

        {/* Staggered Hero Copy */}
        <div className="relative z-10 w-full px-5 sm:px-8 lg:px-14 py-12 sm:py-16 lg:py-20">
          <div className="max-w-2xl">
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-300 mb-3"
            >
              {storeConfig.storeName || 'SAMUKA TÊNIS'} · Catálogo Oficial
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: EASE_OUT }}
              className="font-display font-extrabold text-white tracking-tight leading-[1.06] mb-4"
              style={{
                fontSize: 'clamp(2rem, 4.2vw, 3.75rem)',
                textWrap: 'balance',
              }}
            >
              {storeConfig.heroTitle}
            </motion.h1>

            {storeConfig.heroSubtitle && (
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.16, ease: EASE_OUT }}
                className="text-base sm:text-lg text-stone-200 leading-relaxed max-w-xl mb-8"
              >
                {storeConfig.heroSubtitle}
              </motion.p>
            )}

            <motion.button
              type="button"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24, ease: EASE_OUT }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onExplore}
              className="inline-flex items-center gap-3 px-7 py-4 bg-white text-[#111111] text-xs sm:text-sm font-bold tracking-[0.12em] uppercase hover:bg-[#C8102E] hover:text-white transition-colors duration-200 cursor-pointer min-h-[48px]"
            >
              <span>{storeConfig.heroCtaText || 'EXPLORAR COLEÇÃO'}</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </section>
  );
}
