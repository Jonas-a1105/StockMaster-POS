import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditoriaService {
  constructor(private prisma: PrismaService) {}

  // 1. Registro centralizado de logs de auditoría (Bitácora)
  async logAction(
    userId: string | null,
    action: string,
    details: any,
    ipAddress: string,
    userAgent: string,
    severity?: string
  ) {
    const deducedSeverity = severity || (
      action.endsWith('_ELIMINAR') || action.includes('ELIMINAR') || action.includes('BORRAR') || action.includes('SOBREESCRITURA')
        ? 'CRITICAL'
        : (action.includes('_EDITAR') || action.includes('EDITAR') || action.includes('MODIFICAR') || action.includes('CONFLICT') || action.includes('CIERRE') || action.includes('AJUSTE'))
          ? 'WARNING'
          : 'INFO'
    );

    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        details: JSON.stringify(details),
        ipAddress,
        userAgent,
        severity: deducedSeverity
      }
    });
  }

  // 2. Obtención de registros para paneles de auditoría (Auditor o Administrador)
  async getLogs(role: string, skip = 0, take = 100) {
    // Protección estricta contra accesos no autorizados a logs sensibles
    if (role !== 'ADMIN' && role !== 'AUDITOR') {
      throw new UnauthorizedException('No cuenta con privilegios para consultar la Bitácora.');
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              role: true
            }
          }
        }
      }),
      this.prisma.auditLog.count()
    ]);

    return { logs, total, skip, take };
  }
}
