import { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'mobile';
  onAfterClick?: () => void;
}

export function PWAInstallButton({
  variant = 'header',
  onAfterClick,
}: PWAInstallButtonProps) {
  const { isInstalled, isIOS, install } = usePWAInstall();
  const [guideMode, setGuideMode] = useState<'none' | 'ios' | 'browser'>('none');

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    const result = await install();
    if (result === 'ios-guide') {
      setGuideMode('ios');
    } else if (result === 'manual-guide') {
      setGuideMode('browser');
    } else {
      onAfterClick?.();
    }
  };

  return (
    <>
      {variant === 'mobile' ? (
        <button
          type="button"
          onClick={() => void handleClick()}
          className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-[#111111] bg-stone-50 text-[#111111] text-sm font-semibold hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Instalar App no Celular</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void handleClick()}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 border border-stone-300 bg-white text-[#111111] text-xs font-semibold hover:border-[#111111] transition-colors whitespace-nowrap shrink-0 min-h-[40px] cursor-pointer"
          aria-label="Instalar aplicativo Samuka Tênis"
          title="Instalar como aplicativo"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Instalar App</span>
        </button>
      )}

      {guideMode !== 'none' && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Instalar aplicativo Samuka Tênis"
          onClick={() => {
            setGuideMode('none');
            onAfterClick?.();
          }}
        >
          <div
            className="w-full max-w-md bg-white border border-stone-200 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-[#111111] text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-extrabold text-[#111111]">
                    Instalar Samuka Tênis
                  </h3>
                  <p className="text-xs text-stone-500">
                    Acesse o catálogo direto da tela inicial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGuideMode('none');
                  onAfterClick?.();
                }}
                className="p-1.5 text-stone-500 hover:text-[#111111] cursor-pointer"
                aria-label="Fechar instruções"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS || guideMode === 'ios' ? (
              <ol className="space-y-3 text-xs sm:text-sm text-stone-700 bg-[#FAFAFA] border border-stone-200 p-4">
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-num font-bold text-[#111111] shrink-0">1.</span>
                  <span>
                    Toque no botão <Share className="inline w-4 h-4 mx-0.5 text-[#111111]" />{' '}
                    <strong>Compartilhar</strong> na barra inferior do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-num font-bold text-[#111111] shrink-0">2.</span>
                  <span>
                    Role para baixo e toque em{' '}
                    <PlusSquare className="inline w-4 h-4 mx-0.5 text-[#111111]" />{' '}
                    <strong>Adicionar à Tela de Início</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="font-mono-num font-bold text-[#111111] shrink-0">3.</span>
                  <span>
                    Toque em <strong>Adicionar</strong> no canto superior direito.
                  </span>
                </li>
              </ol>
            ) : (
              <div className="space-y-2.5 text-xs sm:text-sm text-stone-700 bg-[#FAFAFA] border border-stone-200 p-4">
                <p>
                  No menu do seu navegador (ícone de três pontos ou barra de endereço), toque em{' '}
                  <strong>Instalar aplicativo</strong> ou{' '}
                  <strong>Adicionar à tela inicial</strong>.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setGuideMode('none');
                onAfterClick?.();
              }}
              className="w-full py-3 bg-[#111111] hover:bg-[#C8102E] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 px-4 py-2.5 bg-[#111111] text-white border border-stone-700 text-xs font-semibold shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#C8102E]" />
      <span>Modo offline — exibindo dados em cache</span>
    </div>
  );
}
