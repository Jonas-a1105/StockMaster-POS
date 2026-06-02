import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { AuthGuard } from '../auth/auth.guard';
import type { FastifyRequest } from 'fastify';

@Controller('auditoria')
@UseGuards(AuthGuard)
export class AuditoriaController {
  constructor(
    private auditoriaService: AuditoriaService,
  ) {}

  @Get()
  async getLogs(@Req() req: FastifyRequest) {
    const user = (req as any).user;
    return this.auditoriaService.getLogs(user.role);
  }
}
