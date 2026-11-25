import { useMemo, useState } from 'react';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  ALL_STANDARD_SIZES,
  GENDER_LABELS,
  KIDS_SIZES,
  SNEAKER_TYPE_LABELS,
} from '../lib/seedData';
import type { Brand, GenderOption, Product, ProductFilters, SneakerType } from '../types';
import { ProductCard } from './ProductCard';

interface CatalogSectionProps {
  products: Product[];
  brands: Brand[];
  filters: ProductFilters;
  onUpdateFilters: (patch: Partial<ProductFilters>) => void;
  onResetFilters: () => void;
  favorites: string[];
  onlyFavoritesMode: boolean;
  onToggleOnlyFavoritesMode: (val: boolean) => void;
  onToggleFavorite: (productId: string) => void;
  onSelectProduct: (product: Product) => void;
  isLoading: boolean;
}

const VITRINE_TABS: { key: ProductFilters['vitrine']; label: string }[] = [
  { key: 'todos', label: 'Todos os modelos' },
  { key: 'mais_vendidos', label: 'Mais vendidos' },
  { key: 'lancamentos', label: 'Lançamentos' },
  { key: 'ofertas', label: 'Ofertas especiais' },
];

const TYPE_QUICK_CHIPS: { key: SneakerType | 'todos'; label: string }[] = [
  { key: 'todos', label: 'Todas as ocasiões' },
  { key: 'dia_a_dia', label: 'Dia a dia' },
  { key: 'academia', label: 'Academia' },
  { key: 'corrida', label: 'Corrida' },
  { key: 'casual', label: 'Casual' },
  { key: 'trabalho', label: 'Trabalho' },
  { key: 'ocasioes_especiais', label: 'Ocasiões especiais' },
];

export function CatalogSection({
  products,
  brands,
  filters,
  onUpdateFilters,
  onResetFilters,
  favorites,
  onlyFavoritesMode,
  onToggleOnlyFavoritesMode,
  onToggleFavorite,
  onSelectProduct,
  isLoading,
}: CatalogSectionProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => (p.colors || []).forEach((c) => set.add(c)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const availableOccasions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.occasion?.trim()) set.add(p.occasion.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const allSizes = useMemo(() => {
    const set = new Set<string>([...ALL_STANDARD_SIZES, ...KIDS_SIZES]);
    products.forEach((p) => Object.keys(p.sizes || {}).forEach((s) => set.add(s)));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const minP = filters.minPrice ? Number(filters.minPrice) : null;
    const maxP = filters.maxPrice ? Number(filters.maxPrice) : null;

    return products.filter((p) => {
      if (onlyFavoritesMode && !favorites.includes(p.id)) return false;

      if (query) {
        const hay = `${p.name} ${p.brandName} ${p.description} ${p.occasion} ${
          SNEAKER_TYPE_LABELS[p.type] || ''
        }`.toLowerCase();
        if (!hay.includes(query)) return false;
      }

      if (filters.brandId !== 'todos' && p.brandId !== filters.brandId) return false;
      if (filters.gender !== 'todos' && p.gender !== filters.gender) return false;
      if (filters.type !== 'todos' && p.type !== filters.type) return false;
      if (filters.color !== 'todas' && !(p.colors || []).includes(filters.color)) return false;
      if (filters.occasion !== 'todas' && p.occasion !== filters.occasion) return false;

      if (filters.size !== 'todos') {
        const qty = p.sizes?.[filters.size] ?? 0;
        if (p.outOfStock || qty <= 0) return false;
      }

      const effectivePrice =
        p.isPromo && p.promoPrice > 0 && p.promoPrice < p.price ? p.promoPrice : p.price;

      if (minP !== null && !Number.isNaN(minP) && effectivePrice < minP) return false;
      if (maxP !== null && !Number.isNaN(maxP) && effectivePrice > maxP) return false;

      if (filters.onlyPromo && !(p.isPromo && p.promoPrice > 0 && p.promoPrice < p.price)) {
        return false;
      }

      if (filters.onlyInStock) {
        const hasStock = Object.values(p.sizes || {}).some((q) => q > 0);
        if (p.outOfStock || !hasStock) return false;
      }

      if (filters.vitrine === 'mais_vendidos' && !p.isFeatured) return false;
      if (filters.vitrine === 'lancamentos' && !p.isNewRelease) return false;
      if (
        filters.vitrine === 'ofertas' &&
        !(p.isPromo && p.promoPrice > 0 && p.promoPrice < p.price)
      ) {
        return false;
      }

      return true;
    });
  }, [products, filters, onlyFavoritesMode, favorites]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.brandId !== 'todos') count++;
    if (filters.gender !== 'todos') count++;
    if (filters.type !== 'todos') count++;
    if (filters.size !== 'todos') count++;
    if (filters.color !== 'todas') count++;
    if (filters.occasion !== 'todas') count++;
    if (filters.minPrice || filters.maxPrice) count++;
    if (filters.onlyPromo) count++;
    if (filters.onlyInStock) count++;
    if (onlyFavoritesMode) count++;
    return count;
  }, [filters, onlyFavoritesMode]);

  const selectedBrandName =
    filters.brandId !== 'todos'
      ? brands.find((b) => b.id === filters.brandId)?.name
      : null;

  return (
    <section
      id="secao-catalogo"
      aria-labelledby="heading-catalogo"
      className="bg-white py-10 sm:py-14"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        {/* Section Heading & Top Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-stone-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 mb-1">
              {onlyFavoritesMode
                ? 'Sua seleção salva'
                : selectedBrandName
                  ? `Coleção exclusiva ${selectedBrandName}`
                  : 'Vitrine Multimarcas'}
            </p>
            <h2
              id="heading-catalogo"
              className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111]"
            >
              {onlyFavoritesMode
                ? 'MEUS FAVORITOS'
                : selectedBrandName
                  ? `TÊNIS ${selectedBrandName.toUpperCase()}`
                  : 'CATÁLOGO OFICIAL'}
            </h2>
          </div>

          {/* Smart Search & Filter Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={filters.search}
                onChange={(e) => onUpdateFilters({ search: e.target.value })}
                placeholder="Buscar modelo, marca ou tipo..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#F5F5F4] border border-stone-200 text-sm text-[#111111] placeholder:text-stone-500 focus:outline-none focus:border-[#111111] min-h-[42px]"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 border text-xs font-bold uppercase tracking-wider transition-colors min-h-[42px] cursor-pointer ${
                filtersOpen || activeFiltersCount > 0
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-white text-[#111111] border-stone-300 hover:border-[#111111]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="font-mono-num px-1.5 py-0.5 bg-[#C8102E] text-white text-[10px]">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Vitrine Tabs + Occasion Quick Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-5 border-b border-stone-100">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            {VITRINE_TABS.map((tab) => {
              const active = filters.vitrine === tab.key && !onlyFavoritesMode;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    onToggleOnlyFavoritesMode(false);
                    onUpdateFilters({ vitrine: tab.key });
                  }}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[38px] ${
                    active
                      ? 'bg-[#111111] text-white'
                      : 'bg-[#F5F5F4] text-stone-700 hover:text-[#111111]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
            {TYPE_QUICK_CHIPS.map((chip) => {
              const active = filters.type === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => onUpdateFilters({ type: chip.key })}
                  className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                    active
                      ? 'border-[#111111] text-[#111111] font-semibold bg-stone-100'
                      : 'border-stone-200 text-stone-600 hover:border-stone-400 hover:text-[#111111]'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Expandable Multi-Dimensional Filter Panel */}
        {filtersOpen && (
          <div className="bg-[#FAFAFA] border border-stone-200 p-5 sm:p-6 mt-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#111111]">
                <Filter className="w-4 h-4" />
                <span>Refinar busca no catálogo</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onToggleOnlyFavoritesMode(false);
                    onResetFilters();
                  }}
                  className="text-xs font-semibold text-[#C8102E] hover:underline cursor-pointer"
                >
                  Limpar todos os filtros
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="p-1 text-stone-500 hover:text-[#111111] cursor-pointer"
                  aria-label="Fechar filtros"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Marca */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  Marca
                </label>
                <select
                  value={filters.brandId}
                  onChange={(e) => onUpdateFilters({ brandId: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
                >
                  <option value="todos">Todas as marcas</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gênero */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  Gênero
                </label>
                <select
                  value={filters.gender}
                  onChange={(e) =>
                    onUpdateFilters({ gender: e.target.value as GenderOption | 'todos' })
                  }
                  className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
                >
                  <option value="todos">Todos os gêneros</option>
                  {Object.entries(GENDER_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Numeração */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  Numeração disponível
                </label>
                <select
                  value={filters.size}
                  onChange={(e) => onUpdateFilters({ size: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
                >
                  <option value="todos">Todas as numerações</option>
                  {allSizes.map((sz) => (
                    <option key={sz} value={sz}>
                      Tamanho {sz}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cor */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  Cor
                </label>
                <select
                  value={filters.color}
                  onChange={(e) => onUpdateFilters({ color: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
                >
                  <option value="todas">Todas as cores</option>
                  {availableColors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ocasião de uso */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  Ocasião de uso
                </label>
                <select
                  value={filters.occasion}
                  onChange={(e) => onUpdateFilters({ occasion: e.target.value })}
                  className="w-full px-3 py-2.5 bg-white border border-stone-300 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
                >
                  <option value="todas">Todas as ocasiões</option>
                  {availableOccasions.map((occ) => (
                    <option key={occ} value={occ}>
                      {occ}
                    </option>
                  ))}
                </select>
              </div>

              {/* Faixa de Preço Mín / Máx */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    Preço mín. (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={filters.minPrice}
                    onChange={(e) => onUpdateFilters({ minPrice: e.target.value })}
                    placeholder="0"
                    className="font-mono-num w-full px-3 py-2.5 bg-white border border-stone-300 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    Preço máx. (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={filters.maxPrice}
                    onChange={(e) => onUpdateFilters({ maxPrice: e.target.value })}
                    placeholder="2000"
                    className="font-mono-num w-full px-3 py-2.5 bg-white border border-stone-300 text-sm text-[#111111] focus:outline-none focus:border-[#111111]"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="sm:col-span-2 flex flex-wrap items-center gap-5 pt-4 sm:pt-6">
                <label className="inline-flex items-center gap-2 text-sm text-[#111111] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.onlyPromo}
                    onChange={(e) => onUpdateFilters({ onlyPromo: e.target.checked })}
                    className="w-4 h-4 accent-[#111111]"
                  />
                  <span>Somente em oferta</span>
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-[#111111] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.onlyInStock}
                    onChange={(e) => onUpdateFilters({ onlyInStock: e.target.checked })}
                    className="w-4 h-4 accent-[#111111]"
                  />
                  <span>Somente disponíveis em estoque</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Active Result Count & Quick Reset */}
        <div className="flex items-center justify-between py-4 text-xs text-stone-500">
          <span className="font-mono-num">
            {isLoading
              ? 'Carregando catálogo...'
              : `${filteredProducts.length} ${
                  filteredProducts.length === 1 ? 'modelo encontrado' : 'modelos encontrados'
                }`}
          </span>
          {(activeFiltersCount > 0 || filters.search || filters.vitrine !== 'todos') && (
            <button
              type="button"
              onClick={() => {
                onToggleOnlyFavoritesMode(false);
                onResetFilters();
              }}
              className="text-xs font-semibold text-[#111111] underline cursor-pointer"
            >
              Mostrar todo o catálogo
            </button>
          )}
        </div>

        {/* Product Grid: 2 columns on mobile, 3-4 on desktop */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="border border-stone-200 bg-[#F5F5F4] animate-pulse aspect-[3/4]"
              />
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="border border-stone-200 bg-[#FAFAFA] py-16 px-6 text-center">
            <p className="font-display text-lg font-bold text-[#111111] mb-2">
              Nenhum tênis encontrado para os filtros atuais
            </p>
            <p className="text-sm text-stone-600 max-w-md mx-auto mb-6">
              Tente limpar os filtros selecionados ou buscar por outro termo ou marca.
            </p>
            <button
              type="button"
              onClick={() => {
                onToggleOnlyFavoritesMode(false);
                onResetFilters();
              }}
              className="px-6 py-3 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#C8102E] transition-colors cursor-pointer"
            >
              Ver todos os modelos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isFavorite={favorites.includes(product.id)}
                onToggleFavorite={onToggleFavorite}
                onSelectProduct={onSelectProduct}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
