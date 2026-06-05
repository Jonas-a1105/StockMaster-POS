import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.VITE_API_URL;
  });

  it('usa variable de entorno VITE_API_URL si está definida', async () => {
    process.env.VITE_API_URL = 'https://api.example.com';
    vi.resetModules();
    const mod = await import('../config');
    expect(mod.API_URL).toBe('https://api.example.com');
  });

  it('usa fallback localhost si no hay variable de entorno', async () => {
    vi.resetModules();
    const mod = await import('../config');
    expect(mod.API_URL).toBe('http://localhost:3000');
  });
});
