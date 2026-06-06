import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

const isProd = process.env.NODE_ENV === 'production';

function getSentry(): any | null {
  try {
    return require('@sentry/node');
  } catch {
    return null;
  }
}

const GENERIC_MESSAGES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Solicitud inválida.',
  [HttpStatus.UNAUTHORIZED]: 'Credenciales inválidas o sesión expirada.',
  [HttpStatus.FORBIDDEN]: 'No tiene permisos para realizar esta acción.',
  [HttpStatus.NOT_FOUND]: 'Recurso no encontrado.',
  [HttpStatus.CONFLICT]: 'Conflicto con el estado actual del recurso.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Los datos proporcionados no son válidos.',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Demasiadas solicitudes. Intente de nuevo en unos momentos.',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Ocurrió un error inesperado en el servidor.',
  [HttpStatus.BAD_GATEWAY]: 'Error de pasarela. Intente de nuevo.',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Servicio temporalmente no disponible.',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Ocurrió un error inesperado en el servidor.';
    let errorCode: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const rawMessage = typeof res === 'string' ? res : (res as any).message;
      errorCode = typeof res === 'object' ? (res as any).error : undefined;

      if (isProd) {
        // En producción: mensajes genéricos para no filtrar detalles internos
        if (status >= 500) {
          message = GENERIC_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR];
        } else if (status >= 400) {
          // Para errores de validación de Zod, mantener un resumen genérico
          message = GENERIC_MESSAGES[status] || 'Solicitud inválida.';
        } else {
          message = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;
        }
      } else {
        // En desarrollo: detalle completo para debugging
        message = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;
      }
    } else {
      if (isProd) {
        message = GENERIC_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR];
      } else {
        message = exception instanceof Error ? exception.message : String(exception);
      }
    }

    // Log estructurado
    const errorMessage = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`[${status}] ${errorMessage}`, stack);

    // Sentry para 5xx
    if (status >= 500 && process.env.SENTRY_DSN) {
      const Sentry = getSentry();
      if (Sentry) {
        Sentry.captureException(exception);
      }
    }

    response.status(status).send({
      success: false,
      statusCode: status,
      message,
      ...(errorCode && !isProd ? { error: errorCode } : {}),
      ...(isProd ? {} : { timestamp: new Date().toISOString() }),
    });
  }
}
