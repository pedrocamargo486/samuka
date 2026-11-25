import { useState } from 'react';
import {
  Heart,
  Menu,
  MessageCircle,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { buildWhatsAppUrl } from '../lib/utils';
import type { StoreConfig } from '../types';

export type NavSectionKey =
  | 'inicio'
  | 'todos'
  | 'masculino'
  | 'feminino'
  | 'infantil'
  | 'marcas'
  | 'ofertas'
  | 'favoritos';

interface HeaderProps {
  storeConfig: StoreConfig;
  activeNav: NavSectionKey;
  onNavigate: (section: NavSectionKey) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  favoritesCount: number;
  cartCount: number;
  onOpenCart: () => void;
  onOpenFavorites: () => void;
}

const NAV_ITEMS: { key: NavSectionKey; label: string }[] = [
  { key: 'inicio', label: 'Início' },
  { key: 'todos', label: 'Todos os tênis' },
  { key: 'masculino', label: 'Masculino' },
  { key: 'feminino', label: 'Feminino' },
  { key: 'infantil', label: 'Infantil' },
  { key: 'marcas', label: 'Marcas' },
  { key: 'ofertas', label: 'Ofertas' },
];

export function Header({
  storeConfig,
  activeNav,
  onNavigate,
  searchQuery,
  onSearchChange,
  favoritesCount,
  cartCount,
  onOpenCart,
  onOpenFavorites,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const whatsappHref = buildWhatsAppUrl(
    storeConfig.whatsappNumber,
    `Olá! Gostaria de falar com o atendimento da ${storeConfig.storeName || 'Samuka Tênis'}.`
  );

  const handleNavClick = (key: NavSectionKey) => {
    setMobileMenuOpen(false);
    onNavigate(key);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Brand Wordmark + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-2 -ml-2 text-[#111111] hover:bg-stone-100 rounded-md transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('inicio')}
            className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-[#111111] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#111111]"
          >
            {storeConfig.storeName || 'SAMUKA TÊNIS'}
          </button>
        </div>

        {/* Zone 2: Primary Navigation Links */}
        <nav
          aria-label="Menu principal"
          className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-600"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNavClick(item.key)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#111111] font-semibold'
                    : 'hover:text-[#111111]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute left-0 right-0 -bottom-0.5 h-[2px] bg-[#111111]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Functional Storefront Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            className="p-2.5 text-[#111111] hover:bg-stone-100 rounded-md transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Pesquisar tênis"
            aria-expanded={searchOpen}
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          <button
            type="button"
            onClick={onOpenFavorites}
            className="relative p-2.5 text-[#111111] hover:bg-stone-100 rounded-md transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            aria-label={`Favoritos (${favoritesCount})`}
          >
            <Heart
              className={`w-[18px] h-[18px] ${
                favoritesCount > 0 ? 'fill-[#C8102E] text-[#C8102E]' : ''
              }`}
            />
            {favoritesCount > 0 && (
              <span className="font-mono-num absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-[#111111] text-white text-[10px] font-semibold flex items-center justify-center rounded-full">
                {favoritesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="relative p-2.5 text-[#111111] hover:bg-stone-100 rounded-md transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            aria-label={`Carrinho (${cartCount})`}
          >
            <ShoppingBag className="w-[18px] h-[18px]" />
            {cartCount > 0 && (
              <span className="font-mono-num absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-[#C8102E] text-white text-[10px] font-semibold flex items-center justify-center rounded-full">
                {cartCount}
              </span>
            )}
          </button>

          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 ml-1 px-4 py-2 bg-[#111111] text-white text-xs font-semibold tracking-wide hover:bg-[#C8102E] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={onOpenCart}
              className="hidden sm:inline-flex items-center gap-2 ml-1 px-4 py-2 bg-[#111111] text-white text-xs font-semibold tracking-wide hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Atendimento</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Search Bar */}
      {searchOpen && (
        <div className="border-t border-stone-200 bg-white px-4 sm:px-6 lg:px-10 py-3">
          <div className="max-w-[1440px] mx-auto flex items-center gap-3">
            <Search className="w-4 h-4 text-stone-400 shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                if (activeNav === 'inicio' && e.target.value.trim().length > 0) {
                  onNavigate('todos');
                }
              }}
              placeholder="Buscar por modelo, marca, corrida, casual..."
              className="w-full text-sm text-[#111111] placeholder:text-stone-400 bg-transparent focus:outline-none py-1.5"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="text-xs font-medium text-stone-500 hover:text-[#111111] px-2 py-1 cursor-pointer"
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="p-1.5 text-stone-500 hover:text-[#111111] cursor-pointer"
              aria-label="Fechar busca"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 py-4 space-y-1">
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                if (e.target.value.trim().length > 0) {
                  onNavigate('todos');
                }
              }}
              placeholder="Pesquisar tênis ou marca..."
              className="w-full pl-9 pr-3 py-2.5 bg-[#F5F5F4] text-sm text-[#111111] placeholder:text-stone-500 focus:outline-none focus:ring-1 focus:ring-[#111111]"
            />
          </div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavClick(item.key)}
              className={`w-full text-left px-3 py-3 text-sm font-medium border-b border-stone-100 last:border-b-0 flex items-center justify-between cursor-pointer ${
                activeNav === item.key ? 'text-[#111111] font-bold' : 'text-stone-700'
              }`}
            >
              <span>{item.label}</span>
              {activeNav === item.key && (
                <span className="w-1.5 h-1.5 bg-[#C8102E] rounded-full" />
              )}
            </button>
          ))}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-[#111111] text-white text-sm font-semibold"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Atendimento pelo WhatsApp</span>
            </a>
          )}
        </div>
      )}
    </header>
  );
}
