# StockMasterPro: Sistema POS Offline-First & Real-Time Sync

Este es el repositorio central del proyecto **StockMasterPro**, un sistema de punto de venta (POS) y administración de inventario empresarial de gama alta. Está diseñado bajo principios arquitectónicos limpios y desacoplados para garantizar estabilidad, seguridad y un rendimiento óptimo tanto sin conexión a internet (Offline-First) como en sincronización en tiempo real.

## Estructura del Proyecto

- `client/`: Aplicación frontend en React (TypeScript) impulsada por Vite y RxDB (IndexedDB).
- `server/`: Backend modular en NestJS (TypeScript) conectado a PostgreSQL a través de Prisma ORM.

## Puntos Clave de la Arquitectura
- **Base de Datos Local:** RxDB con motor de almacenamiento Dexie.js (IndexedDB).
- **Servidor Central:** NestJS con Fastify y PostgreSQL.
- **Sincronización:** Replicación bidireccional incremental con estrategia Last-Write-Wins (LWW) y Bitácora de Auditoría.
- **Seguridad:** Autenticación híbrida online/offline mediante tokens JWT encriptados localmente y PIN personal.
- **OCR Scanner:** Lectura inteligente de facturas centralizada con procesamiento diferido al recuperar la red.
- **Despliegue:** Contenerización con Docker y Proxy Inverso Nginx.
