import { ArrowUpRight, Instagram } from 'lucide-react';
import { sanitizeExternalHref } from '../lib/utils';
import type { Product, StoreConfig } from '../types';

interface InstagramSectionProps {
  storeConfig: StoreConfig;
  products?: Product[];
  onSelectProduct?: (product: Product) => void;
}

function extractInstagramHandle(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('@')) return trimmed;
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const seg = parsed.pathname.split('/').filter(Boolean)[0];
    return seg ? `@${seg.replace(/^@/, '')}` : '';
  } catch {
    return '';
  }
}

export function InstagramSection({ storeConfig }: InstagramSectionProps) {
  const instagramHref = sanitizeExternalHref(storeConfig.instagramUrl);
  const handle = extractInstagramHandle(storeConfig.instagramUrl);

  return (
    <section
      id="secao-instagram"
      className="bg-[#FAFAFA] border-t border-stone-200 py-12 sm:py-14"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#C8102E]">
              <Instagram className="w-4 h-4" />
              <span>{handle || 'Instagram Oficial'}</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111]">
              Acompanhe os lançamentos e novidades no Instagram
            </h2>
            <p className="text-sm text-stone-600">
              {instagramHref
                ? `Confira fotos reais dos tênis, reposições de numeração e novidades diretamente no perfil oficial ${
                    handle || 'da loja'
                  }.`
                : 'Siga o perfil oficial da loja no Instagram para acompanhar fotos reais dos pares, reposições e novidades.'}
            </p>
          </div>

          {instagramHref && (
            <a
              href={instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-[0.14em] transition-colors shrink-0 min-h-[44px]"
            >
              <Instagram className="w-4 h-4" />
              <span>{handle ? `Seguir ${handle}` : 'Seguir no Instagram'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
