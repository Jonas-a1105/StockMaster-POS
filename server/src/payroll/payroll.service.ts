import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private auditoria: AuditoriaService
  ) {}

  // 1. Obtener nóminas con restricciones de rol
  async getPayrolls(role: string, userId: string) {
    if (role === 'ADMIN' || role === 'AUDITOR') {
      // Los administradores y auditores ven todo el listado
      return this.prisma.payroll.findMany({
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true
            }
          }
        },
        orderBy: {
          paymentDate: 'desc'
        }
      });
    } else {
      // Los cajeros comunes solo pueden ver sus propios recibos de sueldo
      return this.prisma.payroll.findMany({
        where: {
          employeeId: userId
        },
        orderBy: {
          paymentDate: 'desc'
        }
      });
    }
  }

  // 2. Registrar un pago de nómina (Exclusivo Administrador)
  async createPayroll(adminId: string, dto: {
    employeeId: string;
    baseSalary: number;
    hoursWorked: number;
    bonuses?: number;
    deductions?: number;
    paymentDate: string;
  }, ipAddress = 'unknown', userAgent = 'Unknown') {
    const bonuses = dto.bonuses || 0;
    const deductions = dto.deductions || 0;
    const totalPaid = dto.baseSalary + bonuses - deductions;

    if (totalPaid < 0) {
      throw new BadRequestException('El total pagado no puede ser un valor negativo.');
    }

    // Verifica si el empleado existe
    const employee = await this.prisma.user.findUnique({
      where: { id: dto.employeeId }
    });

    if (!employee) {
      throw new BadRequestException('El empleado especificado no existe.');
    }

    const payroll = await this.prisma.payroll.create({
      data: {
        employeeId: dto.employeeId,
        baseSalary: dto.baseSalary,
        hoursWorked: dto.hoursWorked,
        bonuses,
        deductions,
        totalPaid,
        status: 'PAGADO',
        paymentDate: new Date(dto.paymentDate)
      },
      include: {
        employee: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // Registra la acción en la bitácora central de auditoría
    await this.auditoria.logAction(
      adminId,
      'NOMINA_REGISTRO_PAGO',
      {
        payrollId: payroll.id,
        employeeName: employee.name,
        totalPaid,
        period: dto.paymentDate
      },
      ipAddress,
      userAgent
    );

    return payroll;
  }
}
