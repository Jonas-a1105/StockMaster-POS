import { Controller, Post, Body, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { SyncService } from './sync.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  SyncProductSchema,
  SyncSaleSchema,
  SyncClientSchema,
  SyncSupplierSchema,
  SyncPurchaseSchema,
  SyncPayrollSchema,
  SyncPullSchema,
} from './sync.dto';

@Controller('sync')
@UseGuards(AuthGuard, RolesGuard)
export class SyncController {
  constructor(
    private syncService: SyncService,
  ) {}

  @Post('products/push')
  @Roles('ADMIN')
  async pushProducts(@Req() req: FastifyRequest, @Body() body: any) {
    const { products } = body;
    if (!products || !Array.isArray(products)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de productos.');
    }
    const parseResult = z.array(SyncProductSchema).safeParse(products);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de productos inválidos: ' + parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const user = (req as any).user;
    const ipAddress = req.ip || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'RxDB Sync Client';
    const result = await this.syncService.pushProducts(parseResult.data, user.sub, ipAddress, userAgent);
    return { success: true, ...result };
  }

  @Post('products/pull')
  @Roles('ADMIN', 'CASHIER')
  async pullProducts(@Body() body: any) {
    const parseResult = SyncPullSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de sincronización inválidos: ' + parseResult.error.issues.map(e => e.message).join(', '));
    }
    const result = await this.syncService.pullProducts(parseResult.data.lastSyncedAt);
    return { success: true, ...result };
  }

  @Post('sales/push')
  async pushSales(@Req() req: FastifyRequest, @Body() body: any) {
    const { sales } = body;
    if (!sales || !Array.isArray(sales)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de ventas.');
    }
    const parseResult = z.array(SyncSaleSchema).safeParse(sales);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de ventas inválidos: ' + parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const user = (req as any).user;
    const ipAddress = req.ip || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'RxDB Sync Client';
    const result = await this.syncService.pushSales(parseResult.data, user.sub, ipAddress, userAgent);
    return { success: true, ...result };
  }

  @Post('clients/push')
  async pushClients(@Req() req: FastifyRequest, @Body() body: any) {
    const { clients } = body;
    if (!clients || !Array.isArray(clients)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de clientes.');
    }
    const parseResult = z.array(SyncClientSchema).safeParse(clients);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de clientes inválidos: ' + parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const user = (req as any).user;
    const ipAddress = req.ip || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'RxDB Sync Client';
    const result = await this.syncService.pushClients(parseResult.data, user.sub, ipAddress, userAgent);
    return { success: true, ...result };
  }

  @Post('clients/pull')
  @Roles('ADMIN', 'CASHIER')
  async pullClients(@Body() body: any) {
    const parseResult = SyncPullSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de sincronización inválidos: ' + parseResult.error.issues.map(e => e.message).join(', '));
    }
    const result = await this.syncService.pullClients(parseResult.data.lastSyncedAt);
    return { success: true, ...result };
  }

  @Post('suppliers/push')
  @Roles('ADMIN')
  async pushSuppliers(@Req() req: FastifyRequest, @Body() body: any) {
    const { suppliers } = body;
    if (!suppliers || !Array.isArray(suppliers)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de proveedores.');
    }
    const parseResult = z.array(SyncSupplierSchema).safeParse(suppliers);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de proveedores inválidos: ' + parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const user = (req as any).user;
    const ipAddress = req.ip || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'RxDB Sync Client';
    const result = await this.syncService.pushSuppliers(parseResult.data, user.sub, ipAddress, userAgent);
    return { success: true, ...result };
  }

  @Post('suppliers/pull')
  @Roles('ADMIN', 'AUDITOR')
  async pullSuppliers(@Body() body: any) {
    const parseResult = SyncPullSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de sincronización inválidos: ' + parseResult.error.issues.map(e => e.message).join(', '));
    }
    const result = await this.syncService.pullSuppliers(parseResult.data.lastSyncedAt);
    return { success: true, ...result };
  }

  @Post('purchases/push')
  @Roles('ADMIN')
  async pushPurchases(@Req() req: FastifyRequest, @Body() body: any) {
    const { purchases } = body;
    if (!purchases || !Array.isArray(purchases)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de compras.');
    }
    const parseResult = z.array(SyncPurchaseSchema).safeParse(purchases);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de compras inválidos: ' + parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const user = (req as any).user;
    const ipAddress = req.ip || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'RxDB Sync Client';
    const result = await this.syncService.pushPurchases(parseResult.data, user.sub, ipAddress, userAgent);
    return { success: true, ...result };
  }

  @Post('purchases/pull')
  @Roles('ADMIN', 'AUDITOR')
  async pullPurchases(@Body() body: any) {
    const parseResult = SyncPullSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de sincronización inválidos: ' + parseResult.error.issues.map(e => e.message).join(', '));
    }
    const result = await this.syncService.pullPurchases(parseResult.data.lastSyncedAt);
    return { success: true, ...result };
  }

  @Post('payroll/push')
  @Roles('ADMIN')
  async pushPayroll(@Req() req: FastifyRequest, @Body() body: any) {
    const { payroll } = body;
    if (!payroll || !Array.isArray(payroll)) {
      throw new BadRequestException('El cuerpo de la petición debe contener un arreglo de nóminas.');
    }
    const parseResult = z.array(SyncPayrollSchema).safeParse(payroll);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de nómina inválidos: ' + parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }
    const user = (req as any).user;
    const ipAddress = req.ip || 'unknown';
    const userAgent = (req.headers['user-agent'] as string) || 'RxDB Sync Client';
    const result = await this.syncService.pushPayroll(parseResult.data, user.sub, ipAddress, userAgent);
    return { success: true, ...result };
  }

  @Post('payroll/pull')
  @Roles('ADMIN', 'AUDITOR')
  async pullPayroll(@Body() body: any) {
    const parseResult = SyncPullSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException('Datos de sincronización inválidos: ' + parseResult.error.issues.map(e => e.message).join(', '));
    }
    const result = await this.syncService.pullPayroll(parseResult.data.lastSyncedAt);
    return { success: true, ...result };
  }
}
