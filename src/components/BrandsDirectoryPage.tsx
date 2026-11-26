import { ArrowRight, ChevronRight } from 'lucide-react';
import { buildRoutePath, getBrandSlug, type AppRoute } from '../lib/routes';
import type { Brand, Product } from '../types';
import { BrandLogo } from './BrandLogo';

interface BrandsDirectoryPageProps {
  brands: Brand[];
  products: Product[];
  onNavigateRoute: (route: AppRoute) => void;
}

export function BrandsDirectoryPage({
  brands,
  products,
  onNavigateRoute,
}: BrandsDirectoryPageProps) {
  const handleLinkClick = (e: React.MouseEvent, route: AppRoute) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigateRoute(route);
  };

  return (
    <div className="bg-white">
      <div className="border-b border-stone-200 bg-[#FAFAFA]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
          <nav
            aria-label="Caminho de navegação"
            className="flex items-center gap-1.5 text-xs text-stone-500 mb-3"
          >
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, { kind: 'home' })}
              className="hover:text-[#111111] font-medium"
            >
              Início
            </a>
            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-[#111111] font-semibold">Marcas</span>
          </nav>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500 mb-1">
            Curadoria Oficial
          </p>
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#111111]">
            TODAS AS MARCAS
          </h1>
          <p className="text-sm text-stone-600 mt-1.5 max-w-2xl">
            Escolha uma marca para visualizar todos os modelos disponíveis com estoque atualizado.
          </p>
        </div>
      </div>

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {brands.map((brand) => {
            const count = products.filter((p) => p.brandId === brand.id).length;
            const brandRoute: AppRoute = { kind: 'brand', brandSlug: getBrandSlug(brand) };
            const href = buildRoutePath(brandRoute);

            return (
              <a
                key={brand.id}
                href={href}
                onClick={(e) => handleLinkClick(e, brandRoute)}
                className="group border border-stone-200 hover:border-[#111111] bg-white p-6 flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className="w-20 h-20 rounded-full border border-stone-200 group-hover:border-[#111111] bg-[#FAFAFA] flex items-center justify-center mb-4 transition-colors">
                  <BrandLogo brand={brand} />
                </div>
                <h2 className="font-display text-base sm:text-lg font-extrabold text-[#111111] mb-1">
                  {brand.name}
                </h2>
                <p className="font-mono-num text-xs text-stone-500 mb-4">
                  {count} {count === 1 ? 'modelo' : 'modelos'}
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#111111] group-hover:text-[#C8102E] transition-colors mt-auto">
                  <span>Ver coleção</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
