import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ADMIN', 'AUDITOR')
export class ReportsController {
  constructor(
    private reportsService: ReportsService,
  ) {}

  @Get('kpis')
  async getKPIs() {
    return this.reportsService.getBusinessKPIs();
  }

  @Get('categories')
  async getSalesByCategory() {
    return this.reportsService.getSalesByCategory();
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('limit') limitStr?: string
  ) {
    const limit = limitStr ? Number(limitStr) : 12;
    return this.reportsService.getRecentAuditLogs(limit);
  }
}
