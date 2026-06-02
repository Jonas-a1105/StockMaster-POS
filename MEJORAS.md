# Plan de Mejoras — StockMasterPro POS

> Análisis profesional del estado actual y hoja de ruta para producción.

---

## 🔴 Crítico — Seguridad y Producción

| # | Mejora | Impacto | Estado actual |
|---|--------|---------|---------------|
| 1 | **Prisma Migrations + Seed** | Sin datos iniciales la app no funciona al desplegar | No existe script `migrate` ni seed |
| 2 | **Refresh Tokens + HTTP-only cookies** | JWT en localStorage vulnerable a XSS | Token dura 24h sin rotación |
| 3 | **Rate Limiting** | Fuerza bruta en login | Sin protección |
| 4 | **Helmet + CSRF** | Headers de seguridad ausentes | Servidor expuesto |
| 5 | **Validación Zod fuerte en todos los endpoints** | Algunos controllers usan `any` | Validación incompleta |

---

## 🟡 Arquitectura — Deuda Técnica

| # | Mejora | Beneficio |
|---|--------|-----------|
| 6 | **Monorepo con Turborepo/Nx** | Scripts compartidos, tsconfig base, lint unificado |
| 7 | **Prisma Studio para admin** | UI para gestionar usuarios sin código |
| 8 | **Logging estructurado (Winston/Pino)** | Trazabilidad, niveles de log, archivos rotativos |
| 9 | **Health Check endpoint** | Monitoreo Docker/Kubernetes |
| 10 | **Tests automatizados** | 0 tests frontend, 1 backend — no se puede refactorizar |
| 11 | **TypeScript strict mode** | `noImplicitAny: false` → errores silenciosos |

---

## 🟢 Funcionalidad — Features que faltan

| # | Mejora | Por qué es importante |
|---|--------|----------------------|
| 12 | **Lector de código de barras real** (zbar-wasm) | El POS muestra la cámara pero no decodifica nada |
| 13 | **OCR real para facturas** (Tesseract.js) | Compras.tsx simula OCR con JSON hardcodeado |
| 14 | **Impresión de tickets real** (escpos / WebUSB) | Solo hay preview, no imprime |
| 15 | **Cierre de caja (X/Z reports)** | Conteo real de efectivo vs ventas del turno |
| 16 | **Exportación a Excel/PDF real** | Botones de descarga muestran `alert()` |
| 17 | **Sincronización completa de usuarios** | Empleados creados en una caja no aparecen en otra |
| 18 | **Notificaciones push PWA** | Alertas de stock bajo, cierre de caja |
| 19 | **Multi-sucursal (branch_id)** | Una empresa con varias tiendas no puede separar datos |
| 20 | **WebSockets para dashboard en vivo** | RxDB es local; otra caja no se ve en tiempo real |

---

## 🔵 UI/UX — Diseño y usabilidad

| # | Mejora | Problema actual |
|---|--------|-----------------|
| 21 | **Pantalla de carga (Splash screen)** | La app carga 1-3s sin feedback visual |
| 22 | **Empty states ilustrados** | Tablas vacías sin mensaje amigable |
| 23 | **Botones touch-friendly** | Modales con botones pequeños para tablet POS |
| 24 | **Modo quiosco (kiosk mode)** | Pantalla completa bloqueada para caja registradora |
| 25 | **Cheat sheet de atajos de teclado** | Los shortcuts existen pero no son visibles |
| 26 | **Feedback háptico y sonido** | Escanear, agregar al carrito, cobrar — sin vibración |

---

## 🟣 DevOps — Configuración y despliegue

| # | Mejora | Estado actual |
|---|--------|---------------|
| 27 | **Docker Compose con secrets reales** | Usa fallbacks con passwords hardcodeadas |
| 28 | **Docker multi-stage build** | Cliente Vite debería construir + servir con nginx |
| 29 | **CI/CD (GitHub Actions)** | Sin pipeline de test + build + deploy |
| 30 | **Migraciones automáticas en Docker** | Backend debería correr `prisma migrate deploy` al iniciar |
| 31 | **Entornos dev/staging/prod** | Sin separación de configuraciones |

---

## 🟠 Rendimiento

| # | Mejora | Problema |
|---|--------|----------|
| 32 | **Virtual scrolling** | Paginación manual con useState → lento con 10k+ productos |
| 33 | **Lazy loading de componentes** | Dashboard importa todo estáticamente |
| 34 | **Compresión Brotli en Fastify** | Respuestas JSON sin comprimir |
| 35 | **Service Worker + cache API** | PWA sin estrategia de cache para assets |

---

## 🎯 Top 5 recomendados para implementar YA

1. **Prisma migrate + seed** — sin datos la app no sirve al desplegar
2. **Refresh tokens + cookies httpOnly** — seguridad crítica para un POS
3. **Lector de código de barras real** con `zbar-wasm` — funcionalidad core del POS
4. **Impresión térmica** con `escpos` — sin ticket el POS no cierra el ciclo
5. **Tests (login + sync)** — para poder refactorizar sin miedo
