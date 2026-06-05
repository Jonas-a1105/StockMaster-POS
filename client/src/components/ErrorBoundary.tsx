import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

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
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--card-radius)',
          border: '2px dashed var(--border-color)',
          margin: '20px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <ShieldAlert size={36} />
          </div>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '10px',
            fontFamily: 'var(--font-main)'
          }}>
            ¡Algo salió mal en esta vista!
          </h2>
          <p style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            maxWidth: '500px',
            marginBottom: '24px',
            lineHeight: '1.5'
          }}>
            Ocurrió un error inesperado al procesar la interfaz. Por favor, intenta recargar la sección.
          </p>
          {this.state.error && (
            <pre style={{
              textAlign: 'left',
              width: '100%',
              maxWidth: '600px',
              padding: '16px',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '12px',
              border: '1.5px solid var(--border-color)',
              color: '#ef4444',
              fontFamily: 'monospace',
              fontSize: '12px',
              overflowX: 'auto',
              marginBottom: '24px',
              maxHeight: '150px'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="btn-pill-dark"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              borderRadius: 'var(--button-radius)',
              backgroundColor: 'var(--brand-primary)',
              color: '#fff',
              border: 'none',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(14, 165, 164, 0.3)'
            }}
          >
            <RefreshCw size={16} />
            <span>Recargar Aplicación</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
