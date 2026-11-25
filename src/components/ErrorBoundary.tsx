import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Ocorreu um erro inesperado na aplicação.',
    };
  }

  override componentDidCatch(error: Error): void {
    console.error('Erro capturado pelo ErrorBoundary:', error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-6 py-12">
          <div className="max-w-md w-full bg-white border border-stone-200 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">
              SAMUKA TÊNIS
            </p>
            <h1 className="text-xl font-bold text-[#111111] mb-3">
              Algo interrompeu o carregamento
            </h1>
            <p className="text-sm text-stone-600 mb-6 break-words">
              Tente recarregar a página para restabelecer a conexão com o catálogo.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-[#111111] text-white text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
