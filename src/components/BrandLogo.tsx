import type { Brand } from '../types';
import { SmartImage } from './SmartImage';

interface BrandLogoProps {
  brand: Brand;
  size?: 'sm' | 'md';
}

export function BrandLogo({ brand, size = 'md' }: BrandLogoProps) {
  if (brand.logoUrl) {
    return (
      <SmartImage
        src={brand.logoUrl}
        alt={`Logotipo ${brand.name}`}
        className="w-12 h-12 object-contain"
      />
    );
  }

  const key = brand.slug.toLowerCase();
  const iconClass = size === 'sm' ? 'w-7 h-7' : 'w-11 h-11';

  switch (key) {
    case 'nike':
      return (
        <svg viewBox="0 0 64 32" className={`${iconClass} text-[#111111]`} fill="currentColor" aria-hidden="true">
          <path d="M16.2 26.5c-4.7 0-8.1-2-9.5-5.6-1-2.6-.3-6 2.1-9.6 1.5-2.2 3.8-4.5 6.4-6.9-1.9 3.6-2.5 6.8-1.4 9.1 1.3 2.7 4.7 3.6 9.8 2.3L59 7 18.6 25.9c-.8.4-1.6.6-2.4.6z" />
        </svg>
      );
    case 'adidas':
      return (
        <svg viewBox="0 0 64 40" className={`${iconClass} text-[#111111]`} fill="currentColor" aria-hidden="true">
          <path d="M11 32l6.2-10.5L23.5 32H11zm14.5 0l8.4-15.2L42.2 32H25.5zm18.7 0L53 10.5 61 32H44.2z" />
        </svg>
      );
    case 'new-balance':
      return (
        <div className="flex flex-col items-center leading-none text-[#111111]">
          <span className={`font-display font-black italic tracking-tighter ${size === 'sm' ? 'text-base' : 'text-xl'}`}>
            NB
          </span>
          <span className="text-[7px] font-bold uppercase tracking-[0.14em] mt-0.5">
            new balance
          </span>
        </div>
      );
    case 'puma':
      return (
        <div className="flex flex-col items-center text-[#111111]">
          <svg viewBox="0 0 64 24" className={size === 'sm' ? 'w-6 h-3' : 'w-9 h-4'} fill="currentColor" aria-hidden="true">
            <path d="M10 18c8-5 19-9 29-11 4-.8 8-3 12-5 1.5 2 0 4.5-2 6-3 2.2-6 5-7 9h-4c0-3-2-4-5-4-4 0-9 2-14 6l-4 1c-2-1-4-1.5-5-2z" />
          </svg>
          <span className={`font-display font-extrabold tracking-[0.1em] uppercase ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>
            PUMA
          </span>
        </div>
      );
    case 'mizuno':
      return (
        <div className="flex flex-col items-center text-[#111111]">
          <svg viewBox="0 0 64 32" className={size === 'sm' ? 'w-6 h-4' : 'w-10 h-6'} fill="currentColor" aria-hidden="true">
            <path d="M6 25c10-2.4 20.5-10.2 31.5-17.8 5.2-3.6 12-4.8 18.5-2.2-6.5.8-11.5 3.6-15.5 7.4-5.4 5.1-13 11.4-24 14.6-4.2 1.2-7.8.4-10.5-2z" />
          </svg>
          <span className="text-[8px] font-bold uppercase tracking-wider">Mizuno</span>
        </div>
      );
    case 'asics':
      return (
        <div className="flex items-center gap-1 text-[#111111]">
          <span className={`font-display italic font-black tracking-tight ${size === 'sm' ? 'text-xs' : 'text-base'}`}>
            asics
          </span>
        </div>
      );
    case 'olympikus':
      return (
        <div className="flex flex-col items-center text-[#111111]">
          <svg viewBox="0 0 64 32" className={size === 'sm' ? 'w-6 h-3.5' : 'w-10 h-5'} fill="none" stroke="currentColor" strokeWidth="4.2" aria-hidden="true">
            <circle cx="22" cy="16" r="8" />
            <circle cx="41" cy="16" r="8" />
          </svg>
          <span className="text-[7px] font-bold uppercase tracking-widest mt-0.5">Olympikus</span>
        </div>
      );
    case 'converse':
      return (
        <div className="flex flex-col items-center text-[#111111]">
          <svg viewBox="0 0 48 48" className={size === 'sm' ? 'w-5 h-5' : 'w-7 h-7'} fill="currentColor" aria-hidden="true">
            <path d="M24 6l4.6 12.6L42 19l-10.6 8.2L35 40 24 32.4 13 40l3.6-12.8L6 19l13.4-.4L24 6z" />
          </svg>
          <span className="text-[7px] font-extrabold uppercase tracking-[0.12em]">Converse</span>
        </div>
      );
    case 'vans':
      return (
        <div className="flex flex-col items-center text-[#111111]">
          <span className={`font-display font-black tracking-tighter uppercase border-t-2 border-[#111111] pt-0.5 leading-none ${size === 'sm' ? 'text-xs' : 'text-base'}`}>
            VANS
          </span>
          <span className="text-[6px] font-bold uppercase tracking-[0.14em] mt-0.5">
            Off The Wall
          </span>
        </div>
      );
    case 'fila':
      return (
        <div className="flex flex-col items-center text-[#111111]">
          <span className={`font-display font-black tracking-[0.14em] uppercase leading-none ${size === 'sm' ? 'text-xs' : 'text-base'}`}>
            FILA
          </span>
          <span className="w-7 h-0.5 bg-[#C8102E] mt-1" aria-hidden="true" />
        </div>
      );
    case 'reebok':
      return (
        <div className="flex flex-col items-center text-[#111111]">
          <svg viewBox="0 0 48 24" className={size === 'sm' ? 'w-6 h-3' : 'w-8 h-4'} fill="currentColor" aria-hidden="true">
            <path d="M24 3L6 20h10l8-9 8 9h10L24 3z" />
          </svg>
          <span className={`font-display font-bold tracking-tight ${size === 'sm' ? 'text-[10px]' : 'text-xs'}`}>
            Reebok
          </span>
        </div>
      );
    default:
      return (
        <span className="font-display font-bold tracking-tight text-xs md:text-sm text-[#111111] text-center px-1 truncate max-w-[72px]">
          {brand.name}
        </span>
      );
  }
}
