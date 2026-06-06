#!/usr/bin/env ts-node
/**
 * Firma una licencia StockMaster para un plan/RIF/fecha dados.
 *
 * Uso:
 *   cd server
 *   npx ts-node src/scripts/sign-license.ts <plan> <rif> <expiry>
 *
 * Ejemplos:
 *   npx ts-node src/scripts/sign-license.ts pro J123456789 20271231
 *   npx ts-node src/scripts/sign-license.ts premium V987654321 20271231235959
 *   npx ts-node src/scripts/sign-license.ts basic J123456789 20271231
 *
 * Argumentos:
 *   plan     - 'basic' | 'pro' | 'premium'
 *   rif      - RIF del cliente (sin guiones, ej: J123456789)
 *   expiry   - Fecha de expiración en formato YYYYMMDD (fin del día) o YYYYMMDDHHmmss (preciso)
 *
 * Requiere LICENSE_PRIVATE_KEY en .env (generada con `npm run license:gen`).
 */
import { config as loadDotenv } from 'dotenv';
import { LicensesService } from '../licenses/licenses.service';

loadDotenv();

const [, , planArg, rifArg, expiryArg] = process.argv;

if (!planArg || !rifArg || !expiryArg) {
  console.error('\n❌ Faltan argumentos.\n');
  console.error('Uso: npx ts-node src/scripts/sign-license.ts <plan> <rif> <expiry>');
  console.error('  plan:   basic | pro | premium');
  console.error('  rif:    ej. J123456789');
  console.error('  expiry: YYYYMMDD o YYYYMMDDHHmmss\n');
  process.exit(1);
}

if (!['basic', 'pro', 'premium'].includes(planArg)) {
  console.error(`❌ Plan inválido: ${planArg}. Use basic, pro o premium.`);
  process.exit(1);
}

if (!process.env.LICENSE_PRIVATE_KEY) {
  console.error('❌ LICENSE_PRIVATE_KEY no está en .env. Ejecute primero: npm run license:gen');
  process.exit(1);
}

const fakeConfig = {
  get: (key: string) => process.env[key],
} as any;

// Instanciamos el service solo para usar el método estático de signLicense
// (no necesita Prisma ni otras dependencias para firmar)
const { generateKeyPairSync, createPrivateKey, sign, randomBytes } = require('crypto');

function signLicense(plan: string, rif: string, expiry: string): string {
  const keyId = randomBytes(4).toString('hex').toUpperCase();
  const payload = `${plan}|${rif.toUpperCase()}|${expiry}|${keyId}`;
  // Normalizar \n literales (Windows dotenv) a saltos reales
  const privKeyRaw = (process.env.LICENSE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const keyObj = createPrivateKey(privKeyRaw);
  const sig = sign(null, Buffer.from(payload, 'utf8'), keyObj);
  // base64 estándar (sin '=' padding) para no chocar con el separador '-'
  const sigB64 = sig.toString('base64').replace(/=+$/, '');
  return `SM-${plan.toUpperCase()}-${rif.toUpperCase()}-${expiry}-${keyId}-${sigB64}`;
}

try {
  const key = signLicense(planArg, rifArg, expiryArg);
  console.log('\n✅ Licencia firmada:\n');
  console.log(`  ${key}\n`);
  console.log('Cópiala y pégala en:');
  console.log('  • LocalStorage del cliente: license_key');
  console.log('  • Endpoint:  POST /licenses/validate  con { "key": "<licencia>" }');
  console.log('  • CLI cliente: desde la pantalla de activación\n');

  // Mostrar fecha de expiración legible
  const s = expiryArg;
  let exp: Date;
  if (s.length === 8) {
    exp = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), 23, 59, 59);
  } else {
    exp = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
  }
  console.log(`Plan: ${planArg.toUpperCase()} | RIF: ${rifArg.toUpperCase()} | Expira: ${exp.toISOString()}\n`);
} catch (err) {
  console.error('❌ Error firmando licencia:', (err as Error).message);
  process.exit(1);
}
