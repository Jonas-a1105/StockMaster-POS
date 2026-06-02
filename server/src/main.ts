import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/exception.filter';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 10 * 1024 * 1024 })
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.register(helmet, {
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await app.register(compress, { encodings: ['gzip', 'deflate', 'br'] });

  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173', 'http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const logger = new Logger('Bootstrap');
  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 StockMasterPro Server activo en: http://localhost:${port}`);
}
bootstrap();
