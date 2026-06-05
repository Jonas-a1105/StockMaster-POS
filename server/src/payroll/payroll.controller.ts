import { Controller, Get, Post, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreatePayrollSchema } from './payroll.dto';
import type { FastifyRequest } from 'fastify';

@Controller('payroll')
@UseGuards(AuthGuard, RolesGuard)
export class PayrollController {
  constructor(
    private payrollService: PayrollService,
  ) {}

  @Get()
  async getPayrolls(@Req() req: FastifyRequest) {
    const user = (req as any).user;
    return this.payrollService.getPayrolls(user.role, user.sub);
  }

  @Post()
  @Roles('ADMIN')
  async createPayroll(@Req() req: FastifyRequest, @Body() body: unknown) {
    const result = CreatePayrollSchema.safeParse(body);
    if (!result.success) {
      const msgs = result.error.issues.map(i => i.message).join(' | ');
      throw new BadRequestException(msgs);
    }

    const user = (req as any).user;
    const ip = req.ip || 'unknown';
    const ua = (req.headers['user-agent'] as string) || 'Unknown';
    return this.payrollService.createPayroll(user.sub, result.data, ip, ua);
  }
}
