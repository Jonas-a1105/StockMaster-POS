import { API_URL } from '../config';

export interface LicenseState {
  plan: 'basic' | 'pro' | 'premium' | null;
  key: string | null;
  expiresAt: string | null;
  rif: string | null;
  demoStartedAt: number | null;
  demoActive: boolean;
  demoTimeLeft: number;
  isLocked: boolean;
  isExpired: boolean;
  error: string | null;
}

export interface LicenseExpiryInfo {
  expiresAt: Date | null;
  isExpired: boolean;
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
  urgency: 'ok' | 'warning' | 'danger' | 'expired';
  percentage: number;
}

const DEMO_DURATION_SEC = 5 * 60;

/**
 * Clave pública Ed25519 embebida en el cliente.
 * Se usa para verificar criptográficamente las licencias firmadas por el servidor.
 * Generada con: `cd server && npm run license:gen`
 */
const LICENSE_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEApu+RMes2avsGpiKZVhSoiM3Pl9d32oWK8iWNmxvMpaE=
-----END PUBLIC KEY-----`;

// ── DEMO keys (solo dev). En producción se eliminan. ───────────────────
const DEMO_KEYS: Record<string, string> = {
  'BASIC-DEMO-5USD': 'basic',
  'PRO-DEMO-12USD': 'pro',
  'PREM-DEMO-25USD': 'premium',
  'PREMIUM-DEMO-25USD': 'premium',
};

// ── Helpers Web Crypto API (Nativo, sin libs) ─────────────────────────
function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const b64std = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64std.length % 4;
  const padded = pad ? b64std + '='.repeat(4 - pad) : b64std;
  const binary = atob(padded);
  const buf = new ArrayBuffer(binary.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return buf;
}

async function importPublicKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(LICENSE_PUBLIC_KEY_PEM),
    { name: 'Ed25519' },
    false,
    ['verify']
  );
}

async function verifyEd25519(message: string, signatureB64Url: string): Promise<boolean> {
  try {
    const key = await importPublicKey();
    const sig = base64UrlToBytes(signatureB64Url);
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      sig,
      new TextEncoder().encode(message)
    );
  } catch {
    return false;
  }
}

// ── Parsers ───────────────────────────────────────────────────────────
function parseExpiryString(s: string): Date | null {
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

// ── Validación local con Ed25519 ──────────────────────────────────────
async function verifyLicenseKeyLocal(key: string): Promise<{ plan: 'basic' | 'pro' | 'premium' | null; expiresAt: string | null; rif: string | null; error: string | null }> {
  const normalized = key.trim().toUpperCase();

  // Demo keys solo en localhost
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  if (isDev && DEMO_KEYS[normalized]) {
    const demoExpiry = new Date();
    demoExpiry.setDate(demoExpiry.getDate() + 30);
    return { plan: DEMO_KEYS[normalized] as any, expiresAt: demoExpiry.toISOString(), rif: 'DEMO', error: null };
  }

  // Formato: SM-{PLAN}-{RIF}-{EXPIRY}-{KEYID}-{SIG_B64}
  // La firma usa base64 estándar (sin padding) y NO contiene '-'.
  // IMPORTANTE: NO convertir a mayúsculas la firma porque base64 es case-sensitive.
  const trimmed = key.trim();
  const firstDash = trimmed.indexOf('-');
  if (firstDash < 0 || trimmed.substring(0, firstDash) !== 'SM') {
    return { plan: null, expiresAt: null, rif: null, error: 'Formato de llave inválido.' };
  }
  const rest = trimmed.substring(firstDash + 1);
  const fields = rest.split('-', 4);
  if (fields.length < 4) {
    return { plan: null, expiresAt: null, rif: null, error: 'Formato de llave inválido.' };
  }
  const [planRaw, rif, expiryStr, keyId] = fields;
  const plan = planRaw.toLowerCase() as 'basic' | 'pro' | 'premium';
  if (!['basic', 'pro', 'premium'].includes(plan)) {
    return { plan: null, expiresAt: null, rif: null, error: 'Tipo de plan inválido.' };
  }

  const lastDash = rest.lastIndexOf('-');
  const sigB64 = lastDash > 0 ? rest.substring(lastDash + 1) : '';
  if (!sigB64) {
    return { plan: null, expiresAt: null, rif, error: 'Firma ausente.' };
  }
  // Web Crypto solo soporta base64url; convertimos base64 → base64url
  const sigB64Url = sigB64.replace(/\+/g, '-').replace(/\//g, '_');

  // Verificar firma Ed25519
  const payload = `${plan}|${rif}|${expiryStr}|${keyId}`;
  const valid = await verifyEd25519(payload, sigB64Url);
  if (!valid) {
    return { plan: null, expiresAt: null, rif, error: 'La firma de la licencia es inválida o fue alterada.' };
  }

  // Validar expiry
  if (expiryStr.length !== 8 && expiryStr.length !== 14) {
    return { plan: null, expiresAt: null, rif, error: 'Formato de fecha inválido.' };
  }
  const expiryDate = parseExpiryString(expiryStr);
  if (!expiryDate) return { plan: null, expiresAt: null, rif, error: 'Fecha de expiración inválida.' };
  if (Date.now() > expiryDate.getTime()) {
    return { plan, expiresAt: expiryDate.toISOString(), rif, error: 'La licencia ha expirado.' };
  }

  return { plan, expiresAt: expiryDate.toISOString(), rif, error: null };
}

export async function verifyLicenseKey(key: string | null): Promise<{ plan: 'basic' | 'pro' | 'premium' | null; expiresAt: string | null; rif: string | null; error: string | null }> {
  if (!key) return { plan: null, expiresAt: null, rif: null, error: null };

  // Validación server-side (autoritativa)
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const res = await fetch(`${API_URL}/licenses/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        const data = await res.json();
        return { plan: data.plan, expiresAt: data.expiresAt || null, rif: data.rif || null, error: data.error };
      }
    } catch {
      // Fallback local
    }
  }

  return verifyLicenseKeyLocal(key);
}

export function getLicenseExpiryInfo(expiresAtISO: string | null): LicenseExpiryInfo {
  if (!expiresAtISO) {
    return {
      expiresAt: null, isExpired: true, totalSeconds: 0,
      days: 0, hours: 0, minutes: 0, seconds: 0,
      label: 'Sin fecha de expiración', urgency: 'expired', percentage: 0,
    };
  }

  const expiresAt = new Date(expiresAtISO);
  const diffMs = expiresAt.getTime() - Date.now();
  const isExpired = diffMs <= 0;
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let label: string;
  let urgency: 'ok' | 'warning' | 'danger' | 'expired';

  if (isExpired) {
    label = 'Licencia expirada';
    urgency = 'expired';
  } else if (days > 90) {
    label = `${days} días restantes`;
    urgency = 'ok';
  } else if (days > 30) {
    label = `${days} días restantes`;
    urgency = 'warning';
  } else if (days > 0) {
    label = `${days}d ${hours}h restantes`;
    urgency = 'danger';
  } else if (hours > 0) {
    label = `${hours}h ${minutes}m restantes`;
    urgency = 'danger';
  } else if (minutes > 0) {
    label = `${minutes}m ${seconds}s restantes`;
    urgency = 'danger';
  } else {
    label = `${seconds}s restantes`;
    urgency = 'danger';
  }

  const maxDays = 365;
  const percentage = isExpired ? 0 : Math.min(100, (days / maxDays) * 100);

  return { expiresAt, isExpired, totalSeconds, days, hours, minutes, seconds, label, urgency, percentage };
}

export function getLicenseState(): LicenseState {
  const key = localStorage.getItem('license_key') || null;
  const expiresAt = localStorage.getItem('license_expires_at') || null;
  const rif = localStorage.getItem('license_rif') || null;
  const demoStartedAtRaw = localStorage.getItem('demo_start_time');
  const demoStartedAt = demoStartedAtRaw ? parseInt(demoStartedAtRaw, 10) : null;

  let demoActive = localStorage.getItem('demo_active') === 'true';
  let demoTimeLeft = 0;

  if (demoActive && demoStartedAt) {
    const elapsed = Math.floor((Date.now() - demoStartedAt) / 1000);
    demoTimeLeft = Math.max(0, DEMO_DURATION_SEC - elapsed);
    if (demoTimeLeft === 0) {
      demoActive = false;
      localStorage.setItem('demo_active', 'false');
    }
  } else {
    demoActive = false;
  }

  const cachedPlan = localStorage.getItem('license_plan') as 'basic' | 'pro' | 'premium' | null;
  let plan = cachedPlan || null;

  let isExpired = false;
  if (plan && expiresAt) {
    const expiryDate = new Date(expiresAt);
    if (!isNaN(expiryDate.getTime()) && Date.now() > expiryDate.getTime()) {
      isExpired = true;
      plan = null;
      localStorage.removeItem('license_plan');
    }
  }

  const isLocked = !plan && !demoActive;

  return { plan, key, expiresAt, rif, demoStartedAt, demoActive, demoTimeLeft, isLocked, isExpired, error: null };
}

export function startDemo() {
  localStorage.setItem('demo_start_time', Date.now().toString());
  localStorage.setItem('demo_active', 'true');
}

export function stopDemo() {
  localStorage.removeItem('demo_start_time');
  localStorage.setItem('demo_active', 'false');
}

export async function activateLicense(key: string): Promise<{ plan: 'basic' | 'pro' | 'premium' | null; expiresAt: string | null; rif: string | null }> {
  const verification = await verifyLicenseKey(key);

  if (verification.plan) {
    localStorage.setItem('license_plan', verification.plan);
    localStorage.setItem('license_key', key.trim().toUpperCase());
    localStorage.setItem('demo_active', 'false');
    if (verification.expiresAt) {
      localStorage.setItem('license_expires_at', verification.expiresAt);
    }
    if (verification.rif) {
      localStorage.setItem('license_rif', verification.rif);
    }
    return { plan: verification.plan, expiresAt: verification.expiresAt, rif: verification.rif };
  }

  return { plan: null, expiresAt: null, rif: null };
}

export function deactivateLicense() {
  localStorage.removeItem('license_plan');
  localStorage.removeItem('license_key');
  localStorage.removeItem('license_expires_at');
  localStorage.removeItem('license_rif');
  localStorage.removeItem('demo_active');
  localStorage.removeItem('demo_start_time');
}

export const PLAN_LIMITS = {
  basic: {
    maxProducts: 10,
    maxClients: 10,
    maxSales: 20,
    allowedTabs: ['dashboard', 'pos', 'inventario', 'cierre', 'about'],
  },
  pro: {
    maxProducts: 100,
    maxClients: 50,
    maxSales: 200,
    allowedTabs: ['dashboard', 'pos', 'inventario', 'compras', 'clientes', 'proveedores', 'cierre', 'about'],
  },
  premium: {
    maxProducts: Infinity,
    maxClients: Infinity,
    maxSales: Infinity,
    allowedTabs: ['dashboard', 'pos', 'inventario', 'compras', 'nomina', 'clientes', 'proveedores', 'cierre', 'analiticas', 'auditoria', 'settings', 'users', 'about', 'profile'],
  },
};
