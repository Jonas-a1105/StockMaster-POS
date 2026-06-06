import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify, randomBytes, createHash } from 'crypto';

const PLAN_KEYS: Record<string, { name: string; maxUsers: number; multiStore: boolean }> = {
  basic: { name: 'Básica', maxUsers: 1, multiStore: false },
  pro: { name: 'Pro', maxUsers: 5, multiStore: true },
  premium: { name: 'Premium', maxUsers: 50, multiStore: true },
};

const DEMO_KEYS: Record<string, string> = {
  'BASIC-DEMO-5USD': 'basic',
  'PRO-DEMO-12USD': 'pro',
  'PREM-DEMO-25USD': 'premium',
  'PREMIUM-DEMO-25USD': 'premium',
};

export interface LicenseInfo {
  plan: 'basic' | 'pro' | 'premium' | null;
  expiresAt: string | null;
  rif: string | null;
  issuedAt: string;
  keyId: string;
  error: string | null;
}

@Injectable()
export class LicensesService {
  private readonly logger = new Logger('LicensesService');
  private readonly privateKey: string;
  private readonly publicKey: string;

  constructor(private config: ConfigService) {
    this.privateKey = this.normalizePEM(this.config.get<string>('LICENSE_PRIVATE_KEY'));
    this.publicKey = this.normalizePEM(this.config.get<string>('LICENSE_PUBLIC_KEY'));

    if (!this.privateKey || !this.publicKey) {
      this.logger.warn('⚠️  LICENSE_PRIVATE_KEY/LICENSE_PUBLIC_KEY no configuradas. Ejecute `npm run license:gen` y configure las claves.');
    } else {
      const fp = createHash('sha256').update(this.publicKey).digest('hex').substring(0, 12);
      this.logger.log(`🔑 License keys loaded. PUB fingerprint: ${fp} (${this.publicKey.length} chars)`);
    }
  }

  /**
   * Normaliza un PEM leído del .env: convierte "\n" literales a saltos reales
   * y quita comillas externas (simples o dobles) que dotenv puede dejar.
   */
  private normalizePEM(raw: string | undefined | null): string {
    if (!raw) return '';
    return raw
      .replace(/\\n/g, '\n')
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  /** Genera un par de claves Ed25519 (uso CLI). */
  static generateKeyPair(): { privateKey: string; publicKey: string } {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    return {
      privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    };
  }

  /** Firma una licencia: SM-{PLAN}-{RIF}-{EXPIRY}-{KEYID}-{SIG_B64} */
  signLicense(plan: 'basic' | 'pro' | 'premium', rif: string, expiry: string): string {
    if (!this.privateKey) {
      throw new BadRequestException('Servidor no configurado para emitir licencias. Falta LICENSE_PRIVATE_KEY.');
    }
    if (!PLAN_KEYS[plan]) throw new BadRequestException('Plan inválido.');

    const keyId = randomBytes(4).toString('hex').toUpperCase();
    const payload = `${plan}|${rif.toUpperCase()}|${expiry}|${keyId}`;
    const keyObj = createPrivateKey(this.privateKey);
    const sig = sign(null, Buffer.from(payload, 'utf8'), keyObj);
    // base64 estándar: caracteres A-Z a-z 0-9 + / =. No contiene '-', no choca con el separador.
    const sigB64 = sig.toString('base64').replace(/=+$/, '');

    return `SM-${plan.toUpperCase()}-${rif.toUpperCase()}-${expiry}-${keyId}-${sigB64}`;
  }

  /**
   * Valida una licencia con firma Ed25519.
   * - En desarrollo, acepta DEMO_KEYS hardcoded.
   * - En producción, verifica firma criptográfica con la clave pública.
   */
  async validateLicenseKey(key: string): Promise<{ plan: string | null; expiresAt: string | null; rif: string | null; error: string | null }> {
    const trimmed = key.trim();
    const normalizedUpper = trimmed.toUpperCase();

    // Demo keys solo en dev
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && DEMO_KEYS[normalizedUpper]) {
      const demoExpiry = new Date();
      demoExpiry.setDate(demoExpiry.getDate() + 30);
      return {
        plan: DEMO_KEYS[normalizedUpper],
        expiresAt: demoExpiry.toISOString(),
        rif: 'DEMO',
        error: null,
      };
    }

    // Formato: SM-{PLAN}-{RIF}-{EXPIRY}-{KEYID}-{SIG_B64}
    // La firma usa base64 estándar (sin '=' padding) y NO contiene '-', así que split por '-' es seguro.
    // IMPORTANTE: NO convertir a mayúsculas ANTES del split porque la firma es case-sensitive.
    const firstDash = trimmed.indexOf('-');
    if (firstDash < 0 || trimmed.substring(0, firstDash) !== 'SM') {
      return { plan: null, expiresAt: null, rif: null, error: 'Formato de llave inválido.' };
    }
    const rest = trimmed.substring(firstDash + 1);
    const fields = rest.split('-', 4); // PLAN, RIF, EXPIRY, KEYID
    if (fields.length < 4) {
      return { plan: null, expiresAt: null, rif: null, error: 'Formato de llave inválido.' };
    }
    const [planRaw, rif, expiryStr, keyId] = fields;
    const plan = planRaw.toLowerCase();
    if (!PLAN_KEYS[plan]) {
      return { plan: null, expiresAt: null, rif: null, error: 'Tipo de plan inválido.' };
    }

    // El resto después de los 4 campos es la firma (case-sensitive)
    const lastDash = rest.lastIndexOf('-');
    const sigB64 = lastDash > 0 ? rest.substring(lastDash + 1) : '';
    if (!sigB64) {
      return { plan: null, expiresAt: null, rif, error: 'Firma ausente.' };
    }

    if (!this.publicKey) {
      return { plan: null, expiresAt: null, rif, error: 'Servidor sin clave pública configurada.' };
    }

    // Verificar firma Ed25519
    const payload = `${plan}|${rif}|${expiryStr}|${keyId}`;
    let verified = false;
    try {
      const keyObj = createPublicKey(this.publicKey);
      verified = verify(null, Buffer.from(payload, 'utf8'), keyObj, Buffer.from(sigB64, 'base64'));
    } catch (err) {
      this.logger.error(`Error verificando firma de licencia: ${(err as Error).message}`);
      return { plan: null, expiresAt: null, rif, error: 'Firma corrupta o mal codificada.' };
    }

    if (!verified) {
      return { plan: null, expiresAt: null, rif, error: 'La firma de la licencia es inválida o fue alterada.' };
    }

    // Parsear y validar expiry (YYYYMMDD o YYYYMMDDHHmmss)
    const expiryDate = this.parseExpiryString(expiryStr);
    if (!expiryDate) {
      return { plan: null, expiresAt: null, rif, error: 'Fecha de expiración inválida.' };
    }
    if (Date.now() > expiryDate.getTime()) {
      return { plan, expiresAt: expiryDate.toISOString(), rif, error: 'La licencia ha expirado.' };
    }

    return { plan, expiresAt: expiryDate.toISOString(), rif, error: null };
  }

  private parseExpiryString(s: string): Date | null {
    if (s.length === 8) {
      const y = +s.slice(0, 4), m = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
      const date = new Date(y, m, d, 23, 59, 59);
      return isNaN(date.getTime()) ? null : date;
    }
    if (s.length === 14) {
      const y = +s.slice(0, 4), mo = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
      const h = +s.slice(8, 10), mi = +s.slice(10, 12), se = +s.slice(12, 14);
      const date = new Date(y, mo, d, h, mi, se);
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  }
}
