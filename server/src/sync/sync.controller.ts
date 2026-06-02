import { Controller, Post, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { SyncService } from './sync.service';
import { AuthGuard } from '../auth/auth.guard';
import type { FastifyRequest } from 'fastify';

@Controller('sync')
@UseGuards(AuthGuard)
export class SyncController {
  constructor(
    private syncService: SyncService,
  ) {}

  @Post('products/push')
  async pushProducts(@Req() req: FastifyRequest, @Body() body: any) {
    const { products } = body;
    if (!products || !Array.isArray(products)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de productos.');
    }
    const user = (req as any).user;
    const result = await this.syncService.pushProducts(products, user.sub);
    return { success: true, ...result };
  }

  @Post('products/pull')
  async pullProducts(@Body() body: any) {
    const { lastSyncedAt } = body;
    if (!lastSyncedAt) {
      throw new BadRequestException('Se requiere la fecha de última sincronización (lastSyncedAt).');
    }
    const result = await this.syncService.pullProducts(lastSyncedAt);
    return { success: true, ...result };
  }

  @Post('sales/push')
  async pushSales(@Req() req: FastifyRequest, @Body() body: any) {
    const { sales } = body;
    if (!sales || !Array.isArray(sales)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de ventas.');
    }
    const user = (req as any).user;
    const result = await this.syncService.pushSales(sales, user.sub);
    return { success: true, ...result };
  }

  @Post('clients/push')
  async pushClients(@Req() req: FastifyRequest, @Body() body: any) {
    const { clients } = body;
    if (!clients || !Array.isArray(clients)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de clientes.');
    }
    const user = (req as any).user;
    const result = await this.syncService.pushClients(clients, user.sub);
    return { success: true, ...result };
  }

  @Post('clients/pull')
  async pullClients(@Body() body: any) {
    const { lastSyncedAt } = body;
    if (!lastSyncedAt) {
      throw new BadRequestException('Se requiere la fecha de última sincronización (lastSyncedAt).');
    }
    const result = await this.syncService.pullClients(lastSyncedAt);
    return { success: true, ...result };
  }

  @Post('suppliers/push')
  async pushSuppliers(@Req() req: FastifyRequest, @Body() body: any) {
    const { suppliers } = body;
    if (!suppliers || !Array.isArray(suppliers)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de proveedores.');
    }
    const user = (req as any).user;
    const result = await this.syncService.pushSuppliers(suppliers, user.sub);
    return { success: true, ...result };
  }

  @Post('suppliers/pull')
  async pullSuppliers(@Body() body: any) {
    const { lastSyncedAt } = body;
    if (!lastSyncedAt) throw new BadRequestException('Se requiere lastSyncedAt.');
    const result = await this.syncService.pullSuppliers(lastSyncedAt);
    return { success: true, ...result };
  }

  @Post('purchases/push')
  async pushPurchases(@Req() req: FastifyRequest, @Body() body: any) {
    const { purchases } = body;
    if (!purchases || !Array.isArray(purchases)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de compras.');
    }
    const user = (req as any).user;
    const result = await this.syncService.pushPurchases(purchases, user.sub);
    return { success: true, ...result };
  }

  @Post('purchases/pull')
  async pullPurchases(@Body() body: any) {
    const { lastSyncedAt } = body;
    if (!lastSyncedAt) throw new BadRequestException('Se requiere lastSyncedAt.');
    const result = await this.syncService.pullPurchases(lastSyncedAt);
    return { success: true, ...result };
  }

  @Post('payroll/push')
  async pushPayroll(@Req() req: FastifyRequest, @Body() body: any) {
    const { payroll } = body;
    if (!payroll || !Array.isArray(payroll)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de nóminas.');
    }
    const user = (req as any).user;
    const result = await this.syncService.pushPayroll(payroll, user.sub);
    return { success: true, ...result };
  }

  @Post('payroll/pull')
  async pullPayroll(@Body() body: any) {
    const { lastSyncedAt } = body;
    if (!lastSyncedAt) throw new BadRequestException('Se requiere lastSyncedAt.');
    const result = await this.syncService.pullPayroll(lastSyncedAt);
    return { success: true, ...result };
  }
}
