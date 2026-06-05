import { Controller, Get, Query, UseGuards, BadRequestException } from '@nestjs/common';
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

  @Get('star-products')
  async getStarProducts(@Query('limit') limitStr?: string) {
    let limit = 10;
    if (limitStr) {
      const parsed = Number(limitStr);
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestException('El parámetro limit debe ser un número entero positivo.');
      }
      if (parsed > 50) {
        throw new BadRequestException('El parámetro limit no puede exceder 50.');
      }
      limit = parsed;
    }
    return this.reportsService.getStarProducts(limit);
  }

  @Get('weekly-performance')
  async getWeeklyPerformance() {
    return this.reportsService.getWeeklyPerformance();
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Query('limit') limitStr?: string
  ) {
    let limit = 12;
    if (limitStr) {
      const parsed = Number(limitStr);
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        throw new BadRequestException('El parámetro limit debe ser un número entero positivo.');
      }
      if (parsed > 100) {
        throw new BadRequestException('El parámetro limit no puede exceder 100.');
      }
      limit = parsed;
    }
    return this.reportsService.getRecentAuditLogs(limit);
  }
}
