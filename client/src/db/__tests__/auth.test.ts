import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLocalStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockLocalStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { mockLocalStorage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete mockLocalStorage[key]; }),
  clear: vi.fn(() => { for (const k in mockLocalStorage) delete mockLocalStorage[k]; }),
  get length() { return Object.keys(mockLocalStorage).length; },
  key: vi.fn((_index: number) => ''),
};

vi.stubGlobal('localStorage', localStorageMock);

vi.mock('../../db/database', () => ({
  getDatabase: vi.fn(),
}));

let capturedUrl = '';
let capturedInit: RequestInit | undefined;
const mockFetch = vi.fn(async (url: string, init?: RequestInit) => {
  capturedUrl = url;
  capturedInit = init;
  return { ok: true, json: async () => ({ accessToken: 'new_token', refreshToken: 'new_refresh' }) };
});
vi.stubGlobal('fetch', mockFetch);

import { getValidToken, logout, isOnline } from '../auth';

function makeJwt(payload: object): string {
  const b64 = JSON.stringify(payload);
  return `header.${btoa(b64)}.signature`;
}

describe('auth', () => {
  beforeEach(() => {
    for (const k in mockLocalStorage) delete mockLocalStorage[k];
    mockFetch.mockClear();
    capturedUrl = '';
    capturedInit = undefined;
  });

  describe('isOnline', () => {
    it('returns navigator.onLine', () => {
      vi.stubGlobal('navigator', { onLine: true });
      expect(isOnline()).toBe(true);
    });

    it('returns false when offline', () => {
      vi.stubGlobal('navigator', { onLine: false });
      expect(isOnline()).toBe(false);
    });
  });

  describe('logout', () => {
    it('removes tokens from localStorage', () => {
      mockLocalStorage['auth_token'] = 'tok';
      mockLocalStorage['auth_refresh_token'] = 'rtok';
      mockLocalStorage['auth_user'] = '{}';

      logout();

      expect(mockLocalStorage['auth_token']).toBeUndefined();
      expect(mockLocalStorage['auth_refresh_token']).toBeUndefined();
      expect(mockLocalStorage['auth_user']).toBeUndefined();
    });

    it('calls logout endpoint when tokens exist', () => {
      mockLocalStorage['auth_token'] = 'tok';
      mockLocalStorage['auth_refresh_token'] = 'rtok';

      logout();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/auth\/logout$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        }),
      );
    });

    it('does not call logout endpoint when no tokens', () => {
      logout();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('getValidToken', () => {
    it('returns null when no token in storage', async () => {
      const result = await getValidToken();
      expect(result).toBeNull();
    });

    it('returns token when it is still fresh', async () => {
      const future = Math.floor(Date.now() / 1000) + 600;
      const token = makeJwt({ exp: future, sub: '1' });
      mockLocalStorage['auth_token'] = token;

      const result = await getValidToken();

      expect(result).toBe(token);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('refreshes token when expiring soon', async () => {
      const soon = Math.floor(Date.now() / 1000) + 60;
      const token = makeJwt({ exp: soon, sub: '1' });
      mockLocalStorage['auth_token'] = token;
      mockLocalStorage['auth_refresh_token'] = 'old_refresh';

      const result = await getValidToken();

      expect(result).toBe('new_token');
      expect(capturedUrl).toContain('/auth/refresh');
    });

    it('returns null and clears storage on refresh failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
      const soon = Math.floor(Date.now() / 1000) + 60;
      mockLocalStorage['auth_token'] = makeJwt({ exp: soon, sub: '1' });
      mockLocalStorage['auth_refresh_token'] = 'old_refresh';

      const result = await getValidToken();

      expect(result).toBeNull();
    });

    it('refreshes token when JWT payload is malformed', async () => {
      mockLocalStorage['auth_token'] = 'not.a.valid.jwt';
      mockLocalStorage['auth_refresh_token'] = 'old_refresh';

      const result = await getValidToken();

      expect(result).toBe('new_token');
    });
  });
});
