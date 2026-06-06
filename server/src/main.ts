import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/exception.filter';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { FastifyReply, FastifyRequest } from 'fastify';

// ── Dependencias opcionales: cargadas solo si están instaladas y configuradas ──
// Esto evita errores de TS/build si el usuario aún no corrió `npm install`.
function tryRequire(name: string): any | null {
  try {
    return require(name);
  } catch {
    return null;
  }
}

const DEFAULT_JWT_SECRET = 'cambiar_esta_clave_secreta_en_produccion';
const isProd = process.env.NODE_ENV === 'production';

function parseCORSOrigins(raw: string | undefined): (string | RegExp)[] {
  const defaults: (string | RegExp)[] = ['http://localhost:5173', 'http://localhost:3000'];
  if (!raw) return defaults;
  const parsed: (string | RegExp)[] = [];
  for (const item of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const lower = item.toLowerCase();
    if (lower === 'null' || lower === 'file://') {
      parsed.push('null');
    } else if (item === '*') {
      parsed.push(/^https?:\/\//);
    } else {
      parsed.push(item);
    }
  }
  return Array.from(new Set(parsed));
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // ── OpenTelemetry (debe ir ANTES de NestFactory) ──────────────────────
  if (process.env.OTEL_ENABLED === 'true' && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const sdkNode = tryRequire('@opentelemetry/sdk-node');
    const autoInstr = tryRequire('@opentelemetry/auto-instrumentations-node');
    if (sdkNode && autoInstr) {
      const otelSDK = new sdkNode.NodeSDK({
        serviceName: process.env.OTEL_SERVICE_NAME || 'stockmaster-server',
        instrumentations: [autoInstr.getNodeAutoInstrumentations()],
      });
      try {
        otelSDK.start();
        logger.log('🔭 OpenTelemetry inicializado.');
      } catch (err) {
        logger.error('No se pudo iniciar OpenTelemetry', err as Error);
      }
    } else {
      logger.warn('⚠️  OpenTelemetry habilitado pero paquetes no instalados. Ejecute: npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node');
    }
  }

  // ── Sentry (server-side) ──────────────────────────────────────────────
  if (process.env.SENTRY_DSN) {
    const Sentry = tryRequire('@sentry/node');
    if (Sentry) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.2),
        profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),
      });
      logger.log('🛡️  Sentry inicializado.');
    } else {
      logger.warn('⚠️  SENTRY_DSN definido pero @sentry/node no instalado. Ejecute: npm install @sentry/node');
    }
  }

  // ── Validación de JWT_SECRET: fail-fast en producción ─────────────────
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === DEFAULT_JWT_SECRET) {
    if (isProd) {
      logger.error('❌ JWT_SECRET no configurado o usa valor por defecto. Defínalo en .env antes de iniciar en producción.');
      process.exit(1);
    }
    const generated = require('crypto').randomBytes(64).toString('hex');
    logger.warn('⚠️  JWT_SECRET no configurado (desarrollo). Generando secreto automático temporal.');
    logger.warn('⚠️  Para producción, configúrelo en .env y reinicie.');
    process.env.JWT_SECRET = generated;
  } else if (jwtSecret.length < 32) {
    if (isProd) {
      logger.error('❌ JWT_SECRET debe tener al menos 32 caracteres en producción.');
      process.exit(1);
    }
    logger.warn('⚠️  JWT_SECRET tiene menos de 32 caracteres. Recomendado: >= 64.');
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024, trustProxy: true })
  );

  app.useWebSocketAdapter(new IoAdapter(app.getHttpServer()));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Helmet con CSP estricta ───────────────────────────────────────────
  const cspDirectives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // 'unsafe-inline' para estilos inline usados por Vite/Tauri
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: ["'self'", 'ws:', 'wss:', 'http://localhost:*', 'http://127.0.0.1:*', 'https://*'],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: isProd ? [] : null,
  };

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: cspDirectives,
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProd ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    hidePoweredBy: true,
    noSniff: true,
    frameguard: { action: 'deny' },
  });

  await app.register(compress, { encodings: ['gzip', 'deflate', 'br'] });

  // ── Redirección HTTP → HTTPS opcional ─────────────────────────────────
  if (process.env.FORCE_HTTPS === 'true') {
    const fastifyInstance = (app as any).instance;
    if (fastifyInstance && typeof fastifyInstance.addHook === 'function') {
      fastifyInstance.addHook('onRequest', (request: any, reply: any, done: () => void) => {
        const protocol = request.headers['x-forwarded-proto'] || request.protocol;
        if (protocol !== 'https') {
          reply.redirect(301, `https://${request.hostname}${request.url}`);
          return;
        }
        done();
      });
    }
    logger.log('🔒 Redirección HTTP → HTTPS activada.');
  }

  // ── Servir frontend build (producción) ────────────────────────────────
  if (isProd) {
    const clientDistPath = join(__dirname, '..', '..', 'client', 'dist');
    if (existsSync(join(clientDistPath, 'index.html'))) {
      await app.register(require('@fastify/static'), {
        root: clientDistPath,
        cacheControl: true,
        maxAge: '1d',
      });
      const fastifyInstance = (app as any).instance;
      if (fastifyInstance && typeof fastifyInstance.setNotFoundHandler === 'function') {
        const indexPath = join(clientDistPath, 'index.html');
        const indexContent = readFileSync(indexPath, 'utf-8');
        fastifyInstance.setNotFoundHandler((_request: FastifyRequest, reply: FastifyReply) => {
          reply.type('text/html').send(indexContent);
        });
      }
      logger.log(`📦 Sirviendo frontend build desde ${clientDistPath}`);
    } else {
      logger.warn('⚠️  No se encontró build del frontend en client/dist/. Solo API disponible.');
    }
  }

  // ── CORS saneado ──────────────────────────────────────────────────────
  const allowedOrigins = parseCORSOrigins(process.env.CORS_ORIGINS);
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // sin Origin (curl, server-to-server) → ok
      if (allowedOrigins.some((o) => (o instanceof RegExp ? o.test(origin) : o === origin))) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 StockMasterPro Server activo en: http://localhost:${port}`);
}
bootstrap();
