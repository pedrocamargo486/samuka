import { useState } from 'react';
import { Clock, Instagram, MapPin, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { buildRoutePath, getBrandSlug, type AppRoute } from '../lib/routes';
import { buildWhatsAppUrl, sanitizeExternalHref } from '../lib/utils';
import type { Brand, StoreConfig } from '../types';
import type { NavSectionKey } from './Header';

interface FooterProps {
  storeConfig: StoreConfig;
  brands: Brand[];
  onNavigate: (section: NavSectionKey) => void;
  onSelectBrand: (brandId: string) => void;
  onNavigateRoute: (route: AppRoute) => void;
  onOpenAdmin: () => void;
}

export function Footer({
  storeConfig,
  brands,
  onNavigate,
  onSelectBrand,
  onNavigateRoute,
  onOpenAdmin,
}: FooterProps) {
  const [policyModal, setPolicyModal] = useState<'trocas' | 'privacidade' | null>(null);

  const whatsappHref = buildWhatsAppUrl(
    storeConfig.whatsappNumber,
    `Olá! Vim pelo catálogo oficial da ${storeConfig.storeName || 'Samuka Tênis'}.`
  );
  const instagramHref = sanitizeExternalHref(storeConfig.instagramUrl);

  const handleLink = (e: React.MouseEvent, fn: () => void) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    fn();
  };

  return (
    <footer className="bg-[#111111] text-stone-300 border-t border-stone-800">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-stone-800">
          {/* Col 1: Brand & Bio */}
          <div className="space-y-4">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-white">
              {storeConfig.storeName || 'SAMUKA TÊNIS'}
            </h2>
            <p className="text-sm text-stone-400 leading-relaxed">
              Catálogo oficial de tênis multimarcas. Curadoria esportiva e urbana com atendimento
              personalizado e confirmação direta pelo WhatsApp.
            </p>
            <div className="flex items-center gap-3 pt-1">
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-[#111111] text-xs font-bold uppercase tracking-wider hover:bg-[#C8102E] hover:text-white transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}
              {instagramHref ? (
                <a
                  href={instagramHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3.5 py-2 border border-stone-700 text-white text-xs font-bold uppercase tracking-wider hover:border-white transition-colors"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  <span>Instagram</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('secao-instagram');
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 border border-stone-700 text-white text-xs font-bold uppercase tracking-wider hover:border-white transition-colors cursor-pointer"
                >
                  <Instagram className="w-3.5 h-3.5" />
                  <span>Instagram</span>
                </button>
              )}
            </div>
          </div>

          {/* Col 2: Navigation & Categories */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white mb-4">
              Navegação & Categorias
            </h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {[
                { label: 'Início', href: '/', action: () => onNavigate('inicio') },
                { label: 'Todos os tênis', href: '/todos', action: () => onNavigate('todos') },
                { label: 'Masculino', href: '/masculino', action: () => onNavigate('masculino') },
                { label: 'Feminino', href: '/feminino', action: () => onNavigate('feminino') },
                { label: 'Infantil', href: '/infantil', action: () => onNavigate('infantil') },
                { label: 'Ofertas', href: '/ofertas', action: () => onNavigate('ofertas') },
                {
                  label: 'Lançamentos',
                  href: '/lancamentos',
                  action: () => onNavigateRoute({ kind: 'category', categoryKey: 'lancamentos' }),
                },
                {
                  label: 'Corrida',
                  href: '/categoria/corrida',
                  action: () => onNavigateRoute({ kind: 'category', categoryKey: 'corrida' }),
                },
                {
                  label: 'Academia',
                  href: '/categoria/academia',
                  action: () => onNavigateRoute({ kind: 'category', categoryKey: 'academia' }),
                },
                {
                  label: 'Casual',
                  href: '/categoria/casual',
                  action: () => onNavigateRoute({ kind: 'category', categoryKey: 'casual' }),
                },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={(e) => handleLink(e, item.action)}
                    className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Available Brands */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white mb-4">
              Marcas disponíveis
            </h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {brands.slice(0, 12).map((brand) => {
                const href = buildRoutePath({
                  kind: 'brand',
                  brandSlug: getBrandSlug(brand),
                });
                return (
                  <li key={brand.id}>
                    <a
                      href={href}
                      onClick={(e) => handleLink(e, () => onSelectBrand(brand.id))}
                      className="text-stone-400 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      {brand.name}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Col 4: Store Info & Policies */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white mb-4">
              Loja & Políticas
            </h3>

            <div className="space-y-2.5 text-sm text-stone-400">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <span>
                  {storeConfig.storeAddress ||
                    'Endereço físico configurável no painel da loja.'}
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
                <span>
                  {storeConfig.openingHours ||
                    'Horário de funcionamento configurável no painel da loja.'}
                </span>
              </div>
            </div>

            <div className="pt-2 space-y-2 text-xs">
              <button
                type="button"
                onClick={() => setPolicyModal('trocas')}
                className="block text-stone-400 hover:text-white underline cursor-pointer"
              >
                Política de Troca e Devolução
              </button>
              <button
                type="button"
                onClick={() => setPolicyModal('privacidade')}
                className="block text-stone-400 hover:text-white underline cursor-pointer"
              >
                Informações de Privacidade
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Restricted Admin Entry */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <p>
            © {new Date().getFullYear()} {storeConfig.storeName || 'SAMUKA TÊNIS'}. Todos os
            direitos reservados.
          </p>
          <a
            href="/adm"
            onClick={(e) => handleLink(e, onOpenAdmin)}
            className="inline-flex items-center gap-1.5 text-stone-600 hover:text-stone-300 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Área Administrativa</span>
          </a>
        </div>
      </div>

      {/* Policy Modal */}
      {policyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setPolicyModal(null)}
        >
          <div
            className="bg-white text-[#111111] max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-display text-lg font-extrabold">
                {policyModal === 'trocas'
                  ? 'Política de Troca e Devolução'
                  : 'Informações de Privacidade'}
              </h3>
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="p-1 text-stone-500 hover:text-[#111111] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {policyModal === 'trocas' ? (
              <div className="text-sm text-stone-700 space-y-3 leading-relaxed">
                <p>
                  Na {storeConfig.storeName || 'Samuka Tênis'}, todas as trocas por numeração ou
                  eventuais defeitos de fabricação são coordenadas diretamente com nossa equipe pelo
                  atendimento oficial via WhatsApp.
                </p>
                <p>
                  O calçado deve estar sem sinais de uso, com etiqueta e caixa original preservadas.
                  Para entregas à distância, aplicam-se os prazos previstos no Código de Defesa do
                  Consumidor.
                </p>
              </div>
            ) : (
              <div className="text-sm text-stone-700 space-y-3 leading-relaxed">
                <p>
                  Seu carrinho e lista de favoritos ficam salvos apenas localmente no navegador para
                  sua comodidade durante a navegação.
                </p>
                <p>
                  Os dados informados na finalização (nome, telefone e endereço para entrega) são
                  utilizados exclusivamente para compor a mensagem do seu pedido enviada por você ao
                  WhatsApp comercial da loja.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </footer>
  );
}
