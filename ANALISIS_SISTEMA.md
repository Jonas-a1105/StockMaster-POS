# ANÁLISIS EXHAUSTIVO DEL SISTEMA — StockMasterPro POS

> Fecha: 2026-06-02
> Proyecto: StockMasterPro — Sistema POS Offline-First & Real-Time Sync
> Stack: React 19 + Vite 8 + RxDB 17 (cliente) / NestJS 11 + Fastify + Prisma ORM (servidor)

---

## ÍNDICE

1. [RESUMEN GENERAL](#1-resumen-general)
2. [LO QUE SÍ FUNCIONA (COMPONENTES FUNCIONALES)](#2-lo-que-sí-funciona)
3. [ERRORES Y PROBLEMAS GRAVES](#3-errores-y-problemas-graves)
4. [PROBLEMAS ARQUITECTÓNICOS](#4-problemas-arquitectónicos)
5. [REDUNDANCIAS Y CÓDIGO DUPLICADO](#5-redundancias-y-código-duplicado)
6. [LO QUE FALTA POR IMPLEMENTAR](#6-lo-que-falta-por-implementar)
7. [SEGURIDAD](#7-seguridad)
8. [DEUDA TÉCNICA](#8-deuda-técnica)
9. [RESUMEN DE ARCHIVOS Y LÍNEAS DE CÓDIGO](#9-resumen-de-archivos)
10. [CONCLUSIONES Y RECOMENDACIONES](#10-conclusiones)

---

## 1. RESUMEN GENERAL

StockMasterPro es un sistema POS (Punto de Venta) completo, offline-first, pensado para el mercado venezolano (tasa BCV, RIF, IVA, IGTF). Consta de **68+ archivos** distribuidos en cliente React PWA y servidor NestJS.

### Frontend (client/)
- **25 componentes React** (Login, Register, Dashboard, Sidebar, Header + 20 módulos de negocio)
- **3 contextos** (ThemeContext, ExchangeRateContext, BusinessSettingsContext)
- **3 archivos de base de datos** (database.ts, auth.ts, sync.ts)
- **1 archivo CSS masivo** (`index.css`, ~4009 líneas)

### Backend (server/)
- **6 módulos NestJS** (Auth, Auditoria, Payroll, Reports, Sync, Prisma)
- **9 modelos Prisma** (User, Product, Supplier, Client, Sale, SaleItem, Purchase, PurchaseItem, Payroll, AuditLog)
- **Base de datos SQLite** (configurada como `file:./dev.db`, a pesar de que docker-compose usa PostgreSQL)

---

## 2. LO QUE SÍ FUNCIONA (COMPONENTES FUNCIONALES)

### 2.1 Frontend — Módulos funcionales

| Componente | Archivo | Estado | Descripción |
|---|---|---|---|
| **Login** | `components/Login.tsx` | ✅ Funcional | Login online/offline con contraseña y PIN, teclado numérico táctil, selector de tema |
| **Register** | `components/Register.tsx` | ✅ Funcional | Registro de empleados con roles, PIN opcional, validación |
| **Dashboard** | `components/Dashboard.tsx` | ✅ Funcional | Panel principal con tarjetas de resumen, alertas de stock bajo, layout responsivo |
| **Sidebar** | `components/Sidebar.tsx` | ✅ Funcional | Navegación colapsable, menú móvil con bottom sheet, roles y permisos |
| **Header** | `components/Header.tsx` | ✅ Funcional | Barra de búsqueda global con autocompletado, indicador de sincronización |
| **ThemeContext** | `contexts/ThemeContext.tsx` | ✅ Funcional | Sistema completo de theming (oscuro/claro, colores, fuentes, estilos) |
| **ExchangeRateContext** | `contexts/ExchangeRateContext.tsx` | ✅ Funcional | Tasa BCV en vivo desde API externa, conversión USD/VES |
| **BusinessSettingsContext** | `contexts/BusinessSettingsContext.tsx` | ✅ Funcional | Configuración fiscal (RIF, IVA 16%, IGTF 3%) |
| **ToastNotification** | `components/ToastNotification.tsx` | ✅ Funcional | Sistema de notificaciones toast con auto-dismiss |
| **ThemeCustomizer** | `components/ThemeCustomizer.tsx` | ✅ Funcional | Panel completo de personalización visual (~812 líneas) |
| **RateCalculatorModal** | `components/RateCalculatorModal.tsx` | ✅ Funcional | Calculadora multi-moneda con tasas BCV |
| **KeyboardShortcuts** | `components/KeyboardShortcuts.tsx` | ✅ Funcional | Atajos de teclado (F1-F8, Shift+?) |
| **BusinessSettings** | `components/BusinessSettings.tsx` | ✅ Funcional | Configuración del negocio con backup/restore |
| **VentasPOS** | `components/VentasPOS.tsx` | ✅ Funcional | Punto de venta completo: carrito, checkout, vuelto, ventas suspendidas |
| **Inventario** | `components/Inventario.tsx` | ✅ Funcional | CRUD de productos, paginación, seed data, editor con justificación de stock |
| **Clientes** | `components/Clientes.tsx` | ✅ Funcional | CRUD de clientes con RIF, validación, cuentas por cobrar |
| **Proveedores** | `components/Proveedores.tsx` | ✅ Funcional | CRUD de proveedores, cuentas por pagar |
| **Nomina** | `components/Nomina.tsx` | ✅ Funcional | Gestión de nómina con integración al backend |
| **Compras** | `components/Compras.tsx` | ⚠️ Parcial | Módulo de compras con OCR planeado pero solo simulado |
| **CierreCaja** | `components/CierreCaja.tsx` | ✅ Funcional | Arqueo de caja completo, declaración de efectivo, exportación PDF/CSV |
| **Analiticas** | `components/Analiticas.tsx` | ✅ Funcional | KPIs, gráficos SVG, desglose por categorías |
| **Auditoria** | `components/Auditoria.tsx` | ✅ Funcional | Visor de bitácora con diagrama de arquitectura |
| **OverviewCards** | `components/OverviewCards.tsx` | ✅ Funcional | Tarjetas de resumen del dashboard |
| **SalesChartCard** | `components/SalesChartCard.tsx` | ✅ Funcional | Gráfico de ventas mensuales con Chart.js |
| **CalendarCard** | `components/CalendarCard.tsx` | ✅ Funcional | Calendario mensual interactivo |
| **WeeklySalesCard** | `components/WeeklySalesCard.tsx` | ✅ Funcional | Barras semanales con tooltips |
| **CustomerDetailsCard** | `components/CustomerDetailsCard.tsx` | ✅ Funcional | Tabla de transacciones recientes |
| **RightSidebar** | `components/RightSidebar.tsx` | ✅ Funcional | Panel lateral con gráfico dona y KPIs |

### 2.2 Backend — Módulos funcionales

| Módulo | Archivos | Estado | Descripción |
|---|---|---|---|
| **Auth** | `auth.controller.ts`, `auth.service.ts`, `auth.dto.ts` | ✅ Funcional | Registro, login, login-offline, JWT, bcrypt |
| **Auditoria** | `auditoria.controller.ts`, `auditoria.service.ts` | ✅ Funcional | Bitácora de auditoría (Create + Read) |
| **Sync** | `sync.controller.ts`, `sync.service.ts` | ✅ Funcional | Push/Pull bidireccional con LWW, productos, ventas, clientes |
| **Payroll** | `payroll.controller.ts`, `payroll.service.ts` | ✅ Funcional | CRUD de nómina con roles |
| **Reports** | `reports.controller.ts`, `reports.service.ts` | ✅ Funcional | KPIs, ventas por categoría, logs de auditoría |
| **Prisma** | `prisma.service.ts`, `prisma.module.ts` | ✅ Funcional | Conexión a BD, 10 modelos |
| **Database** | `prisma/schema.prisma` | ✅ Funcional | Esquema completo con relaciones |

### 2.3 Infraestructura Funcional

| Elemento | Archivo | Estado |
|---|---|---|
| **Docker Compose** | `docker-compose.yml` | ✅ PostgreSQL + Backend + Frontend |
| **Dockerfile cliente** | `client/Dockerfile` | ✅ Multi-stage build + Nginx |
| **Dockerfile servidor** | `server/Dockerfile` | ✅ Multi-stage build + Prisma |
| **Nginx config** | `client/nginx.conf` | ✅ SPA routing, gzip, security headers |
| **PWA manifest** | `vite.config.ts` (VitePWA) | ✅ Service worker offline |
| **RxDB local DB** | `db/database.ts` | ✅ IndexedDB con 4 colecciones |
| **Sync Worker** | `db/sync.ts` | ✅ Sincronización automática cada 45s |
| **Auth offline** | `db/auth.ts` | ✅ Login offline con bcrypt en IndexedDB |

---

## 3. ERRORES Y PROBLEMAS GRAVES

### 🔴 3.1 Base de datos: SQLite vs PostgreSQL — CONFLICTO GRAVE

**Archivo:** `server/prisma/schema.prisma:2`

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
```

**Problema:** El `schema.prisma` usa **SQLite** como datasource, pero `docker-compose.yml` y `.env` están configurados para **PostgreSQL**. El Dockerfile ejecuta `prisma db push` que usará SQLite, ignorando PostgreSQL. Esto significa que **el servidor en Docker NO funcionará con PostgreSQL** a menos que se cambie el provider.

**Impacto:** CRÍTICO. El servidor no podrá integrarse con la base de datos PostgreSQL del docker-compose.

---

### 🔴 3.2 El frontend SIEMPRE carga logo.png y avatar.png — PERO NO EXISTEN

**Archivos:** `Login.tsx:4`, `Register.tsx:4`, `Sidebar.tsx:20`, `Header.tsx:3`
```
import logoImg from '../assets/logo.png';
import avatarImg from '../assets/avatar.png';
```

**Problema:** El directorio `client/src/assets/` contiene `logo.png` y `avatar.png` en la **carpeta dist** pero puede que no estén en `src/assets/`. Si Vite no encuentra estos archivos, toda la app falla al cargar. No hay fallback.

**Impacto:** ALTO. Si las imágenes no están en `src/assets/`, la compilación falla.

---

### 🔴 3.3 CORS mal configurado en el backend

**Archivo:** `server/src/main.ts`
```typescript
app.enableCors({ origin: '*' });
```

**Problema:** CORS con `origin: '*'` es inseguro para producción. Debería restringirse al origen del frontend.

**Impacto:** MEDIO. Riesgo de seguridad en producción.

---

### 🔴 3.4 Magic strings de constantes duplicadas

**Archivos:** `server/src/auth/auth.service.ts:112`, `server/src/sync/sync.controller.ts:23,55,87,119,151`
```typescript
const secret = this.config.get<string>('JWT_SECRET') ?? 'fallback_jwt_secret_key_2026';
```

**Problema:** El fallback de JWT_SECRET está hardcodeado en 6 lugares diferentes dentro del servidor. Si se cambia en un lugar y olvida en otro, los tokens dejarán de funcionar.

**Impacto:** ALTO. Inconsistencia en validación JWT.

---

### 🔴 3.5 El IVA está hardcodeado al 16%

**Archivo:** `VentasPOS.tsx:317`
```typescript
const ivaUSD = subtotalUSD * 0.16; // 16% IVA estándar
```

**Problema:** Ignora la configuración dinámica de `BusinessSettingsContext.ivaRate`. Si el usuario cambia el IVA en configuración, el POS no lo refleja.

**Impacto:** ALTO. El cálculo fiscal no respeta la configuración del negocio.

---

### 🔴 3.6 `isLoading` mal inicializado en Login

**Archivo:** `Login.tsx:73`
```typescript
setIsLoading(false); // <-- Esto debería ser true
```

**Problema:** En `handleSubmit`, se inicializa `setIsLoading(false)` justo antes de la operación asíncrona, dejando el botón habilitado durante el loading. La siguiente línea `setIsLoading(true)` corrige, pero la Experiencia de usuario muestra un parpadeo.

**Impacto:** BAJO. Error de UX.

---

### 🔴 3.7 El esquema de User en RxDB usa `passwordHash` como requerido pero login offline puede fallar

**Archivo:** `database.ts:16-31`
```typescript
required: ['id', 'email', 'name', 'role', 'passwordHash', 'updatedAt']
```

**Problema:** El esquema requiere `passwordHash` pero el `pinHash` es opcional. Si un usuario intenta login offline con PIN pero no tiene `pinHash`, la función `loginOffline` falla con mensaje de error. Correcto, pero no se guarda `pinHash` al hacer upsert después de login online (`auth.ts:58-65`).

**Impacto:** MEDIO. El PIN offline no se cachea localmente tras login online.

---

### 🟡 3.8 La sincronización no sincroniza `purchases` (Compras)

**Archivo:** `sync.ts`
```typescript
// Solo sincroniza: products, sales, clients
// NO sincroniza: purchases, payroll, suppliers, users
```

**Problema:** El SyncWorker ignora compras, nóminas, proveedores y usuarios. Estos datos solo existen en localStorage, no en RxDB, y no se replican al servidor.

**Impacto:** ALTO. Los datos de compras y nóminas se pierden si se borra el localStorage.

---

### 🟡 3.9 `calendar-cell.muted` no se aplica correctamente

**Archivo:** `CalendarCard.tsx`

**Problema:** Las celdas de días fuera del mes actual no tienen la clase `muted`. El CSS existe pero el componente no lo implementa.

**Impacto:** BAJO. Visual.

---

### 🟡 3.10 La tasa BCV hardcodeada en créditos

**Archivo:** `Clientes.tsx:1182`
```typescript
Bs. {((creditsMap[selectedClient.rif]?.balanceUSD || 0) * 36.5).toLocaleString(...)}
```

**Problema:** Usa tasa fija `36.5` en lugar de usar `useExchangeRate().dolarRate` para la conversión a VES en el modal de cuentas por cobrar.

**Impacto:** MEDIO. El monto en bolívares puede estar desactualizado.

---

### 🟡 3.11 No hay middleware/guard JWT global

**Archivo:** `sync.controller.ts`, `payroll.controller.ts`, `reports.controller.ts`

**Problema:** Cada controlador verifica el JWT manualmente en cada endpoint con lógica repetitiva. No usa `@UseGuards()` ni `AuthGuard` de NestJS.

**Impacto:** MEDIO. Código duplicado, propenso a errores.

---

## 4. PROBLEMAS ARQUITECTÓNICOS

### 🔴 4.1 PostgreSQL configurado pero NO USADO realmente

- `docker-compose.yml` levanta PostgreSQL
- `.env` apunta a `postgresql://...@localhost:5432/stockmaster_db`
- **Pero** `schema.prisma` usa `provider = "sqlite"`
- El actual schema.prisma usa tipos SQLite (`Int`, `Float`) en vez de tipos PostgreSQL
- Si se cambia a PostgreSQL, el schema puede tener problemas de compatibilidad (ej. `String` vs `Text`, falta `@db.BigInt`, etc.)

### 🔴 4.2 Datos híbridos: RxDB + localStorage — Inconsistencia

Diferentes módulos guardan en diferentes almacenes:

| Módulo | Almacén | Colección/Key |
|---|---|---|
| Productos | RxDB | `products` |
| Ventas | RxDB | `sales` |
| Clientes | RxDB | `clients` |
| Usuarios | RxDB | `users` |
| Proveedores | **localStorage** | `stockmaster_suppliers_local` |
| Nóminas | **localStorage** | `stockmaster_payroll_records` |
| Créditos clientes | **localStorage** | `stockmaster_client_credits_local` |
| CxP proveedores | **localStorage** | `stockmaster_supplier_credits_local` |
| Auditoría local | **localStorage** | `stockmaster_local_audit_logs` |
| Config negocio | **localStorage** | `stockmaster_business_settings` |
| Tasa BCV | **localStorage** | `stockmaster_dolar_rate` |
| Sync state | **localStorage** | `last_synced_at` |

**Impacto:** No hay una fuente única de verdad. Si se borra localStorage (el usuario limpia datos del navegador), se pierden proveedores, nóminas, créditos, configuración y auditoría local. Los datos en RxDB sobreviven.

### 🟡 4.3 OCR prometido pero no implementado

- `Compras.tsx` tiene botón "Escanear Factura OCR" y modal de importación
- `schema.prisma` tiene campos `ocrProcessed` y `ocrRawData` en `Purchase`
- **No hay implementación real de OCR.** Solo carga un JSON simulado de factura

### 🟡 4.4 Servidor no maneja refresh tokens ni revocación de JWT

- Los tokens JWT expiran en 24h
- No hay refresh token
- No hay lista de tokens revocados
- Si se roba un token, es válido por 24h

### 🟡 4.5 La cámara/barcode scanner no implementa decodificación real

- `VentasPOS.tsx` activa la cámara pero **no implementa decodificación de código de barras**
- Solo permite escritura manual del código escaneado
- La lectura de cámara es solo para mostrar el video en vivo
- Falta integración con `zbar-wasm` o similar

---

## 5. REDUNDANCIAS Y CÓDIGO DUPLICADO

### 5.1 Estilos CSS inline duplicados en Login y Register

**Login.tsx** (701 líneas) y **Register.tsx** (518 líneas) comparten ~350 líneas de estilos CSS inline duplicados:
- `@keyframes float-slow-1`, `float-slow-2`, `pulse-ring`
- `.glass-input:focus`
- `.login-btn-gradient`
- `.glass-auth-card`
- `.light-theme .glass-auth-card`

### 5.2 Lógica de validación JWT duplicada

En `sync.controller.ts`, cada uno de los 5 endpoints tiene el mismo bloque de 10 líneas para validar JWT:
```typescript
const authHeader = req.headers['authorization'];
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  throw new UnauthorizedException('Falta token de autorización.');
}
const token = authHeader.split(' ')[1];
...
```
Repetido en: `payroll.controller.ts`, `reports.controller.ts`, `sync.controller.ts` (x5), `auditoria.controller.ts`.

**Total: ~8 veces la misma lógica.**

### 5.3 Paginación duplicada

El mismo patrón de paginación con `currentPage`, `ITEMS_PER_PAGE`, botones "← Anterior / Siguiente" se repite en:
- `Inventario.tsx`
- `Nomina.tsx`
- `Clientes.tsx`
- `Proveedores.tsx`
- `Compras.tsx`

### 5.4 Modales de confirmación duplicados

El patrón de modal de confirmación "¿Está seguro?" con overlay, backdrop blur, icono de alerta, botones cancelar/confirmar se repite en:
- `Dashboard.tsx` (logout)
- `Inventario.tsx` (delete producto)
- `Nomina.tsx` (delete nómina)
- `Clientes.tsx` (delete cliente)
- `Proveedores.tsx` (delete proveedor)

### 5.5 Alertas modales duplicadas

El patrón de alerta modal (config con título, mensaje, tipo success/error/info) se repite en:
- `Inventario.tsx` → `alertConfig`
- `Nomina.tsx` → `alertConfig`
- `Clientes.tsx` → `alertConfig`
- `Proveedores.tsx` → `alertConfig`

### 5.6 Toast de éxito inline duplicado

El toast fijo de éxito verde que aparece en bottom-right se repite en:
- `Inventario.tsx:456-478`
- `Clientes.tsx:521-543`
- `Proveedores.tsx:478-500`

### 5.7 Skeleton loading duplicado

El patrón de "skeleton pulse loader" se define inline en `Inventario.tsx:502-537` (no está en CSS).

### 5.8 Carga de datos con intervalos redundantes

- `sync.ts` tiene `setInterval(() => this.sync(), 45000)` (cada 45s)
- Dashboard también tiene `syncWorker.sync()` en evento `online`
- VentasPOS llama `syncWorker.sync()` después de cada venta

### 5.9 `App.css` está vacío (declarado no usado)

**Archivo:** `client/src/App.css` — contiene solo un comentario:
```css
/* Unused styling file. All StockMasterPro visual tokens and layout classes are in index.css */
```

### 5.10 `index.css` tiene 4009 líneas

**Archivo:** `client/src/index.css` — contiene TODO el CSS del sistema (layout, dashboard, sidebar, header, responsive, theme customizer) en un solo archivo monolítico.

---

## 6. LO QUE FALTA POR IMPLEMENTAR

### 🔴 **Crítico — Funciones que no existen pero son esenciales**

| # | Funcionalidad | ¿Dónde debería estar? |
|---|---|---|
| 1 | **Refresh tokens JWT** | Servidor Auth |
| 2 | **Recuperación de contraseña** | Login / Auth |
| 3 | **Logout en servidor** (invalidar token) | Auth controller |
| 4 | **Roles basados en permisos** (no solo `isAdmin` hardcodeado) | Todo el sistema |
| 5 | **Impresión de tickets (térmica)** | VentasPOS (solo vista previa, no imprime) |
| 6 | **Exportación de ventas** | VentasPOS / Reportes |
| 7 | **Notificaciones push** | Service Worker |
| 8 | **Sincronización de COMPRAS** | sync.ts |
| 9 | **Sincronización de NÓMINAS** | sync.ts |
| 10 | **Sincronización de PROVEEDORES** | sync.ts |
| 11 | **Sincronización de USUARIOS** | sync.ts |
| 12 | **OCR real** (Tesseract.js o similar) | Compras.tsx |
| 13 | **Escaneo de código de barras real** (zbar-wasm) | VentasPOS.tsx |
| 14 | **Múltiples sucursales** | En toda la arquitectura |
| 15 | **Multi-tienda / multi-empresa** | En toda la arquitectura |

### 🟡 **Importante — Funcionalidades parciales**

| # | Funcionalidad | Estado actual |
|---|---|---|
| 16 | **Nota de crédito / Devoluciones** | No existe |
| 17 | **Factura fiscal electrónica** (CF, facturación SENIAT) | No implementado |
| 18 | **Reporte de IVA** (libro de compras/ventas) | No implementado |
| 19 | **Historial de precios** (tracking de cambios) | No implementado |
| 20 | **Órdenes de compra** (PO) | No implementado |
| 21 | **Múltiples métodos de pago combinados** en venta | Parcial (solo efectivo/tarjeta/transferencia, no mix) |
| 22 | **Descuentos por producto o por ticket** | No implementado |
| 23 | **Fidelización / puntos de cliente** | No implementado |
| 24 | **Dark mode toggle independiente del ThemeCustomizer** | Login tiene su propio toggle separado |
| 25 | **Manejo de `pendingSync` al INSERTAR desde el servidor** | No implementado |

### 🟢 **Mejoras deseables**

| # | Funcionalidad |
|---|---|
| 26 | Tests unitarios del frontend (0 tests de frontend) |
| 27 | Tests de integración del backend (solo 1 test e2e básico) |
| 28 | i18n / multi-idioma |
| 29 | Temas personalizados persistentes en servidor |
| 30 | Rate limiting en endpoints de auth y sync |
| 31 | Logs estructurados (pino, winston) |
| 32 | Health check endpoint |
| 33 | Migrations de Prisma (usa `db push` en vez de `migrate`) |
| 34 | TypeScript estricto (`strict: true` en tsconfig) |

---

## 7. SEGURIDAD

### Problemas de seguridad identificados

| # | Problema | Archivo | Gravedad |
|---|---|---|---|
| 1 | **Contraseña en texto plano en el registro desde frontend** | `Register.tsx:50-55` — envía `password: password` al servidor. Aunque va por HTTPS, debería hashearse del lado del cliente también si es offline-first. | 🟡 Medio |
| 2 | **JWT_SECRET con fallback hardcodeado** | `auth.service.ts:112`, `sync.controller.ts` | 🔴 Alto |
| 3 | **CORS abierto** `origin: '*'` | `main.ts` | 🟡 Medio |
| 4 | **No hay validación de entrada con Zod en endpoints de sync** | `sync.controller.ts` usa `body: any` | 🟡 Medio |
| 5 | **La clave JWT está en `.env` en texto plano en el repo** | `server/.env` contiene `JWT_SECRET` | 🔴 Alto |
| 6 | **No hay rate limiting** en login o sync endpoints | Servidor | 🟡 Medio |
| 7 | **SQL Injection no prevenido** (Prisma ORM ayuda pero `$queryRaw` no se usa) | — | 🟢 Bajo |
| 8 | **Contraseña del POSTGRES en texto plano en docker-compose y .env** | `docker-compose.yml:11`, `.env:5` | 🔴 Alto |

---

## 8. DEUDA TÉCNICA

### 8.1 TypeScript no estricto
```json
// server/tsconfig.json
"noImplicitAny": false,
"strictNullChecks": true,
```

El cliente ni siquiera define `strict` en `tsconfig.app.json`.

### 8.2 Tipos `any` extendidos por todo el código
- `currentUser: any` en App.tsx
- Respuestas del backend tipadas como `any`
- Múltiples `as any` para forzar tipos

### 8.3 Estilos inline vs CSS modules
Todo el CSS está en inline styles o en el monolítico `index.css`. No usa CSS Modules, Styled Components, Tailwind, etc.

### 8.4 Sin sistema de logging estructurado
El servidor usa `console.log`/`console.error` en vez de un logger como Pino o Winston.

### 8.5 Sin manejo de errores global
No hay filtro de excepciones global de NestJS (`ExceptionFilter`).

### 8.6 Uso de `localStorage` para datos estructurados
Proveedores, nóminas, créditos y CxP se almacenan en `localStorage` como JSON strings en vez de usar RxDB.

### 8.7 `crypto.randomUUID()` no disponible en todos los navegadores
Se usa `crypto.randomUUID()` para generar IDs. Safari <15.4 no lo soporta.

### 8.8 Versiones de dependencias extremadamente recientes (poco testeadas)
- TypeScript ~6.0.2 (¡recién salido!)
- Vite ~8.0.12
- React 19.2.6
- NestJS 11.x
- RxDB 17.x
- Zod 4.x
- Chart.js 4.x
- Dexie 4.x

---

## 9. RESUMEN DE ARCHIVOS

| Categoría | Cantidad | Líneas aprox. |
|---|---|---|
| Componentes React | 25 archivos | ~11,000 |
| Contextos | 3 archivos | ~550 |
| DB/Auth/Sync | 3 archivos | ~620 |
| CSS | 2 archivos | ~4,010 |
| Config cliente | 7 archivos | ~150 |
| Config servidor | 4 archivos | ~120 |
| Módulos servidor | 17 archivos | ~1,500 |
| Prisma | 3 archivos | ~190 |
| Test | 2 archivos | ~40 |
| Infraestructura | 5 archivos | ~200 |
| **TOTAL** | **~71 archivos** | **~18,500 líneas** |

---

## 10. CONCLUSIONES Y RECOMENDACIONES

### 10.1 Para poner en producción (P1 - Inmediato):

1. **Cambiar Prisma a PostgreSQL** — El provider debe ser `postgresql` para que coincida con `docker-compose.yml`
2. **Centralizar JWT_SECRET** — Extraer a una constante compartida o variable de entorno
3. **Usar `ivaRate` de BusinessSettingsContext** en VentasPOS en vez de hardcodear 16%
4. **Verificar assets (logo.png, avatar.png)** en `src/assets/` para que Vite los compile
5. **Mover proveedores, nóminas y créditos a RxDB** para persistencia real offline-first
6. **Agregar middleware de autenticación** con `@UseGuards()`

### 10.2 Para mejorar la calidad (P2 - Corto plazo):

7. Unificar los modales de confirmación y alertas en componentes reutilizables
8. Extraer la paginación a un componente `<Pagination>` compartido
9. Extraer lógica JWT a un guard de NestJS
10. Agregar `refresh token` y revocación de JWT
11. Agregar `rate limiting` en endpoints de login y sync
12. Agregar tests (al menos 1 test de integración por módulo)

### 10.3 Para completar la funcionalidad (P3 - Mediano plazo):

13. Sincronizar purchases, payroll y suppliers en sync.ts
14. Integrar OCR real para escaneo de facturas
15. Integrar decodificador de código de barras (zbar-wasm)
16. Implementar impresión térmica (WebUSB o Bluetooth)
17. Implementar notas de crédito y devoluciones
18. Implementar factura fiscal electrónica SENIAT
19. Agregar multi-sucursal / multi-empresa

### 10.4 Para reducir deuda técnica (P4 - Largo plazo):

20. Migrar a TypeScript estricto (`strict: true`, `noImplicitAny: true`)
21. Reemplazar todos los `any` con tipos concretos
22. Implementar sistema de logging estructurado
23. Migrar a CSS modules o Tailwind CSS
24. Agregar filtro de excepciones global
25. Agregar migraciones de Prisma (`prisma migrate dev`)
26. Escribir tests para el frontend (Vitest + React Testing Library)
27. Configurar CI/CD (GitHub Actions)
28. Agregar generación automatica de types desde el schema de Prisma

---

*Documento generado el 2026-06-02 mediante análisis exhaustivo del código fuente.*
