import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    // ──────────────────────────────────────────────────────────────────────────
    // Enhanced diagnostic logging — DO NOT remove. This helps identify crashes
    // such as "TypeError: undefined is not an object (evaluating 't.length')"
    // by printing the full context at the time of failure.
    // ──────────────────────────────────────────────────────────────────────────
    console.group('%c🔴 ErrorBoundary caught an unhandled React error', 'color:red;font-weight:bold;font-size:13px');
    console.error('Error:', error.message);
    console.error('Error type:', error.constructor?.name ?? 'Unknown');
    console.error('Stack trace:', error.stack);
    console.error('Component stack (where crash occurred):', errorInfo.componentStack);
    console.error('Current route:', window.location.pathname + window.location.search);
    console.groupEnd();
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 md:p-8 flex flex-col items-center justify-center h-full min-h-[300px] text-center space-y-4">
          <div className="bg-red-500/10 p-4 rounded-full">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Oups ! Quelque chose s'est mal passé.</h2>
          <p className="text-muted-foreground max-w-md">
            Une erreur inattendue est survenue dans ce composant. Essayez de recharger la page ou contactez le support si le problème persiste.
          </p>
          <p className="text-xs text-muted-foreground/60 font-mono mt-4 max-w-lg truncate">
            {this.state.error?.message}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium text-sm transition-colors"
          >
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
