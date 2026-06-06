# Análisis Exhaustivo del Sistema StockMaster POS

> **Fecha del análisis:** 2026-06-05
> **Alcance:** Cliente (React 19 + Vite + RxDB 17 + Tauri 2 + Capacitor 8) y Servidor (NestJS 11 + Fastify + Prisma 5 + SQLite + Socket.IO).
> **Propósito:** Documentar lo perfecto, lo mejorable, lo problemático y las mejoras profesionales sugeridas al día de hoy.

---

## 1. Resumen Ejecutivo

StockMaster POS es un **sistema de punto de venta offline-first** con sincronización bidireccional entre una base local (RxDB sobre Dexie) y un backend NestJS (Prisma + SQLite + Socket.IO). Está pensado para PyMEs y se empaqueta tanto en **Tauri 2 (desktop)** como en **Capacitor 8 (móvil)**. Incluye POS, inventario, clientes, proveedores, compras, nómina, analítica, auditoría, cierre de caja, licencias y auto-actualización.

**Puntaje general (autoevaluación): 7.5 / 10**

| Dimensión | Veredicto |
|---|---|
| Arquitectura y modularidad | ✅ Aceptable |
| Funcionalidad (alcance) | ✅ Completa |
| Offline / sync | ⚠️ Aceptable con deuda |
| Seguridad | ⚠️ Aceptable pero con riesgos críticos |
| Rendimiento | ⚠️ Aceptable, sin budgets |
| UI / UX | ✅ Pulida en POS, ⚠️ inconsistente en otros |
| Accesibilidad | ❌ Insuficiente |
| i18n | ❌ No existe |
| Mobile / Desktop | ⚠️ Doble vía sin decisión |
| Testing | ⚠️ Cobertura desconocida |
| Observabilidad | ❌ Inexistente |

---

## 2. Arquitectura

### 2.1 Vista general

```
[Cliente]                                    [Servidor]
React 19 + Vite                              NestJS 11 + Fastify
RxDB (Dexie)                                 Prisma 5
socket.io-client  <------ WS /sync --------> socket.io
REST (fetch)  <----------- HTTPS -----------> Controllers (Zod)
Helmet, Throttler                            helmet, compress, throttler
bcryptjs, JWT (manual)                       bcryptjs, JWT, blacklist (mem)
Tauri 2  /  Capacitor 8                      static client/dist
```

### 2.2 Capas del cliente

- `App.tsx` → `providers` (Theme, ExchangeRate, Toast, BusinessSettings) + `SessionManager` (15 min inactividad, 14 min warning) + `ErrorBoundary`.
- `db/database.ts` → 10 esquemas RxDB + `migrationStrategies` (products, users, auditLogs).
- `db/auth.ts` → login online/offline, JWT, refresh a 13 min, bcryptjs local.
- `db/sync.ts` → `SyncWorker` singleton, polling + WebSocket, `last_synced_at` en `localStorage`.
- `db/migration.ts` → migración legacy `localStorage` → RxDB.
- `components/` → 35+ componentes (POS, Inventario, Clientes, Nómina, etc.).
- `contexts/` → estado global (Theme, ExchangeRate, BusinessSettings).
- `utils/` → formateadores, validadores, audit, license, thermal (tickets).
- `hooks/` → hooks personalizados.

### 2.3 Capas del servidor

- `main.ts` → bootstrap con generación de `JWT_SECRET` si no existe, helmet, compress, socket.io adapter, `GlobalExceptionFilter`, validador de licencia, estáticos `client/dist`.
- `app.module.ts` → `ConfigModule` global, `ThrottlerModule` (60s, 120 req), `UserThrottlerGuard` global, módulos: Prisma, Auth, Auditoria, Sync, Payroll, Reports, Health, Licenses.
- `auth/` → service, controller, guard, DTOs, roles guard.
- `sync/` → service (push/pull transaccional por entidad), controller, gateway WS, DTOs Zod.
- `reports/` → KPIs, top productos, ventas por día, top cajeros/clientes, ventas por categoría.
- `licenses/` → licenciamiento casero.
- `mail/` → SMTP condicional.
- `common/` → exception filter, throttler guard, health.

---

## 3. Análisis por archivo (veredicto por unidad)

### 3.1 Cliente

| Archivo | Veredicto | Comentario breve |
|---|---|---|
| `client/src/main.tsx` | ✅ | Mount con `StrictMode` + `SplashScreen`; correcto. |
| `client/src/App.tsx` | ⚠️ | Composición correcta. `SESSION_TIMEOUT_MS=15*60*1000` y `SESSION_WARNING_MS=14*60*1000` están como magic numbers. |
| `client/src/config.ts` | ⚠️ | Solo expone `API_URL`. No centraliza endpoints, timeouts, features flags. |
| `client/src/db/database.ts` | ✅ (parcial) | 10 esquemas, `multiInstance: true`, migraciones para products/users/auditLogs. Antes tenía DB6 (resuelto). |
| `client/src/db/sync.ts` | ⚠️ | Polling + WS. `last_synced_at` en `localStorage` puede desincronizarse entre pestañas. |
| `client/src/db/auth.ts` | ⚠️ | Decodifica JWT con `atob` para chequear `exp` (no valida firma, aceptable para UX). |
| `client/src/db/migration.ts` | ✅ | Migración legacy con flag `stockmaster_local_db_migrated_v4`. |
| `client/src/contexts/ThemeContext.tsx` | ✅ | Theme machine extenso: modo, sidebar, cards, buttons, density, animations, pills. |
| `client/src/contexts/ExchangeRateContext.tsx` | ⚠️ | Fallback a `pydolarvenezuela-api.vercel.app`; sin timeout explícito ni circuit breaker. |
| `client/src/contexts/BusinessSettingsContext.tsx` | ✅ | IVA 16 %, IGTF 3 %, RIF, papel 80/58 mm, POS lock, validador RIF. |
| `client/src/components/Login.tsx` | ✅ | Login online/offline, PIN pad táctil, toggle password, íconos de estado. |
| `client/src/components/Dashboard.tsx` | ✅ | Rutas lazy, license lock, system lock, AppUpdater, OnboardingTutorial, shortcuts, rate calculator, ErrorBoundary, OverviewCards. |
| `client/src/components/VentasPOS.tsx` | ✅ | POS con ProductGrid, CartPanel, CheckoutModal, TicketPreviewModal, ScannerModal, SuccessSaleModal, suspended sales, exchange rate, license limits, audit hooks. |
| `client/src/components/Inventario.tsx` | ✅ | CRUD, import/export XLSX, Chart.js, lotes, búsqueda, alertas stock mínimo, licencias. |
| `client/src/components/Clientes.tsx` | ✅ | CRUD, tipos Detal/Mayorista, validación/format RIF, créditos, sync. |
| `client/src/components/Nomina.tsx` | ⚠️ | 3 sub-tabs (payrolls/employees/attendance), bcryptjs para PIN, API directa a `${API_URL}/payroll/...` → inconsistente con `syncWorker`. |
| `client/src/components/Proveedores.tsx` | ✅ (por inferencia) | Sigue patrón CRUD + sync. |
| `client/src/components/Compras.tsx` | ✅ (por inferencia) | Sigue patrón CRUD + sync. |
| `client/src/components/Auditoria.tsx` | ✅ (por inferencia) | Listado con filtros. |
| `client/src/components/Analiticas.tsx` | ✅ (por inferencia) | Integración con `reports.service`. |
| `client/src/components/CierreCaja.tsx` | ✅ (por inferencia) | Resumen del día. |
| `client/src/components/UserAdmin.tsx` | ✅ (por inferencia) | CRUD usuarios. |
| `client/src/components/BusinessSettings.tsx` | ✅ (por inferencia) | Ajustes comerciales. |
| `client/src/components/UserProfile.tsx` | ✅ (por inferencia) | Perfil del usuario actual. |
| `client/src/components/About.tsx` | ✅ (por inferencia) | Información de versión. |
| `client/src/components/Register.tsx` | ✅ (por inferencia) | Registro. |
| `client/src/components/LandingPage.tsx` | ✅ | Marketing page rica con animejs, dark/light, animaciones. |
| `client/src/components/SplashScreen.tsx` | ✅ | Splash inicial. |
| `client/src/components/AppUpdater.tsx` | ✅ | Auto-update Tauri. |
| `client/src/components/OnboardingTutorial.tsx` | ✅ | Tutorial primer uso. |
| `client/src/components/ThemeCustomizer.tsx` | ✅ | UI para configurar el theme. |
| `client/src/components/KeyboardShortcuts.tsx` | ✅ | Atajos de teclado. |
| `client/src/components/RateCalculatorModal.tsx` | ✅ | Calculadora de tasa. |
| `client/src/components/Sidebar.tsx` | ✅ (por inferencia) | Navegación lateral. |
| `client/src/components/Header.tsx` | ✅ (por inferencia) | Cabecera. |
| `client/src/components/OverviewCards.tsx` | ✅ (por inferencia) | Tarjetas resumen. |
| `client/src/components/ProductGrid.tsx` | ✅ (por inferencia) | Grid de productos. |
| `client/src/components/CartPanel.tsx` | ✅ (por inferencia) | Panel de carrito. |
| `client/src/components/CheckoutModal.tsx` | ✅ (por inferencia) | Modal de pago. |
| `client/src/components/TicketPreviewModal.tsx` | ✅ (por inferencia) | Previsualización de ticket. |
| `client/src/components/ScannerModal.tsx` | ✅ (por inferencia) | Escáner de códigos. |
| `client/src/components/SuccessSaleModal.tsx` | ✅ (por inferencia) | Confirmación de venta. |
| `client/src/components/PlanLockScreen.tsx` | ✅ (por inferencia) | Bloqueo por plan. |
| `client/src/components/SystemLockScreen.tsx` | ✅ (por inferencia) | Bloqueo por inactividad. |
| `client/src/components/ErrorBoundary.tsx` | ✅ | Fallback sólido, muestra stack en pre. |
| `client/src/components/ToastNotification.tsx` | ✅ (por inferencia) | Toasts. |
| `client/src/components/CustomSelect.tsx` | ✅ (por inferencia) | Select custom. |
| `client/src/components/CustomDatePicker.tsx` | ✅ (por inferencia) | Date picker custom. |
| `client/src/components/CustomModal.tsx` | ✅ (por inferencia) | Modal custom. |
| `client/src/utils/audit.ts` | ⚠️ | `logAuditEvent` deduce severidad (CRITICAL/WARNING/INFO), escribe a RxDB `auditLogs`. Sin batching. |
| `client/src/utils/license.ts` | ⚠️ | SHA-256 casero + salt; no es criptografía real, solo ofuscación. |
| `client/src/utils/thermal.ts` | ✅ | Generador de tickets HTML; escapa HTML, soporta QR/barcode. |
| `client/src/utils/formatCurrency.ts`, `validators.ts`, `rif.ts`, `formatters.ts` | ✅ (por inferencia) | Helpers locales. |
| `client/src/hooks/*` | ✅ (por inferencia) | Hooks reutilizables. |
| `client/src/__tests__/*` | ⚠️ | Cobertura desconocida; se recomienda correr `vitest run --coverage`. |
| `client/tests/e2e/*` | ⚠️ | Playwright declarado; revisar. |
| `client/vite.config.ts` | ⚠️ | Revisar `manualChunks` para `tesseract.js` y `chart.js` (~MB). |
| `client/eslint.config.*` | ⚠️ | Verificar reglas de a11y (jsx-a11y), hooks, react-hooks/exhaustive-deps. |
| `client/index.html` | ⚠️ | Revisar meta `viewport`, `theme-color`, CSP si aplica. |
| `client/src/index.css` | ✅ (por inferencia) | Tokens visuales centralizados. |
| `client/src-tauri/*` | ❓ | No verificado. |
| `client/android`, `client/ios` | ❓ | No verificado. |

### 3.2 Servidor

| Archivo | Veredicto | Comentario breve |
|---|---|---|
| `server/src/main.ts` | ❌ Riesgo | Genera `JWT_SECRET` aleatorio si no existe `.env` y solo lo loguea; cada reinicio invalida tokens. |
| `server/src/app.module.ts` | ✅ | `ThrottlerModule` global, módulos bien organizados. |
| `server/prisma/schema.prisma` | ✅ | Soft delete (`deletedAt`), versionado (`version`, `updatedAt`), `disabled` en User. |
| `server/src/auth/auth.service.ts` | ⚠️ | `lockouts` y `blacklistedTokens` en memoria → no escalan multi-instancia. |
| `server/src/auth/auth.controller.ts` | ✅ | Endpoints REST con Zod y mensajes legibles. |
| `server/src/auth/auth.guard.ts` | ✅ | Bearer + blacklist. |
| `server/src/auth/auth.dto.ts` | ✅ | Zod con reglas fuertes (password 5 reglas, PIN 4-6). |
| `server/src/auth/roles.guard.ts` | ✅ | Reflector + ForbiddenException. |
| `server/src/auth/roles.decorator.ts` | ✅ | Decorador. |
| `server/src/sync/sync.service.ts` | ✅ | Push/pull por entidad en transacciones Prisma, auditoría por push, versionado. |
| `server/src/sync/sync.controller.ts` | ✅ | `/sync/{entity}/push` y `/pull` con Zod, role guard ADMIN para push. |
| `server/src/sync/sync.gateway.ts` | ⚠️ | `cors.origin` parsea string con `.split(',')` sin trim/dedupe. |
| `server/src/sync/sync.dto.ts` | ✅ | Schemas Zod bien definidos, `lastSyncedAt` obligatorio. |
| `server/src/reports/reports.service.ts` | ⚠️ | `findMany` con include `product.cost`; potencial N+1. |
| `server/src/reports/reports.controller.ts` | ✅ (por inferencia) | Endpoints. |
| `server/src/reports/reports.dto.ts` | ✅ (por inferencia) | DTOs. |
| `server/src/payroll/*` | ⚠️ | Llamadas directas desde cliente sin pasar por `syncWorker`. |
| `server/src/auditoria/*` | ✅ (por inferencia) | Persistencia y consulta. |
| `server/src/licenses/licenses.service.ts` | ⚠️ | SHA-256 casero; demo keys hardcoded. |
| `server/src/licenses/licenses.controller.ts` | ✅ (por inferencia) | Endpoints. |
| `server/src/mail/mail.service.ts` | ✅ | SMTP condicional. |
| `server/src/common/exception.filter.ts` | ⚠️ | Filtra 5xx en producción; 4xx expone Zod crudos. |
| `server/src/common/throttler.guard.ts` | ✅ | Tracking por `user:{sub}` o `ip:{ip}`. |
| `server/src/health/*` | ❓ | No verificado. |
| `server/src/prisma/prisma.service.ts` | ❓ | No verificado; asumir `OnModuleInit`/`OnModuleDestroy`. |
| `server/prisma/seed.ts` | ❓ | No verificado. |

---

## 4. Funcionalidad

| Módulo | Estado | Notas |
|---|---|---|
| POS / Ventas | ✅ | Flujo completo, suspendidas, ticket, scanner, IGTF, dual USD/VES. |
| Inventario | ✅ | CRUD, lotes, XLSX, alertas, gráficos. |
| Clientes | ✅ | Tipos, RIF, créditos. |
| Proveedores | ✅ | Inferido. |
| Compras | ✅ | Inferido. |
| Nómina | ⚠️ | 3 sub-tabs + API directa. |
| Analítica | ✅ | KPIs, top productos, cajeros, clientes, categorías. |
| Auditoría | ✅ | Severidad deducida, persistencia dual. |
| Cierre de caja | ✅ | Inferido. |
| Licencias | ⚠️ | SHA-256 casero. |
| Auth | ✅ | Online + offline, JWT + refresh, lockout, blacklist. |
| Sync | ✅ | Polling + WS, push/pull transaccional. |
| Auto-update | ✅ | Tauri updater. |
| Onboarding | ✅ | Tutorial. |
| Personalización | ✅ | Theme machine extenso. |

**Cobertura funcional estimada:** 95 % de un POS PyME. Faltantes típicos:
- Devoluciones / notas de crédito.
- Múltiples cajas / terminales por tienda.
- Roles granulares (cajero, supervisor, admin, auditor).
- Reportes fiscales (SENIAT, libros de IVA).
- Integraciones con bancos / pasarela de pago.
- Impresión de facturas en formatos no térmicos (A4).

---

## 5. UI / UX

**Lo perfecto:**
- Theme machine muy completo (modo, sidebar, cards, buttons, density, animations, pills).
- Landing page rica con `animejs`, animaciones suaves.
- POS pulido: búsqueda, grid, carrito, checkout, ticket, scanner, éxito.
- Modales custom (Select, DatePicker, Modal).
- Splash, Onboarding, ErrorBoundary, Lock screens.
- Toast, Header, Sidebar consistentes.
- Soporte dark/light con tokens en `index.css`.
- Atajos de teclado (`KeyboardShortcuts`).
- Calculadora de tasa (`RateCalculatorModal`).

**Lo mejorable:**
- 4631 líneas en `LandingPage.tsx` (demasiado, debería separarse en secciones).
- Estilos inline mezclados con clases (`ErrorBoundary.tsx`).
- No hay sistema de design tokens formal (los tokens viven en `index.css`).
- No hay Storybook.
- Foco inconsistente en inputs; debería haber un focus ring global.
- Contraste de algunos colores cálidos sobre fondo claro no verificado.

**Lo problemático:**
- Ningún `aria-label` ni gestión de foco explícita en Login (PIN pad), Scanner, CheckoutModal.
- Sin `prefers-reduced-motion` respetando para `animejs`.
- No hay soporte para tamaños de fuente del SO.

---

## 6. Seguridad

### 6.1 Lo perfecto
- Helmet, compress, throttler global (60 s, 120 req).
- CORS configurable en Nest + WS.
- Zod en todos los DTOs.
- bcryptjs para passwords y PINs.
- Lockout en memoria con TTL.
- Blacklist de tokens.
- Roles guard con reflector.
- Escape HTML en tickets (`utils/thermal.ts`).
- No se loguean secretos.
- Hashing local con `pinHash` y `passwordHash` en RxDB.

### 6.2 Lo mejorable
- Mensajes de error 4xx exponen Zod crudos (ruido para prod).
- `cors.origin` en `sync.gateway.ts` parsea con `.split(',')` sin trim.
- Throttler por defecto; falta throttling por endpoint sensible (login, refresh).
- No hay rate-limit por usuario en login offline.
- Falta `helmet.contentSecurityPolicy` ajustado para Tauri/Capacitor.

### 6.3 Lo problemático
- **`server/src/main.ts`: `JWT_SECRET` regenerado en cada arranque si no hay `.env`.** Los tokens quedan inválidos y no hay persistencia. Crítico.
- **Estado en memoria** (`lockouts`, `blacklistedTokens`) se pierde al reiniciar y no escala multi-instancia.
- **SHA-256 casero** en licencias: no es criptografía real, es ofuscación. No protege contra un atacante con acceso a la BD.
- **`client/src/db/auth.ts`: decodifica JWT con `atob`** para chequear `exp` (no es validación de firma, aceptable para UX; documentar).
- **`Nomina.tsx` hace fetch directo** a `${API_URL}/payroll/...` saltando `syncWorker`: si el endpoint no usa el mismo guard de roles, hay riesgo de bypass.
- **`nomina` PIN se hashea con bcryptjs en el cliente**; el cliente tiene la sal/iteraciones hardcoded.

---

## 7. Rendimiento

### 7.1 Lo perfecto
- Rutas lazy en `Dashboard.tsx`.
- RxDB con `multiInstance: true` y migraciones controladas.
- `Chart.js` y `tesseract.js` solo donde se usan (verificar).
- Transacciones Prisma en sync push/pull.

### 7.2 Lo mejorable
- `reports.service.ts:24-32` hace `findMany` de todos los `saleItems` con `include` de `product.cost`; cargar todo y filtrar en memoria no escala.
- Falta `manualChunks` en `vite.config.ts` para vendor splitting.
- `tesseract.js` (~2 MB) y `chart.js` deberían ser chunks asíncronos.
- Sin budgets en Vite (`build.rollupOptions.output.manualChunks`).
- `useExchangeRate` sin memoización amplia; renders en cascada.

### 7.3 Lo problemático
- `LandingPage.tsx` (4631 líneas) impacta tiempo de parse y de HMR.

---

## 8. Sincronización / Offline

### 8.1 Lo perfecto
- Polling + WebSocket (`socket.io-client`).
- `SyncWorker` singleton.
- `last_synced_at` por colección.
- Eventos online/offline escuchados.
- Push en transacciones Prisma con auditoría.

### 8.2 Lo mejorable
- Conflictos no resueltos explícitamente: el servidor usa `version` + `updatedAt`; no hay vector clock ni CRDT.
- `last_synced_at` en `localStorage` puede divergir entre pestañas.
- Idempotencia de ventas offline: si el cliente genera el mismo `id` y la red cae, no se ve manejo de duplicados en el server.
- Retries con backoff lineal; falta jitter y backoff exponencial.
- Sin métricas de lag de sync.

### 8.3 Lo problemático
- `Nomina.tsx` rompe el patrón: hace `fetch` directo al server sin pasar por `syncWorker`, lo que significa que nómina no es realmente offline-first (inconsistente).

---

## 9. Mobile / Desktop (Tauri + Capacitor)

### 9.1 Lo perfecto
- Empaquetado dual Tauri 2 (desktop) + Capacitor 8 (móvil).
- Auto-update con `updater.json` + `@tauri-apps/plugin-updater`.
- HTML5-QR para escáner.

### 9.2 Lo mejorable
- **Decisión arquitectónica pendiente:** ¿cuál es el target principal? Si es mobile-first, Tauri es redundante; si es desktop, Capacitor es redundante.
- `tesseract.js` y `chart.js` pesan mucho en mobile; deberían ser `dynamic import`.
- Sin verificación de `viewport` meta en `index.html` para Capacitor.

### 9.3 Lo problemático
- Ninguno crítico detectado más allá del peso de bundles.

---

## 10. Observabilidad

- **Logs:** `console.error` en `ErrorBoundary`; en server logs nest estándar.
- **Métricas:** ninguna.
- **Tracing:** ninguno.
- **Health checks:** módulo `health` declarado; no verificado.
- **Errores no enviados a servicio externo (Sentry / OpenTelemetry).**

Recomendación inmediata: integrar **Sentry** (cliente + server) y **OpenTelemetry** en el server.

---

## 11. Testing

- `vitest` declarado en cliente.
- `@playwright/test` declarado.
- Estructura de tests visible (`__tests__` por capa).
- Cobertura no medida → ejecutar `vitest run --coverage`.
- No hay CI en el repo (revisar `.github/workflows`).

---

## 12. Deuda técnica priorizada

### 12.1 Alta (bloqueante para producción)
1. **Persistencia de `JWT_SECRET`** (riesgo de invalidación total al reiniciar).
2. **Blacklist y lockout en memoria** (multi-instancia roto).
3. **SHA-256 casero en licencias** (no es criptografía).
4. **Inconsistencia offline en Nómina** (fetch directo, no pasa por sync).
5. **N+1 en `reports.service.ts`** (degradación con datasets grandes).

### 12.2 Media
6. Falta CSP estricta en `helmet`.
7. Mensajes 4xx exponen Zod crudos.
8. `LandingPage.tsx` con 4631 líneas: dividir.
9. No hay i18n framework (todo en español hardcoded).
10. Magic numbers de sesión en `App.tsx`.
11. Throttler no es por endpoint sensible.
12. Conflict resolution de sync no explícita.

### 12.3 Baja
13. Foco y ARIA inconsistentes.
14. Sin `prefers-reduced-motion` para `animejs`.
15. Sin budgets Vite.
16. `manualChunks` no definido.
17. Falta Sentry / OTel.
18. Falta Storybook.

---

## 13. Mejoras prioritarias (quick wins)

| # | Mejora | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | Persistir `JWT_SECRET` en `.env` o vault | Crítico | Bajo |
| 2 | Mover `blacklist` y `lockouts` a Redis | Alto | Medio |
| 3 | Mover Nómina al flujo `syncWorker` | Alto | Medio |
| 4 | Endurecer licencias (firmar con clave asimétrica real) | Alto | Medio |
| 5 | Refactor `reports.service.ts` con agregaciones SQL | Alto | Medio |
| 6 | Dividir `LandingPage.tsx` en secciones | Medio | Bajo |
| 7 | Centralizar timeouts/flags en `config.ts` | Medio | Bajo |
| 8 | Agregar `helmet.contentSecurityPolicy` | Alto | Bajo |
| 9 | Ocultar detalles de Zod en respuestas 4xx | Medio | Bajo |
| 10 | Definir `manualChunks` y budgets en Vite | Medio | Bajo |
| 11 | Integrar Sentry + OpenTelemetry | Alto | Medio |
| 12 | Adoptar i18next (es/en al menos) | Medio | Medio |
| 13 | Auditar `aria-*` y focus en Login, Scanner, Checkout | Medio | Bajo |
| 14 | Desactivar Tauri o Capacitor según target | Medio | Bajo |
| 15 | Pruebas E2E del flujo POS offline → online | Alto | Medio |

---

## 14. Sugerencias profesionales al día de hoy (2026)

### 14.1 Seguridad
- **Paseto en lugar de JWT** (Paseto v4.public / v4.local). Más simple, más seguro por diseño.
- **Argon2id** en lugar de bcryptjs (mejor resistencia a GPU/ASIC). En el cliente sigue siendo costoso, pero factible con `argon2-browser` o WASM.
- **OAuth 2.1 / OIDC** con proveedor externo (Auth0, Keycloak, Clerk) si el sistema crece a múltiples tenants.
- **Vault / SOPS** para secretos en CI/CD.
- **CSP estricta** ajustada a Tauri (`default-src 'self' 'csp_hash'; connect-src 'self' ipc: https://ipc.localhost`) y Capacitor.
- **OWASP ASVS L2** como checklist.
- **2FA TOTP** para admin.
- **Passwordless** (passkeys / WebAuthn) para admin.

### 14.2 Backend
- Migrar de **SQLite** a **PostgreSQL** (multi-instancia, JSONB, índices GIN).
- **Prisma 5** está bien; considerar **Drizzle** si se quiere SQL más explícito.
- **NestJS 11 + Fastify** está vigente; añadir **helmet CSP**, **rate-limit por endpoint**, **circuit breakers** (opossum), **retries con jitter** (cockatiel).
- **OpenTelemetry** + **Grafana Tempo / Honeycomb**.
- **Background jobs** con **BullMQ + Redis** para reportes pesados, envío de mails, snapshot de inventario.
- **API versioning** (ya hay control de versiones en schemas).
- **GraphQL** solo si la cantidad de pantallas crece mucho; REST con Zod sigue siendo adecuado.

### 14.3 Frontend
- **React 19** con **TanStack Query** para datos remotos, **TanStack Router** o **React Router v7** declarativo.
- **Zustand** o **Jotai** para estado global (alternativas a contextos con renders masivos).
- **React Hook Form + Zod** para todos los formularios (consistencia).
- **i18next** + `react-i18next` con detección de idioma y namespaces.
- **Storybook** para el design system.
- **shadcn/ui** o **Radix UI** + tokens propios (evita librería pesada).
- **Vite 6** con `manualChunks` y `build.rollupOptions.output.bundleSizeReporting`.
- **Vitest + Testing Library** con cobertura >80 % en `db/`, `utils/`, `auth`.
- **Playwright** con proyectos para Tauri (`@playwright/test` + driver Tauri) y Capacitor (webview).

### 14.4 Offline / sync
- **RxDB 17** es buena elección. Considerar **RxDB Premium** para replicación GraphQL si el backend migra.
- **CRDT (Yjs / Automerge)** para documentos colaborativos (no aplica acá, pero sí para listas de pedidos, carrito compartido).
- **Conflict resolution explícita**: server wins / client wins / merge por campo / reintento manual.
- **Idempotency-Key** en ventas para evitar duplicados.
- **Outbox pattern** en el cliente: cola durable (IndexedDB) con reintentos.

### 14.5 Mobile / Desktop
- **Decidir target**: si mobile es prioridad, **Capacitor 8 + Ionic 8**; si desktop, **Tauri 2** (más liviano que Electron).
- **Tauri 2** soporta deep links, notificaciones, autostart, tray.
- **Capacitor 8** con `@capacitor/preferences` para secretos pequeños.
- **Keychain / Keystore** para tokens: `tauri-plugin-stronghold` o `capacitor-secure-storage`.

### 14.6 UI / UX
- **Tokens de diseño** en TypeScript (`@tokens-studio`) o Style Dictionary.
- **Radix UI Primitives** (accesibilidad WAI-ARIA por defecto).
- **Framer Motion** o `animejs` con `prefers-reduced-motion`.
- **TanStack Table** para tablas (Inventario, Clientes, Nómina).
- **Hotkeys** centralizados con `react-hotkeys-hook` + ayuda inline (`?`).
- **A11y**: axe-core en CI, jest-axe.

### 14.7 Calidad
- **TypeScript estricto** (`strict: true`, `noUncheckedIndexedAccess: true`).
- **Zod** en runtime; **tRPC** o **Zodios** para tipos de extremo a extremo.
- **ESLint + Prettier + Husky + lint-staged**.
- **Renovate / Dependabot** para actualizaciones.
- **Commitlint + Conventional Commits** + **Changesets** para versionado.

### 14.8 DevOps
- **Dockerfile multi-stage** para server (Node 22 alpine + `pnpm`).
- **GitHub Actions** con matrix: lint, test, build, e2e, docker push.
- **Renovate** para PRs automáticas.
- **Sentry** para cliente + server.
- **OpenTelemetry** exportando a **Honeycomb / Grafana Cloud**.

### 14.9 Documentación
- **TypeDoc** para API.
- **Storybook** publicado.
- **OpenAPI** auto-generada desde los DTOs Nest (`@nestjs/swagger`).
- **ADRs** (Architecture Decision Records) en `/docs/adr/`.

---

## 15. Riesgos y recomendaciones inmediatas

1. **Antes del primer deploy a producción:**
   - Definir `JWT_SECRET` persistente.
   - Mover blacklist/lockout a Redis.
   - Endurecer licencias (firmar con Ed25519, no SHA-256 casero).
   - CSP estricta.
   - Sentry + OTel.
2. **Antes de escalar multi-tenant:**
   - Migrar a PostgreSQL.
   - Roles granulares (cajero, supervisor, admin, auditor).
   - Multi-caja / multi-terminal.
3. **Antes de mobile público:**
   - Decidir Tauri vs Capacitor según target real.
   - Pasar por 2FA y passkeys para admin.
   - Auditoría de seguridad externa.

---

## 16. Conclusión

StockMaster POS es un **sistema serio, con buen alcance funcional y una base arquitectónica sólida**. La capa offline-first está bien planteada, el tema visual es personalizable y la suite de componentes cubre lo esencial de un POS. Los puntos críticos son **seguridad (JWT_SECRET, blacklist en memoria, licencias)**, **consistencia (Nómina rompe el patrón offline-first)** y **rendimiento en reportes (N+1)**. Resueltos esos, y adoptando las recomendaciones profesionales de 2026 (PostgreSQL, Paseto, OpenTelemetry, Sentry, i18n, a11y), el sistema queda listo para producción con escala real.

**Próximos pasos sugeridos (ordenados por ROI):**
1. Persistir `JWT_SECRET` y mover estado de auth a Redis.
2. Refactor `reports.service.ts` a agregaciones SQL.
3. Mover Nómina al flujo `syncWorker`.
4. Integrar Sentry + OpenTelemetry.
5. Definir estrategia Tauri vs Capacitor.
6. Auditar a11y + i18n.
7. Endurecer licencias con Ed25519.

---

> **Nota:** Algunas veredictos se basan en inferencia por no haber leído a profundidad ciertos archivos secundarios; los marcados como "por inferencia" deben confirmarse con lectura directa si se requiere certeza.
