import { getDatabase } from './database';
import { API_URL } from '../config';
import * as bcrypt from 'bcryptjs';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
const TOKEN_REFRESH_MARGIN_MS = 120_000; // Refrescar 2 minutos antes de expirar

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

async function doRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('auth_refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      logout();
      return null;
    }
    const data = await res.json();
    localStorage.setItem('auth_token', data.accessToken);
    localStorage.setItem('auth_refresh_token', data.refreshToken);
    scheduleTokenRefresh();
    return data.accessToken;
  } catch {
    logout();
    return null;
  }
}

function scheduleTokenRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  // Refrescar cada 13 minutos (15 min - 2 min margen)
  refreshTimer = setTimeout(async () => {
    await doRefreshToken();
  }, 13 * 60 * 1000);
}

export async function getValidToken(): Promise<string | null> {
  let token = localStorage.getItem('auth_token');
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expMs = payload.exp * 1000;
    if (Date.now() >= expMs - TOKEN_REFRESH_MARGIN_MS) {
      token = await doRefreshToken();
    }
  } catch {
    token = await doRefreshToken();
  }

  return token;
}

export async function registerOnline(payload: {
  email: string;
  password: string;
  name: string;
  role: string;
  pin?: string;
}) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error al registrar.');
  return data;
}

export async function loginOnline(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Credenciales inválidas.');

  const { accessToken, refreshToken, user } = data;

  localStorage.setItem('auth_token', accessToken);
  localStorage.setItem('auth_refresh_token', refreshToken);
  localStorage.setItem('auth_user', JSON.stringify({ ...user, offline: false }));
  scheduleTokenRefresh();

  const localPwHash = await sha256(password);
  const localPinHash = user.pin || undefined;
  const db = await getDatabase();

  await db.users.upsert({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    passwordHash: localPwHash,
    ...(localPinHash && { pinHash: localPinHash }),
    updatedAt: new Date().toISOString(),
  });

  return { success: true, user, offline: false };
}

export async function loginOffline(email: string, passwordOrPin: string, isPin = false) {
  const db = await getDatabase();

  const localUserDoc = await db.users.findOne({
    selector: { email: email.toLowerCase() },
  }).exec();

  if (!localUserDoc) {
    throw new Error('Usuario no encontrado en caché local. Inicie sesión online primero.');
  }

  const localUser = localUserDoc.toJSON();
  let isMatch = false;

  if (isPin) {
    if (!localUser.pinHash) throw new Error('PIN no configurado para este usuario.');
    isMatch = await bcrypt.compare(passwordOrPin, localUser.pinHash);
  } else {
    isMatch = (await sha256(passwordOrPin)) === localUser.passwordHash;
  }

  if (!isMatch) throw new Error('PIN o Contraseña incorrecta.');

  const userSession = { id: localUser.id, email: localUser.email, name: localUser.name, role: localUser.role, offline: true };
  localStorage.removeItem('auth_token');
  localStorage.setItem('auth_user', JSON.stringify(userSession));

  return { success: true, user: userSession, offline: true };
}

export function logout() {
  if (refreshTimer) clearTimeout(refreshTimer);
  const refreshToken = localStorage.getItem('auth_refresh_token');
  const token = localStorage.getItem('auth_token');

  if (token && refreshToken) {
    fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }

  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_refresh_token');
  localStorage.removeItem('auth_user');
}

export function isOnline(): boolean {
  return navigator.onLine;
}
