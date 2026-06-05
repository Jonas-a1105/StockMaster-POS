import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function Bomb() {
  throw new Error('explosion');
}

describe('ErrorBoundary', () => {
  it('renderiza children cuando no hay error', () => {
    render(<ErrorBoundary><div>ok</div></ErrorBoundary>);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });

  it('captura error y muestra UI de fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByText(/algo salió mal/i)).toBeInTheDocument();
    expect(screen.getByText(/explosion/)).toBeInTheDocument();
    (console.error as any).mockRestore();
  });

  it('usa fallback personalizado si se provee', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary fallback={<div>custom error</div>}><Bomb /></ErrorBoundary>);
    expect(screen.getByText('custom error')).toBeInTheDocument();
    (console.error as any).mockRestore();
  });

  it('renderiza botón de recargar en la UI de fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary><Bomb /></ErrorBoundary>);
    expect(screen.getByRole('button', { name: /recargar aplicación/i })).toBeInTheDocument();
    (console.error as any).mockRestore();
  });
});
