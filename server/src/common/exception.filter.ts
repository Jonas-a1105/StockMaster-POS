import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      const rawMessage = typeof res === 'string' ? res : (res as any).message || 'Error interno del servidor.';
      if (status >= 500 && process.env.NODE_ENV === 'production') {
        message = 'Ocurrió un error inesperado en el servidor.';
      } else {
        message = rawMessage;
      }
    } else {
      if (process.env.NODE_ENV === 'production') {
        message = 'Ocurrió un error inesperado en el servidor.';
      } else {
        message = exception instanceof Error ? exception.message : String(exception);
      }
    }

    this.logger.error(`[${status}] ${exception instanceof Error ? exception.message : String(exception)}`, exception instanceof Error ? exception.stack : undefined);

    response.status(status).send({
      success: false,
      statusCode: status,
      message: Array.isArray(message) ? message.join('; ') : message,
      timestamp: new Date().toISOString(),
    });
  }
}
