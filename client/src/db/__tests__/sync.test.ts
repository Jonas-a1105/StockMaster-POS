import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  const mockStorage: Record<string, string> = { last_synced_at: '2026-01-01T00:00:00.000Z' };
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockStorage[key] = val; },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { for (const k in mockStorage) delete mockStorage[k]; },
    get length() { return Object.keys(mockStorage).length; },
    key: (_i: number) => '',
  };

  (globalThis as any).navigator = { onLine: true };

  const eventListeners: Record<string, Function[]> = {};
  (globalThis as any).window = {
    addEventListener: (event: string, handler: Function) => {
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(handler);
    },
    removeEventListener: vi.fn(),
  };
});

let capturedRequests: Array<{ url: string; init?: RequestInit }> = [];
vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
  capturedRequests.push({ url, init });
  if (url.includes('/pull')) {
    return {
      ok: true,
      json: async () => ({
        success: true, products: [], clients: [], suppliers: [],
        serverTime: '2026-06-04T12:00:00.000Z',
      }),
    };
  }
  return {
    ok: true,
    json: async () => ({ success: true, processedIds: [] }),
  };
}));

const mockSalesFind = vi.fn();
const mockProductsFind = vi.fn();
const mockClientsFind = vi.fn();
const mockSuppliersFind = vi.fn();
const mockPurchasesFind = vi.fn();
const mockPayrollFind = vi.fn();
const mockFindOne = vi.fn();
const mockPatch = vi.fn();
const mockUpsert = vi.fn();

vi.mock('../database', () => ({
  getDatabase: vi.fn(() => Promise.resolve({
    sales: { find: mockSalesFind, findOne: vi.fn(() => ({ exec: vi.fn() })) },
    products: { find: mockProductsFind, upsert: mockUpsert, findOne: vi.fn(() => ({ exec: mockFindOne })) },
    clients: { find: mockClientsFind, upsert: mockUpsert, findOne: vi.fn(() => ({ exec: vi.fn() })) },
    suppliers: { find: mockSuppliersFind, upsert: mockUpsert, findOne: vi.fn(() => ({ exec: vi.fn() })) },
    purchases: { find: mockPurchasesFind, findOne: vi.fn(() => ({ exec: vi.fn(() => ({ patch: mockPatch })) })) },
    payroll: { find: mockPayrollFind, findOne: vi.fn(() => ({ exec: vi.fn(() => ({ patch: mockPatch })) })) },
  })),
}));

vi.mock('../auth', () => ({
  getValidToken: vi.fn(() => Promise.resolve('mock-token')),
}));

import { syncWorker } from '../sync';

describe('syncWorker', () => {
  beforeEach(() => {
    capturedRequests = [];
    mockSalesFind.mockReset();
    mockProductsFind.mockReset();
    mockClientsFind.mockReset();
    mockSuppliersFind.mockReset();
    mockPurchasesFind.mockReset();
    mockPayrollFind.mockReset();
    mockFindOne.mockReset();
    mockPatch.mockReset();
    mockUpsert.mockReset();
    (vi.mocked(fetch) as any).mockClear();
  });

  it('subscribe agrega listener y retorna unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = syncWorker.subscribe(listener);
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('destroy limpia el intervalo', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    syncWorker.destroy();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
