import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 h-full min-h-[400px] text-center space-y-4 bg-zinc-50 dark:bg-zinc-950">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {this.props.fallbackTitle || "Une erreur est survenue lors de l'affichage de cet article"}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md">
            {this.state.error?.message || "Le contenu de cet article n'a pas pu être chargé correctement."}
          </p>
          {this.props.onReset && (
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset?.();
              }}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition-colors inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour au flux d'articles</span>
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
