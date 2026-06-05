import { Html5Qrcode } from 'html5-qrcode';

let scanner: Html5Qrcode | null = null;

export type BarcodeCallback = (code: string) => void;

export async function startBarcodeScanner(
  elementId: string,
  onCode: BarcodeCallback,
  onError?: (err: string) => void
): Promise<void> {
  try {
    if (!scanner) {
      scanner = new Html5Qrcode(elementId);
    }

    const config = {
      fps: 15,
      qrbox: { width: 280, height: 120 },
      formatsToSupport: [
        0, // QR_CODE
        1, // DATA_MATRIX
        2, // UPC_E
        3, // UPC_A
        4, // EAN_8
        5, // EAN_13
        6, // CODE_128
        7, // CODE_39
        8, // CODABAR
        11, // ITF
        13, // AZTEC
        15, // MAXICODE
      ],
    };

    await scanner.start(
      { facingMode: 'environment' },
      config,
      (decodedText) => {
        onCode(decodedText);
      },
      (errorMessage) => {
        onError?.(errorMessage);
      }
    );
  } catch (err: any) {
    onError?.(err.message || 'Error al iniciar escáner');
    throw err;
  }
}

export function stopBarcodeScanner(): void {
  if (scanner) {
    scanner.stop().catch(() => {});
    try {
      scanner.clear();
    } catch { /* ignore */ }
    scanner = null;
  }
}

export function isBarcodeSupported(): boolean {
  return !!Html5Qrcode;
}

// Fallback: usar BarcodeDetector nativo del navegador si está disponible
export async function detectBarcodeNative(
  imageData: ImageData
): Promise<string | null> {
  if (!('BarcodeDetector' in window)) return null;

  try {
    const detector = new (window as any).BarcodeDetector({
      formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'],
    });
    const results = await detector.detect(imageData as any);
    return results.length > 0 ? results[0].rawValue : null;
  } catch {
    return null;
  }
}
