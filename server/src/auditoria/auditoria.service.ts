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
    userAgent: string
  ) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        details: JSON.stringify(details),
        ipAddress,
        userAgent
      }
    });
  }

  // 2. Obtención de registros para paneles de auditoría (Auditor o Administrador)
  async getLogs(role: string) {
    // Protección estricta contra accesos no autorizados a logs sensibles
    if (role !== 'ADMIN' && role !== 'AUDITOR') {
      throw new UnauthorizedException('No cuenta con privilegios para consultar la Bitácora.');
    }

    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100, // Retorna los últimos 100 registros
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
  }
}
