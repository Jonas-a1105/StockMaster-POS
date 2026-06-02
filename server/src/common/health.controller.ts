import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().rss,
    };
  }

  @Get('seed')
  async seed() {
    const adminPassword = await bcrypt.hash('admin123', 10);
    const cashierPassword = await bcrypt.hash('cajero123', 10);
    const adminPin = await bcrypt.hash('1234', 10);
    const cashierPin = await bcrypt.hash('5678', 10);

    const admin = await this.prisma.user.upsert({
      where: { email: 'admin@stockmaster.com' },
      update: {},
      create: { email: 'admin@stockmaster.com', password: adminPassword, name: 'Admin Principal', role: 'ADMIN', pin: adminPin },
    });

    const cashier = await this.prisma.user.upsert({
      where: { email: 'cajero@stockmaster.com' },
      update: {},
      create: { email: 'cajero@stockmaster.com', password: cashierPassword, name: 'Cajero Demo', role: 'CASHIER', pin: cashierPin },
    });

    const products = [
      { code: 'PROD001', name: 'Arroz 1kg', category: 'Alimentos', price: 1.50, cost: 1.00, stock: 100, minStock: 10 },
      { code: 'PROD002', name: 'Frijoles 500g', category: 'Alimentos', price: 1.20, cost: 0.80, stock: 80, minStock: 10 },
      { code: 'PROD003', name: 'Aceite 1L', category: 'Alimentos', price: 3.00, cost: 2.20, stock: 50, minStock: 5 },
      { code: 'PROD004', name: 'Azúcar 1kg', category: 'Alimentos', price: 1.80, cost: 1.30, stock: 60, minStock: 10 },
      { code: 'PROD005', name: 'Leche 1L', category: 'Lácteos', price: 2.20, cost: 1.60, stock: 40, minStock: 8 },
      { code: 'PROD006', name: 'Pan Molde', category: 'Panadería', price: 2.50, cost: 1.80, stock: 30, minStock: 5 },
      { code: 'PROD007', name: 'Huevos x12', category: 'Alimentos', price: 2.00, cost: 1.40, stock: 70, minStock: 15 },
      { code: 'PROD008', name: 'Agua 1.5L', category: 'Bebidas', price: 0.80, cost: 0.40, stock: 120, minStock: 20 },
      { code: 'PROD009', name: 'Jabón de Baño', category: 'Limpieza', price: 1.50, cost: 1.00, stock: 45, minStock: 8 },
      { code: 'PROD010', name: 'Detergente 500g', category: 'Limpieza', price: 3.50, cost: 2.50, stock: 35, minStock: 5 },
    ];

    for (const p of products) {
      await this.prisma.product.upsert({
        where: { code: p.code },
        update: {},
        create: p,
      });
    }

    await this.prisma.supplier.upsert({
      where: { id: 'seed-supplier' },
      update: {},
      create: { id: 'seed-supplier', name: 'Distribuidora Mayorista', contact: 'Juan Pérez', phone: '+505 8888-0000' },
    });

    await this.prisma.client.upsert({
      where: { id: 'seed-client' },
      update: {},
      create: { id: 'seed-client', name: 'Cliente General', email: 'cliente@example.com', phone: '+505 7777-0000' },
    });

    return { seeded: true, users: [admin.email, cashier.email], products: products.length };
  }
}
