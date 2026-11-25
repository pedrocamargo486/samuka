import { motion } from 'motion/react';
import type { Brand } from '../types';
import { BrandLogo } from './BrandLogo';

interface BrandCirclesProps {
  brands: Brand[];
  selectedBrandId: string;
  onSelectBrand: (brandId: string) => void;
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function BrandCircles({
  brands,
  selectedBrandId,
  onSelectBrand,
}: BrandCirclesProps) {
  return (
    <section
      id="secao-marcas"
      aria-labelledby="heading-marcas"
      className="bg-white border-b border-stone-200 py-10 sm:py-14"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="flex items-end justify-between gap-4 mb-7"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 mb-1">
              Multimarcas selecionadas
            </p>
            <h2
              id="heading-marcas"
              className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#111111]"
            >
              EXPLORE POR MARCA
            </h2>
          </div>

          {selectedBrandId !== 'todos' && (
            <button
              type="button"
              onClick={() => onSelectBrand('todos')}
              className="text-xs font-semibold uppercase tracking-wider text-[#C8102E] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ver todas as marcas
            </button>
          )}
        </motion.div>

        {/* Horizontal Scroll on Mobile, Clean Wrap Grid on Desktop */}
        <div className="flex items-start gap-4 sm:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory py-2 lg:flex-wrap lg:justify-between">
          {brands.map((brand, index) => {
            const isSelected = selectedBrandId === brand.id;
            return (
              <motion.button
                key={brand.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{
                  duration: 0.4,
                  delay: Math.min(index * 0.035, 0.35),
                  ease: EASE_OUT,
                }}
                whileHover={{ y: -4, scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onSelectBrand(brand.id)}
                className="group snap-start shrink-0 flex flex-col items-center gap-2.5 focus:outline-none cursor-pointer"
                aria-pressed={isSelected}
              >
                <div
                  className={`w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-white flex items-center justify-center transition-shadow duration-200 ${
                    isSelected
                      ? 'border-2 border-[#111111] shadow-md'
                      : 'border border-stone-200 group-hover:border-[#111111] group-hover:shadow-sm'
                  }`}
                >
                  <BrandLogo brand={brand} />
                </div>
                <span
                  className={`text-xs tracking-wide whitespace-nowrap transition-colors ${
                    isSelected
                      ? 'font-bold text-[#111111]'
                      : 'font-medium text-stone-600 group-hover:text-[#111111]'
                  }`}
                >
                  {brand.name}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
