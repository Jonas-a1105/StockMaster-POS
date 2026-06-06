#!/usr/bin/env ts-node
/**
 * Genera un par de claves Ed25519 para firmar/verificar licencias.
 *
 * Uso:
 *   cd server && npx ts-node src/scripts/gen-license-keys.ts
 *
 * Si encuentra LICENSE_PRIVATE_KEY/LICENSE_PUBLIC_KEY en .env, los reemplaza
 * automáticamente con saltos de línea reales (no escape \n).
 *
 * ⚠️  La clave privada debe permanecer SECRETA. No commitear.
 */
import { config as loadDotenv } from 'dotenv';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { LicensesService } from '../licenses/licenses.service';

loadDotenv();

const { privateKey, publicKey } = LicensesService.generateKeyPair();

// Formato "dotenv-safe": saltos de línea literales entre BEGIN/END.
// dotenv en Windows a veces interpreta "\n" como literal; usamos multiline
// real para máxima compatibilidad.
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  let envContent = readFileSync(envPath, 'utf-8');
  const setKey = (key: string, value: string) => {
    const re = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}="${value.replace(/\r?\n/g, '\n')}"`;
    if (re.test(envContent)) {
      envContent = envContent.replace(re, line);
    } else {
      envContent += `\n${line}\n`;
    }
  };
  setKey('LICENSE_PRIVATE_KEY', privateKey);
  setKey('LICENSE_PUBLIC_KEY', publicKey);
  writeFileSync(envPath, envContent, 'utf-8');
  console.log(`\n✅ Claves escritas en ${envPath}`);
}

console.log('\n=== Par de claves Ed25519 generado ===\n');
console.log('LICENSE_PRIVATE_KEY (PEM):');
console.log(privateKey);
console.log('LICENSE_PUBLIC_KEY  (PEM):');
console.log(publicKey);
console.log('\n📋 Para el cliente (pegar en client/src/utils/license.ts):\n');
console.log(`const LICENSE_PUBLIC_KEY_PEM = \`${publicKey}\`;\n`);
console.log('⚠️  La clave privada debe permanecer SECRETA. No commitear al repo.\n');
