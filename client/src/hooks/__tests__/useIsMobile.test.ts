import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../useIsMobile';

describe('useIsMobile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna true cuando ventana es menor al breakpoint', () => {
    (globalThis as any).innerWidth = 500;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('retorna false cuando ventana es mayor al breakpoint', () => {
    (globalThis as any).innerWidth = 1024;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('usa breakpoint personalizado', () => {
    (globalThis as any).innerWidth = 900;
    const { result } = renderHook(() => useIsMobile(1024));
    expect(result.current).toBe(true);
  });

  it('actualiza al cambiar tamaño de ventana', () => {
    (globalThis as any).innerWidth = 1024;
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    act(() => {
      (globalThis as any).innerWidth = 600;
      (globalThis as any).dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);
  });
});
