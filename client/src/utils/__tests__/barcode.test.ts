import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClear = vi.fn();
const mockStop = vi.fn().mockResolvedValue(undefined);
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: mockStop,
    clear: mockClear,
  })),
}));

import { isBarcodeSupported, stopBarcodeScanner, detectBarcodeNative } from '../barcode';

describe('barcode', () => {
  beforeEach(() => {
    mockClear.mockClear();
    mockStop.mockClear();
  });

  describe('isBarcodeSupported', () => {
    it('returns true when Html5Qrcode is available', () => {
      expect(isBarcodeSupported()).toBe(true);
    });
  });

  describe('stopBarcodeScanner', () => {
    it('does not throw when no scanner is active', () => {
      expect(() => stopBarcodeScanner()).not.toThrow();
    });
  });

  describe('detectBarcodeNative', () => {
    it('returns null when BarcodeDetector is not available', async () => {
      const result = await detectBarcodeNative({} as ImageData);
      expect(result).toBeNull();
    });
  });
});
